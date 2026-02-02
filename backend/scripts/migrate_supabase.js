
const { Client } = require('pg');
require('dotenv').config({ path: '../.env' });

async function run() {
  console.log('Connecting to Supabase for Migration...');
  
  // Utilise la configuration de l'environnement ou des valeurs par défaut sécurisées
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false } // Nécessaire pour Supabase/Render en production
  });

  try {
    await client.connect();
    console.log('Connected!');

    // 1. Add mode_paiement column to requisitions
    try {
        await client.query(`
            ALTER TABLE requisitions 
            ADD COLUMN IF NOT EXISTS mode_paiement VARCHAR(20) CHECK (mode_paiement IN ('Cash', 'Banque'));
        `);
        console.log('✅ Column mode_paiement added/verified.');
    } catch (e) {
        console.error('ℹ️ Note on mode_paiement:', e.message);
    }

    // 2. Create fonds table
    try {
        await client.query(`
            CREATE TABLE IF NOT EXISTS fonds (
                id SERIAL PRIMARY KEY,
                devise VARCHAR(3) NOT NULL,
                montant_disponible DECIMAL(15,2) NOT NULL DEFAULT 0,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                CONSTRAINT unique_devise UNIQUE (devise)
            );
        `);
        // Seed fonds if empty
        await client.query(`
            INSERT INTO fonds (devise, montant_disponible) VALUES
            ('USD', 10000.00),
            ('CDF', 25000000.00)
            ON CONFLICT (devise) DO NOTHING;
        `);
        console.log('✅ Table fonds created/verified.');
    } catch (e) {
        console.error('❌ Error creating fonds:', e.message);
    }

    // 3. Create mouvements_fonds table
    try {
        await client.query(`
            CREATE TABLE IF NOT EXISTS mouvements_fonds (
                id SERIAL PRIMARY KEY,
                type_mouvement VARCHAR(20) NOT NULL CHECK (type_mouvement IN ('entree', 'sortie')),
                montant DECIMAL(15,2) NOT NULL,
                devise VARCHAR(3) NOT NULL CHECK (devise IN ('USD', 'CDF')),
                description TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `);
        console.log('✅ Table mouvements_fonds created/verified.');
    } catch (e) {
        console.error('❌ Error creating mouvements_fonds:', e.message);
    }

    // 4. Create paiements table
    try {
        await client.query(`
            CREATE TABLE IF NOT EXISTS paiements (
                id SERIAL PRIMARY KEY,
                requisition_id INTEGER NOT NULL REFERENCES requisitions(id),
                montant_usd DECIMAL(15,2),
                montant_cdf DECIMAL(15,2),
                commentaire TEXT,
                comptable_id INTEGER NOT NULL REFERENCES users(id),
                date_paiement TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                statut VARCHAR(20) NOT NULL DEFAULT 'effectue',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `);
        console.log('✅ Table paiements created/verified.');
    } catch (e) {
        console.error('❌ Error creating paiements:', e.message);
    }

    // 5. Create workflow_settings table
    try {
        await client.query(`
            CREATE TABLE IF NOT EXISTS workflow_settings (
                niveau VARCHAR(50) PRIMARY KEY,
                delai_minutes INTEGER DEFAULT 0,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `);
        console.log('✅ Table workflow_settings created/verified.');
    } catch (e) {
        console.error('❌ Error creating workflow_settings:', e.message);
    }

  } catch (err) {
    console.error('Fatal Error:', err);
  } finally {
    await client.end();
  }
}

run();
