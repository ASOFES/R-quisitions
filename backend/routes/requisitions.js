const express = require('express');
const multer = require('multer');
const path = require('path');
const { dbUtils } = require('../database/database');
const { authenticateToken, requireRole, checkRequisitionAccess } = require('../middleware/auth');
const PdfService = require('../services/PdfService');

const router = express.Router();

// Configuration de multer pour l'upload de fichiers
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, path.join(__dirname, '../uploads'));
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = /pdf|doc|docx|xls|xlsx|jpg|jpeg|png|gif|txt/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    // Note: Le check mimetype strict échoue pour les fichiers Office (docx, xlsx) et txt (text/plain)
    // On se fie principalement à l'extension pour le moment.
    
    if (extname) {
      return cb(null, true);
    } else {
      cb(new Error('Type de fichier non autorisé'));
    }
  }
});

// Générer un numéro de réquisition unique
async function generateRequisitionNumber(serviceId, zoneCode, siteId) {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  
  // Get Service Code
  const service = await dbUtils.get('SELECT code FROM services WHERE id = ?', [serviceId]);
  const serviceCode = service ? service.code : 'GEN';

  // Zone Code is passed (or default)
  const zone = zoneCode || 'GEN';
  
  // Site initials (si disponible). La table sites n'a pas de code, on dérive des initiales du nom.
  // Segment SITE: toujours présent (fallback 'GEN' si aucun site)
  let siteSuffix = 'GEN';
  try {
    if (siteId) {
      const site = await dbUtils.get('SELECT nom FROM sites WHERE id = ?', [siteId]);
      if (site && site.nom) {
        const words = site.nom.trim().split(/\s+/);
        const initials = words.map(w => w[0]).join('').toUpperCase();
        siteSuffix = initials.slice(0, 3);
      }
    }
  } catch (e) {
    // En cas d'erreur DB, garder fallback
    siteSuffix = 'GEN';
  }
  
  // Compter les réquisitions du mois
  const count = await dbUtils.get(
    'SELECT COUNT(*) as count FROM requisitions WHERE strftime("%Y-%m", created_at) = ?',
    [`${year}-${month}`]
  );
  
  const sequence = String(count.count + 1).padStart(4, '0');
  
  // Format: SERVICE-YYYYMM-SEQ-ZONE-SITE
  const numero = `${serviceCode}-${year}${month}-${sequence}-${zone}-${siteSuffix}`;
  console.log(`Génération numéro réquisition: ${numero} (Service=${serviceCode}, Zone=${zone}, Site=${siteSuffix})`);
  return numero;
}

