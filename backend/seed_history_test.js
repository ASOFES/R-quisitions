const { dbUtils, dbReady } = require('./database/database');

async function seedHistoryTest() {
    try {
        console.log('⏳ Attente de l\'initialisation de la DB...');
        await dbReady;
        console.log('🌱 Début du peuplement des données de test (Historique Budget)...');

        // 1. Get necessary IDs
        const user = await dbUtils.get("SELECT id, service_id FROM public.users WHERE username = 'edla.m'");
        const rhService = await dbUtils.get("SELECT id FROM public.services WHERE code = 'RH'");
        
        if (!user || !rhService) {
            throw new Error("Utilisateur 'edla.m' ou Service 'RH' introuvable. Exécutez d'abord seed_data.js");
        }

        const mois = new Date().toISOString().slice(0, 7); // YYYY-MM
        const annee = mois.split('-')[0];

        // 2. Create Budget Line
        const budgetDescription = "Assurances";
        const reqNum = "RH-202602-TEST-HIST";
        
        // Cleanup old conflicting budget and requisition if exists (for test idempotency)
        await dbUtils.run("DELETE FROM public.lignes_requisition WHERE requisition_id IN (SELECT id FROM public.requisitions WHERE numero = ?)", [reqNum]);
        await dbUtils.run("DELETE FROM public.requisitions WHERE numero = ?", [reqNum]);
        await dbUtils.run("DELETE FROM public.budgets WHERE description = ? AND mois = ?", [budgetDescription, mois]);

        let budget = await dbUtils.get(
            "SELECT id, montant_consomme FROM public.budgets WHERE description = ? AND service_id = ? AND mois = ?", 
            [budgetDescription, rhService.id, mois]
        );

        if (!budget) {
            const result = await dbUtils.run(
                "INSERT INTO public.budgets (description, montant_prevu, montant_consomme, service_id, mois, annee, classification) VALUES (?, ?, ?, ?, ?, ?, ?)",
                [budgetDescription, 5000, 0, rhService.id, mois, annee, "Fonctionnement"]
            );
            budget = { id: result.id, montant_consomme: 0 };
            console.log(`✅ Budget '${budgetDescription}' créé.`);
        } else {
            console.log(`ℹ️ Budget '${budgetDescription}' existe déjà.`);
        }

        // 3. Create Requisition (Payée & Budget Impacted)
        let requisition = await dbUtils.get("SELECT id FROM public.requisitions WHERE numero = ?", [reqNum]);

        if (!requisition) {
            const reqResult = await dbUtils.run(
                `INSERT INTO public.requisitions (
                    numero, emetteur_id, service_id, objet, 
                    statut, niveau, budget_impacted, created_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`,
                [reqNum, user.id, rhService.id, "Test Historique Budget", "payee", "comptable", true]
            );
            requisition = { id: reqResult.id };

            // 4. Create Line Item
            await dbUtils.run(
                `INSERT INTO public.lignes_requisition (
                    requisition_id, description, quantite, prix_unitaire, prix_total
                ) VALUES (?, ?, ?, ?, ?)`,
                [requisition.id, budgetDescription, 1, 250, 250]
            );
            console.log(`✅ Réquisition '${reqNum}' créée (Payée).`);

            // 5. Update Budget Consumption
            // Since budget_impacted is true, we assume consumption is already applied.
            // But we need to manually update it here for the test data to be consistent.
            const newConsomme = parseFloat(budget.montant_consomme || 0) + 250;
            await dbUtils.run("UPDATE public.budgets SET montant_consomme = ? WHERE id = ?", [newConsomme, budget.id]);
            console.log(`✅ Budget mis à jour (Consommé: ${newConsomme}).`);
        } else {
            console.log(`ℹ️ Réquisition '${reqNum}' existe déjà.`);
        }

        console.log('🏁 Données de test (Historique) injectées avec succès.');
        process.exit(0);

    } catch (error) {
        console.error('❌ Erreur:', error);
        process.exit(1);
    }
}

seedHistoryTest();
