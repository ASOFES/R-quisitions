import React, { useState, useEffect, useMemo } from 'react';
import { 
  Container, 
  Typography, 
  Box, 
  Button, 
  Paper, 
  Table, 
  TableBody, 
  TableCell, 
  TableContainer, 
  TableHead, 
  TableRow,
  Checkbox,
  Chip,
  Alert,
  CircularProgress,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Grid,
  IconButton,
  Tooltip,
  Tabs,
  Tab,
  Stack,
  TablePagination,
  FormControl,
  FormLabel,
  RadioGroup,
  FormControlLabel,
  Radio
} from '@mui/material';
import { 
  ArrowBack, 
  Payment as PaymentIcon, 
  CheckCircle,
  AttachFile,
  Info,
  History,
  PictureAsPdf,
  TableView,
  FilterList
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import api, { Requisition } from '../services/api';

interface Payment {
  id: number;
  requisition_id: number;
  montant_usd: number | null;
  montant_cdf: number | null;
  commentaire: string;
  date_paiement: string;
  req_numero: string;
  req_objet: string;
  emetteur_nom: string;
  comptable_nom: string;
  date_demande: string;
}

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
        <Box sx={{ py: 3 }}>
          {children}
        </Box>
      )}
    </div>
  );
}

const PaymentsPage: React.FC = () => {
  const navigate = useNavigate();
  const [tabValue, setTabValue] = useState(0);
  
  // States for "À payer"
  const [requisitions, setRequisitions] = useState<Requisition[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [openDialog, setOpenDialog] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [paymentComment, setPaymentComment] = useState('');
  const [paymentMode, setPaymentMode] = useState('Cash');
  
  // Filters for "À payer"
  const [payStartDate, setPayStartDate] = useState('');
  const [payEndDate, setPayEndDate] = useState('');
  const [payFilterText, setPayFilterText] = useState('');

  // States for "Historique"
  const [history, setHistory] = useState<Payment[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [filterText, setFilterText] = useState('');

  // Pagination states
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [historyPage, setHistoryPage] = useState(0);
  const [historyRowsPerPage, setHistoryRowsPerPage] = useState(10);



  const fetchRequisitions = async () => {
    try {
      setLoading(true);
      const response = await api.get('/payments/a-payer');
      // Ensure nb_pieces is handled correctly
      const formattedData = response.data.map((req: any) => ({
        ...req,
        nb_pieces: req.nb_pieces || 0
      }));
      console.log('Requisitions loaded:', formattedData);
      setRequisitions(formattedData);
      setError(null);
    } catch (err) {
      console.error('Erreur chargement réquisitions:', err);
      setError('Impossible de charger les réquisitions à payer.');
    } finally {
      setLoading(false);
    }
  };

  const fetchHistory = async () => {
    try {
      setLoadingHistory(true);
      const response = await api.get('/payments/historique');
      setHistory(response.data);
    } catch (err) {
      console.error('Erreur chargement historique:', err);
    } finally {
      setLoadingHistory(false);
    }
  };

  useEffect(() => {
    if (tabValue === 0) {
      fetchRequisitions();
    } else {
      fetchHistory();
    }
  }, [tabValue]);

  const handleTabChange = (event: React.SyntheticEvent, newValue: number) => {
    setTabValue(newValue);
  };

  const handleChangePage = (event: unknown, newPage: number) => {
    setPage(newPage);
  };

  const handleChangeRowsPerPage = (event: React.ChangeEvent<HTMLInputElement>) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
  };

  const handleChangeHistoryPage = (event: unknown, newPage: number) => {
    setHistoryPage(newPage);
  };

  const handleChangeHistoryRowsPerPage = (event: React.ChangeEvent<HTMLInputElement>) => {
    setHistoryRowsPerPage(parseInt(event.target.value, 10));
    setHistoryPage(0);
  };

  const handleSelectAll = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.checked) {
      // Select all visible (filtered) requisitions
      const visibleIds = filteredRequisitions.map(r => r.id);
      // Merge with already selected ones to avoid deselecting hidden ones (optional, but safer is just to select visible)
      // Or just replace selection with visible ones? 
      // Standard behavior: "Select All" usually selects all VISIBLE items.
      // If I have some selected, filter, and select all, I probably want to add to selection.
      // But for simplicity, let's just select all visible ones.
      // Actually, if I filter, select all, I expect only those to be selected? 
      // Let's union them.
      const newSelected = Array.from(new Set([...selectedIds, ...visibleIds]));
      setSelectedIds(newSelected);
    } else {
      // Deselect all visible requisitions
      const visibleIds = filteredRequisitions.map(r => r.id);
      setSelectedIds(selectedIds.filter(id => !visibleIds.includes(id)));
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

  const calculateTotal = (currency: 'USD' | 'CDF') => {
    return requisitions
      .filter(r => selectedIds.includes(r.id))
      .reduce((total, r) => {
        if (currency === 'USD') return total + (Number(r.montant_usd) || 0);
        if (currency === 'CDF') return total + (Number(r.montant_cdf) || 0);
        return total;
      }, 0);
  };

  const formatCurrency = (amount: number, currency: string) => {
    return new Intl.NumberFormat('fr-CD', { 
      style: 'currency', 
      currency: currency 
    }).format(amount);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('fr-FR', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const filteredRequisitions = useMemo(() => {
    return requisitions.filter(req => {
      const reqDate = new Date(req.created_at);
      const start = payStartDate ? new Date(payStartDate) : null;
      const end = payEndDate ? new Date(payEndDate) : null;
      
      if (end) end.setHours(23, 59, 59, 999);

      const matchesDate = (!start || reqDate >= start) && (!end || reqDate <= end);
      const searchLower = payFilterText.toLowerCase();
      const matchesText = 
        req.numero.toLowerCase().includes(searchLower) ||
        req.objet.toLowerCase().includes(searchLower) ||
        req.emetteur_nom.toLowerCase().includes(searchLower) ||
        (req.service_code && req.service_code.toLowerCase().includes(searchLower));

      return matchesDate && matchesText;
    });
  }, [requisitions, payStartDate, payEndDate, payFilterText]);

  const filteredHistory = useMemo(() => {
    return history.filter(payment => {
      const paymentDate = new Date(payment.date_paiement);
      const start = startDate ? new Date(startDate) : null;
      const end = endDate ? new Date(endDate) : null;
      
      // Adjust end date to include the whole day
      if (end) end.setHours(23, 59, 59, 999);

      const matchesDate = 
        (!start || paymentDate >= start) && 
        (!end || paymentDate <= end);

      const searchLower = filterText.toLowerCase();
      const matchesText = 
        payment.req_numero.toLowerCase().includes(searchLower) ||
        payment.req_objet.toLowerCase().includes(searchLower) ||
        payment.emetteur_nom.toLowerCase().includes(searchLower) ||
        payment.comptable_nom.toLowerCase().includes(searchLower) ||
        (payment.commentaire && payment.commentaire.toLowerCase().includes(searchLower));

      return matchesDate && matchesText;
    });
  }, [history, startDate, endDate, filterText]);

  const historyStats = useMemo(() => {
    return filteredHistory.reduce((acc, p) => {
      acc.totalUSD += Number(p.montant_usd) || 0;
      acc.totalCDF += Number(p.montant_cdf) || 0;
      return acc;
    }, { totalUSD: 0, totalCDF: 0 });
  }, [filteredHistory]);

  const handleExportExcelRequisitions = () => {
    const dataToExport = filteredRequisitions.map(r => ({
      'Date Demande': formatDate(r.created_at),
      'Numéro': r.numero,
      'Objet': r.objet,
      'Service': r.service_code,
      'Initiateur': r.emetteur_nom,
      'Mode': r.mode_paiement || 'Non défini',
      'Montant USD': r.montant_usd || 0,
      'Montant CDF': r.montant_cdf || 0,
      'Pièces': r.nb_pieces || 0
    }));

    const ws = XLSX.utils.json_to_sheet(dataToExport);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "À Payer");
    XLSX.writeFile(wb, `requisitions_a_payer_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  const handleExportPDFRequisitions = () => {
    const doc = new jsPDF({ orientation: "landscape" });
    
    doc.setFontSize(18);
    doc.text("Réquisitions à Payer", 14, 15);
    
    doc.setFontSize(10);
    doc.text(`Généré le : ${new Date().toLocaleDateString('fr-FR')}`, 14, 22);
    if (payStartDate || payEndDate) {
      doc.text(`Période : ${payStartDate || 'Début'} au ${payEndDate || 'Fin'}`, 14, 28);
    }

    const tableColumn = [
      { header: "Date", dataKey: "date" },
      { header: "N° Req", dataKey: "numero" },
      { header: "Objet", dataKey: "objet" },
      { header: "Service", dataKey: "service" },
      { header: "Initiateur", dataKey: "emetteur" },
      { header: "Mode", dataKey: "mode" },
      { header: "Montant USD", dataKey: "usd" },
      { header: "Montant CDF", dataKey: "cdf" },
      { header: "Pièces", dataKey: "pieces" }
    ];

    const formatMoneyPDF = (amount: number | null | undefined, currency: string) => {
      if (!amount) return '-';
      const val = amount.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
      return `${val.replace(/[\u00A0\u202F]/g, ' ')} ${currency}`;
    };

    const tableRows = filteredRequisitions.map(r => ({
      date: new Date(r.created_at).toLocaleDateString('fr-FR'),
      numero: r.numero,
      objet: r.objet,
      service: r.service_code,
      emetteur: r.emetteur_nom,
      mode: r.mode_paiement || '-',
      usd: formatMoneyPDF(r.montant_usd, 'USD'),
      cdf: formatMoneyPDF(r.montant_cdf, 'CDF'),
      pieces: r.nb_pieces || '-'
    }));

    autoTable(doc, {
      columns: tableColumn,
      body: tableRows,
      startY: 35,
      theme: 'grid',
      headStyles: { fillColor: [46, 125, 50], textColor: 255, fontStyle: 'bold' }, // Green for "To Pay"
      styles: { fontSize: 9, cellPadding: 3 },
      columnStyles: {
        usd: { halign: 'right', fontStyle: 'bold', textColor: [46, 125, 50] },
        cdf: { halign: 'right', fontStyle: 'bold', textColor: [198, 40, 40] },
      }
    });

    doc.save(`requisitions_a_payer_${new Date().toISOString().split('T')[0]}.pdf`);
  };

  const handleExportExcel = () => {
    const title = [["REQUISITIONS APP - Historique des Paiements"]];
    const dateInfo = [[`Généré le : ${new Date().toLocaleDateString('fr-FR')}`]];
    const periodInfo = (startDate || endDate) ? [[`Période : ${startDate || 'Début'} au ${endDate || 'Fin'}`]] : [];
    
    const headers = [["Date Paiement", "Date Demande", "Numéro Réquisition", "Objet", "Initiateur", "Montant USD", "Montant CDF", "Payé par", "Mode", "Commentaire"]];
    
    const data = filteredHistory.map(p => [
      formatDate(p.date_paiement),
      formatDate(p.date_demande),
      p.req_numero,
      p.req_objet,
      p.emetteur_nom,
      p.montant_usd || 0,
      p.montant_cdf || 0,
      p.comptable_nom,
      (p as any).mode_paiement || '-',
      p.commentaire
    ]);

    const wsData = [...title, ...dateInfo, ...periodInfo, [""], ...headers, ...data];
    const ws = XLSX.utils.aoa_to_sheet(wsData);

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Historique Paiements");
    XLSX.writeFile(wb, `historique_paiements_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  const handleExportPDF = () => {
    const doc = new jsPDF();

    doc.setFontSize(18);
    doc.text("Historique de Trésorerie", 14, 15);

    doc.setFontSize(10);
    doc.text(`Généré le : ${new Date().toLocaleDateString('fr-FR')}`, 14, 22);
    if (startDate || endDate) {
      doc.text(`Période : ${startDate || 'Début'} au ${endDate || 'Fin'}`, 14, 28);
    }

    // Définition des colonnes
    const tableColumn = [
      { header: "Date", dataKey: "date" },
      { header: "N° Req", dataKey: "numero" },
      { header: "Objet", dataKey: "objet" },
      { header: "Initiateur", dataKey: "beneficiaire" },
      { header: "Montant USD", dataKey: "usd" },
      { header: "Montant CDF", dataKey: "cdf" },
      { header: "Payé par", dataKey: "paye_par" },
      { header: "Mode", dataKey: "mode" }
    ];

    // Formatage simple pour le PDF (évite les caractères invisibles de Intl.NumberFormat qui cassent le PDF)
    const formatMoneyPDF = (amount: number | null, currency: string) => {
      if (!amount) return '-';
      // Utilisation de toLocaleString puis remplacement forcé des espaces insécables par des espaces simples
      // \u00A0 est l'espace insécable standard, \u202F est l'espace insécable fine
      const val = amount.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
      return `${val.replace(/[\u00A0\u202F]/g, ' ')} ${currency}`;
    };

    const tableRows = filteredHistory.map(p => ({
      date: new Date(p.date_paiement).toLocaleDateString('fr-FR'),
      numero: p.req_numero,
      objet: p.req_objet,
      beneficiaire: p.emetteur_nom,
      usd: formatMoneyPDF(p.montant_usd, 'USD'),
      cdf: formatMoneyPDF(p.montant_cdf, 'CDF'),
      paye_par: p.comptable_nom,
      mode: (p as any).mode_paiement || '-'
    }));

    autoTable(doc, {
      columns: tableColumn,
      body: tableRows,
      startY: 35,
      theme: 'grid',
      headStyles: { fillColor: [41, 128, 185], textColor: 255, fontStyle: 'bold' },
      styles: { fontSize: 9, cellPadding: 3 },
      columnStyles: {
        usd: { halign: 'right', fontStyle: 'bold', textColor: [46, 125, 50] }, // Vert pour l'argent
        cdf: { halign: 'right', fontStyle: 'bold', textColor: [198, 40, 40] }, // Rouge (ou autre) pour CDF
      },
      didParseCell: (data) => {
        // Ajustement si nécessaire
      }
    });

    doc.save(`historique_paiements_${new Date().toISOString().split('T')[0]}.pdf`);
  };

  const handleOpenPaymentDialog = () => {
    setPaymentComment('');
    setOpenDialog(true);
  };

  const handleCloseDialog = () => {
    setOpenDialog(false);
  };

  const handleProcessPayment = async () => {
    if (selectedIds.length === 0) return;

    try {
      setProcessing(true);
      await api.post('/payments/effectuer', {
        requisition_ids: selectedIds,
        commentaire: paymentComment || 'Paiement effectué',
        mode_paiement: paymentMode
      });
      
      handleCloseDialog();
      setSelectedIds([]);
      fetchRequisitions();
      // Show success message could be added here
    } catch (err: any) {
      console.error('Erreur paiement:', err);
      alert(err.response?.data?.error || 'Erreur lors du paiement');
    } finally {
      setProcessing(false);
    }
  };

  const totalUSD = calculateTotal('USD');
  const totalCDF = calculateTotal('CDF');

  return (
    <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', mb: 4, justifyContent: 'space-between' }}>
        <Box sx={{ display: 'flex', alignItems: 'center' }}>
          <Button onClick={() => navigate('/dashboard')} startIcon={<ArrowBack />} sx={{ mr: 2 }}>
            Retour
          </Button>
          <Typography variant="h4">Gestion des fonds</Typography>
        </Box>
      </Box>

      <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
        <Tabs value={tabValue} onChange={handleTabChange} aria-label="payment tabs">
          <Tab icon={<PaymentIcon />} label="À Payer" iconPosition="start" />
          <Tab icon={<History />} label="Historique" iconPosition="start" />
        </Tabs>
      </Box>

      {/* Tab 1: À Payer */}
      <TabPanel value={tabValue} index={0}>
        <Paper sx={{ p: 2, mb: 3 }}>
          <Grid container spacing={2} alignItems="center">
            <Grid size={{ xs: 12, md: 3 }}>
              <TextField
                label="Date début"
                type="date"
                fullWidth
                InputLabelProps={{ shrink: true }}
                value={payStartDate}
                onChange={(e) => setPayStartDate(e.target.value)}
                size="small"
              />
            </Grid>
            <Grid size={{ xs: 12, md: 3 }}>
              <TextField
                label="Date fin"
                type="date"
                fullWidth
                InputLabelProps={{ shrink: true }}
                value={payEndDate}
                onChange={(e) => setPayEndDate(e.target.value)}
                size="small"
              />
            </Grid>
            <Grid size={{ xs: 12, md: 3 }}>
              <TextField
                label="Recherche..."
                fullWidth
                value={payFilterText}
                onChange={(e) => setPayFilterText(e.target.value)}
                size="small"
                InputProps={{
                  endAdornment: <FilterList color="action" />
                }}
              />
            </Grid>
            <Grid size={{ xs: 12, md: 3 }}>
              <Stack direction="row" spacing={1}>
                <Button 
                  variant="outlined" 
                  startIcon={<TableView />} 
                  onClick={handleExportExcelRequisitions}
                  fullWidth
                  disabled={filteredRequisitions.length === 0}
                >
                  Excel
                </Button>
                <Button 
                  variant="outlined" 
                  color="error" 
                  startIcon={<PictureAsPdf />} 
                  onClick={handleExportPDFRequisitions}
                  fullWidth
                  disabled={filteredRequisitions.length === 0}
                >
                  PDF
                </Button>
              </Stack>
            </Grid>
          </Grid>
        </Paper>

        <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: 2 }}>
          <Button 
            variant="contained" 
            color="success" 
            startIcon={<PaymentIcon />}
            disabled={selectedIds.length === 0}
            onClick={handleOpenPaymentDialog}
          >
            Payer la sélection ({selectedIds.length})
          </Button>
        </Box>

        {loading ? (
           <Box sx={{ display: 'flex', justifyContent: 'center', mt: 5 }}>
             <CircularProgress />
           </Box>
        ) : (
          <>
            {error && <Alert severity="error" sx={{ mb: 3 }}>{error}</Alert>}

            {selectedIds.length > 0 && (
              <Paper sx={{ p: 2, mb: 3, bgcolor: '#f1f8e9', border: '1px solid #c5e1a5' }}>
                <Typography variant="subtitle1" gutterBottom sx={{ fontWeight: 'bold' }}>
                  Total à payer pour la sélection :
                </Typography>
                <Box sx={{ display: 'flex', gap: 4 }}>
                  <Typography variant="h6" color="primary.main">
                    USD: {formatCurrency(totalUSD, 'USD')}
                  </Typography>
                  <Typography variant="h6" color="secondary.main">
                    CDF: {formatCurrency(totalCDF, 'CDF')}
                  </Typography>
                </Box>
              </Paper>
            )}

            <Paper sx={{ width: '100%', mb: 2 }}>
              <TableContainer>
                <Table>
                  <TableHead>
                    <TableRow>
                      <TableCell padding="checkbox">
                        <Checkbox
                          indeterminate={selectedIds.length > 0 && selectedIds.length < filteredRequisitions.length}
                          checked={filteredRequisitions.length > 0 && filteredRequisitions.every(r => selectedIds.includes(r.id))}
                          onChange={handleSelectAll}
                        />
                      </TableCell>
                      <TableCell>Numéro</TableCell>
                      <TableCell>Objet</TableCell>
                      <TableCell>Service</TableCell>
                      <TableCell>Initiateur</TableCell>
                      <TableCell>Mode</TableCell>
                      <TableCell align="right">Montant USD</TableCell>
                      <TableCell align="right">Montant CDF</TableCell>
                      <TableCell align="center">Pièces</TableCell>
                      <TableCell align="center">Actions</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {filteredRequisitions.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={9} align="center">
                          {requisitions.length === 0 ? "Aucune réquisition en attente de paiement" : "Aucun résultat pour ces filtres"}
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredRequisitions
                        .slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage)
                        .map((req) => {
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
                                disabled={!req.mode_paiement}
                              />
                            </TableCell>
                            <TableCell sx={{ fontWeight: 'bold' }}>{req.numero}</TableCell>
                            <TableCell>{req.objet}</TableCell>
                            <TableCell>
                              <Chip label={req.service_code} size="small" variant="outlined" />
                            </TableCell>
                            <TableCell>{req.emetteur_nom}</TableCell>
                            <TableCell>
                              {req.mode_paiement ? (
                                <Chip label={req.mode_paiement} color={req.mode_paiement === 'Cash' ? 'success' : 'primary'} size="small" />
                              ) : (
                                <Typography variant="caption" color="error">À définir</Typography>
                              )}
                            </TableCell>
                            <TableCell align="right">
                              {req.montant_usd ? formatCurrency(req.montant_usd, 'USD') : '-'}
                            </TableCell>
                            <TableCell align="right">
                              {req.montant_cdf ? formatCurrency(req.montant_cdf, 'CDF') : '-'}
                            </TableCell>
                            <TableCell align="center">
                              {(req.nb_pieces && req.nb_pieces > 0) ? (
                                <Chip 
                                  icon={<AttachFile />} 
                                  label={req.nb_pieces} 
                                  size="small" 
                                  color="info" 
                                  variant="outlined" 
                                />
                              ) : (
                                <Typography variant="caption" color="text.secondary">-</Typography>
                              )}
                            </TableCell>
                            <TableCell align="center">
                               <Tooltip title="Voir détails">
                                 <IconButton 
                                   size="small" 
                                   onClick={(e) => {
                                     e.stopPropagation();
                                     navigate(`/requisitions/${req.id}`);
                                   }}
                                 >
                                   <Info fontSize="small" />
                                 </IconButton>
                               </Tooltip>
                            </TableCell>
                          </TableRow>
                        );
                      })
                    )}
                  </TableBody>
                </Table>
              </TableContainer>
              <TablePagination
                rowsPerPageOptions={[5, 10, 25, 50]}
                component="div"
                count={filteredRequisitions.length}
                rowsPerPage={rowsPerPage}
                page={page}
                onPageChange={handleChangePage}
                onRowsPerPageChange={handleChangeRowsPerPage}
                labelRowsPerPage="Lignes par page"
                labelDisplayedRows={({ from, to, count }) => `${from}-${to} sur ${count}`}
              />
            </Paper>
          </>
        )}
      </TabPanel>

      {/* Tab 2: Historique */}
      <TabPanel value={tabValue} index={1}>
        <Paper sx={{ p: 2, mb: 3 }}>
          <Grid container spacing={2} alignItems="center">
            <Grid size={{ xs: 12, md: 3 }}>
              <TextField
                label="Date début"
                type="date"
                fullWidth
                InputLabelProps={{ shrink: true }}
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                size="small"
              />
            </Grid>
            <Grid size={{ xs: 12, md: 3 }}>
              <TextField
                label="Date fin"
                type="date"
                fullWidth
                InputLabelProps={{ shrink: true }}
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                size="small"
              />
            </Grid>
            <Grid size={{ xs: 12, md: 3 }}>
              <TextField
                label="Recherche..."
                fullWidth
                value={filterText}
                onChange={(e) => setFilterText(e.target.value)}
                size="small"
                InputProps={{
                  endAdornment: <FilterList color="action" />
                }}
              />
            </Grid>
            <Grid size={{ xs: 12, md: 3 }}>
              <Stack direction="row" spacing={1}>
                <Button 
                  variant="outlined" 
                  startIcon={<TableView />} 
                  onClick={handleExportExcel}
                  fullWidth
                  disabled={filteredHistory.length === 0}
                >
                  Excel
                </Button>
                <Button 
                  variant="outlined" 
                  color="error" 
                  startIcon={<PictureAsPdf />} 
                  onClick={handleExportPDF}
                  fullWidth
                  disabled={filteredHistory.length === 0}
                >
                  PDF
                </Button>
              </Stack>
            </Grid>
          </Grid>
        </Paper>

        {/* Statistics Section for History */}
        {!loadingHistory && filteredHistory.length > 0 && (
          <Paper sx={{ p: 2, mb: 3, bgcolor: '#e3f2fd', border: '1px solid #90caf9' }}>
            <Typography variant="subtitle1" gutterBottom sx={{ fontWeight: 'bold', color: 'text.secondary' }}>
              Total des paiements (sélection) :
            </Typography>
            <Box sx={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
              <Box>
                <Typography variant="caption" display="block" color="text.secondary">Total USD</Typography>
                <Typography variant="h5" color="primary.main" fontWeight="bold">
                  {formatCurrency(historyStats.totalUSD, 'USD')}
                </Typography>
              </Box>
              <Box>
                <Typography variant="caption" display="block" color="text.secondary">Total CDF</Typography>
                <Typography variant="h5" color="secondary.main" fontWeight="bold">
                  {formatCurrency(historyStats.totalCDF, 'CDF')}
                </Typography>
              </Box>
              <Box>
                <Typography variant="caption" display="block" color="text.secondary">Nombre de paiements</Typography>
                <Typography variant="h5" color="text.primary" fontWeight="bold">
                  {filteredHistory.length}
                </Typography>
              </Box>
            </Box>
          </Paper>
        )}

        {loadingHistory ? (
           <Box sx={{ display: 'flex', justifyContent: 'center', mt: 5 }}>
             <CircularProgress />
           </Box>
        ) : (
          <Paper sx={{ width: '100%', mb: 2 }}>
            <TableContainer>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>Date Paiement</TableCell>
                    <TableCell>Réquisition</TableCell>
                    <TableCell>Initiateur</TableCell>
                    <TableCell align="right">Montant Payé</TableCell>
                    <TableCell>Payé par</TableCell>
                    <TableCell>Mode</TableCell>
                    <TableCell>Commentaire</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {filteredHistory.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} align="center">
                        {history.length === 0 ? "Aucun historique de paiement" : "Aucun résultat pour ces filtres"}
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredHistory
                      .slice(historyPage * historyRowsPerPage, historyPage * historyRowsPerPage + historyRowsPerPage)
                      .map((payment) => (
                      <TableRow key={payment.id} hover>
                        <TableCell>{formatDate(payment.date_paiement)}</TableCell>
                        <TableCell>
                          <Typography variant="body2" fontWeight="bold">
                            {payment.req_numero}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            {payment.req_objet}
                          </Typography>
                        </TableCell>
                        <TableCell>{payment.emetteur_nom}</TableCell>
                        <TableCell align="right">
                          {payment.montant_usd && (
                            <Typography variant="body2" color="primary.main">
                              {formatCurrency(payment.montant_usd, 'USD')}
                            </Typography>
                          )}
                          {payment.montant_cdf && (
                            <Typography variant="body2" color="secondary.main">
                              {formatCurrency(payment.montant_cdf, 'CDF')}
                            </Typography>
                          )}
                        </TableCell>
                        <TableCell>{payment.comptable_nom}</TableCell>
                        <TableCell>
                            {(payment as any).mode_paiement ? (
                                <Chip 
                                    label={(payment as any).mode_paiement} 
                                    size="small" 
                                    color={(payment as any).mode_paiement === 'Cash' ? 'success' : 'primary'} 
                                    variant="outlined"
                                />
                            ) : '-'}
                        </TableCell>
                        <TableCell>{payment.commentaire || '-'}</TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </TableContainer>
            <TablePagination
              rowsPerPageOptions={[5, 10, 25, 50, 100]}
              component="div"
              count={filteredHistory.length}
              rowsPerPage={historyRowsPerPage}
              page={historyPage}
              onPageChange={handleChangeHistoryPage}
              onRowsPerPageChange={handleChangeHistoryRowsPerPage}
              labelRowsPerPage="Lignes par page"
              labelDisplayedRows={({ from, to, count }) => `${from}-${to} sur ${count}`}
            />
          </Paper>
        )}
      </TabPanel>

      {/* Payment Confirmation Dialog */}
      <Dialog open={openDialog} onClose={handleCloseDialog} maxWidth="sm" fullWidth>
        <DialogTitle>Confirmer le paiement</DialogTitle>
        <DialogContent>
          <Box sx={{ mt: 2 }}>
            <Alert severity="info" sx={{ mb: 2 }}>
              Vous êtes sur le point de payer {selectedIds.length} réquisition(s).
            </Alert>
            
            <Box sx={{ mb: 3, p: 2, bgcolor: '#f5f5f5', borderRadius: 1 }}>
               <Grid container spacing={2}>
                 <Grid size={{ xs: 6 }}>
                   <Typography variant="body2" color="text.secondary">Total USD</Typography>
                   <Typography variant="h6">{formatCurrency(totalUSD, 'USD')}</Typography>
                 </Grid>
                 <Grid size={{ xs: 6 }}>
                   <Typography variant="body2" color="text.secondary">Total CDF</Typography>
                   <Typography variant="h6">{formatCurrency(totalCDF, 'CDF')}</Typography>
                 </Grid>
               </Grid>
            </Box>

            <FormControl component="fieldset" sx={{ mb: 2, width: '100%' }}>
              <FormLabel component="legend">Mode de Paiement</FormLabel>
              <RadioGroup
                row
                aria-label="mode-paiement"
                name="mode-paiement"
                value={paymentMode}
                onChange={(e) => setPaymentMode(e.target.value)}
              >
                <FormControlLabel value="Cash" control={<Radio />} label="Cash" />
                <FormControlLabel value="Banque" control={<Radio />} label="Banque" />
              </RadioGroup>
            </FormControl>

            <TextField
              label="Note / Commentaire (Optionnel)"
              fullWidth
              multiline
              rows={2}
              value={paymentComment}
              onChange={(e) => setPaymentComment(e.target.value)}
              placeholder="Ex: Payé par virement bancaire..."
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseDialog} disabled={processing}>Annuler</Button>
          <Button 
            onClick={handleProcessPayment} 
            variant="contained" 
            color="success"
            disabled={processing}
            startIcon={processing ? <CircularProgress size={20} /> : <CheckCircle />}
          >
            Confirmer le paiement
          </Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
};

export default PaymentsPage;
