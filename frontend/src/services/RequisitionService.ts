// Service de gestion des réquisitions avec stockage local

export interface RequisitionItem {
  id: number | string;
  description: string;
  quantite: number;
  prix_unitaire: number;
  prix_total?: number;
  total?: number;
  site_id?: number | string;
  site_nom?: string;
}

export interface Requisition {
  id: number;
  reference: string;
  objet: string;
  description: string;
  montant: number;
  montant_usd?: number;  // Ajout pour compatibilité avec l'API backend
  montant_cdf?: number;  // Ajout pour compatibilité avec l'API backend
  devise: string;
  items?: RequisitionItem[]; // Lignes de la réquisition
  urgence: 'basse' | 'normale' | 'haute' | 'critique';
  statut: 'brouillon' | 'soumise' | 'en_cours' | 'validee' | 'refusee' | 'payee' | 'termine' | 'a_corriger' | 'annulee';
  created_at: string;
  updated_at: string;
  emetteur_id: number;
  emetteur_nom: string;
  emetteur_email?: string;
  emetteur_role?: string;
  emetteur_telephone?: string;
  emetteur_zone?: string;
  service_id: number;
  service_nom: string;
  service_chef_id?: number; // ID du chef de service
  niveau?: string;  // Ajout de la propriété niveau
  mode_paiement?: 'Cash' | 'Banque'; // Mode de paiement (Cash ou Banque)
  pieces_jointes: string[];
  pieces_jointes_data?: Array<{
    id: string;
    name: string;
    size: number;
    type: string;
    data: string | null;
    nom_fichier?: string; // Ajout pour compatibilité avec l'API backend
    chemin_fichier?: string; // Ajout pour compatibilité avec l'API backend
  }>;
  analyses?: AnalysisData[];
  workflow?: WorkflowHistory;
  actions?: Array<{
    id: number;
    requisition_id: number;
    utilisateur_id: number;
    action: string;
    commentaire: string;
    niveau_avant: string;
    niveau_apres: string;
    created_at: string;
    utilisateur_nom: string;
  }>; // Ajout de la propriété actions pour le workflow
  related_to?: number; // Référence à une réquisition parente
  explication?: string; // Explications supplémentaires
  response_chain?: number[]; // Chaîne d'historique des réquisitions liées
  has_responses?: boolean; // Indique si cette réquisition a déjà des réponses
  nb_pieces?: number; // Nombre de pièces jointes (depuis l'API backend)
}

export interface AnalysisData {
  notes: string;
  rating: number;
  recommendation: string;
  attachments: string[];
  analysis_date: string;
  analyst_id: number;
}

export interface WorkflowStep {
  id: string;
  name: string;
  description: string;
  status: 'pending' | 'completed' | 'skipped';
  completed_at?: string;
  completed_by?: string;
  notes?: string;
  level?: 'analyst' | 'challenger' | 'validator' | 'manager' | 'director' | 'gm'; // Niveau de validation
  validation_type?: 'preliminary' | 'detailed' | 'final'; // Type de validation
}

export interface WorkflowHistory {
  requisition_id: number;
  current_step: string;
  current_level?: 'analyst' | 'challenger' | 'validator' | 'manager' | 'director' | 'gm'; // Niveau actuel
  steps: WorkflowStep[];
  created_at: string;
  updated_at: string;
}

class RequisitionService {
  private static instance: RequisitionService;
  private requisitions: Requisition[] = [];
  private nextId: number = 1;

  private constructor() {
    this.loadFromStorage();
  }

  static getInstance(): RequisitionService {
    if (!RequisitionService.instance) {
      RequisitionService.instance = new RequisitionService();
    }
    return RequisitionService.instance;
  }

  private loadFromStorage() {
    try {
      const stored = localStorage.getItem('requisitions');
      if (stored) {
        this.requisitions = JSON.parse(stored);
        this.nextId = Math.max(...this.requisitions.map(r => r.id), 0) + 1;
      } else {
        // Données initiales si le storage est vide
        this.initializeData();
      }
      
      // Forcer l'initialisation du workflow pour les réquisitions existantes
      this.initializeAllWorkflows();
    } catch (error) {
      console.error('Erreur lors du chargement depuis localStorage:', error);
      this.initializeData();
    }
  }

