import axios from 'axios';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

// Créer une instance axios avec configuration par défaut
const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Intercepteur pour ajouter le token JWT
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Intercepteur pour gérer les erreurs 401
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

// Types TypeScript
export interface User {
  id: number;
  username: string;
  nom_complet: string;
  email: string;
  role: 'admin' | 'emetteur' | 'analyste' | 'challenger' | 'validateur' | 'comptable' | 'gm' | 'pm' | 'compilateur';
  service_id?: number;
  service_code?: string;
  service_nom?: string;
  zone_id?: number;
  zone_code?: string;
  zone_nom?: string;
  actif: boolean;
}

export interface Service {
  id: number;
  code: string;
  nom: string;
  description?: string;
  actif: boolean;
  chef_id?: number;
  chef_nom?: string;
}

export interface Zone {
  id: number;
  code: string;
  nom: string;
  description?: string;
  actif: boolean;
  created_at: string;
  updated_at: string;
}

export interface Site {
  id: number;
  nom: string;
  localisation?: string;
  description?: string;
  actif: boolean;
  created_at: string;
  updated_at: string;
}

export interface Requisition {
  id: number;
  numero: string;
  objet: string;
  montant_usd?: number;
  montant_cdf?: number;
  commentaire_initial?: string;
  emetteur_id: number;
  service_id: number;
  niveau: 'emetteur' | 'analyste' | 'challenger' | 'validateur' | 'gm' | 'compilation' | 'paiement' | 'justificatif' | 'termine';
  statut: 'en_cours' | 'valide' | 'refuse' | 'termine' | 'a_corriger' | 'validee' | 'refusee' | 'payee' | 'annulee';
  created_at: string;
  updated_at: string;
  emetteur_nom: string;
  service_code: string;
  service_nom: string;
  nb_pieces?: number;
  mode_paiement?: string;
}

export interface RequisitionAction {
  id: number;
  requisition_id: number;
  utilisateur_id: number;
  action: 'valider' | 'modifier' | 'refuser' | 'payer' | 'valider_paiement' | 'terminer';
  commentaire: string;
  niveau_avant: string;
  niveau_apres: string;
  created_at: string;
  utilisateur_nom: string;
}

export interface Message {
  id: number;
  requisition_id: number;
  utilisateur_id: number;
  message: string;
  created_at: string;
  utilisateur_nom: string;
}

export interface PieceJointe {
  id: number;
  requisition_id: number;
  nom_fichier: string;
  chemin_fichier: string;
  taille_fichier: number;
  type_fichier: string;
  uploaded_by: number;
  created_at: string;
  uploader_nom: string;
}

export interface Fonds {
  id: number;
  devise: 'USD' | 'CDF';
  montant_disponible: number;
  created_at: string;
  updated_at: string;
}

export interface MouvementFonds {
  id: number;
  type_mouvement: 'entree' | 'sortie';
  montant: number;
  devise: 'USD' | 'CDF';
  description?: string;
  created_at: string;
}

export interface Bordereau {
  id: number;
  numero: string;
  date_creation: string;
  statut: string;
  createur_id: number;
  createur_nom?: string;
  nb_requisitions?: number;
  total_usd?: number;
  total_cdf?: number;
}

// API Authentification
export const authAPI = {
  login: async (username: string, password: string) => {
    // Utiliser l'endpoint standard
    const response = await api.post('/auth/login', { username, password });
    return response.data;
  },
  
  verify: async () => {
    const response = await api.get('/auth/verify');
    return response.data;
  },
  
  refresh: async () => {
    const response = await api.post('/auth/refresh');
    return response.data;
  },
};

// API Utilisateurs
export const usersAPI = {
  getAll: async () => {
    const response = await api.get('/users');
    return response.data;
  },
  
  create: async (userData: Partial<User>) => {
    const response = await api.post('/users', userData);
    return response.data;
  },
  
  update: async (id: number, userData: Partial<User>) => {
    const response = await api.put(`/users/${id}`, userData);
    return response.data;
  },
  
  delete: async (id: number) => {
    const response = await api.delete(`/users/${id}`);
    return response.data;
  },
};

