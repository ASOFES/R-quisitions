/* eslint-disable no-restricted-globals */

// Événement d'installation
self.addEventListener('install', (event) => {
    console.log('Service Worker: Installé');
});

// Événement d'activation
self.addEventListener('activate', (event) => {
    console.log('Service Worker: Activé');
});

// Événement de réception d'une notification Push
self.addEventListener('push', (event) => {
    let data = { title: 'Nouvelle notification', body: 'Vous avez une nouvelle mise à jour.', icon: '/logo192.png', data: { url: '/dashboard' } };
    
    if (event.data) {
        try {
            data = event.data.json();
        } catch (e) {
            data.body = event.data.text();
        }
    }

    const options = {
        body: data.body,
        icon: data.icon || '/logo192.png',
        badge: '/logo192.png', // Petite icône pour la barre de statut sur mobile
        data: data.data || { url: '/dashboard' },
        vibrate: [100, 50, 100],
        actions: [
            { action: 'open', title: 'Voir les détails' }
        ]
    };

    event.waitUntil(
        self.registration.showNotification(data.title, options)
    );
});

// Événement de clic sur la notification
self.addEventListener('notificationclick', (event) => {
    event.notification.close();

    const urlToOpen = event.notification.data.url || '/dashboard';

    event.waitUntil(
        clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
            // Si une fenêtre est déjà ouverte, on la focus
            for (let i = 0; i < windowClients.length; i++) {
                const client = windowClients[i];
                if (client.url.includes(urlToOpen) && 'focus' in client) {
                    return client.focus();
                }
            }
            // Sinon on en ouvre une nouvelle
            if (clients.openWindow) {
                return clients.openWindow(urlToOpen);
            }
        })
    );
});