// Route pour compiler les PDF (doit être avant /:id)
router.get('/compile/pdf', authenticateToken, async (req, res) => {
  try {
    const user = req.user;
    const userRole = user.role;
    
    let targetLevel = userRole; 
    if (userRole === 'pm') targetLevel = 'validateur';
    if (userRole === 'comptable') targetLevel = 'paiement';

    console.log(`PDF Compilation requested by ${user.username} (${userRole}) for level ${targetLevel}`);

    let query = `
        SELECT r.*, u.nom_complet as emetteur_nom, s.nom as service_nom, r.commentaire_initial
        FROM requisitions r
        LEFT JOIN users u ON r.emetteur_id = u.id
        LEFT JOIN services s ON r.service_id = s.id
        WHERE r.statut NOT IN ('payee', 'refusee', 'annulee', 'termine')
    `;
    
    let params = [];

    if (userRole !== 'admin') {
        query += ` AND r.niveau = ?`;
        params.push(targetLevel);
    }
    
    const requisitions = await dbUtils.all(query, params);
    
    if (requisitions.length === 0) {
         return res.status(404).json({ message: 'Aucune réquisition à ce niveau.' });
    }

    const pdfBytes = await PdfService.compileRequisitionsPdf(requisitions);
    
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=requisitions_${targetLevel}_${Date.now()}.pdf`);
    res.send(Buffer.from(pdfBytes));

  } catch (error) {
    console.error('Erreur PDF compilation:', error);
    res.status(500).json({ error: 'Erreur lors de la génération du PDF' });
  }
});

// Obtenir les réquisitions selon le rôle de l'utilisateur
router.get('/', authenticateToken, async (req, res) => {
  try {
    const user = req.user;
    let query = `
      SELECT r.*, u.nom_complet as emetteur_nom, s.code as service_code, s.nom as service_nom,
             (SELECT COUNT(*) FROM pieces_jointes pj WHERE pj.requisition_id = r.id) as nb_pieces
      FROM requisitions r
      LEFT JOIN users u ON r.emetteur_id = u.id
      JOIN services s ON r.service_id = s.id
    `;
    
    let params = [];
    
    // Filtrer selon le rôle
    if (user.role === 'admin') {
      // Admin voit tout
      query += ' ORDER BY r.created_at DESC';
    } else if (user.role === 'emetteur') {
      // Émetteur ne voit que ses réquisitions
      query += ' WHERE r.emetteur_id = ? ORDER BY r.created_at DESC';
      params.push(user.id);
    } else if (user.role === 'comptable') {
      // Comptable ne voit que les réquisitions validées et plus
      query += ' WHERE r.niveau IN (?, ?, ?, ?) ORDER BY r.created_at DESC';
      params.push('validateur', 'paiement', 'justificatif', 'termine');
    } else if (user.role === 'analyste') {
      // Analyste doit voir aussi les nouvelles réquisitions créées par les émetteurs
      query += ' WHERE (r.niveau = ? OR r.niveau = ? OR r.niveau = ? OR r.niveau = ? OR r.niveau = ?) ORDER BY r.created_at DESC';
      params.push('emetteur', 'analyste', 'paiement', 'justificatif', 'termine');
      
      console.log('Récupération des réquisitions pour analyste (incluant niveau emetteur)');
      console.log(`Requête: ${query}`);
      console.log(`Paramètres: ${params}`);
    } else {
      // Challenger, Validateur, PM, GM voient les réquisitions à partir de leur niveau et les suivants
      const niveauOrder = {
        'challenger': 'challenger',
        'validateur': 'validateur',
        'pm': 'validateur',
        'gm': 'gm'
      };
      
      const niveau = niveauOrder[user.role];
      if (niveau) {
        // Logique de visibilité en cascade
        let visibleLevels = [];
        if (user.role === 'challenger') visibleLevels = ['challenger', 'validateur', 'gm', 'paiement', 'justificatif', 'termine'];
        else if (user.role === 'validateur' || user.role === 'pm') visibleLevels = ['challenger', 'validateur', 'gm', 'paiement', 'justificatif', 'termine'];
        else if (user.role === 'gm') visibleLevels = ['gm', 'paiement', 'justificatif', 'termine'];
        
        // Construction de la clause WHERE avec les niveaux visibles
        const placeholders = visibleLevels.map(() => '?').join(', ');
        query += ` WHERE r.niveau IN (${placeholders}) ORDER BY r.created_at DESC`;
        params.push(...visibleLevels);
        
        console.log(`Récupération des réquisitions pour ${user.role} (niveaux: ${visibleLevels.join(', ')})`);
        console.log(`Requête: ${query}`);
        console.log(`Paramètres: ${params}`);
      }
    }
    
    const requisitions = await dbUtils.all(query, params);
    res.json(requisitions);
  } catch (error) {
    console.error('Erreur lors de la récupération des réquisitions:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// Créer une réquisition (émétteur et admin)
router.post('/', authenticateToken, requireRole(['emetteur', 'admin']), upload.array('pieces', 5), async (req, res) => {
  try {
    const { objet, montant_usd, montant_cdf, commentaire_initial, service_id, related_to, site_id, items } = req.body;
    const user = req.user;

    if (!objet || !service_id) {
      return res.status(400).json({ error: 'Objet et service sont obligatoires' });
    }

    // Parse items if it's a string (multipart/form-data issues)
    let parsedItems = [];
    if (items) {
        try {
            parsedItems = typeof items === 'string' ? JSON.parse(items) : items;
        } catch (e) {
            console.error('Error parsing items:', e);
        }
    }

    // Calculate totals from items if not provided or to override
    let finalMontantUsd = montant_usd || 0;
    let finalMontantCdf = montant_cdf || 0;

    if (parsedItems.length > 0) {
        finalMontantUsd = 0; // Reset if items exist
        finalMontantCdf = 0; // We might want to handle mixed currencies, but for now assuming one main currency for simplicity or summing up.
        // Wait, items might have different currencies? The prompt says "total". 
        // Let's assume the user selects a currency for the requisition, or we sum up USD and CDF separately.
        // The DB has montant_usd and montant_cdf columns.
        
        // Let's iterate items
        for (const item of parsedItems) {
            // item: { description, quantite, prix_unitaire, currency ('USD' or 'CDF'), site_id }
            const qty = parseFloat(item.quantite) || 1;
            const price = parseFloat(item.prix_unitaire) || 0;
            const total = qty * price;
            
            if (item.devise === 'CDF') {
                finalMontantCdf += total;
            } else {
                finalMontantUsd += total;
            }
        }
    }


    // Générer le numéro de réquisition (incluant zone et éventuellement site)
    const numero = await generateRequisitionNumber(service_id, user.zone_code, site_id);

    // Insérer la réquisition
    const result = await dbUtils.run(
      'INSERT INTO requisitions (numero, objet, montant_usd, montant_cdf, commentaire_initial, emetteur_id, service_id, niveau, related_to, site_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [numero, objet, finalMontantUsd || null, finalMontantCdf || null, commentaire_initial, user.id, service_id, 'emetteur', related_to || null, site_id || null]
    );

    // Insert items
    if (parsedItems.length > 0) {
        for (const item of parsedItems) {
             const qty = parseFloat(item.quantite) || 1;
             const price = parseFloat(item.prix_unitaire) || 0;
             const total = qty * price;
             
             await dbUtils.run(
                 'INSERT INTO lignes_requisition (requisition_id, description, quantite, prix_unitaire, prix_total, site_id) VALUES (?, ?, ?, ?, ?, ?)',
                 [result.id, item.description, qty, price, total, item.site_id || site_id || null]
             );
        }
    }

    // Ajouter les pièces jointes si présentes
    if (req.files && req.files.length > 0) {
      for (const file of req.files) {
        await dbUtils.run(
          'INSERT INTO pieces_jointes (requisition_id, nom_fichier, chemin_fichier, taille_fichier, type_fichier, uploaded_by) VALUES (?, ?, ?, ?, ?, ?)',
          [result.id, file.originalname, file.path, file.size, file.mimetype, user.id]
        );
      }
    }

    res.status(201).json({
      message: 'Réquisition créée avec succès',
      requisitionId: result.id,
      numero
    });
  } catch (error) {
    console.error('Erreur lors de la création de la réquisition:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// Obtenir les détails d'une réquisition par numéro
router.get('/by-number/:number', authenticateToken, async (req, res) => {
  try {
    const { number } = req.params;
    
    // Récupérer la réquisition
    const requisition = await dbUtils.get(`
      SELECT r.*, u.nom_complet as emetteur_nom, s.code as service_code, s.nom as service_nom
      FROM requisitions r
      LEFT JOIN users u ON r.emetteur_id = u.id
      JOIN services s ON r.service_id = s.id
      WHERE r.numero = ?
    `, [number]);

    if (!requisition) {
      return res.status(404).json({ error: 'Réquisition non trouvée' });
    }

    // Reuse the ID to fetch details
    const id = requisition.id;

    // Récupérer les actions
    const actions = await dbUtils.all(`
      SELECT ra.*, u.nom_complet as utilisateur_nom
      FROM requisition_actions ra
      LEFT JOIN users u ON ra.utilisateur_id = u.id
      WHERE ra.requisition_id = ?
      ORDER BY ra.created_at ASC
    `, [id]);

    // Récupérer les messages
    const messages = await dbUtils.all(`
      SELECT m.*, u.nom_complet as utilisateur_nom
      FROM messages m
      LEFT JOIN users u ON m.utilisateur_id = u.id
      WHERE m.requisition_id = ?
      ORDER BY m.created_at ASC
    `, [id]);

    // Récupérer les pièces jointes
    const pieces = await dbUtils.all(`
      SELECT pj.*, u.nom_complet as uploader_nom
      FROM pieces_jointes pj
      LEFT JOIN users u ON pj.uploaded_by = u.id
      WHERE pj.requisition_id = ?
      ORDER BY pj.created_at ASC
    `, [id]);

    // Récupérer les lignes de réquisition
    const items = await dbUtils.all(`
      SELECT lr.*, s.nom as site_nom
      FROM lignes_requisition lr
      LEFT JOIN sites s ON lr.site_id = s.id
      WHERE lr.requisition_id = ?
      ORDER BY lr.id ASC
    `, [id]);

    // Récupérer le site
    let site = null;
    if (requisition.site_id) {
        site = await dbUtils.get('SELECT * FROM sites WHERE id = ?', [requisition.site_id]);
    }

    res.json({
      requisition: { ...requisition, site_nom: site ? site.nom : null },
      actions,
      messages,
      pieces,
      items
    });
  } catch (error) {
    console.error('Erreur lors de la récupération des détails par numéro:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// Obtenir les détails d'une réquisition
router.get('/:id', authenticateToken, checkRequisitionAccess, async (req, res) => {
  try {
    const { id } = req.params;
    
    // Récupérer la réquisition
    const requisition = await dbUtils.get(`
      SELECT r.*, u.nom_complet as emetteur_nom, s.code as service_code, s.nom as service_nom
      FROM requisitions r
      JOIN users u ON r.emetteur_id = u.id
      JOIN services s ON r.service_id = s.id
      WHERE r.id = ?
    `, [id]);

    // Récupérer les actions
    const actions = await dbUtils.all(`
      SELECT ra.*, u.nom_complet as utilisateur_nom
      FROM requisition_actions ra
      JOIN users u ON ra.utilisateur_id = u.id
      WHERE ra.requisition_id = ?
      ORDER BY ra.created_at ASC
    `, [id]);

    // Récupérer les messages
    const messages = await dbUtils.all(`
      SELECT m.*, u.nom_complet as utilisateur_nom
      FROM messages m
      JOIN users u ON m.utilisateur_id = u.id
      WHERE m.requisition_id = ?
      ORDER BY m.created_at ASC
    `, [id]);

    // Récupérer les pièces jointes
    const pieces = await dbUtils.all(`
      SELECT pj.*, u.nom_complet as uploader_nom
      FROM pieces_jointes pj
      LEFT JOIN users u ON pj.uploaded_by = u.id
      WHERE pj.requisition_id = ?
      ORDER BY pj.created_at ASC
    `, [id]);

    // Récupérer les lignes de réquisition (nouveau)
    const items = await dbUtils.all(`
      SELECT lr.*, s.nom as site_nom
      FROM lignes_requisition lr
      LEFT JOIN sites s ON lr.site_id = s.id
      WHERE lr.requisition_id = ?
      ORDER BY lr.id ASC
    `, [id]);

    // Récupérer le site de la réquisition (nouveau)
    let site = null;
    if (requisition.site_id) {
        site = await dbUtils.get('SELECT * FROM sites WHERE id = ?', [requisition.site_id]);
    }

    res.json({
      requisition: { ...requisition, site_nom: site ? site.nom : null },
      actions,
      messages,
      pieces,
      items
    });
  } catch (error) {
    console.error('Erreur lors de la récupération des détails:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// Action sur une réquisition (valider, modifier, refuser)
router.put('/:id/action', authenticateToken, checkRequisitionAccess, async (req, res) => {
  try {
    const { id } = req.params;
    const { action, commentaire } = req.body;
    const user = req.user;
    const userRole = user.role ? user.role.toLowerCase() : '';

    console.log(`Action attempt: User=${user.username}, Role=${userRole}, Action=${action}, RequisitionID=${id}`);

    if (!action || (!commentaire && userRole !== 'comptable')) {
      return res.status(400).json({ error: 'Action et commentaire sont obligatoires' });
    }

    const validActions = ['valider', 'modifier', 'refuser'];
    if (!validActions.includes(action)) {
      return res.status(400).json({ error: 'Action non valide' });
    }

    // Vérifier si l'utilisateur peut effectuer cette action
    const requisition = req.requisition;

    if (['payee', 'refuse', 'refusee', 'termine'].includes(requisition.statut)) {
      return res.status(400).json({ error: 'Action impossible sur une réquisition terminée' });
    }

    const allowedRoles = ['emetteur', 'analyste', 'challenger', 'validateur', 'gm', 'comptable'];
    if (!allowedRoles.includes(userRole) && userRole !== 'pm') {
      return res.status(403).json({ error: 'Vous n\'êtes pas autorisé à effectuer cette action' });
    }

    // Vérifier si la réquisition est au bon niveau pour l'utilisateur
    if (requisition.niveau !== userRole) {
         // Exception pour l'analyste qui agit sur les réquisitions au niveau 'emetteur'
         if (userRole === 'analyste' && requisition.niveau === 'emetteur') {
             // OK
         }
         // Exception pour PM qui agit comme validateur
         else if (userRole === 'pm' && requisition.niveau === 'validateur') {
             // OK
         }
         // Exception pour PM/Validateur qui agit sur le niveau challenger (skip ou intérim)
         else if ((userRole === 'pm' || userRole === 'validateur') && requisition.niveau === 'challenger') {
             // OK
         }
         else if (userRole === 'gm' && requisition.niveau === 'gm') {
             // OK
         }
         // Exception pour le comptable qui agit au niveau paiement
         else if (userRole === 'comptable' && requisition.niveau === 'paiement') {
             // OK
         }
         // Si aucune exception ne matche et que les rôles ne sont pas identiques
         else if (userRole !== requisition.niveau) {
             console.log(`Access denied: UserRole=${userRole}, ReqNiveau=${requisition.niveau}`);
             return res.status(403).json({ error: `Cette réquisition n'est pas à votre niveau (${requisition.niveau} vs ${userRole})` });
         }
    }

    // Utilisation du WorkflowService pour traiter l'action
    const result = await WorkflowService.processAction(id, action, userRole, user.id, commentaire);

    res.json({
      message: `Action ${action} effectuée avec succès`,
      niveauApres: result.niveauApres
    });
  } catch (error) {
    console.error('Erreur lors de l\'action sur la réquisition:', error);
    res.status(500).json({ error: error.message || 'Erreur serveur' });
  }
});

