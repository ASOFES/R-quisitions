const { dbUtils } = require('./database/database');

async function checkData() {
    try {
        console.log('🔍 Vérification des données...');
        
        // Check Services
        const services = await dbUtils.all('SELECT * FROM services');
        console.log(`📋 Services (${services.length}):`, services);

        // Check Users
        const users = await dbUtils.all('SELECT id, username, role, service_id FROM users');
        console.log(`👤 Utilisateurs (${users.length}):`, users);

        // Check Zones
        const zones = await dbUtils.all('SELECT * FROM zones');
        console.log(`🌍 Zones (${zones.length}):`, zones);

    } catch (error) {
        console.error('❌ Erreur:', error);
    }
}

// Add a small delay to allow DB connection to establish
setTimeout(checkData, 1000);
