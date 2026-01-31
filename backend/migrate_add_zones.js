const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, 'database', 'requisition.db');
const db = new sqlite3.Database(dbPath);

db.serialize(() => {
  console.log('Début de la migration...');

  // Création de la table zones
  db.run(`CREATE TABLE IF NOT EXISTS zones (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    code VARCHAR(10) UNIQUE NOT NULL,
    nom VARCHAR(100) NOT NULL,
    description TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`, (err) => {
    if (err) {
      console.error('Erreur lors de la création de la table zones:', err.message);
    } else {
      console.log('Table zones créée avec succès.');
    }
  });

  // Ajout de la colonne zone_id à la table users
  // SQLite ne supporte pas IF NOT EXISTS pour ADD COLUMN, donc on vérifie d'abord ou on ignore l'erreur
  db.run(`ALTER TABLE users ADD COLUMN zone_id INTEGER REFERENCES zones(id)`, (err) => {
    if (err) {
      if (err.message.includes('duplicate column name')) {
        console.log('La colonne zone_id existe déjà dans la table users.');
      } else {
        console.error('Erreur lors de l\'ajout de la colonne zone_id:', err.message);
      }
    } else {
      console.log('Colonne zone_id ajoutée à la table users.');
    }
  });

  // Insertion de quelques zones par défaut si la table est vide
  db.get("SELECT count(*) as count FROM zones", (err, row) => {
    if (!err && row.count === 0) {
      const stmt = db.prepare("INSERT INTO zones (code, nom, description) VALUES (?, ?, ?)");
      stmt.run("KIN", "Kinshasa", "Zone de Kinshasa");
      stmt.run("LUB", "Lubumbashi", "Zone de Lubumbashi");
      stmt.run("GOM", "Goma", "Zone de Goma");
      stmt.finalize();
      console.log('Zones par défaut insérées.');
    }
  });
});

db.close((err) => {
  if (err) {
    console.error('Erreur lors de la fermeture de la base de données:', err.message);
  } else {
    console.log('Migration terminée.');
  }
});
