const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

const dbPath = path.join(__dirname, '../database/requisition.db');
const uploadsDir = path.join(__dirname, '../uploads');

const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        console.error('Error connecting to database:', err);
        process.exit(1);
    }
    console.log('Connected to database.');
});

const tablesToClear = [
    'lignes_requisition',
    'pieces_jointes',
    'requisition_actions',
    'requisition_analyses',
    'messages',
    'paiements',
    'mouvements_fonds',
    'requisitions'
];

async function clearData() {
    try {
        console.log('Starting cleanup...');

        // 1. Clear Tables
        await new Promise((resolve, reject) => {
            db.serialize(() => {
                db.run('BEGIN TRANSACTION');
                
                tablesToClear.forEach(table => {
                    console.log(`Clearing table: ${table}`);
                    db.run(`DELETE FROM ${table}`);
                    // Reset autoincrement
                    db.run(`DELETE FROM sqlite_sequence WHERE name='${table}'`);
                });

                db.run('COMMIT', (err) => {
                    if (err) {
                        console.error('Transaction error:', err);
                        db.run('ROLLBACK');
                        reject(err);
                    } else {
                        resolve();
                    }
                });
            });
        });

        // 2. Clear Uploads
        console.log('Clearing uploads directory...');
        if (fs.existsSync(uploadsDir)) {
            const files = fs.readdirSync(uploadsDir);
            for (const file of files) {
                if (file !== '.gitignore' && file !== 'README.md') {
                    const filePath = path.join(uploadsDir, file);
                    fs.unlinkSync(filePath);
                    console.log(`Deleted file: ${file}`);
                }
            }
        }

        console.log('Cleanup completed successfully!');
        db.close();

    } catch (error) {
        console.error('Cleanup failed:', error);
        db.close();
        process.exit(1);
    }
}

clearData();
