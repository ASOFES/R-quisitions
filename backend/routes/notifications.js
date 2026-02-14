const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');
const { dbUtils } = require('../database/database');

// Route pour enregistrer un abonnement aux notifications push
router.post('/subscribe', authenticateToken, async (req, res) => {
    try {
        const { subscription } = req.body;
        const userId = req.user.id;

        if (!subscription || !subscription.endpoint) {
            return res.status(400).json({ error: 'Abonnement invalide' });
        }

        // On enregistre ou met à jour l'abonnement
        const isPostgres = !!process.env.DATABASE_URL;
        
        if (isPostgres) {
            // PostgreSQL: ON CONFLICT pour l'upsert
            await dbUtils.run(
                'INSERT INTO push_subscriptions (user_id, endpoint, p256dh, auth) VALUES (?, ?, ?, ?) ON CONFLICT (endpoint) DO UPDATE SET user_id = EXCLUDED.user_id, p256dh = EXCLUDED.p256dh, auth = EXCLUDED.auth',
                [userId, subscription.endpoint, subscription.keys.p256dh, subscription.keys.auth]
            );
        } else {
            // SQLite: INSERT OR REPLACE
            await dbUtils.run(
                'INSERT OR REPLACE INTO push_subscriptions (user_id, endpoint, p256dh, auth) VALUES (?, ?, ?, ?)',
                [userId, subscription.endpoint, subscription.keys.p256dh, subscription.keys.auth]
            );
        }

        res.status(201).json({ message: 'Abonnement enregistré avec succès' });
    } catch (error) {
        console.error('Erreur lors de l\'abonnement push:', error);
        res.status(500).json({ error: 'Erreur lors de l\'enregistrement de l\'abonnement' });
    }
});

// Route pour obtenir la clé publique VAPID
router.get('/vapid-public-key', (req, res) => {
    const publicKey = process.env.VAPID_PUBLIC_KEY;
    if (!publicKey) {
        return res.status(500).json({ error: 'Clé VAPID non configurée' });
    }
    res.json({ publicKey });
});

module.exports = router;
