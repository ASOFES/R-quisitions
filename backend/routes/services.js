const express = require('express');
const { dbUtils } = require('../database/database');
const { authenticateToken, requireRole } = require('../middleware/auth');

const router = express.Router();

// Obtenir tous les services
router.get('/', authenticateToken, async (req, res) => {
  try {
    const services = await dbUtils.all(
      'SELECT * FROM services WHERE actif = 1 ORDER BY nom'
    );

    res.json(services);
  } catch (error) {
    console.error('Erreur lors de la récupération des services:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// Obtenir tous les services (admin seulement - inclut les inactifs)
router.get('/all', authenticateToken, requireRole(['admin']), async (req, res) => {
  try {
    const services = await dbUtils.all(
      'SELECT * FROM services ORDER BY nom'
    );

    res.json(services);
  } catch (error) {
    console.error('Erreur lors de la récupération des services:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// Créer un service (admin seulement)
router.post('/', authenticateToken, requireRole(['admin']), async (req, res) => {
  try {
    console.log('Requête de création de service reçue:', req.body);
    const { code, nom, description } = req.body;

    if (!code || !nom) {
      console.log('Erreur: Code ou nom manquant');
      return res.status(400).json({ error: 'Code et nom du service sont obligatoires' });
    }

    // Vérifier si le service existe déjà (uniquement les services actifs)
    console.log('Vérification si le service existe déjà avec le code:', code);
    const existingService = await dbUtils.get('SELECT id FROM services WHERE code = ? AND actif = 1', [code]);
    if (existingService) {
      console.log('Erreur: Code de service déjà existant');
      return res.status(400).json({ error: 'Ce code de service existe déjà' });
    }

    // Insérer le service
    console.log('Insertion du service dans la base de données');
    const result = await dbUtils.run(
      'INSERT INTO services (code, nom, description) VALUES (?, ?, ?)',
      [code, nom, description]
    );

    console.log('Service créé avec succès, ID:', result.id);
    res.status(201).json({
      message: 'Service créé avec succès',
      serviceId: result.id
    });
  } catch (error) {
    console.error('Erreur lors de la création du service:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// Modifier un service (admin seulement)
router.put('/:id', authenticateToken, requireRole(['admin']), async (req, res) => {
  try {
    const { id } = req.params;
    const { code, nom, description, actif } = req.body;

    // Vérifier si le service existe
    const existingService = await dbUtils.get('SELECT id FROM services WHERE id = ?', [id]);
    if (!existingService) {
      return res.status(404).json({ error: 'Service non trouvé' });
    }

    // Vérifier si le nouveau code est déjà utilisé (uniquement les services actifs)
    if (code) {
      const codeCheck = await dbUtils.get('SELECT id FROM services WHERE code = ? AND id != ? AND actif = TRUE', [code, id]);
      if (codeCheck) {
        return res.status(400).json({ error: 'Ce code de service existe déjà' });
      }
    }

    // Construire la requête de mise à jour
    let updateQuery = 'UPDATE services SET ';
    let updateParams = [];
    let updates = [];

    if (code) {
      updates.push('code = ?');
      updateParams.push(code);
    }
    if (nom) {
      updates.push('nom = ?');
      updateParams.push(nom);
    }
    if (description !== undefined) {
      updates.push('description = ?');
      updateParams.push(description);
    }
    if (actif !== undefined) {
      updates.push('actif = ?');
      updateParams.push(actif);
    }

    updates.push('updated_at = CURRENT_TIMESTAMP');
    updateQuery += updates.join(', ') + ' WHERE id = ?';
    updateParams.push(id);

    await dbUtils.run(updateQuery, updateParams);

    res.json({ message: 'Service mis à jour avec succès' });
  } catch (error) {
    console.error('Erreur lors de la mise à jour du service:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// Supprimer un service (admin seulement)
router.delete('/:id', authenticateToken, requireRole(['admin']), async (req, res) => {
  try {
    const { id } = req.params;

    // Vérifier si le service existe
    const existingService = await dbUtils.get('SELECT id FROM services WHERE id = ?', [id]);
    if (!existingService) {
      return res.status(404).json({ error: 'Service non trouvé' });
    }

    // Supprimer définitivement le service
    await dbUtils.run('DELETE FROM services WHERE id = ?', [id]);

    res.json({ message: 'Service supprimé avec succès' });
  } catch (error) {
    console.error('Erreur lors de la suppression du service:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

module.exports = router;
