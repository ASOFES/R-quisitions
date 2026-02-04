import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Checkbox,
  Button,
  Tabs,
  Tab,
  CircularProgress,
  Alert,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Chip,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
} from '@mui/material';
import { requisitionsAPI, Requisition, Bordereau, User } from '../services/api';
import { PictureAsPdf, AddTask, History, FactCheck } from '@mui/icons-material';

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

function TabPanel(props: TabPanelProps) {
  const { children, value, index, ...other } = props;

  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`simple-tabpanel-${index}`}
      aria-labelledby={`simple-tab-${index}`}
      {...other}
    >
      {value === index && (
        <Box sx={{ p: 3 }}>
          {children}
        </Box>
      )}
    </div>
  );
}

const CompilationsPage: React.FC = () => {
  const [tabValue, setTabValue] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [requisitions, setRequisitions] = useState<Requisition[]>([]);
  const [bordereaux, setBordereaux] = useState<Bordereau[]>([]);
  const [bordereauxAAligner, setBordereauxAAligner] = useState<Bordereau[]>([]);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [alignDialogOpen, setAlignDialogOpen] = useState(false);
  const [selectedBordereauId, setSelectedBordereauId] = useState<number | null>(null);
  const [paymentMode, setPaymentMode] = useState('Cash');
  const [user, setUser] = useState<User | null>(null);

  // Filters for "À Compiler"
  const [filterService, setFilterService] = useState<string>('all');
  const [filterUrgence, setFilterUrgence] = useState<string>('all');

  useEffect(() => {
    const userStr = localStorage.getItem('user');
    if (userStr) {
      setUser(JSON.parse(userStr));
    }
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      // Parallel requests would be better but let's keep it simple
      const reqs = await requisitionsAPI.getRequisitionsToCompile();
      const bords = await requisitionsAPI.getBordereaux();
      
      setRequisitions(reqs);
      setBordereaux(bords);

      // Si analyste ou admin, on charge aussi les bordereaux à aligner
      const userStr = localStorage.getItem('user');
      if (userStr) {
        const u = JSON.parse(userStr);
        if (u.role === 'analyste' || u.role === 'admin') {
           const aligns = await requisitionsAPI.getBordereauxToAlign();
           setBordereauxAAligner(aligns);
        }
      }

      setError(null);
    } catch (err) {
      console.error('Erreur chargement compilations:', err);
      setError('Impossible de charger les données.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleTabChange = (event: React.SyntheticEvent, newValue: number) => {
    setTabValue(newValue);
  };

  const handleSelectAll = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.checked) {
      setSelectedIds(filteredRequisitions.map((r) => r.id));
    } else {
      setSelectedIds([]);
    }
  };

  const handleSelectOne = (id: number) => {
    const selectedIndex = selectedIds.indexOf(id);
    let newSelected: number[] = [];

    if (selectedIndex === -1) {
      newSelected = newSelected.concat(selectedIds, id);
    } else if (selectedIndex === 0) {
      newSelected = newSelected.concat(selectedIds.slice(1));
    } else if (selectedIndex === selectedIds.length - 1) {
      newSelected = newSelected.concat(selectedIds.slice(0, -1));
    } else if (selectedIndex > 0) {
      newSelected = newSelected.concat(
        selectedIds.slice(0, selectedIndex),
        selectedIds.slice(selectedIndex + 1),
      );
    }

    setSelectedIds(newSelected);
  };

  const handleCreateBordereau = async () => {
    try {
      await requisitionsAPI.createBordereau(selectedIds);
      setConfirmOpen(false);
      setSelectedIds([]);
      fetchData(); // Rafraîchir
    } catch (err) {
      console.error('Erreur création bordereau:', err);
      setError('Erreur lors de la création du bordereau.');
    }
  };

  const handleAligner = (bordereauId: number) => {
      setSelectedBordereauId(bordereauId);
      setPaymentMode('Cash'); // Default
      setAlignDialogOpen(true);
  };

  const confirmAlignment = async () => {
      if (!selectedBordereauId) return;
      try {
          await requisitionsAPI.alignBordereau(selectedBordereauId, paymentMode);
          setAlignDialogOpen(false);
          fetchData();
      } catch (err) {
          console.error('Erreur alignement:', err);
          setError('Erreur lors de l\'alignement.');
      }
  };

  const formatCurrency = (amount?: number, currency: string = 'USD') => {
    if (amount === undefined || amount === null) return '-';
    return new Intl.NumberFormat('fr-FR', { style: 'currency', currency }).format(amount);
  };

  const isAnalysteOrAdmin = user?.role === 'analyste' || user?.role === 'admin';

  // Extract unique services and urgencies for filters
  const services = Array.from(new Set(requisitions.map(r => r.service_nom || 'Autre'))).sort();
  const urgencies = Array.from(new Set(requisitions.map(r => r.urgence || 'normale'))).sort();

  const filteredRequisitions = requisitions.filter(req => {
    const serviceMatch = filterService === 'all' || (req.service_nom || 'Autre') === filterService;
    const urgencyMatch = filterUrgence === 'all' || (req.urgence || 'normale') === filterUrgence;
    return serviceMatch && urgencyMatch;
  });

  if (loading && requisitions.length === 0 && bordereaux.length === 0) {
    return <CircularProgress />;
  }

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h4" gutterBottom>
        Gestion des Compilations
      </Typography>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      <Paper sx={{ width: '100%' }}>
        <Tabs value={tabValue} onChange={handleTabChange} indicatorColor="primary" textColor="primary">
          <Tab label="À Compiler" icon={<AddTask />} iconPosition="start" />
          {isAnalysteOrAdmin && (
             <Tab label="À Aligner (Analyste)" icon={<FactCheck />} iconPosition="start" />
          )}
          <Tab label="Historique Bordereaux" icon={<History />} iconPosition="start" />
        </Tabs>

        {/* Tab 1: À Compiler */}
        <TabPanel value={tabValue} index={0}>
          <Box sx={{ mb: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 2 }}>
            <Typography variant="h6">
              Réquisitions validées par le GM ({filteredRequisitions.length})
            </Typography>
            <Box sx={{ display: 'flex', gap: 2 }}>
                <FormControl size="small" sx={{ minWidth: 150 }}>
                    <InputLabel>Service</InputLabel>
                    <Select
                        value={filterService}
                        label="Service"
                        onChange={(e) => setFilterService(e.target.value)}
                    >
                        <MenuItem value="all">Tous les services</MenuItem>
                        {services.map(s => (
                            <MenuItem key={s} value={s}>{s}</MenuItem>
                        ))}
                    </Select>
                </FormControl>
                <FormControl size="small" sx={{ minWidth: 150 }}>
                    <InputLabel>Urgence</InputLabel>
                    <Select
                        value={filterUrgence}
                        label="Urgence"
                        onChange={(e) => setFilterUrgence(e.target.value)}
                    >
                        <MenuItem value="all">Toutes urgences</MenuItem>
                        {urgencies.map(u => (
                            <MenuItem key={u} value={u}>{u}</MenuItem>
                        ))}
                    </Select>
                </FormControl>
            </Box>
            <Box>
                <Button
                variant="contained"
                color="primary"
                disabled={selectedIds.length === 0}
                onClick={() => setConfirmOpen(true)}
                startIcon={<PictureAsPdf />}
                sx={{ mr: 2 }}
                >
                Générer Bordereau ({selectedIds.length})
                </Button>
                <Button
                variant="outlined"
                color="secondary"
                onClick={() => {
                    setSelectedIds(filteredRequisitions.map((r) => r.id));
                    setConfirmOpen(true);
                }}
                >
                Clôturer la file (Tout)
                </Button>
            </Box>
          </Box>

          <TableContainer>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell padding="checkbox">
                    <Checkbox
                      indeterminate={selectedIds.length > 0 && selectedIds.length < filteredRequisitions.length}
                      checked={filteredRequisitions.length > 0 && selectedIds.length === filteredRequisitions.length}
                      onChange={handleSelectAll}
                    />
                  </TableCell>
                  <TableCell>Numéro</TableCell>
                  <TableCell>Objet</TableCell>
                  <TableCell>Initiateur</TableCell>
                  <TableCell>Service</TableCell>
                  <TableCell>Urgence</TableCell>
                  <TableCell align="right">Montant USD</TableCell>
                  <TableCell align="right">Montant CDF</TableCell>
                  <TableCell>Date Création</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {filteredRequisitions.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={9} align="center">Aucune réquisition à compiler</TableCell>
                  </TableRow>
                ) : (
                  filteredRequisitions.map((req) => {
                    const isSelected = selectedIds.indexOf(req.id) !== -1;
                    return (
                      <TableRow
                        key={req.id}
                        hover
                        role="checkbox"
                        aria-checked={isSelected}
                        selected={isSelected}
                      >
                        <TableCell padding="checkbox">
                          <Checkbox
                            checked={isSelected}
                            onChange={() => handleSelectOne(req.id)}
                          />
                        </TableCell>
                        <TableCell>{req.numero}</TableCell>
                        <TableCell>{req.objet}</TableCell>
                        <TableCell>{req.emetteur_nom}</TableCell>
                        <TableCell>{req.service_nom}</TableCell>
                        <TableCell>
                            <Chip 
                                label={req.urgence || 'normale'} 
                                size="small" 
                                color={req.urgence === 'critique' ? 'error' : req.urgence === 'haute' ? 'warning' : 'default'} 
                            />
                        </TableCell>
                        <TableCell align="right">{formatCurrency(req.montant_usd, 'USD')}</TableCell>
                        <TableCell align="right">{formatCurrency(req.montant_cdf, 'CDF')}</TableCell>
                        <TableCell>{new Date(req.created_at).toLocaleDateString()}</TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </TableContainer>
        </TabPanel>

        {/* Tab 2: À Aligner (Analyste) */}
        {isAnalysteOrAdmin && (
        <TabPanel value={tabValue} index={1}>
           <Typography variant="h6" gutterBottom>
              Bordereaux en attente d'alignement ({bordereauxAAligner.length})
           </Typography>
           <TableContainer>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Numéro Bordereau</TableCell>
                  <TableCell>Date Création</TableCell>
                  <TableCell>Créé par</TableCell>
                  <TableCell align="center">Nb Réquisitions</TableCell>
                  <TableCell align="right">Total USD</TableCell>
                  <TableCell align="right">Total CDF</TableCell>
                  <TableCell align="center">Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {bordereauxAAligner.length === 0 ? (
                    <TableRow>
                        <TableCell colSpan={7} align="center">Aucun bordereau à aligner</TableCell>
                    </TableRow>
                ) : (
                    bordereauxAAligner.map((bord) => (
                    <TableRow key={bord.id} hover>
                        <TableCell>{bord.numero}</TableCell>
                        <TableCell>{new Date(bord.date_creation).toLocaleString()}</TableCell>
                        <TableCell>{bord.createur_nom}</TableCell>
                        <TableCell align="center">{bord.nb_requisitions}</TableCell>
                        <TableCell align="right">{formatCurrency(bord.total_usd, 'USD')}</TableCell>
                        <TableCell align="right">{formatCurrency(bord.total_cdf, 'CDF')}</TableCell>
                        <TableCell align="center">
                        <Button 
                            variant="contained" 
                            color="secondary" 
                            size="small"
                            onClick={() => handleAligner(bord.id)}
                        >
                            Aligner (Paiement)
                        </Button>
                        </TableCell>
                    </TableRow>
                    ))
                )}
              </TableBody>
            </Table>
          </TableContainer>
        </TabPanel>
        )}

        {/* Tab 3: Historique (Index changes depending on Analyste presence) */}
        <TabPanel value={tabValue} index={isAnalysteOrAdmin ? 2 : 1}>
          <TableContainer>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Numéro Bordereau</TableCell>
                  <TableCell>Date Création</TableCell>
                  <TableCell>Créé par</TableCell>
                  <TableCell align="center">Nb Réquisitions</TableCell>
                  <TableCell align="right">Total USD</TableCell>
                  <TableCell align="right">Total CDF</TableCell>
                  <TableCell align="center">Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {bordereaux.map((bord) => (
                  <TableRow key={bord.id} hover>
                    <TableCell>{bord.numero}</TableCell>
                    <TableCell>{new Date(bord.date_creation).toLocaleString()}</TableCell>
                    <TableCell>{bord.createur_nom}</TableCell>
                    <TableCell align="center">{bord.nb_requisitions}</TableCell>
                    <TableCell align="right">{formatCurrency(bord.total_usd, 'USD')}</TableCell>
                    <TableCell align="right">{formatCurrency(bord.total_cdf, 'CDF')}</TableCell>
                    <TableCell align="center">
                       {/* Placeholder pour téléchargement PDF */}
                       <Button size="small" variant="outlined" startIcon={<PictureAsPdf />}>
                         PDF
                       </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </TabPanel>
      </Paper>

      {/* Dialog Confirmation */}
      <Dialog open={confirmOpen} onClose={() => setConfirmOpen(false)}>
        <DialogTitle>Confirmer la compilation</DialogTitle>
        <DialogContent>
          <Typography>
            Vous allez créer un nouveau bordereau contenant {selectedIds.length} réquisition(s).
            Ces réquisitions seront envoyées à l'Analyste pour alignement.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmOpen(false)}>Annuler</Button>
          <Button onClick={handleCreateBordereau} variant="contained" color="primary" autoFocus>
            Confirmer et Créer
          </Button>
        </DialogActions>
      </Dialog>

      {/* Dialog Alignement avec Mode de Paiement */}
      <Dialog open={alignDialogOpen} onClose={() => setAlignDialogOpen(false)}>
        <DialogTitle>Aligner le bordereau</DialogTitle>
        <DialogContent sx={{ minWidth: 400, mt: 1 }}>
          <Typography gutterBottom>
            Veuillez sélectionner le mode de paiement pour ce bordereau.
            Les réquisitions seront envoyées au Comptable pour paiement.
          </Typography>
          <FormControl fullWidth sx={{ mt: 2 }}>
            <InputLabel>Mode de Paiement</InputLabel>
            <Select
              value={paymentMode}
              label="Mode de Paiement"
              onChange={(e) => setPaymentMode(e.target.value)}
            >
              <MenuItem value="Cash">Cash</MenuItem>
              <MenuItem value="Banque">Banque</MenuItem>
              <MenuItem value="Mobile Money">Mobile Money</MenuItem>
              <MenuItem value="Cheque">Chèque</MenuItem>
            </Select>
          </FormControl>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setAlignDialogOpen(false)}>Annuler</Button>
          <Button onClick={confirmAlignment} variant="contained" color="secondary" autoFocus>
            Confirmer l'Alignement
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default CompilationsPage;
