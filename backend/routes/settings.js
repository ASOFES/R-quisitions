const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { authenticateToken, requireRole } = require('../middleware/auth');

const { dbUtils } = require('../database/database');
const WorkflowService = require('../services/WorkflowService');

const router = express.Router();

// --- Workflow Settings Routes ---

// Get all workflow settings
router.get('/workflow', authenticateToken, requireRole(['admin']), async (req, res) => {
    try {
        const settings = await WorkflowService.getSettings();
        res.json(settings);
    } catch (error) {
        res.status(500).json({ error: 'Erreur récupération configuration workflow' });
    }
});

// Update workflow settings
router.post('/workflow', authenticateToken, requireRole(['admin']), async (req, res) => {
    try {
        const { settings } = req.body; // Expect { 'analyste': 120, 'gm': 1440 }
        
        if (!settings) return res.status(400).json({ error: 'Données manquantes' });

        for (const [niveau, delai] of Object.entries(settings)) {
            await WorkflowService.updateSetting(niveau, parseInt(delai));
        }

        res.json({ message: 'Configuration mise à jour avec succès' });
    } catch (error) {
        console.error('Erreur update workflow:', error);
        res.status(500).json({ error: 'Erreur mise à jour configuration' });
    }
});

// --- Existing Logo Routes ---
// Configuration de multer pour l'upload de logo
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(__dirname, '../uploads');
    if (!fs.existsSync(uploadDir)){
        fs.mkdirSync(uploadDir);
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    // On garde l'extension d'origine en minuscule
    cb(null, 'logo' + path.extname(file.originalname).toLowerCase());
  }
});

const upload = multer({
  storage: storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpg|jpeg|png|gif/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);
    if (mimetype && extname) {
      return cb(null, true);
    }
    cb(new Error('Images uniquement (jpg, jpeg, png, gif)'));
  }
});

// Obtenir le logo actuel
router.get('/logo', (req, res) => {
  const extensions = ['.png', '.jpg', '.jpeg', '.gif'];
  let logoFile = null;
  
  for (const ext of extensions) {
    if (fs.existsSync(path.join(__dirname, '../uploads', 'logo' + ext))) {
      logoFile = 'logo' + ext;
      break;
    }
  }

  // Ajouter un timestamp pour éviter le cache navigateur lors des mises à jour
  if (logoFile) {
    res.json({ url: `/uploads/${logoFile}?t=${Date.now()}` });
  } else {
    res.json({ url: null });
  }
});

// Upload nouveau logo
router.post('/logo', authenticateToken, requireRole(['admin']), upload.single('logo'), (req, res) => {
    if (!req.file) {
        return res.status(400).json({ error: 'Aucun fichier téléchargé' });
    }
    
    // Supprimer les anciens logos avec des extensions différentes
    const extensions = ['.png', '.jpg', '.jpeg', '.gif'];
    const currentExt = path.extname(req.file.originalname);
    
    extensions.forEach(ext => {
        if (ext !== currentExt) {
            const oldPath = path.join(__dirname, '../uploads', 'logo' + ext);
            if (fs.existsSync(oldPath)) {
                fs.unlinkSync(oldPath);
            }
        }
    });

    res.json({ message: 'Logo mis à jour avec succès', url: `/uploads/logo${currentExt}` });
});

module.exports = router;
