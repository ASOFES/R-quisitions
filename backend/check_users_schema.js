const { dbUtils, dbReady } = require('./database/database');

async function checkSchema() {
    await dbReady;
    try {
        console.log("Checking users table schema...");
        const result = await dbUtils.all(
            "SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'users'"
        );
        console.log(result);
    } catch (e) {
        console.error(e);
    }
    process.exit(0);
}

checkSchema();
