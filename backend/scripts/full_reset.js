const { dbUtils, dbReady } = require('../database/database');

async function fullReset() {
    console.log('⏳ Connexion à la base de données pour nettoyage COMPLET...');
    await dbReady;
    
    console.log('🗑️  Suppression de TOUTES les données...');

    // 1. Break circular dependencies
    try {
        console.log('- Détachement des relations circulaires (Services <-> Users)...');
        await dbUtils.run('UPDATE services SET chef_id = NULL');
        await dbUtils.run('UPDATE users SET service_id = NULL, zone_id = NULL');
    } catch (e) {
        console.log('  ⚠️ Erreur lors du détachement (peut-être déjà vide ou non applicable):', e.message);
    }

    // 2. Delete tables (Order matters)
    const tables = [
        'requisition_actions',
        'messages',
        'notifications',
        'pieces_jointes',
        'lignes_requisition',
        'paiements',
        'lignes_bordereau',
        'bordereaux',
        'requisitions',
        'budgets',
        'users',
        'services',
        'zones'
    ];

    for (const table of tables) {
        try {
            console.log(`- Suppression données table: ${table}`);
            await dbUtils.run(`DELETE FROM ${table}`);
            
            // Reset sequences if SQLite
            try {
                await dbUtils.run(`DELETE FROM sqlite_sequence WHERE name='${table}'`);
            } catch (e) {
                // Ignore
            }
        } catch (e) {
            if (e.code === '42P01' || (e.message && e.message.includes('no such table'))) {
                console.log(`  ⚠️ Table ${table} inexistante (ignorée).`);
            } else {
                console.error(`  ❌ Erreur sur ${table}:`, e.message);
            }
        }
    }

    console.log('✅ Base de données entièrement vidée.');
    process.exit(0);
}

fullReset();
