const axios = require('axios');
const { dbUtils } = require('./database/database');
const bcrypt = require('bcryptjs');

const API_URL = 'http://localhost:5000/api';

async function setupData() {
    console.log('🛠️ Setup test data...');
    
    // 1. Create Chef User
    const hashedPassword = await bcrypt.hash('password', 10);
    const chefEmail = 'chef.test@example.com';
    let chef = await dbUtils.get('SELECT * FROM users WHERE email = ?', [chefEmail]);
    
    if (!chef) {
        const result = await dbUtils.run(
            'INSERT INTO users (username, password, email, role, nom_complet) VALUES (?, ?, ?, ?, ?)',
            ['chef.test', hashedPassword, chefEmail, 'emetteur', 'Chef Test']
        );
        chef = { id: result.lastID, username: 'chef.test' };
        console.log(`Created Chef User ID: ${chef.id}`);
    } else {
        console.log(`Using existing Chef User ID: ${chef.id}`);
    }
    
    // 2. Assign Chef to Service 1
    // First check if service 1 exists
    let service = await dbUtils.get('SELECT * FROM services WHERE id = 1');
    if (!service) {
        await dbUtils.run("INSERT INTO services (id, nom, description) VALUES (1, 'IT Service', 'Test Service')");
    }
    
    await dbUtils.run('UPDATE services SET chef_id = ? WHERE id = 1', [chef.id]);
    console.log(`✅ Chef (ID: ${chef.id}) assigned to Service 1`);
    
    return chef;
}

async function runTest() {
    try {
        const chef = await setupData();
        
        // Login as Emetteur (edla.m) - Ensure this user exists in your DB or create one
        let emetteurToken;
        try {
            const loginRes = await axios.post(`${API_URL}/auth/login-simple`, { username: 'edla.m', password: 'password' });
            emetteurToken = loginRes.data.token;
        } catch (e) {
            console.log("Could not login as edla.m, creating temp emetteur...");
            // Create temp emetteur if needed
             const hashedPassword = await bcrypt.hash('password', 10);
             const email = 'emetteur.test@example.com';
             let emetteur = await dbUtils.get('SELECT * FROM users WHERE email = ?', [email]);
             if (!emetteur) {
                 await dbUtils.run(
                    'INSERT INTO users (username, password, email, role, nom_complet) VALUES (?, ?, ?, ?, ?)',
                    ['emetteur.test', hashedPassword, email, 'emetteur', 'Emetteur Test']
                 );
             }
             const loginRes = await axios.post(`${API_URL}/auth/login-simple`, { username: 'emetteur.test', password: 'password' });
             emetteurToken = loginRes.data.token;
        }
        
        // Login as Chef
        const loginChefRes = await axios.post(`${API_URL}/auth/login-simple`, { username: 'chef.test', password: 'password' });
        const tokenChef = loginChefRes.data.token;
        
        // Create Requisition
        console.log('📝 Creating Requisition...');
        const reqRes = await axios.post(`${API_URL}/requisitions`, {
            objet: 'Test Chef Approval',
            montant_usd: 1000,
            commentaire_initial: 'Testing chef approval workflow',
            service_id: 1
        }, { headers: { Authorization: `Bearer ${emetteurToken}` } });
        
        const reqId = reqRes.data.requisitionId;
        console.log(`✅ Requisition Created: ID ${reqId}`);
        
        // Submit (Emetteur -> Valider)
        console.log('🚀 Submitting Requisition (Emetteur)...');
        // Note: The first validation from 'emetteur' usually moves it to the next step
        // In the updated workflow, if chef exists, it should go to 'approbation_service'
        const submitRes = await axios.put(`${API_URL}/requisitions/${reqId}/action`, {
            action: 'valider',
            commentaire: 'Submission'
        }, { headers: { Authorization: `Bearer ${emetteurToken}` } });
        
        console.log(`✅ Submitted. New Level: ${submitRes.data.niveauApres}`);
        
        if (submitRes.data.niveauApres !== 'approbation_service') {
            throw new Error(`Expected 'approbation_service', got '${submitRes.data.niveauApres}'`);
        }
        
        // Chef Approval
        console.log('👨‍💼 Chef Approval...');
        const chefApproveRes = await axios.put(`${API_URL}/requisitions/${reqId}/action`, {
            action: 'valider',
            commentaire: 'Approved by Chef'
        }, { headers: { Authorization: `Bearer ${tokenChef}` } });
        
        console.log(`✅ Chef Approved. New Level: ${chefApproveRes.data.niveauApres}`);
        
        if (chefApproveRes.data.niveauApres !== 'analyste') {
             throw new Error(`Expected 'analyste', got '${chefApproveRes.data.niveauApres}'`);
        }
        
        console.log('🎉 Chef Workflow Test PASSED!');
        
    } catch (error) {
        console.error('❌ Test Failed:', error.response ? error.response.data : error.message);
    }
}

runTest();
