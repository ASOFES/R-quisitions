const express = require('express');
const multer = require('multer');
const { authenticateToken, requireRole } = require('../middleware/auth');
const BudgetService = require('../services/BudgetService');
const { dbUtils } = require('../database/database');

const router = express.Router();
const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

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

module.exports = router;
