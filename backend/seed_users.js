const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const bcrypt = require('bcryptjs');

const dbPath = path.join(__dirname, 'database', 'requisition.db');
const db = new sqlite3.Database(dbPath);

async function seedUsers() {
    console.log('🌱 Peuplement de la base de données avec les utilisateurs...');
    
    const users = [
        { username: 'admin', password: 'password123', nom_complet: 'Administrateur System', email: 'admin@requisition.com', role: 'admin', service_id: null },
        { username: 'edla.m', password: 'password123', nom_complet: 'Edla Mukeba', email: 'edla.m@requisition.com', role: 'emetteur', service_id: 1 },
        { username: 'analyste.compta', password: 'password123', nom_complet: 'Analyste Comptable', email: 'analyste@requisition.com', role: 'analyste', service_id: 2 },
        { username: 'challenger', password: 'password123', nom_complet: 'Challenger Principal', email: 'challenger@requisition.com', role: 'challenger', service_id: 2 },
        { username: 'pm.user', password: 'password123', nom_complet: 'Project Manager', email: 'pm@requisition.com', role: 'validateur', service_id: 3 },
        { username: 'gm.user', password: 'password123', nom_complet: 'General Manager', email: 'gm@requisition.com', role: 'gm', service_id: 3 },
        { username: 'comptable', password: 'password123', nom_complet: 'Comptable Principal', email: 'comptable@requisition.com', role: 'comptable', service_id: 2 }
    ];

    const hashedPassword = await bcrypt.hash('password123', 10);

    for (const user of users) {
        db.run(`
            INSERT OR REPLACE INTO users (username, password, nom_complet, email, role, service_id)
            VALUES (?, ?, ?, ?, ?, ?)
        `, [user.username, hashedPassword, user.nom_complet, user.email, user.role, user.service_id], (err) => {
            if (err) console.error(`❌ Erreur ${user.username}:`, err.message);
            else console.log(`✅ Utilisateur ${user.username} créé/mis à jour.`);
        });
    }

    setTimeout(() => {
        db.close(() => console.log('🏁 Peuplement terminé.'));
    }, 2000);
}

seedUsers();
