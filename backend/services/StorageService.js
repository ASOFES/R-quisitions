const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

class StorageService {
    constructor() {
        this.supabaseUrl = process.env.SUPABASE_URL;
        this.supabaseKey = process.env.SUPABASE_KEY;
        this.bucket = 'requisitions'; // Nom standard sans accent
        
        // Initialisation Supabase si les clés sont présentes
        if (this.supabaseUrl && this.supabaseKey) {
            console.log('🔌 Initialisation de Supabase Storage...');
            this.supabase = createClient(this.supabaseUrl, this.supabaseKey);
        } else {
            console.log('⚠️ Pas de configuration Supabase. Stockage local uniquement.');
            this.supabase = null;
        }

        // Toujours assurer que le dossier local existe (fallback)
        this.uploadsDir = path.join(__dirname, '../uploads');
        if (!fs.existsSync(this.uploadsDir)) {
            fs.mkdirSync(this.uploadsDir, { recursive: true });
        }
    }

    async initBucket() {
        try {
            const { data: buckets, error: listError } = await this.supabase.storage.listBuckets();
            
            if (listError) {
                console.error('❌ Erreur lors du listing des buckets:', listError);
                return;
            }

            const bucketExists = buckets.some(b => b.name === this.bucket);

            if (!bucketExists) {
                console.log(`🪣 Création du bucket '${this.bucket}'...`);
                const { data, error } = await this.supabase.storage.createBucket(this.bucket, {
                    public: false,
                    fileSizeLimit: 10485760, // 10MB
                    allowedMimeTypes: ['image/png', 'image/jpeg', 'application/pdf']
                });
                
                if (error) {
                    console.error(`❌ Erreur création bucket '${this.bucket}':`, error);
                } else {
                    console.log(`✅ Bucket '${this.bucket}' créé avec succès.`);
                }
            } else {
                console.log(`✅ Bucket '${this.bucket}' existe déjà.`);
            }
        } catch (err) {
            console.error('❌ Exception initBucket:', err);
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