// API Services
export const servicesAPI = {
  getAll: async () => {
    const response = await api.get<Service[]>('/services');
    return response.data;
  },
  create: async (service: Omit<Service, 'id' | 'actif'>) => {
    const response = await api.post<Service>('/services', service);
    return response.data;
  },
  update: async (id: number, service: Partial<Service>) => {
    const response = await api.put(`/services/${id}`, service);
    return response.data;
  },
  delete: async (id: number) => {
    await api.delete(`/services/${id}`);
  }
};

export const zonesAPI = {
  getAll: async (includeAll: boolean = false) => {
    const response = await api.get<Zone[]>(`/zones${includeAll ? '?all=true' : ''}`);
    return response.data;
  },
  create: async (zone: Omit<Zone, 'id' | 'created_at' | 'updated_at' | 'actif'> & { actif?: boolean }) => {
    const response = await api.post<Zone>('/zones', zone);
    return response.data;
  },
  update: async (id: number, zone: Partial<Zone>) => {
    const response = await api.put(`/zones/${id}`, zone);
    return response.data;
  },
  delete: async (id: number) => {
    const response = await api.delete(`/zones/${id}`);
    return response.data;
  }
};

export const sitesAPI = {
  getAll: async (includeAll: boolean = false) => {
    const response = await api.get<Site[]>(`/sites${includeAll ? '?all=true' : ''}`);
    return response.data;
  },
  create: async (site: Omit<Site, 'id' | 'created_at' | 'updated_at'>) => {
    const response = await api.post<Site>('/sites', site);
    return response.data;
  },
  update: async (id: number, site: Partial<Site>) => {
    const response = await api.put(`/sites/${id}`, site);
    return response.data;
  },
  delete: async (id: number) => {
    const response = await api.delete(`/sites/${id}`);
    return response.data;
  }
};

// API Réquisitions
export const requisitionsAPI = {
  getAll: async () => {
    const response = await api.get('/requisitions');
    return response.data;
  },
  
  getById: async (id: number) => {
    const response = await api.get(`/requisitions/${id}`);
    return response.data;
  },
  
  create: async (formData: FormData) => {
    const response = await api.post('/requisitions', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data;
  },
  
  action: async (id: number, action: string, commentaire: string) => {
    const response = await api.put(`/requisitions/${id}/action`, { action, commentaire });
    return response.data;
  },
  
  addMessage: async (id: number, message: string) => {
    const response = await api.post(`/requisitions/${id}/messages`, { message });
    return response.data;
  },
  
  addPieces: async (id: number, formData: FormData) => {
    const response = await api.post(`/requisitions/${id}/pieces`, formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data;
  },

  // API Compilations
  getRequisitionsToCompile: async () => {
    const response = await api.get('/compilations/a-compiler');
    return response.data;
  },

  createBordereau: async (requisitionIds: number[]) => {
    const response = await api.post('/compilations', { requisition_ids: requisitionIds });
    return response.data;
  },

  getBordereaux: async () => {
    const response = await api.get('/compilations');
    return response.data;
  },

  getBordereauxToAlign: async () => {
    const response = await api.get('/compilations/a-aligner');
    return response.data;
  },

  alignBordereau: async (id: number, modePaiement?: string) => {
    const response = await api.post(`/compilations/${id}/aligner`, { mode_paiement: modePaiement });
    return response.data;
  },
};

// API Paiements
export const paymentsAPI = {
  getFonds: async () => {
    const response = await api.get('/payments/fonds');
    return response.data;
  },
  
  getMouvements: async () => {
    const response = await api.get('/payments/mouvements');
    return response.data;
  },
  
  ravitailler: async (devise: string, montant: number, description?: string) => {
    const response = await api.post('/payments/ravitaillement', { devise, montant, description });
    return response.data;
  },
  
  getAPayer: async () => {
    const response = await api.get('/payments/a-payer');
    return response.data;
  },
  
  effectuer: async (requisitionIds: number[], commentaire: string, modePaiement?: string) => {
    const response = await api.post('/payments/effectuer', { 
      requisition_ids: requisitionIds, 
      commentaire,
      mode_paiement: modePaiement
    });
    return response.data;
  },
  
  validerPaiement: async (id: number, commentaire: string) => {
    const response = await api.post(`/payments/${id}/valider-paiement`, { commentaire });
    return response.data;
  },
  
  terminer: async (id: number, commentaire: string) => {
    const response = await api.post(`/payments/${id}/terminer`, { commentaire });
    return response.data;
  },
};

export default api;
