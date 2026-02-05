const { PDFDocument, rgb, StandardFonts } = require('pdf-lib');
const fs = require('fs');
const path = require('path');
const { dbUtils } = require('../database/database');
const StorageService = require('./StorageService');

class PdfService {
    async compileRequisitionsPdf(requisitions) {
        console.log(`Début compilation PDF pour ${requisitions.length} réquisitions`);
        const mergedPdf = await PDFDocument.create();
        const font = await mergedPdf.embedFont(StandardFonts.Helvetica);
        const boldFont = await mergedPdf.embedFont(StandardFonts.HelveticaBold);
        
        // Helper pour sécuriser le texte (éviter crash sur caractères non supportés)
        const safeText = (text) => {
            if (!text) return '';
            // Remplacer les sauts de ligne et tabulations par des espaces
            let clean = text.replace(/[\n\r\t]+/g, ' ');
            // Remplacer les caractères non-WinAnsi par ?
            return clean.replace(/[^\x00-\xFF]/g, '?');
        };

        // --- CONSTANTS & STYLES ---
        const colors = {
            primary: rgb(0, 0.35, 0.55),      // Deep Blue
            secondary: rgb(0.97, 0.97, 0.97), // Very Light Gray
            text: rgb(0.2, 0.2, 0.2),         // Dark Gray Text
            accent: rgb(0.8, 0.2, 0.2),       // Red Accent
            white: rgb(1, 1, 1),
            border: rgb(0.85, 0.85, 0.85),
            tableHeader: rgb(0.92, 0.92, 0.92),
            success: rgb(0.1, 0.5, 0.1),
            grayText: rgb(0.4, 0.4, 0.4)
        };
        
        const margin = 40;

        // --- LOAD LOGO ---
        let logoImage = null;
        try {
            const extensions = ['.png', '.jpg', '.jpeg'];
            for (const ext of extensions) {
                try {
                    const logoBytes = await StorageService.getFileBuffer('logo' + ext);
                    if (ext === '.png') {
                        logoImage = await mergedPdf.embedPng(logoBytes);
                    } else {
                        logoImage = await mergedPdf.embedJpg(logoBytes);
                    }
                    break;
                } catch (ignore) {
                    // Fichier non trouvé avec cette extension, on continue
                }
            }
        } catch (err) {
            console.error('Erreur chargement logo PDF:', err);
        }

        if (requisitions.length === 0) {
            const page = mergedPdf.addPage();
            page.drawText('Aucune réquisition trouvée.', { x: margin, y: 700, size: 20, font: boldFont, color: colors.text });
            return await mergedPdf.save();
        }

        for (const req of requisitions) {
            let page = mergedPdf.addPage();
            const { width, height } = page.getSize();
            const contentWidth = width - (margin * 2);
            let y = height - 40;

            // --- HELPER FUNCTIONS (Scoped to current page/y) ---
            const checkPageBreak = (currentY, neededSpace = 50) => {
                if (currentY < neededSpace) {
                    page = mergedPdf.addPage();
                    
                    // En-tête simplifié pour les pages suivantes
                    page.drawRectangle({
                        x: 0,
                        y: height - 50,
                        width: width,
                        height: 50,
                        color: colors.primary
                    });
                    page.drawText(`Suite - Demande N° ${req.numero}`, {
                        x: margin,
                        y: height - 32,
                        size: 12,
                        font: boldFont,
                        color: colors.white
                    });

                    return height - 80;
                }
                return currentY;
            };

            const drawWrappedText = (text, x, startY, size, textFont, maxWidth, color = colors.text) => {
                const safeContent = safeText(text || '');
                const words = safeContent.split(/\s+/);
                let line = '';
                let currentY = startY;
                
                for (const word of words) {
                    const testLine = line + word + ' ';
                    const textWidth = textFont.widthOfTextAtSize(testLine, size);
                    
                    if (textWidth > maxWidth) {
                        page.drawText(line, { x, y: currentY, size, font: textFont, color });
                        currentY -= (size + 4);
                        line = word + ' ';
                        currentY = checkPageBreak(currentY, 50);
                    } else {
                        line = testLine;
                    }
                }
                page.drawText(line, { x, y: currentY, size, font: textFont, color });
                return currentY - (size + 8);
            };

            // --- HEADER SECTION ---
            // Blue Top Bar
            page.drawRectangle({
                x: 0,
                y: height - 90,
                width: width,
                height: 90,
                color: colors.primary
            });

            // 1. Logo (Left, inside blue bar)
            if (logoImage) {
                const logoDims = logoImage.scaleToFit(150, 80);
                page.drawImage(logoImage, {
                    x: margin,
                    y: height - 85,
                    width: logoDims.width,
                    height: logoDims.height,
                });
            }

            // 2. Document Title (Right, inside blue bar)
            const title = "FICHE DE RÉQUISITION";
            const titleWidth = boldFont.widthOfTextAtSize(title, 20);
            page.drawText(title, {
                x: width - margin - titleWidth,
                y: height - 45,
                size: 20,
                font: boldFont,
                color: colors.white
            });

            // 3. Requisition Number
            const reqNum = `N° ${req.numero}`;
            const reqNumWidth = font.widthOfTextAtSize(reqNum, 12);
            page.drawText(reqNum, {
                x: width - margin - reqNumWidth,
                y: height - 70,
                size: 12,
                font: font,
                color: rgb(0.9, 0.9, 0.9)
            });

            y = height - 110;

            // --- STATUS & DATE BAR ---
            const statusText = (req.statut || 'INCONNU').toUpperCase();
            let statusColor = colors.text;
            if (['VALIDEE', 'PAYEE', 'TERMINEE'].includes(statusText)) statusColor = colors.success;
            else if (['REJETEE', 'ANNULEE'].includes(statusText)) statusColor = colors.accent;

            page.drawText(`STATUT: ${statusText}`, { x: margin, y, size: 12, font: boldFont, color: statusColor });
            
            const dateStr = new Date(req.created_at).toLocaleDateString('fr-FR');
            page.drawText(`DATE CRÉATION: ${dateStr}`, { x: width - margin - 180, y, size: 11, font: font, color: colors.text });

            y -= 30;

            // --- INFO GRID (Boxed Layout) ---
            const infoBoxHeight = 110;
            
            // Background
            page.drawRectangle({
                x: margin,
                y: y - infoBoxHeight,
                width: contentWidth,
                height: infoBoxHeight,
                color: colors.secondary,
                borderColor: colors.primary,
                borderWidth: 1
            });

            // Columns
            const col1 = margin + 15;
            const col2 = margin + 200;
            const col3 = margin + 380;
            let rowY = y - 20;

            // Helper for labels
            const drawLabel = (label, x, y) => page.drawText(label, { x, y, size: 8, font: boldFont, color: colors.primary });
            const drawValue = (val, x, y) => page.drawText(safeText(val), { x, y, size: 10, font: font, color: colors.text });

            // Row 1
            drawLabel('ÉMETTEUR', col1, rowY);
            drawValue(req.emetteur_nom, col1, rowY - 12);

            drawLabel('SERVICE', col2, rowY);
            drawValue(req.service_nom || req.service_code, col2, rowY - 12);

            drawLabel('ZONE', col3, rowY);
            drawValue(req.emetteur_zone || '-', col3, rowY - 12);

            rowY -= 40;

            // Row 2
            drawLabel('EMAIL', col1, rowY);
            drawValue(req.emetteur_email || '-', col1, rowY - 12);

            drawLabel('OBJET', col2, rowY);
            // Wrap object if needed
            const objectText = safeText(req.objet || '-');
            if (font.widthOfTextAtSize(objectText, 10) > 300) {
                drawWrappedText(objectText, col2, rowY - 12, 10, font, 320);
            } else {
                drawValue(objectText, col2, rowY - 12);
            }

            // Amounts
            page.drawText('MONTANT TOTAL', { x: col3, y: rowY, size: 8, font: boldFont, color: colors.primary });
            page.drawText(`${(req.montant_usd || 0).toLocaleString('fr-FR', { minimumFractionDigits: 2 })} $`, { x: col3, y: rowY - 12, size: 12, font: boldFont, color: colors.primary });
            
            y -= (infoBoxHeight + 25);

            // --- DESCRIPTION ---
            page.drawText('DESCRIPTION / MOTIF', { x: margin, y, size: 11, font: boldFont, color: colors.primary });
            y -= 5;
            page.drawLine({ start: { x: margin, y }, end: { x: width - margin, y }, thickness: 1, color: colors.border });
            y -= 15;
            y = drawWrappedText(req.commentaire_initial || 'Aucune description fournie.', margin, y, 10, font, contentWidth);
            y -= 25;

            // --- REQUISITION ITEMS (LIGNES) ---
            const items = await dbUtils.all(`
                SELECT * FROM lignes_requisition WHERE requisition_id = ? ORDER BY id ASC
            `, [req.id]);

            if (items.length > 0) {
                y = checkPageBreak(y, 100);

                page.drawText('DÉTAILS DES ARTICLES', { x: margin, y, size: 11, font: boldFont, color: colors.primary });
                y -= 5;
                page.drawLine({ start: { x: margin, y }, end: { x: width - margin, y }, thickness: 1, color: colors.border });
                y -= 15;

                // Table Header
                page.drawRectangle({ x: margin, y: y - 20, width: contentWidth, height: 20, color: colors.tableHeader });
                
                const colDesc = margin + 5;
                const colQty = margin + 300;
                const colPrice = margin + 380;
                const colTotal = margin + 460;

                const drawHeader = (txt, x) => page.drawText(txt, { x, y: y - 14, size: 9, font: boldFont, color: colors.text });
                
                drawHeader('DESCRIPTION', colDesc);
                drawHeader('QTÉ', colQty);
                drawHeader('P. UNIT', colPrice);
                drawHeader('TOTAL', colTotal);
                
                y -= 25;

                let totalAmount = 0;
                for (let i = 0; i < items.length; i++) {
                    const item = items[i];
                    y = checkPageBreak(y, 35);

                    // Row Zebra
                    if (i % 2 === 0) {
                        page.drawRectangle({ x: margin, y: y - 8, width: contentWidth, height: 18, color: colors.secondary });
                    }

                    const qty = Number(item.quantite) || 0;
                    const price = Number(item.prix_unitaire) || 0;
                    const total = Number(item.prix_total) || 0;
                    totalAmount += total;
                    
                    // Description wrapped
                    const descY = drawWrappedText(safeText(item.description), colDesc, y + 2, 9, font, 280);
                    
                    // Numbers aligned
                    page.drawText(qty.toLocaleString('fr-FR'), { x: colQty, y: y + 2, size: 9, font });
                    page.drawText(price.toLocaleString('fr-FR', { minimumFractionDigits: 2 }), { x: colPrice, y: y + 2, size: 9, font });
                    page.drawText(total.toLocaleString('fr-FR', { minimumFractionDigits: 2 }), { x: colTotal, y: y + 2, size: 9, font: boldFont });

                    y = Math.min(y, descY); // use lowest Y
                    y -= 12; // spacing
                }

                // Total Row
                y -= 5;
                page.drawLine({ start: { x: margin + 300, y }, end: { x: width - margin, y }, thickness: 1, color: colors.primary });
                y -= 15;
                page.drawText('TOTAL GÉNÉRAL:', { x: margin + 300, y, size: 10, font: boldFont, color: colors.primary });
                page.drawText(`${totalAmount.toLocaleString('fr-FR', { minimumFractionDigits: 2 })} $`, { x: colTotal, y, size: 10, font: boldFont, color: colors.primary });
                
                y -= 30;
            }

            // --- VALIDATION HISTORY (TABLE) ---
            const actions = await dbUtils.all(`
                SELECT ra.*, u.nom_complet as utilisateur_nom, u.role as utilisateur_role
                FROM requisition_actions ra
                LEFT JOIN users u ON ra.utilisateur_id = u.id
                WHERE ra.requisition_id = ?
                ORDER BY ra.created_at ASC
            `, [req.id]);

            if (actions.length > 0) {
                y = checkPageBreak(y, 100);
                
                page.drawText('HISTORIQUE DES VALIDATIONS', { x: margin, y, size: 11, font: boldFont, color: colors.primary });
                y -= 5;
                page.drawLine({ start: { x: margin, y }, end: { x: width - margin, y }, thickness: 1, color: colors.border });
                y -= 15;

                // Table Header
                page.drawRectangle({ x: margin, y: y - 20, width: contentWidth, height: 20, color: colors.tableHeader });
                
                const colDate = margin + 5;
                const colAct = margin + 110;
                const colUser = margin + 200;
                const colNote = margin + 350;

                const drawHeader = (txt, x) => page.drawText(txt, { x, y: y - 14, size: 9, font: boldFont, color: colors.text });
                
                drawHeader('DATE', colDate);
                drawHeader('ACTION', colAct);
                drawHeader('INTERVENANT', colUser);
                drawHeader('NOTE', colNote);
                
                y -= 25;

                for (let i = 0; i < actions.length; i++) {
                    const action = actions[i];
                    y = checkPageBreak(y, 35);

                    if (i % 2 === 0) {
                        page.drawRectangle({ x: margin, y: y - 8, width: contentWidth, height: 18, color: colors.secondary });
                    }

                    const dateStr = new Date(action.created_at).toLocaleDateString('fr-FR') + ' ' + new Date(action.created_at).toLocaleTimeString('fr-FR', {hour: '2-digit', minute:'2-digit'});
                    page.drawText(dateStr, { x: colDate, y: y + 2, size: 8, font });
                    
                    const actStr = action.action.toUpperCase();
                    let actColor = colors.text;
                    if (actStr === 'VALIDER') actColor = colors.success;
                    else if (actStr === 'REFUSER') actColor = colors.accent;
                    page.drawText(actStr, { x: colAct, y: y + 2, size: 8, font: boldFont, color: actColor });
                    
                    const userStr = safeText(`${action.utilisateur_nom || 'Inconnu'} (${action.utilisateur_role || '-'})`);
                    const userY = drawWrappedText(userStr, colUser, y + 2, 8, font, 140);
                    
                    const noteStr = safeText(action.commentaire || '-');
                    const noteY = drawWrappedText(noteStr, colNote, y + 2, 8, font, width - margin - colNote);
                    
                    y = Math.min(y, userY, noteY);
                    y -= 12;
                }
                y -= 20;
            }

            // --- ATTACHMENTS ---
            const attachments = await dbUtils.all(`
                SELECT pj.*, u.nom_complet as uploader_nom
                FROM pieces_jointes pj
                LEFT JOIN users u ON pj.uploaded_by = u.id
                WHERE pj.requisition_id = ?
            `, [req.id]);
            
            if (attachments.length > 0) {
                y = checkPageBreak(y, 100);
                page.drawText(`PIÈCES JOINTES (${attachments.length})`, { x: margin, y, size: 11, font: boldFont, color: colors.primary });
                y -= 15;

                for (const att of attachments) {
                    y = checkPageBreak(y, 30);
                    
                    // Display name
                    const uploaderText = att.uploader_nom ? ` (Ajouté par: ${att.uploader_nom})` : '';
                    page.drawText(`• ${safeText(att.nom_fichier)}${uploaderText}`, { x: margin + 10, y, size: 9, font });
                    y -= 15;

                    try {
                        const fileBytes = await StorageService.getFileBuffer(att.chemin_fichier);
                        const ext = path.extname(att.nom_fichier).toLowerCase();
                        
                        // Append logic
                        if (ext === '.pdf') {
                            const attachmentDoc = await PDFDocument.load(fileBytes);
                            const copiedPages = await mergedPdf.copyPages(attachmentDoc, attachmentDoc.getPageIndices());
                            copiedPages.forEach((cp) => {
                                const newPage = mergedPdf.addPage(cp);
                                // Optional: Watermark or Header on attached pages
                            });
                        } else if (['.jpg', '.jpeg', '.png'].includes(ext)) {
                            let img;
                            if (ext === '.png') img = await mergedPdf.embedPng(fileBytes);
                            else img = await mergedPdf.embedJpg(fileBytes);
                            
                            const imgPage = mergedPdf.addPage();
                            const { width: pgWidth, height: pgHeight } = imgPage.getSize();
                            const imgDims = img.scaleToFit(pgWidth - 80, pgHeight - 80);
                            
                            imgPage.drawImage(img, {
                                x: (pgWidth - imgDims.width) / 2,
                                y: (pgHeight - imgDims.height) / 2,
                                width: imgDims.width,
                                height: imgDims.height,
                            });
                            
                            imgPage.drawText(`Annexe: ${safeText(att.nom_fichier)}`, {
                                x: 40,
                                y: pgHeight - 30,
                                size: 10,
                                font: boldFont,
                                color: colors.primary
                            });
                        }
                    } catch (err) {
                        console.error(`Erreur PJ ${att.nom_fichier}:`, err);
                        // Red error text next to the file name we just drew? 
                        // Actually we already moved Y. Let's just log it.
                        // Or draw "Erreur" next to the name if possible.
                        // Since we are in a loop and already drew the name, let's just add a note below if failed.
                        page.drawText(`  (Erreur chargement: Fichier non trouvé ou corrompu)`, { x: margin + 20, y: y + 15, size: 8, font, color: colors.accent });
                    }
                }
            }
        }

        // --- GLOBAL PAGINATION & FOOTER ---
        const pages = mergedPdf.getPages();
        const totalPages = pages.length;
        const generationDate = new Date().toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
        
        for (let i = 0; i < totalPages; i++) {
            const p = pages[i];
            const { width } = p.getSize();
            
            // Pagination (Right)
            p.drawText(`Page ${i + 1} / ${totalPages}`, {
                x: width - 80,
                y: 15,
                size: 9,
                font: font,
                color: colors.grayText,
            });

            // Footer Text (Center/Left)
            p.drawText(`Généré par Requisitions App le ${generationDate}`, {
                x: margin,
                y: 15,
                size: 8,
                font: font,
                color: colors.grayText,
            });
        }

        return await mergedPdf.save();
    }
}

module.exports = new PdfService();