// Mettre à jour une réquisition (émetteur uniquement, si brouillon ou a_corriger)
router.put('/:id', authenticateToken, upload.array('pieces', 5), async (req, res) => {
  try {
    const { id } = req.params;
    const { objet, montant_usd, montant_cdf, commentaire_initial, service_id, resubmit, site_id } = req.body;
    const user = req.user;

    // Vérifier droits
    const requisition = await dbUtils.get('SELECT * FROM requisitions WHERE id = ?', [id]);
    if (!requisition) return res.status(404).json({ error: 'Réquisition non trouvée' });
    
    if (requisition.emetteur_id !== user.id && user.role !== 'admin') {
      return res.status(403).json({ error: 'Non autorisé' });
    }

    if (requisition.statut !== 'brouillon' && requisition.statut !== 'a_corriger') {
      return res.status(400).json({ error: 'Modification impossible à ce stade' });
    }

    let updates = [];
    let params = [];

    if (objet) { updates.push('objet = ?'); params.push(objet); }
    if (montant_usd !== undefined) { updates.push('montant_usd = ?'); params.push(montant_usd || null); }
    if (montant_cdf !== undefined) { updates.push('montant_cdf = ?'); params.push(montant_cdf || null); }
    if (commentaire_initial) { updates.push('commentaire_initial = ?'); params.push(commentaire_initial); }
    if (service_id) { updates.push('service_id = ?'); params.push(service_id); }
    
    // Si resoumission
    if (resubmit === 'true' || resubmit === true) {
        updates.push('statut = ?'); params.push('en_cours');
        updates.push('niveau = ?'); params.push('emetteur');
    }

    if (updates.length === 0 && (!req.files || req.files.length === 0)) return res.json({ message: 'Aucune modification' });

    if (updates.length > 0) {
        params.push(id);
        await dbUtils.run(`UPDATE requisitions SET ${updates.join(', ')}, updated_at = CURRENT_TIMESTAMP WHERE id = ?`, params);
    }
    
    // Ajouter les nouvelles pièces jointes si présentes
    if (req.files && req.files.length > 0) {
      for (const file of req.files) {
        await dbUtils.run(
          'INSERT INTO pieces_jointes (requisition_id, nom_fichier, chemin_fichier, taille_fichier, type_fichier, uploaded_by) VALUES (?, ?, ?, ?, ?, ?)',
          [id, file.originalname, file.path, file.size, file.mimetype, user.id]
        );
      }
    }

    if (resubmit === 'true' || resubmit === true) {
         await dbUtils.run(
          'INSERT INTO requisition_actions (requisition_id, utilisateur_id, action, commentaire, niveau_avant, niveau_apres) VALUES (?, ?, ?, ?, ?, ?)',
          [id, user.id, 'modifier', 'Correction et resoumission', 'emetteur', 'emetteur']
        );
    }

    res.json({ message: 'Réquisition mise à jour' });

  } catch (error) {
    console.error('Erreur lors de la mise à jour:', error);
    res.status(500).json({ error: 'Erreur serveur', details: error.message });
  }
});

