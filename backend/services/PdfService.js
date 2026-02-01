const { PDFDocument, rgb, StandardFonts } = require('pdf-lib');
const fs = require('fs');
const path = require('path');
const { dbUtils } = require('../database/database');
const StorageService = require('./StorageService');

class PdfService {
    async compileRequisitionsPdf(requisitions) {
        const mergedPdf = await PDFDocument.create();
        const font = await mergedPdf.embedFont(StandardFonts.Helvetica);
        const boldFont = await mergedPdf.embedFont(StandardFonts.HelveticaBold);

        if (requisitions.length === 0) {
            const page = mergedPdf.addPage();
            page.drawText('Aucune réquisition trouvée.', { x: 50, y: 700, size: 20, font: boldFont });
            return await mergedPdf.save();
        }

        for (const req of requisitions) {
            // 1. Create Summary Page for the Requisition
            let page = mergedPdf.addPage();
            const { width, height } = page.getSize();
            let y = height - 50;

            // Header
            page.drawText(`Réquisition: ${req.numero}`, { x: 50, y, size: 24, font: boldFont, color: rgb(0, 0.53, 0.71) });
            y -= 40;

            // Details
            const drawField = (label, value) => {
                page.drawText(`${label}:`, { x: 50, y, size: 12, font: boldFont });
                page.drawText(`${value || 'N/A'}`, { x: 150, y, size: 12, font });
                y -= 20;
            };

            drawField('Objet', req.objet);
            drawField('Montant USD', `${req.montant_usd || 0} $`);
            drawField('Montant CDF', `${req.montant_cdf || 0} FC`);
            drawField('Émetteur', req.emetteur_nom);
            drawField('Service', req.service_nom || req.service_code);
            drawField('Date', new Date(req.created_at).toLocaleDateString());
            drawField('Statut', req.statut);
            drawField('Niveau Actuel', req.niveau);

            y -= 20;
            page.drawLine({
                start: { x: 50, y },
                end: { x: width - 50, y },
                thickness: 1,
                color: rgb(0.8, 0.8, 0.8),
            });
            y -= 30;

            // Description / Commentaire Initial
            page.drawText('Commentaire Initial:', { x: 50, y, size: 14, font: boldFont });
            y -= 20;
            
            // Basic text wrapping for description
            const drawWrappedText = (text, x, y, size, font, maxWidth) => {
                const words = (text || '').split(' ');
                let line = '';
                let currentY = y;
                for (const word of words) {
                    if (font.widthOfTextAtSize(line + word, size) > maxWidth) {
                        page.drawText(line, { x, y: currentY, size, font });
                        currentY -= size + 5;
                        line = '';
                        // Check for page break
                        if (currentY < 50) {
                             page = mergedPdf.addPage();
                             currentY = height - 50;
                        }
                    }
                    line += word + ' ';
                }
                page.drawText(line, { x, y: currentY, size, font });
                return currentY - 20;
            };

            y = drawWrappedText(req.commentaire_initial || 'Aucun commentaire.', 50, y, 12, font, width - 100);
            y -= 20;

            // 1.5 Fetch and Embed Workflow Messages (Comments)
            const messages = await dbUtils.all(`
                SELECT m.*, u.nom_complet as utilisateur_nom
                FROM messages m
                LEFT JOIN users u ON m.utilisateur_id = u.id
                WHERE m.requisition_id = ?
                ORDER BY m.created_at ASC
            `, [req.id]);

            if (messages.length > 0) {
                // Check if we need a new page for title
                if (y < 100) {
                    page = mergedPdf.addPage();
                    y = height - 50;
                }

                page.drawText(`Historique des Commentaires (${messages.length}):`, { x: 50, y, size: 14, font: boldFont });
                y -= 25;

                for (const msg of messages) {
                    // Check for page break before starting a message block
                    if (y < 80) {
                        page = mergedPdf.addPage();
                        y = height - 50;
                    }

                    // Header: User - Date
                    const dateStr = new Date(msg.created_at).toLocaleString();
                    page.drawText(`${msg.utilisateur_nom || 'Utilisateur inconnu'} - ${dateStr}`, { x: 50, y, size: 10, font: boldFont, color: rgb(0.3, 0.3, 0.3) });
                    y -= 15;

                    // Message content
                    y = drawWrappedText(msg.contenu, 60, y, 10, font, width - 110);
                    y -= 10; // Spacing between messages
                }
                y -= 20; // Spacing after section
            }

            // 2. Fetch and Embed Attachments
            const attachments = await dbUtils.all('SELECT * FROM pieces_jointes WHERE requisition_id = ?', [req.id]);

            if (attachments.length > 0) {
                if (y < 100) {
                    page = mergedPdf.addPage();
                    y = height - 50;
                }
                page.drawText(`Pièces Jointes (${attachments.length}):`, { x: 50, y, size: 14, font: boldFont });
                y -= 20;
                
                for (const att of attachments) {
                    try {
                        const fileBytes = await StorageService.getFileBuffer(att.chemin_fichier);
                        
                        page.drawText(`- ${att.nom_fichier} (Inclus ci-après)`, { x: 60, y, size: 10, font, color: rgb(0, 0.5, 0) });
                        y -= 15;

                        const ext = path.extname(att.nom_fichier).toLowerCase();
                        
                        if (ext === '.pdf') {
                            const attachmentDoc = await PDFDocument.load(fileBytes);
                            const copiedPages = await mergedPdf.copyPages(attachmentDoc, attachmentDoc.getPageIndices());
                            copiedPages.forEach((cp) => mergedPdf.addPage(cp));
                        } else if (['.jpg', '.jpeg', '.png'].includes(ext)) {
                            let img;
                            if (ext === '.png') {
                                img = await mergedPdf.embedPng(fileBytes);
                            } else {
                                img = await mergedPdf.embedJpg(fileBytes);
                            }
                            
                            const imgPage = mergedPdf.addPage();
                            const { width: pgWidth, height: pgHeight } = imgPage.getSize();
                            
                            // Scale image to fit page
                            const imgDims = img.scaleToFit(pgWidth - 50, pgHeight - 50);
                            
                            imgPage.drawImage(img, {
                                x: (pgWidth - imgDims.width) / 2,
                                y: (pgHeight - imgDims.height) / 2,
                                width: imgDims.width,
                                height: imgDims.height,
                            });
                        }
                    } catch (err) {
                        console.error(`Erreur intégration pièce jointe ${att.nom_fichier}:`, err);
                         page.drawText(`- ${att.nom_fichier} (Fichier introuvable ou erreur)`, { x: 60, y, size: 10, font, color: rgb(1, 0, 0) });
                         y -= 15;
                    }
                }
            } else {
                page.drawText('Aucune pièce jointe.', { x: 50, y, size: 12, font, color: rgb(0.5, 0.5, 0.5) });
            }
        }

        return await mergedPdf.save();
    }
}

module.exports = new PdfService();
