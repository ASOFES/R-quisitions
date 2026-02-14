import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { API_BASE_URL } from '../config';
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
  Lock,
  Draw,
} from '@mui/icons-material';
import RequisitionService from '../services/RequisitionService';
import { useAuth } from '../context/AuthContext';

interface UserProfile {
  id: number;
  username: string;
  email: string;
  nom_complet: string;
  role: string;
  service_nom: string;
  service_id: number;
  zone_nom: string;
  zone_id: number;
  created_at: string;
  signature_url?: string;
  // Stats
  total_requisitions?: number;
  requisitions_en_cours?: number;
  requisitions_validees?: number;
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
  
  // Password Change
  const [openPasswordDialog, setOpenPasswordDialog] = useState(false);
  const [passwordData, setPasswordData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  });

  // Signature
  const [signatureFile, setSignatureFile] = useState<File | null>(null);
  const [signaturePreview, setSignaturePreview] = useState<string | null>(null);

  useEffect(() => {
    if (user) {
      loadProfileData();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const loadProfileData = async () => {
    try {
      const token = localStorage.getItem('token');
      if (!token) return;

      // 1. Fetch Profile
      const profileRes = await fetch(`${API_BASE_URL}/api/profile`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (!profileRes.ok) throw new Error('Erreur chargement profil');
      const profileData = await profileRes.json();

      // 2. Fetch Requisitions Stats (reuse existing logic or fetch separately)
      // For now we will just use the requisitions endpoint to calculate stats
      const reqRes = await fetch(`${API_BASE_URL}/api/requisitions`, {
         headers: { 'Authorization': `Bearer ${token}` }
      });

      let stats = {
          total_requisitions: 0,
          requisitions_en_cours: 0,
          requisitions_validees: 0
      };
      let recentReqs: RequisitionSummary[] = [];

      if (reqRes.ok) {
          const reqData = await reqRes.json();
          // Filter own requisitions
          const myReqs = reqData.filter((r: any) => r.emetteur_id === profileData.id);
          
          stats = {
              total_requisitions: myReqs.length,
              requisitions_en_cours: myReqs.filter((r: any) => ['en_cours', 'soumise', 'analyste', 'validateur', 'finance', 'tresorerie', 'dg'].includes(r.statut)).length,
              requisitions_validees: myReqs.filter((r: any) => r.statut === 'validee' || r.statut === 'payee' || r.statut === 'terminee').length
          };

          recentReqs = myReqs
            .sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
            .slice(0, 5)
            .map((req: any) => ({
                id: req.id,
                reference: req.numero,
                objet: req.objet,
                montant: req.montant_usd || req.montant_cdf,
                devise: req.montant_usd ? 'USD' : 'CDF',
                statut: req.statut,
                urgence: 'normale', // Default
                created_at: req.created_at,
                nb_pieces: req.nb_pieces || 0
            }));
      }

      setProfile({ ...profileData, ...stats });
      setRecentRequisitions(recentReqs);
      setFormData({
          nom_complet: profileData.nom_complet,
          email: profileData.email
      });
      
      if (profileData.signature_url) {
          // Adjust URL if relative
          setSignaturePreview(profileData.signature_url.startsWith('http') ? profileData.signature_url : `${API_BASE_URL}${profileData.signature_url}`);
      }

    } catch (error) {
      console.error('Erreur:', error);
      setAlert({ type: 'error', message: 'Impossible de charger le profil' });
    } finally {
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
        nom_complet: profile.nom_complet,
        email: profile.email
      });
      setSignatureFile(null);
      // Restore original signature preview
      if (profile.signature_url) {
          setSignaturePreview(profile.signature_url.startsWith('http') ? profile.signature_url : `${API_BASE_URL}${profile.signature_url}`);
      } else {
          setSignaturePreview(null);
      }
    }
  };

  const handleSignatureChange = (event: React.ChangeEvent<HTMLInputElement>) => {
      if (event.target.files && event.target.files[0]) {
          const file = event.target.files[0];
          setSignatureFile(file);
          
          // Create preview
          const reader = new FileReader();
          reader.onloadend = () => {
              setSignaturePreview(reader.result as string);
          };
          reader.readAsDataURL(file);
      }
  };

  const handleSave = async () => {
    try {
      const token = localStorage.getItem('token');
      if (!token) return;

      // 1. Update basic info
      const res = await fetch(`${API_BASE_URL}/api/profile`, {
          method: 'PUT',
          headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify(formData)
      });

      if (!res.ok) {
          const err = await res.json();
          throw new Error(err.error || 'Erreur mise à jour profil');
      }

      // 2. Upload signature if changed
      if (signatureFile) {
          const formData = new FormData();
          formData.append('signature', signatureFile);

          const sigRes = await fetch(`${API_BASE_URL}/api/profile/signature`, {
              method: 'POST',
              headers: {
                  'Authorization': `Bearer ${token}`
              },
              body: formData
          });

          if (!sigRes.ok) {
               const err = await sigRes.json();
               throw new Error(err.error || 'Erreur upload signature');
          }
      }

      setAlert({ type: 'success', message: 'Profil mis à jour avec succès' });
      setEditMode(false);
      setSignatureFile(null);
      loadProfileData(); // Reload to get fresh data

    } catch (error: any) {
      console.error('Erreur sauvegarde:', error);
      setAlert({ type: 'error', message: error.message });
    }
  };

  const handlePasswordChange = async () => {
      if (passwordData.newPassword !== passwordData.confirmPassword) {
          setAlert({ type: 'error', message: 'Les nouveaux mots de passe ne correspondent pas' });
          return;
      }

      try {
          const token = localStorage.getItem('token');
          const res = await fetch(`${API_BASE_URL}/api/profile`, {
              method: 'PUT',
              headers: {
                  'Content-Type': 'application/json',
                  'Authorization': `Bearer ${token}`
              },
              body: JSON.stringify({
                  password: passwordData.currentPassword,
                  new_password: passwordData.newPassword
              })
          });

          if (!res.ok) {
              const err = await res.json();
              throw new Error(err.error || 'Erreur changement mot de passe');
          }

          setAlert({ type: 'success', message: 'Mot de passe modifié avec succès' });
          setOpenPasswordDialog(false);
          setPasswordData({ currentPassword: '', newPassword: '', confirmPassword: '' });

      } catch (error: any) {
          setAlert({ type: 'error', message: error.message });
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
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 4 }}>
        <Box sx={{ display: 'flex', alignItems: 'center' }}>
          <Button onClick={() => navigate('/dashboard')} startIcon={<ArrowBack />} sx={{ mr: 2 }}>
            Tableau de bord
          </Button>
          <Typography variant="h4" fontWeight="bold">Paramètres du Compte</Typography>
        </Box>
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
            <CardContent>
              <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', mb: 3 }}>
                <Avatar 
                  sx={{ width: 100, height: 100, mb: 2, bgcolor: 'primary.main', fontSize: 40 }}
                >
                  {profile?.username?.charAt(0).toUpperCase()}
                </Avatar>
                <Typography variant="h5" gutterBottom>
                  {profile?.nom_complet || profile?.username}
                </Typography>
                <Chip 
                  label={profile?.role?.toUpperCase()} 
                  color="primary" 
                  variant="outlined" 
                  size="small"
                />
              </Box>

              <Divider sx={{ mb: 2 }} />

              <List>
                <ListItem>
                  <ListItemIcon><Person /></ListItemIcon>
                  {editMode ? (
                      <TextField 
                        fullWidth 
                        label="Nom Complet" 
                        value={formData.nom_complet || ''}
                        onChange={(e) => setFormData({...formData, nom_complet: e.target.value})}
                      />
                  ) : (
                      <ListItemText primary="Nom Complet" secondary={profile?.nom_complet} />
                  )}
                </ListItem>
                <ListItem>
                  <ListItemIcon><Email /></ListItemIcon>
                  {editMode ? (
                      <TextField 
                        fullWidth 
                        label="Email" 
                        value={formData.email || ''}
                        onChange={(e) => setFormData({...formData, email: e.target.value})}
                      />
                  ) : (
                      <ListItemText primary="Email" secondary={profile?.email} />
                  )}
                </ListItem>
                <ListItem>
                  <ListItemIcon><Business /></ListItemIcon>
                  <ListItemText primary="Service" secondary={profile?.service_nom || 'N/A'} />
                </ListItem>
                <ListItem>
                  <ListItemIcon><Work /></ListItemIcon>
                  <ListItemText primary="Zone" secondary={profile?.zone_nom || 'N/A'} />
                </ListItem>
              </List>

              <Box sx={{ mt: 2, display: 'flex', gap: 1 }}>
                  {!editMode ? (
                      <>
                        <Button 
                            variant="outlined" 
                            startIcon={<Edit />} 
                            fullWidth
                            onClick={handleEdit}
                        >
                            Modifier
                        </Button>
                        <Button 
                            variant="outlined" 
                            color="secondary"
                            startIcon={<Lock />} 
                            fullWidth
                            onClick={() => setOpenPasswordDialog(true)}
                        >
                            Mot de passe
                        </Button>
                      </>
                  ) : (
                      <>
                        <Button 
                            variant="contained" 
                            startIcon={<Save />} 
                            fullWidth
                            onClick={handleSave}
                        >
                            Enregistrer
                        </Button>
                        <Button 
                            variant="outlined" 
                            color="error"
                            startIcon={<Cancel />} 
                            fullWidth
                            onClick={handleCancel}
                        >
                            Annuler
                        </Button>
                      </>
                  )}
              </Box>
            </CardContent>
          </Card>
        </Box>

        {/* Signature et Stats */}
        <Box sx={{ flex: '1', minWidth: 300 }}>
             {/* Signature Section */}
             <Card sx={{ mb: 3 }}>
                 <CardContent>
                     <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                        <Typography variant="h6">Ma Signature</Typography>
                        <Draw color="action" />
                     </Box>
                     <Divider sx={{ mb: 2 }} />
                     
                     <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', p: 2, border: '1px dashed #ccc', borderRadius: 1 }}>
                         {signaturePreview ? (
                             <img 
                                src={signaturePreview} 
                                alt="Signature" 
                                style={{ maxWidth: '100%', maxHeight: 150, objectFit: 'contain' }} 
                             />
                         ) : (
                             <Typography color="text.secondary">Aucune signature configurée</Typography>
                         )}
                     </Box>

                     {editMode && (
                         <Box sx={{ mt: 2 }}>
                             <Button
                                variant="contained"
                                component="label"
                                startIcon={<AttachFile />}
                                fullWidth
                             >
                                 Téléverser une image
                                 <input
                                    type="file"
                                    hidden
                                    accept="image/*"
                                    onChange={handleSignatureChange}
                                 />
                             </Button>
                             <Typography variant="caption" display="block" sx={{ mt: 1, textAlign: 'center' }}>
                                 Format: PNG, JPG (Fond transparent recommandé)
                             </Typography>
                         </Box>
                     )}
                 </CardContent>
             </Card>

             {/* Stats Section */}
             <Card>
                <CardContent>
                  <Typography variant="h6" gutterBottom>Statistiques</Typography>
                  <Divider sx={{ mb: 2 }} />
                  <List>
                    <ListItem>
                      <ListItemIcon><Assignment /></ListItemIcon>
                      <ListItemText 
                        primary="Total Réquisitions" 
                        secondary={profile?.total_requisitions || 0} 
                      />
                    </ListItem>
                    <ListItem>
                      <ListItemIcon><Timeline /></ListItemIcon>
                      <ListItemText 
                        primary="En cours" 
                        secondary={profile?.requisitions_en_cours || 0} 
                      />
                    </ListItem>
                    <ListItem>
                      <ListItemIcon><Work /></ListItemIcon>
                      <ListItemText 
                        primary="Validées / Terminées" 
                        secondary={profile?.requisitions_validees || 0} 
                      />
                    </ListItem>
                  </List>
                </CardContent>
              </Card>
        </Box>
      </Box>

      {/* Dialog Changement Mot de passe */}
      <Dialog open={openPasswordDialog} onClose={() => setOpenPasswordDialog(false)}>
          <DialogTitle>Modifier le mot de passe</DialogTitle>
          <DialogContent>
              <TextField
                  margin="dense"
                  label="Mot de passe actuel"
                  type="password"
                  fullWidth
                  variant="outlined"
                  value={passwordData.currentPassword}
                  onChange={(e) => setPasswordData({...passwordData, currentPassword: e.target.value})}
              />
              <TextField
                  margin="dense"
                  label="Nouveau mot de passe"
                  type="password"
                  fullWidth
                  variant="outlined"
                  value={passwordData.newPassword}
                  onChange={(e) => setPasswordData({...passwordData, newPassword: e.target.value})}
              />
              <TextField
                  margin="dense"
                  label="Confirmer le nouveau mot de passe"
                  type="password"
                  fullWidth
                  variant="outlined"
                  value={passwordData.confirmPassword}
                  onChange={(e) => setPasswordData({...passwordData, confirmPassword: e.target.value})}
              />
          </DialogContent>
          <DialogActions>
              <Button onClick={() => setOpenPasswordDialog(false)}>Annuler</Button>
              <Button onClick={handlePasswordChange} variant="contained">Enregistrer</Button>
          </DialogActions>
      </Dialog>
    </Container>
  );
};

export default ProfilePage;
