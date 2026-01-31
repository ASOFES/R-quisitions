const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.resolve(__dirname, 'database/requisition.db');
const db = new sqlite3.Database(dbPath);

db.serialize(() => {
    console.log('Checking for related_to column in requisitions table...');
    
    db.run("ALTER TABLE requisitions ADD COLUMN related_to INTEGER", (err) => {
        if (err) {
            if (err.message.includes('duplicate column name')) {
                console.log('Column related_to already exists.');
            } else {
                console.error('Error adding column:', err.message);
            }
        } else {
            console.log('Column related_to added successfully.');
        }
    });
});

db.close();
