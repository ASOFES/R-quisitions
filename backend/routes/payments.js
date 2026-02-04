const express = require('express');
const { dbUtils } = require('../database/database');
const { authenticateToken, requireRole } = require('../middleware/auth');

const router = express.Router();

// Utility for robust number parsing
const parseAmount = (val) => {
  if (!val) return 0;
  // Clean string: remove spaces, currency symbols, and ensure dot for decimal
  const str = String(val).replace(/[^0-9.,-]/g, '').replace(/,/g, '.');
  const num = parseFloat(str);
  return isNaN(num) ? 0 : num;
};

// Obtenir les fonds disponibles
router.get('/fonds', authenticateToken, requireRole(['comptable', 'admin', 'gm']), async (req, res) => {
  try {
    const fonds = await dbUtils.all('SELECT * FROM fonds ORDER BY devise');
    res.json(fonds);
  } catch (error) {
    console.error('Erreur lors de la récupération des fonds:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// Obtenir les mouvements de fonds
router.get('/mouvements', authenticateToken, requireRole(['comptable', 'admin', 'gm']), async (req, res) => {
  try {
    const mouvements = await dbUtils.all(`
      SELECT * FROM mouvements_fonds 
      ORDER BY created_at DESC 
      LIMIT 100
    `);
    res.json(mouvements);
  } catch (error) {
    console.error('Erreur lors de la récupération des mouvements:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// Ravitailler la caisse
router.post('/ravitaillement', authenticateToken, requireRole(['comptable', 'admin']), async (req, res) => {
  try {
    const { devise, montant, description } = req.body;

    if (!devise || !montant) {
      return res.status(400).json({ error: 'Devise et montant sont obligatoires' });
    }

    if (!['USD', 'CDF'].includes(devise)) {
      return res.status(400).json({ error: 'Devise non valide (USD ou CDF requis)' });
    }

    const cleanMontant = parseAmount(montant);
    if (cleanMontant <= 0) {
       return res.status(400).json({ error: 'Montant invalide' });
    }

    // Ajouter le mouvement d'entrée
    await dbUtils.run(
      'INSERT INTO mouvements_fonds (type_mouvement, montant, devise, description) VALUES (?, ?, ?, ?)',
      ['entree', cleanMontant, devise, description || 'Ravitaillement de caisse']
    );

    // Mettre à jour les fonds disponibles
    await dbUtils.run(
      'UPDATE fonds SET montant_disponible = montant_disponible + ?, updated_at = CURRENT_TIMESTAMP WHERE devise = ?',
      [cleanMontant, devise]
    );

    res.json({ message: 'Ravitaillement effectué avec succès' });
  } catch (error) {
    console.error('Erreur lors du ravitaillement:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// Obtenir les réquisitions à payer
router.get('/a-payer', authenticateToken, requireRole(['comptable', 'admin', 'gm']), async (req, res) => {
  try {
    const requisitions = await dbUtils.all(`
      SELECT r.*, u.nom_complet as emetteur_nom, s.code as service_code, s.nom as service_nom,
             (SELECT COUNT(*) FROM pieces_jointes pj WHERE pj.requisition_id = r.id) as nb_pieces
      FROM requisitions r
      JOIN users u ON r.emetteur_id = u.id
      JOIN services s ON r.service_id = s.id
      WHERE r.niveau = 'paiement' AND (r.statut = 'en_cours' OR r.statut = 'valide' OR r.statut = 'validee')
      ORDER BY r.created_at ASC
    `);
    res.json(requisitions);
  } catch (error) {
    console.error('Erreur lors de la récupération des réquisitions à payer:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// Effectuer un paiement
router.post('/effectuer', authenticateToken, requireRole(['comptable', 'admin']), async (req, res) => {
  try {
    const { requisition_ids, commentaire, mode_paiement } = req.body;
    const user = req.user;

    if (!requisition_ids || !Array.isArray(requisition_ids) || requisition_ids.length === 0) {
      return res.status(400).json({ error: 'Réquisitions à payer sont obligatoires' });
    }

    // Validation du mode de paiement (optionnel mais recommandé)
    let validMode = null;
    if (mode_paiement) {
        if (['Cash', 'Banque'].includes(mode_paiement)) {
            validMode = mode_paiement;
        } else {
            // Si le mode est envoyé mais invalide, on peut rejeter ou ignorer. 
            // Pour l'instant on rejette pour être strict.
            return res.status(400).json({ error: 'Mode de paiement invalide (Cash ou Banque)' });
        }
    }

    const results = [];
    let totalUSD = 0;
    let totalCDF = 0;

    // Calculer les totaux et vérifier les fonds
    for (const reqId of requisition_ids) {
      const requisition = await dbUtils.get(
        'SELECT * FROM requisitions WHERE id = ? AND niveau = ? AND (statut = ? OR statut = ? OR statut = ?)',
        [reqId, 'paiement', 'en_cours', 'valide', 'validee']
      );

      if (!requisition) {
        return res.status(400).json({ error: `Réquisition ${reqId} non trouvée ou non payable` });
      }

      if (requisition.montant_usd) {
        totalUSD += parseFloat(requisition.montant_usd);
      }
      if (requisition.montant_cdf) {
        totalCDF += parseFloat(requisition.montant_cdf);
      }
    }

    // Vérifier les fonds disponibles
    if (totalUSD > 0) {
      const fondsUSD = await dbUtils.get('SELECT montant_disponible FROM fonds WHERE devise = ?', ['USD']);
      if (!fondsUSD || fondsUSD.montant_disponible < totalUSD) {
        return res.status(400).json({ error: 'Fonds USD insuffisants' });
      }
    }

    if (totalCDF > 0) {
      const fondsCDF = await dbUtils.get('SELECT montant_disponible FROM fonds WHERE devise = ?', ['CDF']);
      if (!fondsCDF || fondsCDF.montant_disponible < totalCDF) {
        return res.status(400).json({ error: 'Fonds CDF insuffisants' });
      }
    }

    // Effectuer les paiements
    for (const reqId of requisition_ids) {
      const requisition = await dbUtils.get('SELECT * FROM requisitions WHERE id = ?', [reqId]);

      // Enregistrer le paiement
      await dbUtils.run(
        'INSERT INTO paiements (requisition_id, montant_usd, montant_cdf, commentaire, comptable_id) VALUES (?, ?, ?, ?, ?)',
        [reqId, requisition.montant_usd, requisition.montant_cdf, commentaire, user.id]
      );

      // Mettre à jour la réquisition
      let updateQuery = 'UPDATE requisitions SET niveau = ?, updated_at = CURRENT_TIMESTAMP';
      let updateParams = ['justificatif'];

      if (validMode) {
          updateQuery += ', mode_paiement = ?';
          updateParams.push(validMode);
      }
      
      updateQuery += ' WHERE id = ?';
      updateParams.push(reqId);

      await dbUtils.run(updateQuery, updateParams);

      // Enregistrer l'action
      await dbUtils.run(
        'INSERT INTO requisition_actions (requisition_id, utilisateur_id, action, commentaire, niveau_avant, niveau_apres) VALUES (?, ?, ?, ?, ?, ?)',
        [reqId, user.id, 'payer', commentaire, 'paiement', 'justificatif']
      );

      // Déduire des fonds
      if (requisition.montant_usd) {
        await dbUtils.run(
          'UPDATE fonds SET montant_disponible = montant_disponible - ?, updated_at = CURRENT_TIMESTAMP WHERE devise = ?',
          [requisition.montant_usd, 'USD']
        );

        await dbUtils.run(
          'INSERT INTO mouvements_fonds (type_mouvement, montant, devise, description) VALUES (?, ?, ?, ?)',
          ['sortie', requisition.montant_usd, 'USD', `Paiement réquisition ${requisition.numero}`]
        );
      }

      if (requisition.montant_cdf) {
        await dbUtils.run(
          'UPDATE fonds SET montant_disponible = montant_disponible - ?, updated_at = CURRENT_TIMESTAMP WHERE devise = ?',
          [requisition.montant_cdf, 'CDF']
        );

        await dbUtils.run(
          'INSERT INTO mouvements_fonds (type_mouvement, montant, devise, description) VALUES (?, ?, ?, ?)',
          ['sortie', requisition.montant_cdf, 'CDF', `Paiement réquisition ${requisition.numero}`]
        );
      }

      results.push({
        requisitionId: reqId,
        numero: requisition.numero,
        montant_usd: requisition.montant_usd,
        montant_cdf: requisition.montant_cdf
      });
    }

    res.json({
      message: 'Paiements effectués avec succès',
      paiements: results,
      totalUSD,
      totalCDF
    });
  } catch (error) {
    console.error('Erreur lors des paiements:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// Obtenir l'historique des paiements
router.get('/historique', authenticateToken, requireRole(['comptable', 'admin', 'gm']), async (req, res) => {
  try {
    const paiements = await dbUtils.all(`
      SELECT p.*, r.numero as req_numero, r.objet as req_objet, r.created_at as date_demande,
             u_em.nom_complet as emetteur_nom, u_compta.nom_complet as comptable_nom
      FROM paiements p
      JOIN requisitions r ON p.requisition_id = r.id
      JOIN users u_em ON r.emetteur_id = u_em.id
      JOIN users u_compta ON p.comptable_id = u_compta.id
      ORDER BY p.date_paiement DESC
      LIMIT 100
    `);
    res.json(paiements);
  } catch (error) {
    console.error('Erreur lors de la récupération de l\'historique:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// Valider un paiement (analyste et admin)
router.post('/:id/valider-paiement', authenticateToken, requireRole(['analyste', 'admin']), async (req, res) => {
  try {
    const { id } = req.params;
    const { commentaire } = req.body;
    const user = req.user;

    if (!commentaire) {
      return res.status(400).json({ error: 'Commentaire est obligatoire' });
    }

    // Vérifier si la réquisition est au niveau justificatif
    const requisition = await dbUtils.get(
      'SELECT * FROM requisitions WHERE id = ? AND niveau = ?',
      [id, 'justificatif']
    );

    if (!requisition) {
      return res.status(404).json({ error: 'Réquisition non trouvée ou non au niveau justificatif' });
    }

    // Mettre à jour la réquisition
    await dbUtils.run(
      'UPDATE requisitions SET niveau = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      ['termine', id]
    );

    // Enregistrer l'action
    await dbUtils.run(
      'INSERT INTO requisition_actions (requisition_id, utilisateur_id, action, commentaire, niveau_avant, niveau_apres) VALUES (?, ?, ?, ?, ?, ?)',
      [id, user.id, 'valider_paiement', commentaire, 'justificatif', 'termine']
    );

    res.json({ message: 'Paiement validé avec succès' });
  } catch (error) {
    console.error('Erreur lors de la validation du paiement:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// Terminer une réquisition (analyste et admin)
router.post('/:id/terminer', authenticateToken, requireRole(['analyste', 'admin']), async (req, res) => {
  try {
    const { id } = req.params;
    const { commentaire } = req.body;
    const user = req.user;

    if (!commentaire) {
      return res.status(400).json({ error: 'Commentaire est obligatoire' });
    }

    // Vérifier si la réquisition est au niveau justificatif
    const requisition = await dbUtils.get(
      'SELECT * FROM requisitions WHERE id = ? AND niveau = ?',
      [id, 'justificatif']
    );

    if (!requisition) {
      return res.status(404).json({ error: 'Réquisition non trouvée ou non au niveau justificatif' });
    }

    // Mettre à jour la réquisition
    await dbUtils.run(
      'UPDATE requisitions SET statut = ?, niveau = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      ['termine', 'termine', id]
    );

    // Enregistrer l'action
    await dbUtils.run(
      'INSERT INTO requisition_actions (requisition_id, utilisateur_id, action, commentaire, niveau_avant, niveau_apres) VALUES (?, ?, ?, ?, ?, ?)',
      [id, user.id, 'terminer', commentaire, 'justificatif', 'termine']
    );

    res.json({ message: 'Réquisition terminée avec succès' });
  } catch (error) {
    console.error('Erreur lors de la terminaison de la réquisition:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// Obtenir les réquisitions à classer (pour analyste)
router.get('/a-classer', authenticateToken, requireRole(['analyste', 'admin']), async (req, res) => {
  try {
    const requisitions = await dbUtils.all(`
      SELECT r.*, u.nom_complet as emetteur_nom, s.code as service_code, s.nom as service_nom
      FROM requisitions r
      JOIN users u ON r.emetteur_id = u.id
      JOIN services s ON r.service_id = s.id
      WHERE r.niveau = 'paiement' AND r.statut = 'validee'
      ORDER BY r.created_at ASC
    `);
    res.json(requisitions);
  } catch (error) {
    console.error('Erreur lors de la récupération des réquisitions à classer:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// Définir le mode de paiement (Cash/Banque)
router.put('/:id/mode', authenticateToken, requireRole(['analyste', 'admin']), async (req, res) => {
  try {
    const { id } = req.params;
    const { mode_paiement } = req.body;

    if (!['Cash', 'Banque'].includes(mode_paiement)) {
      return res.status(400).json({ error: 'Mode de paiement invalide (Cash ou Banque)' });
    }

    const requisition = await dbUtils.get('SELECT * FROM requisitions WHERE id = ?', [id]);
    if (!requisition) {
        return res.status(404).json({ error: 'Réquisition non trouvée' });
    }
    
    // On permet la modification si on est au niveau paiement
    if (requisition.niveau !== 'paiement') {
        return res.status(400).json({ error: 'La réquisition n\'est pas au niveau paiement' });
    }

    await dbUtils.run(
      'UPDATE requisitions SET mode_paiement = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [mode_paiement, id]
    );

    res.json({ message: 'Mode de paiement mis à jour', mode_paiement });
  } catch (error) {
    console.error('Erreur lors de la mise à jour du mode de paiement:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

module.exports = router;
