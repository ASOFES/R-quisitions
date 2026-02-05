import React, { useState, useEffect } from 'react';
import {
  Container,
  Paper,
  TextField,
  Button,
  Typography,
  Box,
  Alert,
  CircularProgress,
  Divider,
  useTheme,
  alpha,
  Card,
  CardContent
} from '@mui/material';
import {
  LockOutlined,
  Business,
  Assignment,
  AccountBalance,
  People,
  Assessment,
  MonetizationOn,
  Security,
  Speed,
  VerifiedUser
} from '@mui/icons-material';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';
import { API_BASE_URL } from '../config';

const Login: React.FC = () => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const { login, isLoading } = useAuth();
  const theme = useTheme();

  useEffect(() => {
    const fetchLogo = async () => {
      try {
        const response = await api.get('/settings/logo');
        if (response.data.url) {
          setLogoUrl(`${API_BASE_URL}${response.data.url}`);
        }
      } catch (error) {
        console.error('Erreur chargement logo:', error);
      }
    };
    fetchLogo();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!username || !password) {
      setError('Veuillez remplir tous les champs');
      return;
    }

    try {
      await login(username, password);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Erreur de connexion');
    }
  };

  const roleIcons = {
    admin: <Business />,
    emetteur: <Assignment />,
    analyste: <Assessment />,
    challenger: <People />,
    validateur: <AccountBalance />,
    comptable: <MonetizationOn />,
  };

  return (
    <Box sx={{ height: '100vh', display: 'flex' }}>
      {/* Left Side - Branding */}
      <Box sx={{ 
        flex: 1, 
        bgcolor: 'primary.main', 
        display: { xs: 'none', md: 'flex' }, 
        flexDirection: 'column', 
        justifyContent: 'center', 
        alignItems: 'center', 
        p: 4,
        color: 'white',
        position: 'relative',
        overflow: 'hidden'
      }}>
        {/* Background Pattern */}
        <Box sx={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          opacity: 0.1,
          backgroundImage: 'radial-gradient(circle at 20% 20%, rgba(255,255,255,0.4) 0%, transparent 20%), radial-gradient(circle at 80% 80%, rgba(255,255,255,0.4) 0%, transparent 20%)',
          backgroundSize: '50% 50%'
        }} />

        <Box sx={{ position: 'relative', zIndex: 1, maxWidth: 400, textAlign: 'center' }}>
          <Box sx={{ 
            bgcolor: 'white', 
            color: 'primary.main', 
            p: logoUrl ? 1 : 2, 
            borderRadius: '50%', 
            display: 'inline-flex',
            mb: 3,
            boxShadow: theme.shadows[10],
            width: 100,
            height: 100,
            alignItems: 'center',
            justifyContent: 'center',
            overflow: 'hidden'
          }}>
            {logoUrl ? (
              <img 
                src={logoUrl} 
                alt="Logo" 
                style={{ 
                  width: '100%', 
                  height: '100%', 
                  objectFit: 'contain' 
                }} 
              />
            ) : (
              <LockOutlined sx={{ fontSize: 40 }} />
            )}
          </Box>
          <Typography variant="h3" fontWeight={800} gutterBottom>
            Requisitions Pro
          </Typography>
          <Typography variant="h6" sx={{ mb: 4, opacity: 0.9, fontWeight: 400 }}>
            La solution complète pour la gestion de vos demandes d'achats et de paiements.
          </Typography>
          
          <Box sx={{ display: 'flex', gap: 2, justifyContent: 'center' }}>
            <Box sx={{ textAlign: 'center' }}>
              <Security fontSize="large" sx={{ mb: 1, opacity: 0.8 }} />
              <Typography variant="body2">Sécurisé</Typography>
            </Box>
            <Box sx={{ textAlign: 'center' }}>
              <Speed fontSize="large" sx={{ mb: 1, opacity: 0.8 }} />
              <Typography variant="body2">Rapide</Typography>
            </Box>
            <Box sx={{ textAlign: 'center' }}>
              <VerifiedUser fontSize="large" sx={{ mb: 1, opacity: 0.8 }} />
              <Typography variant="body2">Fiable</Typography>
            </Box>
          </Box>
        </Box>
      </Box>

      {/* Right Side - Login Form */}
      <Box sx={{ 
        flex: 1, 
        display: 'flex', 
        flexDirection: 'column', 
        justifyContent: 'center', 
        alignItems: 'center', 
        p: 4,
        bgcolor: 'grey.50'
      }}>
        <Container maxWidth="sm">
          <Paper elevation={0} sx={{ p: 4, borderRadius: 3, border: '1px solid', borderColor: 'divider' }}>
            <Box sx={{ textAlign: 'center', mb: 4 }}>
              <Typography variant="h5" fontWeight={700} color="text.primary" gutterBottom>
                Bienvenue
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Connectez-vous à votre compte pour continuer
              </Typography>
            </Box>

            <Box component="form" onSubmit={handleSubmit} sx={{ mt: 1 }}>
              <TextField
                margin="normal"
                required
                fullWidth
                id="username"
                label="Nom d'utilisateur"
                name="username"
                autoComplete="username"
                autoFocus
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                disabled={isLoading}
                sx={{ mb: 2 }}
              />
              <TextField
                margin="normal"
                required
                fullWidth
                name="password"
                label="Mot de passe"
                type="password"
                id="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={isLoading}
                sx={{ mb: 3 }}
              />
              <Button
                type="submit"
                fullWidth
                variant="contained"
                size="large"
                sx={{ py: 1.5, fontWeight: 700 }}
                disabled={isLoading}
                startIcon={isLoading ? <CircularProgress size={20} color="inherit" /> : null}
              >
                {isLoading ? 'Connexion...' : 'Se connecter'}
              </Button>
            </Box>

            {error && (
              <Alert severity="error" sx={{ mt: 3, borderRadius: 2 }}>
                {error}
              </Alert>
            )}

            <Divider sx={{ my: 4 }}>
              <Typography variant="caption" color="text.secondary">
                COMPTES DE DÉMONSTRATION
              </Typography>
            </Divider>

            <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2 }}>
              {Object.entries({
                admin: { name: 'Administrateur', desc: 'Gestion complète' },
                'edla.m': { name: 'Initiateur', desc: 'Crée les demandes' },
                'chef.rh': { name: 'Chef de Service', desc: 'Approbation Chef' },
                'analyste.compta': { name: 'Analyste', desc: 'Validation Niv 1' },
                'compilateur': { name: 'Compilateur', desc: 'Prépare les paiements' },
                'pm.user': { name: 'Challenger', desc: 'Validation Niv 2' },
                'gm.user': { name: 'Validateur', desc: 'Validation Finale' },
                comptable: { name: 'Comptable', desc: 'Paiements' },
              }).map(([userKey, info]) => (
                <Card 
                  key={userKey} 
                  variant="outlined" 
                  sx={{ 
                    cursor: 'pointer', 
                    '&:hover': { borderColor: 'primary.main', bgcolor: alpha(theme.palette.primary.main, 0.02) },
                    transition: 'all 0.2s'
                  }}
                  onClick={() => {
                    setUsername(userKey);
                    setPassword('password123');
                  }}
                >
                  <CardContent sx={{ p: 1.5, '&:last-child': { pb: 1.5 }, display: 'flex', alignItems: 'center', gap: 1.5 }}>
                    <Box sx={{ color: 'text.secondary' }}>
                      {roleIcons[userKey as keyof typeof roleIcons]}
                    </Box>
                    <Box>
                      <Typography variant="subtitle2" fontWeight={700} sx={{ lineHeight: 1.2 }}>
                        {info.name}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {userKey}
                      </Typography>
                    </Box>
                  </CardContent>
                </Card>
              ))}
            </Box>
            
            <Typography variant="caption" display="block" textAlign="center" sx={{ mt: 3, color: 'text.secondary' }}>
              Mot de passe par défaut: <strong>password123</strong>
            </Typography>
          </Paper>
        </Container>
      </Box>
    </Box>
  );
};

export default Login;