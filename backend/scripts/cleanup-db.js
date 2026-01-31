const path = require('path');
const fs = require('fs');
const { dbUtils } = require('../database/database');

async function cleanupDatabase() {
  console.log('--- Nettoyage de la base de données (hors utilisateurs) ---');
  try {
    await dbUtils.run('BEGIN TRANSACTION');

    // Supprimer les pièces jointes physiques
    const uploadsDir = path.join(__dirname, '../uploads');
    try {
      if (fs.existsSync(uploadsDir)) {
        const files = fs.readdirSync(uploadsDir);
        for (const file of files) {
          const full = path.join(uploadsDir, file);
          try {
            fs.unlinkSync(full);
          } catch (e) {
            // ignore file delete errors
          }
        }
        console.log(`Supprimé ${files.length} fichier(s) dans uploads/`);
      }
    } catch (e) {
      console.log('Erreur suppression fichiers uploads:', e.message);
    }

    // Ordre des suppressions (tables enfants avant les parents)
    const deletes = [
      'DELETE FROM pieces_jointes',
      'DELETE FROM lignes_requisition',
      'DELETE FROM requisition_actions',
      'DELETE FROM messages',
      'DELETE FROM paiements',
      'DELETE FROM mouvements_fonds',
      'DELETE FROM requisitions'
    ];

    for (const q of deletes) {
      await dbUtils.run(q);
    }

    // Réinitialiser les fonds aux valeurs initiales
    await dbUtils.run('UPDATE fonds SET montant_disponible = CASE WHEN devise = "USD" THEN 10000.00 WHEN devise = "CDF" THEN 25000000.00 ELSE 0 END');

    await dbUtils.run('COMMIT');
    console.log('Nettoyage terminé avec succès.');
  } catch (error) {
    try { await dbUtils.run('ROLLBACK'); } catch (_) {}
    console.error('Erreur pendant le nettoyage:', error.message);
    process.exitCode = 1;
  }
}

cleanupDatabase();
