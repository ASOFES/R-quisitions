import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Container,
  Typography,
  Box,
  Card,
  CardContent,
  Avatar,
  Chip,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Button,
  TextField,
  Alert,
  CircularProgress,
  Paper,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Divider,
} from '@mui/material';
import {
  ArrowBack,
  Edit,
  Save,
  Cancel,
  Email,
  Phone,
  Business,
  Work,
  Assignment,
  Visibility,
  Comment,
  Timeline,
  Person,
  AttachFile,
} from '@mui/icons-material';
import RequisitionService from '../services/RequisitionService';
import { useAuth } from '../context/AuthContext';
import WorkflowTracker from '../components/WorkflowTracker';
import WorkflowSummary from '../components/WorkflowSummary';

interface UserProfile {
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
}

interface RequisitionSummary {
  id: number;
  reference: string;
  objet: string;
  montant: number;
  devise: string;
  statut: string;
  urgence: string;
  created_at: string;
  nb_pieces?: number;
}

const ProfilePage: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [recentRequisitions, setRecentRequisitions] = useState<RequisitionSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [editMode, setEditMode] = useState(false);
  const [formData, setFormData] = useState<Partial<UserProfile>>({});
  const [alert, setAlert] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [selectedRequisition, setSelectedRequisition] = useState<any>(null);
  const [showDetailsDialog, setShowDetailsDialog] = useState(false);

  useEffect(() => {
    if (user) {
      loadProfileData();
    }
  }, [user]);

  const loadProfileData = async () => {
    try {
      if (!user) return;

      let userRequisitions: any[] = [];
      const token = localStorage.getItem('token');

      if (token) {
        try {
          // Récupérer les réquisitions depuis l'API du backend
          const response = await fetch(`${API_BASE_URL}/api/requisitions`, {
            headers: {
              'Authorization': `Bearer ${token}`
            }
          });

          if (response.ok) {
            const data = await response.json();
            // Filtrer pour n'avoir que les réquisitions de l'utilisateur connecté
            // Note: L'API retourne déjà filtré pour 'emetteur', mais 'admin' voit tout.
            // Pour le profil, on veut SES réquisitions (si l'admin en a fait).
            // Mais si l'utilisateur est admin, user.id devrait matcher emetteur_id.
            // Vérifions les champs retournés par l'API (basé sur RequisitionsListSimple)
            userRequisitions = data.filter((req: any) => req.emetteur_id === user.id).map((req: any) => ({
              ...req,
              id: req.id,
              reference: req.numero,
              statut: req.statut === 'valide' ? 'validee' : (req.statut === 'refuse' ? 'refusee' : req.statut),
              montant: req.montant_usd || req.montant_cdf || 0,
              devise: req.montant_usd ? 'USD' : 'CDF',
              nb_pieces: req.nb_pieces || 0
            }));
          }
        } catch (err) {
          console.error('Erreur fetch API:', err);
        }
      }

      // Fallback si pas de données API (ou pas de token)
      if (userRequisitions.length === 0) {
        const requisitionService = RequisitionService.getInstance();
        const allRequisitions = requisitionService.getAllRequisitions();
        userRequisitions = allRequisitions.filter(req => req.emetteur_id === user.id);
      }
      
      // Calculer les statistiques
      const stats = {
        total_requisitions: userRequisitions.length,
        requisitions_en_cours: userRequisitions.filter(r => r.statut === 'en_cours' || r.statut === 'soumise').length,
        requisitions_validees: userRequisitions.filter(r => r.statut === 'validee').length,
      };
      
      // Créer le profil avec les vraies données de l'utilisateur connecté
      const userProfile: UserProfile = {
        id: user.id,
        username: user.username,
        email: user.email,
        nom: user.nom_complet ? user.nom_complet.split(' ')[0] : user.username,
        prenom: user.nom_complet && user.nom_complet.split(' ').length > 1 ? user.nom_complet.split(' ').slice(1).join(' ') : '',
        telephone: '', // Non disponible dans l'objet User standard
        role: user.role,
        service_nom: user.service_nom || 'N/A',
        service_id: user.service_id || 0,
        niveau: 'N1',
        created_at: new Date().toISOString(),
        last_login: new Date().toISOString(),
        ...stats,
      };

      // Créer les réquisitions récentes
      const recentReqs: RequisitionSummary[] = userRequisitions
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
        .slice(0, 5)
        .map(req => ({
          id: req.id,
          reference: req.reference || `REQ-${req.id}`,
          objet: req.objet,
          montant: req.montant,
          devise: req.devise,
          statut: req.statut,
          urgence: req.urgence || 'normale',
          created_at: req.created_at,
          nb_pieces: req.nb_pieces
        }));

      setProfile(userProfile);
      setRecentRequisitions(recentReqs);
      setLoading(false);
      
      console.log('📊 Profil chargé avec stats:', stats);
      console.log('📋 Réquisitions récentes:', recentReqs.length);
    } catch (error) {
      console.error('Erreur lors du chargement du profil:', error);
      setAlert({ type: 'error', message: 'Erreur lors du chargement du profil' });
      setLoading(false);
    }
  };

  const handleEdit = () => {
    setEditMode(true);
  };

  const handleCancel = () => {
    setEditMode(false);
    if (profile) {
      setFormData({
        nom: profile.nom,
        prenom: profile.prenom,
        email: profile.email,
        telephone: profile.telephone || '',
      });
    }
  };

  const handleSave = async () => {
    try {
      // Simuler la sauvegarde
      setAlert({ type: 'success', message: 'Profil mis à jour avec succès' });
      setEditMode(false);
      
      if (profile) {
        setProfile({
          ...profile,
          nom: formData.nom || profile.nom,
          prenom: formData.prenom || profile.prenom,
          email: formData.email || profile.email,
          telephone: formData.telephone || profile.telephone,
        });
      }
    } catch (error) {
      console.error('Erreur lors de la sauvegarde:', error);
      setAlert({ type: 'error', message: 'Erreur lors de la sauvegarde du profil' });
    }
  };

  const handleViewDetails = (requisition: RequisitionSummary) => {
    const requisitionService = RequisitionService.getInstance();
    const fullRequisition = requisitionService.getAllRequisitions().find(r => r.id === requisition.id);
    setSelectedRequisition(fullRequisition);
    setShowDetailsDialog(true);
  };

  const handleCloseDetailsDialog = () => {
    setShowDetailsDialog(false);
    setSelectedRequisition(null);
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

  const getUrgenceColor = (urgence: string) => {
    switch (urgence) {
      case 'basse': return '#4caf50';
      case 'normale': return '#2196f3';
      case 'haute': return '#ff9800';
      case 'urgente': return '#f44336';
      default: return '#9e9e9e';
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

  return (
    <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
      {/* En-tête */}
      <Box sx={{ display: 'flex', alignItems: 'center', mb: 4 }}>
        <Button onClick={() => navigate('/dashboard')} startIcon={<ArrowBack />} sx={{ mr: 2 }}>
          Retour
        </Button>
        <Typography variant="h4">Mon Profil</Typography>
      </Box>

      {/* Alert */}
      {alert && (
        <Alert 
          severity={alert.type} 
          sx={{ mb: 2 }}
          onClose={() => setAlert(null)}
        >
          {alert.message}
        </Alert>
      )}

      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 3 }}>
        {/* Informations personnelles */}
        <Box sx={{ flex: '1', minWidth: 300, maxWidth: 400 }}>
          <Card sx={{ height: '100%' }}>
            <CardContent sx={{ textAlign: 'center', pb: 2 }}>
              <Avatar
                sx={{ 
                  width: 80, 
                  height: 80, 
                  mx: 'auto', 
                  mb: 2,
                  bgcolor: 'primary.main',
                  fontSize: '2rem'
                }}
              >
                {profile?.nom?.[0]}{profile?.prenom?.[0]}
              </Avatar>
              
              <Typography variant="h5" sx={{ mb: 1 }}>
                {profile?.prenom} {profile?.nom}
              </Typography>
              
              <Chip 
                label={profile?.role?.toUpperCase()} 
                color="primary" 
                size="small" 
                sx={{ mb: 2 }}
              />
              
              <List dense>
                <ListItem>
                  <ListItemIcon><Person color="primary" /></ListItemIcon>
                  <ListItemText 
                    primary="Nom d'utilisateur" 
                    secondary={profile?.username} 
                  />
                </ListItem>
                <ListItem>
                  <ListItemIcon><Email color="primary" /></ListItemIcon>
                  <ListItemText 
                    primary="Email" 
                    secondary={
                      editMode ? (
                        <TextField
                          fullWidth
                          size="small"
                          value={formData.email}
                          onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                          variant="outlined"
                        />
                      ) : (
                        profile?.email
                      )
                    } 
                  />
                </ListItem>
                <ListItem>
                  <ListItemIcon><Phone color="primary" /></ListItemIcon>
                  <ListItemText 
                    primary="Téléphone" 
                    secondary={
                      editMode ? (
                        <TextField
                          fullWidth
                          size="small"
                          value={formData.telephone}
                          onChange={(e) => setFormData({ ...formData, telephone: e.target.value })}
                          variant="outlined"
                        />
                      ) : (
                        profile?.telephone || 'Non renseigné'
                      )
                    } 
                  />
                </ListItem>
                <ListItem>
                  <ListItemIcon><Business color="primary" /></ListItemIcon>
                  <ListItemText 
                    primary="Service" 
                    secondary={profile?.service_nom} 
                  />
                </ListItem>
                <ListItem>
                  <ListItemIcon><Work color="primary" /></ListItemIcon>
                  <ListItemText 
                    primary="Niveau" 
                    secondary={profile?.niveau} 
                  />
                </ListItem>
              </List>
              
              <Box sx={{ mt: 2, display: 'flex', gap: 1 }}>
                {editMode ? (
                  <>
                    <Button
                      variant="contained"
                      startIcon={<Save />}
                      onClick={handleSave}
                      fullWidth
                    >
                      Sauvegarder
                    </Button>
                    <Button
                      variant="outlined"
                      startIcon={<Cancel />}
                      onClick={handleCancel}
                      fullWidth
                    >
                      Annuler
                    </Button>
                  </>
                ) : (
                  <Button
                    variant="contained"
                    startIcon={<Edit />}
                    onClick={handleEdit}
                    fullWidth
                  >
                    Modifier le profil
                  </Button>
                )}
              </Box>
            </CardContent>
          </Card>
        </Box>

        {/* Statistiques */}
        <Box sx={{ flex: '2', minWidth: 300 }}>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2, mb: 3 }}>
            <Box sx={{ flex: '1', minWidth: 150 }}>
              <Card>
                <CardContent sx={{ textAlign: 'center', py: 2 }}>
                  <Typography variant="h4" color="primary" sx={{ mb: 1 }}>
                    {profile?.total_requisitions}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Total des réquisitions
                  </Typography>
                </CardContent>
              </Card>
            </Box>
            <Box sx={{ flex: '1', minWidth: 150 }}>
              <Card>
                <CardContent sx={{ textAlign: 'center', py: 2 }}>
                  <Typography variant="h4" color="warning.main" sx={{ mb: 1 }}>
                    {profile?.requisitions_en_cours}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    En cours
                  </Typography>
                </CardContent>
              </Card>
            </Box>
            <Box sx={{ flex: '1', minWidth: 150 }}>
              <Card>
                <CardContent sx={{ textAlign: 'center', py: 2 }}>
                  <Typography variant="h4" color="success.main" sx={{ mb: 1 }}>
                    {profile?.requisitions_validees}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Validées
                  </Typography>
                </CardContent>
              </Card>
            </Box>
            <Box sx={{ flex: '1', minWidth: 150 }}>
              <Card>
                <CardContent sx={{ textAlign: 'center', py: 2 }}>
                  <Typography variant="h4" color="info.main" sx={{ mb: 1 }}>
                    {Math.round((profile?.requisitions_validees || 0) / (profile?.total_requisitions || 1) * 100)}%
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Taux de validation
                  </Typography>
                </CardContent>
              </Card>
            </Box>
          </Box>

          {/* Réquisitions récentes */}
          <Paper sx={{ mt: 3 }}>
            <Box sx={{ p: 2, borderBottom: '1px solid #e0e0e0' }}>
              <Typography variant="h6" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Assignment />
                Mes réquisitions récentes
              </Typography>
            </Box>
            <List>
              {recentRequisitions.map((req: RequisitionSummary, index: number) => (
                <React.Fragment key={req.id}>
                  <ListItem sx={{ py: 1.5 }}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
                      <Box>
                        <Typography variant="subtitle2" fontWeight="bold">
                          {req.reference}
                        </Typography>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                        <Typography variant="body2" color="text.secondary">
                          {req.objet}
                        </Typography>
                        {req.nb_pieces !== undefined && req.nb_pieces > 0 && (
                          <Chip
                            label={`${req.nb_pieces} pièce(s)`}
                            size="small"
                            icon={<AttachFile sx={{ fontSize: 16 }} />}
                            variant="outlined"
                            sx={{ height: 20, fontSize: '0.7rem' }}
                          />
                        )}
                      </Box>
                        <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                          <Chip
                            label={req.statut}
                            size="small"
                            sx={{ 
                              backgroundColor: getStatutColor(req.statut), 
                              color: 'white',
                              fontSize: '0.7rem'
                            }}
                          />
                          <Chip
                            label={req.urgence}
                            size="small"
                            sx={{ 
                              backgroundColor: getUrgenceColor(req.urgence), 
                              color: 'white',
                              fontSize: '0.7rem'
                            }}
                          />
                          <Typography variant="caption" color="text.secondary">
                            {new Date(req.created_at).toLocaleDateString()}
                          </Typography>
                        </Box>
                      </Box>
                      <Box sx={{ mt: 1 }}>
                        <IconButton
                          size="small"
                          onClick={() => handleViewDetails(req)}
                          color="primary"
                          title="Voir les détails et commentaires"
                        >
                          <Visibility sx={{ fontSize: 16 }} />
                        </IconButton>
                      </Box>
                    </Box>
                  </ListItem>
                  {index < recentRequisitions.length - 1 && <Divider />}
                </React.Fragment>
              ))}
            </List>
          </Paper>
        </Box>
      </Box>

      {/* Dialogue de détails de réquisition */}
      <Dialog 
        open={showDetailsDialog} 
        onClose={handleCloseDetailsDialog}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Assignment />
            Détails de la réquisition
          </Box>
        </DialogTitle>
        <DialogContent>
          {selectedRequisition && (
            <Box>
              {/* Informations de base */}
              <Box sx={{ mb: 3 }}>
                <Typography variant="h6" sx={{ mb: 2 }}>
                  {selectedRequisition.reference} - {selectedRequisition.objet}
                </Typography>
                <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
                  <Chip label={`${selectedRequisition.devise} ${selectedRequisition.montant}`} />
                  <Chip 
                    label={selectedRequisition.statut}
                    sx={{ backgroundColor: getStatutColor(selectedRequisition.statut), color: 'white' }}
                  />
                  <Chip 
                    label={selectedRequisition.urgence}
                    sx={{ backgroundColor: getUrgenceColor(selectedRequisition.urgence), color: 'white' }}
                  />
                </Box>
              </Box>

              {/* Workflow et niveau de validation */}
              {selectedRequisition.workflow && (
                <Box sx={{ mb: 3 }}>
                  <Typography variant="subtitle1" sx={{ mb: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Timeline />
                    Niveau de validation actuel
                  </Typography>
                  <WorkflowTracker workflow={selectedRequisition.workflow} />
                </Box>
              )}

              {/* Commentaires d'analyse */}
              {selectedRequisition.analyses && selectedRequisition.analyses.length > 0 && (
                <Box sx={{ mb: 3 }}>
                  <Typography variant="subtitle1" sx={{ mb: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Comment />
                    Commentaires d'analyse
                  </Typography>
                  {selectedRequisition.analyses.map((analysis: any, index: number) => (
                    <Card key={index} sx={{ mb: 2 }}>
                      <CardContent>
                        <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                          {new Date(analysis.analysis_date).toLocaleDateString()}
                        </Typography>
                        <Typography variant="body1" sx={{ mb: 1 }}>
                          {analysis.notes}
                        </Typography>
                        <Box sx={{ display: 'flex', gap: 1 }}>
                          <Chip 
                            label={`Note: ${analysis.rating}/5`}
                            size="small"
                            color="primary"
                          />
                          <Chip 
                            label={analysis.recommendation}
                            size="small"
                            variant="outlined"
                          />
                        </Box>
                      </CardContent>
                    </Card>
                  ))}
                </Box>
              )}

              {/* Pièces jointes */}
              {selectedRequisition.pieces_jointes && selectedRequisition.pieces_jointes.length > 0 && (
                <Box>
                  <Typography variant="subtitle1" sx={{ mb: 2 }}>
                    Pièces jointes
                  </Typography>
                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                    {selectedRequisition.pieces_jointes.map((file: string, index: number) => (
                      <Chip
                        key={index}
                        label={file}
                        size="small"
                        variant="outlined"
                      />
                    ))}
                  </Box>
                </Box>
              )}
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseDetailsDialog}>Fermer</Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
};

export default ProfilePage;
