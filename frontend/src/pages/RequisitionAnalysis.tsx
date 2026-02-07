import React, { useState, useEffect } from 'react';
import {
  Container,
  Typography,
  Box,
  Card,
  CardContent,
  Button,
  Alert,
  CircularProgress,
  Chip,
  IconButton,
  TextField,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Rating,
} from '@mui/material';
import {
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Tooltip,
} from '@mui/material';
import {
  ArrowBack,
  CheckCircle,
  Cancel,
  Edit,
  Save,
  Assignment,
  MonetizationOn,
  Assessment,
  Comment,
  ExpandMore,
  AttachFile,
  Download,
  Timeline,
  LocalPrintshop,
} from '@mui/icons-material';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import RequisitionService, { Requisition } from '../services/RequisitionService';
import WorkflowTracker from '../components/WorkflowTracker';
import WorkflowSummary from '../components/WorkflowSummary';
import MoneyDisplay from '../components/MoneyDisplay';
import { API_BASE_URL } from '../config';

interface AnalysisData {
  notes: string;
  rating: number;
  recommendation: string;
  attachments: string[];
  analysis_date: string;
  analyst_id: number;
}

interface BudgetCheckResult {
  allowed: boolean;
  reason?: string;
  details?: {
    budgetTotal: number;
    consomme: number;
    reste: number;
  };
}



