const jwt = require('jsonwebtoken');
const { dbUtils } = require('../database/database');

// Middleware d'authentification
const authenticateToken = async (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Token requis' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    // Récupérer les informations de l'utilisateur
    const user = await dbUtils.get(
      'SELECT u.*, s.code as service_code, s.nom as service_nom, z.code as zone_code, z.nom as zone_nom FROM users u LEFT JOIN services s ON u.service_id = s.id LEFT JOIN zones z ON u.zone_id = z.id WHERE u.id = ? AND u.actif = 1',
      [decoded.userId]
    );

    if (!user) {
      return res.status(401).json({ error: 'Utilisateur non trouvé ou inactif' });
    }

    req.user = user;
    next();
  } catch (error) {
    return res.status(403).json({ error: 'Token invalide' });
  }
};

// Middleware de vérification des rôles
const requireRole = (roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Utilisateur non authentifié' });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Permissions insuffisantes' });
    }

    next();
  };
};

// Middleware pour vérifier l'accès aux réquisitions
const checkRequisitionAccess = async (req, res, next) => {
  const { id } = req.params;
  const user = req.user;

  try {
    // Récupérer la réquisition
    const requisition = await dbUtils.get(
      'SELECT r.*, u.nom_complet as emetteur_nom FROM requisitions r JOIN users u ON r.emetteur_id = u.id WHERE r.id = ?',
      [id]
    );

    if (!requisition) {
      return res.status(404).json({ error: 'Réquisition non trouvée' });
    }

    // Admin peut voir toutes les réquisitions
    if (user.role === 'admin') {
      req.requisition = requisition;
      return next();
    }

    // Émetteur ne voit que ses propres réquisitions
    if (user.role === 'emetteur') {
      if (requisition.emetteur_id !== user.id) {
        return res.status(403).json({ error: 'Accès non autorisé' });
      }
      // L'émetteur a toujours accès à ses propres réquisitions, quel que soit le niveau
      req.requisition = requisition;
      return next();
    }

    // Vérifier le niveau pour les autres rôles
    // On permet la lecture à tous les acteurs du workflow pour la transparence
    const allowedRoles = ['analyste', 'challenger', 'validateur', 'pm', 'gm', 'comptable'];
    if (allowedRoles.includes(user.role)) {
       // Accès autorisé en lecture pour le workflow
    } else {
       // Fallback pour les autres cas (si jamais)
       const niveauOrder = {
         'emetteur': 0,
         'analyste': 1,
         'challenger': 2,
         'validateur': 3,
         'pm': 3,
         'gm': 4,
         'paiement': 5,
         'justificatif': 6
       };
   
       const userNiveau = niveauOrder[user.role] || 0;
       const requisitionNiveau = niveauOrder[requisition.niveau] || 0;
   
       if (userNiveau < requisitionNiveau && user.role !== 'comptable') {
         // Cette restriction empêchait la visibilité des anciennes étapes. 
         // On la commente pour permettre la transparence "au vu de tous"
         // return res.status(403).json({ error: 'Accès non autorisé à ce niveau' });
       }
    }

    // Comptable peut voir les réquisitions validées et plus
    if (user.role === 'comptable' && requisition.statut === 'brouillon') {
       return res.status(403).json({ error: 'Le comptable ne peut pas voir les brouillons' });
    }

    req.requisition = requisition;
    next();
  } catch (error) {
    console.error('Erreur lors de la vérification d\'accès:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
};

module.exports = {
  authenticateToken,
  requireRole,
  checkRequisitionAccess
};
