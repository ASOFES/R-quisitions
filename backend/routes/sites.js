
const express = require('express');
const { dbUtils } = require('../database/database');
const { authenticateToken, requireRole } = require('../middleware/auth');

const router = express.Router();

// Get all sites
router.get('/', authenticateToken, async (req, res) => {
  try {
    const { all } = req.query;
    let query = 'SELECT * FROM sites';
    
    // Si all n'est pas "true", on filtre par actif = 1
    if (all !== 'true') {
      query += ' WHERE actif = 1';
    }
    
    query += ' ORDER BY nom';
    
    const sites = await dbUtils.all(query);
    res.json(sites);
  } catch (error) {
    console.error('Error fetching sites:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Create site (Admin only)
router.post('/', authenticateToken, requireRole(['admin']), async (req, res) => {
  const { nom, description } = req.body;

  if (!nom) {
    return res.status(400).json({ error: 'Le nom du site est obligatoire' });
  }

  try {
    const result = await dbUtils.run(
      'INSERT INTO sites (nom, description) VALUES (?, ?)',
      [nom, description]
    );
    res.status(201).json({ message: 'Site créé avec succès', id: result.id });
  } catch (error) {
    console.error('Error creating site:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Update site (Admin only)
router.put('/:id', authenticateToken, requireRole(['admin']), async (req, res) => {
  const { id } = req.params;
  const { nom, description, actif } = req.body;

  try {
    await dbUtils.run(
      'UPDATE sites SET nom = ?, description = ?, actif = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [nom, description, actif, id]
    );
    res.json({ message: 'Site mis à jour avec succès' });
  } catch (error) {
    console.error('Error updating site:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Delete site (Admin only - Check usage then Delete or Soft delete)
router.delete('/:id', authenticateToken, requireRole(['admin']), async (req, res) => {
  const { id } = req.params;

  try {
    // Vérifier si le site est utilisé
    const reqCount = await dbUtils.get('SELECT COUNT(*) as count FROM requisitions WHERE site_id = ?', [id]);
    const lineCount = await dbUtils.get('SELECT COUNT(*) as count FROM lignes_requisition WHERE site_id = ?', [id]);

    if (reqCount.count > 0 || lineCount.count > 0) {
      // Si utilisé, soft delete
      await dbUtils.run('UPDATE sites SET actif = 0, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [id]);
      res.json({ message: 'Site désactivé (car utilisé dans des réquisitions)' });
    } else {
      // Si non utilisé, suppression réelle
      await dbUtils.run('DELETE FROM sites WHERE id = ?', [id]);
      res.json({ message: 'Site supprimé définitivement' });
    }
  } catch (error) {
    console.error('Error deleting site:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
