const axios = require('axios');
const { dbUtils } = require('./database/database');
const path = require('path');
const fs = require('fs');

// Ensure database is initialized
const API_URL = 'http://localhost:5000/api';

// Helper to login
async function login(username, password) {
    try {
        const res = await axios.post(`${API_URL}/auth/login`, { username, password });
        return res.data.token;
    } catch (e) {
        console.error('Login failed for', username);
        console.error(e.code || e.message);
        if (e.response) console.error(e.response.data);
        throw e;
    }
}

// Main test function
async function runTest() {
    console.log('--- Starting Alignment & Edit Test ---');

    try {
        // 1. Login as Admin
        const adminToken = await login('admin', 'password123');
        console.log('Logged in as Admin');

        // Helper to create user if not exists
        async function ensureUser(username, role, serviceId = 1) {
            try {
                // Try login first
                return await login(username, 'password123');
            } catch (e) {
                // If login fails, create user
                console.log(`Creating user ${username}...`);
                try {
                     await axios.post(`${API_URL}/users`, {
                        username,
                        password: 'password123',
                        nom_complet: username.toUpperCase(),
                        email: `${username}@test.com`,
                        role,
                        service_id: serviceId,
                        zone_id: 1,
                        actif: true
                    }, { headers: { Authorization: `Bearer ${adminToken}` } });
                    return await login(username, 'password123');
                } catch (createErr) {
                    console.error(`Failed to create/login user ${username}:`, createErr.response?.data || createErr.message);
                    throw createErr;
                }
            }
        }

        const emetteurToken = await ensureUser('emetteur1', 'emetteur');
        const analysteToken = await ensureUser('analyste1', 'analyste');
        const challengerToken = await ensureUser('challenger1', 'challenger');
        const validateurToken = await ensureUser('validateur1', 'validateur');
        const gmToken = await ensureUser('gm1', 'gm');
        const compilateurToken = await ensureUser('compilateur1', 'compilateur'); // Ensure role 'compilateur' is valid in backend enum
        const comptableToken = await ensureUser('comptable1', 'comptable');

        console.log('All users ready');

        // 2. Create a Requisition as Emetteur
        // Create Requisition with items
        const reqData = {
            objet: 'Test Requisition Edit & Alignment',
            montant_usd: 100, // Will be recalculated from items
            commentaire_initial: 'Initial comment',
            service_id: 1, // Assuming service 1 exists
            items: JSON.stringify([
                { description: 'Item 1', quantite: 2, prix_unitaire: 50, site_id: 1 }
            ])
        };

        const createRes = await axios.post(`${API_URL}/requisitions`, reqData, {
            headers: { Authorization: `Bearer ${emetteurToken}` }
        });
        const reqId = createRes.data.requisitionId;
        console.log(`Requisition created: ID ${reqId}, Number ${createRes.data.numero}`);

        // 3. Edit the Requisition (as Emetteur) - Implicit user request "edit=5"
        // Change items and verify total update
        const editData = {
            objet: 'Test Requisition Edited',
            montant_usd: 0, // Ignored, calc from items
            commentaire_initial: 'Edited comment',
            service_id: 1,
            resubmit: 'true',
            items: JSON.stringify([
                { description: 'Item 1 Modified', quantite: 3, prix_unitaire: 50, site_id: 1 }, // 150
                { description: 'Item 2 Added', quantite: 1, prix_unitaire: 50, site_id: 1 } // 50
            ])
        };

        await axios.put(`${API_URL}/requisitions/${reqId}`, editData, {
            headers: { Authorization: `Bearer ${emetteurToken}` }
        });
        console.log('Requisition edited');

        // Verify edit
        const getRes = await axios.get(`${API_URL}/requisitions/${reqId}`, {
            headers: { Authorization: `Bearer ${emetteurToken}` }
        });
        const updatedReq = getRes.data.requisition;
        const updatedItems = getRes.data.items;
        
        if (updatedReq.objet !== 'Test Requisition Edited') throw new Error('Object not updated');
        if (updatedItems.length !== 2) throw new Error('Items count incorrect');
        const total = updatedItems.reduce((sum, item) => sum + parseFloat(item.prix_total), 0);
        if (total !== 200) throw new Error(`Total incorrect: ${total} (expected 200)`);
        console.log(`Edit verified: Total ${total}, Items ${updatedItems.length}`);


        // 4. Validate (Analyst -> Challenger -> Validateur -> GM)
        // Need to move it through workflow. 
        
        // Analyste
        await axios.put(`${API_URL}/requisitions/${reqId}/action`, { action: 'valider', commentaire: 'OK Analyste' }, { headers: { Authorization: `Bearer ${analysteToken}` } });
        console.log('Analyst validated');

        // Challenger (if exists) or skip based on amount? Assuming standard flow
        // Check current level
        let check = await axios.get(`${API_URL}/requisitions/${reqId}`, { headers: { Authorization: `Bearer ${adminToken}` } });
        if (check.data.requisition.niveau === 'challenger') {
             await axios.put(`${API_URL}/requisitions/${reqId}/action`, { action: 'valider', commentaire: 'OK Challenger' }, { headers: { Authorization: `Bearer ${challengerToken}` } });
             console.log('Challenger validated');
        }

        // Validateur
        await axios.put(`${API_URL}/requisitions/${reqId}/action`, { action: 'valider', commentaire: 'OK Validateur' }, { headers: { Authorization: `Bearer ${validateurToken}` } });
        console.log('Validateur validated');

        // GM
        await axios.put(`${API_URL}/requisitions/${reqId}/action`, { action: 'valider', commentaire: 'OK GM' }, { headers: { Authorization: `Bearer ${gmToken}` } });
        console.log('GM validated -> Now in Compilation');

        // 5. Compilation (Compilateur)
        // User 'compilateur1'
        
        // Create Bordereau
        const bordereauRes = await axios.post(`${API_URL}/compilations`, { requisition_ids: [reqId] }, {
            headers: { Authorization: `Bearer ${compilateurToken}` }
        });
        const bordereauId = bordereauRes.data.bordereau_id;
        console.log(`Bordereau created: ID ${bordereauId}`);

        // 6. Alignment (Analyst) - THIS IS THE CORE REQUEST
        // Analyst aligns the bordereau
        await axios.post(`${API_URL}/compilations/${bordereauId}/aligner`, {}, {
            headers: { Authorization: `Bearer ${analysteToken}` }
        });
        console.log('Bordereau aligned by Analyst');

        // 7. Verify Payment Availability (Comptable)
        const paymentsRes = await axios.get(`${API_URL}/payments/a-payer`, {
            headers: { Authorization: `Bearer ${comptableToken}` }
        });
        
        const found = paymentsRes.data.find(r => r.id === reqId);
        if (!found) throw new Error('Requisition not found in Payments list');
        console.log('Requisition found in Payments list -> Success');
        
        // 8. Test Payment with Mode
        await axios.post(`${API_URL}/payments/effectuer`, {
            requisition_ids: [reqId],
            commentaire: 'Paid via Bank',
            mode_paiement: 'Banque'
        }, {
            headers: { Authorization: `Bearer ${comptableToken}` }
        });
        console.log('Payment effected with mode Banque');
        
        // Verify mode_paiement in DB
        const finalCheck = await axios.get(`${API_URL}/requisitions/${reqId}`, { headers: { Authorization: `Bearer ${adminToken}` } });
        if (finalCheck.data.requisition.mode_paiement !== 'Banque') {
            throw new Error(`Payment mode mismatch: ${finalCheck.data.requisition.mode_paiement}`);
        }
        console.log('Payment mode verified');

    } catch (e) {
        console.error('Test Failed:', e.message);
        if (e.response) console.error('Response data:', e.response.data);
    }
}

runTest();
