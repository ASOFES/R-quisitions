const { dbUtils, dbReady } = require('./database/database');

async function cleanupData() {
    try {
        console.log('⏳ Attente de l\'initialisation de la DB...');
        await dbReady;
        console.log('🧹 Début du nettoyage des données...');

        // Helper to ignore "relation does not exist" errors
        const safeDelete = async (table) => {
            try {
                await dbUtils.run(`DELETE FROM ${table}`);
                console.log(`✅ Table ${table} vidée.`);
            } catch (error) {
                if (error.message.includes('no such table') || error.message.includes('does not exist')) {
                    console.log(`⚠️ Table ${table} n'existe pas (ignoré).`);
                } else {
                    console.error(`❌ Erreur vidage ${table}:`, error.message);
                }
            }
        };

        // 1. Delete dependent tables first
        await safeDelete('requisition_actions');
        await safeDelete('messages');
        await safeDelete('pieces_jointes');
        await safeDelete('lignes_requisition'); // Corrected name
        await safeDelete('paiements');
        await safeDelete('bordereaux');
        await safeDelete('mouvements_fonds');

        // 2. Delete Requisitions
        await safeDelete('requisitions');

        // 3. Reset Services chef_id
        try {
            await dbUtils.run('UPDATE services SET chef_id = NULL');
            console.log('✅ Chefs de service réinitialisés.');
        } catch (error) {
             console.error('❌ Erreur reset services:', error.message);
        }

        // 4. Delete Users except Admin and potentially useful system users if needed
        // User asked to keep "l'admin". We'll keep 'admin' and 'toto'.
        try {
            await dbUtils.run("DELETE FROM users WHERE username NOT IN ('admin', 'toto')");
            console.log('✅ Utilisateurs supprimés (sauf admin et toto).');
        } catch (error) {
             console.error('❌ Erreur suppression utilisateurs:', error.message);
        }

        console.log('🏁 Nettoyage terminé avec succès.');
        process.exit(0);

    } catch (error) {
        console.error('❌ Erreur globale lors du nettoyage:', error);
        process.exit(1);
    }
}

cleanupData();
