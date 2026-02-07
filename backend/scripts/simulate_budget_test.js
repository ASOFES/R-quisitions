const { dbUtils, dbReady } = require('../database/database');
const BudgetService = require('../services/BudgetService');

// Config
const API_URL = 'http://localhost:5000/api';

// Utils
async function login(username, password) {
    const response = await fetch(`${API_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
    });
    if (!response.ok) {
        const txt = await response.text();
        throw new Error(`Login failed for ${username}: ${txt}`);
    }
    const data = await response.json();
    return data.token;
}

async function runTest() {
    console.log("🚀 Démarrage de la simulation de test budgétaire...");
    
    // 1. Initialisation DB
    await dbReady;
    
    // Date du jour pour le mois
    const now = new Date();
    const mois = now.toISOString().slice(0, 7); // YYYY-MM
    const annee = now.getFullYear();
    
    console.log(`📅 Mois de test: ${mois}`);

    // 2. Création/Mise à jour du Budget Test
    const testBudgetDesc = "SIMULATION_BUDGET_ITEM";
    const testBudgetAmount = 100;
    
    console.log(`💰 Insertion du budget test: ${testBudgetDesc} = ${testBudgetAmount}$`);
    
    await dbUtils.run('DELETE FROM budgets WHERE description = ? AND mois = ?', [testBudgetDesc, mois]);
    
    await dbUtils.run(
        'INSERT INTO budgets (description, mois, annee, montant_prevu, montant_consomme, classification) VALUES (?, ?, ?, ?, ?, ?)',
        [testBudgetDesc, mois, annee, testBudgetAmount, 0, 'Test']
    );

    // 2b. Préparation Données (Users, Site, Service)
    console.log("👤 Préparation des données de test...");
    const bcrypt = require('bcryptjs');
    const pwdHash = await bcrypt.hash('password123', 10);
    
    // Services
    let service1 = await dbUtils.get('SELECT id FROM services LIMIT 1');
    if (!service1) {
        await dbUtils.run("INSERT INTO services (code, nom) VALUES ('TEST', 'Service Test')");
        service1 = await dbUtils.get('SELECT id FROM services WHERE code = ?', ['TEST']);
    }
    const serviceId = service1.id;

    // Sites
    let site1 = await dbUtils.get('SELECT id FROM sites LIMIT 1');
    if (!site1) {
        await dbUtils.run("INSERT INTO sites (nom, description) VALUES ('Site Test', 'Site Test')");
        site1 = await dbUtils.get('SELECT id FROM sites WHERE nom = ?', ['Site Test']);
    }
    const siteId = site1.id;

    // Zones
    let zone = await dbUtils.get('SELECT id FROM zones LIMIT 1');
    if (!zone) {
        await dbUtils.run("INSERT INTO zones (code, nom) VALUES ('ZT', 'Zone Test')");
        zone = await dbUtils.get('SELECT id FROM zones WHERE code = ?', ['ZT']);
    }
    const zoneId = zone.id;

    // Emetteur
    let emetteur = await dbUtils.get('SELECT id FROM users WHERE username = ?', ['test.emetteur']);
    if (!emetteur) {
        await dbUtils.run("INSERT INTO users (username, password, nom_complet, email, role, service_id, zone_id) VALUES ('test.emetteur', ?, 'Test Emetteur', 'test.emetteur@test.com', 'emetteur', ?, ?)", [pwdHash, serviceId, zoneId]);
    } else {
        await dbUtils.run("UPDATE users SET password = ?, service_id = ?, zone_id = ? WHERE id = ?", [pwdHash, serviceId, zoneId, emetteur.id]);
    }

    // Analyste
    let analyste = await dbUtils.get('SELECT id FROM users WHERE username = ?', ['test.analyste']);
    if (!analyste) {
        await dbUtils.run("INSERT INTO users (username, password, nom_complet, email, role, service_id, zone_id) VALUES ('test.analyste', ?, 'Test Analyste', 'test.analyste@test.com', 'analyste', ?, ?)", [pwdHash, serviceId, zoneId]);
    } else {
         await dbUtils.run("UPDATE users SET password = ?, service_id = ?, zone_id = ? WHERE id = ?", [pwdHash, serviceId, zoneId, analyste.id]);
    }

    const TEST_CREDENTIALS = {
        emetteur: { username: 'test.emetteur', password: 'password123' },
        analyste: { username: 'test.analyste', password: 'password123' }
    };

    // 3. Connexion
    const tokenEmetteur = await login(TEST_CREDENTIALS.emetteur.username, TEST_CREDENTIALS.emetteur.password);
    const tokenAnalyste = await login(TEST_CREDENTIALS.analyste.username, TEST_CREDENTIALS.analyste.password);
    console.log("✅ Authentification réussie");

    // 4. Test 1: Création Réquisition OK (< Budget)
    console.log("\n--- TEST 1: Réquisition Valide (50$) ---");
    try {
        const req1 = await createRequisition(tokenEmetteur, testBudgetDesc, 50, serviceId, siteId);
        const req1Id = req1.requisitionId || req1.id;
        console.log(`📝 Réquisition créée: ID ${req1Id}`);
        
        // Forcer le niveau analyste
        await dbUtils.run("UPDATE requisitions SET statut='en_cours', niveau='analyste' WHERE id=?", [req1Id]);
        
        // Validation Analyste
        const val1 = await validateRequisition(tokenAnalyste, req1Id);
        if (val1.success) {
            console.log("✅ Validation réussie (Attendu)");
        } else {
            console.error("❌ Echec validation (Inattendu):", val1.error);
        }
    } catch (e) {
        console.error("❌ Erreur Test 1:", e);
    }

    // 5. Test 2: Création Réquisition KO (Dépassement)
    console.log("\n--- TEST 2: Réquisition Invalide (150$ > 100$) ---");
    try {
        const req2 = await createRequisition(tokenEmetteur, testBudgetDesc, 150, serviceId, siteId);
        const req2Id = req2.requisitionId || req2.id;
        console.log(`📝 Réquisition créée: ID ${req2Id}`);
        
        // Forcer le niveau analyste
        await dbUtils.run("UPDATE requisitions SET statut='en_cours', niveau='analyste' WHERE id=?", [req2Id]);
        
        // Validation Analyste
        const val2 = await validateRequisition(tokenAnalyste, req2Id);
        if (!val2.success && val2.status === 400) {
            console.log("✅ Validation bloquée comme prévu (Attendu)");
            console.log("   Raison:", JSON.stringify(val2.error));
        } else {
            console.error("❌ La validation aurait dû être bloquée !", val2);
        }
    } catch (e) {
         console.error("❌ Erreur Test 2:", e);
    }
    
    console.log("\n🏁 Simulation terminée.");
    process.exit(0);
}

async function createRequisition(token, description, amount, serviceId, siteId) {
    const items = [{
        description: description,
        quantite: 1,
        prix_unitaire: amount,
        devise: 'USD'
    }];
    
    const response = await fetch(`${API_URL}/requisitions`, {
        method: 'POST',
        headers: { 
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
            objet: `Test Budget ${amount}$`,
            items: items, // Sending object directly, express.json handles it
            service_id: serviceId, 
            site_id: siteId
        })
    });
    
    if (!response.ok) {
        const txt = await response.text();
        throw new Error(`Create Req failed: ${txt}`);
    }
    return await response.json();
}

async function validateRequisition(token, id) {
    const response = await fetch(`${API_URL}/requisitions/${id}/action`, {
        method: 'PUT',
        headers: { 
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
            action: 'valider',
            commentaire: 'Validation test budget'
        })
    });
    
    if (response.ok) {
        return { success: true, data: await response.json() };
    } else {
        return { success: false, status: response.status, error: await response.json() };
    }
}

runTest().catch(console.error);