const RequisitionAnalysis: React.FC = () => {
  const { user, token } = useAuth();
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  
  const [requisition, setRequisition] = useState<Requisition | null>(null);

  const handlePrint = async () => {
    if (!requisition) return;

    try {
      const authToken = token || localStorage.getItem('token');
      if (!authToken) {
        window.print();
        return;
      }

      const response = await fetch(`${API_BASE_URL}/api/requisitions/${requisition.id}/pdf`, {
        headers: {
          'Authorization': `Bearer ${authToken}`
        }
      });

      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        window.open(url, '_blank');
        setTimeout(() => window.URL.revokeObjectURL(url), 60000);
      } else {
        console.error('Erreur PDF backend, fallback print');
        window.print();
      }
    } catch (error) {
      console.error('Erreur impression:', error);
      window.print();
    }
  };
  const [loading, setLoading] = useState(true);
  const [analysis, setAnalysis] = useState<AnalysisData | null>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [actions, setActions] = useState<any[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [editMode, setEditMode] = useState(false);
  const [formData, setFormData] = useState<Partial<AnalysisData>>({
    notes: '',
    rating: 3,
    recommendation: '',
    attachments: [],
  });
  const [showSuccess, setShowSuccess] = useState(false);
  const [showRejectDialog, setShowRejectDialog] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [budgetStatus, setBudgetStatus] = useState<Record<string, BudgetCheckResult>>({});
  const [checkingBudget, setCheckingBudget] = useState(false);
  const [exchangeRate, setExchangeRate] = useState<number>(2800);

  useEffect(() => {
    loadRequisitionData();
    fetchExchangeRate();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const fetchExchangeRate = async () => {
      try {
          const response = await fetch(`${API_BASE_URL}/api/settings/exchange-rate`);
          if (response.ok) {
              const data = await response.json();
              setExchangeRate(data.rate);
          }
      } catch (e) {
          console.error("Erreur chargement taux", e);
      }
  };

  useEffect(() => {
    if (requisition && requisition.items && requisition.items.length > 0 && user?.role === 'analyste') {
      checkBudgets();
    }
  }, [requisition, exchangeRate]);

  const checkBudgets = async () => {
    if (!requisition || !requisition.items) return;
    
    setCheckingBudget(true);
    const token = localStorage.getItem('token');
    if (!token) return;

    const newBudgetStatus: Record<string, BudgetCheckResult> = {};
    const reqDate = new Date(requisition.created_at);
    const mois = reqDate.toISOString().slice(0, 7); // YYYY-MM

    for (const item of requisition.items) {
      try {
        let amountToCheck = item.prix_total || (item.quantite * item.prix_unitaire);
        if (requisition.devise === 'CDF') {
           amountToCheck = amountToCheck / exchangeRate; 
        }

        const response = await fetch(`${API_BASE_URL}/api/budgets/check`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                description: item.description,
                montant: amountToCheck,
                mois: mois
            })
        });

        if (response.ok) {
            const result = await response.json();
            newBudgetStatus[item.id] = result;
        }
      } catch (e) {
          console.error("Erreur check budget item", item.id, e);
      }
    }
    
    setBudgetStatus(newBudgetStatus);
    setCheckingBudget(false);
  };

  const loadRequisitionData = async () => {
    try {
      setLoading(true);
      
      // Récupérer le token depuis localStorage
      const token = localStorage.getItem('token');
      if (!token) {
        console.error('Token non trouvé');
        setLoading(false);
        return;
      }

      // Récupérer les détails de la réquisition depuis l'API du backend
      const response = await fetch(`${API_BASE_URL}/api/requisitions/${id}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const data = await response.json();
        console.log('Réquisition récupérée depuis le backend:', data);
        
        if (data.messages) setMessages(data.messages);
        if (data.actions) setActions(data.actions);

        // Normalisation des statuts
        let statut = data.requisition.statut;
        if (statut === 'valide') statut = 'validee';
        if (statut === 'refuse') statut = 'refusee';

        // Mettre en forme les données pour le composant
        const requisition: Requisition = {
          id: data.requisition.id,
          reference: data.requisition.numero,
          objet: data.requisition.objet,
          description: data.requisition.commentaire_initial || '',
          montant: data.requisition.montant_usd || data.requisition.montant_cdf || 0,
          devise: data.requisition.montant_usd ? 'USD' : 'CDF',
          urgence: 'normale' as const,
          statut: statut as 'brouillon' | 'soumise' | 'en_cours' | 'validee' | 'refusee' | 'payee',
          created_at: data.requisition.created_at,
          updated_at: data.requisition.updated_at,
          emetteur_id: data.requisition.emetteur_id,
          emetteur_nom: data.requisition.emetteur_nom,
          service_id: data.requisition.service_id,
          service_nom: data.requisition.service_nom,
          niveau: data.requisition.niveau,
          pieces_jointes: data.pieces?.map((p: any) => p.nom_fichier) || [],
          pieces_jointes_data: data.pieces || [],
          analyses: [],
          workflow: undefined,
          items: data.items || []
        };
        
        setRequisition(requisition);
        
        // Vérifier si une analyse existe déjà
        const existingAnalysis = requisition.analyses?.find(a => a.analyst_id === user?.id);
        if (existingAnalysis) {
          setAnalysis(existingAnalysis);
          setFormData({
            notes: existingAnalysis.notes || '',
            rating: existingAnalysis.rating || 3,
            recommendation: existingAnalysis.recommendation || '',
            attachments: existingAnalysis.attachments || [],
          });
        }
      } else {
        console.error('Erreur lors de la récupération de la réquisition:', response.status);
        // En cas d'erreur, essayer avec le service local
        const requisitionService = RequisitionService.getInstance();
        const req = requisitionService.getRequisitionById(parseInt(id || '0'));
        
        if (!req) {
          navigate('/requisitions');
          return;
        }
        
        setRequisition(req);
      }
      
      setLoading(false);
    } catch (error) {
      console.error('Erreur lors du chargement de la réquisition:', error);
      // En cas d'erreur, essayer avec le service local
      try {
        const requisitionService = RequisitionService.getInstance();
        const req = requisitionService.getRequisitionById(parseInt(id || '0'));
        
        if (!req) {
          navigate('/requisitions');
          return;
        }
        
        setRequisition(req);
      } catch (localError) {
        console.error('Erreur avec le service local aussi:', localError);
      }
      setLoading(false);
    }
  };

  const handleSaveAnalysis = () => {
    if (!requisition || !user) return;
    
    const analysisData: AnalysisData = {
      notes: formData.notes || '',
      rating: formData.rating || 3,
      recommendation: formData.recommendation || '',
      attachments: formData.attachments || [],
      analysis_date: new Date().toISOString(),
      analyst_id: user.id,
    };
    
    const requisitionService = RequisitionService.getInstance();
    requisitionService.addAnalysis(requisition.id, analysisData);
    
    setAnalysis(analysisData);
    setEditMode(false);
    setShowSuccess(true);
    setTimeout(() => setShowSuccess(false), 3000);
  };

  // Fonction pour vérifier si l'utilisateur peut valider l'étape actuelle
  const canValidateCurrentStep = () => {
    if (!requisition || !user) return false;
    
    // Logique simplifiée basée sur le niveau de la réquisition
    console.log(`Checking validation rights: Role=${user.role}, Niveau=${requisition.niveau}, Statut=${requisition.statut}`);

    // Si la réquisition est validée, refusée ou payée, on ne peut plus valider
    if (['validee', 'refusee', 'payee', 'terminee'].includes(requisition.statut)) return false;

    const userRole = user.role?.toLowerCase();
    const reqNiveau = requisition.niveau?.toLowerCase();

    // Correspondance directe Rôle <-> Niveau
    if (userRole && reqNiveau && userRole === reqNiveau) {
        return true;
    }

    // Exception pour l'analyste qui peut agir sur les réquisitions au niveau 'emetteur' ou 'analyste'
    if (userRole === 'analyste') {
        if (reqNiveau === 'emetteur' || reqNiveau === 'analyste' || reqNiveau === 'approbation_service') {
             // Note: Si 'approbation_service', normalement on attend le chef.
             // Mais si l'analyste veut forcer/intervenir, on permet ?
             // Pour l'instant, on s'en tient aux droits standards.
             // Si le niveau est 'emetteur', l'analyste peut prendre la main.
             // Si le niveau est 'analyste', c'est son tour.
             return true;
        }
    }

    // Cas particuliers (mapping si les noms ne sont pas identiques)
    if (userRole === 'validateur' && reqNiveau === 'validateur') return true; // PM
    if (userRole === 'pm' && reqNiveau === 'validateur') return true; // PM alias
    // Permettre au PM/Validateur d'agir aussi si la réquisition est au niveau 'challenger' (workflow simplifié)
    if ((userRole === 'pm' || userRole === 'validateur') && reqNiveau === 'challenger') return true;
    if (userRole === 'gm' && reqNiveau === 'gm') return true;
    if (userRole === 'comptable' && reqNiveau === 'paiement') return true;

    // Ancienne logique de fallback (si workflow object existait, ce qui n'est pas le cas ici avec le backend actuel)
    return false;
  };

  const handleValidate = async () => {
    if (!requisition || !user) return;
    
    try {
      // Utiliser l'API du backend pour valider
      const token = localStorage.getItem('token');
      if (!token) {
        alert('Token non trouvé. Veuillez vous reconnecter.');
        return;
      }

      // Déterminer le commentaire selon le rôle
      let commentaire = '';
      if (user.role === 'validateur' || user.role === 'pm') {
        commentaire = 'Réquisition validée par le Project Manager';
      } else if (user.role === 'gm') {
        commentaire = 'Réquisition approuvée pour paiement par le General Manager';
      } else if (user.role === 'comptable') {
        commentaire = 'Paiement effectué';
      } else {
        commentaire = 'Réquisition validée';
      }
      
      const response = await fetch(`${API_BASE_URL}/api/requisitions/${requisition.id}/action`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          action: 'valider',
          commentaire: commentaire
        })
      });

      if (response.ok) {
        const result = await response.json();
        console.log('Validation réussie:', result);
        
        // Mettre à jour l'état local
        setRequisition({
          ...requisition,
          statut: (user.role === 'gm' || result.niveauApres === 'paiement') ? 'validee' : (user.role === 'comptable' ? 'payee' : 'en_cours'),
          niveau: result.niveauApres || ((user.role === 'gm') ? 'paiement' : (user.role === 'comptable' ? 'termine' : 'gm'))
        });
        
        setShowSuccess(true);
        setTimeout(() => setShowSuccess(false), 3000);
      } else {
        const error = await response.json();
        let errorMessage = error.error || 'Erreur inconnue';
        if (error.details && Array.isArray(error.details)) {
            errorMessage += '\n\n' + error.details.join('\n');
        }
        alert('Erreur lors de la validation:\n' + errorMessage);
      }
    } catch (error) {
      console.error('Erreur lors de la validation:', error);
      alert('Erreur lors de la validation. Veuillez réessayer.');
    }
  };

  const handleReject = () => {
    if (!requisition || !rejectReason.trim()) return;
    
    const requisitionService = RequisitionService.getInstance();
    requisitionService.updateRequisition(requisition.id, { statut: 'refusee' });
    
    // Ajouter une note de rejet
    const rejectAnalysis: AnalysisData = {
      notes: `REJET: ${rejectReason}`,
      rating: 1,
      recommendation: 'Rejeté',
      attachments: [],
      analysis_date: new Date().toISOString(),
      analyst_id: user?.id || 0,
    };
    
    requisitionService.addAnalysis(requisition.id, rejectAnalysis);
    
    setRequisition({ ...requisition, statut: 'refusee' });
    setShowRejectDialog(false);
    setRejectReason('');
    setShowSuccess(true);
    setTimeout(() => setShowSuccess(false), 3000);
  };

  const handleSendMessage = async () => {
    if (!requisition || !newMessage.trim()) return;

    try {
      const token = localStorage.getItem('token');
      if (!token) return;

      const response = await fetch(`${API_BASE_URL}/api/requisitions/${requisition.id}/messages`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ message: newMessage })
      });

      if (response.ok) {
        setNewMessage('');
        // Recharger les données pour voir le nouveau message
        loadRequisitionData();
        setShowSuccess(true);
        setTimeout(() => setShowSuccess(false), 3000);
      } else {
        alert('Erreur lors de l\'envoi du message');
      }
    } catch (error) {
      console.error('Erreur:', error);
    }
  };

  const handleDownloadAttachment = (fileName: string, requisitionReference: string) => {
    // Trouver la réquisition correspondante
    // Note: We should rely on the current 'requisition' state if it matches, 
    // or use the list from service as fallback, but for backend files we need the data in 'requisition.pieces_jointes_data'
    
    let targetRequisition = requisition;
    if (targetRequisition?.reference !== requisitionReference) {
         // Fallback to service search if the reference doesn't match current view
        const requisitionService = RequisitionService.getInstance();
        const requisitions = requisitionService.getAllRequisitions();
        targetRequisition = requisitions.find(r => r.reference === requisitionReference) || null;
    }
    
    if (!targetRequisition || !targetRequisition.pieces_jointes_data) {
      alert('Fichier non trouvé ou données non disponibles');
      return;
    }
    
    // Trouver le fichier spécifique
    // Backend returns 'nom_fichier', local service might use 'name'
    const fileData = targetRequisition.pieces_jointes_data.find(f => f.name === fileName || f.nom_fichier === fileName);
    
    if (fileData) {
      if (fileData.data) {
         // Télécharger le vrai fichier (Base64)
         downloadBase64File(fileData.data, fileName, fileData.type);
         alert(`Téléchargement de la pièce jointe: ${fileName}`);
      } else if (fileData.chemin_fichier) {
         // Backend file
         const storedFileName = fileData.chemin_fichier.split(/[\\/]/).pop();
         const url = `${API_BASE_URL}/uploads/${storedFileName}`;
         
         const link = document.createElement('a');
         link.href = url;
         link.target = "_blank";
         link.download = fileName;
         document.body.appendChild(link);
         link.click();
         document.body.removeChild(link);
      } else {
          alert('Données du fichier manquantes');
      }
    } else {
      alert('Fichier non trouvé');
    }
  };

  // Fonction pour télécharger un fichier base64
  const downloadBase64File = (base64Data: string, fileName: string, mimeType: string) => {
    // Extraire les données base64 (enlever le préfixe data:mime;base64,)
    const base64Content = base64Data.split(',')[1] || base64Data;
    
    // Convertir base64 en blob
    const byteCharacters = atob(base64Content);
    const byteNumbers = new Array(byteCharacters.length);
    for (let i = 0; i < byteCharacters.length; i++) {
      byteNumbers[i] = byteCharacters.charCodeAt(i);
    }
    const byteArray = new Uint8Array(byteNumbers);
    const blob = new Blob([byteArray], { type: mimeType });
    
    // Créer le lien de téléchargement
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  };

  const getStatutColor = (statut: string) => {
    switch (statut) {
      case 'brouillon': return '#9e9e9e';
      case 'soumise': return '#2196f3';
      case 'en_cours': return '#ff9800';
      case 'validee': return '#4caf50';
      case 'refusee': return '#f44336';
      case 'payee': return '#9c27b0';
      default: return '#9e9e9e';
    }
  };

  const getStatutLabel = (statut: string) => {
    switch (statut) {
      case 'brouillon': return 'Brouillon';
      case 'soumise': return 'Soumise';
      case 'en_cours': return 'En cours';
      case 'validee': return 'Validée';
      case 'refusee': return 'Refusée';
      case 'payee': return 'Payée';
      default: return statut;
    }
  };

  const getUrgenceColor = (urgence: string) => {
    switch (urgence) {
      case 'basse': return '#4caf50';
      case 'normale': return '#2196f3';
      case 'haute': return '#ff9800';
      case 'critique': return '#f44336';
      default: return '#9e9e9e';
    }
  };

  const getUrgenceLabel = (urgence: string) => {
    switch (urgence) {
      case 'basse': return 'Basse';
      case 'normale': return 'Normale';
      case 'haute': return 'Haute';
      case 'critique': return 'Critique';
      default: return urgence;
    }
  };

  const getBackRoute = () => {
    if (!user) return '/dashboard';
    switch (user.role) {
      case 'emetteur': return '/emitter-profile';
      case 'analyste': return '/analyst-profile';
      case 'validateur': return '/pm-profile';
      case 'gm': return '/gm-profile';
      case 'comptable':
      case 'challenger':
        return '/profile';
      default: return '/dashboard';
    }
  };

  if (loading) {
    return (
      <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
        <Box sx={{ display: 'flex', justifyContent: 'center', mt: 8 }}>
          <CircularProgress />
        </Box>
      </Container>
    );
  }

  if (!requisition) {
    return (
      <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
        <Alert severity="error">Réquisition non trouvée</Alert>
      </Container>
    );
  }

  return (
    <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
      {/* En-tête */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 4 }}>
        <Box sx={{ display: 'flex', alignItems: 'center' }}>
          <Button onClick={() => navigate(getBackRoute())} startIcon={<ArrowBack />} sx={{ mr: 2 }}>
            Retour
          </Button>
          <Typography variant="h4">Analyse de Réquisition</Typography>
        </Box>
        <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
          <Button
            variant="outlined"
            startIcon={<LocalPrintshop />}
            onClick={handlePrint}
          >
            Imprimer
          </Button>

          {/* Résumé du workflow */}
          {requisition.workflow && (
            <WorkflowSummary workflow={requisition.workflow} />
          )}
          
          {/* Boutons d'action génériques (Analyste, Challenger, etc.) */}
          {(requisition.statut === 'soumise' || requisition.statut === 'en_cours') && canValidateCurrentStep() && user?.role?.toLowerCase() !== 'validateur' && user?.role?.toLowerCase() !== 'pm' && user?.role?.toLowerCase() !== 'gm' && (
            <>
              <Button 
                variant="contained" 
                color="success"
                startIcon={<CheckCircle />}
                onClick={handleValidate}
                sx={{ mr: 1 }}
              >
                Valider cette étape
              </Button>
              <Button 
                variant="contained" 
                color="error"
                startIcon={<Cancel />}
                onClick={() => setShowRejectDialog(true)}
              >
                Rejeter
              </Button>
            </>
          )}

          {/* Actions spécifiques Validateur (PM) */}
          {(requisition.statut === 'en_cours' || requisition.statut === 'soumise') && (user?.role?.toLowerCase() === 'validateur' || user?.role?.toLowerCase() === 'pm') && canValidateCurrentStep() && (
            <>
              <Button 
                variant="contained" 
                color="success"
                startIcon={<CheckCircle />}
                onClick={handleValidate}
                sx={{ mr: 1 }}
              >
                Approuver la réquisition
              </Button>
              <Button 
                variant="contained" 
                color="error"
                startIcon={<Cancel />}
                onClick={() => setShowRejectDialog(true)}
              >
                Rejeter
              </Button>
            </>
          )}
          
          {/* Validation GM */}
          {requisition.statut === 'en_cours' && user?.role?.toLowerCase() === 'gm' && requisition.niveau?.toLowerCase() === 'gm' && (
            <>
              <Button 
                variant="contained" 
                color="success"
                startIcon={<CheckCircle />}
                onClick={handleValidate}
                sx={{ mr: 1 }}
              >
                Approuver (GM)
              </Button>
              <Button 
                variant="contained" 
                color="error"
                startIcon={<Cancel />}
                onClick={() => setShowRejectDialog(true)}
              >
                Refuser
              </Button>
            </>
          )}
          {/* Actions spécifiques Comptable */}
          {(requisition.statut === 'validee' || requisition.niveau === 'paiement') && user?.role?.toLowerCase() === 'comptable' && canValidateCurrentStep() && (
            <>
              <Button 
                variant="contained" 
                color="success"
                startIcon={<MonetizationOn />}
                onClick={handleValidate}
                sx={{ mr: 1 }}
              >
                Confirmer le paiement
              </Button>
              <Button 
                variant="contained" 
                color="error"
                startIcon={<Cancel />}
                onClick={() => setShowRejectDialog(true)}
              >
                Rejeter
              </Button>
            </>
          )}
        </Box>
      </Box>

      {showSuccess && (
        <Alert severity="success" sx={{ mb: 2 }}>
          {requisition.statut === 'validee' ? 'Réquisition validée avec succès!' : 
           requisition.statut === 'refusee' ? 'Réquisition rejetée!' : 
           'Analyse sauvegardée avec succès!'}
        </Alert>
      )}

      <Box sx={{ display: 'flex', gap: 3, flexDirection: { xs: 'column', md: 'row' } }}>
        {/* Informations de la réquisition */}
        <Box sx={{ flex: { xs: 1, md: 0.666 } }}>
          <Card sx={{ mb: 3 }}>
            <CardContent>
              <Typography variant="h6" sx={{ mb: 2 }}>
                <Assignment sx={{ mr: 1, verticalAlign: 'middle' }} />
                Détails de la Réquisition
              </Typography>
              
              <Box sx={{ mb: 2 }}>
                <Typography variant="subtitle1" color="primary">
                  {requisition.reference}
                </Typography>
                <Typography variant="h5" sx={{ mb: 1 }}>
                  {requisition.objet}
                </Typography>
                <Typography variant="body1" sx={{ mb: 2 }}>
                  {requisition.description}
                </Typography>
              </Box>

              <Box sx={{ display: 'flex', gap: 2, mb: 2, flexWrap: 'wrap' }}>
                <Chip
                  label={getStatutLabel(requisition.statut)}
                  size="small"
                  sx={{
                    backgroundColor: getStatutColor(requisition.statut),
                    color: 'white',
                  }}
                />
                <Chip
                  label={getUrgenceLabel(requisition.urgence)}
                  size="small"
                  sx={{
                    backgroundColor: getUrgenceColor(requisition.urgence),
                    color: 'white',
                  }}
                />
                {requisition.pieces_jointes && requisition.pieces_jointes.length > 0 && (
                  <Chip
                    label={`${requisition.pieces_jointes.length} pièce(s)`}
                    size="small"
                    icon={<AttachFile sx={{ fontSize: 16 }} />}
                    variant="outlined"
                    color="info"
                  />
                )}
              </Box>

              <Box sx={{ display: 'flex', gap: 2, mb: 2, flexWrap: 'wrap' }}>
                <Box sx={{ flex: { xs: 1, sm: 0.25 }, textAlign: 'center', p: 2, bgcolor: 'grey.50', borderRadius: 1 }}>
                  <Typography variant="body2" color="text.secondary">Montant</Typography>
                  <Typography variant="h6" color="primary">
                    <MoneyDisplay 
                      amount={requisition.montant} 
                      currency={requisition.devise} 
                      rate={exchangeRate} 
                    />
                  </Typography>
                </Box>
                <Box sx={{ flex: { xs: 1, sm: 0.25 }, textAlign: 'center', p: 2, bgcolor: 'grey.50', borderRadius: 1 }}>
                  <Typography variant="body2" color="text.secondary">Initiateur</Typography>
                  <Typography variant="body1">
                    {requisition.emetteur_nom}
                  </Typography>
                </Box>
                <Box sx={{ flex: { xs: 1, sm: 0.25 }, textAlign: 'center', p: 2, bgcolor: 'grey.50', borderRadius: 1 }}>
                  <Typography variant="body2" color="text.secondary">Service</Typography>
                  <Typography variant="body1">
                    {requisition.service_nom}
                  </Typography>
                </Box>
                <Box sx={{ flex: { xs: 1, sm: 0.25 }, textAlign: 'center', p: 2, bgcolor: 'grey.50', borderRadius: 1 }}>
                  <Typography variant="body2" color="text.secondary">Date</Typography>
                  <Typography variant="body1">
                    {new Date(requisition.created_at).toLocaleDateString()}
                  </Typography>
                </Box>
              </Box>

              {requisition.pieces_jointes && requisition.pieces_jointes.length > 0 && (
                <Box sx={{ mt: 2 }}>
                  <Typography variant="subtitle2" sx={{ mb: 1 }}>
                    <AttachFile sx={{ mr: 1, verticalAlign: 'middle' }} />
                    Pièces jointes
                  </Typography>
                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                    {requisition.pieces_jointes.map((file, index) => (
                      <Box
                        key={index}
                        sx={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 1,
                          p: 1,
                          bgcolor: 'grey.50',
                          borderRadius: 1,
                          border: '1px solid #e0e0e0'
                        }}
                      >
                        <AttachFile sx={{ fontSize: 16, color: 'primary.main' }} />
                        <Typography variant="body2">
                          {file}
                        </Typography>
                        <IconButton
                          size="small"
                          onClick={() => handleDownloadAttachment(file, requisition.reference)}
                          title="Télécharger cette pièce jointe"
                        >
                          <Download sx={{ fontSize: 14 }} />
                        </IconButton>
                      </Box>
                    ))}
                  </Box>
                </Box>
              )}
            </CardContent>
          </Card>

          {/* Lignes de la réquisition */}
          {requisition.items && requisition.items.length > 0 && (
            <Card sx={{ mb: 3 }}>
                <CardContent>
                    <Typography variant="h6" sx={{ mb: 2 }}>
                        Lignes de la Réquisition
                    </Typography>
                    <TableContainer component={Paper} variant="outlined">
                        <Table size="small">
                            <TableHead>
                                <TableRow>
                                    <TableCell>Description</TableCell>
                                    <TableCell align="right">Qté</TableCell>
                                    <TableCell align="right">P.U.</TableCell>
                                    <TableCell align="right">Total</TableCell>
                                    {user?.role === 'analyste' && (
                                        <TableCell align="center">Budget</TableCell>
                                    )}
                                </TableRow>
                            </TableHead>
                            <TableBody>
                                {requisition.items.map((item) => {
                                    const budget = budgetStatus[item.id];
                                    return (
                                        <TableRow key={item.id}>
                                            <TableCell>{item.description}</TableCell>
                                            <TableCell align="right">{item.quantite}</TableCell>
                                            <TableCell align="right">
                                                <MoneyDisplay 
                                                    amount={item.prix_unitaire} 
                                                    currency={requisition.devise} 
                                                    rate={exchangeRate} 
                                                />
                                            </TableCell>
                                            <TableCell align="right">
                                                <MoneyDisplay 
                                                    amount={item.prix_total || (item.quantite * item.prix_unitaire)} 
                                                    currency={requisition.devise} 
                                                    rate={exchangeRate} 
                                                />
                                            </TableCell>
                                            {user?.role === 'analyste' && (
                                                <TableCell align="center">
                                                    {checkingBudget ? (
                                                        <CircularProgress size={20} />
                                                    ) : budget ? (
                                                        budget.allowed ? (
                                                            <Tooltip title={`Reste: ${budget.details?.reste.toFixed(2)} USD`}>
                                                                <Chip 
                                                                    icon={<CheckCircle />} 
                                                                    label="OK" 
                                                                    color="success" 
                                                                    size="small" 
                                                                    variant="outlined" 
                                                                />
                                                            </Tooltip>
                                                        ) : (
                                                            budget.reason && budget.reason.includes('non trouvée') ? (
                                                                <Tooltip title={budget.reason}>
                                                                    <Chip 
                                                                        icon={<Cancel />} 
                                                                        label="Non trouvé" 
                                                                        color="warning" 
                                                                        size="small" 
                                                                        variant="outlined" 
                                                                    />
                                                                </Tooltip>
                                                            ) : (
                                                                <Tooltip title={`${budget.reason} ${budget.details ? '(Reste: ' + budget.details.reste.toFixed(2) + ' USD)' : ''}`}>
                                                                    <Chip 
                                                                        icon={<Cancel />} 
                                                                        label="Dépassement" 
                                                                        color="error" 
                                                                        size="small" 
                                                                        variant="outlined" 
                                                                    />
                                                                </Tooltip>
                                                            )
                                                        )
                                                    ) : (
                                                        <Typography variant="caption" color="text.secondary">-</Typography>
                                                    )}
                                                </TableCell>
                                            )}
                                        </TableRow>
                                    );
                                })}
                            </TableBody>
                        </Table>
                    </TableContainer>
                </CardContent>
            </Card>
          )}

          {/* Section d'analyse */}
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                <Typography variant="h6">
                  <Assessment sx={{ mr: 1, verticalAlign: 'middle' }} />
                  Analyse de l'Analyste
                </Typography>
                {!editMode && (
                  <Button 
                    variant="outlined" 
                    startIcon={<Edit />}
                    onClick={() => setEditMode(true)}
                  >
                    Modifier l'analyse
                  </Button>
                )}
              </Box>

              {editMode ? (
                <Box>
                  <Accordion defaultExpanded>
                    <AccordionSummary expandIcon={<ExpandMore />}>
                      <Typography>Notes et Annotations</Typography>
                    </AccordionSummary>
                    <AccordionDetails>
                      <TextField
                        fullWidth
                        multiline
                        rows={4}
                        label="Notes d'analyse"
                        value={formData.notes}
                        onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                        sx={{ mb: 2 }}
                      />
                    </AccordionDetails>
                  </Accordion>

                  <Accordion>
                    <AccordionSummary expandIcon={<ExpandMore />}>
                      <Typography>Évaluation</Typography>
                    </AccordionSummary>
                    <AccordionDetails>
                      <Box sx={{ mb: 2 }}>
                        <Typography variant="body2" sx={{ mb: 1 }}>
                          Note globale
                        </Typography>
                        <Rating
                          value={formData.rating}
                          onChange={(_, newValue) => setFormData({ ...formData, rating: newValue || 3 })}
                          size="large"
                        />
                      </Box>
                    </AccordionDetails>
                  </Accordion>

                  <Accordion>
                    <AccordionSummary expandIcon={<ExpandMore />}>
                      <Typography>Recommandation</Typography>
                    </AccordionSummary>
                    <AccordionDetails>
                      <FormControl fullWidth sx={{ mb: 2 }}>
                        <InputLabel>Recommandation</InputLabel>
                        <Select
                          value={formData.recommendation}
                          label="Recommandation"
                          onChange={(e) => setFormData({ ...formData, recommendation: e.target.value })}
                        >
                          <MenuItem value="Approuver">Approuver</MenuItem>
                          <MenuItem value="Approuver avec conditions">Approuver avec conditions</MenuItem>
                          <MenuItem value="Demander plus d'informations">Demander plus d'informations</MenuItem>
                          <MenuItem value="Rejeter">Rejeter</MenuItem>
                        </Select>
                      </FormControl>
                    </AccordionDetails>
                  </Accordion>

                  <Box sx={{ display: 'flex', gap: 2, mt: 3 }}>
                    <Button 
                      variant="contained" 
                      startIcon={<Save />}
                      onClick={handleSaveAnalysis}
                      sx={{ flex: 1 }}
                    >
                      Sauvegarder l'analyse
                    </Button>
                    <Button 
                      variant="outlined" 
                      startIcon={<Cancel />}
                      onClick={() => setEditMode(false)}
                      sx={{ flex: 1 }}
                    >
                      Annuler
                    </Button>
                  </Box>
                </Box>
              ) : (
                <Box>
                  {analysis ? (
                    <>
                      <Accordion defaultExpanded>
                        <AccordionSummary expandIcon={<ExpandMore />}>
                          <Typography>Notes et Annotations</Typography>
                        </AccordionSummary>
                        <AccordionDetails>
                          <Typography variant="body1">
                            {analysis.notes || 'Aucune note'}
                          </Typography>
                        </AccordionDetails>
                      </Accordion>

                      <Accordion>
                        <AccordionSummary expandIcon={<ExpandMore />}>
                          <Typography>Évaluation</Typography>
                        </AccordionSummary>
                        <AccordionDetails>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                            <Rating value={analysis.rating} readOnly />
                            <Typography variant="body2">
                              {analysis.rating}/5
                            </Typography>
                          </Box>
                        </AccordionDetails>
                      </Accordion>

                      <Accordion>
                        <AccordionSummary expandIcon={<ExpandMore />}>
                          <Typography>Recommandation</Typography>
                        </AccordionSummary>
                        <AccordionDetails>
                          <Chip
                            label={analysis.recommendation}
                            color={analysis.recommendation === 'Approuver' ? 'success' : 'warning'}
                            size="small"
                          />
                        </AccordionDetails>
                      </Accordion>

                      <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
                        Analyse effectuée le {new Date(analysis.analysis_date).toLocaleDateString()}
                      </Typography>
                    </>
                  ) : (
                    <Typography variant="body2" color="text.secondary">
                      Aucune analyse effectuée
                    </Typography>
                  )}
                </Box>
              )}
            </CardContent>
          </Card>
        </Box>

        {/* Workflow Tracker */}
        {requisition.workflow && (
          <WorkflowTracker workflow={requisition.workflow} compact={false} />
        )}

        {/* Historique des analyses */}
        <Box sx={{ flex: { xs: 1, md: 0.333 } }}>
          <Card>
            <CardContent>
              <Typography variant="h6" sx={{ mb: 2 }}>
                <Timeline sx={{ mr: 1, verticalAlign: 'middle' }} />
                Historique des Analyses
              </Typography>
              
              {requisition.analyses && requisition.analyses.length > 0 ? (
                <List>
                  {requisition.analyses.map((analysis, index) => (
                    <ListItem key={index} divider>
                      <ListItemIcon>
                        <Comment color="primary" />
                      </ListItemIcon>
                      <ListItemText
                        primary={
                          <Box>
                            <Typography variant="subtitle2">
                              Analyse #{index + 1}
                            </Typography>
                            <Typography variant="body2" color="text.secondary">
                              {new Date(analysis.analysis_date).toLocaleDateString()}
                            </Typography>
                          </Box>
                        }
                        secondary={
                          <Box sx={{ mt: 1 }}>
                            <Rating value={analysis.rating} readOnly size="small" />
                            <Typography variant="caption" sx={{ display: 'block', mt: 0.5 }}>
                              {analysis.notes?.substring(0, 50)}...
                            </Typography>
                          </Box>
                        }
                      />
                    </ListItem>
                  ))}
                </List>
              ) : (
                <Typography variant="body2" color="text.secondary">
                  Aucune analyse précédente
                </Typography>
              )}
            </CardContent>
          </Card>
        </Box>
      </Box>

      {/* Conversation et Historique */}
      <Card sx={{ mt: 3 }}>
        <CardContent>
          <Typography variant="h6" sx={{ mb: 2 }}>
            <Comment sx={{ mr: 1, verticalAlign: 'middle' }} />
            Conversation et Historique
          </Typography>

          <Box sx={{ maxHeight: 400, overflowY: 'auto', mb: 3, p: 2, bgcolor: 'grey.50', borderRadius: 1 }}>
            {/* Fusionner et trier messages et actions par date */}
            {[...messages, ...actions]
              .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
              .map((item, index) => {
                const isMessage = 'message' in item && !('action' in item);
                const isAction = 'action' in item;
                
                return (
                  <Box key={index} sx={{ mb: 2, display: 'flex', flexDirection: 'column', alignItems: isMessage && item.utilisateur_id === user?.id ? 'flex-end' : 'flex-start' }}>
                    <Box sx={{ 
                      maxWidth: '80%', 
                      p: 2, 
                      borderRadius: 2, 
                      bgcolor: isAction ? 'warning.light' : (item.utilisateur_id === user?.id ? 'primary.light' : 'white'),
                      boxShadow: 1
                    }}>
                      <Typography variant="subtitle2" color="text.secondary" sx={{ display: 'flex', justifyContent: 'space-between', gap: 2 }}>
                        <span>{item.utilisateur_nom || item.uploader_nom}</span>
                        <span>{new Date(item.created_at).toLocaleString()}</span>
                      </Typography>
                      
                      {isAction && (
                        <Typography variant="body2" sx={{ fontWeight: 'bold', mt: 0.5 }}>
                          Action: {item.action.toUpperCase()} {item.niveau_apres && `-> ${item.niveau_apres}`}
                        </Typography>
                      )}
                      
                      <Typography variant="body1" sx={{ mt: 0.5 }}>
                        {isMessage ? item.message : item.commentaire}
                      </Typography>
                    </Box>
                  </Box>
                );
              })}
              
            {messages.length === 0 && actions.length === 0 && (
              <Typography variant="body2" color="text.secondary" textAlign="center">
                Aucun message ou historique disponible
              </Typography>
            )}
          </Box>

          <Box sx={{ display: 'flex', gap: 2 }}>
            <TextField
              fullWidth
              placeholder="Écrire un message..."
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              multiline
              maxRows={4}
            />
            <Button 
              variant="contained" 
              onClick={handleSendMessage}
              disabled={!newMessage.trim()}
              endIcon={<Comment />}
            >
              Envoyer
            </Button>
          </Box>
        </CardContent>
      </Card>

      {/* Dialogue de rejet */}
      <Dialog open={showRejectDialog} onClose={() => setShowRejectDialog(false)} maxWidth="md" fullWidth>
        <DialogTitle>Motif de rejet</DialogTitle>
        <DialogContent>
          <TextField
            fullWidth
            multiline
            rows={4}
            label="Veuillez expliquer pourquoi vous rejetez cette réquisition"
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
            sx={{ mt: 2 }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowRejectDialog(false)}>Annuler</Button>
          <Button 
            onClick={handleReject} 
            color="error" 
            variant="contained"
            disabled={!rejectReason.trim()}
          >
            Confirmer le rejet
          </Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
};

export default RequisitionAnalysis;
