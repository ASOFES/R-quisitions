import React, { useState, useEffect, useCallback } from 'react';
import {
  Container,
  Typography,
  Box,
  Card,
  CardContent,
  Avatar,
  Button,
  TextField,
  Paper,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Divider,
  Chip,
  Alert,
  CircularProgress,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  IconButton,
} from '@mui/material';
import {
  Email,
  Phone,
  Business,
  Edit,
  Save,
  Cancel,
  ArrowBack,
  Work,
  Description,
  Logout,
  Settings,
  Visibility,
  AccountBalance,
  PieChart,
  FilterList,
  AttachFile,
  PictureAsPdf,
  Speed,
  CheckCircle,
  Analytics,
  Pending,
  AssignmentInd,
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { API_BASE_URL } from '../config';
import { useAuth } from '../context/AuthContext';
import { Requisition } from '../services/RequisitionService';

interface GMProfileData {
  id: number;
  username: string;
  email: string;
  nom_complet: string;
  telephone?: string;
  role: string;
  service_nom: string;
  service_id: number;
  created_at: string;
  total_requisitions_a_valider: number;
  requisitions_en_attente_paiement: number;
  requisitions_payees: number;
  taux_paiement: number;
  montant_total_paye: number;
}

const GMProfile: React.FC = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  
  const [profile, setProfile] = useState<GMProfileData | null>(null);
  const [allRequisitions, setAllRequisitions] = useState<Requisition[]>([]);
  const [loading, setLoading] = useState(true);
  const [editMode, setEditMode] = useState(false);
  const [formData, setFormData] = useState<Partial<GMProfileData>>({});
  const [showSuccess, setShowSuccess] = useState(false);
  const [filterStatus, setFilterStatus] = useState<string>('pending');
  const [filterService, setFilterService] = useState<string>('all');
  const [filterUrgence, setFilterUrgence] = useState<string>('all');

  const loadProfileData = useCallback(async () => {
    try {
      setLoading(true);
      
      const token = localStorage.getItem('token');
      if (!token) {
        console.error('Token non trouvé');
        setLoading(false);
        return;
      }

      // Initialize basic profile from user context
      let userProfile: GMProfileData = {
        id: user?.id || 0,
        username: user?.username || 'gm.user',
        email: user?.email || '',
        nom_complet: user?.nom_complet || 'Utilisateur GM',
        telephone: '',
        role: user?.role || 'gm',
        service_nom: user?.service_nom || 'Direction Générale',
        service_id: user?.service_id || 0,
        created_at: new Date().toISOString(),
        total_requisitions_a_valider: 0,
        requisitions_en_attente_paiement: 0,
        requisitions_payees: 0,
        taux_paiement: 0,
        montant_total_paye: 0,
      };

      try {
        const response = await fetch(`${API_BASE_URL}/api/requisitions`, {
          headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' }
        });
        
        if (response.ok) {
          const data = await response.json();
          setAllRequisitions(data);

          // Calculate stats for GM
          // Backend GM Levels: gm, paiement, justificatif, termine
          // Plus 'approbation_service' if chef
          const gmRelevant = data.filter((req: any) => 
            req.niveau === 'gm' || 
            req.niveau === 'paiement' || 
            req.niveau === 'justificatif' ||
            req.niveau === 'termine' ||
            (req.niveau === 'approbation_service' && req.service_chef_id === user?.id) ||
            ['validee', 'payee', 'termine'].includes(req.statut)
          );

          const stats = {
            total_requisitions_a_valider: gmRelevant.filter((r: any) => 
              r.niveau === 'gm' || (r.niveau === 'approbation_service' && r.service_chef_id === user?.id)
            ).length,
            requisitions_en_attente_paiement: gmRelevant.filter((r: any) => r.niveau === 'paiement' && r.statut !== 'payee').length,
            requisitions_payees: data.filter((r: any) => ['payee', 'termine'].includes(r.statut)).length,
            taux_paiement: gmRelevant.length > 0 ? Math.round((data.filter((r: any) => r.statut === 'payee').length / gmRelevant.length) * 100) : 0,
            montant_total_paye: data.filter((r: any) => ['payee', 'termine'].includes(r.statut)).reduce((sum: number, r: any) => {
              const val = parseFloat(String(r.montant_usd || r.montant_cdf || 0));
              return sum + (isNaN(val) ? 0 : val);
            }, 0),
          };

          userProfile = {
            ...userProfile,
            ...stats,
          };
        }
      } catch (err) {
        console.error('Exception fetch requisitions:', err);
      }

      setProfile(userProfile);
      setLoading(false);

    } catch (error) {
      console.error('Erreur globale chargement données:', error);
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    loadProfileData();
  }, [loadProfileData]);

  const handleEdit = () => {
    setEditMode(true);
    setFormData({
      nom_complet: profile?.nom_complet,
      telephone: profile?.telephone,
    });
  };

  const handleSave = () => {
    if (profile) {
      const updatedProfile = { ...profile, ...formData };
      setProfile(updatedProfile);
      setEditMode(false);
      setShowSuccess(true);
      setTimeout(() => setShowSuccess(false), 3000);
    }
  };

  const handleCancel = () => {
    setEditMode(false);
    setFormData({});
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const formatCurrency = (amount: number | undefined | null, currency: string = 'USD') => {
    const val = Number(amount || 0);
    return val.toLocaleString('fr-FR', {
        minimumFractionDigits: 0,
        maximumFractionDigits: 2,
        useGrouping: true
    }).replace(/[\u202F\u00A0]/g, ' ') + ' ' + currency;
  };

  const handleExportPDF = () => {
    const doc = new jsPDF();
    const today = new Date().toLocaleDateString();

    doc.setFontSize(20);
    doc.setTextColor(40, 40, 40);
    doc.text('Réquisitions à Valider (GM)', 14, 22);
    
    doc.setFontSize(11);
    doc.setTextColor(100);
    doc.text(`Date: ${today}`, 14, 30);
    doc.text(`Validateur: ${profile?.nom_complet || 'GM'}`, 14, 36);

    let yPos = 45;

    const pendingRequisitions = allRequisitions.filter(req => req.niveau === 'gm' || req.niveau === 'paiement');

    if (pendingRequisitions.length === 0) {
      doc.text("Aucune réquisition en attente de validation.", 14, 50);
      doc.save(`requisitions_gm_vide_${new Date().toISOString().slice(0, 10)}.pdf`);
      return;
    }

    pendingRequisitions.forEach((req, index) => {
      if (index > 0) {
        doc.addPage();
        yPos = 20;
      }

      doc.setFillColor(240, 240, 240);
      doc.rect(14, yPos, 182, 10, 'F');
      doc.setFontSize(12);
      doc.setTextColor(0);
      doc.setFont('helvetica', 'bold');
      doc.text(`Réf: ${req.numero} - ${new Date(req.created_at).toLocaleDateString()}`, 16, yPos + 7);
      
      yPos += 20;

      const details = [
        ['Initiateur:', (req as any).emetteur_nom || 'N/A'],
        ['Service:', (req as any).service_nom || 'N/A'],
        ['Objet:', req.objet],
        ['Montant:', formatCurrency(req.montant_usd || req.montant_cdf, req.montant_usd ? 'USD' : 'CDF')],
        ['Urgence:', req.urgence.toUpperCase()],
        ['Statut Actuel:', req.statut.toUpperCase()]
      ];

      autoTable(doc, {
        startY: yPos,
        head: [],
        body: details,
        theme: 'plain',
        styles: { fontSize: 10, cellPadding: 2 },
        columnStyles: { 0: { fontStyle: 'bold', cellWidth: 40 } },
        margin: { left: 14 }
      });

      const finalY = (doc as any).lastAutoTable.finalY || yPos + 40;
      yPos = finalY + 10;

      doc.setFont('helvetica', 'bold');
      doc.text('Description:', 14, yPos);
      yPos += 7;
      doc.setFont('helvetica', 'normal');
      const splitDescription = doc.splitTextToSize(req.commentaire_initial || 'Pas de description', 180);
      doc.text(splitDescription, 14, yPos);
    });

    doc.save(`requisitions_gm_batch_${new Date().toISOString().slice(0, 10)}.pdf`);
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

  const services = Array.from(new Set(allRequisitions.map(r => (r as any).service_nom).filter(Boolean)));

  const filteredRequisitions = allRequisitions.filter(req => {
    const matchesStatus = 
      filterStatus === 'all' ? true :
      filterStatus === 'pending' ? (req.niveau === 'gm' || req.niveau === 'paiement') :
      req.statut === filterStatus;
      
    const matchesService = filterService === 'all' || (req as any).service_nom === filterService;
    const matchesUrgence = filterUrgence === 'all' || req.urgence === filterUrgence;
    
    return matchesStatus && matchesService && matchesUrgence;
  });

  if (loading) {
    return (
      <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
        <Box sx={{ display: 'flex', justifyContent: 'center', mt: 8 }}>
          <CircularProgress />
        </Box>
      </Container>
    );
  }

  if (!profile) {
    return (
      <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
        <Alert severity="error">Impossible de charger le profil</Alert>
      </Container>
    );
  }

  return (
    <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 4 }}>
        <Box sx={{ display: 'flex', alignItems: 'center' }}>
          <Button onClick={() => navigate('/dashboard')} startIcon={<ArrowBack />} sx={{ mr: 2 }}>
            Tableau de bord
          </Button>
          <Typography variant="h4" fontWeight="bold">Mon Profil GM</Typography>
        </Box>
        <Box sx={{ display: 'flex', gap: 2 }}>
          <Button 
            variant="contained" 
            color="secondary" 
            startIcon={<PictureAsPdf />}
            onClick={handleExportPDF}
          >
            Exporter Batch PDF
          </Button>
          <Button variant="outlined" color="error" onClick={handleLogout} startIcon={<Logout />}>
            Déconnexion
          </Button>
        </Box>
      </Box>

      {showSuccess && (
        <Alert severity="success" sx={{ mb: 2 }}>
          Profil mis à jour avec succès!
        </Alert>
      )}

      <Box sx={{ display: 'flex', gap: 3, flexDirection: { xs: 'column', md: 'row' } }}>
        {/* Profile Card */}
        <Box sx={{ flex: { xs: 1, md: 0.4 } }}>
          <Card sx={{ boxShadow: 3 }}>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                <Avatar sx={{ width: 64, height: 64, mr: 2, bgcolor: 'purple' }}>
                  <AssignmentInd sx={{ fontSize: 32 }} />
                </Avatar>
                <Box>
                  <Typography variant="h6">{profile.nom_complet}</Typography>
                  <Typography variant="body2" color="text.secondary">
                    @{profile.username}
                  </Typography>
                  <Chip 
                    label="Directeur Général" 
                    size="small" 
                    sx={{ mt: 1, bgcolor: 'purple', color: 'white' }}
                  />
                </Box>
              </Box>

              <Divider sx={{ my: 2 }} />

              <List dense>
                <ListItem>
                  <ListItemIcon><Email color="action" /></ListItemIcon>
                  <ListItemText primary={profile.email} />
                </ListItem>
                <ListItem>
                  <ListItemIcon><Phone color="action" /></ListItemIcon>
                  <ListItemText primary={profile.telephone || 'Non renseigné'} />
                </ListItem>
                <ListItem>
                  <ListItemIcon><Business color="action" /></ListItemIcon>
                  <ListItemText primary={profile.service_nom} />
                </ListItem>
                <ListItem>
                  <ListItemIcon><Work color="action" /></ListItemIcon>
                  <ListItemText primary="Niveau: Validation Finale (GM)" />
                </ListItem>
              </List>

              <Box sx={{ mt: 2 }}>
                {!editMode ? (
                  <Button 
                    variant="contained" 
                    color="secondary"
                    startIcon={<Edit />}
                    onClick={handleEdit}
                    fullWidth
                  >
                    Modifier le profil
                  </Button>
                ) : (
                  <Box sx={{ display: 'flex', gap: 1 }}>
                    <Button 
                      variant="contained" 
                      color="primary"
                      startIcon={<Save />}
                      onClick={handleSave}
                      sx={{ flex: 1 }}
                    >
                      Enregistrer
                    </Button>
                    <Button 
                      variant="outlined" 
                      startIcon={<Cancel />}
                      onClick={handleCancel}
                      sx={{ flex: 1 }}
                    >
                      Annuler
                    </Button>
                  </Box>
                )}
              </Box>
            </CardContent>
          </Card>
        </Box>

        {/* Stats and Content */}
        <Box sx={{ flex: { xs: 1, md: 0.6 } }}>
          {/* Main Stats */}
          <Card sx={{ mb: 3, boxShadow: 3 }}>
            <CardContent>
              <Typography variant="h6" sx={{ mb: 2, display: 'flex', alignItems: 'center' }}>
                <AccountBalance sx={{ mr: 1 }} color="secondary" />
                Statistiques de Validation GM
              </Typography>
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2 }}>
                <Box sx={{ flex: { xs: 1, sm: 0.33 }, textAlign: 'center', p: 2, bgcolor: 'grey.50', borderRadius: 2 }}>
                  <Typography variant="h4" color="secondary.main">
                    {profile.total_requisitions_a_valider}
                  </Typography>
                  <Typography variant="body2">À valider</Typography>
                </Box>
                <Box sx={{ flex: { xs: 1, sm: 0.33 }, textAlign: 'center', p: 2, bgcolor: 'warning.50', borderRadius: 2 }}>
                  <Typography variant="h4" color="warning.main">
                    {profile.requisitions_en_attente_paiement}
                  </Typography>
                  <Typography variant="body2">En attente paiement</Typography>
                </Box>
                <Box sx={{ flex: { xs: 1, sm: 0.33 }, textAlign: 'center', p: 2, bgcolor: 'success.50', borderRadius: 2 }}>
                  <Typography variant="h4" color="success.main">
                    {profile.requisitions_payees}
                  </Typography>
                  <Typography variant="body2">Total payées</Typography>
                </Box>
              </Box>
            </CardContent>
          </Card>

          {/* Global View */}
          <Card sx={{ mb: 3, boxShadow: 3 }}>
            <CardContent>
              <Typography variant="h6" sx={{ mb: 2, display: 'flex', alignItems: 'center' }}>
                <PieChart sx={{ mr: 1 }} color="secondary" />
                Aperçu de la Trésorerie
              </Typography>
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2 }}>
                <Box sx={{ flex: 1, minWidth: 200, textAlign: 'center', p: 2, bgcolor: 'indigo.50', borderRadius: 2 }}>
                  <Typography variant="h5" color="indigo">
                    {profile.taux_paiement}%
                  </Typography>
                  <Typography variant="body2">Taux de paiement</Typography>
                </Box>
                <Box sx={{ flex: 1, minWidth: 200, textAlign: 'center', p: 2, bgcolor: 'success.50', borderRadius: 2 }}>
                  <Typography variant="h5" color="success.main">
                    ${profile.montant_total_paye.toLocaleString()}
                  </Typography>
                  <Typography variant="body2">Montant total décaissé</Typography>
                </Box>
              </Box>
            </CardContent>
          </Card>

          {/* Edit Form */}
          {editMode && (
            <Card sx={{ mb: 3, boxShadow: 3 }}>
              <CardContent>
                <Typography variant="h6" sx={{ mb: 2 }}>
                  <Settings sx={{ mr: 1, verticalAlign: 'middle' }} />
                  Modifier mes informations
                </Typography>
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  <TextField
                    fullWidth
                    label="Nom complet"
                    value={formData.nom_complet || ''}
                    onChange={(e) => setFormData({ ...formData, nom_complet: e.target.value })}
                  />
                  <TextField
                    fullWidth
                    label="Téléphone"
                    value={formData.telephone || ''}
                    onChange={(e) => setFormData({ ...formData, telephone: e.target.value })}
                  />
                </Box>
              </CardContent>
            </Card>
          )}

          {/* Requisitions List */}
          <Card sx={{ boxShadow: 3 }}>
            <CardContent>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                <Typography variant="h6">
                  <FilterList sx={{ mr: 1, verticalAlign: 'middle' }} color="secondary" />
                  Liste des Réquisitions
                </Typography>
                <Button 
                  variant="outlined" 
                  color="secondary"
                  size="small"
                  onClick={() => navigate('/requisitions')}
                >
                  Voir tout
                </Button>
              </Box>
              
              {/* Filters */}
              <Paper sx={{ p: 2, mb: 2, bgcolor: 'grey.50' }}>
                <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', alignItems: 'center' }}>
                  <FormControl size="small" sx={{ minWidth: 150 }}>
                    <InputLabel>Vue</InputLabel>
                    <Select
                      value={filterStatus}
                      label="Vue"
                      onChange={(e) => setFilterStatus(e.target.value)}
                    >
                      <MenuItem value="pending">À valider / En cours</MenuItem>
                      <MenuItem value="all">Tout l'historique</MenuItem>
                      <MenuItem value="validee">Validées</MenuItem>
                      <MenuItem value="payee">Payées</MenuItem>
                      <MenuItem value="refusee">Refusées</MenuItem>
                    </Select>
                  </FormControl>
                  <FormControl size="small" sx={{ minWidth: 150 }}>
                    <InputLabel>Service</InputLabel>
                    <Select
                      value={filterService}
                      label="Service"
                      onChange={(e) => setFilterService(e.target.value)}
                    >
                      <MenuItem value="all">Tous les services</MenuItem>
                      {services.map((s: any) => (
                        <MenuItem key={s} value={s}>{s}</MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                  <FormControl size="small" sx={{ minWidth: 150 }}>
                    <InputLabel>Urgence</InputLabel>
                    <Select
                      value={filterUrgence}
                      label="Urgence"
                      onChange={(e) => setFilterUrgence(e.target.value)}
                    >
                      <MenuItem value="all">Toutes</MenuItem>
                      <MenuItem value="basse">Basse</MenuItem>
                      <MenuItem value="normale">Normale</MenuItem>
                      <MenuItem value="haute">Haute</MenuItem>
                      <MenuItem value="critique">Critique</MenuItem>
                    </Select>
                  </FormControl>
                </Box>
              </Paper>
              
              {filteredRequisitions.length > 0 ? (
                <List>
                  {filteredRequisitions.slice(0, 10).map((requisition) => (
                    <ListItem key={requisition.id} divider>
                      <ListItemIcon>
                        <Description color="secondary" />
                      </ListItemIcon>
                      <ListItemText
                        primary={
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <Typography variant="subtitle2" fontWeight="bold">
                              {requisition.numero || requisition.reference}
                            </Typography>
                            <Typography variant="body2" noWrap sx={{ maxWidth: 200 }}>
                              {requisition.objet}
                            </Typography>
                          </Box>
                        }
                        secondary={
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 0.5, flexWrap: 'wrap' }}>
                            <Chip
                              label={getStatutLabel(requisition.statut)}
                              size="small"
                              sx={{ backgroundColor: getStatutColor(requisition.statut), color: 'white', height: 20, fontSize: '0.7rem' }}
                            />
                            <Chip
                              label={getUrgenceLabel(requisition.urgence)}
                              size="small"
                              sx={{ backgroundColor: getUrgenceColor(requisition.urgence), color: 'white', height: 20, fontSize: '0.7rem' }}
                            />
                            <Typography variant="caption" color="text.secondary">
                              {requisition.devise} {(requisition.montant_usd || requisition.montant_cdf || 0).toLocaleString()}
                            </Typography>
                            <Typography variant="caption" color="text.secondary">
                              {new Date(requisition.created_at).toLocaleDateString()}
                            </Typography>
                          </Box>
                        }
                      />
                      <IconButton 
                        onClick={() => navigate(`/requisitions/${requisition.id}`)}
                        color="secondary"
                      >
                        <Visibility />
                      </IconButton>
                    </ListItem>
                  ))}
                </List>
              ) : (
                <Box sx={{ textAlign: 'center', py: 4 }}>
                  <CheckCircle sx={{ fontSize: 48, color: 'success.light', mb: 1 }} />
                  <Typography variant="body2" color="text.secondary">
                    Aucune réquisition trouvée pour ces filtres.
                  </Typography>
                </Box>
              )}
            </CardContent>
          </Card>
        </Box>
      </Box>
    </Container>
  );
};

export default GMProfile;
