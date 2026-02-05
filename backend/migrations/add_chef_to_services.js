const { dbUtils, dbReady } = require('../database/database');

async function migrate() {
  try {
    console.log('Waiting for database connection...');
    await dbReady;
    console.log('✅ Database connected.');
    
    console.log('Adding chef_id to services table...');
    
    try {
        await dbUtils.run('ALTER TABLE services ADD COLUMN chef_id INTEGER REFERENCES users(id)');
        console.log('✅ Column chef_id added successfully.');
    } catch (err) {
        if (err.message && (err.message.includes('duplicate column') || err.message.includes('already exists'))) {
            console.log('ℹ️ Column chef_id already exists.');
        } else {
            console.warn('⚠️ Warning (might already exist):', err.message);
        }
    }
    
    console.log('Migration completed.');
    process.exit(0);
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  }
}

migrate();
