const { dbUtils, dbReady } = require('./database/database');

async function debugData() {
    try {
        await dbReady;
        console.log('--- DIAGNOSTIC DONNÉES ---');

        // 1. Check Requisitions at 'validation_bordereau'
        console.log('\n1. Réquisitions au niveau "validation_bordereau":');
        const reqs = await dbUtils.all(`
            SELECT id, numero, niveau, statut, bordereau_id 
            FROM requisitions 
            WHERE niveau = 'validation_bordereau'
        `);
        console.table(reqs);

        // 2. Check Bordereaux
        console.log('\n2. Tous les Bordereaux:');
        const bords = await dbUtils.all(`
            SELECT b.id, b.numero, b.date_creation,
                   (SELECT COUNT(*) FROM requisitions r WHERE r.bordereau_id = b.id) as total_reqs,
                   (SELECT COUNT(*) FROM requisitions r WHERE r.bordereau_id = b.id AND r.niveau = 'validation_bordereau') as reqs_a_valider
            FROM bordereaux b
        `);
        console.table(bords);

        // 3. Simulate Query used in /a-aligner
        console.log('\n3. Simulation requête /a-aligner:');
        const aligner = await dbUtils.all(`
            SELECT DISTINCT b.*
            FROM bordereaux b
            JOIN requisitions r_check ON r_check.bordereau_id = b.id
            WHERE r_check.niveau = 'validation_bordereau'
        `);
        console.table(aligner);

    } catch (error) {
        console.error('Erreur diagnostic:', error);
    }
}

debugData();
