import React, { useState, useEffect } from 'react';
import {
  Container,
  Typography,
  Box,
  Card,
  CardContent,
  Avatar,
  Chip,
  Button,
  Paper,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Divider,
  LinearProgress,
  IconButton,
  Tooltip,
  TextField,
} from '@mui/material';
import {
  ArrowBack,
  Person,
  Business,
  Email,
  Analytics,
  Pending,
  CheckCircle,
  Speed,
  Visibility,
  Save,
  Cancel,
  Edit,
  Schedule,
  Assignment,
  AttachFile,
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import RequisitionService from '../services/RequisitionService';
import { API_BASE_URL } from '../config';

const PMProfileClean: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

  // Redirection automatique selon le rôle
  useEffect(() => {
    if (user?.role === 'gm') {
      navigate('/gm-profile');
    }
  }, [user, navigate]);

  const [userState, setUserState] = useState({
    username: 'pm.user',
    nom_complet: 'Chef de Projet',
    email: 'pm@requisition.com',
    role: 'validateur',
    service_id: 3,
    service_nom: 'Direction des Projets',
    actif: 1,
    created_at: '2026-01-15 23:25:38',
    updated_at: '2026-01-15 23:25:38',
  });
  const [editMode, setEditMode] = useState(false);
  const [formData, setFormData] = useState({ ...userState });
  const [requisitions, setRequisitions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadProfileData();
  }, []);

  const loadProfileData = async () => {
    try {
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
        console.log('Réquisitions récupérées depuis le backend:', allRequisitions);
        console.log('Nombre de réquisitions:', allRequisitions.length);
        console.log('Détail de chaque réquisition:', allRequisitions.map((req: any) => ({
          id: req.id,
          numero: req.numero,
          reference: req.reference,
          objet: req.objet,
          niveau: req.niveau,
          statut: req.statut,
          emetteur_nom: req.emetteur_nom,
          montant_usd: req.montant_usd,
          montant_cdf: req.montant_cdf,
          service_nom: req.service_nom
        })));
        
        // Pour le PM, filtrer les réquisitions au niveau validateur et paiement
        const pmRequisitions = allRequisitions.filter((req: any) => 
          req.niveau === 'validateur' || 
          req.niveau === 'paiement' ||
          req.statut === 'termine'
        );
        
        console.log('Réquisitions filtrées pour PM:', pmRequisitions);
        console.log('Nombre de réquisitions pour PM:', pmRequisitions.length);
        setRequisitions(pmRequisitions);
      } else {
        console.error('Erreur lors de la récupération des réquisitions:', response.status);
        // En cas d'erreur, essayer avec le service local
        const requisitionService = RequisitionService.getInstance();
        const allRequisitions = requisitionService.getAllRequisitions();
        // Pour le PM, filtrer uniquement les réquisitions au niveau validateur
        const pmRequisitions = allRequisitions.filter(req => 
          req.niveau === 'validateur' || 
          (req.niveau === 'paiement' && req.statut === 'validee') ||
          req.statut === 'termine'
        );
        setRequisitions(pmRequisitions);
      }
      
      setLoading(false);
    } catch (error) {
      console.error('Erreur lors du chargement des données:', error);
      // En cas d'erreur, essayer avec le service local
      try {
        const requisitionService = RequisitionService.getInstance();
        const allRequisitions = requisitionService.getAllRequisitions();
        // Pour le PM, filtrer uniquement les réquisitions au niveau validateur
        const pmRequisitions = allRequisitions.filter(req => 
          req.niveau === 'validateur' || 
          (req.niveau === 'paiement' && req.statut === 'validee') ||
          req.statut === 'termine'
        );
        setRequisitions(pmRequisitions);
      } catch (localError) {
        console.error('Erreur avec le service local aussi:', localError);
      }
      setLoading(false);
    }
  };

  const handleSave = () => {
    setUserState(formData);
    setEditMode(false);
    console.log('Profil sauvegardé:', formData);
  };

  const handleCancel = () => {
    setFormData(userState);
    setEditMode(false);
  };

  const getRoleLabel = (role: string) => {
    switch (role) {
      case 'admin': return 'Administrateur';
      case 'validateur': return 'Deuxième niveau de validation';
      case 'analyste': return 'Premier niveau de validation';
      case 'emetteur': return 'Initiateur';
      case 'gm': return 'Validation finale avant paiement';
      default: return role;
    }
  };

  const getRoleColor = (role: string) => {
    switch (role) {
      case 'admin': return '#9c27b0';
      case 'validateur': return '#ff9800';
      case 'analyste': return '#2196f3';
      case 'emetteur': return '#4caf50';
      default: return '#9e9e9e';
    }
  };

  const getStatistiques = () => {
    const total = requisitions.length;
    // Pour le PM, les réquisitions à traiter sont celles au niveau validateur
    const enAttente = requisitions.filter(req => 
      req.niveau === 'validateur' && 
      (req.statut === 'en_cours' || req.statut === 'soumise')
    ).length;
    // Les réquisitions validées par le PM sont celles qui ont passé au niveau paiement ou terminées
    const completes = requisitions.filter(req => 
      (req.statut === 'validee' && req.niveau === 'paiement') || 
      req.statut === 'payee' || 
      req.statut === 'termine'
    ).length;
    
    console.log('Statistiques PM:', {
      total,
      enAttente,
      completes,
      details: requisitions.map(req => ({
        id: req.id,
        numero: req.numero,
        statut: req.statut,
        niveau: req.niveau
      }))
    });
    
    return {
      total,
      enAttente,
      completes,
      tauxCompletion: total > 0 ? Math.round((completes / total) * 100) : 0,
    };
  };

  const stats = getStatistiques();

  if (loading) {
    return (
      <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
        <Box sx={{ display: 'flex', justifyContent: 'center', mt: 8 }}>
          <LinearProgress sx={{ width: '50%' }} />
        </Box>
      </Container>
    );
  }

  return (
    <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
      {/* En-tête */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 4 }}>
        <Box sx={{ display: 'flex', alignItems: 'center' }}>
          <Button onClick={() => navigate('/requisitions')} startIcon={<ArrowBack />} sx={{ mr: 2 }}>
            Retour
          </Button>
          <Typography variant="h4" fontWeight="bold">
            Profil - {user?.nom_complet || 'Utilisateur'}
          </Typography>
        </Box>
        <Button
          variant={editMode ? "outlined" : "contained"}
          onClick={() => editMode ? handleCancel() : setEditMode(true)}
          startIcon={editMode ? <Cancel /> : <Edit />}
          sx={{ borderRadius: 2 }}
        >
          {editMode ? 'Annuler' : 'Modifier'}
        </Button>
      </Box>

      <Box sx={{ display: 'flex', flexDirection: { xs: 'column', md: 'row' }, gap: 3 }}>
        {/* Informations personnelles */}
        <Box sx={{ flex: { xs: '1', md: '0 0 33.333%' } }}>
          <Card sx={{ height: '100%', boxShadow: 3 }}>
            <CardContent sx={{ p: 3 }}>
              <Typography variant="h6" sx={{ mb: 3, display: 'flex', alignItems: 'center', gap: 1 }}>
                <Person color="primary" /> Informations personnelles
              </Typography>
              
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                  <Avatar 
                    sx={{ 
                      bgcolor: getRoleColor(user?.role || 'emetteur'), 
                      width: 64, 
                      height: 64,
                      fontSize: 24,
                      fontWeight: 'bold'
                    }}
                  >
                    {user?.nom_complet?.charAt(0) || 'U'}
                  </Avatar>
                  <Box>
                    <Typography variant="h6" fontWeight="bold">
                      {user?.nom_complet || 'Utilisateur'}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      @{user?.username || 'user'}
                    </Typography>
                  </Box>
                </Box>

                {editMode ? (
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                    <TextField
                      fullWidth
                      label="Nom complet"
                      value={formData.nom_complet}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFormData({ ...formData, nom_complet: e.target.value })}
                      variant="outlined"
                      size="small"
                    />
                    <TextField
                      fullWidth
                      label="Email"
                      type="email"
                      value={formData.email}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFormData({ ...formData, email: e.target.value })}
                      variant="outlined"
                      size="small"
                    />
                    <TextField
                      fullWidth
                      label="Service"
                      value={formData.service_nom}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFormData({ ...formData, service_nom: e.target.value })}
                      variant="outlined"
                      size="small"
                    />
                  </Box>
                ) : (
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Email fontSize="small" color="action" />
                      <Typography variant="body2">{user?.email || 'email@example.com'}</Typography>
                    </Box>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Business fontSize="small" color="action" />
                      <Typography variant="body2">{user?.service_nom || 'Service'}</Typography>
                    </Box>
                  </Box>
                )}

                <Chip
                  label={getRoleLabel(user?.role || 'emetteur')}
                  size="medium"
                  sx={{
                    backgroundColor: getRoleColor(user?.role || 'emetteur'),
                    color: 'white',
                    fontWeight: 'bold',
                    mt: 2,
                    alignSelf: 'flex-start'
                  }}
                />
              </Box>

              {editMode && (
                <Box sx={{ mt: 3, display: 'flex', gap: 1 }}>
                  <Button 
                    variant="contained" 
                    onClick={handleSave}
                    startIcon={<Save />}
                    fullWidth
                  >
                    Sauvegarder
                  </Button>
                  <Button 
                    variant="outlined" 
                    onClick={handleCancel}
                    startIcon={<Cancel />}
                    fullWidth
                  >
                    Annuler
                  </Button>
                </Box>
              )}
            </CardContent>
          </Card>
        </Box>

        {/* Statistiques */}
        <Box sx={{ flex: { xs: '1', md: '0 0 66.667%' } }}>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2 }}>
            {/* Cartes de statistiques */}
            <Box sx={{ flex: { xs: '1 1 100%', sm: '1 1 50%', md: '1 1 25%' } }}>
              <Card sx={{ boxShadow: 3 }}>
                <CardContent sx={{ textAlign: 'center', py: 3 }}>
                  <Box sx={{ display: 'flex', justifyContent: 'center', mb: 2 }}>
                    <Analytics color="primary" sx={{ fontSize: 40 }} />
                  </Box>
                  <Typography variant="h4" color="primary" fontWeight="bold">
                    {stats.total}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Total à valider
                  </Typography>
                </CardContent>
              </Card>
            </Box>

            <Box sx={{ flex: { xs: '1 1 100%', sm: '1 1 50%', md: '1 1 25%' } }}>
              <Card sx={{ boxShadow: 3 }}>
                <CardContent sx={{ textAlign: 'center', py: 3 }}>
                  <Box sx={{ display: 'flex', justifyContent: 'center', mb: 2 }}>
                    <Pending color="warning" sx={{ fontSize: 40 }} />
                  </Box>
                  <Typography variant="h4" color="warning" fontWeight="bold">
                    {stats.enAttente}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    En attente
                  </Typography>
                </CardContent>
              </Card>
            </Box>

            <Box sx={{ flex: { xs: '1 1 100%', sm: '1 1 50%', md: '1 1 25%' } }}>
              <Card sx={{ boxShadow: 3 }}>
                <CardContent sx={{ textAlign: 'center', py: 3 }}>
                  <Box sx={{ display: 'flex', justifyContent: 'center', mb: 2 }}>
                    <CheckCircle color="success" sx={{ fontSize: 40 }} />
                  </Box>
                  <Typography variant="h4" color="success" fontWeight="bold">
                    {stats.completes}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Validées
                  </Typography>
                </CardContent>
              </Card>
            </Box>

            <Box sx={{ flex: { xs: '1 1 100%', sm: '1 1 50%', md: '1 1 25%' } }}>
              <Card sx={{ boxShadow: 3 }}>
                <CardContent sx={{ textAlign: 'center', py: 3 }}>
                  <Box sx={{ display: 'flex', justifyContent: 'center', mb: 2 }}>
                    <Speed color="info" sx={{ fontSize: 40 }} />
                  </Box>
                  <Typography variant="h4" color="info" fontWeight="bold">
                    {stats.tauxCompletion}%
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Taux de completion
                  </Typography>
                  <Box sx={{ mt: 2 }}>
                    <LinearProgress 
                      variant="determinate" 
                      value={stats.tauxCompletion} 
                      sx={{ 
                        height: 8, 
                        borderRadius: 4,
                        backgroundColor: 'grey.200'
                      }}
                    />
                  </Box>
                </CardContent>
              </Card>
            </Box>

            {/* Réquisitions en attente */}
            <Box sx={{ flex: '1 1 100%' }}>
              <Card sx={{ boxShadow: 3 }}>
                <CardContent sx={{ p: 3 }}>
                  <Typography variant="h6" sx={{ mb: 3, display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Schedule color="primary" /> Réquisitions en attente de validation
                  </Typography>

                  {requisitions.length === 0 ? (
                    <Paper sx={{ p: 4, textAlign: 'center', bgcolor: '#f5f5f5' }}>
                      <Typography variant="body1" color="text.secondary">
                        Aucune réquisition en attente de validation
                      </Typography>
                    </Paper>
                  ) : (
                    <List sx={{ maxHeight: 400, overflow: 'auto' }}>
                      {requisitions.map((req, index) => (
                        <React.Fragment key={req.id}>
                          <ListItem
                            sx={{
                              border: '1px solid #e0e0e0',
                              borderRadius: 1,
                              mb: 1,
                              '&:hover': {
                                bgcolor: '#f5f5f5',
                                transform: 'translateX(4px)',
                                transition: 'all 0.2s ease-in-out'
                              },
                            }}
                          >
                            <ListItemIcon>
                              <Assignment color="primary" />
                            </ListItemIcon>
                            <ListItemText
                              primary={
                                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                  <Typography variant="subtitle1" fontWeight="bold">
                                    {req.numero || req.reference}
                                  </Typography>
                                  <Chip
                                    label={req.statut === 'en_cours' ? 'En cours' : req.statut}
                                    size="small"
                                    color={
                                      req.statut === 'en_cours' ? 'warning' :
                                      req.statut === 'validee' ? 'success' : 'default'
                                    }
                                  />
                                </Box>
                              }
                              secondary={
                                <Box sx={{ mt: 1 }}>
                                  <Typography variant="body2" fontWeight="medium">
                                    {req.objet}
                                  </Typography>
                                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 0.5 }}>
                                    {(req as any).nb_pieces !== undefined && (req as any).nb_pieces > 0 && (
                                      <Chip
                                        label={`${(req as any).nb_pieces} pièce(s)`}
                                        size="small"
                                        icon={<AttachFile sx={{ fontSize: 16 }} />}
                                        variant="outlined"
                                        sx={{ height: 20, fontSize: '0.7rem' }}
                                      />
                                    )}
                                    <Typography variant="caption" color="text.secondary">
                                      Montant: {req.devise} {(req.montant_usd || req.montant_cdf || 0).toLocaleString()} | 
                        Service: {req.service_nom} | 
                        Initiateur: {req.emetteur_nom}
                                    </Typography>
                                  </Box>
                                </Box>
                              }
                            />
                            <Tooltip title="Voir les détails">
                              <IconButton
                                edge="end"
                                onClick={() => navigate(`/requisitions/${req.id}`)}
                                sx={{ ml: 2 }}
                              >
                                <Visibility />
                              </IconButton>
                            </Tooltip>
                          </ListItem>
                          {index < requisitions.length - 1 && <Divider />}
                        </React.Fragment>
                      ))}
                    </List>
                  )}
                </CardContent>
              </Card>
            </Box>
          </Box>
        </Box>
      </Box>
    </Container>
  );
};

export default PMProfileClean;
