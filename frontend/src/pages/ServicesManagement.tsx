import React, { useState, useEffect } from 'react';
import {
  Typography,
  Box,
  Button,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Chip,
  Alert,
  CircularProgress,
  useTheme,
  alpha,
  Tooltip,
  Switch,
  TablePagination
} from '@mui/material';
import {
  Add,
  Edit,
  Delete,
  Business,
  Search,
  CheckCircle,
  Cancel
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { servicesAPI } from '../services/api';
import { Service } from '../services/api';

const ServicesManagement: React.FC = () => {
  const navigate = useNavigate();
  const theme = useTheme();
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);
  const [openDialog, setOpenDialog] = useState(false);
  const [editingService, setEditingService] = useState<Service | null>(null);
  const [formData, setFormData] = useState({
    code: '',
    nom: '',
    description: '',
    actif: true,
  });
  const [alert, setAlert] = useState<{ type: 'success' | 'error', message: string } | null>(null);

  // Pagination state
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);

  useEffect(() => {
    loadServices();
  }, []);

  const loadServices = async () => {
    try {
      setLoading(true);
      const servicesData = await servicesAPI.getAll();
      setServices(servicesData);
    } catch (error) {
      console.error('Erreur lors du chargement des services:', error);
      setAlert({ type: 'error', message: 'Erreur lors du chargement des services' });
    } finally {
      setLoading(false);
    }
  };

  const handleOpenDialog = (service?: Service) => {
    if (service) {
      setEditingService(service);
      setFormData({
        code: service.code,
        nom: service.nom,
        description: service.description || '',
        actif: service.actif,
      });
    } else {
      setEditingService(null);
      setFormData({
        code: '',
        nom: '',
        description: '',
        actif: true,
      });
    }
    setOpenDialog(true);
  };

  const handleCloseDialog = () => {
    setOpenDialog(false);
    setEditingService(null);
    setFormData({
      code: '',
      nom: '',
      description: '',
      actif: true,
    });
  };

  const handleSubmit = async () => {
    try {
      if (editingService) {
        await servicesAPI.update(editingService.id, formData);
        setAlert({ type: 'success', message: 'Service mis à jour avec succès' });
      } else {
        await servicesAPI.create(formData);
        setAlert({ type: 'success', message: 'Service créé avec succès' });
      }
      handleCloseDialog();
      loadServices();
    } catch (error: any) {
      console.error('Erreur lors de la sauvegarde:', error);
      setAlert({ 
        type: 'error', 
        message: `Erreur: ${error.response?.data?.error || error.message || 'Erreur inconnue'}` 
      });
    }
  };

  const handleDelete = async (serviceId: number) => {
    if (window.confirm('Êtes-vous sûr de vouloir supprimer ce service ?')) {
      try {
        await servicesAPI.delete(serviceId);
        setAlert({ type: 'success', message: 'Service supprimé avec succès' });
        loadServices();
      } catch (error) {
        console.error('Erreur lors de la suppression:', error);
        setAlert({ type: 'error', message: 'Erreur lors de la suppression' });
      }
    }
  };

  const handleToggleActive = async (service: Service) => {
    try {
      await servicesAPI.update(service.id, { ...service, actif: !service.actif });
      setAlert({ 
        type: 'success', 
        message: `Service ${!service.actif ? 'activé' : 'désactivé'} avec succès` 
      });
      loadServices();
    } catch (error) {
      console.error('Erreur lors du changement de statut:', error);
      setAlert({ type: 'error', message: 'Erreur lors du changement de statut' });
    }
  };

  const handleChangePage = (event: unknown, newPage: number) => {
    setPage(newPage);
  };

  const handleChangeRowsPerPage = (event: React.ChangeEvent<HTMLInputElement>) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', mt: 8 }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box>
      {/* En-tête */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 4 }}>
        <Box>
          <Typography variant="h4" fontWeight={800} gutterBottom>
            Gestion des services
          </Typography>
          <Typography variant="body1" color="text.secondary">
            Configurez les départements et services de l'entreprise.
          </Typography>
        </Box>
        <Button
          variant="contained"
          startIcon={<Add />}
          onClick={() => handleOpenDialog()}
          sx={{ borderRadius: 2, px: 3, py: 1, boxShadow: theme.shadows[4] }}
        >
          Ajouter un service
        </Button>
      </Box>

      {/* Alert */}
      {alert && (
        <Alert 
          severity={alert.type} 
          sx={{ mb: 3, borderRadius: 2 }}
          onClose={() => setAlert(null)}
        >
          {alert.message}
        </Alert>
      )}

      {/* Tableau des services */}
      <Paper elevation={0} sx={{ borderRadius: 3, border: '1px solid', borderColor: 'divider', overflow: 'hidden' }}>
        <TableContainer>
          <Table>
            <TableHead sx={{ bgcolor: 'grey.50' }}>
              <TableRow>
                <TableCell sx={{ fontWeight: 700 }}>Code</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>Nom</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>Description</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>Statut</TableCell>
                <TableCell align="right" sx={{ fontWeight: 700 }}>Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {services
                .slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage)
                .map((service) => (
                <TableRow key={service.id} hover>
                  <TableCell>
                    <Chip 
                      label={service.code} 
                      size="small" 
                      sx={{ 
                        fontWeight: 700, 
                        bgcolor: alpha(theme.palette.primary.main, 0.1), 
                        color: 'primary.main',
                        borderRadius: 1
                      }} 
                    />
                  </TableCell>
                  <TableCell>
                    <Typography variant="subtitle2" fontWeight={600}>
                      {service.nom}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2" color="text.secondary" sx={{ maxWidth: 300, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {service.description || '-'}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Chip
                      icon={service.actif ? <CheckCircle fontSize="small" /> : <Cancel fontSize="small" />}
                      label={service.actif ? 'Actif' : 'Inactif'}
                      color={service.actif ? 'success' : 'default'}
                      size="small"
                      variant={service.actif ? 'filled' : 'outlined'}
                      sx={{ fontWeight: 600 }}
                    />
                  </TableCell>
                  <TableCell align="right">
                    <Tooltip title={service.actif ? "Désactiver" : "Activer"}>
                      <Switch
                        checked={service.actif}
                        onChange={() => handleToggleActive(service)}
                        color="success"
                        size="small"
                      />
                    </Tooltip>
                    <Tooltip title="Modifier">
                      <IconButton onClick={() => handleOpenDialog(service)} color="primary" size="small">
                        <Edit fontSize="small" />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="Supprimer">
                      <IconButton onClick={() => handleDelete(service.id)} color="error" size="small">
                        <Delete fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  </TableCell>
                </TableRow>
              ))}
              {services.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} align="center" sx={{ py: 4 }}>
                    <Typography color="text.secondary">Aucun service trouvé</Typography>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>
        <TablePagination
          rowsPerPageOptions={[5, 10, 25, 50]}
          component="div"
          count={services.length}
          rowsPerPage={rowsPerPage}
          page={page}
          onPageChange={handleChangePage}
          onRowsPerPageChange={handleChangeRowsPerPage}
          labelRowsPerPage="Lignes par page"
          labelDisplayedRows={({ from, to, count }) => `${from}-${to} sur ${count}`}
        />
      </Paper>

      <Dialog open={openDialog} onClose={handleCloseDialog} maxWidth="sm" fullWidth PaperProps={{ sx: { borderRadius: 3 } }}>
        <DialogTitle sx={{ fontWeight: 700, borderBottom: '1px solid', borderColor: 'divider' }}>
          {editingService ? 'Modifier le service' : 'Nouveau service'}
        </DialogTitle>
        <DialogContent sx={{ pt: 3 }}>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
            <TextField
              label="Code"
              value={formData.code}
              onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
              fullWidth
              variant="outlined"
              helperText="Code unique (ex: IT, HR, FIN)"
            />
            <TextField
              label="Nom"
              value={formData.nom}
              onChange={(e) => setFormData({ ...formData, nom: e.target.value })}
              fullWidth
              variant="outlined"
            />
            <TextField
              label="Description"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              fullWidth
              multiline
              rows={3}
              variant="outlined"
            />
          </Box>
        </DialogContent>
        <DialogActions sx={{ p: 2.5, borderTop: '1px solid', borderColor: 'divider' }}>
          <Button onClick={handleCloseDialog} color="inherit">
            Annuler
          </Button>
          <Button onClick={handleSubmit} variant="contained" sx={{ px: 3, borderRadius: 2 }}>
            Enregistrer
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default ServicesManagement;