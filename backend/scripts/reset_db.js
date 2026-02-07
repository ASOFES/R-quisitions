const { dbUtils, dbReady } = require('../database/database');

async function resetDb() {
    console.log('⏳ Connexion à la base de données...');
    await dbReady;
    
    console.log('🗑️  Nettoyage complet de la base de données...');

    // Order matters (Child tables first)
    const tables = [
        'requisition_actions',
        'messages',
        'notifications',
        'pieces_jointes',
        'lignes_requisition',
        'paiements',
        'requisitions',
        'budgets'
    ];

    for (const table of tables) {
        try {
            console.log(`- Suppression données table: ${table}`);
            await dbUtils.run(`DELETE FROM ${table}`);
        } catch (e) {
            // Ignore "relation does not exist" errors (Postgres: 42P01, SQLite: no such table)
            if (e.code === '42P01' || (e.message && e.message.includes('no such table'))) {
                console.log(`  ⚠️ Table ${table} inexistante (ignorée).`);
            } else {
                console.error(`  ❌ Erreur sur ${table}:`, e.message);
            }
        }
    }

    console.log('✅ Base de données nettoyée avec succès (Utilisateurs et configurations conservés).');
    process.exit(0);
}

resetDb();
