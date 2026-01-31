const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { dbUtils, dbReady } = require('../database/database');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

// Route de connexion simple (contournement du problème JSON)
router.post('/login-simple', async (req, res) => {
  try {
    // Attendre que la base de données soit prête
    await dbReady;

    console.log('Requête reçue via login-simple:', req.body);
    
    const { username, password } = req.body;
    
    console.log('Username:', username);
    console.log('Password:', password);
    
    // Vérifier dans la base de données
    const user = await dbUtils.get('SELECT * FROM users WHERE username = ? AND actif = TRUE', [username]);
    
    console.log('Utilisateur trouvé:', user);
    
    if (!user) {
      console.log('Utilisateur non trouvé');
      return res.status(401).json({ error: 'Utilisateur non trouvé' });
    }
    
    // Vérifier le mot de passe avec bcrypt
    const validPassword = await bcrypt.compare(password, user.password);
    
    if (!validPassword) {
      console.log('Mot de passe incorrect');
      return res.status(401).json({ error: 'Mot de passe incorrect' });
    }
    
    console.log('Mot de passe correct, génération du token');
    
    const token = jwt.sign(
      { userId: user.id, username: user.username, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    );

    console.log('Connexion réussie pour:', user.username, 'rôle:', user.role);

    res.json({
      message: 'Connexion réussie',
      token,
      user: {
        id: user.id,
        username: user.username,
        nom_complet: user.nom_complet || `${user.username}`,
        email: user.email || `${user.username}@entreprise.com`,
        role: user.role,
        service_id: user.service_id,
        service_code: user.service_code,
        service_nom: user.service_nom,
        zone_id: user.zone_id,
        zone_code: user.zone_code,
        zone_nom: user.zone_nom,
        actif: user.actif,
        created_at: user.created_at,
        updated_at: user.updated_at
      }
    });
  } catch (error) {
    console.error('Erreur de connexion simple:', error);
    res.status(500).json({ error: 'Erreur serveur', details: error.message });
  }
});

// Route de connexion
router.post('/login', async (req, res) => {
  try {
    console.log('Requête reçue:', req.body);
    
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ error: 'Nom d\'utilisateur et mot de passe requis' });
    }

    // Récupérer l'utilisateur
    const user = await dbUtils.get(
      'SELECT u.*, s.code as service_code, s.nom as service_nom, z.code as zone_code, z.nom as zone_nom FROM users u LEFT JOIN services s ON u.service_id = s.id LEFT JOIN zones z ON u.zone_id = z.id WHERE u.username = ? AND u.actif = TRUE',
      [username]
    );

    if (!user) {
      return res.status(401).json({ error: 'Nom d\'utilisateur ou mot de passe incorrect' });
    }

    console.log('Utilisateur trouvé:', user.username, 'Mot de passe DB:', user.password, 'Mot de passe fourni:', password);

    // Vérifier le mot de passe
    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword) {
      console.log('Mot de passe incorrect pour', username);
      return res.status(401).json({ error: 'Nom d\'utilisateur ou mot de passe incorrect' });
    }

    // Créer le token JWT
    const token = jwt.sign(
      { userId: user.id, username: user.username, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    );

    // Retourner les informations de l'utilisateur (sans le mot de passe)
    const { password: _, ...userWithoutPassword } = user;

    console.log('Connexion réussie pour:', user.username);

    res.json({
      message: 'Connexion réussie',
      token,
      user: userWithoutPassword
    });
  } catch (error) {
    console.error('Erreur de connexion:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// Route de rafraîchissement du token
router.post('/refresh', authenticateToken, async (req, res) => {
  try {
    const user = req.user;

    // Créer un nouveau token
    const token = jwt.sign(
      { userId: user.id, username: user.username, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    );

    res.json({
      message: 'Token rafraîchi',
      token,
      user: {
        id: user.id,
        username: user.username,
        nom_complet: user.nom_complet,
        email: user.email,
        role: user.role,
        service_code: user.service_code,
        service_nom: user.service_nom,
        zone_id: user.zone_id,
        zone_code: user.zone_code,
        zone_nom: user.zone_nom
      }
    });
  } catch (error) {
    console.error('Erreur de rafraîchissement:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// Route de vérification du token
router.get('/verify', authenticateToken, (req, res) => {
  const { password: _, ...userWithoutPassword } = req.user;
  res.json({
    message: 'Token valide',
    user: userWithoutPassword
  });
});

module.exports = router;
