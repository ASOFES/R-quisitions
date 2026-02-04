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
  Assessment,
  AccountBalance,
  PieChart,
  FilterList,
  AttachFile,
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { API_BASE_URL } from '../config';
import { useAuth } from '../context/AuthContext';
import { Requisition } from '../services/RequisitionService';

interface AnalystProfileData {
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
  
  const [profile, setProfile] = useState<AnalystProfileData | null>(null);
  const [recentRequisitions, setRecentRequisitions] = useState<Requisition[]>([]);
  const [paymentRequisitions, setPaymentRequisitions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [editMode, setEditMode] = useState(false);
  const [formData, setFormData] = useState<Partial<AnalystProfileData>>({});
  const [showSuccess, setShowSuccess] = useState(false);
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterService, setFilterService] = useState<string>('all');
  const [filterUrgence, setFilterUrgence] = useState<string>('all');

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

        // Fetch requisitions to classify (payment mode)
        const paymentResponse = await fetch(`${API_BASE_URL}/api/payments/a-classer`, {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        });
        if (paymentResponse.ok) {
          const paymentData = await paymentResponse.json();
          setPaymentRequisitions(paymentData);
        }
        
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
          // Fix: Ensure strict number parsing to avoid string concatenation
          montant_total_analyse: requisitionsToAnalyse.reduce((sum: number, r: any) => {
            const val = parseFloat(String(r.montant_usd || r.montant_cdf || 0));
            return sum + (isNaN(val) ? 0 : val);
          }, 0),
          moyenne_montant: requisitionsToAnalyse.length > 0 ? requisitionsToAnalyse.reduce((sum: number, r: any) => {
            const val = parseFloat(String(r.montant_usd || r.montant_cdf || 0));
            return sum + (isNaN(val) ? 0 : val);
          }, 0) / requisitionsToAnalyse.length : 0,
          taux_validation: allRequisitions.length > 0 ? Math.round((allRequisitions.filter((r: any) => r.statut === 'validee').length / allRequisitions.length) * 100) : 0,
        };

        // Créer le profil analyste
        const userProfile: AnalystProfileData = {
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

  const handleUpdatePaymentMode = async (id: number, mode: string) => {
    try {
      const token = localStorage.getItem('token');
      if (!token) return;
  
      const response = await fetch(`${API_BASE_URL}/api/payments/${id}/mode`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ mode_paiement: mode })
      });
  
      if (response.ok) {
        setShowSuccess(true);
        loadProfileData(); // Refresh
      } else {
        alert('Erreur lors de la mise à jour');
      }
    } catch (error) {
      console.error('Erreur:', error);
      alert('Erreur serveur');
    }
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

  // Extract unique services
  const services = Array.from(new Set(recentRequisitions.map(r => (r as any).service_nom).filter(Boolean)));

  const filteredRequisitions = recentRequisitions.filter(req => {
    const statusMatch = filterStatus === 'all' || req.statut === filterStatus;
    const urgenceMatch = filterUrgence === 'all' || req.urgence === filterUrgence;
    const serviceMatch = filterService === 'all' || (req as any).service_nom === filterService;
    return statusMatch && urgenceMatch && serviceMatch;
  });

  // Grouper les réquisitions par émetteur
  const requisitionsByEmitter = recentRequisitions.reduce((acc, req) => {
    const emitterName = req.emetteur_nom || 'Inconnu';
    if (!acc[emitterName]) {
      acc[emitterName] = [];
    }
    acc[emitterName].push(req);
    return acc;
  }, {} as Record<string, Requisition[]>);

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
          <Typography variant="h4">Mon Profil Analyste</Typography>
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
                  <Assessment sx={{ fontSize: 32 }} />
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
          {/* Statistiques principales */}
          <Card sx={{ mb: 3 }}>
            <CardContent>
              <Typography variant="h6" sx={{ mb: 2 }}>
                <AccountBalance sx={{ mr: 1, verticalAlign: 'middle' }} />
                Mes Statistiques d'Analyse
              </Typography>
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2 }}>
                <Box sx={{ flex: { xs: 1, sm: 0.25 }, textAlign: 'center', p: 2, bgcolor: 'grey.50', borderRadius: 1 }}>
                  <Typography variant="h4" color="primary">
                    {profile.total_requisitions_analysees}
                  </Typography>
                  <Typography variant="body2">Total à analyser</Typography>
                </Box>
                <Box sx={{ flex: { xs: 1, sm: 0.25 }, textAlign: 'center', p: 2, bgcolor: 'warning.50', borderRadius: 1 }}>
                  <Typography variant="h4" color="warning.main">
                    {profile.requisitions_en_attente}
                  </Typography>
                  <Typography variant="body2">En attente</Typography>
                </Box>
                <Box sx={{ flex: { xs: 1, sm: 0.25 }, textAlign: 'center', p: 2, bgcolor: 'success.50', borderRadius: 1 }}>
                  <Typography variant="h4" color="success.main">
                    {profile.requisitions_approuvees}
                  </Typography>
                  <Typography variant="body2">Approuvées</Typography>
                </Box>
                <Box sx={{ flex: { xs: 1, sm: 0.25 }, textAlign: 'center', p: 2, bgcolor: 'error.50', borderRadius: 1 }}>
                  <Typography variant="h4" color="error.main">
                    {profile.requisitions_rejetees}
                  </Typography>
                  <Typography variant="body2">Rejetées</Typography>
                </Box>
              </Box>
              <Box sx={{ mt: 2, display: 'flex', gap: 2 }}>
                <Box sx={{ flex: 1, textAlign: 'center', p: 2, bgcolor: 'blue.50', borderRadius: 1 }}>
                  <Typography variant="h5" color="primary">
                    ${profile.montant_total_analyse.toLocaleString()}
                  </Typography>
                  <Typography variant="body2">Montant total analysé</Typography>
                </Box>
                <Box sx={{ flex: 1, textAlign: 'center', p: 2, bgcolor: 'purple.50', borderRadius: 1 }}>
                  <Typography variant="h5" color="purple.main">
                    {Math.round(profile.moyenne_montant).toLocaleString()}
                  </Typography>
                  <Typography variant="body2">Moyenne</Typography>
                </Box>
              </Box>
            </CardContent>
          </Card>

          {/* Statistiques globales */}
          <Card sx={{ mb: 3 }}>
            <CardContent>
              <Typography variant="h6" sx={{ mb: 2 }}>
                <PieChart sx={{ mr: 1, verticalAlign: 'middle' }} />
                Vue Globale
              </Typography>
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2 }}>
                <Box sx={{ flex: 1, minWidth: 200, textAlign: 'center', p: 2, bgcolor: 'grey.50', borderRadius: 1 }}>
                  <Typography variant="h5" color="primary">
                    {profile.taux_validation}%
                  </Typography>
                  <Typography variant="body2">Taux de validation</Typography>
                </Box>
                <Box sx={{ flex: 1, minWidth: 200, textAlign: 'center', p: 2, bgcolor: 'info.50', borderRadius: 1 }}>
                  <Typography variant="h5" color="info.main">
                    {profile.requisitions_approuvees}
                  </Typography>
                  <Typography variant="body2">Total validées</Typography>
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

          {/* Réquisitions à classer (Paiement) */}
          <Card sx={{ mb: 3 }}>
            <CardContent>
              <Typography variant="h6" sx={{ mb: 2 }}>
                <AccountBalance sx={{ mr: 1, verticalAlign: 'middle' }} />
                Assignation Mode de Paiement (Post-Validation GM)
              </Typography>
              {paymentRequisitions.length === 0 ? (
                 <Alert severity="info">
                   Aucune réquisition validée par le GM n'est en attente de classification.
                   <br />
                   Les boutons Cash/Banque apparaîtront ici une fois qu'une réquisition aura été approuvée par le GM.
                 </Alert>
              ) : (
                <Box sx={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr style={{ textAlign: 'left', borderBottom: '1px solid #eee' }}>
                        <th style={{ padding: '8px' }}>Ref</th>
                        <th style={{ padding: '8px' }}>Objet</th>
                        <th style={{ padding: '8px' }}>Montant</th>
                        <th style={{ padding: '8px' }}>Mode Actuel</th>
                        <th style={{ padding: '8px' }}>Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {paymentRequisitions.map((req) => (
                        <tr key={req.id} style={{ borderBottom: '1px solid #eee' }}>
                          <td style={{ padding: '8px' }}>{req.numero}</td>
                          <td style={{ padding: '8px' }}>{req.objet}</td>
                          <td style={{ padding: '8px' }}>
                             {req.montant_usd ? `${req.montant_usd} USD` : `${req.montant_cdf} CDF`}
                          </td>
                          <td style={{ padding: '8px' }}>
                            {req.mode_paiement ? (
                               <Chip label={req.mode_paiement} color={req.mode_paiement === 'Cash' ? 'success' : 'primary'} size="small" />
                            ) : (
                               <Typography variant="caption" color="error">Non défini</Typography>
                            )}
                          </td>
                          <td style={{ padding: '8px' }}>
                            <Box sx={{ display: 'flex', gap: 1 }}>
                               <Button 
                                 variant={req.mode_paiement === 'Cash' ? "contained" : "outlined"} 
                                 color="success" 
                                 size="small"
                                 onClick={() => handleUpdatePaymentMode(req.id, 'Cash')}
                               >
                                 Cash
                               </Button>
                               <Button 
                                 variant={req.mode_paiement === 'Banque' ? "contained" : "outlined"} 
                                 color="primary" 
                                 size="small"
                                 onClick={() => handleUpdatePaymentMode(req.id, 'Banque')}
                               >
                                 Banque
                               </Button>
                            </Box>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </Box>
              )}
            </CardContent>
          </Card>

          {/* Réquisitions à analyser */}
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                <Typography variant="h6">
                  <FilterList sx={{ mr: 1, verticalAlign: 'middle' }} />
                  Réquisitions à Analyser
                </Typography>
                <Button 
                  variant="outlined" 
                  size="small"
                  onClick={() => navigate('/requisitions')}
                >
                  Voir tout
                </Button>
              </Box>
              
              {/* Filtres */}
              <Paper sx={{ p: 2, mb: 2 }}>
                <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', alignItems: 'center' }}>
                  <FormControl size="small" sx={{ minWidth: 200 }}>
                    <InputLabel>Statut</InputLabel>
                    <Select
                      value={filterStatus}
                      label="Statut"
                      onChange={(e) => setFilterStatus(e.target.value)}
                    >
                      <MenuItem value="all">Tous les statuts</MenuItem>
                      <MenuItem value="soumise">Soumise</MenuItem>
                      <MenuItem value="en_cours">En cours</MenuItem>
                      <MenuItem value="a_corriger">À corriger</MenuItem>
                      <MenuItem value="validee">Validée</MenuItem>
                      <MenuItem value="refusee">Refusée</MenuItem>
                      <MenuItem value="payee">Payée</MenuItem>
                    </Select>
                  </FormControl>
                  <FormControl size="small" sx={{ minWidth: 200 }}>
                    <InputLabel>Urgence</InputLabel>
                    <Select
                      value={filterUrgence}
                      label="Urgence"
                      onChange={(e) => setFilterUrgence(e.target.value)}
                    >
                      <MenuItem value="all">Toutes les urgences</MenuItem>
                      <MenuItem value="basse">Basse</MenuItem>
                      <MenuItem value="normale">Normale</MenuItem>
                      <MenuItem value="haute">Haute</MenuItem>
                      <MenuItem value="critique">Critique</MenuItem>
                    </Select>
                  </FormControl>
                  <FormControl size="small" sx={{ minWidth: 200 }}>
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
                </Box>
              </Paper>
              
              {filteredRequisitions.length > 0 ? (
                <>
                  {/* Vue groupée par émetteur */}
                  <Paper sx={{ p: 2, mb: 2, bgcolor: 'grey.50' }}>
                    <Typography variant="subtitle2" sx={{ mb: 2, fontWeight: 'bold' }}>
                      Réquisitions par Initiateur
                    </Typography>
                    {Object.entries(requisitionsByEmitter).map(([emitterName, emitterReqs]) => (
                      <Box key={emitterName} sx={{ mb: 2 }}>
                        <Typography variant="body2" sx={{ fontWeight: 'bold', color: 'primary.main' }}>
                          {emitterName} ({emitterReqs.length} réquisition{emitterReqs.length > 1 ? 's' : ''})
                        </Typography>
                        <Box sx={{ ml: 2, mt: 1 }}>
                          {emitterReqs.slice(0, 2).map((req) => (
                            <Typography key={req.id} variant="caption" sx={{ display: 'block', color: 'text.secondary' }}>
                              • {req.reference} - {req.objet} ({req.statut})
                            </Typography>
                          ))}
                          {emitterReqs.length > 2 && (
                            <Typography variant="caption" sx={{ color: 'text.secondary', fontStyle: 'italic' }}>
                              ... et {emitterReqs.length - 2} autre{emitterReqs.length - 2 > 1 ? 's' : ''}
                            </Typography>
                          )}
                        </Box>
                      </Box>
                    ))}
                  </Paper>

                  {/* Liste détaillée */}
                  <List>
                    {filteredRequisitions.map((requisition) => (
                      <ListItem key={requisition.id} divider>
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
                              <Chip 
                                label={requisition.emetteur_nom || 'Inconnu'} 
                                size="small" 
                                variant="outlined"
                                sx={{ ml: 1 }}
                              />
                            </Box>
                          }
                          secondary={
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 0.5, flexWrap: 'wrap' }}>
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
                              <Chip
                                label={`${(requisition as any).nb_pieces ?? 0} pièce(s)`}
                                size="small"
                                icon={<AttachFile sx={{ fontSize: 16 }} />}
                                variant="outlined"
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
                </>
              ) : (
                <Box sx={{ textAlign: 'center', py: 4 }}>
                  <Typography variant="body2" color="text.secondary">
                    Aucune réquisition à analyser
                  </Typography>
                  <Button 
                    variant="contained" 
                    sx={{ mt: 2 }}
                    onClick={() => navigate('/requisitions')}
                  >
                    Voir les réquisitions
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

export default AnalystProfile;
