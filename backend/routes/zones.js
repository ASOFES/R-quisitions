const express = require('express');
const { dbUtils } = require('../database/database');
const { authenticateToken, requireRole } = require('../middleware/auth');

const router = express.Router();

// Obtenir toutes les zones
router.get('/', authenticateToken, async (req, res) => {
  try {
    const zones = await dbUtils.all('SELECT * FROM zones ORDER BY nom');
    res.json(zones);
  } catch (error) {
    console.error('Erreur lors de la récupération des zones:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// Créer une zone (admin seulement)
router.post('/', authenticateToken, requireRole(['admin']), async (req, res) => {
  try {
    const { code, nom, description } = req.body;

    if (!code || !nom) {
      return res.status(400).json({ error: 'Code et nom sont obligatoires' });
    }

    // Vérifier si le code existe déjà
    const existingZone = await dbUtils.get('SELECT id FROM zones WHERE code = ?', [code]);
    if (existingZone) {
      return res.status(400).json({ error: 'Ce code de zone existe déjà' });
    }

    const result = await dbUtils.run(
      'INSERT INTO zones (code, nom, description) VALUES (?, ?, ?)',
      [code, nom, description]
    );

    res.status(201).json({
      message: 'Zone créée avec succès',
      id: result.id,
      code,
      nom,
      description
    });
  } catch (error) {
    console.error('Erreur lors de la création de la zone:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// Modifier une zone (admin seulement)
router.put('/:id', authenticateToken, requireRole(['admin']), async (req, res) => {
  try {
    const { id } = req.params;
    const { code, nom, description } = req.body;

    const existingZone = await dbUtils.get('SELECT id FROM zones WHERE id = ?', [id]);
    if (!existingZone) {
      return res.status(404).json({ error: 'Zone non trouvée' });
    }

    if (code) {
      const codeCheck = await dbUtils.get('SELECT id FROM zones WHERE code = ? AND id != ?', [code, id]);
      if (codeCheck) {
        return res.status(400).json({ error: 'Ce code de zone existe déjà' });
      }
    }

    let updates = [];
    let params = [];

    if (code) {
      updates.push('code = ?');
      params.push(code);
    }
    if (nom) {
      updates.push('nom = ?');
      params.push(nom);
    }
    if (description !== undefined) {
      updates.push('description = ?');
      params.push(description);
    }
    
    updates.push('updated_at = CURRENT_TIMESTAMP');
    params.push(id);

    await dbUtils.run(
      `UPDATE zones SET ${updates.join(', ')} WHERE id = ?`,
      params
    );

    res.json({ message: 'Zone mise à jour avec succès' });
  } catch (error) {
    console.error('Erreur lors de la modification de la zone:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// Supprimer une zone (admin seulement - suppression définitive)
router.delete('/:id', authenticateToken, requireRole(['admin']), async (req, res) => {
  try {
    const { id } = req.params;

    // Détacher d'abord les utilisateurs liés à cette zone
    await dbUtils.run('UPDATE users SET zone_id = NULL, updated_at = CURRENT_TIMESTAMP WHERE zone_id = ?', [id]);

    await dbUtils.run('DELETE FROM zones WHERE id = ?', [id]);
    res.json({ message: 'Zone supprimée définitivement' });
  } catch (error) {
    console.error('Erreur lors de la suppression de la zone:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

module.exports = router;
