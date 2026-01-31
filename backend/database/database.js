const sqlite3 = require('sqlite3').verbose();
const { Pool, types } = require('pg');
const path = require('path');
const fs = require('fs');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

// Force timestamps to be returned as strings (compatibility with SQLite behavior)
// This prevents frontend crashes when switching from SQLite (strings) to Postgres (Date objects)
types.setTypeParser(1114, str => str); // TIMESTAMP
types.setTypeParser(1184, str => str); // TIMESTAMPTZ

const isPostgres = !!process.env.DATABASE_URL;
let dbInstance;
let dbReadyResolve;
let dbReadyReject;
const dbReady = new Promise((resolve, reject) => {
  dbReadyResolve = resolve;
  dbReadyReject = reject;
});

if (isPostgres) {
  console.log('🔄 Initialisation mode PostgreSQL...');
  dbInstance = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }, // Force SSL for Render/Cloud
    connectionTimeoutMillis: 10000 // Timeout après 10s
  });
  
  // Test connection and Init
  dbInstance.connect((err, client, release) => {
    if (err) {
      console.error('❌ Erreur connexion PostgreSQL:', err.message);
      if (dbReadyReject) dbReadyReject(err);
    } else {
      console.log('✅ Connecté à PostgreSQL.');
      initializeDatabasePostgres().then(() => {
        if (release) release();
        if (dbReadyResolve) dbReadyResolve();
      }).catch(err => {
        if (release) release();
        if (dbReadyReject) dbReadyReject(err);
      });
    }
  });

} else {
  console.log('🔄 Initialisation mode SQLite...');
  const dbPath = path.join(__dirname, 'requisition.db');
  
  // Créer le répertoire database s'il n'existe pas
  const dbDir = path.dirname(dbPath);
  if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
  }

  // Créer la connexion à la base de données
  dbInstance = new sqlite3.Database(dbPath, (err) => {
    if (err) {
      console.error('❌ Erreur de connexion à la base de données SQLite:', err.message);
    } else {
      console.log('✅ Connecté à la base de données SQLite.');
      // Créer les tables si elles n'existent pas
      initializeDatabaseSqlite();
      if (dbReadyResolve) dbReadyResolve();
    }
  });
}

// Initialiser la base de données PostgreSQL
function initializeDatabasePostgres() {
    return new Promise((resolve) => {
        const initSqlPath = path.join(__dirname, 'init_postgres.sql');
        if (fs.existsSync(initSqlPath)) {
            const initSql = fs.readFileSync(initSqlPath, 'utf8');
            dbInstance.query(initSql, (err) => {
                if (err) console.error('❌ Erreur lors de l\'initialisation PostgreSQL:', err.message);
                else {
                    console.log('✅ Schéma PostgreSQL vérifié/initialisé.');
                    // Migration pour augmenter la taille de la colonne numero si nécessaire
                    dbInstance.query('ALTER TABLE requisitions ALTER COLUMN numero TYPE VARCHAR(50)', (alterErr) => {
                        if (alterErr) {
                           // Ignorer si l'erreur est liée au fait que c'est déjà fait ou autre, mais logger
                           console.log('Note: Vérification/Ajustement de la colonne numero (VARCHAR 50) -', alterErr.message);
                        } else {
                           console.log('✅ Colonne numero ajustée à VARCHAR(50).');
                        }
                        resolve();
                    });
                    return; // Resolve is called inside callback
                }
                resolve();
            });
        } else {
            resolve();
        }
    });
}

// Initialiser la base de données SQLite (Code original préservé et encapsulé)
function initializeDatabaseSqlite() {
  const initSqlPath = path.join(__dirname, 'init.sql');
  
  if (fs.existsSync(initSqlPath)) {
    const initSql = fs.readFileSync(initSqlPath, 'utf8');
    
    dbInstance.exec(initSql, (err) => {
      if (err) {
        console.error('❌ Erreur lors de l\'initialisation SQLite:', err.message);
      } else {
        console.log('✅ Base de données SQLite initialisée.');
        // Migrations complémentaires simples (Code legacy préservé)
        runSqliteMigrations();
      }
    });
  }
}

