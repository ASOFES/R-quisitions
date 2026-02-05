const { dbUtils, dbReady } = require('./database/database');

async function testWorkflow() {
    try {
        await dbReady;
        console.log('--- Démarrage du test Workflow Analyste ---');

        // 1. Setup: Find a valid service and user
        const service = await dbUtils.get('SELECT id FROM services LIMIT 1');
        const user = await dbUtils.get('SELECT id FROM users LIMIT 1');
        
        if (!service || !user) {
            console.error('Pas de service ou utilisateur trouvé');
            return;
        }

        // 2. Create a test requisition in 'compilation' state
        console.log('Création réquisition test...');
        const reqResult = await dbUtils.run(`
            INSERT INTO requisitions (
                numero, objet, montant_usd, emetteur_id, service_id, niveau, statut, created_at
            ) VALUES (
                'TEST-REQ-001', 'Test Bordereau', 100, ?, ?, 'compilation', 'validee', CURRENT_TIMESTAMP
            )
        `, [user.id, service.id]);
        
        const reqId = reqResult.id;
        console.log(`Réquisition créée: ID ${reqId}`);

        // 3. Create a Bordereau (Simulate Compilateur action)
        console.log('Création bordereau...');
        const bordResult = await dbUtils.run(`
            INSERT INTO bordereaux (numero, createur_id, date_creation)
            VALUES ('BORD-TEST-001', ?, CURRENT_TIMESTAMP)
        `, [user.id]);
        
        const bordId = bordResult.id;
        console.log(`Bordereau créé: ID ${bordId}`);

        // Link requisition to bordereau and set level to 'validation_bordereau'
        await dbUtils.run(`
            UPDATE requisitions 
            SET bordereau_id = ?, niveau = 'validation_bordereau' 
            WHERE id = ?
        `, [bordId, reqId]);
        console.log('Réquisition liée au bordereau (niveau validation_bordereau)');

        // 4. Test "GET /a-aligner" logic
        console.log('Test récupération bordereaux à aligner...');
        const bordereaux = await dbUtils.all(`
            SELECT DISTINCT b.* 
            FROM bordereaux b
            JOIN requisitions r ON r.bordereau_id = b.id
            WHERE r.niveau = 'validation_bordereau' AND b.id = ?
        `, [bordId]);

        if (bordereaux.length > 0) {
            console.log('SUCCESS: Bordereau trouvé dans la liste à aligner');
        } else {
            console.error('FAILURE: Bordereau NON trouvé');
        }

        // 5. Test "POST /aligner" logic
        console.log('Test alignement (Paiement Banque)...');
        const modePaiement = 'Banque';
        
        // Update
        await dbUtils.run(`
            UPDATE requisitions 
            SET niveau = 'paiement', mode_paiement = ? 
            WHERE bordereau_id = ? AND niveau = 'validation_bordereau'
        `, [modePaiement, bordId]);

        // Verify
        const updatedReq = await dbUtils.get('SELECT * FROM requisitions WHERE id = ?', [reqId]);
        
        if (updatedReq.niveau === 'paiement' && updatedReq.mode_paiement === 'Banque') {
            console.log('SUCCESS: Réquisition mise à jour (niveau=paiement, mode=Banque)');
        } else {
            console.error(`FAILURE: État incorrect (${updatedReq.niveau}, ${updatedReq.mode_paiement})`);
        }

        // Clean up
        console.log('Nettoyage...');
        await dbUtils.run('DELETE FROM requisitions WHERE id = ?', [reqId]);
        await dbUtils.run('DELETE FROM bordereaux WHERE id = ?', [bordId]);

    } catch (error) {
        console.error('Erreur test:', error);
    }
}

testWorkflow();
