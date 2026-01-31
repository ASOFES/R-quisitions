const sqlite3 = require('sqlite3').verbose();
const path = require('path');

// Chemin vers la base de données
const dbPath = path.join(__dirname, 'database', 'requisition.db');

// Connexion à la base de données
const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('Erreur de connexion à la base de données:', err.message);
    process.exit(1);
  }
  console.log('Connecté à la base de données SQLite.');
});

// Fonction pour effacer toutes les données liées aux réquisitions
const clearAllData = () => {
  console.log('Nettoyage complet des données de workflow...');
  
  db.serialize(() => {
    // 1. Effacer les actions (historique)
    db.run('DELETE FROM requisition_actions', function(err) {
      if (err) console.error('Erreur actions:', err.message);
      else console.log(`✅ ${this.changes} actions effacées.`);
    });

    // 2. Effacer les analyses
    db.run('DELETE FROM requisition_analyses', function(err) {
      if (err) console.error('Erreur analyses:', err.message);
      else console.log(`✅ ${this.changes} analyses effacées.`);
    });

    // 3. Effacer les pièces jointes
    db.run('DELETE FROM pieces_jointes', function(err) {
      if (err) console.error('Erreur pièces jointes:', err.message);
      else console.log(`✅ ${this.changes} pièces jointes effacées.`);
    });

    // 4. Effacer les réquisitions
    db.run('DELETE FROM requisitions', function(err) {
      if (err) console.error('Erreur réquisitions:', err.message);
      else console.log(`✅ ${this.changes} réquisitions effacées.`);
    });

    // 5. Réinitialiser les séquences (pour que les ID recommencent à 1)
    const tables = ['requisitions', 'requisition_actions', 'requisition_analyses', 'pieces_jointes'];
    tables.forEach(table => {
      db.run('DELETE FROM sqlite_sequence WHERE name = ?', [table], (err) => {
        if (!err) console.log(`✅ Séquence réinitialisée pour ${table}.`);
      });
    });

    // Fin
    db.close((err) => {
      if (err) {
        console.error('Erreur fermeture:', err.message);
      } else {
        console.log('✅ Base de données nettoyée avec succès.');
        console.log('🚀 Prêt pour un nouveau cycle de workflow !');
      }
    });
  });
};

// Exécuter la fonction
clearAllData();
