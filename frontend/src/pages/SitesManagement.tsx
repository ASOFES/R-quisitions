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
  Search,
  CheckCircle,
  Cancel,
  Place
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { sitesAPI, Site } from '../services/api';

const SitesManagement: React.FC = () => {
  const navigate = useNavigate();
  const theme = useTheme();
  const [sites, setSites] = useState<Site[]>([]);
  const [loading, setLoading] = useState(true);
  const [openDialog, setOpenDialog] = useState(false);
  const [editingSite, setEditingSite] = useState<Site | null>(null);
  const [formData, setFormData] = useState({
    nom: '',
    description: '',
    actif: true,
  });
  const [alert, setAlert] = useState<{ type: 'success' | 'error', message: string } | null>(null);

  // Pagination state
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);

  useEffect(() => {
    loadSites();
  }, []);

  const loadSites = async () => {
    try {
      setLoading(true);
      const sitesData = await sitesAPI.getAll();
      setSites(sitesData);
    } catch (error) {
      console.error('Erreur lors du chargement des sites:', error);
      setAlert({ type: 'error', message: 'Erreur lors du chargement des sites' });
    } finally {
      setLoading(false);
    }
  };

  const handleOpenDialog = (site?: Site) => {
    if (site) {
      setEditingSite(site);
      setFormData({
        nom: site.nom,
        description: site.description || '',
        actif: site.actif,
      });
    } else {
      setEditingSite(null);
      setFormData({
        nom: '',
        description: '',
        actif: true,
      });
    }
    setOpenDialog(true);
  };

  const handleCloseDialog = () => {
    setOpenDialog(false);
    setEditingSite(null);
    setFormData({
      nom: '',
      description: '',
      actif: true,
    });
  };

  const handleSubmit = async () => {
    try {
      if (editingSite) {
        await sitesAPI.update(editingSite.id, formData);
        setAlert({ type: 'success', message: 'Site mis à jour avec succès' });
      } else {
        await sitesAPI.create(formData);
        setAlert({ type: 'success', message: 'Site créé avec succès' });
      }
      handleCloseDialog();
      loadSites();
    } catch (error: any) {
      console.error('Erreur lors de la sauvegarde:', error);
      setAlert({ 
        type: 'error', 
        message: `Erreur: ${error.response?.data?.error || error.message || 'Erreur inconnue'}` 
      });
    }
  };

  const handleDelete = async (siteId: number) => {
    if (window.confirm('Êtes-vous sûr de vouloir supprimer ce site ?')) {
      try {
        const response = await sitesAPI.delete(siteId);
        // @ts-ignore
        const msg = response.message || 'Site supprimé avec succès';
        setAlert({ type: 'success', message: msg });
        setSites((prev) => prev.filter((s) => s.id !== siteId));
        loadSites();
      } catch (error) {
        console.error('Erreur lors de la suppression:', error);
        setAlert({ type: 'error', message: 'Erreur lors de la suppression' });
      }
    }
  };

  const handleToggleActive = async (site: Site) => {
    try {
      await sitesAPI.update(site.id, { ...site, actif: !site.actif });
      setAlert({ 
        type: 'success', 
        message: `Site ${!site.actif ? 'activé' : 'désactivé'} avec succès` 
      });
      loadSites();
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
            Gestion des sites
          </Typography>
          <Typography variant="body1" color="text.secondary">
            Gérez les différents sites de l'entreprise.
          </Typography>
        </Box>
        <Button
          variant="contained"
          startIcon={<Add />}
          onClick={() => handleOpenDialog()}
          sx={{ borderRadius: 2, px: 3, py: 1, boxShadow: theme.shadows[4] }}
        >
          Ajouter un site
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

      {/* Tableau des sites */}
      <Paper elevation={0} sx={{ borderRadius: 3, border: '1px solid', borderColor: 'divider', overflow: 'hidden' }}>
        <TableContainer>
          <Table>
            <TableHead sx={{ bgcolor: 'grey.50' }}>
              <TableRow>
                <TableCell sx={{ fontWeight: 700 }}>Nom</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>Description</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>Statut</TableCell>
                <TableCell align="right" sx={{ fontWeight: 700 }}>Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {sites
                .slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage)
                .map((site) => (
                <TableRow key={site.id} hover>
                  <TableCell>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Place sx={{ color: 'primary.main', fontSize: 20 }} />
                      <Typography variant="subtitle2" fontWeight={600}>
                        {site.nom}
                      </Typography>
                    </Box>
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2" color="text.secondary" sx={{ maxWidth: 300, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {site.description || '-'}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Chip
                      icon={site.actif ? <CheckCircle fontSize="small" /> : <Cancel fontSize="small" />}
                      label={site.actif ? 'Actif' : 'Inactif'}
                      color={site.actif ? 'success' : 'default'}
                      size="small"
                      variant={site.actif ? 'filled' : 'outlined'}
                      sx={{ fontWeight: 600 }}
                    />
                  </TableCell>
                  <TableCell align="right">
                    <Tooltip title={site.actif ? "Désactiver" : "Activer"}>
                      <Switch
                        checked={site.actif}
                        onChange={() => handleToggleActive(site)}
                        color="success"
                        size="small"
                      />
                    </Tooltip>
                    <Tooltip title="Modifier">
                      <IconButton onClick={() => handleOpenDialog(site)} color="primary" size="small">
                        <Edit fontSize="small" />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="Supprimer">
                      <IconButton onClick={() => handleDelete(site.id)} color="error" size="small">
                        <Delete fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  </TableCell>
                </TableRow>
              ))}
              {sites.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} align="center" sx={{ py: 4 }}>
                    <Typography color="text.secondary">Aucun site trouvé</Typography>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>
        <TablePagination
          rowsPerPageOptions={[5, 10, 25, 50]}
          component="div"
          count={sites.length}
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
          {editingSite ? 'Modifier le site' : 'Nouveau site'}
        </DialogTitle>
        <DialogContent sx={{ pt: 3 }}>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
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

export default SitesManagement;
