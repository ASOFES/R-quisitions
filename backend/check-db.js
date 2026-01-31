const { dbUtils } = require('./database/database');

async function checkLatestRequisition() {
  try {
    console.log('--- Checking Latest Requisition ---');
    
    const latestReq = await dbUtils.get('SELECT * FROM requisitions ORDER BY id DESC LIMIT 1');
    if (!latestReq) {
      console.log('No requisitions found.');
      return;
    }
    
    console.log('Latest Requisition:', latestReq);
    
    const items = await dbUtils.all('SELECT * FROM lignes_requisition WHERE requisition_id = ?', [latestReq.id]);
    console.log('Items for latest requisition:', items);
    
  } catch (error) {
    console.error('Error:', error);
  }
}

checkLatestRequisition();