  private initializeData() {
    const initialData: Requisition[] = [
      {
        id: 1,
        reference: 'REQ-2025-001',
        objet: 'Achat de matériel informatique',
        description: 'Achat de 5 ordinateurs portables pour le service informatique',
        montant: 2500,
        devise: 'USD',
        urgence: 'haute',
        statut: 'en_cours',
        emetteur_id: 1,
        emetteur_nom: 'Jean Dupont',
        service_id: 1,
        service_nom: 'Informatique',
        pieces_jointes: [],
        created_at: '2025-01-15T10:30:00Z',
        updated_at: '2025-01-15T14:20:00Z',
        response_chain: [],
        has_responses: false
      },
      {
        id: 2,
        reference: 'REQ-2025-002',
        objet: 'Formation du personnel',
        description: 'Formation sur les nouvelles procédures comptables',
        montant: 1500,
        devise: 'USD',
        urgence: 'normale',
        statut: 'validee',
        emetteur_id: 2,
        emetteur_nom: 'Marie Martin',
        service_id: 2,
        service_nom: 'Finance',
        pieces_jointes: [],
        created_at: '2025-01-14T09:15:00Z',
        updated_at: '2025-01-16T11:45:00Z',
        response_chain: [],
        has_responses: false
      },
      {
        id: 3,
        reference: 'REQ-2025-003',
        objet: 'Renouvellement licences logicielles',
        description: 'Renouvellement annuel des licences Microsoft Office',
        montant: 1200,
        devise: 'USD',
        urgence: 'normale',
        statut: 'refusee',
        emetteur_id: 1,
        emetteur_nom: 'Jean Dupont',
        service_id: 1,
        service_nom: 'Informatique',
        pieces_jointes: [],
        created_at: '2025-01-13T14:20:00Z',
        updated_at: '2025-01-14T16:30:00Z',
        response_chain: [],
        has_responses: false
      },
    ];

    // Initialiser le workflow pour chaque réquisition
    initialData.forEach(requisition => {
      this.initializeWorkflow(requisition.id);
    });

    this.requisitions = initialData;
    this.nextId = 4;
    this.saveToStorage();
  }

  private saveToStorage() {
    try {
      localStorage.setItem('requisitions', JSON.stringify(this.requisitions));
    } catch (error) {
      console.error('Erreur lors de la sauvegarde dans localStorage:', error);
    }
  }

  // Obtenir toutes les réquisitions
  getAllRequisitions(): Requisition[] {
    return [...this.requisitions].sort((a, b) => 
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );
  }

  // Ajouter une nouvelle réquisition
  addRequisition(data: Omit<Requisition, 'id' | 'reference' | 'created_at' | 'updated_at'>): Requisition {
    const newRequisition: Requisition = {
      ...data,
      id: this.nextId++,
      reference: this.generateReference(),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      response_chain: [],
      has_responses: false
    };

    // Si c'est une réponse, gérer la chaîne d'historique
    if (data.related_to) {
      const parentRequisition = this.requisitions.find(r => r.id === data.related_to);
      if (parentRequisition) {
        // Construire la chaîne d'historique
        const responseChain = [...(parentRequisition.response_chain || []), parentRequisition.id];
        newRequisition.response_chain = responseChain;
        
        // Marquer la réquisition parente comme ayant des réponses
        parentRequisition.has_responses = true;
        parentRequisition.updated_at = new Date().toISOString();
      }
    }

    this.requisitions.push(newRequisition);
    this.saveToStorage();
    return newRequisition;
  }

  // Mettre à jour une réquisition
  updateRequisition(id: number, updates: Partial<Requisition>): Requisition | null {
    const index = this.requisitions.findIndex(r => r.id === id);
    if (index === -1) return null;

    this.requisitions[index] = {
      ...this.requisitions[index],
      ...updates,
      updated_at: new Date().toISOString(),
    };

    this.saveToStorage();
    return this.requisitions[index];
  }

  // Supprimer une réquisition
  deleteRequisition(id: number): boolean {
    const index = this.requisitions.findIndex(r => r.id === id);
    if (index === -1) return false;

    this.requisitions.splice(index, 1);
    this.saveToStorage();
    return true;
  }

  // Obtenir une réquisition par ID
  getRequisitionById(id: number): Requisition | null {
    return this.requisitions.find(r => r.id === id) || null;
  }

