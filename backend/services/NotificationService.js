const webpush = require('web-push');
const { dbUtils } = require('../database/database');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

// Configuration de web-push avec les clés VAPID
const publicVapidKey = process.env.VAPID_PUBLIC_KEY;
const privateVapidKey = process.env.VAPID_PRIVATE_KEY;

if (publicVapidKey && privateVapidKey) {
    webpush.setVapidDetails(
        'mailto:' + (process.env.EMAIL_NOTIFICATIONS || 'toto.mulumba@example.com'),
        publicVapidKey,
        privateVapidKey
    );
}

class NotificationService {
    /**
     * Envoie une notification à un utilisateur spécifique
     */
    static async sendNotificationToUser(userId, title, body, url = '/dashboard') {
        try {
            // Récupérer les abonnements de l'utilisateur
            const subscriptions = await dbUtils.all(
                'SELECT endpoint, p256dh, auth FROM push_subscriptions WHERE user_id = ?',
                [userId]
            );

            if (!subscriptions || subscriptions.length === 0) {
                console.log(`Aucun abonnement push trouvé pour l'utilisateur ${userId}`);
                return;
            }

            const payload = JSON.stringify({
                title,
                body,
                icon: '/logo192.png',
                data: { url }
            });

            const sendPromises = subscriptions.map(sub => {
                const pushSubscription = {
                    endpoint: sub.endpoint,
                    keys: {
                        p256dh: sub.p256dh,
                        auth: sub.auth
                    }
                };

                return webpush.sendNotification(pushSubscription, payload)
                    .catch(async (err) => {
                        if (err.statusCode === 404 || err.statusCode === 410) {
                            // L'abonnement a expiré ou n'est plus valide, on le supprime
                            console.log(`Suppression de l'abonnement invalide pour l'utilisateur ${userId}`);
                            await dbUtils.run('DELETE FROM push_subscriptions WHERE endpoint = ?', [sub.endpoint]);
                        } else {
                            console.error(`Erreur lors de l'envoi de la notification push:`, err);
                        }
                    });
            });

            await Promise.all(sendPromises);
        } catch (error) {
            console.error('Erreur NotificationService:', error);
        }
    }

    /**
     * Envoie une notification à tous les utilisateurs d'un rôle spécifique
     */
    static async sendNotificationToRole(role, title, body, url = '/dashboard') {
        try {
            const users = await dbUtils.all('SELECT id FROM users WHERE role = ?', [role]);
            for (const user of users) {
                await this.sendNotificationToUser(user.id, title, body, url);
            }
        } catch (error) {
            console.error('Erreur envoi notification par rôle:', error);
        }
    }
}

module.exports = NotificationService;
