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
  Person,
  Email,
  Business,
  CheckCircle,
  Pending,
  Schedule,
  TrendingUp,
  Assignment,
  ArrowBack,
  Edit,
  Save,
  Cancel,
  Visibility,
  Speed,
  Analytics,
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import RequisitionService from '../services/RequisitionService';

const PMProfileFinal: React.FC = () => {
  const navigate = useNavigate();
  const [user, setUser] = useState({
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
  const [formData, setFormData] = useState({ ...user });
  const [requisitions, setRequisitions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadProfileData();
  }, []);

  const loadProfileData = () => {
    try {
      const requisitionService = RequisitionService.getInstance();
      const allRequisitions = requisitionService.getAllRequisitions();
      
      // Filtrer les réquisitions qui nécessitent la validation du manager
      const managerRequisitions = allRequisitions.filter(req => {
        return req.statut === 'en_cours' && 
               req.workflow && 
               req.workflow.current_step === 'manager_review';
      });
      
      setRequisitions(managerRequisitions);
      setLoading(false);
    } catch (error) {
      console.error('Erreur lors du chargement des données:', error);
      setLoading(false);
    }
  };

  const handleSave = () => {
    setUser(formData);
    setEditMode(false);
    console.log('Profil sauvegardé:', formData);
  };

  const handleCancel = () => {
    setFormData(user);
    setEditMode(false);
  };

  const getRoleLabel = (role: string) => {
    switch (role) {
      case 'admin': return 'Administrateur';
      case 'validateur': return 'Deuxième niveau de validation';
      case 'analyste': return 'Premier niveau de validation';
      case 'emetteur': return 'Émetteur';
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
    const enAttente = requisitions.filter(req => req.statut === 'en_cours').length;
    const completes = requisitions.filter(req => req.statut === 'validee').length;
    
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
          <Button onClick={() => navigate('/dashboard')} startIcon={<ArrowBack />} sx={{ mr: 2 }}>
            Retour
          </Button>
          <Typography variant="h4" fontWeight="bold">
            Profil - {user.nom_complet}
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

      <Box sx={{ display: 'flex', gap: 3, flexDirection: { xs: 'column', md: 'row' } }}>
        {/* Informations personnelles */}
        <Box sx={{ flex: { xs: 1, md: 0.4 } }}>
          <Card sx={{ height: '100%', boxShadow: 3 }}>
            <CardContent sx={{ p: 3 }}>
              <Typography variant="h6" sx={{ mb: 3, display: 'flex', alignItems: 'center', gap: 1 }}>
                <Person color="primary" /> Informations personnelles
              </Typography>
              
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                  <Avatar 
                    sx={{ 
                      bgcolor: getRoleColor(user.role), 
                      width: 64, 
                      height: 64,
                      fontSize: 24,
                      fontWeight: 'bold'
                    }}
                  >
                    {user.nom_complet.charAt(0)}
                  </Avatar>
                  <Box>
                    <Typography variant="h6" fontWeight="bold">
                      {user.nom_complet}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      @{user.username}
                    </Typography>
                  </Box>
                </Box>

                {editMode ? (
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                    <TextField
                      fullWidth
                      label="Nom complet"
                      value={formData.nom_complet}
                      onChange={(e: any) => setFormData({ ...formData, nom_complet: e.target.value })}
                      variant="outlined"
                      size="small"
                    />
                    <TextField
                      fullWidth
                      label="Email"
                      type="email"
                      value={formData.email}
                      onChange={(e: any) => setFormData({ ...formData, email: e.target.value })}
                      variant="outlined"
                      size="small"
                    />
                    <TextField
                      fullWidth
                      label="Service"
                      value={formData.service_nom}
                      onChange={(e: any) => setFormData({ ...formData, service_nom: e.target.value })}
                      variant="outlined"
                      size="small"
                    />
                  </Box>
                ) : (
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Email fontSize="small" color="action" />
                      <Typography variant="body2">{user.email}</Typography>
                    </Box>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Business fontSize="small" color="action" />
                      <Typography variant="body2">{user.service_nom}</Typography>
                    </Box>
                  </Box>
                )}

                <Chip
                  label={getRoleLabel(user.role)}
                  size="medium"
                  sx={{
                    backgroundColor: getRoleColor(user.role),
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
        <Box sx={{ flex: { xs: 1, md: 0.6 } }}>
          <Box sx={{ display: 'flex', gap: 2, flexDirection: { xs: 'column', md: 'row' } }}>
            {/* Cartes de statistiques */}
            <Box sx={{ flex: 1 }}>
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

            <Box sx={{ flex: 1 }}>
              <Card sx={{ boxShadow: 3 }}>
                <CardContent sx={{ textAlign: 'center', py: 3 }}>
                  <Box sx={{ display: 'flex', justifyContent: 'center', mb: 2 }}>
                    <Pending color="warning" sx={{ fontSize: 40 }} />
                  </Box>
                  <Typography variant="h4" color="warning.main" fontWeight="bold">
                    {stats.enAttente}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    En attente
                  </Typography>
                </CardContent>
              </Card>
            </Box>

            <Box sx={{ flex: 1 }}>
              <Card sx={{ boxShadow: 3 }}>
                <CardContent sx={{ textAlign: 'center', py: 3 }}>
                  <Box sx={{ display: 'flex', justifyContent: 'center', mb: 2 }}>
                    <CheckCircle color="success" sx={{ fontSize: 40 }} />
                  </Box>
                  <Typography variant="h4" color="success.main" fontWeight="bold">
                    {stats.completes}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Validées
                  </Typography>
                </CardContent>
              </Card>
            </Box>

            <Box sx={{ flex: 1 }}>
              <Card sx={{ boxShadow: 3 }}>
                <CardContent sx={{ textAlign: 'center', py: 3 }}>
                  <Box sx={{ display: 'flex', justifyContent: 'center', mb: 2 }}>
                    <Speed color="info" sx={{ fontSize: 40 }} />
                  </Box>
                  <Typography variant="h4" color="info.main" fontWeight="bold">
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
          </Box>

          {/* Réquisitions en attente */}
          <Box sx={{ flex: 1 }}>
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
                                    {req.reference}
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
                                  <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5 }}>
                                    Montant: {req.devise} {req.montant.toLocaleString()} | 
                                    Service: {req.service_nom} | 
                                    Émetteur: {req.emetteur_nom}
                                  </Typography>
                                </Box>
                              }
                            />
                            <Tooltip title="Voir les détails">
                              <IconButton
                                edge="end"
                                onClick={() => navigate(`/requisition-analysis/${req.id}`)}
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
    </Container>
  );
};

export default PMProfileFinal;
