const { dbUtils, dbReady } = require('./database/database');

async function debugBudgets() {
    await dbReady;
    try {
        console.log("Querying information_schema for public.budgets...");
        const cols = await dbUtils.all("SELECT column_name FROM information_schema.columns WHERE table_name = 'budgets' AND table_schema = 'public'");
        console.log("Columns:", cols.map(c => c.column_name));
        
    } catch (e) {
        console.error("Error:", e);
    }
    process.exit(0);
}

debugBudgets();
