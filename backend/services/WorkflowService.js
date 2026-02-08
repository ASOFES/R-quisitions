const { dbUtils } = require('../database/database');
const BudgetService = require('./BudgetService');

const WORKFLOW_STEPS = {
  'emetteur': { valider: 'analyste', modifier: 'emetteur', refuser: 'annule' },
  'approbation_service': { valider: 'analyste', modifier: 'emetteur', refuser: 'emetteur' },
  'analyste': { valider: 'challenger', modifier: 'emetteur', refuser: 'emetteur' },
  'challenger': { valider: 'validateur', modifier: 'analyste', refuser: 'emetteur' },
  'validateur': { valider: 'gm', modifier: 'challenger', refuser: 'emetteur' },
  'pm': { valider: 'gm', modifier: 'challenger', refuser: 'emetteur' },
  'gm': { valider: 'compilation', modifier: 'validateur', refuser: 'emetteur' },
  'compilation': { valider: 'validation_bordereau', modifier: 'gm', refuser: 'gm' },
  'validation_bordereau': { valider: 'paiement', modifier: 'compilation', refuser: 'gm' },
  'comptable': { valider: 'termine', modifier: 'validation_bordereau', refuser: 'gm' },
  'paiement': { valider: 'termine', modifier: 'validation_bordereau', refuser: 'gm' }
};

class WorkflowService {
  
  // Obtenir la configuration des délais
  static async getSettings() {
    try {
      const rows = await dbUtils.all('SELECT * FROM workflow_settings');
      // Convert array to object map
      const settings = {};
      rows.forEach(row => {
        settings[row.niveau] = row.delai_minutes;
      });
      return settings;
    } catch (error) {
      console.error('Erreur getSettings:', error);
      return {};
    }
  }

  // Mettre à jour un délai
  static async updateSetting(niveau, delaiMinutes) {
    // Upsert logic (Insert or Replace)
    return dbUtils.run(
      'INSERT OR REPLACE INTO workflow_settings (niveau, delai_minutes, updated_at) VALUES (?, ?, CURRENT_TIMESTAMP)',
      [niveau, delaiMinutes]
    );
  }

