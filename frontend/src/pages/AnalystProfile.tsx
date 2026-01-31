import React, { useState, useEffect } from 'react';
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
  IconButton,
  LinearProgress,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
} from '@mui/material';
import {
  Person,
  Email,
  Phone,
  Business,
  Edit,
  Save,
  Cancel,
  ArrowBack,
  Work,
  Assignment,
  Timeline,
  Description,
  MonetizationOn,
  TrendingUp,
  CheckCircle,
  Schedule,
  PriorityHigh,
  Logout,
  Settings,
  Visibility,
  Assessment,
  AccountBalance,
  PieChart,
  BarChart,
  FilterList,
  Search,
  AttachFile,
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { API_BASE_URL } from '../config';
import { useAuth } from '../context/AuthContext';
import RequisitionService, { Requisition } from '../services/RequisitionService';

interface AnalystProfile {
  id: number;
  username: string;
  email: string;
  nom: string;
  prenom: string;
  telephone?: string;
  role: string;
  service_nom: string;
  service_id: number;
  niveau: string;
  created_at: string;
  last_login?: string;
  total_requisitions_analysees: number;
  requisitions_en_attente: number;
  requisitions_approuvees: number;
  requisitions_rejetees: number;
  montant_total_analyse: number;
  moyenne_montant: number;
  taux_validation: number;
}

const AnalystProfile: React.FC = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  
  const [profile, setProfile] = useState<AnalystProfile | null>(null);
  const [recentRequisitions, setRecentRequisitions] = useState<Requisition[]>([]);
  const [loading, setLoading] = useState(true);
  const [editMode, setEditMode] = useState(false);
  const [formData, setFormData] = useState<Partial<AnalystProfile>>({});
  const [showSuccess, setShowSuccess] = useState(false);
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterUrgence, setFilterUrgence] = useState<string>('all');

  useEffect(() => {
    loadProfileData();
  }, []);

  const loadProfileData = async () => {
    try {
      setLoading(true);
      
      // Récupérer le token depuis localStorage
      const token = localStorage.getItem('token');
      if (!token) {
        console.error('Token non trouvé');
        setLoading(false);
        return;
      }

      // Récupérer les réquisitions depuis l'API du backend
      const response = await fetch(`${API_BASE_URL}/api/requisitions`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const allRequisitions = await response.json();
        console.log('Réquisitions récupérées depuis le backend (analyste):', allRequisitions);
        
        // Filtrer les réquisitions qui nécessitent une analyse
        const requisitionsToAnalyse = allRequisitions.filter((req: any) => 
          req.niveau === 'emetteur' || // nouvelles réquisitions créées par les émetteurs
          req.niveau === 'analyste' || 
          req.niveau === 'challenger' ||
          req.statut === 'refusee' // Pour réanalyse
        );
        
        console.log('Réquisitions à analyser:', requisitionsToAnalyse);
        
        // Calculer les statistiques de l'analyste
        const analystStats = {
          total_requisitions_analysees: requisitionsToAnalyse.length,
          requisitions_en_attente: requisitionsToAnalyse.filter((r: any) => r.statut === 'soumise').length,
          requisitions_approuvees: allRequisitions.filter((r: any) => r.statut === 'validee').length,
          requisitions_rejetees: requisitionsToAnalyse.filter((r: any) => r.statut === 'refusee').length,
          montant_total_analyse: requisitionsToAnalyse.reduce((sum: number, r: any) => sum + (r.montant_usd || r.montant_cdf || 0), 0),
          moyenne_montant: requisitionsToAnalyse.length > 0 ? requisitionsToAnalyse.reduce((sum: number, r: any) => sum + (r.montant_usd || r.montant_cdf || 0), 0) / requisitionsToAnalyse.length : 0,
          taux_validation: allRequisitions.length > 0 ? Math.round((allRequisitions.filter((r: any) => r.statut === 'validee').length / allRequisitions.length) * 100) : 0,
        };

        // Créer le profil analyste
        const userProfile: AnalystProfile = {
          id: user?.id || 3,
          username: user?.username || 'analyste',
          email: user?.email || 'analyste@entreprise.com',
          nom: 'Comptable',
          prenom: 'Analyste',
          telephone: '+243 123 456 789',
          role: user?.role || 'analyste',
          service_nom: allRequisitions.length > 0 ? allRequisitions[0].service_nom : 'Finance',
          service_id: allRequisitions.length > 0 ? allRequisitions[0].service_id : 2,
          niveau: 'N2',
          created_at: new Date().toISOString(),
          last_login: new Date().toISOString(),
          ...analystStats,
        };

        setProfile(userProfile);
        setRecentRequisitions(requisitionsToAnalyse.slice(0, 5)); // 5 réquisitions les plus récentes
        setLoading(false);
      } else {
        console.error('Erreur lors de la récupération des réquisitions:', response.status);
        setLoading(false);
      }
    } catch (error) {
      console.error('Erreur lors du chargement des données:', error);
      setLoading(false);
    }
  };

  const handleEdit = () => {
    setEditMode(true);
    setFormData({
      nom: profile?.nom,
      prenom: profile?.prenom,
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

  const formatDate = (dateString: string) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
      {/* En-tête avec bouton retour */}
      <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
        <IconButton onClick={() => navigate(-1)} sx={{ mr: 2 }}>
          <ArrowBack />
        </IconButton>
        <Typography variant="h4" component="h1" sx={{ flexGrow: 1, fontWeight: 'bold', color: '#1a237e' }}>
          Profil Analyste
        </Typography>
        <Button 
          variant="outlined" 
          color="error" 
          startIcon={<Logout />}
          onClick={handleLogout}
        >
          Déconnexion
        </Button>
      </Box>

      {showSuccess && (
        <Alert severity="success" sx={{ mb: 3 }}>
          Profil mis à jour avec succès !
        </Alert>
      )}

      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 2fr' }, gap: 3 }}>
        {/* Colonne de gauche : Informations personnelles */}
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
          {/* Carte Profil */}
          <Card elevation={3} sx={{ borderRadius: 2 }}>
            <CardContent sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', p: 3 }}>
              <Avatar 
                sx={{ 
                  width: 120, 
                  height: 120, 
                  bgcolor: '#1a237e', 
                  mb: 2,
                  fontSize: '3rem'
                }}
              >
                {profile?.prenom?.charAt(0)}{profile?.nom?.charAt(0)}
              </Avatar>
              
              {editMode ? (
                <Box sx={{ width: '100%', mt: 2 }}>
                  <TextField
                    fullWidth
                    label="Prénom"
                    value={formData.prenom || ''}
                    onChange={(e) => setFormData({...formData, prenom: e.target.value})}
                    sx={{ mb: 2 }}
                    size="small"
                  />
                  <TextField
                    fullWidth
                    label="Nom"
                    value={formData.nom || ''}
                    onChange={(e) => setFormData({...formData, nom: e.target.value})}
                    sx={{ mb: 2 }}
                    size="small"
                  />
                  <TextField
                    fullWidth
                    label="Téléphone"
                    value={formData.telephone || ''}
                    onChange={(e) => setFormData({...formData, telephone: e.target.value})}
                    sx={{ mb: 2 }}
                    size="small"
                  />
                  <Box sx={{ display: 'flex', gap: 1, justifyContent: 'center', mt: 1 }}>
                    <Button 
                      variant="contained" 
                      color="primary" 
                      startIcon={<Save />}
                      onClick={handleSave}
                      size="small"
                    >
                      Enregistrer
                    </Button>
                    <Button 
                      variant="outlined" 
                      color="secondary" 
                      startIcon={<Cancel />}
                      onClick={handleCancel}
                      size="small"
                    >
                      Annuler
                    </Button>
                  </Box>
                </Box>
              ) : (
                <>
                  <Typography variant="h5" sx={{ fontWeight: 'bold', mb: 0.5 }}>
                    {profile?.prenom} {profile?.nom}
                  </Typography>
                  <Chip 
                    label="Analyste Financier" 
                    color="primary" 
                    size="small" 
                    sx={{ mb: 2 }} 
                  />
                  
                  <List dense sx={{ width: '100%' }}>
                    <ListItem>
                      <ListItemIcon><Email color="action" /></ListItemIcon>
                      <ListItemText primary={profile?.email} secondary="Email professionnel" />
                    </ListItem>
                    <ListItem>
                      <ListItemIcon><Phone color="action" /></ListItemIcon>
                      <ListItemText primary={profile?.telephone || 'Non renseigné'} secondary="Téléphone" />
                    </ListItem>
                    <ListItem>
                      <ListItemIcon><Business color="action" /></ListItemIcon>
                      <ListItemText primary={profile?.service_nom} secondary="Service" />
                    </ListItem>
                    <ListItem>
                      <ListItemIcon><Work color="action" /></ListItemIcon>
                      <ListItemText primary={profile?.role} secondary="Rôle" />
                    </ListItem>
                  </List>

                  <Button 
                    variant="outlined" 
                    startIcon={<Edit />} 
                    fullWidth 
                    sx={{ mt: 2 }}
                    onClick={handleEdit}
                  >
                    Modifier le profil
                  </Button>
                </>
              )}
            </CardContent>
          </Card>

          {/* Statistiques Rapides */}
          <Card elevation={3} sx={{ borderRadius: 2 }}>
            <CardContent>
              <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center' }}>
                <Assessment sx={{ mr: 1 }} /> Performance
              </Typography>
              <Divider sx={{ mb: 2 }} />
              
              <Box sx={{ mb: 3 }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                  <Typography variant="body2" color="text.secondary">Taux de validation</Typography>
                  <Typography variant="body2" fontWeight="bold">{profile?.taux_validation}%</Typography>
                </Box>
                <LinearProgress 
                  variant="determinate" 
                  value={profile?.taux_validation || 0} 
                  color="success" 
                  sx={{ height: 8, borderRadius: 5 }}
                />
              </Box>

              <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2 }}>
                <Box sx={{ textAlign: 'center', p: 1, bgcolor: '#f5f5f5', borderRadius: 1 }}>
                  <Typography variant="h4" color="primary.main" fontWeight="bold">
                    {profile?.total_requisitions_analysees}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    Total Analysé
                  </Typography>
                </Box>
                <Box sx={{ textAlign: 'center', p: 1, bgcolor: '#f5f5f5', borderRadius: 1 }}>
                  <Typography variant="h4" color="warning.main" fontWeight="bold">
                    {profile?.requisitions_en_attente}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    En Attente
                  </Typography>
                </Box>
                <Box sx={{ textAlign: 'center', p: 1, bgcolor: '#f5f5f5', borderRadius: 1 }}>
                  <Typography variant="h4" color="success.main" fontWeight="bold">
                    {profile?.requisitions_approuvees}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    Approuvées
                  </Typography>
                </Box>
                <Box sx={{ textAlign: 'center', p: 1, bgcolor: '#f5f5f5', borderRadius: 1 }}>
                  <Typography variant="h4" color="error.main" fontWeight="bold">
                    {profile?.requisitions_rejetees}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    Rejetées
                  </Typography>
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Box>

        {/* Colonne de droite : Tableau de bord et Activité */}
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
          {/* Métriques Financières */}
          <Card elevation={3} sx={{ borderRadius: 2 }}>
            <CardContent>
              <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center' }}>
                <AccountBalance sx={{ mr: 1 }} /> Métriques Financières
              </Typography>
              <Divider sx={{ mb: 2 }} />
              
              <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 3 }}>
                <Paper elevation={0} sx={{ p: 2, bgcolor: '#e3f2fd', borderRadius: 2, display: 'flex', alignItems: 'center' }}>
                  <Avatar sx={{ bgcolor: 'primary.main', mr: 2 }}>
                    <MonetizationOn />
                  </Avatar>
                  <Box>
                    <Typography variant="body2" color="text.secondary">Montant Total Analysé</Typography>
                    <Typography variant="h6" fontWeight="bold">
                      {profile?.montant_total_analyse.toLocaleString()} $
                    </Typography>
                  </Box>
                </Paper>
                
                <Paper elevation={0} sx={{ p: 2, bgcolor: '#e8f5e9', borderRadius: 2, display: 'flex', alignItems: 'center' }}>
                  <Avatar sx={{ bgcolor: 'success.main', mr: 2 }}>
                    <TrendingUp />
                  </Avatar>
                  <Box>
                    <Typography variant="body2" color="text.secondary">Moyenne par Réquisition</Typography>
                    <Typography variant="h6" fontWeight="bold">
                      {profile?.moyenne_montant.toLocaleString()} $
                    </Typography>
                  </Box>
                </Paper>
              </Box>
            </CardContent>
          </Card>

          {/* Filtres et Recherche */}
          <Paper elevation={1} sx={{ p: 2, display: 'flex', gap: 2, alignItems: 'center', flexWrap: 'wrap' }}>
            <FilterList color="action" />
            <FormControl size="small" sx={{ minWidth: 120 }}>
              <InputLabel>Statut</InputLabel>
              <Select
                value={filterStatus}
                label="Statut"
                onChange={(e) => setFilterStatus(e.target.value)}
              >
                <MenuItem value="all">Tous</MenuItem>
                <MenuItem value="soumise">Soumise</MenuItem>
                <MenuItem value="validee">Validée</MenuItem>
                <MenuItem value="refusee">Refusée</MenuItem>
              </Select>
            </FormControl>
            
            <FormControl size="small" sx={{ minWidth: 120 }}>
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
            
            <Box sx={{ flexGrow: 1 }} />
            
            <TextField
              placeholder="Rechercher..."
              size="small"
              InputProps={{
                startAdornment: <Search color="action" sx={{ mr: 1 }} />,
              }}
            />
          </Paper>

          {/* Liste des Réquisitions à Analyser */}
          <Card elevation={3} sx={{ borderRadius: 2 }}>
            <CardContent>
              <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <Box sx={{ display: 'flex', alignItems: 'center' }}>
                  <Assignment sx={{ mr: 1 }} /> Réquisitions Récentes à Analyser
                </Box>
                <Button size="small" endIcon={<ArrowBack sx={{ transform: 'rotate(180deg)' }} />}>
                  Voir tout
                </Button>
              </Typography>
              <Divider sx={{ mb: 2 }} />
              
              {recentRequisitions.length > 0 ? (
                <List>
                  {recentRequisitions.map((req) => (
                    <Paper key={req.id} variant="outlined" sx={{ mb: 2, borderRadius: 2, overflow: 'hidden' }}>
                      <ListItem 
                        alignItems="flex-start"
                        secondaryAction={
                          <IconButton edge="end" aria-label="voir" onClick={() => navigate(`/requisitions/${req.id}`)}>
                            <Visibility />
                          </IconButton>
                        }
                      >
                        <ListItemText
                          primary={
                            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 0.5 }}>
                              <Typography variant="subtitle1" fontWeight="bold">
                                {req.objet || `Réquisition #${req.id}`}
                              </Typography>
                              <Chip 
                                label={getStatutLabel(req.statut)} 
                                size="small" 
                                sx={{ 
                                  bgcolor: getStatutColor(req.statut) + '20', 
                                  color: getStatutColor(req.statut),
                                  fontWeight: 'bold',
                                  border: `1px solid ${getStatutColor(req.statut)}`
                                }} 
                              />
                            </Box>
                          }
                          secondary={
                            <Box>
                              <Box sx={{ display: 'flex', gap: 2, mb: 1, mt: 0.5 }}>
                                <Typography variant="caption" sx={{ display: 'flex', alignItems: 'center' }}>
                                  <Schedule fontSize="inherit" sx={{ mr: 0.5 }} />
                                  {formatDate(req.created_at)}
                                </Typography>
                                <Typography variant="caption" sx={{ display: 'flex', alignItems: 'center' }}>
                                  <Person fontSize="inherit" sx={{ mr: 0.5 }} />
                                  {req.emetteur_nom || 'Utilisateur'}
                                </Typography>
                                <Typography variant="caption" sx={{ display: 'flex', alignItems: 'center', color: getUrgenceColor(req.urgence), fontWeight: 'bold' }}>
                                  <PriorityHigh fontSize="inherit" sx={{ mr: 0.5 }} />
                                  {getUrgenceLabel(req.urgence)}
                                </Typography>
                              </Box>
                              <Typography variant="body2" color="text.primary" sx={{ fontWeight: 'bold' }}>
                                {(req.montant_estime || 0).toLocaleString()} {req.devise}
                              </Typography>
                            </Box>
                          }
                        />
                      </ListItem>
                    </Paper>
                  ))}
                </List>
              ) : (
                <Box sx={{ textAlign: 'center', py: 4 }}>
                  <Typography variant="body1" color="text.secondary">
                    Aucune réquisition à analyser pour le moment.
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

export default AnalystProfile;
