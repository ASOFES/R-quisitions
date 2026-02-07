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

                let description, montant, classification;

                if (headerRowIndex !== -1) {
                    description = row[headerMap['description']];
                    montant = row[headerMap['montant']];
                    classification = headerMap['classification'] !== undefined ? row[headerMap['classification']] : 'Autre';
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

                    // Insertion ou Mise à jour (Upsert)
                    const existing = await dbUtils.get(
                        'SELECT id FROM budgets WHERE description = ? AND mois = ?',
                        [description, mois]
                    );

                    if (existing) {
                        await dbUtils.run(
                            'UPDATE budgets SET montant_prevu = ?, classification = ? WHERE id = ?',
                            [cleanMontant, classification, existing.id]
                        );
                    } else {
                        await dbUtils.run(
                            'INSERT INTO budgets (description, mois, annee, montant_prevu, classification) VALUES (?, ?, ?, ?, ?)',
                            [description, mois, annee, cleanMontant, classification]
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
         
         const budget = await dbUtils.get(
            'SELECT id, montant_consomme FROM budgets WHERE description = ? AND mois = ?',
            [description, mois]
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
}

module.exports = BudgetService;
