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

    // initBucket supprimé pour éviter les erreurs 403 sur Render/Supabase (création manuelle requise)


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

    // Check if file exists
    async fileExists(filename) {
        if (this.supabase) {
            const { data, error } = await this.supabase.storage
                .from(this.bucket)
                .list('', {
                    limit: 1,
                    search: filename
                });
            
            if (error) return false;
            // Exact match check
            return data && data.length > 0 && data.some(f => f.name === filename);
        } else {
            const filePath = path.join(this.uploadsDir, filename);
            return fs.existsSync(filePath);
        }
    }
}

module.exports = new StorageService();
