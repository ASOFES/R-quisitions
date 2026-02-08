const { dbUtils, dbReady } = require('./database/database');

async function debugUsers() {
    await dbReady;
    try {
        console.log("Querying public.users...");
        const user = await dbUtils.get("SELECT * FROM public.users LIMIT 1");
        console.log("User keys:", user ? Object.keys(user) : "No user found");
        
        console.log("Querying information_schema for public.users...");
        const cols = await dbUtils.all("SELECT column_name FROM information_schema.columns WHERE table_name = 'users' AND table_schema = 'public'");
        console.log("Columns:", cols.map(c => c.column_name));
        
    } catch (e) {
        console.error("Error:", e);
    }
    process.exit(0);
}

debugUsers();
