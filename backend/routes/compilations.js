const express = require('express');
const { dbUtils } = require('../database/database');
const { authenticateToken, requireRole } = require('../middleware/auth');
const router = express.Router();
const path = require('path');
const fs = require('fs');

// Obtenir les réquisitions en attente de compilation
router.get('/a-compiler', authenticateToken, requireRole(['compilateur', 'admin']), async (req, res) => {
    try {
        const requisitions = await dbUtils.all(`
            SELECT r.*, u.nom_complet as emetteur_nom, s.code as service_code, s.nom as service_nom
            FROM requisitions r
            JOIN users u ON r.emetteur_id = u.id
            JOIN services s ON r.service_id = s.id
            WHERE r.niveau = 'compilation' AND r.statut IN ('en_cours', 'valide', 'validee')
            ORDER BY r.created_at ASC
        `);
        res.json(requisitions);
    } catch (error) {
        console.error('Erreur récupération à compiler:', error);
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

// Créer un bordereau (compilation)
router.post('/', authenticateToken, requireRole(['compilateur', 'admin']), async (req, res) => {
    try {
        const { requisition_ids } = req.body;
        const user = req.user;

        if (!requisition_ids || !Array.isArray(requisition_ids) || requisition_ids.length === 0) {
            return res.status(400).json({ error: 'Aucune réquisition sélectionnée' });
        }

        // 1. Créer le bordereau
        const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
        const countResult = await dbUtils.get('SELECT COUNT(*) as count FROM bordereaux WHERE date_creation >= CURRENT_DATE');
        const sequence = String(countResult.count + 1).padStart(3, '0');
        const numero = `BORD-${dateStr}-${sequence}`;

        const bordereau = await dbUtils.run(
            'INSERT INTO bordereaux (numero, createur_id) VALUES (?, ?)',
            [numero, user.id]
        );

        // 2. Mettre à jour les réquisitions
        // On passe aussi le niveau à 'paiement' car elles sont maintenant compilées et prêtes pour le comptable
        const placeholders = requisition_ids.map(() => '?').join(',');
        
        await dbUtils.run(
            `UPDATE requisitions 
             SET bordereau_id = ?, niveau = 'paiement', updated_at = CURRENT_TIMESTAMP 
             WHERE id IN (${placeholders})`,
            [bordereau.id, ...requisition_ids]
        );

        // 3. Enregistrer l'action dans l'historique pour chaque réquisition
        for (const reqId of requisition_ids) {
            await dbUtils.run(
                `INSERT INTO requisition_actions (requisition_id, utilisateur_id, action, niveau_avant, niveau_apres, commentaire)
                 VALUES (?, ?, ?, ?, ?, ?)`,
                [reqId, user.id, 'valider', 'compilation', 'paiement', `Inclus dans le bordereau ${numero}`]
            );
        }

        res.json({ message: 'Bordereau créé avec succès', bordereau_id: bordereau.id, numero });

    } catch (error) {
        console.error('Erreur création bordereau:', error);
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

// Obtenir la liste des bordereaux
router.get('/', authenticateToken, requireRole(['compilateur', 'admin', 'comptable', 'gm']), async (req, res) => {
    try {
        const bordereaux = await dbUtils.all(`
            SELECT b.*, u.nom_complet as createur_nom, 
                   (SELECT COUNT(*) FROM requisitions r WHERE r.bordereau_id = b.id) as nb_requisitions,
                   (SELECT SUM(COALESCE(r.montant_usd, 0)) FROM requisitions r WHERE r.bordereau_id = b.id) as total_usd,
                   (SELECT SUM(COALESCE(r.montant_cdf, 0)) FROM requisitions r WHERE r.bordereau_id = b.id) as total_cdf
            FROM bordereaux b
            LEFT JOIN users u ON b.createur_id = u.id
            ORDER BY b.date_creation DESC
            LIMIT 50
        `);
        res.json(bordereaux);
    } catch (error) {
        console.error('Erreur liste bordereaux:', error);
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

// Générer PDF du bordereau (Simulation simple pour l'instant)
router.get('/:id/pdf', authenticateToken, async (req, res) => {
    // TODO: Implémenter une vraie génération PDF avec pdfmake ou puppeteer
    // Pour l'instant, on renvoie les données JSON structurées pour que le front puisse afficher "Aperçu"
    try {
        const bordereauId = req.params.id;
        const bordereau = await dbUtils.get('SELECT * FROM bordereaux WHERE id = ?', [bordereauId]);
        
        if (!bordereau) return res.status(404).json({ error: 'Bordereau non trouvé' });

        const requisitions = await dbUtils.all(`
            SELECT r.*, u.nom_complet as emetteur_nom, s.nom as service_nom
            FROM requisitions r
            JOIN users u ON r.emetteur_id = u.id
            JOIN services s ON r.service_id = s.id
            WHERE r.bordereau_id = ?
            ORDER BY r.numero
        `, [bordereauId]);

        res.json({ bordereau, requisitions });
    } catch (error) {
        console.error('Erreur données PDF bordereau:', error);
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

module.exports = router;