// Ajouter un message à une réquisition
router.post('/:id/messages', authenticateToken, checkRequisitionAccess, async (req, res) => {
  try {
    const { id } = req.params;
    const { message } = req.body;
    const user = req.user;
    const requisition = req.requisition;

    if (['valide', 'validee', 'refuse', 'refusee', 'termine', 'payee'].includes(requisition.statut)) {
      return res.status(400).json({ error: 'Impossible d\'ajouter un message sur une réquisition terminée' });
    }

    if (!message) {
      return res.status(400).json({ error: 'Message est obligatoire' });
    }

    // Insérer le message
    await dbUtils.run(
      'INSERT INTO messages (requisition_id, utilisateur_id, message) VALUES (?, ?, ?)',
      [id, user.id, message]
    );

    res.json({ message: 'Message ajouté avec succès' });
  } catch (error) {
    console.error('Erreur lors de l\'ajout du message:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// Ajouter des pièces jointes à une réquisition
router.post('/:id/pieces', authenticateToken, checkRequisitionAccess, upload.array('pieces', 5), async (req, res) => {
  try {
    const { id } = req.params;
    const user = req.user;
    const requisition = req.requisition;

    if (['valide', 'validee', 'refuse', 'refusee', 'termine', 'payee'].includes(requisition.statut)) {
      return res.status(400).json({ error: 'Impossible d\'ajouter des pièces sur une réquisition terminée' });
    }

    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ error: 'Aucun fichier fourni' });
    }

    // Ajouter les pièces jointes
    for (const file of req.files) {
      await dbUtils.run(
        'INSERT INTO pieces_jointes (requisition_id, nom_fichier, chemin_fichier, taille_fichier, type_fichier, uploaded_by) VALUES (?, ?, ?, ?, ?, ?)',
        [id, file.originalname, file.path, file.size, file.mimetype, user.id]
      );
    }

    res.json({ message: 'Pièces jointes ajoutées avec succès' });
  } catch (error) {
    console.error('Erreur lors de l\'ajout des pièces jointes:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// Paiement groupé de réquisitions
router.post('/batch-pay', authenticateToken, requireRole(['comptable']), async (req, res) => {
  const { requisitionIds } = req.body;
  
  if (!requisitionIds || !Array.isArray(requisitionIds) || requisitionIds.length === 0) {
    return res.status(400).json({ error: 'Liste de réquisitions invalide' });
  }

  try {
    let successCount = 0;
    let errors = [];

    for (const id of requisitionIds) {
      try {
        const requisition = await dbUtils.get('SELECT * FROM requisitions WHERE id = ?', [id]);
        
        if (!requisition) {
          errors.push(`Réquisition ${id} introuvable`);
          continue;
        }

        if (requisition.statut !== 'validee' && requisition.niveau !== 'paiement') {
          errors.push(`Réquisition ${requisition.numero} n'est pas prête pour paiement`);
          continue;
        }

        const isUSD = requisition.montant_usd > 0;
        const amount = isUSD ? requisition.montant_usd : requisition.montant_cdf;
        const currency = isUSD ? 'USD' : 'CDF';

        // Check funds
        const fund = await dbUtils.get('SELECT * FROM fonds WHERE devise = ?', [currency]);
        if (!fund || fund.montant_disponible < amount) {
          errors.push(`Fonds insuffisants pour ${requisition.numero} (${currency})`);
          continue;
        }

        // Deduct funds
        await dbUtils.run(
          'UPDATE fonds SET montant_disponible = montant_disponible - ?, updated_at = CURRENT_TIMESTAMP WHERE devise = ?',
          [amount, currency]
        );

        // Record movement
        await dbUtils.run(
          'INSERT INTO mouvements_fonds (type_mouvement, montant, devise, description) VALUES (?, ?, ?, ?)',
          ['sortie', amount, currency, `Paiement Réquisition ${requisition.numero}`]
        );

        // Record payment
        await dbUtils.run(
          'INSERT INTO paiements (requisition_id, montant_usd, montant_cdf, comptable_id, statut) VALUES (?, ?, ?, ?, ?)',
          [id, isUSD ? amount : 0, isUSD ? 0 : amount, req.user.id, 'effectue']
        );

        // Update requisition
        await dbUtils.run(
          'UPDATE requisitions SET statut = ?, niveau = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
          ['payee', 'termine', id]
        );

        // Log action
        await dbUtils.run(
          'INSERT INTO requisition_actions (requisition_id, utilisateur_id, action, commentaire, niveau_avant, niveau_apres) VALUES (?, ?, ?, ?, ?, ?)',
          [id, req.user.id, 'payer', 'Paiement groupé', requisition.niveau, 'termine']
        );

        successCount++;
      } catch (err) {
        console.error(`Error paying requisition ${id}:`, err);
        errors.push(`Erreur technique pour ${id}`);
      }
    }

    if (successCount === 0 && errors.length > 0) {
      return res.status(400).json({ error: 'Aucun paiement effectué', details: errors });
    }

    res.json({ 
      message: `${successCount} réquisitions payées avec succès`, 
      errors: errors.length > 0 ? errors : undefined 
    });

  } catch (error) {
    console.error('Batch payment error:', error);
    res.status(500).json({ error: 'Erreur serveur lors du paiement groupé' });
  }
});

module.exports = router;
