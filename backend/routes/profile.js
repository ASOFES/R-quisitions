const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const bcrypt = require('bcryptjs');
const { dbUtils } = require('../database/database');
const { authenticateToken } = require('../middleware/auth');
const StorageService = require('../services/StorageService');

const router = express.Router();

// Configuration Multer pour le stockage des fichiers
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadDir = path.join(__dirname, '../uploads');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({ 
  storage: storage,
  limits: {
    fileSize: 5 * 1024 * 1024 // Limite à 5MB
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|gif/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);
    if (extname && mimetype) {
      return cb(null, true);
    } else {
      cb(new Error('Seules les images sont autorisées (jpeg, jpg, png, gif)'));
    }
  }
});

// GET /api/profile
// Récupérer le profil de l'utilisateur connecté
router.get('/', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const user = await dbUtils.get(
      'SELECT id, username, nom_complet, email, role, service_id, zone_id, signature_url, created_at FROM users WHERE id = ?',
      [userId]
    );

    if (!user) {
      return res.status(404).json({ error: 'Utilisateur non trouvé' });
    }

    // Récupérer infos service et zone si disponibles
    if (user.service_id) {
        const service = await dbUtils.get('SELECT nom FROM services WHERE id = ?', [user.service_id]);
        user.service_nom = service ? service.nom : null;
    }
    
    if (user.zone_id) {
        const zone = await dbUtils.get('SELECT nom FROM zones WHERE id = ?', [user.zone_id]);
        user.zone_nom = zone ? zone.nom : null;
    }

    res.json(user);
  } catch (error) {
    console.error('Erreur récupération profil:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// PUT /api/profile
// Mettre à jour les informations du profil (mot de passe, email, nom)
router.put('/', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const { nom_complet, email, password, new_password } = req.body;

    // Vérifier l'utilisateur
    const user = await dbUtils.get('SELECT * FROM users WHERE id = ?', [userId]);
    if (!user) {
      return res.status(404).json({ error: 'Utilisateur non trouvé' });
    }

    let updates = [];
    let params = [];

    // Mise à jour infos de base
    if (nom_complet) {
        updates.push('nom_complet = ?');
        params.push(nom_complet);
    }
    
    if (email) {
        // Vérifier unicité email si changé
        if (email !== user.email) {
            const existingEmail = await dbUtils.get('SELECT id FROM users WHERE email = ? AND id != ?', [email, userId]);
            if (existingEmail) {
                return res.status(400).json({ error: 'Cet email est déjà utilisé' });
            }
        }
        updates.push('email = ?');
        params.push(email);
    }

    // Changement de mot de passe
    if (new_password) {
        if (!password) {
            return res.status(400).json({ error: 'Mot de passe actuel requis pour changer le mot de passe' });
        }
        
        const validPassword = await bcrypt.compare(password, user.password);
        if (!validPassword) {
            return res.status(401).json({ error: 'Mot de passe actuel incorrect' });
        }

        const hashedPassword = await bcrypt.hash(new_password, 10);
        updates.push('password = ?');
        params.push(hashedPassword);
    }

    if (updates.length === 0) {
        return res.json({ message: 'Aucune modification' });
    }

    updates.push('updated_at = CURRENT_TIMESTAMP');
    
    const query = `UPDATE users SET ${updates.join(', ')} WHERE id = ?`;
    params.push(userId);

    await dbUtils.run(query, params);

    res.json({ message: 'Profil mis à jour avec succès' });

  } catch (error) {
    console.error('Erreur mise à jour profil:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// POST /api/profile/signature
// Upload de la signature
router.post('/signature', authenticateToken, upload.single('signature'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'Aucun fichier fourni' });
    }

    const userId = req.user.id;
    
    // Upload vers Supabase (si configuré) ou garder local
    let fileUrl = `/uploads/${req.file.filename}`;
    
    try {
        if (process.env.SUPABASE_URL) {
             const publicUrl = await StorageService.uploadFile(req.file);
             if (publicUrl) {
                 fileUrl = publicUrl;
                 // Optionnel: supprimer le fichier local après upload réussi
                 // fs.unlinkSync(req.file.path);
             }
        }
    } catch (e) {
        console.warn('Echec upload Supabase, utilisation fichier local:', e.message);
    }

    await dbUtils.run('UPDATE users SET signature_url = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [fileUrl, userId]);

    res.json({ 
        message: 'Signature mise à jour avec succès', 
        signature_url: fileUrl 
    });

  } catch (error) {
    console.error('Erreur upload signature:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

module.exports = router;
