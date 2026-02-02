import React, { useState, useEffect } from 'react';
import { 
  Container, 
  Typography, 
  Box, 
  Button, 
  Grid, 
  Paper, 
  Table, 
  TableBody, 
  TableCell, 
  TableContainer, 
  TableHead, 
  TableRow,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  MenuItem,
  Alert,
  CircularProgress,
  Chip,
  Stack,
  InputAdornment,
  TablePagination,
  IconButton,
  Tabs,
  Tab,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Divider
} from '@mui/material';
import { 
  ArrowBack, 
  AddCircleOutline, 
  History,
  TrendingUp,
  TrendingDown,
  FileDownload,
  PictureAsPdf,
  Search as SearchIcon,
  Visibility,
  Close,
  AttachFile,
  AttachMoney
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import api from '../services/api';
import { getLogoBase64 } from '../utils/logoUtils';
import { Requisition, RequisitionItem } from '../services/RequisitionService';
import { API_BASE_URL } from '../config';

// Interface étendue pour inclure les propriétés spécifiques à la vue détaillée
interface ExtendedRequisition extends Omit<Requisition, 'actions'> {
  site_nom?: string;
  items?: (RequisitionItem & { prix_total: number })[];
  pieces_jointes_data?: Array<{
    id: string;
    nom_fichier: string;
    chemin_fichier: string;
    taille_fichier: number;
    type_fichier: string;
    created_at: string;
    // champs hérités mais optionnels dans l'interface de base
    name: string;
    size: number;
    type: string;
    data: string | null;
  }>;
  actions?: Array<{
    action: string;
    utilisateur_nom: string;
    created_at: string;
    commentaire?: string;
  }>;
}

interface Fond {
  devise: 'USD' | 'CDF';
  solde: number;
  updated_at: string;
}

interface Mouvement {
  id: number;
  type_mouvement: 'entree' | 'sortie';
  montant: number;
  devise: 'USD' | 'CDF';
  description: string;
  created_at: string;
}

const FundsPage: React.FC = () => {
  const navigate = useNavigate();
  const [fonds, setFonds] = useState<Fond[]>([]);
  const [mouvements, setMouvements] = useState<Mouvement[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [logoBase64, setLogoBase64] = useState<string | null>(null);
  
  // Dialog state
  const [openDialog, setOpenDialog] = useState(false);
  const [submitLoading, setSubmitLoading] = useState(false);
  const [formData, setFormData] = useState({
    devise: 'USD',
    montant: '',
    description: ''
  });

  // Filter state
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [filterText, setFilterText] = useState('');

  // Requisition Details State
  const [selectedRequisition, setSelectedRequisition] = useState<ExtendedRequisition | null>(null);
  const [showDetails, setShowDetails] = useState(false);
  const [detailsTab, setDetailsTab] = useState(0);
  const [loadingDetails, setLoadingDetails] = useState(false);

  // Pagination state
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);

  const filteredMouvements = React.useMemo(() => {
    return mouvements.filter(mouv => {
      const mouvDate = new Date(mouv.created_at);
      const start = startDate ? new Date(startDate) : null;
      const end = endDate ? new Date(endDate) : null;

      if (end) end.setHours(23, 59, 59, 999);

      const matchesDate = (!start || mouvDate >= start) && (!end || mouvDate <= end);
      const searchLower = filterText.toLowerCase();
      const matchesText =
        (mouv.description || '').toLowerCase().includes(searchLower) ||
        mouv.type_mouvement.toLowerCase().includes(searchLower) ||
        mouv.montant.toString().includes(searchLower);

      return matchesDate && matchesText;
    });
  }, [mouvements, startDate, endDate, filterText]);

  const stats = React.useMemo(() => {
    return filteredMouvements.reduce((acc, m) => {
      // Ensure we have a valid number
      let montant = Number(m.montant);
      if (isNaN(montant)) montant = 0;
      
      if (m.devise === 'USD') {
        if (m.type_mouvement === 'entree') acc.usdIn += montant;
        else acc.usdOut += montant;
      } else {
        if (m.type_mouvement === 'entree') acc.cdfIn += montant;
        else acc.cdfOut += montant;
      }
      return acc;
    }, { usdIn: 0, usdOut: 0, cdfIn: 0, cdfOut: 0 });
  }, [filteredMouvements]);

  const formatMoneyPDF = (amount: number, currency: string) => {
    const val = amount.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    return `${val.replace(/[\u00A0\u202F]/g, ' ')} ${currency}`;
  };

  const handleExportExcel = () => {
    const title = [["REQUISITIONS APP - Historique de Trésorerie"]];
    const dateInfo = [[`Généré le : ${new Date().toLocaleDateString('fr-FR')}`]];
    const periodInfo = (startDate || endDate) ? [[`Période : ${startDate || 'Début'} au ${endDate || 'Fin'}`]] : [];
    
    const headers = [["Date", "Type", "Description", "Montant", "Devise"]];
    
    const data = filteredMouvements.map(m => [
      new Date(m.created_at).toLocaleDateString('fr-FR'),
      m.type_mouvement === 'entree' ? 'Entrée' : 'Sortie',
      m.description,
      m.montant,
      m.devise
    ]);

    const wsData = [...title, ...dateInfo, ...periodInfo, [""], ...headers, ...data];
    const ws = XLSX.utils.aoa_to_sheet(wsData);

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Historique Mouvements");
    XLSX.writeFile(wb, `mouvements_tresorerie_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  const handleExportPDF = () => {
    const doc = new jsPDF();

    if (logoBase64) {
      doc.addImage(logoBase64, 'PNG', 14, 10, 20, 20);
      doc.setFontSize(18);
      doc.text("Historique de Trésorerie", 40, 22);
    } else {
      doc.setFontSize(18);
      doc.text("Historique de Trésorerie", 14, 15);
    }

    doc.setFontSize(10);
    doc.text(`Généré le : ${new Date().toLocaleDateString('fr-FR')}`, 14, 35);
    if (startDate || endDate) {
      doc.text(`Période : ${startDate || 'Début'} au ${endDate || 'Fin'}`, 14, 40);
    }

    const tableColumn = ["Date", "Type", "Description", "Montant", "Devise"];
    const tableRows = filteredMouvements.map(m => [
      new Date(m.created_at).toLocaleDateString('fr-FR'),
      m.type_mouvement === 'entree' ? 'Entrée' : 'Sortie',
      m.description || '-',
      formatMoneyPDF(m.montant, m.devise),
      m.devise
    ]);

    autoTable(doc, {
      head: [tableColumn],
      body: tableRows,
      startY: 45,
      theme: 'grid',
      styles: { fontSize: 9, cellPadding: 3 },
      headStyles: { fillColor: [66, 66, 66] }
    });

    doc.save(`mouvements_tresorerie_${new Date().toISOString().split('T')[0]}.pdf`);
  };

  const handleChangePage = (event: unknown, newPage: number) => {
    setPage(newPage);
  };

  const handleChangeRowsPerPage = (event: React.ChangeEvent<HTMLInputElement>) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
  };

  const extractRequisitionNumber = (description: string): string | null => {
    if (!description) return null;
    // Autoriser un ou plusieurs suffixes après le séquence (zone, site, etc.)
    const match = description.match(/([A-Z]{2,5}-\d{6}-\d{4}(?:-[A-Z0-9]+)+)/);
    return match ? match[1] : null;
  };

  const handleViewRequisition = async (number: string) => {
    try {
      setLoadingDetails(true);
      setShowDetails(true);
      // Reset selected requisition to avoid showing old data
      setSelectedRequisition(null);
      
      const response = await api.get(`/requisitions/by-number/${number}`);
      
      setSelectedRequisition({
        ...response.data.requisition,
        reference: response.data.requisition.numero,
        montant: response.data.requisition.montant_usd || response.data.requisition.montant_cdf || 0,
        devise: response.data.requisition.montant_usd ? 'USD' : 'CDF',
        items: response.data.items,
        pieces_jointes_data: response.data.pieces,
        actions: response.data.actions
      });
    } catch (err: any) {
      console.error('Erreur chargement détails:', err);
      // Don't alert if 404, just maybe log or toast
      if (err.response && err.response.status === 404) {
          alert('Réquisition introuvable');
      } else {
          alert('Impossible de charger les détails de la réquisition');
      }
      setShowDetails(false);
    } finally {
      setLoadingDetails(false);
    }
  };

  const fetchData = async () => {
    try {
      setLoading(true);
  const parseAmount = (val: any) => {
    if (val === null || val === undefined) return 0;
    
    // First try standard conversion
    const num = Number(val);
    if (!isNaN(num)) return num;

    // Handle strings with potential formatting
    let strVal = String(val);
    
    // Replace comma with dot for decimal separator if likely European/French format
    if (strVal.includes(',') && !strVal.includes('.')) {
      strVal = strVal.replace(/,/g, '.');
    } else if (strVal.includes(',') && strVal.includes('.')) {
      // If both, assume comma is thousands separator (remove it)
      strVal = strVal.replace(/,/g, '');
    }

    // Remove all non-numeric characters except dot and minus
    // Note: This removes spaces which might be thousand separators
    const clean = strVal.replace(/[^0-9.-]/g, '');
    
    const parsed = Number(clean);
    return isNaN(parsed) ? 0 : parsed;
  };

  const fetchData = async () => {
    try {
      setLoading(true);
      const [fondsRes, mouvRes] = await Promise.all([
        api.get('/payments/fonds'),
        api.get('/payments/mouvements')
      ]);
      
      console.log('Funds API Response:', fondsRes.data);
      console.log('Movements API Response:', mouvRes.data);

      // Mapping et conversion des types pour éviter les problèmes de strings/NaN
      setFonds(Array.isArray(fondsRes.data) ? fondsRes.data.map((f: any) => ({
        ...f,
        solde: parseAmount(f.montant_disponible !== undefined ? f.montant_disponible : f.solde)
      })) : []);

      setMouvements(Array.isArray(mouvRes.data) ? mouvRes.data.map((m: any) => ({
        ...m,
        montant: parseAmount(m.montant)
      })) : []);

      setError(null);
    } catch (err) {
      console.error('Erreur chargement données:', err);
      setError('Impossible de charger les données financières.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    getLogoBase64().then(setLogoBase64);
  }, []);

  const handleOpenDialog = () => {
    setOpenDialog(true);
  };

  const handleCloseDialog = () => {
    setOpenDialog(false);
    setFormData({ devise: 'USD', montant: '', description: '' });
  };

  const handleSubmit = async () => {
    if (!formData.montant || isNaN(Number(formData.montant)) || Number(formData.montant) <= 0) {
      alert('Veuillez entrer un montant valide');
      return;
    }

    try {
      setSubmitLoading(true);
      await api.post('/payments/ravitaillement', {
        devise: formData.devise,
        montant: Number(formData.montant),
        description: formData.description
      });
      
      handleCloseDialog();
      fetchData(); // Refresh data
    } catch (err) {
      console.error('Erreur ravitaillement:', err);
      alert('Erreur lors du ravitaillement');
    } finally {
      setSubmitLoading(false);
    }
  };

  const formatCurrency = (amount: number, currency: string) => {
    if (amount === undefined || amount === null || isNaN(amount)) {
      return `0,00 ${currency === 'USD' ? '$US' : 'FC'}`;
    }
    return new Intl.NumberFormat('fr-CD', { 
      style: 'currency', 
      currency: currency 
    }).format(amount);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('fr-FR');
  };

  const getFondByDevise = (devise: string) => {
    return fonds.find(f => f.devise === devise)?.solde || 0;
  };

  if (loading && fonds.length === 0) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', mt: 10 }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', mb: 4, justifyContent: 'space-between' }}>
        <Box sx={{ display: 'flex', alignItems: 'center' }}>
          <Button onClick={() => navigate('/dashboard')} startIcon={<ArrowBack />} sx={{ mr: 2 }}>
            Retour
          </Button>
          <Typography variant="h4">Gestion des fonds</Typography>
        </Box>
        <Button 
          variant="contained" 
          color="primary" 
          startIcon={<AddCircleOutline />}
          onClick={handleOpenDialog}
        >
          Ravitailler la Caisse
        </Button>
      </Box>
      
      {error && <Alert severity="error" sx={{ mb: 3 }}>{error}</Alert>}

      {/* Cards for Funds */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        <Grid size={{ xs: 12, md: 6 }}>
          <Paper 
            sx={{ 
              p: 3, 
              display: 'flex', 
              flexDirection: 'column', 
              alignItems: 'center',
              bgcolor: '#e3f2fd',
              border: '1px solid #90caf9'
            }}
          >
            <Typography variant="h6" color="text.secondary" gutterBottom>
              Solde Actuel USD
            </Typography>
            <Typography variant="h3" component="div" sx={{ fontWeight: 'bold', color: '#1565c0', mb: 2 }}>
              {formatCurrency(getFondByDevise('USD'), 'USD')}
            </Typography>
            <Stack direction="row" spacing={4} sx={{ width: '100%', pt: 2, borderTop: '1px solid rgba(21, 101, 192, 0.2)', justifyContent: 'center' }}>
               <Box sx={{ textAlign: 'center' }}>
                 <Typography variant="caption" display="block" color="text.secondary">Entrées (filtre)</Typography>
                 <Typography variant="body1" color="success.main" fontWeight="bold">+{formatCurrency(stats.usdIn, 'USD')}</Typography>
               </Box>
               <Box sx={{ textAlign: 'center' }}>
                 <Typography variant="caption" display="block" color="text.secondary">Sorties (filtre)</Typography>
                 <Typography variant="body1" color="error.main" fontWeight="bold">-{formatCurrency(stats.usdOut, 'USD')}</Typography>
               </Box>
            </Stack>
          </Paper>
        </Grid>
        <Grid size={{ xs: 12, md: 6 }}>
          <Paper 
            sx={{ 
              p: 3, 
              display: 'flex', 
              flexDirection: 'column', 
              alignItems: 'center',
              bgcolor: '#e8f5e9',
              border: '1px solid #a5d6a7'
            }}
          >
            <Typography variant="h6" color="text.secondary" gutterBottom>
              Solde Actuel CDF
            </Typography>
            <Typography variant="h3" component="div" sx={{ fontWeight: 'bold', color: '#2e7d32', mb: 2 }}>
              {formatCurrency(getFondByDevise('CDF'), 'CDF')}
            </Typography>
            <Stack direction="row" spacing={4} sx={{ width: '100%', pt: 2, borderTop: '1px solid rgba(46, 125, 50, 0.2)', justifyContent: 'center' }}>
               <Box sx={{ textAlign: 'center' }}>
                 <Typography variant="caption" display="block" color="text.secondary">Entrées (filtre)</Typography>
                 <Typography variant="body1" color="success.main" fontWeight="bold">+{formatCurrency(stats.cdfIn, 'CDF')}</Typography>
               </Box>
               <Box sx={{ textAlign: 'center' }}>
                 <Typography variant="caption" display="block" color="text.secondary">Sorties (filtre)</Typography>
                 <Typography variant="body1" color="error.main" fontWeight="bold">-{formatCurrency(stats.cdfOut, 'CDF')}</Typography>
               </Box>
            </Stack>
          </Paper>
        </Grid>
      </Grid>

      {/* Movements History */}
      <Paper sx={{ p: 2 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2, flexWrap: 'wrap', gap: 2 }}>
          <Box sx={{ display: 'flex', alignItems: 'center' }}>
            <History sx={{ mr: 1, color: 'text.secondary' }} />
            <Typography variant="h6">Historique des mouvements</Typography>
          </Box>
          <Stack direction="row" spacing={1}>
             <Button 
               variant="outlined" 
               startIcon={<FileDownload />} 
               onClick={handleExportExcel}
               disabled={filteredMouvements.length === 0}
             >
               Excel
             </Button>
             <Button 
               variant="outlined" 
               startIcon={<PictureAsPdf />} 
               onClick={handleExportPDF}
               disabled={filteredMouvements.length === 0}
             >
               PDF
             </Button>
          </Stack>
        </Box>

        {/* Filters */}
        <Box sx={{ mb: 3, p: 2, bgcolor: '#f5f5f5', borderRadius: 1 }}>
          <Grid container spacing={2} alignItems="center">
            <Grid size={{ xs: 12, md: 3 }}>
              <TextField
                label="Date début"
                type="date"
                fullWidth
                size="small"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                InputLabelProps={{ shrink: true }}
              />
            </Grid>
            <Grid size={{ xs: 12, md: 3 }}>
              <TextField
                label="Date fin"
                type="date"
                fullWidth
                size="small"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                InputLabelProps={{ shrink: true }}
              />
            </Grid>
            <Grid size={{ xs: 12, md: 6 }}>
              <TextField
                label="Rechercher..."
                fullWidth
                size="small"
                value={filterText}
                onChange={(e) => setFilterText(e.target.value)}
                placeholder="Description, montant, type..."
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <SearchIcon color="action" />
                    </InputAdornment>
                  ),
                }}
              />
            </Grid>
          </Grid>
        </Box>

        <TableContainer>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Date</TableCell>
                <TableCell>Type</TableCell>
                <TableCell>Description</TableCell>
                <TableCell align="right">Montant</TableCell>
                <TableCell>Devise</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {filteredMouvements.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} align="center">Aucun mouvement trouvé</TableCell>
                </TableRow>
              ) : (
                filteredMouvements
                  .slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage)
                  .map((mouv) => (
                  <TableRow key={mouv.id}>
                    <TableCell>{formatDate(mouv.created_at)}</TableCell>
                    <TableCell>
                      <Chip 
                        icon={mouv.type_mouvement === 'entree' ? <TrendingUp /> : <TrendingDown />}
                        label={mouv.type_mouvement === 'entree' ? 'Entrée' : 'Sortie'} 
                        color={mouv.type_mouvement === 'entree' ? 'success' : 'error'}
                        size="small"
                        variant="outlined"
                      />
                    </TableCell>
                    <TableCell>
                      {(() => {
                        const reqNumber = extractRequisitionNumber(mouv.description);
                        if (reqNumber) {
                          return (
                            <Box sx={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 0.5 }}>
                              <Typography variant="body2">
                                {mouv.description.replace(reqNumber, '').trim()}
                              </Typography>
                              <Chip 
                                label={reqNumber} 
                                size="small" 
                                color="primary" 
                                variant="outlined" 
                                onClick={() => handleViewRequisition(reqNumber)}
                                sx={{ cursor: 'pointer', '&:hover': { bgcolor: 'primary.50' } }}
                                icon={<Visibility fontSize="small" />}
                              />
                            </Box>
                          );
                        }
                        return mouv.description || '-';
                      })()}
                    </TableCell>
                    <TableCell align="right" sx={{ 
                      fontWeight: 'bold', 
                      color: mouv.type_mouvement === 'entree' ? 'success.main' : 'error.main'
                    }}>
                      {mouv.type_mouvement === 'entree' ? '+' : '-'}{formatCurrency(mouv.montant, mouv.devise)}
                    </TableCell>
                    <TableCell>{mouv.devise}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TableContainer>
        <TablePagination
          rowsPerPageOptions={[5, 10, 25, 50]}
          component="div"
          count={filteredMouvements.length}
          rowsPerPage={rowsPerPage}
          page={page}
          onPageChange={handleChangePage}
          onRowsPerPageChange={handleChangeRowsPerPage}
          labelRowsPerPage="Lignes par page"
          labelDisplayedRows={({ from, to, count }) => `${from}-${to} sur ${count}`}
        />
      </Paper>

      {/* Ravitaillement Dialog */}
      <Dialog open={openDialog} onClose={handleCloseDialog} maxWidth="sm" fullWidth>
        <DialogTitle>Ravitailler la Caisse</DialogTitle>
        <DialogContent>
          <Box sx={{ mt: 2 }}>
            <TextField
              select
              label="Devise"
              fullWidth
              value={formData.devise}
              onChange={(e) => setFormData({ ...formData, devise: e.target.value })}
              sx={{ mb: 2 }}
            >
              <MenuItem value="USD">USD</MenuItem>
              <MenuItem value="CDF">CDF</MenuItem>
            </TextField>
            <TextField
              label="Montant"
              type="number"
              fullWidth
              value={formData.montant}
              onChange={(e) => setFormData({ ...formData, montant: e.target.value })}
              sx={{ mb: 2 }}
              InputProps={{
                startAdornment: <AttachMoney sx={{ color: 'text.secondary', mr: 1 }} />,
              }}
            />
            <TextField
              label="Description / Motif"
              fullWidth
              multiline
              rows={3}
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Ex: Ravitaillement mensuel, Retour de fonds..."
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseDialog} disabled={submitLoading}>Annuler</Button>
          <Button 
            onClick={handleSubmit} 
            variant="contained" 
            disabled={submitLoading}
          >
            {submitLoading ? <CircularProgress size={24} /> : 'Confirmer'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Requisition Details Dialog */}
      <Dialog 
        open={showDetails} 
        onClose={() => setShowDetails(false)} 
        maxWidth="md" 
        fullWidth
      >
        {loadingDetails ? (
          <Box sx={{ p: 4, display: 'flex', justifyContent: 'center' }}>
            <CircularProgress />
          </Box>
        ) : selectedRequisition ? (
          <>
            <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Box sx={{ display: 'flex', alignItems: 'center' }}>
                Réquisition {selectedRequisition.reference}
                <Chip 
                  label={selectedRequisition.statut} 
                  color={selectedRequisition.statut === 'payee' ? 'success' : 'default'} 
                  size="small" 
                  sx={{ ml: 2 }} 
                />
              </Box>
              <IconButton onClick={() => setShowDetails(false)}>
                <Close />
              </IconButton>
            </DialogTitle>
            <DialogContent dividers>
              <Tabs value={detailsTab} onChange={(e, v) => setDetailsTab(v)} sx={{ mb: 2 }}>
                <Tab label="Informations" />
                <Tab label="Lignes" />
                <Tab label="Pièces jointes" />
                <Tab label="Historique" />
              </Tabs>

              {detailsTab === 0 && (
                <Grid container spacing={2}>
                  <Grid size={{ xs: 12 }}>
                    <Typography variant="subtitle2" color="text.secondary">Objet</Typography>
                    <Typography variant="body1" sx={{ fontWeight: 'bold' }}>{selectedRequisition.objet}</Typography>
                  </Grid>
                  <Grid size={{ xs: 6 }}>
                    <Typography variant="subtitle2" color="text.secondary">Montant Total</Typography>
                    <Typography variant="h6" color="primary">
                      {formatCurrency(selectedRequisition.montant, selectedRequisition.devise)}
                    </Typography>
                  </Grid>
                  <Grid size={{ xs: 6 }}>
                    <Typography variant="subtitle2" color="text.secondary">Date de création</Typography>
                    <Typography variant="body1">{formatDate(selectedRequisition.created_at)}</Typography>
                  </Grid>
                  <Grid size={{ xs: 6 }}>
                    <Typography variant="subtitle2" color="text.secondary">Demandeur</Typography>
                    <Typography variant="body1">{selectedRequisition.emetteur_nom}</Typography>
                  </Grid>
                  <Grid size={{ xs: 6 }}>
                    <Typography variant="subtitle2" color="text.secondary">Service</Typography>
                    <Typography variant="body1">{selectedRequisition.service_nom}</Typography>
                  </Grid>
                  {selectedRequisition.site_nom && (
                    <Grid size={{ xs: 6 }}>
                      <Typography variant="subtitle2" color="text.secondary">Site</Typography>
                      <Typography variant="body1">{selectedRequisition.site_nom}</Typography>
                    </Grid>
                  )}
                </Grid>
              )}

              {detailsTab === 1 && (
                 <TableContainer component={Paper} variant="outlined">
                   <Table size="small">
                     <TableHead>
                       <TableRow>
                         <TableCell>Description</TableCell>
                         <TableCell align="right">Qte</TableCell>
                         <TableCell align="right">Prix Unit.</TableCell>
                         <TableCell align="right">Total</TableCell>
                       </TableRow>
                     </TableHead>
                     <TableBody>
                       {selectedRequisition.items?.map((item, index) => (
                         <TableRow key={index}>
                           <TableCell>{item.description}</TableCell>
                           <TableCell align="right">{item.quantite}</TableCell>
                           <TableCell align="right">{formatCurrency(item.prix_unitaire, selectedRequisition.devise)}</TableCell>
                           <TableCell align="right">{formatCurrency(item.prix_total, selectedRequisition.devise)}</TableCell>
                         </TableRow>
                       ))}
                       {(!selectedRequisition.items || selectedRequisition.items.length === 0) && (
                         <TableRow>
                           <TableCell colSpan={4} align="center">Aucune ligne</TableCell>
                         </TableRow>
                       )}
                     </TableBody>
                   </Table>
                 </TableContainer>
              )}

              {detailsTab === 2 && (
                <List>
                  {selectedRequisition.pieces_jointes_data?.map((pj, index) => (
                    <ListItem key={index}>
                      <ListItemIcon>
                        <AttachFile />
                      </ListItemIcon>
                      <ListItemText 
                        primary={pj.nom_fichier}
                        secondary={`Ajouté le ${formatDate(pj.created_at)}`} 
                      />
                      <Button 
                        size="small" 
                        href={`${API_BASE_URL}/uploads/${pj.chemin_fichier}`} 
                        target="_blank"
                        startIcon={<Visibility />}
                      >
                        Ouvrir
                      </Button>
                    </ListItem>
                  ))}
                  {(!selectedRequisition.pieces_jointes_data || selectedRequisition.pieces_jointes_data.length === 0) && (
                    <Typography variant="body2" color="text.secondary" align="center" sx={{ py: 2 }}>
                      Aucune pièce jointe
                    </Typography>
                  )}
                </List>
              )}

              {detailsTab === 3 && (
                <List>
                  {selectedRequisition.actions?.map((action, index) => (
                    <React.Fragment key={index}>
                      <ListItem alignItems="flex-start">
                        <ListItemText 
                          primary={action.action}
                          secondary={
                            <>
                              <Typography component="span" variant="body2" color="text.primary">
                                {action.utilisateur_nom}
                              </Typography>
                              {" — " + formatDate(action.created_at)}
                              {action.commentaire && (
                                <>
                                  <br />
                                  <Typography component="span" variant="body2" color="text.secondary" sx={{ fontStyle: 'italic' }}>
                                    "{action.commentaire}"
                                  </Typography>
                                </>
                              )}
                            </>
                          }
                        />
                      </ListItem>
                      {index < (selectedRequisition.actions?.length || 0) - 1 && <Divider component="li" />}
                    </React.Fragment>
                  ))}
                  {(!selectedRequisition.actions || selectedRequisition.actions.length === 0) && (
                    <Typography variant="body2" color="text.secondary" align="center" sx={{ py: 2 }}>
                      Aucun historique
                    </Typography>
                  )}
                </List>
              )}

            </DialogContent>
            <DialogActions>
              <Button onClick={() => setShowDetails(false)}>Fermer</Button>
            </DialogActions>
          </>
        ) : (
          <DialogContent>
            <Typography color="error">Impossible de charger les détails</Typography>
          </DialogContent>
        )}
      </Dialog>
    </Container>
  );
};

export default FundsPage;