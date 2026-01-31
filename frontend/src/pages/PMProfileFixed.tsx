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
} from '@mui/material';
import {
  Person,
  Email,
  Business,
  Assessment,
  Timeline,
  CheckCircle,
  Pending,
  Schedule,
  TrendingUp,
  Group,
  Assignment,
  ArrowBack,
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import RequisitionService from '../services/RequisitionService';

const ProfilePage: React.FC = () => {
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
    // Ici, vous pourriez ajouter un appel API pour sauvegarder
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
          <div>Chargement...</div>
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
          <Typography variant="h4">Profil - {user.nom_complet}</Typography>
        </Box>
        <Button
          variant={editMode ? "outlined" : "contained"}
          onClick={() => editMode ? handleCancel() : setEditMode(true)}
          startIcon={editMode ? <ArrowBack /> : <Assessment />}
        >
          {editMode ? 'Annuler' : 'Modifier'}
        </Button>
      </Box>

      <Box sx={{ display: 'flex', gap: 3, flexDirection: { xs: 'column', md: 'row' } }}>
        {/* Informations personnelles */}
        <Box sx={{ flex: { xs: 1, md: 0.666 } }}>
          <Card>
            <CardContent>
              <Typography variant="h6" sx={{ mb: 3, display: 'flex', alignItems: 'center', gap: 1 }}>
                <Person /> Informations personnelles
              </Typography>
              
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                  <Avatar sx={{ bgcolor: getRoleColor(user.role) }}>
                    {user.nom_complet.charAt(0)}
                  </Avatar>
                  <Box>
                    <Typography variant="h6">{user.nom_complet}</Typography>
                    <Typography variant="body2" color="text.secondary">
                      @{user.username}
                    </Typography>
                  </Box>
                </Box>

                {editMode ? (
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                    <Typography variant="body2">
                      <strong>Nom:</strong>
                      <input
                        type="text"
                        value={formData.nom_complet}
                        onChange={(e) => setFormData({ ...formData, nom_complet: e.target.value })}
                        style={{ marginLeft: 8, padding: 4, border: '1px solid #ccc', borderRadius: 4 }}
                      />
                    </Typography>
                    <Typography variant="body2">
                      <strong>Email:</strong>
                      <input
                        type="email"
                        value={formData.email}
                        onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                        style={{ marginLeft: 8, padding: 4, border: '1px solid #ccc', borderRadius: 4 }}
                      />
                    </Typography>
                    <Typography variant="body2">
                      <strong>Service:</strong>
                      <input
                        type="text"
                        value={formData.service_nom}
                        onChange={(e) => setFormData({ ...formData, service_nom: e.target.value })}
                        style={{ marginLeft: 8, padding: 4, border: '1px solid #ccc', borderRadius: 4 }}
                      />
                    </Typography>
                  </Box>
                ) : (
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Email fontSize="small" />
                      <Typography variant="body2">{user.email}</Typography>
                    </Box>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Business fontSize="small" />
                      <Typography variant="body2">{user.service_nom}</Typography>
                    </Box>
                  </Box>
                )}

                <Chip
                  label={getRoleLabel(user.role)}
                  size="small"
                  sx={{
                    backgroundColor: getRoleColor(user.role),
                    color: 'white',
                    fontWeight: 'bold',
                    mt: 1,
                  }}
                />
              </Box>

              {editMode && (
                <Box sx={{ mt: 3, display: 'flex', gap: 1 }}>
                  <Button variant="contained" onClick={handleSave}>
                    Sauvegarder
                  </Button>
                  <Button variant="outlined" onClick={handleCancel}>
                    Annuler
                  </Button>
                </Box>
              )}
            </CardContent>
          </Card>
        </Box>

        {/* Statistiques */}
        <Box sx={{ flex: { xs: 1, md: 0.666 } }}>
          <Card>
            <CardContent>
              <Typography variant="h6" sx={{ mb: 3, display: 'flex', alignItems: 'center', gap: 1 }}>
                <TrendingUp /> Statistiques de validation
              </Typography>

              <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
                <Box sx={{ p: 2, textAlign: 'center', bgcolor: '#f5f5f5' }}>
                  <Typography variant="h4" color="primary">
                    {stats.total}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Total à valider
                  </Typography>
                </Box>
                <Box sx={{ p: 2, textAlign: 'center', bgcolor: '#fff3e0' }}>
                  <Typography variant="h4" color="warning.main">
                    {stats.enAttente}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    En attente
                  </Typography>
                </Box>
                <Box sx={{ p: 2, textAlign: 'center', bgcolor: '#e8f5e8' }}>
                  <Typography variant="h4" color="success.main">
                    {stats.completes}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Validées
                  </Typography>
                </Box>
                <Box sx={{ p: 2, textAlign: 'center', bgcolor: '#e3f2fd' }}>
                  <Typography variant="h4" color="info.main">
                    {stats.tauxCompletion}%
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Taux de completion
                  </Typography>
                </Box>
              </Box>
            </CardContent>
          </Card>

          {/* Réquisitions en attente de validation */}
          <Card sx={{ mt: 3 }}>
            <CardContent>
              <Typography variant="h6" sx={{ mb: 3, display: 'flex', alignItems: 'center', gap: 1 }}>
                <Schedule /> Réquisitions en attente de validation
              </Typography>

              {requisitions.length === 0 ? (
                <Paper sx={{ p: 3, textAlign: 'center', bgcolor: '#f5f5f5' }}>
                  <Typography variant="body1" color="text.secondary">
                    Aucune réquisition en attente de validation
                  </Typography>
                </Paper>
              ) : (
                <List>
                  {requisitions.map((req, index) => (
                    <React.Fragment key={req.id}>
                      <ListItem
                        sx={{
                          border: '1px solid #e0e0e0',
                          borderRadius: 1,
                          mb: 1,
                          '&:hover': {
                            bgcolor: '#f5f5f5',
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
                              <Typography variant="body2" sx={{ fontWeight: 'medium' }}>
                                {req.objet}
                              </Typography>
                              <Typography variant="caption" color="text.secondary">
                                Montant: {req.devise} {req.montant.toLocaleString()} | 
                                Service: {req.service_nom} | 
                                Émetteur: {req.emetteur_nom}
                              </Typography>
                            </Box>
                          }
                        />
                        <Button
                          variant="outlined"
                          size="small"
                          onClick={() => navigate(`/requisition-analysis/${req.id}`)}
                          sx={{ ml: 2 }}
                        >
                          Valider
                        </Button>
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
    </Container>
  );
};

export default ProfilePage;
