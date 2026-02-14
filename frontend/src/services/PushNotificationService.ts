import api from './api';

class PushNotificationService {
    /**
     * Convertit une clé VAPID publique (base64) en Uint8Array pour le navigateur
     */
    private static urlBase64ToUint8Array(base64String: string) {
        const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
        const base64 = (base64String + padding)
            .replace(/-/g, '+')
            .replace(/_/g, '/');

        const rawData = window.atob(base64);
        const outputArray = new Uint8Array(rawData.length);

        for (let i = 0; i < rawData.length; ++i) {
            outputArray[i] = rawData.charCodeAt(i);
        }
        return outputArray;
    }

    /**
     * Enregistre le service worker et souscrit l'utilisateur aux notifications
     */
    static async subscribeToNotifications() {
        try {
            if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
                console.warn('Les notifications push ne sont pas supportées par ce navigateur');
                return false;
            }

            // 1. Demander la permission
            const permission = await Notification.requestPermission();
            if (permission !== 'granted') {
                console.warn('Permission de notification refusée');
                return false;
            }

            // 2. Enregistrer le service worker
            const registration = await navigator.serviceWorker.register('/service-worker.js');
            
            // 3. Récupérer la clé publique du serveur
            const { data } = await api.get('/notifications/vapid-public-key');
            const publicVapidKey = data.publicKey;

            // 4. Souscrire au service de push
            const subscription = await registration.pushManager.subscribe({
                userVisibleOnly: true,
                applicationServerKey: this.urlBase64ToUint8Array(publicVapidKey)
            });

            // 5. Envoyer l'abonnement au backend
            await api.post('/notifications/subscribe', { subscription });

            console.log('Abonnement aux notifications push réussi !');
            return true;
        } catch (error) {
            console.error('Erreur lors de l\'abonnement push:', error);
            return false;
        }
    }

    /**
     * Vérifie si l'utilisateur est déjà abonné
     */
    static async isSubscribed() {
        if (!('serviceWorker' in navigator)) return false;
        
        const registration = await navigator.serviceWorker.getRegistration();
        if (!registration) return false;
        
        const subscription = await registration.pushManager.getSubscription();
        return !!subscription;
    }
}

export default PushNotificationService;
