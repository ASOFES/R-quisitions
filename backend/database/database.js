const sqlite3 = require('sqlite3').verbose();
const { Pool, types } = require('pg');
const path = require('path');
const fs = require('fs');
const dns = require('dns');

// Force IPv4 for Supabase connection issues on Node 17+ (Render uses Node 20+)
if (dns.setDefaultResultOrder) {
  dns.setDefaultResultOrder('ipv4first');
}

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
  
  (async () => {
    let poolConfig = {
      connectionString: process.env.DATABASE_URL,
      ssl: { rejectUnauthorized: false }, // Force SSL for Render/Cloud
      connectionTimeoutMillis: 10000 // Timeout après 10s
    };

    // FIX SUPABASE RENDER IPV6 ISSUE
    // Supabase Pooler (port 6543) seems to have DNS/IPv6 issues on Render.
    // We will try to resolve the DIRECT connection (port 5432) hostname which usually supports IPv4 better,
    // OR resolve the current hostname to IPv4.
    
    try {
      const { URL } = require('url');
      const parsedUrl = new URL(process.env.DATABASE_URL);
      let hostname = parsedUrl.hostname;

      // Check if we are using the pooler (Supabase usually uses aws-0-Region.pooler.supabase.com aliases)
      // Or just standard db.project.supabase.co
      
      console.log(`🔍 Analyse de connexion pour: ${hostname}`);

      if (!hostname.match(/^(\d{1,3}\.){3}\d{1,3}$/)) { // If not already an IP
          
          let ip = null;
          
          // Méthode 1: dns.lookup (Système / getaddrinfo)
          try {
            console.log(`🔍 Tentative résolution système (IPv4) pour ${hostname}...`);
            ip = await new Promise((resolve, reject) => {
              dns.lookup(hostname, { family: 4 }, (err, address) => {
                if (err) reject(err);
                else resolve(address);
              });
            });
            console.log(`✅ Résolution système (IPv4): ${ip}`);
          } catch (e) {
            console.warn(`⚠️ Echec lookup système: ${e.message}`);
          }

          // Méthode 2: Google DNS (si système échoue)
          if (!ip) {
             console.log('🔄 Tentative avec Google DNS (8.8.8.8)...');
             try {
               dns.setServers(['8.8.8.8', '8.8.4.4']);
               const addresses = await dns.promises.resolve4(hostname);
               if (addresses && addresses.length > 0) {
                 ip = addresses[0];
                 console.log(`✅ Résolution Google DNS (IPv4): ${ip}`);
               }
             } catch (e) {
               console.warn(`⚠️ Echec Google DNS: ${e.message}`);
             }
          }

          if (ip) {
            // Important: On utilise l'IP pour la connexion
            poolConfig.host = ip;
            // On garde le hostname original pour le SNI (SSL)
            poolConfig.ssl.servername = hostname;
            console.log('✅ Configuration connexion: Host IP + SNI Hostname appliqué.');
          } else {
            console.error('❌ AUCUNE adresse IPv4 trouvée pour le hostname actuel.');
            
            if (hostname.includes('supabase.co')) {
               console.error(`\n💡 CONSEIL SUPABASE: L'adresse ${hostname} semble être uniquement IPv6.`);
               console.error(`👉 Utilisez l'URL du "Connection Pooler" (Mode Session) qui supporte IPv4.`);
               console.error(`   Format: postgres://[user]:[pass]@aws-0-[region].pooler.supabase.com:5432/[db]\n`);
            }
          }
      }
    } catch (e) {
      console.warn(`⚠️ Erreur logique DNS: ${e.message}. Utilisation configuration par défaut.`);
    }

    dbInstance = new Pool(poolConfig);
    
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
  })();

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
                    const migrations = [
                        'ALTER TABLE requisitions ALTER COLUMN numero TYPE VARCHAR(50)',
                        'ALTER TABLE requisitions ADD COLUMN IF NOT EXISTS related_to INTEGER',
                        'ALTER TABLE requisitions ADD COLUMN IF NOT EXISTS niveau_retour VARCHAR(20)',
                        'ALTER TABLE requisitions ADD COLUMN IF NOT EXISTS site_id INTEGER REFERENCES sites(id)',
                        'ALTER TABLE requisitions ADD COLUMN IF NOT EXISTS mode_paiement VARCHAR(20)',
                        'ALTER TABLE requisitions ADD COLUMN IF NOT EXISTS budget_impacted BOOLEAN DEFAULT FALSE',
                        'ALTER TABLE users ADD COLUMN IF NOT EXISTS zone_id INTEGER REFERENCES zones(id)',
                        'ALTER TABLE lignes_requisition ADD COLUMN IF NOT EXISTS site_id INTEGER REFERENCES sites(id)',
                        'CREATE TABLE IF NOT EXISTS app_settings (key VARCHAR(50) PRIMARY KEY, value TEXT, description TEXT, updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)',
                        "INSERT INTO app_settings (key, value, description) VALUES ('exchange_rate', '2800', 'Taux de change USD/CDF') ON CONFLICT DO NOTHING",
                        'ALTER TABLE budgets ADD COLUMN IF NOT EXISTS service_id INTEGER REFERENCES services(id)',
                        'ALTER TABLE budgets ADD CONSTRAINT unique_budget_service_mois UNIQUE (description, service_id, mois)',
                        'ALTER TABLE budgets ADD COLUMN IF NOT EXISTS is_manual BOOLEAN DEFAULT FALSE',
                        'ALTER TABLE users ADD COLUMN IF NOT EXISTS signature_url VARCHAR(255)'
                    ];

                    // Exécuter les migrations en séquence
                    (async () => {
                        for (const migration of migrations) {
                            try {
                                await new Promise((res, rej) => {
                                    dbInstance.query(migration, (err) => {
                                        if (err) {
                                            // Ignorer les erreurs "column already exists" si IF NOT EXISTS n'est pas supporté (vieux PG)
                                            if (err.code === '42701') { // duplicate_column
                                                // console.log('Note: Colonne existe déjà');
                                            } else {
                                                console.log(`Note migration PG (${migration}):`, err.message);
                                            }
                                        }
                                        res();
                                    });
                                });
                            } catch (e) {
                                console.error('Erreur migration:', e);
                            }
                        }
                        console.log('✅ Migrations PostgreSQL terminées.');
                        resolve();
                    })();
                    
                    return; // Resolve is called inside async block
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
        'ALTER TABLE requisitions ADD COLUMN site_id INTEGER REFERENCES sites(id)',
        'ALTER TABLE requisitions ADD COLUMN mode_paiement VARCHAR(20)',
        'ALTER TABLE requisitions ADD COLUMN budget_impacted BOOLEAN DEFAULT 0',
        'ALTER TABLE budgets ADD COLUMN is_manual BOOLEAN DEFAULT 0',
        'ALTER TABLE users ADD COLUMN signature_url VARCHAR(255)'
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
        )`,
        `CREATE TABLE IF NOT EXISTS app_settings (
          key VARCHAR(50) PRIMARY KEY,
          value TEXT,
          description TEXT,
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

        // Adaptation syntaxe SQLite -> PostgreSQL pour les Upserts
        if (pgQuery.toUpperCase().includes('INSERT OR REPLACE')) {
            // INSERT OR REPLACE INTO table (pk, cols) VALUES (...)
            // -> INSERT INTO table (pk, cols) VALUES (...) ON CONFLICT (pk) DO UPDATE SET cols = EXCLUDED.cols
            pgQuery = pgQuery.replace(/INSERT OR REPLACE INTO (\w+) \((.*?)\) VALUES \((.*?)\)/i, (match, table, cols, vals) => {
                const colArray = cols.split(',').map(c => c.trim());
                const firstCol = colArray[0];
                const updateSet = colArray.slice(1).map(c => `${c} = EXCLUDED.${c}`).join(', ');
                return `INSERT INTO ${table} (${cols}) VALUES (${vals}) ON CONFLICT (${firstCol}) DO UPDATE SET ${updateSet}`;
            });
        }
        
        if (pgQuery.toUpperCase().includes('INSERT OR IGNORE')) {
            pgQuery = pgQuery.replace(/INSERT OR IGNORE INTO/i, 'INSERT INTO');
            pgQuery += ' ON CONFLICT DO NOTHING';
        }
        
        // Auto-inject RETURNING id pour les INSERT si absent (et si pas déjà géré par ON CONFLICT)
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

/**
 * Initialise les paramètres par défaut (taux de change, niveaux de workflow)
 */
async function initializeDefaultSettings() {
    try {
        // Taux de change par défaut
        await dbUtils.run("INSERT OR IGNORE INTO app_settings (key, value, description) VALUES ('exchange_rate', '2800', 'Taux de change USD/CDF')");
        
        // Niveaux de workflow par défaut pour l'auto-validation
        const defaultLevels = [
            'emetteur', 'approbation_service', 'analyste', 'challenger', 
            'validateur', 'gm', 'compilation', 'validation_bordereau'
        ];
        
        for (const level of defaultLevels) {
            await dbUtils.run("INSERT OR IGNORE INTO workflow_settings (niveau, delai_minutes) VALUES (?, 0)", [level]);
        }
        
        console.log('✅ Paramètres par défaut initialisés.');
    } catch (err) {
        console.error('⚠️ Erreur initialisation paramètres par défaut:', err.message);
    }
}

// Lancement de l'initialisation des paramètres une fois que dbReady est résolu
dbReady.then(() => {
    initializeDefaultSettings();
});

module.exports = { 
  get db() { return dbInstance; }, 
  dbUtils, 
  dbReady 
};
