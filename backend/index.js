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

// Log global request (DEBUG)
app.use((req, res, next) => {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
    next();
});

// Proxy pour les fichiers uploads (gestion hybride Local/Supabase)
app.get('/uploads/:filename', async (req, res, next) => {
  const filename = req.params.filename;
  const localPath = path.join(__dirname, 'uploads', filename);
  
  // Si le fichier existe localement, laisser express.static le servir
  if (fs.existsSync(localPath)) {
    return next();
  }
  
  // Sinon, essayer de le récupérer depuis Supabase
  try {
    const StorageService = require('./services/StorageService');
    // On vérifie d'abord si Supabase est configuré
    if (!process.env.SUPABASE_URL) return next();

    const buffer = await StorageService.getFileBuffer(filename);
    
    // Déterminer le type MIME simple
    const ext = path.extname(filename).toLowerCase();
    const mimeTypes = {
      '.pdf': 'application/pdf',
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.png': 'image/png',
      '.gif': 'image/gif',
      '.doc': 'application/msword',
      '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      '.xls': 'application/vnd.ms-excel',
      '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      '.txt': 'text/plain'
    };
    
    const contentType = mimeTypes[ext] || 'application/octet-stream';
    res.setHeader('Content-Type', contentType);
    res.send(buffer);
  } catch (err) {
    // Si pas trouvé dans Supabase non plus
    // console.log(`Fichier ${filename} non trouvé dans Supabase`);
    next();
  }
});

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
const compilationRoutes = require('./routes/compilations');
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
app.use('/api/compilations', compilationRoutes);

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
  console.log(`🚀 Serveur démarré sur le port ${PORT}`);
  console.log(`📦 Version: Bucket 'requisitions' (sans accent)`);
  
  // Démarrer le job de validation automatique (toutes les minutes)
  setInterval(() => {
    WorkflowService.runAutoValidation().catch(err => console.error('Erreur job auto-validation:', err));
  }, 60 * 1000); // 60 secondes
});
