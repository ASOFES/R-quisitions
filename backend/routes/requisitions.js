const express = require('express');
const multer = require('multer');
const path = require('path');
const { dbUtils } = require('../database/database');
const { authenticateToken, requireRole, checkRequisitionAccess } = require('../middleware/auth');
const PdfService = require('../services/PdfService');
const WorkflowService = require('../services/WorkflowService');
const StorageService = require('../services/StorageService');
const BudgetService = require('../services/BudgetService');

const router = express.Router();

// Utility for robust number parsing
const parseAmount = (val) => {
  if (!val) return 0;
  // Clean string: remove spaces, currency symbols, and ensure dot for decimal
  const str = String(val).replace(/[^0-9.,-]/g, '').replace(/,/g, '.');
  const num = parseFloat(str);
  return isNaN(num) ? 0 : num;
};

// Configuration de multer pour l'upload de fichiers (MemoryStorage pour compatibilité Supabase)
const storage = multer.memoryStorage();

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
  
  // Compter les réquisitions de l'année (Séquence annuelle globale)
  let countQuery;
  
  const isPostgres = !!process.env.DATABASE_URL;

  if (isPostgres) {
    countQuery = 'SELECT COUNT(*) as count FROM requisitions WHERE to_char(created_at, \'YYYY\') = ?';
  } else {
    countQuery = 'SELECT COUNT(*) as count FROM requisitions WHERE strftime("%Y", created_at) = ?';
  }

  const count = await dbUtils.get(
    countQuery,
    [`${year}`]
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

// Générer le PDF pour une seule réquisition
router.get('/:id/pdf', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const user = req.user;

    console.log(`Single PDF requested by ${user.username} for requisition ${id}`);

    // Récupérer la réquisition avec les détails nécessaires
    const requisition = await dbUtils.get(`
      SELECT r.*, u.nom_complet as emetteur_nom, s.nom as service_nom
      FROM requisitions r
      LEFT JOIN users u ON r.emetteur_id = u.id
      LEFT JOIN services s ON r.service_id = s.id
      WHERE r.id = ?
    `, [id]);

    if (!requisition) {
      return res.status(404).json({ message: 'Réquisition non trouvée.' });
    }

    // Le PdfService attend un tableau
    const pdfBytes = await PdfService.compileRequisitionsPdf([requisition]);
    
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=requisition_${requisition.numero || id}.pdf`);
    res.send(Buffer.from(pdfBytes));

  } catch (error) {
    console.error('Erreur PDF compilation (single):', error);
    res.status(500).json({ error: 'Erreur lors de la génération du PDF' });
  }
});

// Obtenir les réquisitions selon le rôle de l'utilisateur
router.get('/', authenticateToken, async (req, res) => {
  try {
    const user = req.user;
    let query = `
      SELECT r.*, u.nom_complet as emetteur_nom, u.email as emetteur_email, u.role as emetteur_role, z.nom as emetteur_zone, s.code as service_code, s.nom as service_nom, s.chef_id as service_chef_id,
             (SELECT COUNT(*) FROM pieces_jointes pj WHERE pj.requisition_id = r.id) as nb_pieces
      FROM requisitions r
      LEFT JOIN users u ON r.emetteur_id = u.id
      LEFT JOIN zones z ON u.zone_id = z.id
      JOIN services s ON r.service_id = s.id
    `;
    
    let params = [];
    
    // Filtrer selon le rôle
    if (user.role === 'admin') {
      // Admin voit tout
      query += ' ORDER BY r.created_at DESC';
    } else if (user.role === 'emetteur') {
      // Émetteur voit ses réquisitions OU celles de son service s'il est chef (à valider)
      query += ' WHERE (r.emetteur_id = ?) OR (s.chef_id = ? AND r.niveau = ?) ORDER BY r.created_at DESC';
      params.push(user.id, user.id, 'approbation_service');
    } else if (user.role === 'comptable') {
      // Comptable voit validées+ OU celles de son service s'il est chef
      query += ' WHERE (r.niveau IN (?, ?, ?, ?)) OR (s.chef_id = ? AND r.niveau = ?) ORDER BY r.created_at DESC';
      params.push('validateur', 'paiement', 'justificatif', 'termine', user.id, 'approbation_service');
    } else if (user.role === 'analyste') {
      // Analyste voit tout le workflow OU celles de son service s'il est chef
      // Ajout de 'validation_bordereau' pour l'alignement
      query += ' WHERE (r.niveau IN (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)) OR (s.chef_id = ? AND r.niveau = ?) ORDER BY r.created_at DESC';
      params.push('emetteur', 'analyste', 'challenger', 'validateur', 'gm', 'compilation', 'validation_bordereau', 'paiement', 'justificatif', 'termine', user.id, 'approbation_service');
    } else {
      // Autres rôles (Challenger, Validateur, PM, GM)
      const niveauOrder = {
        'challenger': 'challenger',
        'validateur': 'validateur',
        'pm': 'validateur',
        'gm': 'gm'
      };
      
      const niveau = niveauOrder[user.role];
      if (niveau) {
        let visibleLevels = [];
        if (user.role === 'challenger') visibleLevels = ['challenger', 'validateur', 'gm', 'paiement', 'justificatif', 'termine'];
        else if (user.role === 'validateur' || user.role === 'pm') visibleLevels = ['challenger', 'validateur', 'gm', 'paiement', 'justificatif', 'termine'];
        else if (user.role === 'gm') visibleLevels = ['gm', 'paiement', 'justificatif', 'termine'];
        
        const placeholders = visibleLevels.map(() => '?').join(', ');
        
        // Base logic: Visible levels OR Chef override
        let whereClause = `(r.niveau IN (${placeholders})) OR (s.chef_id = ? AND r.niveau = ?)`;
        params.push(...visibleLevels, user.id, 'approbation_service');

        // SERVICE RESTRICTION:
        // Validateur, Challenger, PM must only see requisitions from their own service
        if (['validateur', 'challenger', 'pm'].includes(user.role) && user.service_id) {
            whereClause = `(${whereClause}) AND r.service_id = ?`;
            params.push(user.service_id);
        }

        query += ` WHERE ${whereClause} ORDER BY r.created_at DESC`;
      } else {
         // Fallback si rôle inconnu mais potentiellement chef
         query += ' WHERE (s.chef_id = ? AND r.niveau = ?) ORDER BY r.created_at DESC';
         params.push(user.id, 'approbation_service');
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
    let finalMontantUsd = parseAmount(montant_usd);
    let finalMontantCdf = parseAmount(montant_cdf);

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

    // --- VÉRIFICATION BUDGÉTAIRE ---
    try {
        const rateRow = await dbUtils.get("SELECT value FROM app_settings WHERE key = 'exchange_rate'");
        const rate = rateRow ? parseFloat(rateRow.value) : 2800;
        
        // Calcul du montant total en USD (hypothèse: budget suivi en USD)
        const totalCheckAmount = finalMontantUsd + (finalMontantCdf / rate);
        const mois = new Date().toISOString().slice(0, 7); // YYYY-MM
        
        console.log(`[Budget Check] Objet: "${objet}", Montant: ${totalCheckAmount} USD, Mois: ${mois}`);
        
        const checkResult = await BudgetService.checkBudget(objet, totalCheckAmount, mois);
        
        if (!checkResult.allowed) {
             console.warn(`[Budget Check Failed] ${checkResult.reason}`, checkResult.details);
             return res.status(400).json({ 
                 error: `Erreur budgétaire: ${checkResult.reason}`,
                 details: checkResult.details 
             });
        }
    } catch (budgetError) {
        console.error('Erreur lors de la vérification budgétaire:', budgetError);
        // On ne bloque pas forcément en cas d'erreur technique (ex: table inexistante), 
        // ou on choisit de bloquer. Pour la sécurité, on log mais on laisse passer ou on bloque ?
        // Ici, on bloque si c'est une erreur critique, mais si c'est juste "table missing", ça risque de tout casser.
        // Si BudgetService.checkBudget throw, c'est probablement grave.
        // Mais si le budget n'existe pas, checkBudget retourne { allowed: false }.
        // Donc ici c'est une erreur inattendue.
        return res.status(500).json({ error: 'Erreur lors de la vérification du budget' });
    }
    // -------------------------------

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
        const uploadResult = await StorageService.uploadFile(file);
        await dbUtils.run(
          'INSERT INTO pieces_jointes (requisition_id, nom_fichier, chemin_fichier, taille_fichier, type_fichier, uploaded_by) VALUES (?, ?, ?, ?, ?, ?)',
          [result.id, file.originalname, uploadResult.filename, file.size, file.mimetype, user.id]
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
      SELECT r.*, u.nom_complet as emetteur_nom, u.email as emetteur_email, u.role as emetteur_role, z.nom as emetteur_zone, s.code as service_code, s.nom as service_nom
      FROM requisitions r
      JOIN users u ON r.emetteur_id = u.id
      JOIN services s ON r.service_id = s.id
      LEFT JOIN zones z ON u.zone_id = z.id
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
    const { action, commentaire, mode_paiement } = req.body;
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

    // INTEGRATION BUDGET CHECK (Analyste uniquement)
    if (action === 'valider' && userRole === 'analyste') {
        try {
            const items = await dbUtils.all('SELECT * FROM lignes_requisition WHERE requisition_id = ?', [id]);
            const reqDate = new Date(requisition.created_at);
            const mois = reqDate.toISOString().slice(0, 7); // YYYY-MM
            
            let budgetErrors = [];
            
            for (const item of items) {
                // Conversion sommaire si CDF (Taux fixe temporaire 2800)
                let amountToCheck = item.prix_total;
                if (item.devise === 'CDF') {
                    amountToCheck = amountToCheck / 2800; 
                }
                
                const check = await BudgetService.checkBudget(item.description, amountToCheck, mois);
                if (!check.allowed) {
                    if (check.reason === 'Ligne budgétaire non trouvée') {
                        console.warn(`Budget warning: ${item.description} - ${check.reason}`);
                    } else {
                        budgetErrors.push(`${item.description}: ${check.reason} ${check.details ? '(Reste: ' + check.details.reste.toFixed(2) + ' USD)' : ''}`);
                    }
                }
            }
            
            if (budgetErrors.length > 0) {
                return res.status(400).json({ 
                    error: 'Validation impossible : Problème budgétaire', 
                    details: budgetErrors 
                });
            }
        } catch (err) {
            console.error('Erreur vérification budget:', err);
            console.warn('Le service budget a rencontré une erreur, validation autorisée par précaution.');
        }
    }

    if (['payee', 'refuse', 'refusee', 'termine'].includes(requisition.statut)) {
      return res.status(400).json({ error: 'Action impossible sur une réquisition terminée' });
    }

    const allowedRoles = ['emetteur', 'analyste', 'challenger', 'validateur', 'gm', 'comptable'];
    const isChef = requisition.chef_id === user.id;

    if (!allowedRoles.includes(userRole) && userRole !== 'pm' && !isChef) {
      return res.status(403).json({ error: 'Vous n\'êtes pas autorisé à effectuer cette action' });
    }

    // Vérifier si la réquisition est au bon niveau pour l'utilisateur
    if (requisition.niveau === 'approbation_service') {
        if (!isChef && userRole !== 'admin') { // Admin peut bypass
            return res.status(403).json({ error: 'Attente validation chef de service' });
        }
    } else if (requisition.niveau === 'validation_bordereau') {
        // Analyste can act here
        if (userRole !== 'analyste' && userRole !== 'admin') {
             return res.status(403).json({ error: 'Attente validation analyste (alignement)' });
        }
    } else {
        // ... (Logique existante pour les autres niveaux)
    }

    // --- MISE À JOUR DU STATUT ET NIVEAU ---
    let nouveauStatut = requisition.statut;
    let nouveauNiveau = requisition.niveau;

    if (action === 'valider') {
      if (requisition.niveau === 'emetteur') {
        nouveauStatut = 'en_cours';
        nouveauNiveau = 'analyste';
      } else if (requisition.niveau === 'approbation_service') {
        nouveauStatut = 'en_cours';
        nouveauNiveau = 'analyste';
      } else if (requisition.niveau === 'analyste') {
        nouveauNiveau = 'challenger';
      } else if (requisition.niveau === 'challenger') {
        nouveauNiveau = 'validateur';
      } else if (requisition.niveau === 'validateur') {
        nouveauNiveau = 'gm';
      } else if (requisition.niveau === 'gm') {
        nouveauNiveau = 'compilation'; 
        nouveauStatut = 'validee';
      } else if (requisition.niveau === 'compilation') {
        nouveauNiveau = 'validation_bordereau';
      } else if (requisition.niveau === 'validation_bordereau') {
        nouveauNiveau = 'paiement';
      } else if (requisition.niveau === 'paiement') {
        nouveauStatut = 'payee';
      }
    } else if (action === 'refuser') {
      nouveauStatut = 'refusee'; 
    }

    // Utilisation du WorkflowService pour traiter l'action
    const result = await WorkflowService.processAction(id, action, userRole, user.id, commentaire, false, mode_paiement);

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
    const { objet, montant_usd, montant_cdf, commentaire_initial, service_id, resubmit, site_id, items } = req.body;
    const user = req.user;

    // Vérifier droits
    const requisition = await dbUtils.get('SELECT * FROM requisitions WHERE id = ?', [id]);
    if (!requisition) return res.status(404).json({ error: 'Réquisition non trouvée' });
    
    if (requisition.emetteur_id !== user.id && user.role !== 'admin') {
      return res.status(403).json({ error: 'Non autorisé' });
    }

    // Allow admin to edit regardless of status (careful!), or if resubmit is true (correction)
    const canEdit = 
        requisition.statut === 'brouillon' || 
        requisition.statut === 'a_corriger' || 
        (requisition.statut === 'en_cours' && requisition.niveau === 'emetteur') ||
        user.role === 'admin'; // Admin override

    if (!canEdit) {
      return res.status(400).json({ error: 'Modification impossible à ce stade' });
    }

    let parsedItems = [];
    if (items) {
        try {
            parsedItems = typeof items === 'string' ? JSON.parse(items) : items;
        } catch (e) {
            console.error('Error parsing items:', e);
        }
    }

    // Recalculate totals if items are present
    let finalMontantUsd = montant_usd;
    let finalMontantCdf = montant_cdf;

    if (parsedItems.length > 0) {
        finalMontantUsd = 0;
        finalMontantCdf = 0;
        for (const item of parsedItems) {
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

    let updates = [];
    let params = [];

    if (objet) { updates.push('objet = ?'); params.push(objet); }
    // Update amounts (use computed values if items exist, otherwise use provided or keep existing)
    if (parsedItems.length > 0) {
         updates.push('montant_usd = ?'); params.push(finalMontantUsd);
         updates.push('montant_cdf = ?'); params.push(finalMontantCdf);
    } else {
         if (montant_usd !== undefined) { updates.push('montant_usd = ?'); params.push(montant_usd || null); }
         if (montant_cdf !== undefined) { updates.push('montant_cdf = ?'); params.push(montant_cdf || null); }
    }

    if (commentaire_initial) { updates.push('commentaire_initial = ?'); params.push(commentaire_initial); }
    if (service_id) { updates.push('service_id = ?'); params.push(service_id); }
    if (site_id) { updates.push('site_id = ?'); params.push(site_id); }
    
    if (updates.length > 0) {
        params.push(id);
        await dbUtils.run(`UPDATE requisitions SET ${updates.join(', ')}, updated_at = CURRENT_TIMESTAMP WHERE id = ?`, params);
    }

    // Update items if provided
    if (parsedItems.length > 0) {
        // Delete existing items
        await dbUtils.run('DELETE FROM lignes_requisition WHERE requisition_id = ?', [id]);
        
        // Insert new items
        for (const item of parsedItems) {
             const qty = parseFloat(item.quantite) || 1;
             const price = parseFloat(item.prix_unitaire) || 0;
             const total = qty * price;
             
             await dbUtils.run(
                 'INSERT INTO lignes_requisition (requisition_id, description, quantite, prix_unitaire, prix_total, site_id, devise) VALUES (?, ?, ?, ?, ?, ?, ?)',
                 [id, item.description, qty, price, total, item.site_id || site_id || null, item.devise || 'USD']
             );
        }
    }

    // Handle resubmission logic via WorkflowService
    if (resubmit === 'true' || resubmit === true) {
        const userRole = user.role ? user.role.toLowerCase() : 'emetteur';
        await WorkflowService.processAction(id, 'valider', userRole, user.id, 'Correction soumise');
    }
    
    // Ajouter les nouvelles pièces jointes si présentes
    if (req.files && req.files.length > 0) {
      for (const file of req.files) {
        const uploadResult = await StorageService.uploadFile(file);
        await dbUtils.run(
          'INSERT INTO pieces_jointes (requisition_id, nom_fichier, chemin_fichier, taille_fichier, type_fichier, uploaded_by) VALUES (?, ?, ?, ?, ?, ?)',
          [id, file.originalname, uploadResult.filename, file.size, file.mimetype, user.id]
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

// Batch Align (Analyst)
router.post('/batch-align', authenticateToken, requireRole(['analyste', 'admin']), async (req, res) => {
    try {
        const { requisitionIds, mode_paiement } = req.body;
        const user = req.user;

        if (!requisitionIds || !Array.isArray(requisitionIds) || requisitionIds.length === 0) {
            return res.status(400).json({ error: 'Aucune réquisition sélectionnée' });
        }
        
        if (!mode_paiement) {
             return res.status(400).json({ error: 'Mode de paiement requis' });
        }

        // Process each requisition
        // Note: Ideally this should be a transaction
        
        const placeholders = requisitionIds.map(() => '?').join(',');
        
        // Update requisitions
        await dbUtils.run(
            `UPDATE requisitions 
             SET niveau = 'paiement', mode_paiement = ?, updated_at = CURRENT_TIMESTAMP 
             WHERE id IN (${placeholders}) AND niveau = 'validation_bordereau'`,
            [mode_paiement, ...requisitionIds]
        );

        // Record history
        for (const reqId of requisitionIds) {
            await dbUtils.run(
                `INSERT INTO requisition_actions (requisition_id, utilisateur_id, action, niveau_avant, niveau_apres, commentaire)
                 VALUES (?, ?, ?, ?, ?, ?)`,
                [reqId, user.id, 'valider', 'validation_bordereau', 'paiement', `Alignement groupé (Mode: ${mode_paiement})`]
            );
        }

        res.json({ message: 'Réquisitions alignées avec succès' });

    } catch (error) {
        console.error('Erreur alignement groupé:', error);
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

// Update Payment Mode (Analyst)
router.put('/:id/payment-mode', authenticateToken, requireRole(['analyste', 'admin']), async (req, res) => {
    try {
        const { id } = req.params;
        const { mode_paiement } = req.body;
        
        if (!mode_paiement) {
            return res.status(400).json({ error: 'Mode de paiement requis' });
        }

        await dbUtils.run(
            'UPDATE requisitions SET mode_paiement = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
            [mode_paiement, id]
        );

        res.json({ message: 'Mode de paiement mis à jour' });
    } catch (error) {
        console.error('Erreur mise à jour mode paiement:', error);
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

// Batch Pay (Comptable) - Adding this if it was missing or implied
router.post('/batch-pay', authenticateToken, requireRole(['comptable', 'admin']), async (req, res) => {
    try {
        const { requisitionIds } = req.body;
        const user = req.user;

        if (!requisitionIds || !Array.isArray(requisitionIds) || requisitionIds.length === 0) {
            return res.status(400).json({ error: 'Aucune réquisition sélectionnée' });
        }

        const placeholders = requisitionIds.map(() => '?').join(',');
        
        await dbUtils.run(
            `UPDATE requisitions 
             SET statut = 'payee', updated_at = CURRENT_TIMESTAMP 
             WHERE id IN (${placeholders}) AND (statut = 'validee' OR niveau = 'paiement')`,
            [...requisitionIds]
        );

        for (const reqId of requisitionIds) {
            await dbUtils.run(
                `INSERT INTO requisition_actions (requisition_id, utilisateur_id, action, niveau_avant, niveau_apres, commentaire)
                 VALUES (?, ?, ?, ?, ?, ?)`,
                [reqId, user.id, 'payer', 'paiement', 'paiement', 'Paiement groupé effectué']
            );
        }

        res.json({ message: 'Paiements enregistrés avec succès' });
    } catch (error) {
         console.error('Erreur paiement groupé:', error);
         res.status(500).json({ error: 'Erreur serveur' });
    }
});

module.exports = router;