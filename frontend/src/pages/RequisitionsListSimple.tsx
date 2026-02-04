import React, { useState, useEffect } from 'react';
import { 
  Typography, 
  Box,
  Button,
  TextField, 
  Paper,
  IconButton,
  Chip,
  Alert,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  CircularProgress,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Tabs,
  Tab,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  InputAdornment,
  Grid,
  Divider,
  Tooltip,
  TablePagination,
  alpha,
  useTheme,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Checkbox
} from '@mui/material';
import {
  Add,
  Visibility,
  AttachFile,
  Timeline,
  Reply,
  Search,
  CheckCircle,
  Cancel,
  HourglassEmpty,
  Drafts,
  Send,
  Warning,
  LocalPrintshop,
  ThumbUp,
  ThumbDown,
  Comment,
  Edit,
  MonetizationOn,
  AttachMoney
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import RequisitionService, { Requisition } from '../services/RequisitionService';
import { useAuth } from '../context/AuthContext';
import { API_BASE_URL } from '../config';

const RequisitionsList: React.FC = () => {
  const navigate = useNavigate();
  const theme = useTheme();
  const { user } = useAuth();
  const [requisitions, setRequisitions] = useState<Requisition[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedRequisition, setSelectedRequisition] = useState<Requisition | null>(null);
  const [showDetails, setShowDetails] = useState(false);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterUrgence, setFilterUrgence] = useState<string>('all');
  const [filterService, setFilterService] = useState<string>('all');
  const [services, setServices] = useState<string[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState<'active' | 'history'>('active');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  
  // Selection state for batch actions
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  
  // Pagination state
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);

  // Action Dialog State
  const [actionDialogOpen, setActionDialogOpen] = useState(false);
  const [selectedAction, setSelectedAction] = useState<'valider' | 'refuser' | 'commenter' | null>(null);
  const [processingRequisition, setProcessingRequisition] = useState<Requisition | null>(null);
  const [actionComment, setActionComment] = useState('');
  const [paymentMode, setPaymentMode] = useState<'Cash' | 'Banque'>('Cash');
  const [submitting, setSubmitting] = useState(false);
  const [compilingPdf, setCompilingPdf] = useState(false);

  useEffect(() => {
    loadRequisitions();
  }, []);

  const loadRequisitions = async () => {
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        // Fallback to local service
        const requisitionService = RequisitionService.getInstance();
        setRequisitions(requisitionService.getAllRequisitions());
        setLoading(false);
        return;
      }

      const response = await fetch(`${API_BASE_URL}/api/requisitions`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const data = await response.json();
        console.log('Données reçues:', data);
        
        if (Array.isArray(data)) {
          const formattedRequisitions = data.map((req: any) => {
            // Normalisation des statuts pour le frontend
            let statut = req.statut;
            if (statut === 'valide') statut = 'validee';
            if (statut === 'refuse') statut = 'refusee';

            return {
              id: req.id,
              reference: req.numero || 'N/A',
              objet: req.objet || 'Sans objet',
              description: req.commentaire_initial || '',
              montant: req.montant_usd || req.montant_cdf || 0,
              devise: req.montant_usd ? 'USD' : 'CDF',
              urgence: (req.urgence as 'basse' | 'normale' | 'haute' | 'critique') || 'normale',
              statut: statut,
              created_at: req.created_at,
              updated_at: req.updated_at,
              emetteur_id: req.emetteur_id,
              emetteur_nom: req.emetteur_nom || 'Inconnu',
              service_id: req.service_id,
              service_nom: req.service_nom || 'Inconnu',
              niveau: req.niveau,
              mode_paiement: req.mode_paiement, // Ajout du mode de paiement
              pieces_jointes: Array.isArray(req.pieces) ? req.pieces.map((p: any) => p.nom_fichier) : [],
              pieces_jointes_data: req.pieces || [],
              nb_pieces: req.nb_pieces || 0,
              analyses: [],
              actions: req.actions || [],
              related_to: req.related_to,
              response_chain: req.response_chain
            };
          });
          setRequisitions(formattedRequisitions);
          
          // Extraire les services uniques pour le filtre
          const uniqueServices = Array.from(new Set(formattedRequisitions.map((r: any) => r.service_nom))).filter(Boolean).sort() as string[];
          setServices(uniqueServices);
        } else {
          console.error('Format de données inattendu:', data);
          setRequisitions([]);
        }
      } else {
        console.error('Erreur réponse API:', response.status);
        // Fallback
        const requisitionService = RequisitionService.getInstance();
        setRequisitions(requisitionService.getAllRequisitions());
      }
    } catch (error) {
      console.error('Erreur:', error);
      // Fallback
      const requisitionService = RequisitionService.getInstance();
      setRequisitions(requisitionService.getAllRequisitions());
    } finally {
      setLoading(false);
    }
  };

  const handleViewRequisition = async (requisition: Requisition) => {
    setSelectedRequisition(requisition);
    setShowDetails(true);
    setLoadingDetails(true);

    try {
      const token = localStorage.getItem('token');
      if (!token) return;

      const response = await fetch(`${API_BASE_URL}/api/requisitions/${requisition.id}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        console.log('Requisition details fetched:', data);
        
        setSelectedRequisition(prev => {
          if (!prev || prev.id !== requisition.id) return prev;
          
          return {
            ...prev,
            description: data.requisition.commentaire_initial || prev.description,
            pieces_jointes: data.pieces.map((p: any) => p.nom_fichier),
            pieces_jointes_data: data.pieces,
            actions: data.actions,
            nb_pieces: data.pieces.length,
            items: data.items,
            // Mise à jour des informations de l'émetteur pour l'affichage complet
            emetteur_email: data.requisition.emetteur_email,
            emetteur_role: data.requisition.emetteur_role,
            emetteur_telephone: data.requisition.emetteur_telephone,
            emetteur_zone: data.requisition.emetteur_zone
          };
        });
      }
    } catch (error) {
      console.error('Erreur lors du chargement des détails:', error);
    } finally {
      setLoadingDetails(false);
    }
  };

  const handleCorrection = (requisition: Requisition) => {
    navigate(`/requisitions/new?edit=${requisition.id}`);
  };

  const handleCloseDialog = () => {
    setShowDetails(false);
    setSelectedRequisition(null);
  };

  const handleChangePage = (event: unknown, newPage: number) => {
    setPage(newPage);
  };

  const handleChangeRowsPerPage = (event: React.ChangeEvent<HTMLInputElement>) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
  };

  const handleDownloadAttachment = (fileName: string, requisition: Requisition) => {
    const fileData = requisition.pieces_jointes_data?.find((p: any) => p.nom_fichier === fileName);

    if (fileData) {
      if (fileData.data) {
        const link = document.createElement('a');
        link.href = fileData.data;
        link.download = fileName;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      } 
      // If we only have the path (backend file serving)
      else if (fileData.chemin_fichier) {
        const storedFileName = fileData.chemin_fichier.split(/[\\/]/).pop();
        const url = `${API_BASE_URL}/uploads/${storedFileName}`;
        
        const link = document.createElement('a');
        link.href = url;
        link.target = "_blank";
        link.download = fileName;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      }
    }
  };

  const handlePrint = () => {
    // Add a small delay to ensure the dialog is fully rendered
    setTimeout(() => {
      window.print();
    }, 100);
  };

  const getRoleLabel = (role?: string) => {
    if (!role) return '-';
    const roles: Record<string, string> = {
      'admin': 'Administrateur',
      'gm': 'General Manager',
      'validateur': 'Validateur',
      'analyste': 'Analyste',
      'challenger': 'Challenger',
      'compilateur': 'Compilateur',
      'emetteur': 'Initiateur',
      'comptable': 'Comptable',
      'pm': 'Project Manager'
    };
    return roles[role.toLowerCase()] || role;
  };

  const getStatusFilters = (role?: string) => {
    const allStatuses = [
      { value: 'all', label: 'Tous' },
      { value: 'brouillon', label: 'Brouillon' },
      { value: 'soumise', label: 'Soumise' },
      { value: 'en_cours', label: 'En cours' },
      { value: 'a_corriger', label: 'À corriger' },
      { value: 'validee', label: 'Validée' },
      { value: 'refusee', label: 'Refusée' },
      { value: 'payee', label: 'Payée' },
      { value: 'termine', label: 'Terminée' },
      { value: 'annulee', label: 'Annulée' }
    ];

    if (!role) return allStatuses;

    const roleLower = role.toLowerCase();

    // Comptable: Focus sur validé, payé, terminé
    if (roleLower === 'comptable') {
      return allStatuses.filter(s => ['all', 'validee', 'payee', 'termine', 'en_cours'].includes(s.value));
    }

    // Analyste, Validateur, GM, Challenger: Workflow de validation
    if (['analyste', 'validateur', 'gm', 'challenger', 'compilateur'].includes(roleLower)) {
      return allStatuses.filter(s => ['all', 'soumise', 'en_cours', 'validee', 'refusee', 'a_corriger'].includes(s.value));
    }

    // Emetteur, Admin, PM: Accès complet
    return allStatuses;
  };

  const getStatutConfig = (statut: string, niveau?: string) => {
    switch (statut) {
      case 'brouillon': return { label: 'Brouillon', color: theme.palette.grey[500], icon: <Drafts fontSize="small" /> };
      case 'soumise': return { label: 'Soumise', color: theme.palette.info.main, icon: <Send fontSize="small" /> };
      case 'en_cours': 
        if (niveau) {
          switch(niveau) {
            case 'emetteur': return { label: 'Chez l\'émetteur', color: theme.palette.warning.main, icon: <Warning fontSize="small" /> };
            case 'analyste': return { label: 'Chez l\'analyste', color: theme.palette.warning.main, icon: <HourglassEmpty fontSize="small" /> };
            case 'challenger': return { label: 'Chez le challenger', color: theme.palette.warning.main, icon: <HourglassEmpty fontSize="small" /> };
            case 'validateur': return { label: 'Chez le validateur', color: theme.palette.warning.main, icon: <HourglassEmpty fontSize="small" /> };
            case 'gm': return { label: 'Chez le GM', color: theme.palette.warning.main, icon: <HourglassEmpty fontSize="small" /> };
            case 'paiement': return { label: 'Au paiement', color: theme.palette.info.main, icon: <MonetizationOn fontSize="small" /> };
          }
        }
        return { label: 'En cours', color: theme.palette.warning.main, icon: <HourglassEmpty fontSize="small" /> };
      case 'validee': 
        // Si validée mais niveau paiement, on peut préciser
        if (niveau === 'paiement') return { label: 'Prêt pour paiement', color: theme.palette.success.main, icon: <MonetizationOn fontSize="small" /> };
        if (niveau === 'gm') return { label: 'Validée par GM', color: theme.palette.success.main, icon: <CheckCircle fontSize="small" /> };
        return { label: 'Validée', color: theme.palette.success.main, icon: <CheckCircle fontSize="small" /> };
      case 'refusee': return { label: 'Refusée', color: theme.palette.error.main, icon: <Cancel fontSize="small" /> };
      case 'termine': return { label: 'Terminée', color: theme.palette.info.dark, icon: <CheckCircle fontSize="small" /> };
      case 'payee': return { label: 'Payée', color: theme.palette.success.dark, icon: <CheckCircle fontSize="small" /> };
      case 'en_attente': return { label: 'En attente', color: theme.palette.secondary.main, icon: <HourglassEmpty fontSize="small" /> };
      case 'a_corriger': return { label: 'À corriger', color: theme.palette.warning.dark, icon: <Warning fontSize="small" /> };
      default: return { label: statut, color: theme.palette.grey[500], icon: null };
    }
  };

  const getUrgenceConfig = (urgence: string) => {
    switch (urgence) {
      case 'basse': return { label: 'Basse', color: theme.palette.success.main };
      case 'moyenne': return { label: 'Moyenne', color: theme.palette.warning.main };
      case 'haute': return { label: 'Haute', color: theme.palette.error.light };
      case 'critique': return { label: 'Critique', color: theme.palette.error.main };
      default: return { label: urgence, color: theme.palette.grey[500] };
    }
  };

  const isRequisitionFinished = (statut: string) => {
    return ['refusee', 'termine', 'payee', 'annulee'].includes(statut);
  };

  const canUserAct = (requisition: Requisition) => {
    if (!user) return false;
    
    // Exception pour le comptable qui peut agir sur les réquisitions validées (pour paiement)
    if (user.role === 'comptable' && (requisition.statut === 'validee' || requisition.niveau === 'paiement')) {
        return true;
    }

    // Si la réquisition est terminée/validée/refusée, aucune action n'est permise (lecture seule)
    if (isRequisitionFinished(requisition.statut)) return false;
    
    // Admin peut tout faire (pour debug/supervision)
    if (user.role === 'admin' && !isRequisitionFinished(requisition.statut)) return true;

    const userRole = user.role?.toLowerCase();
    const reqNiveau = requisition.niveau?.toLowerCase();

    // Correspondance directe (le cas standard : Analyste sur Analyste, Challenger sur Challenger, etc.)
    if (userRole && reqNiveau && userRole === reqNiveau) return true;

    // Logique de workflow et exceptions
    if (userRole === 'emetteur' && reqNiveau === 'emetteur') return true;
    if (userRole === 'analyste' && reqNiveau === 'emetteur') return true;
    if (userRole === 'pm' && reqNiveau === 'validateur') return true;
    // Permettre au PM/Validateur d'agir aussi si la réquisition est au niveau 'challenger' (workflow simplifié)
    if ((userRole === 'pm' || userRole === 'validateur') && reqNiveau === 'challenger') return true;
    
    return false;
  };

  const handleOpenActionDialog = (requisition: Requisition, action: 'valider' | 'refuser' | 'commenter') => {
    setProcessingRequisition(requisition);
    setSelectedAction(action);
    setActionComment('');
    setPaymentMode('Cash');
    setActionDialogOpen(true);
  };

  const handleCloseActionDialog = () => {
    setActionDialogOpen(false);
    setProcessingRequisition(null);
    setSelectedAction(null);
    setActionComment('');
    setPaymentMode('Cash');
  };

  const handleSubmitAction = async () => {
    if (!processingRequisition || !selectedAction) return;
    
    // Validation du commentaire (obligatoire pour refuser ou commenter)
    if ((selectedAction === 'refuser' || selectedAction === 'commenter') && !actionComment.trim()) {
      alert('Le commentaire est obligatoire pour cette action.');
      return;
    }
    
    // Pour valider, le commentaire est optionnel mais recommandé
    if (selectedAction === 'valider' && !actionComment.trim()) {
      // Pas de confirmation pour le comptable car "sans commentaires"
      if (user?.role?.toLowerCase() !== 'comptable') {
        if (!window.confirm('Voulez-vous valider sans commentaire ?')) {
          return;
        }
      }
    }

    setSubmitting(true);
    try {
      const token = localStorage.getItem('token');
      if (!token) throw new Error('Non authentifié');

      let url = '';
      let method = '';
      let body = {};

      if (selectedAction === 'commenter') {
        url = `${API_BASE_URL}/api/requisitions/${processingRequisition.id}/messages`;
        method = 'POST';
        body = { message: actionComment };
      } else {
        url = `${API_BASE_URL}/api/requisitions/${processingRequisition.id}/action`;
        method = 'PUT';
        body = { 
          action: selectedAction, 
          commentaire: actionComment || (user?.role?.toLowerCase() === 'comptable' ? '' : 'Validé'),
          mode_paiement: (user?.role?.toLowerCase() === 'comptable' && selectedAction === 'valider') ? paymentMode : undefined
        };
      }

      const response = await fetch(url, {
        method,
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(body)
      });

      if (response.ok) {
        // Rafraîchir la liste
        loadRequisitions();
        handleCloseActionDialog();
        // Fermer aussi le dialogue de détails si ouvert
        if (showDetails && selectedRequisition?.id === processingRequisition.id) {
          handleCloseDialog();
        }
      } else {
        const errorData = await response.json();
        let msg = `Erreur: ${errorData.error}`;
        if (errorData.details && Array.isArray(errorData.details)) {
            msg += '\n\nDétails:\n' + errorData.details.join('\n');
        }
        alert(msg);
      }
    } catch (error) {
      console.error('Erreur:', error);
      alert('Une erreur est survenue.');
    } finally {
      setSubmitting(false);
    }
  };

  // Filtering
  const filteredRequisitions = requisitions.filter(req => {
    const matchesStatus = filterStatus === 'all' || req.statut === filterStatus;
    const matchesUrgence = filterUrgence === 'all' || req.urgence === filterUrgence;
    const matchesService = filterService === 'all' || req.service_nom === filterService;
    const matchesSearch = (req.objet || '').toLowerCase().includes(searchTerm.toLowerCase()) || 
                          (req.reference || '').toLowerCase().includes(searchTerm.toLowerCase());
    
    // Date filtering
    let matchesDate = true;
    if (startDate || endDate) {
      const reqDate = req.created_at ? String(req.created_at).substring(0, 10) : '';
      if (startDate && reqDate < startDate) matchesDate = false;
      if (endDate && reqDate > endDate) matchesDate = false;
    }

    return matchesStatus && matchesUrgence && matchesService && matchesSearch && matchesDate;
  });

  const activeRequisitions = filteredRequisitions.filter(req => {
    // Exclure les réquisitions terminées/payées/refusées (sauf si l'utilisateur veut voir l'historique)
    // On garde 'validee' dans Actives tant qu'elle n'est pas payée ou terminée
    const isFinished = req.statut === 'refusee' || req.statut === 'termine' || req.statut === 'payee' || req.statut === 'annulee';
    if (isFinished) return false;
    
    // Si statut est 'a_corriger', seul l'émetteur (ou admin) doit le voir dans Actives
    if (req.statut === 'a_corriger' && user?.role !== 'emetteur' && user?.role !== 'admin') {
      return false;
    }
    
    return true;
  });

  const historyRequisitions = filteredRequisitions.filter(req => 
    req.statut === 'refusee' || req.statut === 'termine' || req.statut === 'payee' || req.statut === 'annulee'
  );

  const currentList = activeTab === 'active' ? activeRequisitions : historyRequisitions;
  const paginatedList = currentList.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage);

  // Batch Selection Handlers
  const handleSelectAllClick = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.checked) {
      // Select all payable requisitions in the current list
      const newSelecteds = currentList
        .filter(n => (n.statut === 'validee' || n.niveau === 'paiement') && user?.role === 'comptable')
        .map(n => n.id);
      setSelectedIds(newSelecteds);
      return;
    }
    setSelectedIds([]);
  };

  const handleClick = (event: React.MouseEvent<unknown>, id: number) => {
    const selectedIndex = selectedIds.indexOf(id);
    let newSelected: number[] = [];

    if (selectedIndex === -1) {
      newSelected = newSelected.concat(selectedIds, id);
    } else if (selectedIndex === 0) {
      newSelected = newSelected.concat(selectedIds.slice(1));
    } else if (selectedIndex === selectedIds.length - 1) {
      newSelected = newSelected.concat(selectedIds.slice(0, -1));
    } else if (selectedIndex > 0) {
      newSelected = newSelected.concat(
        selectedIds.slice(0, selectedIndex),
        selectedIds.slice(selectedIndex + 1),
      );
    }

    setSelectedIds(newSelected);
  };

  const isSelected = (id: number) => selectedIds.indexOf(id) !== -1;

  const handleBatchPayment = async () => {
    if (selectedIds.length === 0) return;
    
    if (!window.confirm(`Voulez-vous confirmer le paiement pour ${selectedIds.length} réquisitions ?`)) {
      return;
    }

    setSubmitting(true);
    try {
      const token = localStorage.getItem('token');
      if (!token) throw new Error('Non authentifié');

      const response = await fetch(`${API_BASE_URL}/api/requisitions/batch-pay`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ requisitionIds: selectedIds })
      });

      if (response.ok) {
        const result = await response.json();
        alert(result.message || 'Paiements effectués avec succès');
        setSelectedIds([]);
        loadRequisitions();
      } else {
        const errorData = await response.json();
        let msg = `Erreur: ${errorData.error}`;
        if (errorData.details && Array.isArray(errorData.details)) {
            msg += '\n\nDétails:\n' + errorData.details.join('\n');
        }
        alert(msg);
      }
    } catch (error) {
      console.error('Erreur:', error);
      alert('Une erreur est survenue lors du paiement groupé.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleCompilePdf = async () => {
    try {
      setCompilingPdf(true);
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_BASE_URL}/api/requisitions/compile/pdf`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `requisitions_compiled_${Date.now()}.pdf`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        window.URL.revokeObjectURL(url);
      } else {
        const err = await response.json();
        alert(err.message || 'Erreur lors de la génération du PDF');
      }
    } catch (error) {
      console.error('Erreur download PDF:', error);
      alert('Erreur lors du téléchargement du PDF compilé.');
    } finally {
      setCompilingPdf(false);
    }
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '50vh' }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box>
      <style>
        {`
          @media print {
            body * {
              visibility: hidden;
            }
            .printable-content, .printable-content * {
              visibility: visible;
            }
            .printable-content {
              position: fixed;
              left: 0;
              top: 0;
              width: 100vw;
              height: 100vh;
              margin: 0;
              padding: 20px;
              background: white;
              z-index: 9999;
              overflow: visible !important;
            }
            .no-print {
              display: none !important;
            }
            .print-only {
              display: flex !important;
            }
            .print-only-block {
              display: block !important;
            }
            .screen-only {
              display: none !important;
            }
          }
          /* Screen styles */
          .print-only, .print-only-block {
            display: none;
          }
        `}
      </style>
      {/* Header Section */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 4 }}>
        <Box>
          <Typography variant="h4" sx={{ fontWeight: 700, color: 'text.primary', mb: 1 }}>
            Mes Réquisitions
          </Typography>
          <Typography variant="body1" color="text.secondary">
            Gérez et suivez vos demandes d'achats et de services
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', gap: 2 }}>
          <Button
            variant="outlined"
            startIcon={compilingPdf ? <CircularProgress size={20} /> : <LocalPrintshop />}
            onClick={handleCompilePdf}
            disabled={compilingPdf}
            sx={{ 
              px: 3, 
              py: 1.5,
              borderRadius: 2,
              textTransform: 'none',
              fontSize: '1rem',
              fontWeight: 600,
              boxShadow: theme.shadows[2],
              bgcolor: 'background.paper'
            }}
          >
            {compilingPdf ? 'Compilation...' : 'Compiler tout en PDF'}
          </Button>
          <Button
            variant="contained"
            startIcon={<Add />}
            onClick={() => navigate('/requisitions/new')}
            sx={{ 
              px: 3, 
              py: 1.5,
              borderRadius: 2,
              textTransform: 'none',
              fontSize: '1rem',
              fontWeight: 600,
              boxShadow: theme.shadows[4]
            }}
          >
            Nouvelle Réquisition
          </Button>
        </Box>
      </Box>

      {/* Stats Cards */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        {[
          { label: 'Total Réquisitions', value: requisitions.length, color: theme.palette.primary.main, icon: <Timeline /> },
          { label: 'En cours', value: requisitions.filter(r => r.statut === 'en_cours').length, color: theme.palette.warning.main, icon: <HourglassEmpty /> },
          { label: 'Validées', value: requisitions.filter(r => r.statut === 'validee').length, color: theme.palette.success.main, icon: <CheckCircle /> },
          { label: 'Payées', value: requisitions.filter(r => r.statut === 'payee').length, color: theme.palette.info.main, icon: <AttachMoney /> },
          { label: 'Urgentes', value: requisitions.filter(r => r.urgence === 'critique').length, color: theme.palette.error.main, icon: <Warning /> },
        ].map((stat, index) => (
          <Grid size={{ xs: 12, sm: 6, md: 2.4 }} key={index}>
            <Paper 
              elevation={0}
              sx={{ 
                p: 3, 
                borderRadius: 3, 
                border: '1px solid',
                borderColor: alpha(stat.color, 0.1),
                bgcolor: alpha(stat.color, 0.02),
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between'
              }}
            >
              <Box>
                <Typography variant="h3" sx={{ fontWeight: 700, color: stat.color, mb: 0.5 }}>
                  {stat.value}
                </Typography>
                <Typography variant="subtitle2" color="text.secondary" fontWeight={600}>
                  {stat.label}
                </Typography>
              </Box>
              <Box sx={{ 
                p: 1.5, 
                borderRadius: '50%', 
                bgcolor: alpha(stat.color, 0.1),
                color: stat.color,
                display: 'flex'
              }}>
                {stat.icon}
              </Box>
            </Paper>
          </Grid>
        ))}
      </Grid>

      {/* Main Content Area */}
      <Paper elevation={0} sx={{ borderRadius: 3, border: '1px solid', borderColor: 'divider', overflow: 'hidden' }}>
        {/* Filters Bar */}
        <Box sx={{ p: 3, borderBottom: '1px solid', borderColor: 'divider', bgcolor: 'background.paper' }}>
          <Grid container spacing={2} alignItems="center">
            <Grid size={{ xs: 12, md: 2.5 }}>
              <TextField
                fullWidth
                placeholder="Rechercher..."
                variant="outlined"
                size="small"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <Search color="action" />
                    </InputAdornment>
                  ),
                }}
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 6, md: 2 }}>
              <FormControl fullWidth size="small">
                <InputLabel>Service</InputLabel>
                <Select
                  value={filterService}
                  label="Service"
                  onChange={(e) => setFilterService(e.target.value)}
                >
                  <MenuItem value="all">Tous</MenuItem>
                  {services.map((service) => (
                    <MenuItem key={service} value={service}>
                      {service}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid size={{ xs: 12, sm: 6, md: 2 }}>
              <FormControl fullWidth size="small">
                <InputLabel>Statut</InputLabel>
                <Select
                  value={filterStatus}
                  label="Statut"
                  onChange={(e) => setFilterStatus(e.target.value)}
                >
                  {getStatusFilters(user?.role).map((status) => (
                    <MenuItem key={status.value} value={status.value}>
                      {status.label}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid size={{ xs: 12, sm: 6, md: 1.5 }}>
               <FormControl fullWidth size="small">
                <InputLabel>Urgence</InputLabel>
                <Select
                  value={filterUrgence}
                  label="Urgence"
                  onChange={(e) => setFilterUrgence(e.target.value)}
                >
                  <MenuItem value="all">Toutes</MenuItem>
                  <MenuItem value="basse">Basse</MenuItem>
                  <MenuItem value="moyenne">Moyenne</MenuItem>
                  <MenuItem value="haute">Haute</MenuItem>
                  <MenuItem value="critique">Critique</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid size={{ xs: 12, sm: 6, md: 2 }}>
              <TextField
                fullWidth
                label="Du"
                type="date"
                size="small"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                InputLabelProps={{ shrink: true }}
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 6, md: 2 }}>
              <TextField
                fullWidth
                label="Au"
                type="date"
                size="small"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                InputLabelProps={{ shrink: true }}
              />
            </Grid>
          </Grid>
        </Box>

        {/* Tabs and Actions */}
        <Box sx={{ borderBottom: 1, borderColor: 'divider', px: 3, bgcolor: 'background.paper', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Tabs 
            value={activeTab} 
            onChange={(e, v) => { setActiveTab(v); setPage(0); }}
            textColor="primary"
            indicatorColor="primary"
          >
            <Tab label={`Actives (${activeRequisitions.length})`} value="active" sx={{ textTransform: 'none', fontWeight: 600 }} />
            <Tab label={`Historique (${historyRequisitions.length})`} value="history" sx={{ textTransform: 'none', fontWeight: 600 }} />
          </Tabs>

          {selectedIds.length > 0 && user?.role === 'comptable' && (
            <Button
              variant="contained"
              color="secondary"
              startIcon={<AttachMoney />}
              onClick={handleBatchPayment}
              disabled={submitting}
              sx={{ my: 1 }}
            >
              Payer la sélection ({selectedIds.length})
            </Button>
          )}
        </Box>

        {/* Table */}
        <TableContainer>
          <Table sx={{ minWidth: 650 }}>
            <TableHead sx={{ bgcolor: 'grey.50' }}>
              <TableRow>
                {user?.role === 'comptable' && (
                  <TableCell padding="checkbox">
                    <Checkbox
                      color="primary"
                      indeterminate={
                        selectedIds.length > 0 && 
                        selectedIds.length < paginatedList.filter(n => (n.statut === 'validee' || n.niveau === 'paiement')).length
                      }
                      checked={
                        paginatedList.filter(n => (n.statut === 'validee' || n.niveau === 'paiement')).length > 0 && 
                        selectedIds.length === paginatedList.filter(n => (n.statut === 'validee' || n.niveau === 'paiement')).length
                      }
                      onChange={handleSelectAllClick}
                    />
                  </TableCell>
                )}
                <TableCell sx={{ fontWeight: 700, color: 'text.secondary' }}>Référence</TableCell>
                <TableCell sx={{ fontWeight: 700, color: 'text.secondary', width: '30%' }}>Objet</TableCell>
                <TableCell sx={{ fontWeight: 700, color: 'text.secondary' }}>Montant</TableCell>
                <TableCell sx={{ fontWeight: 700, color: 'text.secondary' }}>Mode</TableCell>
                <TableCell sx={{ fontWeight: 700, color: 'text.secondary' }}>Service</TableCell>
                <TableCell sx={{ fontWeight: 700, color: 'text.secondary' }}>Initiateur</TableCell>
                <TableCell sx={{ fontWeight: 700, color: 'text.secondary' }}>Statut</TableCell>
                <TableCell sx={{ fontWeight: 700, color: 'text.secondary' }}>Urgence</TableCell>
                <TableCell sx={{ fontWeight: 700, color: 'text.secondary' }}>Date</TableCell>
                <TableCell align="right" sx={{ fontWeight: 700, color: 'text.secondary' }}>Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {paginatedList.map((req) => {
                const statutConfig = getStatutConfig(req.statut, req.niveau);
                const urgenceConfig = getUrgenceConfig(req.urgence);
                const nbPieces = req.nb_pieces || 0;
                
                return (
                  <TableRow 
                    key={req.id}
                    hover
                    onClick={() => handleViewRequisition(req)}
                    selected={isSelected(req.id)}
                    sx={{ 
                      cursor: 'pointer',
                      bgcolor: req.related_to ? alpha(theme.palette.error.main, 0.05) : 'inherit',
                      '&:hover': { bgcolor: req.related_to ? alpha(theme.palette.error.main, 0.1) : undefined }
                    }}
                  >
                    {user?.role === 'comptable' && (
                      <TableCell padding="checkbox">
                        <Checkbox
                          color="primary"
                          checked={isSelected(req.id)}
                          onClick={(event) => {
                            event.stopPropagation();
                            if ((req.statut === 'validee' || req.niveau === 'paiement')) {
                              handleClick(event, req.id);
                            }
                          }}
                          disabled={!((req.statut === 'validee' || req.niveau === 'paiement'))}
                        />
                      </TableCell>
                    )}
                    <TableCell>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        {req.related_to && <Reply fontSize="small" color="error" />}
                        <Typography variant="body2" fontWeight={700} color="primary">
                          {req.reference}
                        </Typography>
                      </Box>
                    </TableCell>
                    <TableCell>
                      <Box>
                        {req.related_to && (
                          <Typography variant="caption" color="error" fontWeight="bold" display="block">
                            RÉPONSE
                          </Typography>
                        )}
                        <Typography variant="body2" noWrap sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                          {req.objet}
                          {nbPieces > 0 && (
                            <Chip
                              label={`${nbPieces} pj`}
                              size="small"
                              icon={<AttachFile sx={{ fontSize: 14 }} />}
                              variant="outlined"
                              sx={{ ml: 1, height: 20, fontSize: '0.7rem', cursor: 'help' }}
                              title={`${nbPieces} pièce(s) jointe(s)`}
                            />
                          )}
                        </Typography>
                      </Box>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" fontWeight={600}>
                        {req.devise} {req.montant.toLocaleString()}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      {req.mode_paiement ? (
                        <Chip label={req.mode_paiement} color={req.mode_paiement === 'Cash' ? 'success' : 'primary'} size="small" />
                      ) : (
                        <Typography variant="caption" color="text.secondary">-</Typography>
                      )}
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" color="text.secondary">
                        {req.service_nom}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" color="text.secondary">
                        {req.emetteur_nom}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Chip 
                        icon={statutConfig.icon || undefined}
                        label={statutConfig.label} 
                        size="small"
                        sx={{ 
                          bgcolor: alpha(statutConfig.color, 0.1), 
                          color: statutConfig.color,
                          fontWeight: 700,
                          border: '1px solid',
                          borderColor: alpha(statutConfig.color, 0.2)
                        }} 
                      />
                    </TableCell>
                    <TableCell>
                      <Chip 
                        label={urgenceConfig.label} 
                        size="small"
                        sx={{ 
                          bgcolor: alpha(urgenceConfig.color, 0.1), 
                          color: urgenceConfig.color,
                          fontWeight: 700,
                          height: 24
                        }} 
                      />
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" color="text.secondary">
                        {new Date(req.created_at).toLocaleDateString()}
                      </Typography>
                    </TableCell>
                    <TableCell align="right">
                      <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
                        {canUserAct(req) && (
                          <>
                            <Tooltip title={
                              user?.role?.toLowerCase() === 'emetteur' ? "Envoyer aux analystes" : 
                              user?.role?.toLowerCase() === 'comptable' ? "Confirmer le paiement" : "Valider"
                            }>
                              <IconButton 
                                size="small" 
                                color="success"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleOpenActionDialog(req, 'valider');
                                }}
                              >
                                {user?.role?.toLowerCase() === 'emetteur' ? <Send fontSize="small" /> : 
                                 user?.role?.toLowerCase() === 'comptable' ? <AttachMoney fontSize="small" /> : <ThumbUp fontSize="small" />}
                              </IconButton>
                            </Tooltip>
                            <Tooltip title={user?.role?.toLowerCase() === 'emetteur' ? "Annuler la demande" : "Refuser"}>
                              <IconButton 
                                size="small" 
                                color="error"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleOpenActionDialog(req, 'refuser');
                                }}
                              >
                                {user?.role?.toLowerCase() === 'emetteur' ? <Cancel fontSize="small" /> : <ThumbDown fontSize="small" />}
                              </IconButton>
                            </Tooltip>
                          </>
                        )}
                        {/* Bouton Corriger pour l'émetteur */}
                        {(user?.role?.toLowerCase() === 'emetteur' || user?.role?.toLowerCase() === 'admin') && req.statut === 'a_corriger' && (
                          <Tooltip title="Corriger">
                            <IconButton 
                              size="small" 
                              color="warning"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleCorrection(req);
                              }}
                            >
                              <Edit fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        )}
                        {!isRequisitionFinished(req.statut) && (
                          <Tooltip title="Commenter">
                            <IconButton 
                              size="small" 
                              color="info"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleOpenActionDialog(req, 'commenter');
                              }}
                            >
                              <Comment fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        )}
                        <Tooltip title="Voir détails">
                          <IconButton 
                            size="small" 
                            color="primary"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleViewRequisition(req);
                            }}
                          >
                            <Visibility fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      </Box>
                    </TableCell>
                  </TableRow>
                );
              })}
              {paginatedList.length === 0 && (
                <TableRow>
                  <TableCell colSpan={8} align="center" sx={{ py: 8 }}>
                    <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
                      <Box sx={{ p: 2, bgcolor: 'grey.100', borderRadius: '50%' }}>
                        <Search sx={{ fontSize: 40, color: 'text.secondary' }} />
                      </Box>
                      <Typography variant="h6" color="text.secondary">
                        Aucune réquisition trouvée
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        Essayez de modifier vos filtres ou créez une nouvelle réquisition.
                      </Typography>
                    </Box>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>
        
        {/* Pagination */}
        <TablePagination
          rowsPerPageOptions={[5, 10, 25]}
          component="div"
          count={currentList.length}
          rowsPerPage={rowsPerPage}
          page={page}
          onPageChange={handleChangePage}
          onRowsPerPageChange={handleChangeRowsPerPage}
          labelRowsPerPage="Lignes par page:"
          labelDisplayedRows={({ from, to, count }) => `${from}-${to} sur ${count}`}
        />
      </Paper>

      {/* Detail Dialog */}
      <Dialog 
        open={showDetails} 
        onClose={handleCloseDialog} 
        maxWidth="md" 
        fullWidth
        PaperProps={{ sx: { borderRadius: 3 } }}
      >
        <DialogTitle sx={{ borderBottom: '1px solid', borderColor: 'divider', pb: 2 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <Box sx={{ 
              width: 40, 
              height: 40, 
              borderRadius: '50%', 
              bgcolor: 'primary.main', 
              color: 'white',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <Visibility />
            </Box>
            <Box>
              <Typography variant="h6" fontWeight={700}>
                Détails de la réquisition
              </Typography>
              {selectedRequisition && (
                <Typography variant="caption" color="text.secondary">
                  Ref: {selectedRequisition.reference}
                </Typography>
              )}
            </Box>
          </Box>
        </DialogTitle>
        
        <DialogContent sx={{ py: 3 }} className="printable-content">

          {selectedRequisition && (
            <Box>
              {/* Header for Print (Logo & Title) */}
              <Box className="print-only" sx={{ justifyContent: 'space-between', alignItems: 'center', mb: 4, pb: 2, borderBottom: '2px solid #eee' }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                  <img src="/logo192.png" alt="Logo" style={{ height: 60, width: 'auto' }} />
                  <Box>
                    <Typography variant="h6" fontWeight="bold" sx={{ color: 'primary.main' }}>GESTION DES RÉQUISITIONS</Typography>
                    <Typography variant="body2" color="text.secondary">Fiche de suivi</Typography>
                  </Box>
                </Box>
                <Box sx={{ textAlign: 'right' }}>
                  <Typography variant="h5" fontWeight="900" color="text.primary">RÉQUISITION</Typography>
                  <Typography variant="subtitle1" fontWeight="bold" color="primary.main">{selectedRequisition.reference}</Typography>
                </Box>
              </Box>

              {/* Response Warning */}
              {selectedRequisition.related_to && (
                <Alert severity="warning" icon={<Reply />} sx={{ mb: 3 }}>
                  <Typography variant="subtitle2" fontWeight="bold">
                    Réponse à une réquisition
                  </Typography>
                  Cette réquisition est une réponse à la demande #{selectedRequisition.related_to}.
                </Alert>
              )}

              {/* Header Info */}
              <Grid container spacing={3} sx={{ mb: 4 }}>
                <Grid size={{ xs: 12 }}>
                  <Typography variant="h5" fontWeight={700} color="primary" gutterBottom>
                    {selectedRequisition.objet}
                  </Typography>
                  <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                    <Chip 
                      label={getStatutConfig(selectedRequisition.statut, selectedRequisition.niveau).label}
                      color={selectedRequisition.statut === 'validee' ? 'success' : 'default'} // Simplified
                      sx={{ 
                        bgcolor: alpha(getStatutConfig(selectedRequisition.statut, selectedRequisition.niveau).color, 0.1),
                        color: getStatutConfig(selectedRequisition.statut, selectedRequisition.niveau).color,
                        fontWeight: 700
                      }}
                    />
                    <Chip 
                      label={`Urgence: ${getUrgenceConfig(selectedRequisition.urgence).label}`}
                      size="small"
                      variant="outlined"
                    />
                  </Box>
                </Grid>
              </Grid>

              <Divider sx={{ mb: 3 }} />

              {/* Main Details */}
              <Grid container spacing={3}>
                <Grid size={{ xs: 12, md: 8 }}>
                  <Box sx={{ mb: 3 }}>
                    <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                      DESCRIPTION
                    </Typography>
                    <Typography variant="body1" sx={{ whiteSpace: 'pre-wrap' }}>
                      {selectedRequisition.description || "Aucune description fournie."}
                    </Typography>
                  </Box>

                  {/* Items Table */}
                  <Box sx={{ mb: 3 }}>
                    <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                      DÉTAILS PRODUITS
                    </Typography>
                    {selectedRequisition.items && selectedRequisition.items.length > 0 ? (
                      <TableContainer component={Paper} variant="outlined">
                        <Table size="small">
                          <TableHead sx={{ bgcolor: 'grey.50' }}>
                            <TableRow>
                              <TableCell>Description</TableCell>
                              <TableCell align="right">Qté</TableCell>
                              <TableCell align="right">P.U.</TableCell>
                              <TableCell align="right">Total</TableCell>
                              <TableCell>Site</TableCell>
                            </TableRow>
                          </TableHead>
                          <TableBody>
                            {selectedRequisition.items.map((item, index) => (
                              <TableRow key={index}>
                                <TableCell>{item.description}</TableCell>
                                <TableCell align="right">{item.quantite}</TableCell>
                                <TableCell align="right">{item.prix_unitaire?.toLocaleString()}</TableCell>
                                <TableCell align="right">{(item.prix_total || (item.quantite * item.prix_unitaire))?.toLocaleString()}</TableCell>
                                <TableCell>{item.site_nom || '-'}</TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </TableContainer>
                    ) : (
                      <Typography variant="body2" color="text.secondary" fontStyle="italic">
                        Aucun détail produit disponible.
                      </Typography>
                    )}
                  </Box>

                  <Box sx={{ mb: 3 }}>
                    <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                      PIÈCES JOINTES
                    </Typography>
                    {loadingDetails ? (
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <CircularProgress size={20} />
                        <Typography variant="body2" color="text.secondary">Chargement des pièces jointes...</Typography>
                      </Box>
                    ) : selectedRequisition.pieces_jointes && selectedRequisition.pieces_jointes.length > 0 ? (
                      <>
                        {/* Screen View */}
                        <Box className="screen-only" sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                          {selectedRequisition.pieces_jointes.map((pj: string, idx: number) => (
                            <Chip 
                              key={idx} 
                              icon={<AttachFile />} 
                              label={pj} 
                              variant="outlined" 
                              clickable 
                              onClick={() => handleDownloadAttachment(pj, selectedRequisition)}
                            />
                          ))}
                        </Box>

                        {/* Print View */}
                        <Box className="print-only-block">
                          <List dense disablePadding>
                            {selectedRequisition.pieces_jointes.map((pj: string, idx: number) => (
                              <ListItem key={idx} disablePadding sx={{ py: 0.5 }}>
                                <ListItemIcon sx={{ minWidth: 32 }}>
                                  <AttachFile fontSize="small" />
                                </ListItemIcon>
                                <ListItemText 
                                  primary={pj} 
                                  primaryTypographyProps={{ variant: 'body2' }}
                                />
                              </ListItem>
                            ))}
                          </List>
                        </Box>
                      </>
                    ) : (
                      <Typography variant="body2" color="text.secondary" fontStyle="italic">
                        Aucune pièce jointe.
                      </Typography>
                    )}
                  </Box>
                </Grid>

                <Grid size={{ xs: 12, md: 4 }}>
                  <Paper variant="outlined" sx={{ p: 2, borderRadius: 2, bgcolor: 'grey.50' }}>
                    <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                      DÉTAILS FINANCIERS
                    </Typography>
                    <Typography variant="h4" color="primary.main" fontWeight={700} gutterBottom>
                      {selectedRequisition.devise} {selectedRequisition.montant.toLocaleString()}
                    </Typography>
                    
                    <Divider sx={{ my: 2 }} />
                    
                    <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                      INFORMATIONS
                    </Typography>
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                      <Box>
                        <Typography variant="caption" color="text.secondary">Service Demandeur</Typography>
                        <Typography variant="body2" fontWeight={600}>{selectedRequisition.service_nom}</Typography>
                      </Box>
                      <Box>
                        <Typography variant="caption" color="text.secondary">Initiateur</Typography>
                        <Typography variant="body2" fontWeight={600}>{selectedRequisition.emetteur_nom}</Typography>
                        {selectedRequisition.emetteur_role && (
                          <Typography variant="caption" display="block" color="text.secondary">
                            {getRoleLabel(selectedRequisition.emetteur_role)}
                          </Typography>
                        )}
                        {selectedRequisition.emetteur_zone && (
                          <Typography variant="caption" display="block" color="text.secondary">
                            {selectedRequisition.emetteur_zone}
                          </Typography>
                        )}
                        {selectedRequisition.emetteur_email && (
                          <Typography variant="caption" display="block" color="text.secondary">
                            {selectedRequisition.emetteur_email}
                          </Typography>
                        )}
                        {selectedRequisition.emetteur_telephone && (
                          <Typography variant="caption" display="block" color="text.secondary">
                            {selectedRequisition.emetteur_telephone}
                          </Typography>
                        )}
                      </Box>
                      <Box>
                        <Typography variant="caption" color="text.secondary">Date de création</Typography>
                        <Typography variant="body2" fontWeight={600}>
                          {new Date(selectedRequisition.created_at).toLocaleDateString()}
                        </Typography>
                      </Box>
                    </Box>
                  </Paper>
                </Grid>
              </Grid>

              {/* History/Actions */}
              {selectedRequisition.actions && selectedRequisition.actions.length > 0 && (
                <Box sx={{ mt: 4 }}>
                   <Typography variant="h6" fontWeight={700} gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Timeline color="action" />
                    Historique du traitement
                  </Typography>
                  <Paper variant="outlined" sx={{ borderRadius: 2, overflow: 'hidden' }}>
                    <List>
                      {selectedRequisition.actions.map((action: any, index: number) => (
                        <React.Fragment key={index}>
                          {index > 0 && <Divider component="li" />}
                          <ListItem alignItems="flex-start" sx={{ bgcolor: index === 0 ? alpha(theme.palette.primary.main, 0.05) : 'inherit' }}>
                            <ListItemIcon>
                              <Box sx={{ 
                                mt: 1,
                                width: 8, 
                                height: 8, 
                                borderRadius: '50%', 
                                bgcolor: action.action === 'valider' ? 'success.main' : action.action === 'refuser' ? 'error.main' : 'primary.main' 
                              }} />
                            </ListItemIcon>
                            <ListItemText
                              primary={
                                <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                                  <Typography variant="subtitle2" fontWeight={700}>
                                    {action.action.toUpperCase()}
                                  </Typography>
                                  <Typography variant="caption" color="text.secondary">
                                    {new Date(action.created_at).toLocaleString()}
                                  </Typography>
                                </Box>
                              }
                              secondary={
                                <Box>
                                  <Typography variant="body2" component="span" color="text.primary">
                                    {action.utilisateur_nom}
                                  </Typography>
                                  {action.commentaire && (
                                    <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5, fontStyle: 'italic', bgcolor: 'white', p: 1, borderRadius: 1, border: '1px dashed', borderColor: 'grey.300' }}>
                                      "{action.commentaire}"
                                    </Typography>
                                  )}
                                </Box>
                              }
                            />
                          </ListItem>
                        </React.Fragment>
                      ))}
                    </List>
                  </Paper>
                </Box>
              )}
            </Box>
          )}
        </DialogContent>
        <DialogActions sx={{ p: 2, borderTop: '1px solid', borderColor: 'divider' }} className="no-print">
          <Button onClick={handleCloseDialog} color="inherit">Fermer</Button>
          <Button variant="contained" onClick={handlePrint} startIcon={<LocalPrintshop />}>
            Imprimer
          </Button>
          {selectedRequisition && canUserAct(selectedRequisition) && (
            <>
              <Button 
                variant="contained" 
                color="success" 
                onClick={() => handleOpenActionDialog(selectedRequisition, 'valider')}
                startIcon={user?.role?.toLowerCase() === 'comptable' ? <MonetizationOn /> : <ThumbUp />}
              >
                {user?.role?.toLowerCase() === 'comptable' ? 'Payer' : 'Valider'}
              </Button>
              <Button 
                variant="contained" 
                color="error" 
                onClick={() => handleOpenActionDialog(selectedRequisition, 'refuser')}
                startIcon={<ThumbDown />}
              >
                Refuser
              </Button>
            </>
          )}
          {selectedRequisition && !isRequisitionFinished(selectedRequisition.statut) && (
            <Button 
              variant="outlined" 
              color="info" 
              onClick={() => selectedRequisition && handleOpenActionDialog(selectedRequisition, 'commenter')}
              startIcon={<Comment />}
            >
              Commenter
            </Button>
          )}
        </DialogActions>
      </Dialog>

      {/* Action Dialog */}
      <Dialog open={actionDialogOpen} onClose={handleCloseActionDialog} maxWidth="sm" fullWidth>
        <DialogTitle>
          {selectedAction === 'valider' && (user?.role?.toLowerCase() === 'comptable' ? 'Confirmer le paiement' : 'Valider la réquisition')}
          {selectedAction === 'refuser' && 'Refuser la réquisition'}
          {selectedAction === 'commenter' && 'Ajouter un commentaire'}
        </DialogTitle>
        <DialogContent>
          {selectedAction === 'valider' && (
            <Alert severity="success" sx={{ mb: 2 }}>
              {user?.role?.toLowerCase() === 'comptable' 
                ? 'Vous êtes sur le point de confirmer le paiement de cette réquisition.'
                : 'Vous êtes sur le point de valider cette réquisition. Elle passera au niveau suivant.'}
            </Alert>
          )}
          {selectedAction === 'refuser' && (
            <Alert severity="warning" sx={{ mb: 2 }}>
              Vous êtes sur le point de refuser cette réquisition. Elle sera retournée à l'émetteur ou terminée.
            </Alert>
          )}
          {!(user?.role === 'comptable' && selectedAction === 'valider') && (
            <TextField
              autoFocus
              margin="dense"
              label="Commentaire / Motif"
              fullWidth
              multiline
              rows={4}
              value={actionComment}
              onChange={(e) => setActionComment(e.target.value)}
              placeholder={selectedAction === 'refuser' ? "Motif du refus (obligatoire)" : "Votre commentaire..."}
              required={selectedAction === 'refuser' || selectedAction === 'commenter'}
            />
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseActionDialog} disabled={submitting}>Annuler</Button>
          <Button 
            onClick={handleSubmitAction} 
            variant="contained" 
            color={selectedAction === 'refuser' ? 'error' : selectedAction === 'valider' ? 'success' : 'primary'}
            disabled={submitting}
          >
            {submitting ? <CircularProgress size={24} /> : 'Confirmer'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default RequisitionsList;
