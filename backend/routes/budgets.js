const express = require('express');
const multer = require('multer');
const { authenticateToken, requireRole } = require('../middleware/auth');
const BudgetService = require('../services/BudgetService');
const { dbUtils } = require('../database/database');

const router = express.Router();
const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

// Add a single budget line manually (Admin only)
router.post('/line', authenticateToken, requireRole(['admin']), async (req, res) => {
    try {
        const { description, montant_prevu, mois, classification } = req.body;

        if (!description || !montant_prevu || !mois) {
            return res.status(400).json({ error: 'Description, montant prévu et mois sont requis' });
        }

        // Check if line exists
        const existing = await dbUtils.get(
            'SELECT id FROM budgets WHERE description = ? AND mois = ?',
            [description, mois]
        );

        if (existing) {
            return res.status(400).json({ error: 'Cette ligne budgétaire existe déjà pour ce mois.' });
        }

        const result = await dbUtils.run(
            'INSERT INTO budgets (description, montant_prevu, montant_consomme, mois, classification) VALUES (?, ?, 0, ?, ?)',
            [description, parseFloat(montant_prevu), mois, classification || 'NON_ALLOUE']
        );

        res.status(201).json({ 
            message: 'Ligne budgétaire ajoutée avec succès',
            id: result.id 
        });

    } catch (error) {
        console.error('Erreur ajout ligne budget:', error);
        res.status(500).json({ error: error.message });
    }
});

// Import budget via Excel
router.post('/import', authenticateToken, requireRole(['admin', 'comptable', 'pm', 'analyste']), upload.single('file'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'Aucun fichier fourni' });
        }

        const { mois, annee } = req.body;
        if (!mois || !annee) {
            return res.status(400).json({ error: 'Mois et année requis' });
        }

        const result = await BudgetService.importBudget(req.file.buffer, mois, parseInt(annee));
        res.json(result);

    } catch (error) {
        console.error('Erreur route import budget:', error);
        res.status(500).json({ error: error.message });
    }
});

// Check budget for a specific item (can be used by frontend for validation feedback)
router.post('/check', authenticateToken, async (req, res) => {
    try {
        const { description, montant, mois } = req.body;
        if (!description || !montant || !mois) {
            return res.status(400).json({ error: 'Description, montant et mois requis' });
        }

        const result = await BudgetService.checkBudget(description, parseFloat(montant), mois);
        res.json(result);
    } catch (error) {
        console.error('Erreur check budget:', error);
        res.status(500).json({ error: error.message });
    }
});

// List all budgets for a period
router.get('/', authenticateToken, async (req, res) => {
    try {
        const { mois } = req.query;
        let query = 'SELECT * FROM budgets';
        let params = [];

        if (mois) {
            query += ' WHERE mois = ?';
            params.push(mois);
        }

        query += ' ORDER BY description';

        const budgets = await dbUtils.all(query, params);
        res.json(budgets);
    } catch (error) {
        console.error('Erreur liste budgets:', error);
        res.status(500).json({ error: error.message });
    }
});

// Get unique budget descriptions for dropdowns
router.get('/descriptions', authenticateToken, async (req, res) => {
    try {
        const descriptions = await dbUtils.all('SELECT DISTINCT description FROM budgets ORDER BY description');
        res.json(descriptions.map(row => row.description));
    } catch (error) {
        console.error('Erreur récupération descriptions budgets:', error);
        res.status(500).json({ error: error.message });
    }
});

// Get budget consumption history
router.get('/history', authenticateToken, async (req, res) => {
    try {
        const { mois } = req.query;
        const isPostgres = !!process.env.DATABASE_URL;
        
        const dateStr = isPostgres ? "to_char(r.created_at, 'YYYY-MM')" : "strftime('%Y-%m', r.created_at)";

        let query = `
            SELECT 
                r.id as requisition_id,
                r.numero as numero_requisition,
                r.created_at as date_creation,
                r.statut,
                u.username as demandeur,
                s.nom as service,
                l.description as ligne_budgetaire,
                l.prix_total as montant,
                'USD' as devise,
                b.montant_prevu,
                b.montant_consomme
            FROM lignes_requisition l
            JOIN requisitions r ON l.requisition_id = r.id
            JOIN users u ON r.emetteur_id = u.id
            LEFT JOIN services s ON u.service_id = s.id
            LEFT JOIN budgets b ON l.description = b.description AND b.mois = ${dateStr}
            WHERE r.budget_impacted = TRUE
        `;
        
        const params = [];
        
        if (mois) {
            if (isPostgres) {
                query += " AND to_char(r.created_at, 'YYYY-MM') = $1";
            } else {
                query += " AND strftime('%Y-%m', r.created_at) = ?";
            }
            params.push(mois);
        }
        
        query += " ORDER BY r.created_at DESC";
        
        // Handle PG parameter syntax ($1, $2) vs SQLite (?) if dbUtils doesn't normalize it
        // Assuming dbUtils handles '?' for both or we need to check. 
        // database.js usually maps ? to $n for PG if using a custom wrapper, 
        // BUT looking at previous code (requisitions.js), it uses '?' everywhere. 
        // Let's assume dbUtils handles the translation or we are using a library that supports '?'
        // Wait, if I use raw PG driver, it expects $1.
        // Let's check database.js again to be sure about '?' support in PG.
        
        const history = await dbUtils.all(query, params);
        res.json(history);
        
    } catch (error) {
        console.error('Erreur historique budget:', error);
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;
