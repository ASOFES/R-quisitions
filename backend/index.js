const express = require('express');
const cors = require('cors');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');
const fs = require('fs');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const app = express();

// S'assurer que le dossier uploads existe
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
  console.log('Dossier uploads créé:', uploadsDir);
}
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Servir les fichiers statiques (uploads)
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Importer les routes
const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/users');
const serviceRoutes = require('./routes/services');
const requisitionRoutes = require('./routes/requisitions');
const paymentRoutes = require('./routes/payments');
const zoneRoutes = require('./routes/zones');
const settingsRoutes = require('./routes/settings');
const siteRoutes = require('./routes/sites');
const WorkflowService = require('./services/WorkflowService');
const { dbReady } = require('./database/database');

// Utiliser les routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/services', serviceRoutes);
app.use('/api/requisitions', requisitionRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/zones', zoneRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/sites', siteRoutes);

// Socket.IO pour le chat en temps réel
io.on('connection', (socket) => {
  console.log('Utilisateur connecté:', socket.id);

  socket.on('join-requisition', (requisitionId) => {
    socket.join(requisitionId);
    console.log(`Utilisateur ${socket.id} a rejoint la réquisition ${requisitionId}`);
  });

  socket.on('send-message', (data) => {
    const { requisitionId, message, user } = data;
    io.to(requisitionId).emit('new-message', {
      message,
      user,
      timestamp: new Date()
    });
  });

  socket.on('disconnect', () => {
    console.log('Utilisateur déconnecté:', socket.id);
  });
});

// Route par défaut
app.get('/', (req, res) => {
  res.json({ message: 'API de gestion des réquisitions' });
});

app.get('/api/debug-db', async (req, res) => {
  try {
    await dbReady;
    const isPostgres = !!process.env.DATABASE_URL;
    res.json({
      message: 'Database Debug Info',
      env: process.env.NODE_ENV,
      isPostgres: isPostgres,
      databaseUrlPresent: !!process.env.DATABASE_URL,
      databaseUrlType: process.env.DATABASE_URL ? (process.env.DATABASE_URL.includes('render') ? 'render-internal' : 'external') : 'none'
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Middleware de gestion d'erreurs
app.use((err, req, res, next) => {
  console.error(err.stack);
  if (err.name === 'MulterError') {
    return res.status(400).json({ error: err.message });
  }
  if (err) {
    return res.status(500).json({ error: err.message || 'Une erreur est survenue' });
  }
  next();
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`Serveur démarré sur le port ${PORT}`);
  
  // Démarrer le job de validation automatique (toutes les minutes)
  setInterval(() => {
    WorkflowService.runAutoValidation().catch(err => console.error('Erreur job auto-validation:', err));
  }, 60 * 1000); // 60 secondes
});
