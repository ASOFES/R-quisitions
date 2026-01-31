
const fs = require('fs');
const path = require('path');

const API_URL = process.env.API_URL || 'http://localhost:5000/api';

// Utilisateur Emetteur
const user = { username: 'edla.m', password: 'password' };

async function login() {
  console.log(`🔐 Connexion de ${user.username}...`);
  const response = await fetch(`${API_URL}/auth/login-simple`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(user)
  });
  
  if (!response.ok) {
    const err = await response.json();
    throw new Error(`Login failed: ${JSON.stringify(err)}`);
  }
  
  const data = await response.json();
  console.log(`✅ Connecté. Token reçu.`);
  return data.token;
}

async function createRequisition(token) {
  console.log('📝 Simulation Frontend: Création réquisition avec FormData...');

  const formData = new FormData();
  
  // 1. Champs texte de base
  formData.append('objet', 'Test Frontend Simulation ' + Date.now());
  formData.append('montant_usd', '150.00');
  formData.append('commentaire_initial', 'Ceci est un test simulant le frontend avec FormData et fichiers.');
  formData.append('service_id', '1'); // Supposons service ID 1
  
  // 2. Items (JSON String)
  const items = [
    {
      description: 'Item 1 simulation',
      quantite: 2,
      prix_unitaire: 50,
      total: 100,
      site_id: null
    },
    {
      description: 'Item 2 simulation',
      quantite: 1,
      prix_unitaire: 50,
      total: 50,
      site_id: null
    }
  ];
  formData.append('items', JSON.stringify(items));
  
  // 3. Fichier joint (Simulation)
  const fileContent = "Ceci est un fichier de test pour la réquisition.";
  const blob = new Blob([fileContent], { type: 'text/plain' });
  formData.append('pieces', blob, 'test-file.txt');
  
  console.log('📤 Envoi de la requête POST...');
  
  const response = await fetch(`${API_URL}/requisitions`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`
      // Ne PAS définir Content-Type, fetch le fera avec le boundary pour FormData
    },
    body: formData
  });
  
  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Erreur création: ${err}`);
  }
  
  const result = await response.json();
  console.log(`✅ Réquisition créée avec succès!`);
  console.log(`   Numéro: ${result.numero}`);
  console.log(`   ID: ${result.requisitionId}`);
  
  return result;
}

async function run() {
  try {
    const token = await login();
    await createRequisition(token);
    console.log('🎉 Test Frontend Simulation RÉUSSI');
  } catch (error) {
    console.error('❌ ECHEC du test:', error);
    process.exit(1);
  }
}

run();
