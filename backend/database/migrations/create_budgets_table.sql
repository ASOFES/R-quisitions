-- Table des budgets
CREATE TABLE IF NOT EXISTS budgets (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  classification VARCHAR(100),
  description VARCHAR(255) NOT NULL,
  mois VARCHAR(7) NOT NULL, -- Format 'YYYY-MM'
  annee INTEGER NOT NULL,
  montant_prevu DECIMAL(15,2) DEFAULT 0,
  montant_consomme DECIMAL(15,2) DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(description, mois)
);
