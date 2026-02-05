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
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Divider,
  Chip,
  Alert,
  CircularProgress,
  IconButton,
  Grid,
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
  Description,
  TrendingUp,
  Logout,
  Settings,
  AttachFile,
  Visibility,
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import RequisitionService, { Requisition } from '../services/RequisitionService';
import { API_BASE_URL } from '../config';

interface EmitterProfileData {
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
  const [recentRequisitions, setRecentRequisitions] = useState<Requisition[]>([]);
  const [loading, setLoading] = useState(true);
  const [editMode, setEditMode] = useState(false);
  const [formData, setFormData] = useState<Partial<EmitterProfileData>>({});
  const [showSuccess, setShowSuccess] = useState(false);
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterService, setFilterService] = useState('all');
  const [filterUrgence, setFilterUrgence] = useState('all');

  const [allUserRequisitions, setAllUserRequisitions] = useState<Requisition[]>([]);

  const loadProfileData = useCallback(async () => {
    try {
      setLoading(true);
      
      // Récupérer le token depuis localStorage
      const token = localStorage.getItem('token');
      if (!token) {
        console.error('Token non trouvé');
        setLoading(false);
        return;
      }

      // Récupérer les réquisitions de l'utilisateur depuis l'API du backend
      const response = await fetch(`${API_BASE_URL}/api/requisitions`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const data = await response.json();
        console.log('Réquisitions récupérées depuis le backend:', data);
        
        // Filtrer uniquement les réquisitions de l'utilisateur connecté
        const userRequisitions = data.filter((req: any) => req.emetteur_id === user?.id);
        
        // Transformer les données pour le format attendu par le composant
        const formattedRequisitions = userRequisitions.map((req: any) => ({
          id: req.id,
          reference: req.numero,
          objet: req.objet,
          montant: req.montant_usd || req.montant_cdf || 0,
          devise: req.montant_usd ? 'USD' : 'CDF',
          urgence: 'normale',
          statut: req.statut,
          created_at: req.created_at,
          niveau: req.niveau,
          actions: req.actions || [],
          emetteur_nom: req.emetteur_nom,
          service_nom: req.service_nom,
          nb_pieces: req.nb_pieces || 0
        }));

        setAllUserRequisitions(formattedRequisitions);
        
        // Calculer les statistiques
        const userStats = {
          total_requisitions: userRequisitions.length,
          requisitions_en_cours: userRequisitions.filter((r: any) => r.statut === 'en_cours').length,
          requisitions_validees: userRequisitions.filter((r: any) => r.statut === 'validee').length,
          requisitions_refusees: userRequisitions.filter((r: any) => r.statut === 'refusee').length,
          montant_total: userRequisitions.reduce((sum: number, r: any) => sum + (r.montant_usd || r.montant_cdf || 0), 0),
          moyenne_montant: userRequisitions.length > 0 ? userRequisitions.reduce((sum: number, r: any) => sum + (r.montant_usd || r.montant_cdf || 0), 0) / userRequisitions.length : 0,
        };

        // Créer le profil utilisateur
        const userProfile: EmitterProfileData = {
          id: user?.id || 1,
          username: user?.username || 'emetteur',
          email: user?.email || 'emetteur@company.com',
          nom: user?.nom_complet?.split(' ')[1] || 'Dupont',
          prenom: user?.nom_complet?.split(' ')[0] || 'Jean',
          telephone: '+243 123 456 789',
          role: user?.role || 'emetteur',
          service_nom: userRequisitions.length > 0 ? userRequisitions[0].service_nom : 'Informatique',
          service_id: userRequisitions.length > 0 ? userRequisitions[0].service_id : 1,
          niveau: 'N1',
          created_at: new Date().toISOString(),
          last_login: new Date().toISOString(),
          ...userStats,
        };

        setProfile(userProfile);
        setRecentRequisitions(formattedRequisitions.slice(0, 5));
      } else {
        // Fallback logic
        console.error('Erreur lors de la récupération des réquisitions:', response.status);
        const requisitionService = RequisitionService.getInstance();
        const allRequisitions = requisitionService.getAllRequisitions();
        const userRequisitions = allRequisitions.filter(req => req.emetteur_id === user?.id);
        
        setAllUserRequisitions(userRequisitions);
        
        const userStats = {
          total_requisitions: userRequisitions.length,
          requisitions_en_cours: userRequisitions.filter(r => r.statut === 'en_cours').length,
          requisitions_validees: userRequisitions.filter(r => r.statut === 'validee').length,
          requisitions_refusees: userRequisitions.filter(r => r.statut === 'refusee').length,
          montant_total: userRequisitions.reduce((sum, r) => sum + r.montant, 0),
          moyenne_montant: userRequisitions.length > 0 ? userRequisitions.reduce((sum, r) => sum + r.montant, 0) / userRequisitions.length : 0,
        };

        const userProfile: EmitterProfileData = {
          id: user?.id || 1,
          username: user?.username || 'emetteur',
          email: user?.email || 'emetteur@company.com',
          nom: 'Dupont',
          prenom: 'Jean',
          telephone: '+243 123 456 789',
          role: user?.role || 'emetteur',
          service_nom: userRequisitions.length > 0 ? userRequisitions[0].service_nom : 'Informatique',
          service_id: userRequisitions.length > 0 ? userRequisitions[0].service_id : 1,
          niveau: 'N1',
          created_at: new Date().toISOString(),
          last_login: new Date().toISOString(),
          ...userStats,
        };

        setProfile(userProfile);
        setRecentRequisitions(userRequisitions.slice(0, 5));
      }
      
      setLoading(false);
    } catch (error) {
      console.error('Erreur lors du chargement des données:', error);
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    loadProfileData();
  }, [loadProfileData]);

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

  // Extract unique values for filters
  const services = Array.from(new Set(allUserRequisitions.map(r => (r as any).service_nom).filter(Boolean)));
  const urgences = Array.from(new Set(allUserRequisitions.map(r => r.urgence).filter(Boolean)));

  const filteredRequisitions = allUserRequisitions.filter(req => {
    const matchesStatus = filterStatus === 'all' || req.statut === filterStatus;
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
      {/* En-tête */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 4 }}>
        <Box sx={{ display: 'flex', alignItems: 'center' }}>
          <Button onClick={() => navigate('/dashboard')} startIcon={<ArrowBack />} sx={{ mr: 2 }}>
            Retour
          </Button>
          <Typography variant="h4">Mon Profil Initiateur</Typography>
        </Box>
        <Button variant="outlined" color="error" onClick={handleLogout} startIcon={<Logout />}>
          Déconnexion
        </Button>
      </Box>

      {showSuccess && (
        <Alert severity="success" sx={{ mb: 2 }}>
          Profil mis à jour avec succès!
        </Alert>
      )}

      <Box sx={{ display: 'flex', gap: 3, flexDirection: { xs: 'column', md: 'row' } }}>
        {/* Informations personnelles */}
        <Box sx={{ flex: { xs: 1, md: 0.4 } }}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                <Avatar sx={{ width: 64, height: 64, mr: 2, bgcolor: 'primary.main' }}>
                  <Person sx={{ fontSize: 32 }} />
                </Avatar>
                <Box>
                  <Typography variant="h6">{profile.prenom} {profile.nom}</Typography>
                  <Typography variant="body2" color="text.secondary">
                    @{profile.username}
                  </Typography>
                  <Chip 
                    label={profile.role} 
                    size="small" 
                    color="primary" 
                    sx={{ mt: 1 }}
                  />
                </Box>
              </Box>

              <Divider sx={{ my: 2 }} />

              <List dense>
                <ListItem>
                  <ListItemIcon><Email /></ListItemIcon>
                  <ListItemText primary={profile.email} />
                </ListItem>
                <ListItem>
                  <ListItemIcon><Phone /></ListItemIcon>
                  <ListItemText primary={profile.telephone || 'Non renseigné'} />
                </ListItem>
                <ListItem>
                  <ListItemIcon><Business /></ListItemIcon>
                  <ListItemText primary={profile.service_nom} />
                </ListItem>
                <ListItem>
                  <ListItemIcon><Work /></ListItemIcon>
                  <ListItemText primary={`Niveau: ${profile.niveau}`} />
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

        {/* Statistiques et formulaire d'édition */}
        <Box sx={{ flex: { xs: 1, md: 0.6 } }}>
          {/* Statistiques */}
          <Card sx={{ mb: 3 }}>
            <CardContent>
              <Typography variant="h6" sx={{ mb: 2 }}>
                <TrendingUp sx={{ mr: 1, verticalAlign: 'middle' }} />
                Mes Statistiques
              </Typography>
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2 }}>
                <Box sx={{ flex: { xs: 1, sm: 0.25 }, textAlign: 'center', p: 2, bgcolor: 'grey.50', borderRadius: 1 }}>
                  <Typography variant="h4" color="primary">
                    {profile.total_requisitions}
                  </Typography>
                  <Typography variant="body2">Total</Typography>
                </Box>
                <Box sx={{ flex: { xs: 1, sm: 0.25 }, textAlign: 'center', p: 2, bgcolor: 'warning.50', borderRadius: 1 }}>
                  <Typography variant="h4" color="warning.main">
                    {profile.requisitions_en_cours}
                  </Typography>
                  <Typography variant="body2">En cours</Typography>
                </Box>
                <Box sx={{ flex: { xs: 1, sm: 0.25 }, textAlign: 'center', p: 2, bgcolor: 'success.50', borderRadius: 1 }}>
                  <Typography variant="h4" color="success.main">
                    {profile.requisitions_validees}
                  </Typography>
                  <Typography variant="body2">Validées</Typography>
                </Box>
                <Box sx={{ flex: { xs: 1, sm: 0.25 }, textAlign: 'center', p: 2, bgcolor: 'error.50', borderRadius: 1 }}>
                  <Typography variant="h4" color="error.main">
                    {profile.requisitions_refusees}
                  </Typography>
                  <Typography variant="body2">Refusées</Typography>
                </Box>
              </Box>
              <Box sx={{ mt: 2, display: 'flex', gap: 2 }}>
                <Box sx={{ flex: 1, textAlign: 'center', p: 2, bgcolor: 'blue.50', borderRadius: 1 }}>
                  <Typography variant="h5" color="primary">
                    ${profile.montant_total.toLocaleString()}
                  </Typography>
                  <Typography variant="body2">Montant total</Typography>
                </Box>
                <Box sx={{ flex: 1, textAlign: 'center', p: 2, bgcolor: 'purple.50', borderRadius: 1 }}>
                  <Typography variant="h5" color="purple.main">
                    ${Math.round(profile.moyenne_montant).toLocaleString()}
                  </Typography>
                  <Typography variant="body2">Moyenne</Typography>
                </Box>
              </Box>
            </CardContent>
          </Card>

          {/* Formulaire d'édition */}
          {editMode && (
            <Card sx={{ mb: 3 }}>
              <CardContent>
                <Typography variant="h6" sx={{ mb: 2 }}>
                  <Settings sx={{ mr: 1, verticalAlign: 'middle' }} />
                  Modifier mes informations
                </Typography>
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  <Box sx={{ display: 'flex', gap: 2, flexDirection: { xs: 'column', sm: 'row' } }}>
                    <TextField
                      fullWidth
                      label="Nom"
                      value={formData.nom || ''}
                      onChange={(e) => setFormData({ ...formData, nom: e.target.value })}
                    />
                    <TextField
                      fullWidth
                      label="Prénom"
                      value={formData.prenom || ''}
                      onChange={(e) => setFormData({ ...formData, prenom: e.target.value })}
                    />
                  </Box>
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

          {/* Réquisitions récentes */}
          <Card>
            <CardContent>
              <Box sx={{ mb: 2 }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                  <Typography variant="h6">
                    <Assignment sx={{ mr: 1, verticalAlign: 'middle' }} />
                    Mes Réquisitions
                  </Typography>
                </Box>
                
                <Grid container spacing={2}>
                  <Grid size={{ xs: 12, sm: 4 }}>
                    <FormControl size="small" fullWidth>
                      <InputLabel>Statut</InputLabel>
                      <Select
                        value={filterStatus}
                        label="Statut"
                        onChange={(e) => setFilterStatus(e.target.value)}
                      >
                        <MenuItem value="all">Toutes</MenuItem>
                        <MenuItem value="brouillon">Brouillon</MenuItem>
                        <MenuItem value="soumise">Soumise</MenuItem>
                        <MenuItem value="en_cours">En cours</MenuItem>
                        <MenuItem value="validee">Validée</MenuItem>
                        <MenuItem value="refusee">Refusée</MenuItem>
                        <MenuItem value="payee">Payée</MenuItem>
                      </Select>
                    </FormControl>
                  </Grid>
                  <Grid size={{ xs: 12, sm: 4 }}>
                    <FormControl size="small" fullWidth>
                      <InputLabel>Service</InputLabel>
                      <Select
                        value={filterService}
                        label="Service"
                        onChange={(e) => setFilterService(e.target.value)}
                      >
                        <MenuItem value="all">Tous</MenuItem>
                        {services.map((service: any) => (
                          <MenuItem key={service} value={service}>{service}</MenuItem>
                        ))}
                      </Select>
                    </FormControl>
                  </Grid>
                  <Grid size={{ xs: 12, sm: 4 }}>
                    <FormControl size="small" fullWidth>
                      <InputLabel>Urgence</InputLabel>
                      <Select
                        value={filterUrgence}
                        label="Urgence"
                        onChange={(e) => setFilterUrgence(e.target.value)}
                      >
                        <MenuItem value="all">Toutes</MenuItem>
                        {urgences.map((urgence: any) => (
                          <MenuItem key={urgence} value={urgence}>{getUrgenceLabel(urgence)}</MenuItem>
                        ))}
                      </Select>
                    </FormControl>
                  </Grid>
                </Grid>
              </Box>
              
              {filteredRequisitions.length > 0 ? (
                <List sx={{ maxHeight: 400, overflow: 'auto' }}>
                  {filteredRequisitions.map((requisition) => (
                    <React.Fragment key={requisition.id}>
                      <ListItem divider>
                        <ListItemIcon>
                          <Description color="primary" />
                        </ListItemIcon>
                        <ListItemText
                          primary={
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                              <Typography variant="subtitle2">
                                {requisition.reference}
                              </Typography>
                              <Typography variant="body2">
                                {requisition.objet}
                              </Typography>
                            </Box>
                          }
                          secondary={
                            <Box sx={{ mt: 1 }}>
                              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
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
                                {(requisition as any).nb_pieces !== undefined && (requisition as any).nb_pieces > 0 && (
                                  <Chip
                                    label={`${(requisition as any).nb_pieces} pièce(s)`}
                                    size="small"
                                    icon={<AttachFile sx={{ fontSize: 16 }} />}
                                    variant="outlined"
                                  />
                                )}
                                <Typography variant="caption" color="text.secondary">
                                  {requisition.devise} {requisition.montant.toLocaleString()}
                                </Typography>
                                <Typography variant="caption" color="text.secondary">
                                  {new Date(requisition.created_at).toLocaleDateString()}
                                </Typography>
                              </Box>
                              
                              {/* Afficher l'historique du workflow */}
                              {requisition.actions && requisition.actions.length > 0 && (
                                <Box sx={{ mt: 1, p: 1, bgcolor: 'grey.50', borderRadius: 1 }}>
                                  <Typography variant="caption" sx={{ fontWeight: 'bold', mb: 0.5, display: 'block' }}>
                                    Historique du workflow:
                                  </Typography>
                                  {requisition.actions.map((action: any, index: number) => (
                                    <Box key={index} sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                                      <Typography variant="caption" color="primary">
                                        {new Date(action.created_at).toLocaleDateString()} {new Date(action.created_at).toLocaleTimeString()}
                                      </Typography>
                                      <Chip
                                        label={action.action.toUpperCase()}
                                        size="small"
                                        color={action.action === 'valider' ? 'success' : action.action === 'refuser' ? 'error' : 'default'}
                                        sx={{ height: 20, fontSize: '0.6rem' }}
                                      />
                                      <Typography variant="caption" color="text.secondary">
                                        par {action.utilisateur_nom}
                                      </Typography>
                                      {action.commentaire && (
                                        <Typography variant="caption" sx={{ fontStyle: 'italic' }}>
                                          - "{action.commentaire}"
                                        </Typography>
                                      )}
                                    </Box>
                                  ))}
                                </Box>
                              )}
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
                    </React.Fragment>
                  ))}
                </List>
              ) : (
                <Box sx={{ textAlign: 'center', py: 4 }}>
                  <Typography variant="body2" color="text.secondary">
                    Vous n'avez pas encore de réquisition
                  </Typography>
                  <Button 
                    variant="contained" 
                    sx={{ mt: 2 }}
                    onClick={() => navigate('/requisitions/new')}
                  >
                    Créer ma première réquisition
                  </Button>
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
