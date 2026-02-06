const { dbUtils, dbReady } = require('./database/database');

async function resetDatabase() {
  try {
    await dbReady;
    console.log('🔄 Démarrage du nettoyage complet de la base de données...');

    // Ordre important pour respecter les contraintes de clés étrangères (Foreign Keys)
    // On supprime d'abord les enfants, puis les parents.
    const tablesToClear = [
      'paiements',
      'mouvements_fonds',
      'requisition_actions',
      'messages',
      'pieces_jointes',
      'lignes_requisition',
      'requisitions', 
      'bordereaux'
    ];
    
    // Tables optionnelles (anciennes ou futures)
    const optionalTables = ['requisition_analyses', 'notifications'];

    for (const table of tablesToClear) {
      try {
        console.log(`🗑️ Nettoyage de la table ${table}...`);
        await dbUtils.run(`DELETE FROM ${table}`);
      } catch (e) {
        console.warn(`⚠️ Erreur lors du nettoyage de ${table}: ${e.message}`);
      }
    }

    for (const table of optionalTables) {
       try {
        await dbUtils.run(`DELETE FROM ${table}`);
        console.log(`🗑️ Nettoyage de la table ${table}...`);
       } catch (e) {
         // Ignorer silencieusement si la table n'existe pas
       }
    }

    // Réinitialiser les séquences (si possible, pour PostgreSQL)
    // Note: Ceci est spécifique à Postgres. Pour SQLite, c'est différent.
    // On essaie de le faire de manière générique ou on ignore si ça échoue.
    if (process.env.DATABASE_URL) {
        console.log('🔢 Réinitialisation des séquences (PostgreSQL)...');
        const sequences = [
            'requisitions_id_seq', 
            'requisition_actions_id_seq', 
            'paiements_id_seq',
            'bordereaux_id_seq',
            'lignes_requisition_id_seq',
            'messages_id_seq',
            'pieces_jointes_id_seq',
            'mouvements_fonds_id_seq'
        ];
        for (const seq of sequences) {
            try {
                await dbUtils.run(`ALTER SEQUENCE ${seq} RESTART WITH 1`);
            } catch (e) {
                // Peut échouer si la séquence porte un autre nom
            }
        }
    }

    // Réinitialiser les Fonds aux valeurs par défaut
    console.log('💰 Réinitialisation des fonds...');
    try {
        await dbUtils.run("UPDATE fonds SET montant_disponible = 10000.00, updated_at = CURRENT_TIMESTAMP WHERE devise = 'USD'");
        await dbUtils.run("UPDATE fonds SET montant_disponible = 25000000.00, updated_at = CURRENT_TIMESTAMP WHERE devise = 'CDF'");
    } catch (e) {
        console.warn('⚠️ Impossible de réinitialiser les fonds:', e.message);
    }

    console.log('✅ Base de données nettoyée avec succès.');
    console.log('🚀 Prêt pour le test complet !');
    process.exit(0);

  } catch (error) {
    console.error('❌ Erreur fatale:', error);
    process.exit(1);
  }
}

resetDatabase();
