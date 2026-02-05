const { dbUtils, dbReady } = require('./database/database');

async function debugPayments() {
    try {
        await dbReady;
        console.log('--- DIAGNOSTIC PAIEMENTS ---');
        
        // 1. Check for duplicates in paiements table
        const duplicates = await dbUtils.all(`
            SELECT requisition_id, COUNT(*) as count 
            FROM paiements 
            GROUP BY requisition_id 
            HAVING COUNT(*) > 1
        `);
        
        console.log(`Found ${duplicates.length} requisitions with duplicate payments.`);
        
        if (duplicates.length > 0) {
            for (const dup of duplicates) {
                console.log(`\nRequisition ID ${dup.requisition_id} has ${dup.count} payments:`);
                const payments = await dbUtils.all(`
                    SELECT * FROM paiements WHERE requisition_id = ?
                `, [dup.requisition_id]);
                console.table(payments);
                
                // Check requisition status
                const req = await dbUtils.get(`SELECT * FROM requisitions WHERE id = ?`, [dup.requisition_id]);
                console.log('Requisition Status:', req.niveau, req.statut);
            }
        }

    } catch (error) {
        console.error('Error:', error);
    }
}

debugPayments();
