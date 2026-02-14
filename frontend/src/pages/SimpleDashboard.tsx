import React, { useEffect, useState } from 'react';
import {
  Typography,
  Box,
  Card,
  CardContent,
  Avatar,
  Button,
  Grid,
  Paper,
  Divider,
  List,
  ListItem,
  ListItemButton,
  ListItemAvatar,
  ListItemText,
  ListItemIcon,
  useTheme,
  alpha,
  LinearProgress,
  CircularProgress,
  IconButton,
  Tooltip
} from '@mui/material';
import {
  Assignment,
  People,
  Business,
  TrendingUp,
  Warning,
  CheckCircle,
  HourglassEmpty,
  ArrowForward,
  Add,
  Notifications,
  LocalPrintshop
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import RequisitionService from '../services/RequisitionService';
import PushNotificationService from '../services/PushNotificationService';
import { API_BASE_URL } from '../config';
import api from '../services/api';

const SimpleDashboard: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const theme = useTheme();
  const [stats, setStats] = useState({
    totalRequisitions: 0,
    enCours: 0,
    validees: 0,
    urgentes: 0,
    totalUsers: 0,
    totalServices: 0,
  });
  const [recentActivity, setRecentActivity] = useState<any[]>([]);
  const [compilingPdf, setCompilingPdf] = useState(false);
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [checkingPush, setCheckingPush] = useState(true);

  useEffect(() => {
    checkPushSubscription();
  }, []);

  const checkPushSubscription = async () => {
    try {
      const subscribed = await PushNotificationService.isSubscribed();
      setIsSubscribed(subscribed);
    } catch (err) {
      console.error('Erreur check push:', err);
    } finally {
      setCheckingPush(false);
    }
  };

  const handleSubscribe = async () => {
    const result = await PushNotificationService.subscribeToNotifications();
    if (result.success) {
      setIsSubscribed(true);
      alert('Vous recevrez désormais des notifications système même si le navigateur est fermé !');
      
      // Lancer une notification de test immédiatement après l'abonnement
      try {
        await api.post('/notifications/test-me');
      } catch (err) {
        console.error('Erreur lors du test de notification:', err);
      }
    } else {
      alert(result.message || 'Impossible d\'activer les notifications. Vérifiez les paramètres de votre navigateur.');
    }
  };

  const handleTestNotification = async () => {
    try {
      await api.post('/notifications/test-me');
    } catch (err) {
      alert('Erreur lors de l\'envoi du test. Vérifiez si vous êtes bien abonné.');
    }
  };

  useEffect(() => {
    const calculateStats = (allRequisitions: any[]) => {
      let userRequisitions;
      if (user?.role === 'admin') {
        userRequisitions = allRequisitions;
      } else if (user?.role === 'analyste') {
        // Analyst sees almost everything (workflow levels)
        userRequisitions = allRequisitions.filter(req => 
          [
            'emetteur', 'analyste', 'challenger', 'validateur', 
            'gm', 'compilation', 'validation_bordereau', 
            'paiement', 'justificatif', 'termine'
          ].includes(req.niveau) || 
          (req.niveau === 'approbation_service' && req.service_chef_id === user?.id) ||
          req.statut === 'refusee'
        );
      } else if (user?.role === 'validateur' || user?.role === 'pm') {
        // PM sees their service only + specific levels
        userRequisitions = allRequisitions.filter(req => 
          (
            ['challenger', 'validateur', 'gm', 'paiement', 'justificatif', 'termine'].includes(req.niveau) || 
            (req.niveau === 'approbation_service' && req.service_chef_id === user?.id)
          ) && req.service_id === user?.service_id
        );
      } else if (user?.role === 'gm') {
        // GM sees GM levels + chef override
        userRequisitions = allRequisitions.filter(req => 
          ['gm', 'paiement', 'justificatif', 'termine'].includes(req.niveau) || 
          (req.niveau === 'approbation_service' && req.service_chef_id === user?.id) ||
          ['validee', 'payee', 'termine'].includes(req.statut)
        );
      } else {
        // Emetteur sees own + chef override
        userRequisitions = allRequisitions.filter(req => 
          req.emetteur_id === user?.id || 
          (req.niveau === 'approbation_service' && req.service_chef_id === user?.id)
        );
      }

      setStats({
        totalRequisitions: userRequisitions.length,
        enCours: userRequisitions.filter((r: any) => 
          ['en_cours', 'soumise'].includes(r.statut) || r.niveau === 'approbation_service'
        ).length,
        validees: userRequisitions.filter((r: any) => ['validee', 'payee', 'termine'].includes(r.statut)).length,
        urgentes: userRequisitions.filter((r: any) => r.urgence === 'critique' || r.urgence === 'haute').length,
        totalUsers: user?.role === 'admin' ? 15 : 0,
        totalServices: user?.role === 'admin' ? 8 : 0,
      });
    };

    const loadDashboardData = async () => {
      try {
        const token = localStorage.getItem('token');
        let allRequisitions = [];
        
        if (!token) {
          const requisitionService = RequisitionService.getInstance();
          allRequisitions = requisitionService.getAllRequisitions();
        } else {
          try {
            const response = await api.get('/requisitions');
            const data = response.data;

            if (Array.isArray(data)) {
              allRequisitions = data.map((req: any) => {
                if (req.statut === 'valide') req.statut = 'validee';
                if (req.statut === 'refuse') req.statut = 'refusee';
                return req;
              });
            } else {
              console.error('Format de données inattendu:', data);
              allRequisitions = [];
            }
          } catch (e) {
            console.error('Erreur chargement dashboard:', e);
            const requisitionService = RequisitionService.getInstance();
            allRequisitions = requisitionService.getAllRequisitions();
          }
        }

        calculateStats(allRequisitions);

        const sortedReqs = [...allRequisitions].sort((a, b) => 
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        ).slice(0, 5);
        
        setRecentActivity(sortedReqs);

      } catch (error) {
        console.error('Erreur:', error);
        const requisitionService = RequisitionService.getInstance();
        const allRequisitions = requisitionService.getAllRequisitions();
        calculateStats(allRequisitions);
      }
    };

    loadDashboardData();
  }, [user]);

  const handleCompilePdf = async () => {
    try {
      setCompilingPdf(true);
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_BASE_URL}/api/requisitions/compile/pdf`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `requisitions_compiled_${Date.now()}.pdf`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        window.URL.revokeObjectURL(url);
      } else {
        const err = await response.json();
        alert(err.message || 'Erreur lors de la génération du PDF');
      }
    } catch (error) {
      console.error('Erreur download PDF:', error);
      alert('Erreur lors du téléchargement du PDF compilé.');
    } finally {
      setCompilingPdf(false);
    }
  };



  const StatCard = ({ title, value, icon, color, subtitle }: any) => (
    <Card elevation={0} sx={{ 
      height: '100%', 
      borderRadius: 3,
      border: '1px solid',
      borderColor: alpha(color, 0.1),
      position: 'relative',
      overflow: 'hidden'
    }}>
      <Box sx={{ 
        position: 'absolute', 
        top: -20, 
        right: -20, 
        opacity: 0.1, 
        transform: 'rotate(-15deg)' 
      }}>
        {React.cloneElement(icon, { sx: { fontSize: 120, color: color } })}
      </Box>
      <CardContent sx={{ position: 'relative', zIndex: 1, p: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', mb: 2 }}>
          <Box sx={{ 
            p: 1.5, 
            borderRadius: 2, 
            bgcolor: alpha(color, 0.1), 
            color: color,
            display: 'flex'
          }}>
            {icon}
          </Box>
          {subtitle && (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, color: 'success.main', bgcolor: alpha(theme.palette.success.main, 0.1), px: 1, py: 0.5, borderRadius: 1 }}>
              <TrendingUp fontSize="small" />
              <Typography variant="caption" fontWeight="bold">{subtitle}</Typography>
            </Box>
          )}
        </Box>
        <Typography variant="h3" fontWeight={800} color="text.primary" sx={{ mb: 0.5 }}>
          {value}
        </Typography>
        <Typography variant="body2" color="text.secondary" fontWeight={600}>
          {title}
        </Typography>
      </CardContent>
    </Card>
  );

  const getProfilePath = () => {
    switch (user?.role) {
      case 'emetteur': return '/emitter-profile';
      case 'analyste': return '/analyst-profile';
      case 'validateur': return '/pm-profile';
      case 'gm': return '/gm-profile';
      case 'admin': return '/profile';
      default: return '/profile';
    }
  };

  return (
    <Box>
      {/* Welcome Section */}
      <Box sx={{ mb: 4, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 2 }}>
        <Box>
          <Typography variant="h4" fontWeight={800} color="text.primary" gutterBottom>
            Tableau de Bord
          </Typography>
          <Typography variant="body1" color="text.secondary">
            Bienvenue, <Box component="span" fontWeight="bold" color="primary.main">{user?.username}</Box>. Voici ce qui se passe aujourd'hui.
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', gap: 2 }}>
          <Button 
            variant="outlined" 
            startIcon={compilingPdf ? <CircularProgress size={20} /> : <LocalPrintshop />}
            onClick={handleCompilePdf}
            disabled={compilingPdf}
            sx={{ borderRadius: 2, px: 2 }}
          >
            {compilingPdf ? 'Compilation...' : 'Compiler PDF'}
          </Button>
          <Tooltip title={isSubscribed ? "Notifications actives (cliquez pour tester)" : "Activer les notifications système"}>
            <IconButton 
              color={isSubscribed ? "success" : "primary"}
              onClick={isSubscribed ? handleTestNotification : handleSubscribe}
              disabled={checkingPush}
              sx={{ 
                border: '1px solid',
                borderColor: isSubscribed ? 'success.light' : 'primary.light',
                borderRadius: 2,
                backgroundColor: isSubscribed ? 'success.50' : 'transparent',
                '&:hover': {
                  backgroundColor: isSubscribed ? 'success.100' : 'primary.50',
                }
              }}
            >
              <Notifications />
            </IconButton>
          </Tooltip>
          <Button 
            variant="contained" 
            startIcon={<Add />}
            onClick={() => navigate('/requisitions/new')}
            sx={{ borderRadius: 2, px: 3, boxShadow: theme.shadows[4] }}
          >
            Nouvelle Réquisition
          </Button>
        </Box>
      </Box>

      {/* Stats Grid */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <StatCard 
            title="Total Réquisitions" 
            value={stats.totalRequisitions} 
            icon={<Assignment />} 
            color={theme.palette.primary.main}
            subtitle="+12% cette semaine"
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <StatCard 
            title="En Cours" 
            value={stats.enCours} 
            icon={<HourglassEmpty />} 
            color={theme.palette.warning.main}
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <StatCard 
            title="Validées" 
            value={stats.validees} 
            icon={<CheckCircle />} 
            color={theme.palette.success.main}
            subtitle="Taux de 95%"
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <StatCard 
            title="Urgentes" 
            value={stats.urgentes} 
            icon={<Warning />} 
            color={theme.palette.error.main}
          />
        </Grid>
      </Grid>

      <Grid container spacing={3}>
        {/* Recent Activity */}
        <Grid size={{ xs: 12, md: 8 }}>
          <Paper elevation={0} sx={{ p: 0, borderRadius: 3, border: '1px solid', borderColor: 'divider', overflow: 'hidden', height: '100%' }}>
            <Box sx={{ p: 3, borderBottom: '1px solid', borderColor: 'divider', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Typography variant="h6" fontWeight={700}>
                Activité Récente
              </Typography>
              <Button endIcon={<ArrowForward />} onClick={() => navigate('/requisitions')} size="small">
                Voir tout
              </Button>
            </Box>
            <List sx={{ p: 0 }}>
              {recentActivity.map((req, index) => (
                <React.Fragment key={req.id}>
                  {index > 0 && <Divider />}
                  <ListItem disablePadding>
                    <ListItemButton onClick={() => navigate('/requisitions')} sx={{ py: 2, px: 3 }}>
                      <ListItemAvatar>
                        <Avatar sx={{ 
                          bgcolor: req.statut === 'validee' ? alpha(theme.palette.success.main, 0.1) : 
                                   req.statut === 'refusee' ? alpha(theme.palette.error.main, 0.1) : 
                                   alpha(theme.palette.primary.main, 0.1),
                          color: req.statut === 'validee' ? 'success.main' : 
                                 req.statut === 'refusee' ? 'error.main' : 
                                 'primary.main'
                        }}>
                          <Assignment fontSize="small" />
                        </Avatar>
                      </ListItemAvatar>
                      <ListItemText 
                        primary={
                          <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                            <Typography variant="subtitle2" fontWeight={700}>{req.objet}</Typography>
                            <Typography variant="caption" color="text.secondary">{new Date(req.created_at).toLocaleDateString()}</Typography>
                          </Box>
                        }
                        secondary={
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <Typography variant="caption" sx={{ 
                              bgcolor: 'grey.100', 
                              px: 1, 
                              borderRadius: 1, 
                              color: 'text.secondary',
                              fontWeight: 600 
                            }}>
                              {req.reference}
                            </Typography>
                             <Typography variant="caption" color="text.secondary">
                              • {req.emetteur_nom}
                            </Typography>
                          </Box>
                        }
                      />
                    </ListItemButton>
                  </ListItem>
                </React.Fragment>
              ))}
              {recentActivity.length === 0 && (
                <Box sx={{ p: 4, textAlign: 'center' }}>
                  <Typography color="text.secondary">Aucune activité récente</Typography>
                </Box>
              )}
            </List>
          </Paper>
        </Grid>

        {/* Quick Actions & Profile */}
        <Grid size={{ xs: 12, md: 4 }}>
          <Grid container spacing={3} direction="column">
            <Grid size={{ xs: 12 }}>
              <Paper elevation={0} sx={{ p: 3, borderRadius: 3, border: '1px solid', borderColor: 'divider', bgcolor: 'primary.main', color: 'white' }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 3 }}>
                  <Avatar sx={{ width: 60, height: 60, bgcolor: 'white', color: 'primary.main', fontWeight: 'bold', fontSize: '1.5rem' }}>
                    {user?.username?.[0]?.toUpperCase()}
                  </Avatar>
                  <Box>
                    <Typography variant="h6" fontWeight={700}>
                      {user?.username}
                    </Typography>
                    <Typography variant="body2" sx={{ opacity: 0.8, textTransform: 'capitalize' }}>
                      {user?.role}
                    </Typography>
                  </Box>
                </Box>
                <Box sx={{ mb: 2 }}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                    <Typography variant="caption" sx={{ opacity: 0.8 }}>Performance</Typography>
                    <Typography variant="caption" fontWeight="bold">85%</Typography>
                  </Box>
                  <LinearProgress variant="determinate" value={85} sx={{ bgcolor: 'rgba(255,255,255,0.2)', '& .MuiLinearProgress-bar': { bgcolor: 'white' } }} />
                </Box>
                <Button 
                  variant="contained" 
                  fullWidth 
                  sx={{ 
                    bgcolor: 'white', 
                    color: 'primary.main', 
                    '&:hover': { bgcolor: 'rgba(255,255,255,0.9)' },
                    fontWeight: 700
                  }}
                  onClick={() => navigate(getProfilePath())}
                >
                  Voir mon profil
                </Button>
              </Paper>
            </Grid>
            
            <Grid size={{ xs: 12 }}>
              <Paper elevation={0} sx={{ p: 3, borderRadius: 3, border: '1px solid', borderColor: 'divider' }}>
                <Typography variant="h6" fontWeight={700} gutterBottom>
                  Actions Rapides
                </Typography>
                <List dense>
                  {user?.role === 'admin' && (
                    <>
                      <ListItem disablePadding>
                        <ListItemButton onClick={() => navigate('/users')} sx={{ borderRadius: 2, mb: 1, border: '1px solid', borderColor: 'grey.200' }}>
                          <ListItemIcon><People color="primary" /></ListItemIcon>
                          <ListItemText primary="Gérer les utilisateurs" />
                        </ListItemButton>
                      </ListItem>
                      <ListItem disablePadding>
                        <ListItemButton onClick={() => navigate('/services')} sx={{ borderRadius: 2, mb: 1, border: '1px solid', borderColor: 'grey.200' }}>
                          <ListItemIcon><Business color="secondary" /></ListItemIcon>
                          <ListItemText primary="Gérer les services" />
                        </ListItemButton>
                      </ListItem>
                    </>
                  )}
                  <ListItem disablePadding>
                    <ListItemButton onClick={() => navigate('/requisitions/new')} sx={{ borderRadius: 2, mb: 1, border: '1px solid', borderColor: 'grey.200' }}>
                      <ListItemIcon><Add color="primary" /></ListItemIcon>
                      <ListItemText primary="Créer une réquisition" />
                    </ListItemButton>
                  </ListItem>
                  <ListItem disablePadding>
                    <ListItemButton onClick={() => navigate('/requisitions')} sx={{ borderRadius: 2, mb: 1, border: '1px solid', borderColor: 'grey.200' }}>
                      <ListItemIcon><Assignment color="action" /></ListItemIcon>
                      <ListItemText primary="Voir toutes les réquisitions" />
                    </ListItemButton>
                  </ListItem>
                </List>
              </Paper>
            </Grid>
          </Grid>
        </Grid>
      </Grid>
    </Box>
  );
};

export default SimpleDashboard;