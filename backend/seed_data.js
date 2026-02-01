const { dbUtils, dbReady } = require('./database/database');
const bcrypt = require('bcryptjs');

async function seedData() {
    try {
        console.log('⏳ Attente de l\'initialisation de la DB...');
        await dbReady;
        console.log('🌱 Début du peuplement des données...');

        // 1. Seed Zones
        const zones = [
            { code: 'KIN', nom: 'Kinshasa', description: 'Zone de Kinshasa' },
            { code: 'LUB', nom: 'Lubumbashi', description: 'Zone de Lubumbashi' },
            { code: 'GOM', nom: 'Goma', description: 'Zone de Goma' }
        ];

        for (const zone of zones) {
            const existing = await dbUtils.get('SELECT id FROM zones WHERE code = ?', [zone.code]);
            if (!existing) {
                await dbUtils.run(
                    'INSERT INTO zones (code, nom, description) VALUES (?, ?, ?)',
                    [zone.code, zone.nom, zone.description]
                );
                console.log(`✅ Zone ${zone.code} ajoutée.`);
            }
        }

        // 2. Seed Services
        const services = [
            { code: 'RH', nom: 'Ressources Humaines', description: 'Gestion du personnel' },
            { code: 'FIN', nom: 'Finance', description: 'Gestion financière' },
            { code: 'IT', nom: 'Informatique', description: 'Support technique' },
            { code: 'LOG', nom: 'Logistique', description: 'Gestion logistique' },
            { code: 'OPS', nom: 'Opérations', description: 'Opérations terrain' }
        ];

        for (const service of services) {
            const existing = await dbUtils.get('SELECT id FROM services WHERE code = ?', [service.code]);
            if (!existing) {
                await dbUtils.run(
                    'INSERT INTO services (code, nom, description) VALUES (?, ?, ?)',
                    [service.code, service.nom, service.description]
                );
                console.log(`✅ Service ${service.code} ajouté.`);
            }
        }

        // 3. Seed Users
        // Fetch IDs for references
        const rhService = await dbUtils.get('SELECT id FROM services WHERE code = ?', ['RH']);
        const finService = await dbUtils.get('SELECT id FROM services WHERE code = ?', ['FIN']);
        const itService = await dbUtils.get('SELECT id FROM services WHERE code = ?', ['IT']);
        
        const kinZone = await dbUtils.get('SELECT id FROM zones WHERE code = ?', ['KIN']);

        const passwordHash = await bcrypt.hash('password123', 10);

        const users = [
            { username: 'toto', role: 'admin', service: null },
            { username: 'admin', role: 'admin', service: null },
            { username: 'edla.m', role: 'emetteur', service: rhService },
            { username: 'analyste', role: 'analyste', service: finService },
            { username: 'validateur', role: 'validateur', service: itService },
            { username: 'comptable', role: 'comptable', service: finService },
            { username: 'analyste.compta', role: 'analyste', service: finService },
            { username: 'pm.user', role: 'pm', service: itService },
            { username: 'gm.user', role: 'gm', service: itService }
        ];

        for (const user of users) {
            const existing = await dbUtils.get('SELECT id FROM users WHERE username = ?', [user.username]);
            if (!existing) {
                await dbUtils.run(
                    'INSERT INTO users (username, password, nom_complet, email, role, service_id, zone_id) VALUES (?, ?, ?, ?, ?, ?, ?)',
                    [
                        user.username, 
                        passwordHash, 
                        user.username.toUpperCase(), 
                        `${user.username}@test.com`, 
                        user.role, 
                        user.service ? user.service.id : null,
                        kinZone ? kinZone.id : null
                    ]
                );
                console.log(`✅ Utilisateur ${user.username} ajouté.`);
            } else {
                // Mise à jour de l'activation uniquement (ne pas écraser le mot de passe s'il a été changé)
                await dbUtils.run(
                    'UPDATE users SET actif = TRUE WHERE id = ?',
                    [existing.id]
                );
                console.log(`🔄 Utilisateur ${user.username} vérifié (actif = TRUE).`);
            }
        }

        console.log('🏁 Peuplement terminé avec succès.');
        process.exit(0);

    } catch (error) {
        console.error('❌ Erreur lors du peuplement:', error);
        process.exit(1);
    }
}

// Start seeding
seedData();
