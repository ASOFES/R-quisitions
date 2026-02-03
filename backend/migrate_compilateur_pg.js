const { Client } = require('pg');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

const migrate = async () => {
    try {
        console.log('🔄 Début de la migration PostgreSQL...');
        await client.connect();

        // 1. Création de la table bordereaux
        console.log('📦 Création de la table bordereaux...');
        await client.query(`
            CREATE TABLE IF NOT EXISTS bordereaux (
                id SERIAL PRIMARY KEY,
                numero VARCHAR(50) UNIQUE NOT NULL,
                date_creation TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                statut VARCHAR(20) DEFAULT 'genere',
                createur_id INTEGER REFERENCES users(id)
            )
        `);

        // 2. Ajout de la colonne bordereau_id à la table requisitions
        console.log('🔗 Ajout de la colonne bordereau_id aux réquisitions...');
        try {
            await client.query('ALTER TABLE requisitions ADD COLUMN bordereau_id INTEGER REFERENCES bordereaux(id)');
        } catch (e) {
            if (e.code === '42701') { // duplicate_column
                console.log('   ℹ️ La colonne existe déjà.');
            } else {
                throw e;
            }
        }

        // 3. Mise à jour de la contrainte CHECK pour les rôles
        console.log('👤 Mise à jour des rôles utilisateurs...');
        
        // Trouver le nom de la contrainte (souvent users_role_check, mais vérifions ou drop/add générique)
        // Note: Sur Supabase/Postgres, la contrainte est généralement nommée users_role_check si créée via le script init.sql standard
        // On tente de la supprimer et la recréer.
        
        try {
            await client.query('ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check');
            await client.query(`
                ALTER TABLE users ADD CONSTRAINT users_role_check 
                CHECK (role IN ('admin', 'emetteur', 'analyste', 'challenger', 'validateur', 'comptable', 'gm', 'pm', 'compilateur'))
            `);
            console.log('✅ Contrainte de rôle mise à jour.');
        } catch (e) {
            console.warn('⚠️ Attention lors de la mise à jour de la contrainte:', e.message);
        }

        console.log('✅ Migration terminée avec succès !');
        
    } catch (error) {
        console.error('❌ Erreur lors de la migration:', error);
    } finally {
        await client.end();
    }
};

migrate();
