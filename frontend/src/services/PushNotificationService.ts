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
                throw new Error('Les notifications push ne sont pas supportées par ce navigateur.');
            }

            if (!window.isSecureContext) {
                throw new Error('Les notifications push nécessitent une connexion sécurisée (HTTPS).');
            }

            // 1. Demander la permission
            const permission = await Notification.requestPermission();
            if (permission !== 'granted') {
                throw new Error('Permission de notification refusée. Veuillez l\'activer dans les paramètres de votre navigateur.');
            }

            // 2. Enregistrer le service worker
            const registration = await navigator.serviceWorker.register('/service-worker.js');
            console.log('Service Worker enregistré:', registration);
            
            // Attendre que le SW soit prêt
            await navigator.serviceWorker.ready;

            // 3. Récupérer la clé publique du serveur
            let publicVapidKey;
            try {
                const response = await api.get('/notifications/vapid-public-key');
                publicVapidKey = response.data.publicKey;
            } catch (apiErr: any) {
                console.error('Erreur lors de la récupération de la clé VAPID:', apiErr);
                const serverError = apiErr.response?.data?.error;
                if (serverError) {
                    throw new Error(`Erreur serveur: ${serverError}`);
                }
                throw new Error('Impossible de contacter le serveur de notifications. Vérifiez votre connexion Internet ou si le serveur est en ligne.');
            }

            if (!publicVapidKey) {
                throw new Error('Le serveur n\'a pas renvoyé de clé de configuration valide.');
            }

            // 4. Souscrire au service de push
            const subscription = await registration.pushManager.subscribe({
                userVisibleOnly: true,
                applicationServerKey: this.urlBase64ToUint8Array(publicVapidKey)
            });

            // 5. Envoyer l'abonnement au backend
            await api.post('/notifications/subscribe', { subscription });

            console.log('Abonnement aux notifications push réussi !');
            return { success: true };
        } catch (error: any) {
            console.error('Détails de l\'erreur push:', error);
            return { success: false, message: error.message || 'Une erreur inconnue est survenue.' };
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