  // Filtrer les réquisitions
  filterRequisitions(filters: {
    status?: string;
    urgence?: string;
    emetteur?: string;
    service?: string;
  }): Requisition[] {
    return this.requisitions.filter(requisition => {
      if (filters.status && filters.status !== 'all' && requisition.statut !== filters.status) {
        return false;
      }
      if (filters.urgence && filters.urgence !== 'all' && requisition.urgence !== filters.urgence) {
        return false;
      }
      if (filters.emetteur && filters.emetteur !== 'all' && requisition.emetteur_nom !== filters.emetteur) {
        return false;
      }
      if (filters.service && filters.service !== 'all' && requisition.service_nom !== filters.service) {
        return false;
      }
      return true;
    });
  }

  // Obtenir les statistiques
  getStatistics() {
    const total = this.requisitions.length;
    const enCours = this.requisitions.filter(r => r.statut === 'en_cours').length;
    const validees = this.requisitions.filter(r => r.statut === 'validee').length;
    const refusees = this.requisitions.filter(r => r.statut === 'refusee').length;
    const montantTotal = this.requisitions.reduce((sum, r) => sum + r.montant, 0);

    return {
      total,
      enCours,
      validees,
      refusees,
      montantTotal,
      tauxValidation: total > 0 ? Math.round((validees / total) * 100) : 0,
    };
  }

  // Ajouter une analyse à une réquisition
  addAnalysis(requisitionId: number, analysis: AnalysisData): void {
    const requisition = this.requisitions.find(r => r.id === requisitionId);
    if (!requisition) return;

    if (!requisition.analyses) {
      requisition.analyses = [];
    }
    
    requisition.analyses.push(analysis);
    
    // Mettre à jour le workflow
    this.updateWorkflowStep(requisitionId, 'preliminary_analysis', `Analyste ID: ${analysis.analyst_id}`);
    
    this.saveToStorage();
  }

