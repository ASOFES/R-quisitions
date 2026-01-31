const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');
const { PDFDocument, rgb, StandardFonts } = require('pdf-lib');

const dbPath = path.join(__dirname, 'database/requisition.db');
const db = new sqlite3.Database(dbPath);
const uploadsDir = path.join(__dirname, 'uploads');

// Ensure uploads directory exists
if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir);
}

const runQuery = (query, params = []) => {
    return new Promise((resolve, reject) => {
        db.run(query, params, function(err) {
            if (err) reject(err);
            else resolve(this);
        });
    });
};

const getQuery = (query, params = []) => {
    return new Promise((resolve, reject) => {
        db.get(query, params, (err, row) => {
            if (err) reject(err);
            else resolve(row);
        });
    });
};

const createDummyPdf = async (filename, text) => {
    const pdfDoc = await PDFDocument.create();
    const page = pdfDoc.addPage();
    const { width, height } = page.getSize();
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);

    page.drawText(text, {
        x: 50,
        y: height - 200,
        size: 30,
        font: font,
        color: rgb(0, 0, 0),
    });

    const pdfBytes = await pdfDoc.save();
    fs.writeFileSync(path.join(uploadsDir, filename), pdfBytes);
    return filename;
};

// Create a simple red square PNG
const createDummyPng = (filename) => {
    // 1x1 Red Pixel Base64
    const base64Png = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
    const buffer = Buffer.from(base64Png, 'base64');
    fs.writeFileSync(path.join(uploadsDir, filename), buffer);
    return filename;
};

const simulateData = async () => {
    try {
        console.log('Début de la simulation...');

        // 1. Get an Admin or Emetteur ID
        let user = await getQuery("SELECT id FROM users WHERE role = 'admin' LIMIT 1");
        if (!user) {
            // Create dummy user if none
            await runQuery("INSERT INTO users (username, password, role, nom_complet) VALUES (?, ?, ?, ?)", ['sim_admin', 'admin', 'admin', 'Simulation Admin']);
            user = await getQuery("SELECT id FROM users WHERE username = 'sim_admin'");
        }
        
        // Get a service
        let service = await getQuery("SELECT id FROM services LIMIT 1");
        if (!service) {
            await runQuery("INSERT INTO services (code, nom) VALUES (?, ?)", ['IT', 'Informatique']);
            service = await getQuery("SELECT id FROM services WHERE code = 'IT'");
        }

        const userId = user.id;
        const serviceId = service.id;

        // 2. Create Requisition 1: Achat Ordinateurs (PDF Attachment)
        console.log('Création Réquisition 1...');
        const req1Result = await runQuery(`
            INSERT INTO requisitions (numero, objet, montant_usd, montant_cdf, emetteur_id, service_id, statut, niveau, created_at, commentaire_initial)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), ?)
        `, [`REQ-${Date.now()}-1`, 'Achat Nouveaux Laptops', 5000, 0, userId, serviceId, 'en_cours', 'validateur', 'Besoin urgent pour les nouveaux développeurs.']);
        
        const req1Id = req1Result.lastID;
        const file1 = await createDummyPdf(`devis_laptops_${req1Id}.pdf`, 'DEVIS LAPTOPS - 5000$');
        await runQuery(`INSERT INTO pieces_jointes (requisition_id, nom_fichier, chemin_fichier, uploaded_by) VALUES (?, ?, ?, ?)`, [req1Id, 'devis_laptops.pdf', file1, userId]);


        // 3. Create Requisition 2: Réparation (Image Attachment)
        console.log('Création Réquisition 2...');
        const req2Result = await runQuery(`
            INSERT INTO requisitions (numero, objet, montant_usd, montant_cdf, emetteur_id, service_id, statut, niveau, created_at, commentaire_initial)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), ?)
        `, [`REQ-${Date.now()}-2`, 'Réparation Groupe Électrogène', 200, 0, userId, serviceId, 'en_cours', 'validateur', 'Le groupe ne démarre plus. Voir photo de la pièce défectueuse.']);
        
        const req2Id = req2Result.lastID;
        const file2 = createDummyPng(`photo_panne_${req2Id}.png`);
        await runQuery(`INSERT INTO pieces_jointes (requisition_id, nom_fichier, chemin_fichier, uploaded_by) VALUES (?, ?, ?, ?)`, [req2Id, 'photo_panne.png', file2, userId]);


        // 4. Create Requisition 3: Fournitures (Multiple Attachments)
        console.log('Création Réquisition 3...');
        const req3Result = await runQuery(`
            INSERT INTO requisitions (numero, objet, montant_usd, montant_cdf, emetteur_id, service_id, statut, niveau, created_at, commentaire_initial)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), ?)
        `, [`REQ-${Date.now()}-3`, 'Fournitures de Bureau', 150, 0, userId, serviceId, 'en_cours', 'validateur', 'Papier, encre, stylos pour le trimestre.']);
        
        const req3Id = req3Result.lastID;
        const file3a = await createDummyPdf(`liste_besoins_${req3Id}.pdf`, 'LISTE DES BESOINS - 150$');
        const file3b = await createDummyPdf(`facture_proforma_${req3Id}.pdf`, 'FACTURE PROFORMA - 150$');
        
        await runQuery(`INSERT INTO pieces_jointes (requisition_id, nom_fichier, chemin_fichier, uploaded_by) VALUES (?, ?, ?, ?)`, [req3Id, 'liste_besoins.pdf', file3a, userId]);
        await runQuery(`INSERT INTO pieces_jointes (requisition_id, nom_fichier, chemin_fichier, uploaded_by) VALUES (?, ?, ?, ?)`, [req3Id, 'facture_proforma.pdf', file3b, userId]);

        console.log('Simulation terminée avec succès !');
        db.close();

    } catch (error) {
        console.error('Erreur simulation:', error);
    }
};

simulateData();
