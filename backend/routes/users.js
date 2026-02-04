const express = require('express');
const bcrypt = require('bcryptjs');
const { dbUtils } = require('../database/database');
const { authenticateToken, requireRole } = require('../middleware/auth');

const router = express.Router();

// Obtenir tous les utilisateurs (admin seulement)
router.get('/', authenticateToken, requireRole(['admin']), async (req, res) => {
  try {
    const users = await dbUtils.all(`
      SELECT 
        u.id, u.username, u.nom_complet, u.email, u.role, u.actif, u.created_at,
        u.service_id, u.zone_id,
        s.code as service_code, s.nom as service_nom,
        z.code as zone_code, z.nom as zone_nom
      FROM users u 
      LEFT JOIN services s ON u.service_id = s.id 
      LEFT JOIN zones z ON u.zone_id = z.id
      ORDER BY u.created_at DESC
    `);

    res.json(users);
  } catch (error) {
    console.error('Erreur lors de la récupération des utilisateurs:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// Créer un utilisateur (admin seulement)
router.post('/', authenticateToken, requireRole(['admin']), async (req, res) => {
  try {
    const { username, password, nom_complet, email, role, service_id, zone_id } = req.body;

    if (!username || !password || !nom_complet || !role) {
      return res.status(400).json({ error: 'Champs obligatoires manquants' });
    }

    // Vérifier si l'utilisateur existe déjà
    const existingUser = await dbUtils.get('SELECT id FROM users WHERE username = ?', [username]);
    if (existingUser) {
      return res.status(400).json({ error: 'Ce nom d\'utilisateur existe déjà' });
    }

    // Hasher le mot de passe
    const hashedPassword = await bcrypt.hash(password, 10);

    // Insérer l'utilisateur
    const result = await dbUtils.run(
      'INSERT INTO users (username, password, nom_complet, email, role, service_id, zone_id) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [username, hashedPassword, nom_complet, email, role, service_id || null, zone_id || null]
    );

    res.status(201).json({
      message: 'Utilisateur créé avec succès',
      userId: result.id
    });
  } catch (error) {
    console.error('Erreur lors de la création de l\'utilisateur:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// Modifier un utilisateur (admin seulement)
router.put('/:id', authenticateToken, requireRole(['admin']), async (req, res) => {
  try {
    const { id } = req.params;
    const { username, nom_complet, email, role, service_id, zone_id, actif, password } = req.body;

    // Vérifier si l'utilisateur existe
    const existingUser = await dbUtils.get('SELECT id FROM users WHERE id = ?', [id]);
    if (!existingUser) {
      return res.status(404).json({ error: 'Utilisateur non trouvé' });
    }

    // Vérifier si le nouveau username est déjà utilisé
    if (username) {
      const usernameCheck = await dbUtils.get('SELECT id FROM users WHERE username = ? AND id != ?', [username, id]);
      if (usernameCheck) {
        return res.status(400).json({ error: 'Ce nom d\'utilisateur existe déjà' });
      }
    }

    // Construire la requête de mise à jour
    let updateQuery = 'UPDATE users SET ';
    let updateParams = [];
    let updates = [];

    if (username) {
      updates.push('username = ?');
      updateParams.push(username);
    }
    if (nom_complet) {
      updates.push('nom_complet = ?');
      updateParams.push(nom_complet);
    }
    if (email) {
      updates.push('email = ?');
      updateParams.push(email);
    }
    if (role) {
      updates.push('role = ?');
      updateParams.push(role);
    }
    if (service_id !== undefined) {
      updates.push('service_id = ?');
      updateParams.push(service_id || null);
    }
    if (zone_id !== undefined) {
      updates.push('zone_id = ?');
      updateParams.push(zone_id || null);
    }
    if (actif !== undefined) {
      updates.push('actif = ?');
      updateParams.push(actif);
    }
    if (password) {
      const hashedPassword = await bcrypt.hash(password, 10);
      updates.push('password = ?');
      updateParams.push(hashedPassword);
    }

    updates.push('updated_at = CURRENT_TIMESTAMP');
    updateQuery += updates.join(', ') + ' WHERE id = ?';
    updateParams.push(id);

    await dbUtils.run(updateQuery, updateParams);

    res.json({ message: 'Utilisateur mis à jour avec succès' });
  } catch (error) {
    console.error('Erreur lors de la mise à jour de l\'utilisateur:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// Supprimer définitivement un utilisateur (admin seulement)
router.delete('/:id', authenticateToken, requireRole(['admin']), async (req, res) => {
  try {
    const { id } = req.params;

    // Vérifier si l'utilisateur existe
    const existingUser = await dbUtils.get('SELECT id FROM users WHERE id = ?', [id]);
    if (!existingUser) {
      return res.status(404).json({ error: 'Utilisateur non trouvé' });
    }

    // Supprimer définitivement l'utilisateur
    await dbUtils.run('DELETE FROM users WHERE id = ?', [id]);

    res.json({ message: 'Utilisateur supprimé définitivement' });
  } catch (error) {
    console.error('Erreur lors de la désactivation de l\'utilisateur:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

module.exports = router;
