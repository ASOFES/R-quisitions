const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, 'database', 'requisition.db');
const db = new sqlite3.Database(dbPath);

db.serialize(() => {
    // 1. Create bordereaux table
    db.run(`
        CREATE TABLE IF NOT EXISTS bordereaux (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            numero VARCHAR(50) UNIQUE NOT NULL,
            date_creation DATETIME DEFAULT CURRENT_TIMESTAMP,
            createur_id INTEGER,
            statut VARCHAR(20) DEFAULT 'cree',
            FOREIGN KEY (createur_id) REFERENCES users(id)
        )
    `, (err) => {
        if (err) {
            console.error('Error creating bordereaux table:', err);
        } else {
            console.log('Table bordereaux created (or already exists).');
        }
    });

    // 2. Add bordereau_id to requisitions
    // We check if column exists first to avoid error (though SQLite doesn't support IF NOT EXISTS for column)
    // A simple way is to just try running it and ignore "duplicate column name" error
    db.run(`ALTER TABLE requisitions ADD COLUMN bordereau_id INTEGER REFERENCES bordereaux(id)`, (err) => {
        if (err) {
            if (err.message.includes('duplicate column name')) {
                console.log('Column bordereau_id already exists in requisitions.');
            } else {
                console.error('Error adding bordereau_id column:', err);
            }
        } else {
            console.log('Column bordereau_id added to requisitions.');
        }
    });
});

db.close();
