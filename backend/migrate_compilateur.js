const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const dbPath = process.env.DB_PATH || path.join(__dirname, '../database.sqlite');
const db = new sqlite3.Database(dbPath);

const run = (sql, params = []) => {
    return new Promise((resolve, reject) => {
        db.run(sql, params, function (err) {
            if (err) reject(err);
            else resolve(this);
        });
    });
};

const migrate = async () => {
    try {
        console.log('🔄 Début de la migration...');

        // 1. Désactiver les clés étrangères pour éviter les problèmes lors de la recréation
        await run('PRAGMA foreign_keys = OFF');

        // 2. Création de la table bordereaux
        console.log('📦 Création de la table bordereaux...');
        await run(`
            CREATE TABLE IF NOT EXISTS bordereaux (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                numero VARCHAR(50) UNIQUE NOT NULL,
                date_creation DATETIME DEFAULT CURRENT_TIMESTAMP,
                statut VARCHAR(20) DEFAULT 'genere',
                createur_id INTEGER,
                FOREIGN KEY (createur_id) REFERENCES users(id)
            )
        `);

        // 3. Ajout de la colonne bordereau_id à la table requisitions
        console.log('🔗 Ajout de la colonne bordereau_id aux réquisitions...');
        try {
            await run('ALTER TABLE requisitions ADD COLUMN bordereau_id INTEGER REFERENCES bordereaux(id)');
        } catch (e) {
            if (!e.message.includes('duplicate column')) throw e;
            console.log('   ℹ️ La colonne existe déjà.');
        }

        // 4. Migration de la table users pour ajouter le rôle 'compilateur'
        console.log('👤 Mise à jour des rôles utilisateurs...');
        
        // Renommer la table actuelle
        await run('ALTER TABLE users RENAME TO users_old');

        // Créer la nouvelle table avec le rôle ajouté
        await run(`
            CREATE TABLE users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                username VARCHAR(50) UNIQUE NOT NULL,
                password VARCHAR(255) NOT NULL,
                nom_complet VARCHAR(100) NOT NULL,
                email VARCHAR(100) UNIQUE,
                role VARCHAR(20) NOT NULL CHECK (role IN ('admin', 'emetteur', 'analyste', 'challenger', 'validateur', 'comptable', 'gm', 'pm', 'compilateur')),
                service_id INTEGER,
                zone_id INTEGER,
                actif BOOLEAN DEFAULT 1,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (service_id) REFERENCES services(id),
                FOREIGN KEY (zone_id) REFERENCES zones(id)
            )
        `);

        // Copier les données
        await run('INSERT INTO users SELECT * FROM users_old');

        // Supprimer l'ancienne table
        await run('DROP TABLE users_old');

        // 5. Réactiver les clés étrangères
        await run('PRAGMA foreign_keys = ON');

        console.log('✅ Migration terminée avec succès !');
        
    } catch (error) {
        console.error('❌ Erreur lors de la migration:', error);
    } finally {
        db.close();
    }
};

migrate();