  // Initialiser le workflow pour une réquisition
  initializeWorkflow(requisitionId: number): void {
    const requisition = this.requisitions.find(r => r.id === requisitionId);
    if (!requisition) return;

    const workflowSteps: WorkflowStep[] = [
      {
        id: 'creation',
        name: 'Création',
        description: 'Réquisition créée par l\'émetteur',
        status: 'completed',
        completed_at: requisition.created_at,
        completed_by: requisition.emetteur_nom,
        level: 'analyst',
        validation_type: 'preliminary'
      },
      {
        id: 'submission',
        name: 'Soumission',
        description: 'Réquisition soumise pour validation',
        status: requisition.statut === 'soumise' ? 'completed' : 'pending',
        completed_at: requisition.statut === 'soumise' ? requisition.updated_at : undefined,
        completed_by: requisition.emetteur_nom,
        level: 'analyst',
        validation_type: 'preliminary'
      },
      {
        id: 'preliminary_analysis',
        name: 'Validation Analyste (PM)',
        description: 'Analyse préliminaire par l\'analyste de projet',
        status: 'pending',
        level: 'analyst',
        validation_type: 'preliminary'
      },
      {
        id: 'challenger_review',
        name: 'Validation Challenger',
        description: 'Revue par le challenger',
        status: 'pending',
        level: 'analyst',
        validation_type: 'detailed'
      },
      {
        id: 'manager_review',
        name: 'Validation Manager (PM)',
        description: 'Revue détaillée par le manager de projet',
        status: 'pending',
        level: 'manager',
        validation_type: 'detailed'
      },
      {
        id: 'director_approval',
        name: 'Approbation Directeur (GM)',
        description: 'Approbation finale par le directeur général',
        status: 'pending',
        level: 'director',
        validation_type: 'final'
      },
      {
        id: 'payment',
        name: 'Paiement',
        description: 'Traitement du paiement',
        status: 'pending',
        level: 'director',
        validation_type: 'final'
      }
    ];

    const workflow: WorkflowHistory = {
      requisition_id: requisitionId,
      current_step: this.getCurrentStep(requisition.statut),
      current_level: this.getCurrentLevel(requisition.statut),
      steps: workflowSteps,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    requisition.workflow = workflow;
    this.saveToStorage();
  }

  // Valider une étape spécifique selon le rôle de l'utilisateur
  validateWorkflowStep(requisitionId: number, userRole: string, userId?: string): boolean {
    const requisition = this.requisitions.find(r => r.id === requisitionId);
    if (!requisition || !requisition.workflow) return false;

    const currentStep = requisition.workflow.current_step;
    let stepToValidate = '';

    // Déterminer l'étape à valider selon le rôle
    switch (userRole) {
      case 'analyste':
        if (currentStep === 'preliminary_analysis') {
          stepToValidate = 'preliminary_analysis';
        }
        break;
      case 'validateur':
        if (currentStep === 'manager_review') {
          stepToValidate = 'manager_review';
        }
        break;
      case 'admin':
        if (currentStep === 'director_approval') {
          stepToValidate = 'director_approval';
        }
        break;
    }

    if (!stepToValidate) {
      console.warn(`L'utilisateur ${userRole} ne peut pas valider l'étape ${currentStep}`);
      return false;
    }

    const completedBy = userId ? `${userRole.toUpperCase()} ID: ${userId}` : `${userRole.toUpperCase()} actuel`;
    return this.updateWorkflowStep(requisitionId, stepToValidate, completedBy);
  }

  // Mettre à jour une étape spécifique du workflow
  updateWorkflowStep(requisitionId: number, stepId: string, completedBy?: string): boolean {
    const requisition = this.requisitions.find(r => r.id === requisitionId);
    if (!requisition || !requisition.workflow) return false;

    const step = requisition.workflow.steps.find(s => s.id === stepId);
    if (!step) return false;

    step.status = 'completed';
    step.completed_at = new Date().toISOString();
    step.completed_by = completedBy || 'Utilisateur actuel';
    
    // Déterminer la prochaine étape
    const stepOrder = ['creation', 'submission', 'preliminary_analysis', 'manager_review', 'director_approval', 'payment'];
    const currentIndex = stepOrder.indexOf(stepId);
    
    if (currentIndex < stepOrder.length - 1) {
      const nextStepId = stepOrder[currentIndex + 1];
      requisition.workflow.current_step = nextStepId;
      requisition.workflow.current_level = this.getStepLevel(nextStepId);
    }
    
    requisition.workflow.updated_at = new Date().toISOString();
    this.saveToStorage();
    return true;
  }

  // Obtenir l'étape actuelle selon le statut
  private getCurrentStep(statut: string): string {
    switch (statut) {
      case 'brouillon': return 'creation';
      case 'soumise': return 'preliminary_analysis';
      case 'en_cours': return 'preliminary_analysis';
      case 'validee': return 'director_approval';
      case 'payee': return 'payment';
      case 'refusee': return 'preliminary_analysis';
      default: return 'creation';
    }
  }

  // Obtenir le niveau actuel selon le statut
  private getCurrentLevel(statut: string): 'analyst' | 'manager' | 'director' {
    switch (statut) {
      case 'brouillon': return 'analyst';
      case 'soumise': return 'analyst';
      case 'en_cours': return 'analyst';
      case 'validee': return 'director';
      case 'payee': return 'director';
      case 'refusee': return 'analyst';
      default: return 'analyst';
    }
  }

  // Obtenir la prochaine étape
  private getNextStep(currentStep: string, statut: string): string {
    if (statut === 'refusee') return 'preliminary_analysis'; // Retour à l'analyse préliminaire
    if (statut === 'validee') return 'director_approval'; // Passer à l'approbation du directeur
    
    return currentStep;
  }

  // Vérifier si une réquisition peut recevoir des réponses
  canRespondToRequisition(requisitionId: number): boolean {
    const requisition = this.requisitions.find(r => r.id === requisitionId);
    if (!requisition) return false;
    
    // Une réquisition ne peut pas recevoir de réponses si elle en a déjà
    return !requisition.has_responses;
  }

  // Obtenir la chaîne complète des réquisitions liées
  getResponseChain(requisitionId: number): Requisition[] {
    const requisition = this.requisitions.find(r => r.id === requisitionId);
    if (!requisition || !requisition.response_chain) return [];
    
    return requisition.response_chain
      .map(id => this.requisitions.find(r => r.id === id))
      .filter((r): r is Requisition => r !== undefined);
  }
  getStepLevel(stepId: string): 'analyst' | 'manager' | 'director' {
    switch (stepId) {
      case 'creation':
      case 'submission':
      case 'preliminary_analysis':
        return 'analyst';
      case 'manager_review':
        return 'manager';
      case 'director_approval':
      case 'payment':
        return 'director';
      default:
        return 'analyst';
    }
  }

  // Forcer l'initialisation du workflow pour toutes les réquisitions
  initializeAllWorkflows(): void {
    this.requisitions.forEach(requisition => {
      if (!requisition.workflow) {
        this.initializeWorkflow(requisition.id);
      } else {
        // Mettre à jour le workflow existant selon le statut actuel
        this.updateWorkflowForStatus(requisition.id, requisition.statut);
      }
    });
    this.saveToStorage();
  }

  // Mettre à jour le workflow selon le statut
  private updateWorkflowForStatus(requisitionId: number, status: string): void {
    const requisition = this.requisitions.find(r => r.id === requisitionId);
    if (!requisition || !requisition.workflow) return;

    switch (status) {
      case 'validee':
        // Compléter toutes les étapes jusqu'à l'approbation finale
        this.completeWorkflowSteps(requisitionId, 'director_approval');
        requisition.workflow.current_step = 'director_approval';
        requisition.workflow.current_level = 'director';
        break;
        
      case 'refusee':
        // Compléter l'analyse préliminaire mais marquer comme refusé
        this.completeWorkflowSteps(requisitionId, 'preliminary_analysis');
        requisition.workflow.current_step = 'preliminary_analysis';
        requisition.workflow.current_level = 'analyst';
        break;
        
      case 'payee':
        // Compléter toutes les étapes y compris le paiement
        this.completeWorkflowSteps(requisitionId, 'payment');
        requisition.workflow.current_step = 'payment';
        requisition.workflow.current_level = 'director';
        break;
    }
    
    requisition.workflow.updated_at = new Date().toISOString();
  }

  // Compléter toutes les étapes jusqu'à une étape spécifique
  private completeWorkflowSteps(requisitionId: number, targetStep: string): void {
    const requisition = this.requisitions.find(r => r.id === requisitionId);
    if (!requisition || !requisition.workflow) return;

    const stepOrder = ['creation', 'submission', 'preliminary_analysis', 'challenger_review', 'manager_review', 'director_approval', 'payment'];
    const targetIndex = stepOrder.indexOf(targetStep);
    
    // Compléter toutes les étapes avant l'étape cible
    for (let i = 0; i <= targetIndex; i++) {
      const stepId = stepOrder[i];
      const step = requisition.workflow.steps.find(s => s.id === stepId);
      
      if (step && step.status === 'pending') {
        step.status = 'completed';
        step.completed_at = new Date().toISOString();
        step.completed_by = 'Système (progression automatique)';
      }
    }
    
    // Mettre à jour l'étape actuelle
    requisition.workflow.current_step = targetStep;
    requisition.workflow.current_level = this.getStepLevel(targetStep);
    requisition.workflow.updated_at = new Date().toISOString();
  }

  // Vider toutes les données (pour les tests)
  clearAll() {
    this.requisitions = [];
    this.nextId = 1;
    this.saveToStorage();
  }

  // Forcer le nettoyage complet du localStorage
  forceClearAll() {
    console.log('🧹 Nettoyage complet du localStorage...');
    
    // Afficher ce qui va être effacé
    console.log('📋 Avant effacement:', {
      requisitions: localStorage.getItem('requisitions'),
      authToken: localStorage.getItem('authToken'),
      user: localStorage.getItem('user')
    });
    
    localStorage.removeItem('requisitions');
    localStorage.removeItem('authToken');
    localStorage.removeItem('user');
    
    // Effacer toutes les clés liées
    Object.keys(localStorage).forEach(key => {
      if (key.includes('requisition') || key.includes('auth') || key.includes('user')) {
        console.log(`🗑️ Effacement de: ${key}`);
        localStorage.removeItem(key);
      }
    });
    
    this.requisitions = [];
    this.nextId = 1;
    
    console.log('🎊 Toutes les données ont été effacées !');
    console.log('📊 État après effacement:', {
      requisitions: localStorage.getItem('requisitions'),
      authToken: localStorage.getItem('authToken'),
      user: localStorage.getItem('user'),
      totalKeys: Object.keys(localStorage).length
    });
  }

  private generateReference(): string {
    const year = new Date().getFullYear();
    const sequence = String(this.nextId).padStart(3, '0');
    return `REQ-${year}-${sequence}`;
  }
}

export default RequisitionService;
