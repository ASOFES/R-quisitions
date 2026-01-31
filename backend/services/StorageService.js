const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

class StorageService {
    constructor() {
        this.supabase = null;
        this.bucket = 'requisitions';
        this.uploadsDir = path.join(__dirname, '../uploads');
        
        // Ensure uploads directory exists for local storage
        if (!fs.existsSync(this.uploadsDir)) {
            fs.mkdirSync(this.uploadsDir, { recursive: true });
        }

        this.init();
    }

    init() {
        if (process.env.SUPABASE_URL && process.env.SUPABASE_KEY) {
            console.log('🔌 Initialisation de Supabase Storage...');
            this.supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);
            this.checkBucket();
        } else {
            console.log('📂 Utilisation du stockage local (dossier uploads)');
        }
    }

    async checkBucket() {
        if (!this.supabase) return;
        try {
            const { data, error } = await this.supabase.storage.getBucket(this.bucket);
            if (error && error.message.includes('not found')) {
                console.log(`🪣 Création du bucket '${this.bucket}'...`);
                await this.supabase.storage.createBucket(this.bucket, {
                    public: false
                });
            }
        } catch (err) {
            console.error('Erreur vérification bucket Supabase:', err.message);
        }
    }

    // Upload file (takes a multer file object)
    async uploadFile(file) {
        const fileName = `${Date.now()}-${Math.round(Math.random() * 1E9)}${path.extname(file.originalname)}`;
        
        if (this.supabase) {
            // Supabase Upload
            const { data, error } = await this.supabase.storage
                .from(this.bucket)
                .upload(fileName, file.buffer, {
                    contentType: file.mimetype
                });

            if (error) throw error;
            
            return {
                filename: fileName,
                path: data.path, // Supabase path
                storage: 'supabase'
            };
        } else {
            // Local Upload
            const filePath = path.join(this.uploadsDir, fileName);
            await fs.promises.writeFile(filePath, file.buffer);
            
            return {
                filename: fileName,
                path: fileName, // Local filename is the path relative to uploads/
                storage: 'local'
            };
        }
    }

    // Get file buffer (for PDF generation)
    async getFileBuffer(filename) {
        if (this.supabase) {
            const { data, error } = await this.supabase.storage
                .from(this.bucket)
                .download(filename);
            
            if (error) throw error;
            return Buffer.from(await data.arrayBuffer());
        } else {
            const filePath = path.join(this.uploadsDir, filename);
            if (!fs.existsSync(filePath)) {
                throw new Error('Fichier introuvable localement');
            }
            return fs.promises.readFile(filePath);
        }
    }

    // Delete file
    async deleteFile(filename) {
        if (this.supabase) {
            const { error } = await this.supabase.storage
                .from(this.bucket)
                .remove([filename]);
            if (error) throw error;
        } else {
            const filePath = path.join(this.uploadsDir, filename);
            if (fs.existsSync(filePath)) {
                await fs.promises.unlink(filePath);
            }
        }
    }
}

module.exports = new StorageService();
