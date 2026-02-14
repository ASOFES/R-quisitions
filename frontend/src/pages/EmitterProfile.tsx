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
  TrendingUp,
  AccountBalance,
  PieChart,
  FilterList,
  AttachFile,
  Person,
  AddCircleOutline,
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { API_BASE_URL } from '../config';
import { useAuth } from '../context/AuthContext';
import { Requisition } from '../services/RequisitionService';

interface EmitterProfileData {
  id: number;
  username: string;
  email: string;
  nom_complet: string;
  telephone?: string;
  role: string;
  service_nom: string;
  service_id: number;
  created_at: string;
  total_requisitions: number;
  requisitions_en_cours: number;
  requisitions_validees: number;
  requisitions_refusees: number;
  montant_total: number;
  moyenne_montant: number;
}

const EmitterProfile: React.FC = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  
  const [profile, setProfile] = useState<EmitterProfileData | null>(null);
  const [allUserRequisitions, setAllUserRequisitions] = useState<Requisition[]>([]);
  const [loading, setLoading] = useState(true);
  const [editMode, setEditMode] = useState(false);
  const [formData, setFormData] = useState<Partial<EmitterProfileData>>({});
  const [showSuccess, setShowSuccess] = useState(false);
  const [filterStatus, setFilterStatus] = useState<string>('all');
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
      let userProfile: EmitterProfileData = {
        id: user?.id || 0,
        username: user?.username || 'emetteur',
        email: user?.email || '',
        nom_complet: user?.nom_complet || 'Utilisateur Initiateur',
        telephone: '',
        role: user?.role || 'emetteur',
        service_nom: user?.service_nom || 'Service',
        service_id: user?.service_id || 0,
        created_at: new Date().toISOString(),
        total_requisitions: 0,
        requisitions_en_cours: 0,
        requisitions_validees: 0,
        requisitions_refusees: 0,
        montant_total: 0,
        moyenne_montant: 0,
      };

      try {
        const response = await fetch(`${API_BASE_URL}/api/requisitions`, {
          headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' }
        });
        
        if (response.ok) {
          const data = await response.json();
          // Filter own requisitions OR those where user is chef de service (for validation)
          const myRequisitions = data.filter((req: any) => 
            req.emetteur_id === user?.id || 
            (req.niveau === 'approbation_service' && req.service_chef_id === user?.id)
          );
          
          setAllUserRequisitions(myRequisitions);

          const stats = {
            total_requisitions: myRequisitions.length,
            requisitions_en_cours: myRequisitions.filter((r: any) => 
              r.statut === 'en_cours' || 
              r.statut === 'soumise' || 
              (r.niveau === 'approbation_service' && r.service_chef_id === user?.id)
            ).length,
            requisitions_validees: myRequisitions.filter((r: any) => ['validee', 'payee', 'termine'].includes(r.statut)).length,
            requisitions_refusees: myRequisitions.filter((r: any) => r.statut === 'refusee').length,
            montant_total: myRequisitions.reduce((sum: number, r: any) => {
              const val = parseFloat(String(r.montant_usd || r.montant_cdf || 0));
              return sum + (isNaN(val) ? 0 : val);
            }, 0),
            moyenne_montant: myRequisitions.length > 0 ? myRequisitions.reduce((sum: number, r: any) => {
              const val = parseFloat(String(r.montant_usd || r.montant_cdf || 0));
              return sum + (isNaN(val) ? 0 : val);
            }, 0) / myRequisitions.length : 0,
          };

          userProfile = {
            ...userProfile,
            ...stats,
            service_nom: myRequisitions.length > 0 ? myRequisitions[0].service_nom : userProfile.service_nom,
            service_id: myRequisitions.length > 0 ? myRequisitions[0].service_id : userProfile.service_id,
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

  const filteredRequisitions = allUserRequisitions.filter(req => {
    const statusMatch = filterStatus === 'all' || req.statut === filterStatus;
    const urgenceMatch = filterUrgence === 'all' || req.urgence === filterUrgence;
    return statusMatch && urgenceMatch;
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
          <Typography variant="h4" fontWeight="bold">Mon Profil Initiateur</Typography>
        </Box>
        <Box sx={{ display: 'flex', gap: 2 }}>
          <Button 
            variant="contained" 
            color="primary" 
            startIcon={<AddCircleOutline />}
            onClick={() => navigate('/requisitions/new')}
          >
            Nouvelle Réquisition
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
                <Avatar sx={{ width: 64, height: 64, mr: 2, bgcolor: 'primary.main' }}>
                  <Person sx={{ fontSize: 32 }} />
                </Avatar>
                <Box>
                  <Typography variant="h6">{profile.nom_complet}</Typography>
                  <Typography variant="body2" color="text.secondary">
                    @{profile.username}
                  </Typography>
                  <Chip 
                    label="Initiateur" 
                    size="small" 
                    color="primary" 
                    sx={{ mt: 1 }}
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
                  <ListItemText primary="Niveau: Émetteur (L1)" />
                </ListItem>
              </List>

              <Box sx={{ mt: 2 }}>
                {!editMode ? (
                  <Button 
                    variant="contained" 
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
                <TrendingUp sx={{ mr: 1 }} color="primary" />
                Mes Statistiques
              </Typography>
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2 }}>
                <Box sx={{ flex: { xs: 1, sm: 0.25 }, textAlign: 'center', p: 2, bgcolor: 'grey.50', borderRadius: 2 }}>
                  <Typography variant="h4" color="primary.main">
                    {profile.total_requisitions}
                  </Typography>
                  <Typography variant="body2">Total</Typography>
                </Box>
                <Box sx={{ flex: { xs: 1, sm: 0.25 }, textAlign: 'center', p: 2, bgcolor: 'warning.50', borderRadius: 2 }}>
                  <Typography variant="h4" color="warning.main">
                    {profile.requisitions_en_cours}
                  </Typography>
                  <Typography variant="body2">En cours</Typography>
                </Box>
                <Box sx={{ flex: { xs: 1, sm: 0.25 }, textAlign: 'center', p: 2, bgcolor: 'success.50', borderRadius: 2 }}>
                  <Typography variant="h4" color="success.main">
                    {profile.requisitions_validees}
                  </Typography>
                  <Typography variant="body2">Validées</Typography>
                </Box>
                <Box sx={{ flex: { xs: 1, sm: 0.25 }, textAlign: 'center', p: 2, bgcolor: 'error.50', borderRadius: 2 }}>
                  <Typography variant="h4" color="error.main">
                    {profile.requisitions_refusees}
                  </Typography>
                  <Typography variant="body2">Refusées</Typography>
                </Box>
              </Box>
            </CardContent>
          </Card>

          {/* Global View */}
          <Card sx={{ mb: 3, boxShadow: 3 }}>
            <CardContent>
              <Typography variant="h6" sx={{ mb: 2, display: 'flex', alignItems: 'center' }}>
                <PieChart sx={{ mr: 1 }} color="primary" />
                Aperçu Financier
              </Typography>
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2 }}>
                <Box sx={{ flex: 1, minWidth: 200, textAlign: 'center', p: 2, bgcolor: 'blue.50', borderRadius: 2 }}>
                  <Typography variant="h5" color="primary.main">
                    ${profile.montant_total.toLocaleString()}
                  </Typography>
                  <Typography variant="body2">Montant total engagé</Typography>
                </Box>
                <Box sx={{ flex: 1, minWidth: 200, textAlign: 'center', p: 2, bgcolor: 'purple.50', borderRadius: 2 }}>
                  <Typography variant="h5" color="purple.main">
                    ${Math.round(profile.moyenne_montant).toLocaleString()}
                  </Typography>
                  <Typography variant="body2">Montant moyen</Typography>
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

          {/* Recent Requisitions */}
          <Card sx={{ boxShadow: 3 }}>
            <CardContent>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                <Typography variant="h6">
                  <Description sx={{ mr: 1, verticalAlign: 'middle' }} color="primary" />
                  Mes Réquisitions Récentes
                </Typography>
                <Button 
                  variant="outlined" 
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
                    <InputLabel>Statut</InputLabel>
                    <Select
                      value={filterStatus}
                      label="Statut"
                      onChange={(e) => setFilterStatus(e.target.value)}
                    >
                      <MenuItem value="all">Tous</MenuItem>
                      <MenuItem value="brouillon">Brouillon</MenuItem>
                      <MenuItem value="soumise">Soumise</MenuItem>
                      <MenuItem value="en_cours">En cours</MenuItem>
                      <MenuItem value="validee">Validée</MenuItem>
                      <MenuItem value="refusee">Refusée</MenuItem>
                      <MenuItem value="payee">Payée</MenuItem>
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
                        <Description color="primary" />
                      </ListItemIcon>
                      <ListItemText
                        primary={
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <Typography variant="subtitle2" fontWeight="bold">
                              {requisition.reference}
                            </Typography>
                            <Typography variant="body2" noWrap sx={{ maxWidth: 250 }}>
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
                        color="primary"
                      >
                        <Visibility />
                      </IconButton>
                    </ListItem>
                  ))}
                </List>
              ) : (
                <Box sx={{ textAlign: 'center', py: 4 }}>
                  <Typography variant="body2" color="text.secondary">
                    Aucune réquisition trouvée.
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

export default EmitterProfile;
