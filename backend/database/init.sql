-- Création des tables pour l'application de gestion des réquisitions

-- Table des services
CREATE TABLE IF NOT EXISTS services (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  code VARCHAR(10) UNIQUE NOT NULL,
  nom VARCHAR(100) NOT NULL,
  description TEXT,
  actif BOOLEAN DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Table des zones
CREATE TABLE IF NOT EXISTS zones (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  code VARCHAR(10) UNIQUE NOT NULL,
  nom VARCHAR(100) NOT NULL,
  description TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Table des sites
CREATE TABLE IF NOT EXISTS sites (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  nom VARCHAR(100) NOT NULL,
  localisation VARCHAR(100),
  description TEXT,
  actif BOOLEAN DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Table des lignes de réquisition (détails)
CREATE TABLE IF NOT EXISTS lignes_requisition (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  requisition_id INTEGER NOT NULL,
  description TEXT NOT NULL,
  quantite DECIMAL(10,2) NOT NULL DEFAULT 1,
  prix_unitaire DECIMAL(15,2) NOT NULL,
  prix_total DECIMAL(15,2) NOT NULL,
  site_id INTEGER, -- Optionnel si différent du site global
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (requisition_id) REFERENCES requisitions(id),
  FOREIGN KEY (site_id) REFERENCES sites(id)
);

-- Table des utilisateurs
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username VARCHAR(50) UNIQUE NOT NULL,
  password VARCHAR(255) NOT NULL,
  nom_complet VARCHAR(100) NOT NULL,
  email VARCHAR(100) UNIQUE,
  role VARCHAR(20) NOT NULL CHECK (role IN ('admin', 'emetteur', 'analyste', 'challenger', 'validateur', 'comptable', 'gm', 'pm')),
  service_id INTEGER,
  zone_id INTEGER,
  actif BOOLEAN DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (service_id) REFERENCES services(id),
  FOREIGN KEY (zone_id) REFERENCES zones(id)
);

-- Table des réquisitions
CREATE TABLE IF NOT EXISTS requisitions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  numero VARCHAR(20) UNIQUE NOT NULL,
  objet TEXT NOT NULL,
  montant_usd DECIMAL(15,2),
  montant_cdf DECIMAL(15,2),
  commentaire_initial TEXT,
  emetteur_id INTEGER NOT NULL,
  service_id INTEGER NOT NULL,
  niveau VARCHAR(20) NOT NULL DEFAULT 'emetteur',
  niveau_retour VARCHAR(20),
  statut VARCHAR(20) NOT NULL DEFAULT 'en_cours',
  mode_paiement VARCHAR(20),
  related_to INTEGER,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (emetteur_id) REFERENCES users(id),
  FOREIGN KEY (service_id) REFERENCES services(id)
);

-- Table des actions sur les réquisitions
CREATE TABLE IF NOT EXISTS requisition_actions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  requisition_id INTEGER NOT NULL,
  utilisateur_id INTEGER NOT NULL,
  action VARCHAR(20) NOT NULL CHECK (action IN ('valider', 'modifier', 'refuser', 'payer', 'valider_paiement', 'terminer')),
  commentaire TEXT,
  niveau_avant VARCHAR(20),
  niveau_apres VARCHAR(20),
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (requisition_id) REFERENCES requisitions(id),
  FOREIGN KEY (utilisateur_id) REFERENCES users(id)
);

-- Table des messages (chat)
CREATE TABLE IF NOT EXISTS messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  requisition_id INTEGER NOT NULL,
  utilisateur_id INTEGER NOT NULL,
  message TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (requisition_id) REFERENCES requisitions(id),
  FOREIGN KEY (utilisateur_id) REFERENCES users(id)
);

-- Table des pièces jointes
CREATE TABLE IF NOT EXISTS pieces_jointes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  requisition_id INTEGER NOT NULL,
  nom_fichier VARCHAR(255) NOT NULL,
  chemin_fichier VARCHAR(255) NOT NULL,
  taille_fichier INTEGER,
  type_fichier VARCHAR(50),
  uploaded_by INTEGER NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (requisition_id) REFERENCES requisitions(id),
  FOREIGN KEY (uploaded_by) REFERENCES users(id)
);

-- Table des fonds
CREATE TABLE IF NOT EXISTS fonds (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  devise VARCHAR(3) NOT NULL CHECK (devise IN ('USD', 'CDF')),
  montant_disponible DECIMAL(15,2) NOT NULL DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Table des mouvements de fonds
CREATE TABLE IF NOT EXISTS mouvements_fonds (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  type_mouvement VARCHAR(20) NOT NULL CHECK (type_mouvement IN ('entree', 'sortie')),
  montant DECIMAL(15,2) NOT NULL,
  devise VARCHAR(3) NOT NULL CHECK (devise IN ('USD', 'CDF')),
  description TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (devise) REFERENCES fonds(devise)
);

-- Table des paiements
CREATE TABLE IF NOT EXISTS paiements (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  requisition_id INTEGER NOT NULL,
  montant_usd DECIMAL(15,2),
  montant_cdf DECIMAL(15,2),
  commentaire TEXT,
  comptable_id INTEGER NOT NULL,
  date_paiement DATETIME DEFAULT CURRENT_TIMESTAMP,
  statut VARCHAR(20) NOT NULL DEFAULT 'effectue',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (requisition_id) REFERENCES requisitions(id),
  FOREIGN KEY (comptable_id) REFERENCES users(id)
);

-- Insertion des services par défaut
INSERT OR IGNORE INTO services (code, nom, description) VALUES
('RH', 'Ressources Humaines', 'Gestion du personnel et des ressources humaines'),
('FIN', 'Finance', 'Gestion financière et comptabilité'),
('ADMI', 'Administration', 'Gestion administrative générale'),
('IT', 'Informatique', 'Services informatiques et technologiques'),
('WH', 'Warehouse', 'Gestion des entrepôts et stocks'),
('MT', 'Maintenance', 'Services de maintenance technique');

-- Insertion des utilisateurs par défaut (mot de passe: password123 pour tous)
INSERT OR IGNORE INTO users (username, password, nom_complet, email, role, service_id) VALUES
('admin', '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'Administrateur System', 'admin@requisition.com', 'admin', NULL),
('edla.m', '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'Edla Mukeba', 'edla.m@requisition.com', 'emetteur', 1),
('analyste.compta', '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'Analyste Comptable', 'analyste@requisition.com', 'analyste', 2),
('challenger', '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'Challenger Principal', 'challenger@requisition.com', 'challenger', 2),
('pm.user', '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'Project Manager', 'pm@requisition.com', 'validateur', 3),
('gm.user', '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'General Manager', 'gm@requisition.com', 'gm', 3),
('comptable', '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'Comptable Principal', 'comptable@requisition.com', 'comptable', 2);

-- Insertion des fonds initiaux
INSERT OR IGNORE INTO fonds (devise, montant_disponible) VALUES
('USD', 10000.00),
('CDF', 25000000.00);
