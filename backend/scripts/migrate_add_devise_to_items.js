const { dbUtils, dbReady } = require('../database/database');

(async () => {
  try {
    await dbReady;
    console.log('Database connected.');
    
    console.log('Adding devise column to lignes_requisition...');
    
    // Add column if not exists
    // SQLite/Postgres 'ADD COLUMN IF NOT EXISTS' syntax differs slightly or is supported.
    // Postgres supports IF NOT EXISTS in ADD COLUMN since v9.6.
    // SQLite supports ADD COLUMN but not IF NOT EXISTS in the same way (it throws if exists).
    
    try {
        await dbUtils.run("ALTER TABLE lignes_requisition ADD COLUMN devise VARCHAR(10) DEFAULT 'USD'");
        console.log('Column devise added successfully.');
    } catch (err) {
        if (err.message.includes('duplicate column') || err.message.includes('already exists')) {
            console.log('Column devise already exists.');
        } else {
            throw err;
        }
    }
    
    console.log('Migration completed.');
    process.exit(0);
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  }
})();
