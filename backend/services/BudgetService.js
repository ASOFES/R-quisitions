const xlsx = require('xlsx');
const { dbUtils } = require('../database/database');

class BudgetService {
    /**
     * Importe un budget depuis un fichier Excel (Buffer ou Path)
     * @param {string|Buffer} source - Chemin du fichier ou Buffer
     * @param {string} mois - Mois au format 'YYYY-MM'
     * @param {number} annee - Année (ex: 2025)
     */
    static async importBudget(source, mois, annee) {
        try {
            let workbook;
            if (Buffer.isBuffer(source)) {
                workbook = xlsx.read(source, { type: 'buffer' });
            } else {
                workbook = xlsx.readFile(source);
            }
            
            const sheetName = workbook.SheetNames[0];
            const sheet = workbook.Sheets[sheetName];
            
            // Lecture en tableau de tableaux pour trouver l'en-tête
            const rawData = xlsx.utils.sheet_to_json(sheet, { header: 1 });

            if (!rawData.length) {
                throw new Error("Le fichier Excel est vide ou illisible.");
            }

            console.log(`[BudgetService] Début import. ${rawData.length} lignes brutes.`);

            // Trouver la ligne d'en-tête
            let headerRowIndex = -1;
            let headerMap = {}; // Map column index to normalized name

            const possibleDesc = ['description', 'libellé', 'libelle', 'item', 'nom', 'designation'];
            const possibleMontant = ['montant', 'budget', 'prevu', 'prévu', 'prix', 'cout', 'coût', 'valeur'];
            const possibleClass = ['classification', 'categorie', 'catégorie', 'type', 'classe'];
            const possibleDate = ['mois', 'month', 'date', 'période', 'periode', 'année', 'annee'];

            for (let i = 0; i < Math.min(rawData.length, 20); i++) { // Check first 20 rows
                const row = rawData[i];
                let foundDesc = false;
                let foundMontant = false;

                row.forEach((cell, index) => {
                    if (typeof cell === 'string') {
                        const val = cell.trim().toLowerCase();
                        if (possibleDesc.includes(val)) {
                            headerMap['description'] = index;
                            foundDesc = true;
                        } else if (possibleMontant.includes(val)) {
                            headerMap['montant'] = index;
                            foundMontant = true;
                        } else if (possibleClass.includes(val)) {
                            headerMap['classification'] = index;
                        } else if (possibleDate.includes(val)) {
                            headerMap['date'] = index;
                        }
                    }
                });

                if (foundDesc && foundMontant) {
                    headerRowIndex = i;
                    console.log(`[BudgetService] Ligne d'en-tête trouvée à l'index ${i}:`, row);
                    break;
                }
            }

            if (headerRowIndex === -1) {
                console.warn("[BudgetService] Impossible de détecter automatiquement la ligne d'en-tête. Tentative avec la 1ère ligne.");
                // Fallback: assume first row is header or data
                // Si on n'a pas trouvé d'en-tête explicite, on peut essayer de voir si c'est un format simple sans header
                // Mais pour l'instant on va échouer proprement ou logger
            }

            let count = 0;
            
            // Itérer sur les lignes de données (après le header)
            const startRow = headerRowIndex !== -1 ? headerRowIndex + 1 : 0;

            for (let i = startRow; i < rawData.length; i++) {
                const row = rawData[i];
                if (!row || row.length === 0) continue;

                let description, montant, classification, rowDateVal;

                if (headerRowIndex !== -1) {
                    description = row[headerMap['description']];
                    montant = row[headerMap['montant']];
                    classification = headerMap['classification'] !== undefined ? row[headerMap['classification']] : 'Autre';
                    rowDateVal = headerMap['date'] !== undefined ? row[headerMap['date']] : null;
                } else {
                    // Fallback heuristique si pas de header trouvé
                    // On suppose Col 0 = Description, Col 1 = Montant (ou inversement si type number)
                    // C'est risqué, mais ça peut dépanner
                    if (typeof row[0] === 'string' && typeof row[1] === 'number') {
                        description = row[0];
                        montant = row[1];
                    } else if (typeof row[1] === 'string' && typeof row[2] === 'number') {
                         // Parfois col 0 est un ID ou vide
                        description = row[1];
                        montant = row[2];
                    }
                     classification = 'Autre';
                }

                if (description && montant !== undefined) {
                    // Nettoyage montant (enlever devises, espaces, virgules -> points)
                    let cleanMontant = montant;
                    if (typeof montant === 'string') {
                        cleanMontant = parseFloat(montant.replace(/[^0-9.,]/g, '').replace(',', '.'));
                    }

                    // Ignorer si le montant n'est pas un nombre valide ou est 0
                    if (isNaN(cleanMontant) || cleanMontant === 0) {
                        // console.warn(`[BudgetService] Montant invalide/nul pour "${description}": ${montant}`);
                        continue;
                    }

                    // Détermination du Mois/Année cible
                    let targetMois = mois;
                    let targetAnnee = annee;

                    if (rowDateVal) {
                        let dateObj = null;
                        if (typeof rowDateVal === 'number') {
                            // Excel date to JS Date
                            // Excel base date is 1900-01-01 (approx). 25569 is offset for 1970-01-01
                            dateObj = new Date(Math.round((rowDateVal - 25569) * 86400 * 1000));
                        } else if (typeof rowDateVal === 'string') {
                            // Try parsing string
                            dateObj = new Date(rowDateVal);
                            if (isNaN(dateObj.getTime())) {
                                // Try French format parsing "Janvier 2026" or "01/2026" ?
                                // For now, basic parsing.
                                dateObj = null;
                            }
                        }

                        if (dateObj && !isNaN(dateObj.getTime())) {
                            const y = dateObj.getFullYear();
                            const m = String(dateObj.getMonth() + 1).padStart(2, '0');
                            targetMois = `${y}-${m}`;
                            targetAnnee = y;
                        }
                    }

                    // Insertion ou Mise à jour (Upsert)
                    const existing = await dbUtils.get(
                        'SELECT id FROM budgets WHERE description = ? AND mois = ?',
                        [description, targetMois]
                    );

                    if (existing) {
                        await dbUtils.run(
                            'UPDATE budgets SET montant_prevu = ?, classification = ? WHERE id = ?',
                            [cleanMontant, classification, existing.id]
                        );
                    } else {
                        await dbUtils.run(
                            'INSERT INTO budgets (description, mois, annee, montant_prevu, classification) VALUES (?, ?, ?, ?, ?)',
                            [description, targetMois, targetAnnee, cleanMontant, classification]
                        );
                    }
                    count++;
                }
            }
            
            return { success: true, count };
        } catch (error) {
            console.error('Erreur import budget:', error);
            throw error;
        }
    }

