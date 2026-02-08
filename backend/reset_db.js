const { Pool } = require('pg');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

async function resetDatabase() {
    try {
        console.log('🗑️  Suppression du schéma public...');
        await pool.query('DROP SCHEMA public CASCADE;');
        await pool.query('CREATE SCHEMA public;');
        await pool.query('GRANT ALL ON SCHEMA public TO postgres;');
        await pool.query('GRANT ALL ON SCHEMA public TO public;');
        console.log('✅ Base de données nettoyée avec succès.');
    } catch (err) {
        console.error('❌ Erreur lors du nettoyage:', err);
    } finally {
        await pool.end();
    }
}

resetDatabase();
