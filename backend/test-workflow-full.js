const axios = require('axios');
const { dbUtils, db } = require('./database/database');

const API_URL = process.env.API_URL || 'http://localhost:5000/api';

// Utilisateurs de test
const users = {
  emetteur: { username: 'edla.m', password: 'password', role: 'emetteur' },
  analyste: { username: 'analyste.compta', password: 'password', role: 'analyste' },
  challenger: { username: 'challenger', password: 'password', role: 'challenger' },
  validateur: { username: 'pm.user', password: 'password', role: 'validateur' },
  gm: { username: 'gm.user', password: 'password', role: 'gm' },
  comptable: { username: 'comptable', password: 'password', role: 'comptable' }
};

let tokens = {};

async function login(userKey) {
  try {
    const user = users[userKey];
    console.log(`🔐 Connexion de ${userKey}...`);
    const response = await axios.post(`${API_URL}/auth/login-simple`, {
      username: user.username,
      password: user.password
    });
    tokens[userKey] = response.data.token;
    console.log(`✅ ${userKey} connecté.`);
    return response.data.token;
  } catch (error) {
    console.error(`❌ Échec connexion ${userKey}:`, error.response ? error.response.data : error.message);
    throw error;
  }
}

async function createRequisition() {
  try {
    console.log('📝 Création d\'une réquisition par l\'émetteur...');
    const token = tokens['emetteur'];
    
    // Création via multipart/form-data
    const formData = {
        objet: 'Test Workflow Complet GM',
        montant_usd: 5000,
        commentaire_initial: 'Test automatique du workflow complet',
        service_id: 1
    };
    
    // Axios avec JSON pour simplifier ici car l'API accepte JSON aussi si configuré, mais requisitions.js attend req.body
    // et req.files. Simulons un envoi JSON standard car le backend lit req.body.
    
    const response = await axios.post(`${API_URL}/requisitions`, formData, {
      headers: { Authorization: `Bearer ${token}` }
    });
    
    console.log(`✅ Réquisition créée: ${response.data.numero} (ID: ${response.data.requisitionId})`);
    return response.data.requisitionId;
  } catch (error) {
    console.error('❌ Erreur création:', error.response ? error.response.data : error.message);
    throw error;
  }
}

async function validateStep(reqId, role, action = 'valider', comment = 'Validé par test script') {
  try {
    console.log(`🔄 Action '${action}' par ${role} sur REQ #${reqId}...`);
    const token = tokens[role];
    
    const response = await axios.put(`${API_URL}/requisitions/${reqId}/action`, {
      action,
      commentaire: comment
    }, {
      headers: { Authorization: `Bearer ${token}` }
    });
    
    console.log(`✅ Action réussie. Nouveau niveau: ${response.data.niveauApres}`);
    return response.data;
  } catch (error) {
    console.error(`❌ Erreur action ${role}:`, error.response ? error.response.data : error.message);
    throw error;
  }
}

async function runTest() {
  try {
    // 1. Connexions
    await login('emetteur');
    await login('analyste');
    await login('challenger');
    await login('validateur');
    await login('gm');
    await login('comptable'); // Pour vérifier si le paiement est dispo

    // 2. Création
    const reqId = await createRequisition();

    // 3. Workflow
    // Émetteur -> Analyste (auto ou manuel ? Dans le code actuel, niveau initial = 'emetteur', mais visible par analyste)
    // Analyste valide -> Challenger
    await validateStep(reqId, 'analyste');

    // Challenger valide -> Validateur
    await validateStep(reqId, 'challenger');

    // Validateur valide -> GM
    await validateStep(reqId, 'validateur');

    // GM valide -> Paiement
    await validateStep(reqId, 'gm');

    console.log('🎉 Workflow complet testé avec succès !');

  } catch (error) {
    console.error('💥 Test échoué.');
  }
}

runTest();