    /**
     * Vérifie si une dépense est dans le budget
     * @param {string} description - Description de la ligne budgétaire
     * @param {number} montant - Montant de la dépense
     * @param {string} mois - Mois concerné 'YYYY-MM'
     */
    static async checkBudget(description, montant, mois) {
        const budget = await dbUtils.get(
            'SELECT * FROM budgets WHERE description = ? AND mois = ?',
            [description, mois]
        );

        if (!budget) {
            return { 
                allowed: false, 
                reason: 'Ligne budgétaire non trouvée',
                budget: null 
            };
        }

        const reste = budget.montant_prevu - budget.montant_consomme;
        
        if (montant > reste) {
            return {
                allowed: false,
                reason: 'Dépassement de budget',
                details: {
                    prevu: budget.montant_prevu,
                    consomme: budget.montant_consomme,
                    demande: montant,
                    reste: reste
                }
            };
        }

        return { allowed: true, budget };
    }

    /**
     * Met à jour le consommé (lors du paiement par ex)
     */
    static async updateConsommation(description, montant, mois) {
         // Logique à affiner : faut-il faire le lien par ID ou Description ?
         // Idéalement par ID, mais le lien Requisition <-> Budget n'est pas encore strict.
         // Pour l'instant on fait par description.
         
         const cleanDescription = description ? description.trim() : '';
         const budget = await dbUtils.get(
            'SELECT id, montant_consomme FROM budgets WHERE description = ? AND mois = ?',
            [cleanDescription, mois]
        );

        if (budget) {
            const nouveauConsomme = parseFloat(budget.montant_consomme) + parseFloat(montant);
            await dbUtils.run(
                'UPDATE budgets SET montant_consomme = ? WHERE id = ?',
                [nouveauConsomme, budget.id]
            );
            return true;
        }
        return false;
    }

    /**
     * Répare les incohérences de budget au démarrage
     */
    static async fixBudgetInconsistencies() {
        console.log('[BudgetService] Vérification de la cohérence budgétaire...');
        try {
            // 1. Marquer les réquisitions Payées/Terminées comme "budget_impacted"
            await dbUtils.run("UPDATE requisitions SET budget_impacted = TRUE WHERE (statut = 'payee' OR statut = 'termine') AND (budget_impacted IS NULL OR budget_impacted = FALSE)");

            // 2. Traiter les réquisitions Validées à régulariser
            const requisitionsToFix = await dbUtils.all("SELECT * FROM requisitions WHERE statut = 'validee' AND (budget_impacted IS NULL OR budget_impacted = FALSE)");
            
            if (requisitionsToFix.length > 0) {
                console.log(`[BudgetService] ${requisitionsToFix.length} réquisitions validées à régulariser.`);
                
                let rate = 2800;
                const rateSetting = await dbUtils.get('SELECT value FROM app_settings WHERE key = ?', ['exchange_rate']);
                if (rateSetting) rate = parseFloat(rateSetting.value);

                for (const req of requisitionsToFix) {
                    const items = await dbUtils.all('SELECT * FROM lignes_requisition WHERE requisition_id = ?', [req.id]);
                    if (items && items.length > 0) {
                        const isCdfMain = (req.montant_cdf > 0 && (!req.montant_usd || req.montant_usd === 0));
                        const reqDate = new Date(req.created_at);
                        const mois = reqDate.toISOString().slice(0, 7); // YYYY-MM

                        for (const item of items) {
                            let montantConsomme = item.prix_total || (item.quantite * item.prix_unitaire);
                            if (isCdfMain) {
                                montantConsomme = montantConsomme / rate;
                            }
                            await this.updateConsommation(item.description, montantConsomme, mois);
                        }
                    }
                    await dbUtils.run('UPDATE requisitions SET budget_impacted = TRUE WHERE id = ?', [req.id]);
                }
                console.log('[BudgetService] Régularisation terminée.');
            }
        } catch (error) {
            console.error('[BudgetService] Erreur lors de la vérification budgétaire:', error);
        }
    }
}

module.exports = BudgetService;
