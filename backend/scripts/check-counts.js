const { dbUtils, dbReady } = require('../database/database');

async function main() {
  await dbReady;
  const tables = [
    'requisitions',
    'lignes_requisition',
    'requisition_actions',
    'messages',
    'pieces_jointes',
    'paiements',
    'mouvements_fonds'
  ];
  for (const t of tables) {
    const r = await dbUtils.get(`SELECT COUNT(*) as c FROM ${t}`);
    console.log(`${t}: ${r.c}`);
  }
  const usd = await dbUtils.get("SELECT montant_disponible as m FROM fonds WHERE devise='USD'");
  const cdf = await dbUtils.get("SELECT montant_disponible as m FROM fonds WHERE devise='CDF'");
  console.log(`fonds USD: ${usd.m} | CDF: ${cdf.m}`);
  process.exit(0);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
