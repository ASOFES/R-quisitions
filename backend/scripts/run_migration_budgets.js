const dbModule = require('../database/database');
const fs = require('fs');
const path = require('path');

(async () => {
    try {
        console.log('Waiting for database connection...');
        await dbModule.dbReady;
        console.log('Database connected.');

        // Get the db instance after it's ready
        const db = dbModule.db;

        const sqlPath = path.join(__dirname, '../database/migrations/create_budgets_table.sql');
        let sql = fs.readFileSync(sqlPath, 'utf8');

        console.log('Running migration...');
        
        // Check if db is sqlite or postgres wrapper
        // dbInstance in database.js is either sqlite3.Database or pg.Pool
        // We can check if it has 'exec' (sqlite) or 'query' (pg)
        
        if (typeof db.exec === 'function') {
            // SQLite
            db.exec(sql, (err) => {
                if (err) {
                    console.error('Migration failed:', err);
                    process.exit(1);
                } else {
                    console.log('Migration successful!');
                    process.exit(0);
                }
            });
        } else {
            // Postgres
            // Replace SQLite specific syntax with Postgres syntax
            sql = sql.replace('INTEGER PRIMARY KEY AUTOINCREMENT', 'SERIAL PRIMARY KEY');
            sql = sql.replace(/DATETIME/g, 'TIMESTAMP');
            
            await db.query(sql);
            console.log('Migration successful!');
            process.exit(0);
        }

    } catch (error) {
        console.error('Error:', error);
        process.exit(1);
    }
})();
