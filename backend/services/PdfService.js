const { PDFDocument, rgb, StandardFonts } = require('pdf-lib');
const fs = require('fs');
const path = require('path');
const { dbUtils } = require('../database/database');

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
            const description = req.commentaire_initial || 'Aucun commentaire.';
            const words = description.split(' ');
            let line = '';
            for (const word of words) {
                if (font.widthOfTextAtSize(line + word, 12) > width - 100) {
                    page.drawText(line, { x: 50, y, size: 12, font });
                    y -= 15;
                    line = '';
                }
                line += word + ' ';
            }
            page.drawText(line, { x: 50, y, size: 12, font });
            y -= 40;

            // 2. Fetch and Embed Attachments
            const attachments = await dbUtils.all('SELECT * FROM pieces_jointes WHERE requisition_id = ?', [req.id]);

            if (attachments.length > 0) {
                page.drawText(`Pièces Jointes (${attachments.length}):`, { x: 50, y, size: 14, font: boldFont });
                y -= 20;
                
                for (const att of attachments) {
                    const filePath = path.join(__dirname, '../uploads', att.chemin_fichier); // Assumes chemin_fichier is just filename or relative path
                    
                    console.log(`[PdfService] Checking file: ${filePath}`);
                    console.log(`[PdfService] Exists: ${fs.existsSync(filePath)}`);

                    if (fs.existsSync(filePath)) {
                        page.drawText(`- ${att.nom_fichier} (Inclus ci-après)`, { x: 60, y, size: 10, font, color: rgb(0, 0.5, 0) });
                        y -= 15;

                        try {
                            const ext = path.extname(filePath).toLowerCase();
                            const fileBytes = fs.readFileSync(filePath);

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
                            // Log error on summary page
                            page.drawText(`  (Erreur d'intégration: ${err.message})`, { x: 80, y, size: 10, font, color: rgb(1, 0, 0) });
                        }
                    } else {
                        page.drawText(`- ${att.nom_fichier} (Fichier introuvable sur le serveur)`, { x: 60, y, size: 10, font, color: rgb(1, 0, 0) });
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
