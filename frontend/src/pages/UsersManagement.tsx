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
  MenuItem,
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
} from '@mui/icons-material';
import { usersAPI, servicesAPI, zonesAPI } from '../services/api';
import { User, Service, Zone } from '../services/api';

const UsersManagement: React.FC = () => {
  const theme = useTheme();
  const [users, setUsers] = useState<User[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [zones, setZones] = useState<Zone[]>([]);
  const [loading, setLoading] = useState(true);
  const [openDialog, setOpenDialog] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [formData, setFormData] = useState({
    username: '',
    password: '',
    nom_complet: '',
    email: '',
    role: 'emetteur' as 'admin' | 'emetteur' | 'analyste' | 'challenger' | 'validateur' | 'comptable' | 'gm' | 'pm' | 'compilateur',
    service_id: '',
    zone_id: '',
  });
  const [alert, setAlert] = useState<{ type: 'success' | 'error', message: string } | null>(null);

  // Pagination state
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);

  const roles = [
    { value: 'admin', label: 'Administrateur', color: theme.palette.error.main },
    { value: 'gm', label: 'General Manager', color: theme.palette.warning.main },
    { value: 'validateur', label: 'Validateur (PM)', color: theme.palette.success.main },
    { value: 'analyste', label: 'Analyste', color: theme.palette.info.main },
    { value: 'compilateur', label: 'Compilateur', color: theme.palette.secondary.main },
    { value: 'emetteur', label: 'Initiateur', color: theme.palette.primary.main },
  ];

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [usersData, servicesData, zonesData] = await Promise.all([
        usersAPI.getAll(),
        servicesAPI.getAll(),
        zonesAPI.getAll(),
      ]);
      setUsers(usersData);
      setServices(servicesData);
      setZones(zonesData);
    } catch (error) {
      console.error('Erreur lors du chargement:', error);
      setAlert({ type: 'error', message: 'Erreur lors du chargement des données' });
    } finally {
      setLoading(false);
    }
  };

  const handleOpenDialog = (user?: User) => {
    if (user) {
      setEditingUser(user);
      setFormData({
        username: user.username,
        password: '',
        nom_complet: user.nom_complet,
        email: user.email,
        role: user.role,
        service_id: user.service_id?.toString() || '',
        zone_id: user.zone_id?.toString() || '',
      });
    } else {
      setEditingUser(null);
      setFormData({
        username: '',
        password: '',
        nom_complet: '',
        email: '',
        role: 'emetteur',
        service_id: '',
        zone_id: '',
      });
    }
    setOpenDialog(true);
  };

  const handleCloseDialog = () => {
    setOpenDialog(false);
    setEditingUser(null);
    setFormData({
      username: '',
      password: '',
      nom_complet: '',
      email: '',
      role: 'emetteur',
      service_id: '',
      zone_id: '',
    });
  };

  const handleSubmit = async () => {
    try {
      const payload = {
        ...formData,
        service_id: formData.service_id ? parseInt(formData.service_id) : undefined,
        zone_id: formData.zone_id ? parseInt(formData.zone_id) : undefined
      };

      if (editingUser) {
        await usersAPI.update(editingUser.id, payload as any);
        setAlert({ type: 'success', message: 'Utilisateur mis à jour avec succès' });
      } else {
        await usersAPI.create(payload as any);
        setAlert({ type: 'success', message: 'Utilisateur créé avec succès' });
      }
      handleCloseDialog();
      loadData();
    } catch (error) {
      console.error('Erreur lors de la sauvegarde:', error);
      setAlert({ type: 'error', message: 'Erreur lors de la sauvegarde' });
    }
  };

  const handleDelete = async (userId: number) => {
    if (window.confirm('Êtes-vous sûr de vouloir supprimer cet utilisateur ?')) {
      try {
        const response = await usersAPI.delete(userId);
        // @ts-ignore
        const msg = response?.message || 'Utilisateur supprimé avec succès';
        setAlert({ type: 'success', message: msg });
        setUsers((prev) => prev.filter((u) => u.id !== userId));
        loadData();
      } catch (error) {
        console.error('Erreur lors de la suppression:', error);
        setAlert({ type: 'error', message: 'Erreur lors de la suppression' });
      }
    }
  };

  const getRoleLabel = (role: string) => {
    const roleObj = roles.find(r => r.value === role);
    return roleObj?.label || role;
  };

  const getRoleColor = (role: string) => {
    const roleObj = roles.find(r => r.value === role);
    return roleObj?.color || theme.palette.grey[500];
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
            Gestion des utilisateurs
          </Typography>
          <Typography variant="body1" color="text.secondary">
            Gérez les comptes utilisateurs, leurs rôles et leurs accès.
          </Typography>
        </Box>
        <Button
          variant="contained"
          startIcon={<Add />}
          onClick={() => handleOpenDialog()}
          sx={{ borderRadius: 2, px: 3, py: 1, boxShadow: theme.shadows[4] }}
        >
          Ajouter un utilisateur
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

      <Paper elevation={0} sx={{ borderRadius: 3, border: '1px solid', borderColor: 'divider', overflow: 'hidden' }}>
        <TableContainer>
          <Table>
            <TableHead sx={{ bgcolor: 'grey.50' }}>
              <TableRow>
                <TableCell sx={{ fontWeight: 700 }}>Utilisateur</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>Nom Complet</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>Rôle</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>Service</TableCell>
                <TableCell align="right" sx={{ fontWeight: 700 }}>Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {users
                .slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage)
                .map((user) => (
                <TableRow key={user.id} hover>
                  <TableCell>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                      <Box sx={{ 
                        width: 40, 
                        height: 40, 
                        borderRadius: '50%', 
                        bgcolor: alpha(theme.palette.primary.main, 0.1), 
                        color: 'primary.main',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontWeight: 'bold'
                      }}>
                        {user.username[0].toUpperCase()}
                      </Box>
                      <Box>
                        <Typography variant="subtitle2" fontWeight={600}>{user.username}</Typography>
                        <Typography variant="caption" color="text.secondary">{user.email}</Typography>
                      </Box>
                    </Box>
                  </TableCell>
                  <TableCell>{user.nom_complet}</TableCell>
                  <TableCell>
                    <Chip 
                      label={getRoleLabel(user.role)} 
                      size="small"
                      sx={{ 
                        bgcolor: alpha(getRoleColor(user.role), 0.1),
                        color: getRoleColor(user.role),
                        fontWeight: 600,
                        borderRadius: 1
                      }}
                    />
                  </TableCell>
                  <TableCell>
                    {user.service_nom || (user as any).Service?.nom || '-'}
                  </TableCell>
                  <TableCell>
                    {user.zone_nom || '-'}
                  </TableCell>
                  <TableCell align="right">
                    <Tooltip title="Modifier">
                      <IconButton onClick={() => handleOpenDialog(user)} color="primary" size="small">
                        <Edit fontSize="small" />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="Supprimer">
                      <IconButton onClick={() => handleDelete(user.id)} color="error" size="small">
                        <Delete fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  </TableCell>
                </TableRow>
              ))}
              {users.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} align="center" sx={{ py: 4 }}>
                    <Typography color="text.secondary">Aucun utilisateur trouvé</Typography>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>
        <TablePagination
          rowsPerPageOptions={[5, 10, 25, 50]}
          component="div"
          count={users.length}
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
          {editingUser ? 'Modifier l\'utilisateur' : 'Nouvel utilisateur'}
        </DialogTitle>
        <DialogContent sx={{ pt: 3 }}>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
            <TextField
              label="Nom d'utilisateur"
              value={formData.username}
              onChange={(e) => setFormData({ ...formData, username: e.target.value })}
              fullWidth
              variant="outlined"
            />
            <TextField
              label="Mot de passe"
              type="password"
              value={formData.password}
              onChange={(e) => setFormData({ ...formData, password: e.target.value })}
              fullWidth
              variant="outlined"
              helperText={editingUser ? "Laisser vide pour ne pas modifier" : ""}
            />
            <TextField
              label="Nom complet"
              value={formData.nom_complet}
              onChange={(e) => setFormData({ ...formData, nom_complet: e.target.value })}
              fullWidth
              variant="outlined"
            />
            <TextField
              label="Email"
              type="email"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              fullWidth
              variant="outlined"
            />
            <TextField
              select
              label="Rôle"
              value={formData.role}
              onChange={(e) => setFormData({ ...formData, role: e.target.value as any })}
              fullWidth
              variant="outlined"
            >
              {roles.map((option) => (
                <MenuItem key={option.value} value={option.value}>
                  {option.label}
                </MenuItem>
              ))}
            </TextField>
            <TextField
              select
              label="Service"
              value={formData.service_id}
              onChange={(e) => setFormData({ ...formData, service_id: e.target.value })}
              fullWidth
              variant="outlined"
            >
              <MenuItem value="">
                <em>Aucun</em>
              </MenuItem>
              {services.map((service) => (
                <MenuItem key={service.id} value={service.id}>
                  {service.nom}
                </MenuItem>
              ))}
            </TextField>
            <TextField
              select
              label="Zone"
              value={formData.zone_id}
              onChange={(e) => setFormData({ ...formData, zone_id: e.target.value })}
              fullWidth
              variant="outlined"
            >
              <MenuItem value="">
                <em>Aucune</em>
              </MenuItem>
              {zones.map((zone) => (
                <MenuItem key={zone.id} value={zone.id}>
                  {zone.nom}
                </MenuItem>
              ))}
            </TextField>
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

export default UsersManagement;