  // Effectuer une transition de workflow
  static async processAction(requisitionId, action, userRole, userId, commentaire, isAuto = false, mode_paiement = null) {
    const requisition = await dbUtils.get('SELECT * FROM requisitions WHERE id = ?', [requisitionId]);
    if (!requisition) throw new Error('Réquisition non trouvée');

    // Validation de base (sauf si auto, on suppose que le système sait ce qu'il fait, mais on vérifie quand même l'état)
    if (['payee', 'refuse', 'refusee', 'termine', 'annulee'].includes(requisition.statut)) {
      throw new Error('Action impossible sur une réquisition terminée');
    }

    const currentNiveau = requisition.niveau;

    // Détermination du nouveau niveau
    let niveauApres = null;

    if (WORKFLOW_STEPS[currentNiveau] && WORKFLOW_STEPS[currentNiveau][action]) {
        niveauApres = WORKFLOW_STEPS[currentNiveau][action];

        // LOGIQUE D'APPROBATION SERVICE (CHEF DIRECT)
        if (currentNiveau === 'emetteur' && action === 'valider') {
             try {
                const service = await dbUtils.get('SELECT chef_id FROM services WHERE id = ?', [requisition.service_id]);
                // On passe au chef seulement si un chef est configuré ET que ce n'est pas l'émetteur lui-même
                if (service && service.chef_id && service.chef_id !== requisition.emetteur_id) {
                    console.log(`Requisition ${requisition.numero}: Chef de service configuré (ID: ${service.chef_id}), passage à approbation_service.`);
                    niveauApres = 'approbation_service';
                } else if (service && service.chef_id === requisition.emetteur_id) {
                    console.log(`Requisition ${requisition.numero}: L'émetteur est le chef de service, saut de l'étape approbation_service.`);
                }
             } catch (err) {
                 console.error('Erreur vérification chef service:', err);
             }
        }

        // CORRECTION: Si un analyste valide une réquisition qui est encore au niveau 'emetteur',
        // on considère qu'il la soumet ET la valide, donc elle passe directement au challenger.
        if (currentNiveau === 'emetteur' && userRole === 'analyste' && action === 'valider') {
            niveauApres = 'challenger';
        }
    } else {
        throw new Error(`Transition impossible pour ${currentNiveau} -> ${action}`);
    }

    // Logique spécifique par action
    if (action === 'refuser') {
        if (currentNiveau === 'emetteur') {
            niveauApres = 'termine'; // Annulation
            await dbUtils.run('UPDATE requisitions SET statut = ?, niveau = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', ['annulee', niveauApres, requisitionId]);
        } else {
            const niveauRetour = requisition.niveau; // On garde trace d'où ça vient
            niveauApres = 'emetteur';
            await dbUtils.run('UPDATE requisitions SET statut = ?, niveau = ?, niveau_retour = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', ['a_corriger', niveauApres, niveauRetour, requisitionId]);
        }
    } else if (action === 'modifier') {
        await dbUtils.run('UPDATE requisitions SET niveau = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [niveauApres, requisitionId]);
    } else if (action === 'valider') {
        if (currentNiveau === 'emetteur' && requisition.niveau_retour) {
            // Retour correction
            niveauApres = requisition.niveau_retour;
            await dbUtils.run('UPDATE requisitions SET niveau = ?, niveau_retour = NULL, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [niveauApres, requisitionId]);
        } else {
             // Cas standard
             let nouveauStatut = requisition.statut;
             if (currentNiveau === 'gm') {
                 nouveauStatut = 'validee';

                 // --- MISE A JOUR BUDGET (Dès validation GM) ---
                 try {
                     const items = await dbUtils.all('SELECT * FROM lignes_requisition WHERE requisition_id = ?', [requisitionId]);
                     if (items && items.length > 0) {
                         const isCdfMain = (requisition.montant_cdf > 0 && (!requisition.montant_usd || requisition.montant_usd === 0));
                         
                         let rate = 2800;
                         if (isCdfMain) {
                             const rateSetting = await dbUtils.get('SELECT value FROM app_settings WHERE key = ?', ['exchange_rate']);
                             if (rateSetting) rate = parseFloat(rateSetting.value);
                         }

                         const reqDate = new Date(requisition.created_at);
                         const mois = reqDate.toISOString().slice(0, 7); // YYYY-MM

                         for (const item of items) {
                             let montantConsomme = item.prix_total || (item.quantite * item.prix_unitaire);
                             
                             if (isCdfMain) {
                                 montantConsomme = montantConsomme / rate;
                             }
                             
                             // Update budget consumption
                             await BudgetService.updateConsommation(item.description, montantConsomme, mois);
                         }
                         console.log(`Budget mis à jour pour réquisition ${requisition.numero} (Validation GM)`);
                     }
                 } catch (budgetErr) {
                     console.error('Erreur mise à jour budget lors de la validation GM:', budgetErr);
                 }
                 
                 // Marquer comme impacté
                 await dbUtils.run('UPDATE requisitions SET budget_impacted = TRUE WHERE id = ?', [requisitionId]);

             } else if (currentNiveau === 'validation_bordereau') {
                 // ALIGNEMENT (Analyste) -> PAIEMENT
                 // Enregistrer le mode de paiement si fourni
                 if (mode_paiement) {
                     await dbUtils.run('UPDATE requisitions SET mode_paiement = ? WHERE id = ?', [mode_paiement, requisitionId]);
                 }
             } else if (currentNiveau === 'comptable' || currentNiveau === 'paiement') {
                 nouveauStatut = 'payee';
                 
                 // --- GESTION DES FONDS ET MOUVEMENTS ---
                 let totalUsd = 0;
                 let totalCdf = 0;

                 if (requisition.montant_usd && requisition.montant_usd > 0) {
                     totalUsd = requisition.montant_usd;
                     await dbUtils.run('UPDATE fonds SET montant_disponible = montant_disponible - ?, updated_at = CURRENT_TIMESTAMP WHERE devise = ?', [totalUsd, 'USD']);
                     await dbUtils.run('INSERT INTO mouvements_fonds (type_mouvement, montant, devise, description) VALUES (?, ?, ?, ?)', 
                         ['sortie', totalUsd, 'USD', `Paiement Réquisition ${requisition.numero} (${requisition.objet})`]);
                 }
                 
                 if (requisition.montant_cdf && requisition.montant_cdf > 0) {
                     totalCdf = requisition.montant_cdf;
                     await dbUtils.run('UPDATE fonds SET montant_disponible = montant_disponible - ?, updated_at = CURRENT_TIMESTAMP WHERE devise = ?', [totalCdf, 'CDF']);
                     await dbUtils.run('INSERT INTO mouvements_fonds (type_mouvement, montant, devise, description) VALUES (?, ?, ?, ?)', 
                         ['sortie', totalCdf, 'CDF', `Paiement Réquisition ${requisition.numero} (${requisition.objet})`]);
                 }

                 // Enregistrement unique dans la table paiements
                 // Vérification idempotence
                 const existingPayment = await dbUtils.get('SELECT id FROM paiements WHERE requisition_id = ?', [requisitionId]);
                 
                 if (!existingPayment && (totalUsd > 0 || totalCdf > 0)) {
                     await dbUtils.run('INSERT INTO paiements (requisition_id, montant_usd, montant_cdf, commentaire, comptable_id) VALUES (?, ?, ?, ?, ?)',
                         [requisitionId, totalUsd, totalCdf, commentaire || 'Paiement effectué', userId]);
                 } else if (existingPayment) {
                     console.warn(`Paiement déjà existant pour réquisition ${requisitionId} via WorkflowService. Skip insert.`);
                 }

                 // --- MISE A JOUR BUDGET ---
                 if (!requisition.budget_impacted) {
                    try {
                        const items = await dbUtils.all('SELECT * FROM lignes_requisition WHERE requisition_id = ?', [requisitionId]);
                        if (items && items.length > 0) {
                            // Déterminer la devise principale (Logique simplifiée: si CDF > 0 et USD = 0 -> CDF, sinon USD)
                            const isCdfMain = (requisition.montant_cdf > 0 && (!requisition.montant_usd || requisition.montant_usd === 0));
                            
                            let rate = 2800;
                            if (isCdfMain) {
                                const rateSetting = await dbUtils.get('SELECT value FROM app_settings WHERE key = ?', ['exchange_rate']);
                                if (rateSetting) rate = parseFloat(rateSetting.value);
                            }

                            const reqDate = new Date(requisition.created_at);
                            const mois = reqDate.toISOString().slice(0, 7); // YYYY-MM

                            for (const item of items) {
                                let montantConsomme = item.prix_total || (item.quantite * item.prix_unitaire);
                                
                                if (isCdfMain) {
                                    montantConsomme = montantConsomme / rate;
                                }
                                
                                // Update budget consumption
                                await BudgetService.updateConsommation(item.description, montantConsomme, mois);
                            }
                            console.log(`Budget mis à jour pour réquisition ${requisition.numero}`);
                        }
                    } catch (budgetErr) {
                        console.error('Erreur mise à jour budget lors du paiement:', budgetErr);
                    }
                 }
                 
                 // Marquer comme impacté
                 await dbUtils.run('UPDATE requisitions SET budget_impacted = TRUE WHERE id = ?', [requisitionId]);
             }
             
             await dbUtils.run('UPDATE requisitions SET statut = ?, niveau = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [nouveauStatut, niveauApres, requisitionId]);
        }
    }

    // Enregistrer l'historique
    await dbUtils.run(
        'INSERT INTO requisition_actions (requisition_id, utilisateur_id, action, commentaire, niveau_avant, niveau_apres) VALUES (?, ?, ?, ?, ?, ?)',
        [requisitionId, userId || null, action, commentaire, currentNiveau, niveauApres]
    );

    return { niveauAvant: currentNiveau, niveauApres };
  }

  // Vérifier et exécuter les validations automatiques
  static async runAutoValidation() {
    console.log('🔄 Vérification des validations automatiques...');
    const settings = await this.getSettings();
    
    // Pour chaque niveau configuré
    for (const [niveau, delai] of Object.entries(settings)) {
        if (!delai || delai <= 0) continue; // Pas de délai configuré
        if (niveau === 'comptable') continue; // Pas de validation auto pour le paiement (sécurité)

        // Trouver les réquisitions bloquées à ce niveau depuis plus de X minutes
        const isPostgres = !!process.env.DATABASE_URL;
        let timeDiffCondition;
        if (isPostgres) {
             // Postgres: EXTRACT(EPOCH FROM (NOW() - updated_at)) returns seconds
             timeDiffCondition = "EXTRACT(EPOCH FROM (NOW() - updated_at)) > ?";
        } else {
             // SQLite: strftime('%s', 'now') - strftime('%s', updated_at) returns seconds
             timeDiffCondition = "(strftime('%s', 'now') - strftime('%s', updated_at)) > ?";
        }

        const query = `
            SELECT id, numero, niveau, updated_at 
            FROM requisitions 
            WHERE niveau = ? 
            AND statut NOT IN ('brouillon', 'a_corriger', 'payee', 'termine', 'annulee', 'validee')
            AND ${timeDiffCondition}
        `;
        
        const requisitions = await dbUtils.all(query, [niveau, delai * 60]);

        for (const req of requisitions) {
            console.log(`⏱️ Auto-validation déclenchée pour ${req.numero} (Niveau: ${req.niveau}, Délai: ${delai}m)`);
            try {
                // On utilise un ID utilisateur système (ex: 0 ou null)
                await this.processAction(req.id, 'valider', req.niveau, null, 'Validation automatique (Délai dépassé)', true);
            } catch (err) {
                console.error(`❌ Erreur auto-validation ${req.numero}:`, err.message);
            }
        }
    }
  }
}

module.exports = WorkflowService;
