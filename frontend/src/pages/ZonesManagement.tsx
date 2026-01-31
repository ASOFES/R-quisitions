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
  TablePagination
} from '@mui/material';
import {
  Add,
  Edit,
  Delete,
  Map as MapIcon,
  CheckCircle,
  Cancel
} from '@mui/icons-material';
import { zonesAPI, Zone } from '../services/api';
const ZonesManagement: React.FC = () => {
  const theme = useTheme();
  const [zones, setZones] = useState<Zone[]>([]);
  const [loading, setLoading] = useState(true);
  const [openDialog, setOpenDialog] = useState(false);
  const [editingZone, setEditingZone] = useState<Zone | null>(null);
  const [formData, setFormData] = useState({
    code: '',
    nom: '',
    description: '',
  });
  const [alert, setAlert] = useState<{ type: 'success' | 'error', message: string } | null>(null);

  // Pagination state
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);

  useEffect(() => {
    loadZones();
  }, []);

  const loadZones = async () => {
    try {
      setLoading(true);
      const zonesData = await zonesAPI.getAll();
      setZones(zonesData);
    } catch (error) {
      console.error('Erreur lors du chargement des zones:', error);
      setAlert({ type: 'error', message: 'Erreur lors du chargement des zones' });
    } finally {
      setLoading(false);
    }
  };

  const handleOpenDialog = (zone?: Zone) => {
    if (zone) {
      setEditingZone(zone);
      setFormData({
        code: zone.code,
        nom: zone.nom,
        description: zone.description || '',
      });
    } else {
      setEditingZone(null);
      setFormData({
        code: '',
        nom: '',
        description: '',
      });
    }
    setOpenDialog(true);
  };

  const handleCloseDialog = () => {
    setOpenDialog(false);
    setEditingZone(null);
    setFormData({
      code: '',
      nom: '',
      description: '',
    });
  };

  const handleSubmit = async () => {
    try {
      if (editingZone) {
        await zonesAPI.update(editingZone.id, formData);
        setAlert({ type: 'success', message: 'Zone mise à jour avec succès' });
      } else {
        await zonesAPI.create(formData);
        setAlert({ type: 'success', message: 'Zone créée avec succès' });
      }
      handleCloseDialog();
      loadZones();
    } catch (error) {
      console.error('Erreur lors de l\'enregistrement de la zone:', error);
      setAlert({ type: 'error', message: 'Erreur lors de l\'enregistrement de la zone' });
    }
  };

  const handleDelete = async (id: number) => {
    if (window.confirm('Êtes-vous sûr de vouloir supprimer cette zone ?')) {
      try {
        const response = await zonesAPI.delete(id);
        // @ts-ignore
        const msg = response?.message || 'Zone supprimée avec succès';
        setAlert({ type: 'success', message: msg });
        setZones((prev) => prev.filter((z) => z.id !== id));
        loadZones();
      } catch (error) {
        console.error('Erreur lors de la suppression de la zone:', error);
        setAlert({ type: 'error', message: 'Erreur lors de la suppression de la zone' });
      }
    }
  };

  const handleChangePage = (event: unknown, newPage: number) => {
    setPage(newPage);
  };

  const handleChangeRowsPerPage = (event: React.ChangeEvent<HTMLInputElement>) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
  };

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4" component="h1" sx={{ fontWeight: 'bold', color: 'primary.main', display: 'flex', alignItems: 'center' }}>
          <MapIcon sx={{ mr: 2, fontSize: 40 }} />
          Gestion des Zones
        </Typography>
        <Button
          variant="contained"
          startIcon={<Add />}
          onClick={() => handleOpenDialog()}
          sx={{ borderRadius: 2, px: 3, py: 1 }}
        >
          Nouvelle Zone
        </Button>
      </Box>

      {alert && (
        <Alert severity={alert.type} sx={{ mb: 3 }} onClose={() => setAlert(null)}>
          {alert.message}
        </Alert>
      )}

      <TableContainer component={Paper} elevation={0} sx={{ borderRadius: 2, border: `1px solid ${theme.palette.divider}` }}>
        <Table>
          <TableHead sx={{ bgcolor: alpha(theme.palette.primary.main, 0.05) }}>
            <TableRow>
              <TableCell sx={{ fontWeight: 'bold' }}>Code</TableCell>
              <TableCell sx={{ fontWeight: 'bold' }}>Nom</TableCell>
              <TableCell sx={{ fontWeight: 'bold' }}>Description</TableCell>
              <TableCell align="right" sx={{ fontWeight: 'bold' }}>Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={4} align="center" sx={{ py: 3 }}>
                  <CircularProgress />
                </TableCell>
              </TableRow>
            ) : zones.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} align="center" sx={{ py: 3 }}>
                  <Typography color="text.secondary">Aucune zone trouvée</Typography>
                </TableCell>
              </TableRow>
            ) : (
              zones
                .slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage)
                .map((zone) => (
                <TableRow key={zone.id} hover>
                  <TableCell>
                    <Chip label={zone.code} size="small" sx={{ fontWeight: 'bold' }} />
                  </TableCell>
                  <TableCell>{zone.nom}</TableCell>
                  <TableCell>{zone.description || '-'}</TableCell>
                  <TableCell>
                    <Chip
                      icon={zone.actif ? <CheckCircle fontSize="small" /> : <Cancel fontSize="small" />}
                      label={zone.actif ? 'Actif' : 'Inactif'}
                      color={zone.actif ? 'success' : 'default'}
                      size="small"
                      variant={zone.actif ? 'filled' : 'outlined'}
                    />
                  </TableCell>
                  <TableCell align="right">
                    <Tooltip title="Modifier">
                      <IconButton onClick={() => handleOpenDialog(zone)} color="primary" size="small">
                        <Edit />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="Supprimer">
                      <IconButton onClick={() => handleDelete(zone.id)} color="error" size="small">
                        <Delete />
                      </IconButton>
                    </Tooltip>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
        <TablePagination
          rowsPerPageOptions={[5, 10, 25, 50]}
          component="div"
          count={zones.length}
          rowsPerPage={rowsPerPage}
          page={page}
          onPageChange={handleChangePage}
          onRowsPerPageChange={handleChangeRowsPerPage}
          labelRowsPerPage="Lignes par page"
          labelDisplayedRows={({ from, to, count }) => `${from}-${to} sur ${count}`}
        />
      </TableContainer>

      <Dialog open={openDialog} onClose={handleCloseDialog} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ bgcolor: 'primary.main', color: 'white' }}>
          {editingZone ? 'Modifier la zone' : 'Nouvelle zone'}
        </DialogTitle>
        <DialogContent sx={{ mt: 2 }}>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
            <TextField
              label="Code"
              value={formData.code}
              onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
              fullWidth
              required
              helperText="Code unique (ex: KIN, LUB)"
            />
            <TextField
              label="Nom"
              value={formData.nom}
              onChange={(e) => setFormData({ ...formData, nom: e.target.value })}
              fullWidth
              required
            />
            <TextField
              label="Description"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              fullWidth
              multiline
              rows={3}
            />
          </Box>
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={handleCloseDialog} color="inherit">
            Annuler
          </Button>
          <Button 
            onClick={handleSubmit} 
            variant="contained" 
            disabled={!formData.code || !formData.nom}
          >
            {editingZone ? 'Mettre à jour' : 'Créer'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default ZonesManagement;
