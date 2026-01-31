const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, 'database', 'requisition.db');
const db = new sqlite3.Database(dbPath);

db.all('SELECT id, username, role, actif FROM users', [], (err, rows) => {
    if (err) {
        console.error('Error:', err);
        return;
    }
    console.log('Users found:', rows);
    db.close();
});
