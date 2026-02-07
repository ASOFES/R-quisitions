import React, { useState, useEffect } from 'react';
import {
  Container,
  Typography,
  Box,
  Paper,
  Button,
  Alert,
  CircularProgress,
  Divider,
  Grid,
  TextField,
  InputAdornment
} from '@mui/material';
import { CloudUpload, Save, Image as ImageIcon, Timer } from '@mui/icons-material';
import api from '../services/api';
import { API_BASE_URL } from '../config';

const SettingsPage: React.FC = () => {
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);
  
  // Workflow Settings State
  const [workflowSettings, setWorkflowSettings] = useState<{[key: string]: number}>({});
  const [loadingSettings, setLoadingSettings] = useState(false);
  const [savingSettings, setSavingSettings] = useState(false);

  // Exchange Rate State
  const [exchangeRate, setExchangeRate] = useState<number>(2800);
  const [loadingRate, setLoadingRate] = useState(false);
  const [savingRate, setSavingRate] = useState(false);

  useEffect(() => {
    fetchLogo();
    fetchWorkflowSettings();
    fetchExchangeRate();
  }, []);

  const fetchExchangeRate = async () => {
      try {
          setLoadingRate(true);
          const response = await api.get('/settings/exchange-rate');
          setExchangeRate(response.data.rate);
      } catch (error) {
          console.error('Erreur chargement taux:', error);
      } finally {
          setLoadingRate(false);
      }
  };

  const saveExchangeRate = async () => {
      try {
          setSavingRate(true);
          await api.post('/settings/exchange-rate', { rate: exchangeRate });
          setMessage({ type: 'success', text: 'Taux de change mis à jour avec succès.' });
      } catch (error) {
          console.error('Erreur sauvegarde taux:', error);
          setMessage({ type: 'error', text: 'Erreur lors de la mise à jour du taux.' });
      } finally {
          setSavingRate(false);
      }
  };

  const fetchLogo = async () => {
    try {
      setLoading(true);
      const response = await api.get('/settings/logo');
      if (response.data.url) {
        setLogoUrl(`${API_BASE_URL}${response.data.url}`);
      }
    } catch (error) {
      console.error('Erreur chargement logo:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchWorkflowSettings = async () => {
    try {
      setLoadingSettings(true);
      const response = await api.get('/settings/workflow');
      setWorkflowSettings(response.data || {});
    } catch (error) {
      console.error('Erreur chargement workflow settings:', error);
    } finally {
      setLoadingSettings(false);
    }
  };

  const handleWorkflowChange = (niveau: string, value: string) => {
    setWorkflowSettings(prev => ({
      ...prev,
      [niveau]: parseInt(value) || 0
    }));
  };

  const saveWorkflowSettings = async () => {
    try {
      setSavingSettings(true);
      await api.post('/settings/workflow', { settings: workflowSettings });
      setMessage({ type: 'success', text: 'Configuration des délais mise à jour avec succès.' });
    } catch (error) {
      console.error('Erreur sauvegarde workflow:', error);
      setMessage({ type: 'error', text: 'Erreur lors de la sauvegarde des délais.' });
    } finally {
      setSavingSettings(false);
    }
  };

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files && event.target.files[0]) {
      const file = event.target.files[0];
      setSelectedFile(file);
      
      // Créer un aperçu
      const reader = new FileReader();
      reader.onloadend = () => {
        setPreviewUrl(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleUpload = async () => {
    if (!selectedFile) return;

    try {
      setUploading(true);
      const formData = new FormData();
      formData.append('logo', selectedFile);

      const response = await api.post('/settings/logo', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      setLogoUrl(`http://localhost:5000${response.data.url}?t=${Date.now()}`);
      setMessage({ type: 'success', text: 'Logo mis à jour avec succès. Veuillez rafraîchir la page pour voir les changements partout.' });
      setSelectedFile(null);
      setPreviewUrl(null);
      
      // Forcer le rechargement de la page après un court délai pour mettre à jour le Layout
      setTimeout(() => {
        window.location.reload();
      }, 1500);
      
    } catch (error: any) {
      console.error('Erreur upload:', error);
      const errorMsg = error.response?.data?.error || error.message || 'Erreur lors de la mise à jour du logo.';
      setMessage({ type: 'error', text: errorMsg });
    } finally {
      setUploading(false);
    }
  };

  const workflowSteps = [
    { key: 'emetteur', label: 'Emetteur (Correction)' },
    { key: 'analyste', label: 'Analyste' },
    { key: 'challenger', label: 'Challenger' },
    { key: 'validateur', label: 'Validateur (PM)' },
    { key: 'gm', label: 'General Manager' }
    // Comptable exclu (sécurité)
  ];

  return (
    <Container maxWidth="md" sx={{ mt: 4, mb: 4 }}>
      <Typography variant="h4" gutterBottom sx={{ color: 'primary.main', fontWeight: 'bold' }}>
        Paramètres de l'application
      </Typography>

      {message && (
        <Alert severity={message.type} sx={{ mb: 3 }} onClose={() => setMessage(null)}>
          {message.text}
        </Alert>
      )}

      {/* Exchange Rate Section */}
      <Paper sx={{ p: 3, mb: 4 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
            <Typography variant="h6">
            Configuration Financière
            </Typography>
        </Box>
        <Divider sx={{ mb: 3 }} />
        
        {loadingRate ? (
            <CircularProgress />
        ) : (
            <Grid container spacing={3} alignItems="center">
                <Grid size={{ xs: 12, sm: 6 }}>
                    <TextField
                        label="Taux de Change (USD -> CDF)"
                        type="number"
                        fullWidth
                        value={exchangeRate}
                        onChange={(e) => setExchangeRate(parseFloat(e.target.value))}
                        InputProps={{
                            startAdornment: <InputAdornment position="start">1 USD =</InputAdornment>,
                            endAdornment: <InputAdornment position="end">CDF</InputAdornment>,
                        }}
                    />
                </Grid>
                <Grid size={{ xs: 12, sm: 6 }}>
                    <Button 
                        variant="contained" 
                        onClick={saveExchangeRate}
                        disabled={savingRate}
                        startIcon={<Save />}
                    >
                        {savingRate ? 'Sauvegarde...' : 'Mettre à jour le taux'}
                    </Button>
                </Grid>
            </Grid>
        )}
      </Paper>

      {/* Workflow Settings Section */}
      <Paper sx={{ p: 3, mb: 4 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
            <Timer sx={{ mr: 1, color: 'secondary.main' }} />
            <Typography variant="h6">
            Délais de Validation Automatique
            </Typography>
        </Box>
        <Divider sx={{ mb: 3 }} />
        
        <Typography variant="body2" color="text.secondary" paragraph>
            Définissez le temps maximum (en minutes) qu'une réquisition peut rester à un niveau avant d'être validée automatiquement.
            Mettez 0 pour désactiver l'auto-validation pour un niveau spécifique.
        </Typography>

        {loadingSettings ? (
            <CircularProgress />
        ) : (
            <Grid container spacing={3}>
                {workflowSteps.map((step) => (
                    <Grid size={{ xs: 12, sm: 6, md: 4 }} key={step.key}>
                        <TextField
                            label={step.label}
                            type="number"
                            fullWidth
                            value={workflowSettings[step.key] || 0}
                            onChange={(e) => handleWorkflowChange(step.key, e.target.value)}
                            InputProps={{
                                endAdornment: <InputAdornment position="end">min</InputAdornment>,
                            }}
                            helperText={workflowSettings[step.key] > 0 ? `${(workflowSettings[step.key] / 60).toFixed(1)} heures` : 'Désactivé'}
                        />
                    </Grid>
                ))}
                <Grid size={{ xs: 12 }}>
                    <Button 
                        variant="contained" 
                        color="secondary" 
                        startIcon={<Save />}
                        onClick={saveWorkflowSettings}
                        disabled={savingSettings}
                    >
                        {savingSettings ? 'Sauvegarde...' : 'Enregistrer les délais'}
                    </Button>
                </Grid>
            </Grid>
        )}
      </Paper>

      <Paper sx={{ p: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
            <ImageIcon sx={{ mr: 1, color: 'primary.main' }} />
            <Typography variant="h6">
            Personnalisation du Logo
            </Typography>
        </Box>
        <Divider sx={{ mb: 3 }} />

        <Box sx={{ mb: 4 }}>
          <Typography variant="subtitle1" gutterBottom fontWeight="bold">
            Logo de l'application
          </Typography>
          <Typography variant="body2" color="text.secondary" paragraph>
            Ce logo s'affichera dans la barre de navigation et sur les documents officiels.
            Format recommandé : PNG ou JPG, fond transparent préférable.
          </Typography>

          <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3, my: 3 }}>
            <Box 
              sx={{ 
                width: 200, 
                height: 200, 
                border: '2px dashed #ccc', 
                borderRadius: '50%', // Circle to match app style
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'center',
                overflow: 'hidden',
                bgcolor: 'white', // White background as requested
                position: 'relative',
                boxShadow: 3
              }}
            >
              {loading ? (
                <CircularProgress />
              ) : (previewUrl || logoUrl) ? (
                <img 
                  src={previewUrl || logoUrl || ''} 
                  alt="Logo Preview" 
                  style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} 
                />
              ) : (
                <Box sx={{ textAlign: 'center', color: 'text.secondary' }}>
                  <ImageIcon sx={{ fontSize: 48, mb: 1, opacity: 0.5 }} />
                  <Typography variant="body2">Aucun logo</Typography>
                </Box>
              )}
            </Box>

            <Box sx={{ display: 'flex', gap: 2 }}>
              <Button
                variant="outlined"
                component="label"
                startIcon={<CloudUpload />}
              >
                Choisir un fichier
                <input
                  type="file"
                  hidden
                  accept="image/*"
                  onChange={handleFileSelect}
                />
              </Button>

              <Button
                variant="contained"
                onClick={handleUpload}
                disabled={!selectedFile || uploading}
                startIcon={uploading ? <CircularProgress size={20} color="inherit" /> : <Save />}
              >
                {uploading ? 'Enregistrement...' : 'Enregistrer'}
              </Button>
            </Box>
          </Box>
        </Box>

        {message && (
          <Alert severity={message.type} sx={{ mt: 2 }} onClose={() => setMessage(null)}>
            {message.text}
          </Alert>
        )}
      </Paper>
    </Container>
  );
};

export default SettingsPage;
