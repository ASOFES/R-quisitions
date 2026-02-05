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
            // Remplacer les sauts de ligne et tabulations par des espaces pour éviter le crash WinAnsi
            let clean = text.replace(/[\n\r\t]+/g, ' ');
            // Remplacer les caractères non-WinAnsi par ?
            return clean.replace(/[^\x00-\xFF]/g, '?');
        };

        // --- CONSTANTS & STYLES ---
        const colors = {
            primary: rgb(0, 0.35, 0.55),     // Deep Blue
            secondary: rgb(0.95, 0.95, 0.95), // Light Gray Background
            text: rgb(0.2, 0.2, 0.2),         // Dark Gray Text
            accent: rgb(0.8, 0.2, 0.2),       // Red Accent
            white: rgb(1, 1, 1),
            border: rgb(0.85, 0.85, 0.85)
        };
        
        const margin = 50;

        // --- LOAD LOGO ---
        let logoImage = null;
        try {
            const extensions = ['.png', '.jpg', '.jpeg'];
            const uploadDir = path.join(__dirname, '../uploads');
            for (const ext of extensions) {
                const logoPath = path.join(uploadDir, 'logo' + ext);
                if (fs.existsSync(logoPath)) {
                    const logoBytes = fs.readFileSync(logoPath);
                    if (ext === '.png') {
                        logoImage = await mergedPdf.embedPng(logoBytes);
                    } else {
                        logoImage = await mergedPdf.embedJpg(logoBytes);
                    }
                    break;
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
                    return height - 50;
                }
                return currentY;
            };

            const drawWrappedText = (text, x, startY, size, textFont, maxWidth) => {
                const safeContent = safeText(text || '');
                const words = safeContent.split(/\s+/); // Split by whitespace
                let line = '';
                let currentY = startY;
                
                for (const word of words) {
                    const testLine = line + word + ' ';
                    const textWidth = textFont.widthOfTextAtSize(testLine, size);
                    
                    if (textWidth > maxWidth) {
                        page.drawText(line, { x, y: currentY, size, font: textFont, color: colors.text });
                        currentY -= (size + 5);
                        line = word + ' ';
                        
                        currentY = checkPageBreak(currentY, 50);
                    } else {
                        line = testLine;
                    }
                }
                page.drawText(line, { x, y: currentY, size, font: textFont, color: colors.text });
                return currentY - (size + 10);
            };

            // --- HEADER SECTION ---
            // 1. Logo (Left)
            if (logoImage) {
                const logoDims = logoImage.scaleToFit(140, 60);
                page.drawImage(logoImage, {
                    x: margin,
                    y: y - logoDims.height,
                    width: logoDims.width,
                    height: logoDims.height,
                });
            }

            // 2. Document Title (Right)
            const title = "FICHE DE RÉQUISITION";
            const titleWidth = boldFont.widthOfTextAtSize(title, 18);
            page.drawText(title, {
                x: width - margin - titleWidth,
                y: y - 20,
                size: 18,
                font: boldFont,
                color: colors.primary
            });

            y -= 80;

            // --- REQUISITION ID BOX ---
            const boxHeight = 35;
            page.drawRectangle({
                x: margin,
                y: y - boxHeight,
                width: contentWidth,
                height: boxHeight,
                color: colors.primary,
            });
            
            page.drawText(`N° ${req.numero}`, {
                x: margin + 10,
                y: y - 24,
                size: 16,
                font: boldFont,
                color: colors.white
            });

            const statusText = req.statut ? req.statut.toUpperCase() : 'INCONNU';
            const statusWidth = boldFont.widthOfTextAtSize(statusText, 14);
            page.drawText(statusText, {
                x: width - margin - statusWidth - 10,
                y: y - 23,
                size: 14,
                font: boldFont,
                color: colors.white
            });

            y -= 50;

            // --- INFO GRID ---
            const infoBoxHeight = 120;
            page.drawRectangle({
                x: margin,
                y: y - infoBoxHeight,
                width: contentWidth,
                height: infoBoxHeight,
                color: colors.secondary,
                borderColor: colors.border,
                borderWidth: 1
            });

            // Grid Helpers
            const drawInfo = (label, value, colX, rowY) => {
                page.drawText(label, { x: colX, y: rowY, size: 8, font: boldFont, color: rgb(0.4, 0.4, 0.4) });
                page.drawText(safeText(value) || '-', { x: colX, y: rowY - 12, size: 10, font: font, color: colors.text });
            };

            // Draw grid lines for better readability
            const drawGridLine = (startX, endX, yPos) => {
                page.drawLine({ start: { x: startX, y: yPos }, end: { x: endX, y: yPos }, thickness: 0.5, color: colors.border });
            };

            const col1 = margin + 10;
            const col2 = margin + 180;
            const col3 = margin + 350;
            
            let rowY = y - 20;
            
            // Header row
            drawInfo('DATE', new Date(req.created_at).toLocaleDateString('fr-FR'), col1, rowY);
            drawInfo('ÉMETTEUR', req.emetteur_nom, col2, rowY);
            drawInfo('SERVICE', req.service_nom || req.service_code, col3, rowY);
            drawGridLine(margin, width - margin, rowY - 15);

            rowY -= 30;

            // Second row
            drawInfo('EMAIL', req.emetteur_email || '-', col1, rowY);
            drawInfo('RÔLE', req.emetteur_role || '-', col2, rowY);
            drawInfo('ZONE', req.emetteur_zone || '-', col3, rowY);
            drawGridLine(margin, width - margin, rowY - 15);

            rowY -= 30;

            // Third row - OBJET spans full width
            page.drawText('OBJET', { x: col1, y: rowY, size: 8, font: boldFont, color: rgb(0.4, 0.4, 0.4) });
            const objetText = safeText(req.objet || '-');
            if (font.widthOfTextAtSize(objetText, 10) > (contentWidth - 20)) {
                // Wrap text if too long
                const wrappedObjet = drawWrappedText(objetText, col1, rowY - 12, 10, font, contentWidth - 20);
                rowY = wrappedObjet;
            } else {
                page.drawText(objetText, { x: col1, y: rowY - 12, size: 10, font: font, color: colors.text });
            }
            drawGridLine(margin, width - margin, rowY - 15);

            rowY -= 30;

            // Money row
            page.drawText('MONTANT USD', { x: col1, y: rowY, size: 8, font: boldFont, color: rgb(0.4, 0.4, 0.4) });
            page.drawText(`${(req.montant_usd || 0).toLocaleString('fr-FR', { minimumFractionDigits: 2 })} $US`, { x: col1, y: rowY - 12, size: 11, font: boldFont, color: colors.primary });

            page.drawText('MONTANT CDF', { x: col2, y: rowY, size: 8, font: boldFont, color: rgb(0.4, 0.4, 0.4) });
            page.drawText(`${(req.montant_cdf || 0).toLocaleString('fr-FR', { minimumFractionDigits: 2 })} FC`, { x: col2, y: rowY - 12, size: 11, font: boldFont, color: colors.primary });

            y -= (infoBoxHeight + 30);

            // --- DESCRIPTION ---
            page.drawText('DESCRIPTION / MOTIF', { x: margin, y, size: 12, font: boldFont, color: colors.primary });
            y -= 5;
            page.drawLine({ start: { x: margin, y }, end: { x: width - margin, y }, thickness: 1, color: colors.border });
            y -= 15;

            y = drawWrappedText(req.commentaire_initial || 'Aucune description fournie.', margin, y, 11, font, contentWidth);
            y -= 20;

            // --- REQUISITION ITEMS (LIGNES) ---
            const items = await dbUtils.all(`
                SELECT * FROM lignes_requisition WHERE requisition_id = ? ORDER BY id ASC
            `, [req.id]);

            if (items.length > 0) {
                y = checkPageBreak(y, 100);

                page.drawText('DÉTAILS DES ARTICLES', { x: margin, y, size: 12, font: boldFont, color: colors.primary });
                y -= 5;
                page.drawLine({ start: { x: margin, y }, end: { x: width - margin, y }, thickness: 1, color: colors.border });
                y -= 20;

                // Table Header with better styling
                page.drawRectangle({ x: margin, y: y - 25, width: contentWidth, height: 25, color: rgb(0.95, 0.95, 0.95) });
                page.drawLine({ start: { x: margin, y: y - 25 }, end: { x: width - margin, y: y - 25 }, thickness: 1, color: colors.border });
                
                const colDesc = margin + 8;
                const colQty = margin + 280;
                const colPrice = margin + 360;
                const colTotal = margin + 440;

                page.drawText('DESCRIPTION', { x: colDesc, y: y - 17, size: 10, font: boldFont, color: colors.primary });
                page.drawText('QUANTITÉ', { x: colQty, y: y - 17, size: 10, font: boldFont, color: colors.primary });
                page.drawText('P. UNITAIRE', { x: colPrice, y: y - 17, size: 10, font: boldFont, color: colors.primary });
                page.drawText('TOTAL', { x: colTotal, y: y - 17, size: 10, font: boldFont, color: colors.primary });
                
                // Vertical lines for table
                page.drawLine({ start: { x: colQty - 5, y: y - 25 }, end: { x: colQty - 5, y: y - 5 }, thickness: 0.5, color: colors.border });
                page.drawLine({ start: { x: colPrice - 5, y: y - 25 }, end: { x: colPrice - 5, y: y - 5 }, thickness: 0.5, color: colors.border });
                page.drawLine({ start: { x: colTotal - 5, y: y - 25 }, end: { x: colTotal - 5, y: y - 5 }, thickness: 0.5, color: colors.border });
                
                y -= 35;

                let totalAmount = 0;
                for (const item of items) {
                    y = checkPageBreak(y, 35);

                    // Row background alternating
                    if ((items.indexOf(item) % 2) === 0) {
                        page.drawRectangle({ x: margin, y: y - 20, width: contentWidth, height: 20, color: rgb(0.98, 0.98, 0.98) });
                    }

                    // Description with better wrapping
                    const descWidth = colQty - colDesc - 15;
                    const descText = safeText(item.description);
                    const descY = drawWrappedText(descText, colDesc, y - 5, 9, font, descWidth);
                    
                    // Format numeric values
                    const qty = Number(item.quantite) || 0;
                    const price = Number(item.prix_unitaire) || 0;
                    const total = Number(item.prix_total) || 0;
                    totalAmount += total;
                    
                    // Right-align numeric values
                    const qtyText = qty.toLocaleString('fr-FR');
                    const priceText = `${price.toLocaleString('fr-FR', { minimumFractionDigits: 2 })} $`;
                    const totalText = `${total.toLocaleString('fr-FR', { minimumFractionDigits: 2 })} $`;
                    
                    page.drawText(qtyText, { x: colQty - 5 - font.widthOfTextAtSize(qtyText, 9), y: y - 12, size: 9, font: font, color: colors.text });
                    page.drawText(priceText, { x: colPrice - 5 - font.widthOfTextAtSize(priceText, 9), y: y - 12, size: 9, font: font, color: colors.text });
                    page.drawText(totalText, { x: colTotal - 5 - font.widthOfTextAtSize(totalText, 9), y: y - 12, size: 9, font: boldFont, color: colors.primary });

                    // Update main Y based on description height
                    y = Math.min(y - 20, descY - 15);
                    
                    // Row separator
                    page.drawLine({ start: { x: margin, y: y }, end: { x: width - margin, y: y }, thickness: 0.3, color: colors.border });
                    y -= 5;
                }

                // Total row
                y = checkPageBreak(y, 30);
                page.drawRectangle({ x: margin, y: y - 25, width: contentWidth, height: 25, color: rgb(0.9, 0.95, 0.9) });
                page.drawLine({ start: { x: margin, y: y - 25 }, end: { x: width - margin, y: y - 25 }, thickness: 1, color: colors.primary });
                
                page.drawText('TOTAL GÉNÉRAL:', { x: colDesc, y: y - 17, size: 11, font: boldFont, color: colors.primary });
                const totalText = `${totalAmount.toLocaleString('fr-FR', { minimumFractionDigits: 2 })} $`;
                page.drawText(totalText, { x: colTotal - 5 - font.widthOfTextAtSize(totalText, 11), y: y - 17, size: 11, font: boldFont, color: colors.primary });
                
                y -= 35;
                y -= 20;
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
                
                page.drawText('HISTORIQUE DES VALIDATIONS', { x: margin, y, size: 12, font: boldFont, color: colors.primary });
                y -= 5;
                page.drawLine({ start: { x: margin, y }, end: { x: width - margin, y }, thickness: 1, color: colors.border });
                y -= 20;

                // Table Header with better styling
                page.drawRectangle({ x: margin, y: y - 25, width: contentWidth, height: 25, color: rgb(0.95, 0.95, 0.95) });
                page.drawLine({ start: { x: margin, y: y - 25 }, end: { x: width - margin, y: y - 25 }, thickness: 1, color: colors.border });
                
                const colDate = margin + 8;
                const colAction = margin + 130;
                const colUser = margin + 240;
                const colNote = margin + 380;

                page.drawText('DATE', { x: colDate, y: y - 17, size: 10, font: boldFont, color: colors.primary });
                page.drawText('ACTION', { x: colAction, y: y - 17, size: 10, font: boldFont, color: colors.primary });
                page.drawText('INTERVENANT', { x: colUser, y: y - 17, size: 10, font: boldFont, color: colors.primary });
                page.drawText('NOTE', { x: colNote, y: y - 17, size: 10, font: boldFont, color: colors.primary });
                
                // Vertical lines for table
                page.drawLine({ start: { x: colAction - 5, y: y - 25 }, end: { x: colAction - 5, y: y - 5 }, thickness: 0.5, color: colors.border });
                page.drawLine({ start: { x: colUser - 5, y: y - 25 }, end: { x: colUser - 5, y: y - 5 }, thickness: 0.5, color: colors.border });
                page.drawLine({ start: { x: colNote - 5, y: y - 25 }, end: { x: colNote - 5, y: y - 5 }, thickness: 0.5, color: colors.border });
                
                y -= 35;

                for (const action of actions) {
                    y = checkPageBreak(y, 40);

                    // Row background alternating
                    if ((actions.indexOf(action) % 2) === 0) {
                        page.drawRectangle({ x: margin, y: y - 25, width: contentWidth, height: 25, color: rgb(0.98, 0.98, 0.98) });
                    }

                    // Format date properly
                    const date = new Date(action.created_at);
                    const dateStr = date.toLocaleDateString('fr-FR') + ' ' + date.toLocaleTimeString('fr-FR', {hour: '2-digit', minute:'2-digit'});
                    
                    page.drawText(dateStr, { x: colDate, y: y - 15, size: 9, font: font, color: colors.text });
                    
                    // Action with color coding
                    const actionText = action.action.toUpperCase();
                    let actionColor = colors.text;
                    if (actionText === 'VALIDER') actionColor = rgb(0.2, 0.6, 0.2);
                    else if (actionText === 'REFUSER') actionColor = rgb(0.8, 0.2, 0.2);
                    else if (actionText === 'MODIFIER') actionColor = rgb(0.8, 0.6, 0.2);
                    
                    page.drawText(actionText, { x: colAction, y: y - 15, size: 9, font: boldFont, color: actionColor });
                    
                    // User info
                    const userText = safeText(`${action.utilisateur_nom || 'Inconnu'} (${action.utilisateur_role || '-'})`);
                    const userY = drawWrappedText(userText, colUser, y - 15, 9, font, colNote - colUser - 15);

                    // Note with wrapping
                    if (action.commentaire) {
                        const noteText = safeText(action.commentaire);
                        const noteY = drawWrappedText(noteText, colNote, y - 15, 9, font, width - margin - colNote - 10);
                        y = Math.min(y - 25, userY - 10, noteY - 10);
                    } else {
                        page.drawText('-', { x: colNote, y: y - 15, size: 9, font: font, color: rgb(0.6, 0.6, 0.6) });
                        y = Math.min(y - 25, userY - 10);
                    }
                    
                    // Row separator
                    page.drawLine({ start: { x: margin, y: y }, end: { x: width - margin, y: y }, thickness: 0.3, color: colors.border });
                    y -= 5;
                }
                y -= 20;
            }

            // --- COMMENTS (MESSAGES) ---
            const messages = await dbUtils.all(`
                SELECT m.*, u.nom_complet as utilisateur_nom
                FROM messages m
                LEFT JOIN users u ON m.utilisateur_id = u.id
                WHERE m.requisition_id = ?
                ORDER BY m.created_at ASC
            `, [req.id]);

            if (messages.length > 0) {
                y = checkPageBreak(y, 100);

                page.drawText(`COMMENTAIRES (${messages.length})`, { x: margin, y, size: 12, font: boldFont, color: colors.primary });
                y -= 5;
                page.drawLine({ start: { x: margin, y }, end: { x: width - margin, y }, thickness: 1, color: colors.border });
                y -= 20;

                for (const msg of messages) {
                    y = checkPageBreak(y, 50);

                    // Header: User & Date
                    const dateStr = new Date(msg.created_at).toLocaleString();
                    const headText = safeText(`${msg.utilisateur_nom || 'Utilisateur'} - ${dateStr}`);
                    page.drawText(headText, { x: margin, y, size: 10, font: boldFont, color: colors.text });
                    y -= 15;

                    // Content Box
                    // Measure text height approx
                    // Just draw wrapped text
                    y = drawWrappedText(msg.contenu, margin + 10, y, 10, font, contentWidth - 20);
                    
                    y -= 10;
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
                page.drawText(`PIÈCES JOINTES (${attachments.length})`, { x: margin, y, size: 12, font: boldFont, color: colors.primary });
                y -= 20;

                for (const att of attachments) {
                    try {
                        const fileBytes = await StorageService.getFileBuffer(att.chemin_fichier);
                        
                        // Filename + Uploader info
                        const uploaderText = att.uploader_nom ? ` (Ajouté par: ${att.uploader_nom})` : '';
                        const fileLine = safeText(`• ${att.nom_fichier}${uploaderText}`);
                        page.drawText(fileLine, { x: margin + 10, y, size: 10, font, color: colors.primary });
                        y -= 15;

                        // Embed Logic
                        const ext = path.extname(att.nom_fichier).toLowerCase();
                        if (ext === '.pdf') {
                            const attachmentDoc = await PDFDocument.load(fileBytes);
                            const copiedPages = await mergedPdf.copyPages(attachmentDoc, attachmentDoc.getPageIndices());
                            copiedPages.forEach((cp) => {
                                const newPage = mergedPdf.addPage(cp);
                                try {
                                    // Add Header to attachment page
                                    const { width: npWidth, height: npHeight } = newPage.getSize();
                                    const headerText = safeText(`Annexe - Réquisition N° ${req.numero} - Initiateur : ${req.emetteur_nom || 'Inconnu'}`);
                                    newPage.drawText(headerText, {
                                        x: 50,
                                        y: npHeight - 30,
                                        size: 10,
                                        font: boldFont,
                                        color: colors.primary
                                    });
                                } catch (headerErr) {
                                    console.error('Erreur header PDF annexe:', headerErr);
                                }
                            });
                        } else if (['.jpg', '.jpeg', '.png'].includes(ext)) {
                            let img;
                            if (ext === '.png') img = await mergedPdf.embedPng(fileBytes);
                            else img = await mergedPdf.embedJpg(fileBytes);
                            
                            const imgPage = mergedPdf.addPage();
                            const { width: pgWidth, height: pgHeight } = imgPage.getSize();
                            
                            try {
                                // Add Header to image page
                                const headerText = safeText(`Annexe - Réquisition N° ${req.numero} - Initiateur : ${req.emetteur_nom || 'Inconnu'}`);
                                imgPage.drawText(headerText, {
                                    x: 50,
                                    y: pgHeight - 30,
                                    size: 10,
                                    font: boldFont,
                                    color: colors.primary
                                });
                            } catch (headerErr) {
                                console.error('Erreur header Image annexe:', headerErr);
                            }

                            const imgDims = img.scaleToFit(pgWidth - 100, pgHeight - 100);
                            imgPage.drawImage(img, {
                                x: (pgWidth - imgDims.width) / 2,
                                y: (pgHeight - imgDims.height) / 2,
                                width: imgDims.width,
                                height: imgDims.height,
                            });
                        }
                    } catch (err) {
                        console.error(`Erreur PJ ${att.nom_fichier}:`, err);
                        const errLine = safeText(`• ${att.nom_fichier} (Erreur de chargement)`);
                        page.drawText(errLine, { x: margin + 10, y, size: 10, font, color: rgb(0.8, 0, 0) });
                        y -= 15;
                    }
                }
            }
        }

        // --- GLOBAL PAGINATION ---
        const pages = mergedPdf.getPages();
        const totalPages = pages.length;
        for (let i = 0; i < totalPages; i++) {
            const p = pages[i];
            const { width } = p.getSize();
            p.drawText(`Page ${i + 1} / ${totalPages}`, {
                x: width - 80,
                y: 20,
                size: 9,
                font: font,
                color: rgb(0.5, 0.5, 0.5),
            });
        }

        return await mergedPdf.save();
    }
}

module.exports = new PdfService();
