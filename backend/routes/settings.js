const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { authenticateToken, requireRole } = require('../middleware/auth');

const { dbUtils } = require('../database/database');
const WorkflowService = require('../services/WorkflowService');

const StorageService = require('../services/StorageService');

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
// Configuration de multer pour l'upload de logo (MemoryStorage pour compatibilité StorageService)
const storage = multer.memoryStorage();

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
router.get('/logo', async (req, res) => {
  const extensions = ['.png', '.jpg', '.jpeg', '.gif'];
  let logoFile = null;
  
  for (const ext of extensions) {
    if (await StorageService.fileExists('logo' + ext)) {
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
router.post('/logo', authenticateToken, requireRole(['admin']), upload.single('logo'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'Aucun fichier téléchargé' });
        }
        
        // Supprimer les anciens logos avec des extensions différentes
        const extensions = ['.png', '.jpg', '.jpeg', '.gif'];
        const currentExt = path.extname(req.file.originalname).toLowerCase();
        
        for (const ext of extensions) {
            if (ext !== currentExt) {
                // On essaie de supprimer, on ignore si ça échoue (fichier n'existe pas)
                try {
                    await StorageService.deleteFile('logo' + ext);
                } catch (e) {
                    // Ignore
                }
            }
        }

        // Upload new logo with specific name
        const logoName = 'logo' + currentExt;
        // On passe le nom spécifique à uploadFile
        
        const result = await StorageService.uploadFile(req.file, logoName);

        res.json({ message: 'Logo mis à jour avec succès', url: `/uploads/${result.filename}` });
    } catch (error) {
        console.error('Erreur upload logo:', error);
        res.status(500).json({ error: 'Erreur lors de l\'upload du logo' });
    }
});

module.exports = router;