function runSqliteMigrations() {
    const migrations = [
        'ALTER TABLE requisitions ADD COLUMN related_to INTEGER',
        'ALTER TABLE users ADD COLUMN zone_id INTEGER REFERENCES zones(id)',
        'ALTER TABLE requisitions ADD COLUMN niveau_retour VARCHAR(20)',
        'ALTER TABLE requisitions ADD COLUMN site_id INTEGER REFERENCES sites(id)'
    ];

    migrations.forEach(migration => {
        dbInstance.run(migration, (alterErr) => {
             // Ignorer les erreurs de colonnes dupliquées
             if (alterErr && !alterErr.message.includes('duplicate column name')) {
                 // console.error('Migration info:', alterErr.message);
             }
        });
    });
    
    // Créations de tables manquantes si init.sql ancien (Code legacy)
    const extraTables = [
        `CREATE TABLE IF NOT EXISTS sites (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          nom VARCHAR(100) NOT NULL,
          localisation VARCHAR(100),
          description TEXT,
          actif BOOLEAN DEFAULT 1,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )`,
        `CREATE TABLE IF NOT EXISTS lignes_requisition (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          requisition_id INTEGER NOT NULL,
          description TEXT NOT NULL,
          quantite DECIMAL(10,2) NOT NULL DEFAULT 1,
          prix_unitaire DECIMAL(15,2) NOT NULL,
          prix_total DECIMAL(15,2) NOT NULL,
          site_id INTEGER,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (requisition_id) REFERENCES requisitions(id),
          FOREIGN KEY (site_id) REFERENCES sites(id)
        )`,
        `CREATE TABLE IF NOT EXISTS workflow_settings (
          niveau VARCHAR(50) PRIMARY KEY,
          delai_minutes INTEGER DEFAULT 0,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )`
    ];

    extraTables.forEach(tableSql => {
        dbInstance.run(tableSql, () => {});
    });
    
    // Default zones
    dbInstance.get('SELECT count(*) as count FROM zones', [], (err, row) => {
        if (!err && row && row.count === 0) {
            const stmt = dbInstance.prepare('INSERT INTO zones (code, nom, description) VALUES (?, ?, ?)');
            stmt.run('KIN', 'Kinshasa', 'Zone de Kinshasa');
            stmt.run('LUB', 'Lubumbashi', 'Zone de Lubumbashi');
            stmt.run('GOM', 'Goma', 'Zone de Goma');
            stmt.finalize();
            console.log('Zones par défaut insérées.');
        }
    });
}

// Fonctions utilitaires unifiées (Adapter Pattern)
const dbUtils = {
  // Exécuter une requête avec paramètres
  run: (query, params = []) => {
    return new Promise((resolve, reject) => {
      if (isPostgres) {
        // Adaptation PostgreSQL
        let paramCount = 1;
        // Remplacer ? par $1, $2, etc.
        let pgQuery = query.replace(/\?/g, () => `$${paramCount++}`);
        
        // Auto-inject RETURNING id pour les INSERT si absent
        if (pgQuery.trim().toUpperCase().startsWith('INSERT') && !pgQuery.toUpperCase().includes('RETURNING')) {
             pgQuery += ' RETURNING id';
        }

        dbInstance.query(pgQuery, params, (err, res) => {
          if (err) return reject(err);
          // rowCount est standard, rows contient le retour
          const id = (res.rows && res.rows.length > 0) ? res.rows[0].id : null;
          resolve({ id: id, changes: res.rowCount });
        });
      } else {
        // SQLite
        dbInstance.run(query, params, function(err) {
          if (err) {
            reject(err);
          } else {
            resolve({ id: this.lastID, changes: this.changes });
          }
        });
      }
    });
  },

  // Obtenir une seule ligne
  get: (query, params = []) => {
    return new Promise((resolve, reject) => {
      if (isPostgres) {
        let paramCount = 1;
        let pgQuery = query.replace(/\?/g, () => `$${paramCount++}`);
        
        // Adaptation strftime -> to_char
        // Ex: strftime("%Y-%m", created_at) -> to_char(created_at, 'YYYY-MM')
        if (pgQuery.includes('strftime')) {
            pgQuery = pgQuery.replace(/strftime\("%Y-%m",\s*([a-zA-Z0-9_.]+)\)/g, "to_char($1, 'YYYY-MM')");
        }

        dbInstance.query(pgQuery, params, (err, res) => {
          if (err) return reject(err);
          resolve(res.rows[0]);
        });
      } else {
        dbInstance.get(query, params, (err, row) => {
          if (err) {
            reject(err);
          } else {
            resolve(row);
          }
        });
      }
    });
  },

  // Obtenir plusieurs lignes
  all: (query, params = []) => {
    return new Promise((resolve, reject) => {
      if (isPostgres) {
        let paramCount = 1;
        let pgQuery = query.replace(/\?/g, () => `$${paramCount++}`);
        
        // Adaptation strftime -> to_char (si présent dans WHERE ou SELECT)
        if (pgQuery.includes('strftime')) {
            pgQuery = pgQuery.replace(/strftime\("%Y-%m",\s*([a-zA-Z0-9_.]+)\)/g, "to_char($1, 'YYYY-MM')");
        }

        dbInstance.query(pgQuery, params, (err, res) => {
          if (err) return reject(err);
          resolve(res.rows);
        });
      } else {
        dbInstance.all(query, params, (err, rows) => {
          if (err) {
            reject(err);
          } else {
            resolve(rows);
          }
        });
      }
    });
  }
};

module.exports = { db: dbInstance, dbUtils, dbReady };
