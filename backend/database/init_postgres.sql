-- Postgres Schema

CREATE TABLE IF NOT EXISTS services (
  id SERIAL PRIMARY KEY,
  code VARCHAR(10) UNIQUE NOT NULL,
  nom VARCHAR(100) NOT NULL,
  description TEXT,
  actif BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS zones (
  id SERIAL PRIMARY KEY,
  code VARCHAR(10) UNIQUE NOT NULL,
  nom VARCHAR(100) NOT NULL,
  description TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS sites (
  id SERIAL PRIMARY KEY,
  nom VARCHAR(100) NOT NULL,
  description TEXT,
  actif BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  username VARCHAR(50) UNIQUE NOT NULL,
  password VARCHAR(255) NOT NULL,
  nom_complet VARCHAR(100) NOT NULL,
  email VARCHAR(100) UNIQUE,
  role VARCHAR(20) NOT NULL CHECK (role IN ('admin', 'emetteur', 'analyste', 'challenger', 'validateur', 'comptable', 'gm', 'pm')),
  service_id INTEGER REFERENCES services(id),
  zone_id INTEGER REFERENCES zones(id),
  actif BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS requisitions (
  id SERIAL PRIMARY KEY,
  numero VARCHAR(50) UNIQUE NOT NULL,
  objet TEXT NOT NULL,
  montant_usd DECIMAL(15,2),
  montant_cdf DECIMAL(15,2),
  commentaire_initial TEXT,
  emetteur_id INTEGER NOT NULL REFERENCES users(id),
  service_id INTEGER NOT NULL REFERENCES services(id),
  niveau VARCHAR(20) NOT NULL DEFAULT 'emetteur',
  niveau_retour VARCHAR(20),
  statut VARCHAR(20) NOT NULL DEFAULT 'en_cours',
  mode_paiement VARCHAR(20),
  related_to INTEGER,
  site_id INTEGER REFERENCES sites(id),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS lignes_requisition (
  id SERIAL PRIMARY KEY,
  requisition_id INTEGER NOT NULL REFERENCES requisitions(id),
  description TEXT NOT NULL,
  quantite DECIMAL(10,2) NOT NULL DEFAULT 1,
  prix_unitaire DECIMAL(15,2) NOT NULL,
  prix_total DECIMAL(15,2) NOT NULL,
  site_id INTEGER REFERENCES sites(id),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS requisition_actions (
  id SERIAL PRIMARY KEY,
  requisition_id INTEGER NOT NULL REFERENCES requisitions(id),
  utilisateur_id INTEGER NOT NULL REFERENCES users(id),
  action VARCHAR(20) NOT NULL CHECK (action IN ('valider', 'modifier', 'refuser', 'payer', 'valider_paiement', 'terminer')),
  commentaire TEXT,
  niveau_avant VARCHAR(20),
  niveau_apres VARCHAR(20),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS messages (
  id SERIAL PRIMARY KEY,
  requisition_id INTEGER NOT NULL REFERENCES requisitions(id),
  utilisateur_id INTEGER NOT NULL REFERENCES users(id),
  message TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS pieces_jointes (
  id SERIAL PRIMARY KEY,
  requisition_id INTEGER NOT NULL REFERENCES requisitions(id),
  nom_fichier VARCHAR(255) NOT NULL,
  chemin_fichier VARCHAR(255) NOT NULL,
  taille_fichier INTEGER,
  type_fichier VARCHAR(50),
  uploaded_by INTEGER NOT NULL REFERENCES users(id),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS fonds (
  id SERIAL PRIMARY KEY,
  devise VARCHAR(3) NOT NULL,
  montant_disponible DECIMAL(15,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT unique_devise UNIQUE (devise)
);


CREATE TABLE IF NOT EXISTS mouvements_fonds (
  id SERIAL PRIMARY KEY,
  type_mouvement VARCHAR(20) NOT NULL CHECK (type_mouvement IN ('entree', 'sortie')),
  montant DECIMAL(15,2) NOT NULL,
  devise VARCHAR(3) NOT NULL CHECK (devise IN ('USD', 'CDF')),
  description TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS paiements (
  id SERIAL PRIMARY KEY,
  requisition_id INTEGER NOT NULL REFERENCES requisitions(id),
  montant_usd DECIMAL(15,2),
  montant_cdf DECIMAL(15,2),
  commentaire TEXT,
  comptable_id INTEGER NOT NULL REFERENCES users(id),
  date_paiement TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  statut VARCHAR(20) NOT NULL DEFAULT 'effectue',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS workflow_settings (
  niveau VARCHAR(50) PRIMARY KEY,
  delai_minutes INTEGER DEFAULT 0,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Inserts
INSERT INTO services (code, nom, description) VALUES
('RH', 'Ressources Humaines', 'Gestion du personnel et des ressources humaines'),
('FIN', 'Finance', 'Gestion financière et comptabilité'),
('ADMI', 'Administration', 'Gestion administrative générale'),
('IT', 'Informatique', 'Services informatiques et technologiques'),
('WH', 'Warehouse', 'Gestion des entrepôts et stocks'),
('MT', 'Maintenance', 'Services de maintenance technique')
ON CONFLICT (code) DO NOTHING;

INSERT INTO users (username, password, nom_complet, email, role, service_id) VALUES
('admin', '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'Administrateur System', 'admin@requisition.com', 'admin', NULL),
('edla.m', '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'Edla Mukeba', 'edla.m@requisition.com', 'emetteur', 1),
('analyste.compta', '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'Analyste Comptable', 'analyste@requisition.com', 'analyste', 2),
('challenger', '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'Challenger Principal', 'challenger@requisition.com', 'challenger', 2),
('pm.user', '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'Project Manager', 'pm@requisition.com', 'validateur', 3),
('gm.user', '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'General Manager', 'gm@requisition.com', 'gm', 3),
('comptable', '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'Comptable Principal', 'comptable@requisition.com', 'comptable', 2)
ON CONFLICT (username) DO NOTHING;

INSERT INTO zones (code, nom, description) VALUES 
('KIN', 'Kinshasa', 'Zone de Kinshasa'),
('LUB', 'Lubumbashi', 'Zone de Lubumbashi')
ON CONFLICT (code) DO NOTHING;

INSERT INTO fonds (devise, montant_disponible) VALUES
('USD', 10000.00),
('CDF', 25000000.00)
ON CONFLICT (devise) DO NOTHING;
