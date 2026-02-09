import React, { useState, useEffect } from 'react';
import {
  Container,
  Typography,
  Box,
  Card,
  CardContent,
  Button,
  Grid,
  TextField,
  MenuItem,
  Alert,
  CircularProgress,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  IconButton,
  Tabs,
  Tab,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  FormControlLabel,
  Switch,
  Chip,
  Tooltip
} from '@mui/material';
import { CloudUpload, Refresh, Search, Print, History, AccountBalanceWallet, PictureAsPdf, TableView, Add, Delete, EditNote } from '@mui/icons-material';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';

interface Budget {
  id: number;
  description: string;
  montant_prevu: number;
  montant_consomme: number;
  mois: string;
  classification?: string;
  is_manual?: boolean;
}

interface BudgetHistoryItem {
  requisition_id: number;
  numero_requisition: string;
  date_creation: string;
  statut: string;
  demandeur: string;
  service: string;
  ligne_budgetaire: string;
  montant: number;
  devise: string;
  montant_prevu?: number;
  montant_consomme?: number;
}

const BudgetsPage: React.FC = () => {
  const { user } = useAuth();
  const [tabValue, setTabValue] = useState(0);
  const [file, setFile] = useState<File | null>(null);
  const [mois, setMois] = useState<string>(new Date().toISOString().slice(0, 7)); // YYYY-MM
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [history, setHistory] = useState<BudgetHistoryItem[]>([]);
  const [search, setSearch] = useState('');
  const [hideUnconsumed, setHideUnconsumed] = useState(false);
  const [openAddDialog, setOpenAddDialog] = useState(false);
  const [newBudgetLine, setNewBudgetLine] = useState({ description: '', montant_prevu: '', classification: 'NON_ALLOUE' });

  const filteredBudgets = budgets.filter(b => {
    const matchesSearch = b.description.toLowerCase().includes(search.toLowerCase()) ||
                          b.classification?.toLowerCase().includes(search.toLowerCase());
    const matchesConsumption = hideUnconsumed ? b.montant_consomme > 0 : true;
    return matchesSearch && matchesConsumption;
  });

  const totalAlloue = filteredBudgets.reduce((sum, b) => sum + Number(b.montant_prevu || 0), 0);
  const totalConsomme = filteredBudgets.reduce((sum, b) => sum + Number(b.montant_consomme || 0), 0);
  const pourcentageGlobal = totalAlloue > 0 ? (totalConsomme / totalAlloue) * 100 : 0;

  useEffect(() => {
    if (tabValue === 0) {
      fetchBudgets();
    } else {
      fetchHistory();
    }
  }, [mois, tabValue]);

  const fetchBudgets = async () => {
    try {
      setLoading(true);
      const response = await api.get(`/budgets?mois=${mois}`);
      setBudgets(response.data);
    } catch (error) {
      console.error('Erreur chargement budgets:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchHistory = async () => {
    try {
      setLoading(true);
      const response = await api.get(`/budgets/history?mois=${mois}`);
      setHistory(response.data);
    } catch (error) {
      console.error('Erreur chargement historique:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAddLine = async () => {
    if (!newBudgetLine.description || !newBudgetLine.montant_prevu) {
      setMessage({ type: 'error', text: 'Veuillez remplir tous les champs obligatoires.' });
      return;
    }

    try {
      await api.post('/budgets/line', {
        ...newBudgetLine,
        mois
      });
      setMessage({ type: 'success', text: 'Ligne budgétaire ajoutée avec succès.' });
      setOpenAddDialog(false);
      setNewBudgetLine({ description: '', montant_prevu: '', classification: 'NON_ALLOUE' });
      fetchBudgets();
    } catch (error: any) {
      console.error('Erreur ajout ligne:', error);
      setMessage({ type: 'error', text: error.response?.data?.error || 'Erreur lors de l\'ajout.' });
    }
  };

  const handleDeleteLine = async (id: number, description: string) => {
    if (window.confirm(`Êtes-vous sûr de vouloir supprimer la ligne budgétaire "${description}" ?`)) {
        try {
            await api.delete(`/budgets/${id}`);
            setMessage({ type: 'success', text: 'Ligne supprimée avec succès.' });
            fetchBudgets();
        } catch (error: any) {
            console.error('Erreur suppression:', error);
            setMessage({ type: 'error', text: error.response?.data?.error || 'Erreur lors de la suppression.' });
        }
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setFile(e.target.files[0]);
    }
  };

  const handleImport = async () => {
    if (!file) {
      setMessage({ type: 'error', text: 'Veuillez sélectionner un fichier Excel.' });
      return;
    }

    setLoading(true);
    setMessage(null);

    const formData = new FormData();
    formData.append('file', file);
    formData.append('mois', mois);
    formData.append('annee', mois.split('-')[0]);

    try {
      const response = await api.post('/budgets/import', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      setMessage({ type: 'success', text: `Import réussi ! ${response.data.count} lignes traitées.` });
      setFile(null);
      fetchBudgets();
    } catch (error: any) {
      console.error('Erreur import:', error);
      setMessage({ type: 'error', text: error.response?.data?.error || 'Erreur lors de l\'importation.' });
    } finally {
      setLoading(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const getLogoBuffer = async (): Promise<{ buffer: ArrayBuffer, format: string } | null> => {
    try {
        // 1. Get logo URL from settings
        const settingsRes = await api.get('/settings/logo');
        const logoUrl = settingsRes.data.url; // e.g., /uploads/logo.png?t=123

        if (logoUrl) {
            // 2. Fetch image data
            // Construct full URL if relative
            let fullUrl = logoUrl;
            if (!logoUrl.startsWith('http')) {
                // Remove /api from baseURL if present to get root URL
                const baseUrl = api.defaults.baseURL?.replace('/api', '') || window.location.origin;
                fullUrl = `${baseUrl}${logoUrl.startsWith('/') ? '' : '/'}${logoUrl}`;
            }
            
            const response = await fetch(fullUrl);
            const blob = await response.blob();
            const buffer = await blob.arrayBuffer();
            
            // Determine format from content-type or extension
            let format = 'PNG';
            const cleanUrl = logoUrl.split('?')[0].toLowerCase();
            
            if (blob.type === 'image/jpeg' || cleanUrl.endsWith('.jpg') || cleanUrl.endsWith('.jpeg')) {
                format = 'JPEG';
            } else if (blob.type === 'image/png' || cleanUrl.endsWith('.png')) {
                format = 'PNG';
            }
            
            return { buffer, format };
        }
    } catch (error) {
        console.warn('Impossible de récupérer le logo pour l\'export', error);
    }
    return null;
  };

  const formatCurrencySafe = (amount: number | undefined | null, currency: string = 'USD') => {
    const val = Number(amount || 0);
    // Use fr-FR for formatting but replace special spaces with standard space to avoid PDF font issues
    return val.toLocaleString('fr-FR', {
        minimumFractionDigits: 0,
        maximumFractionDigits: 2,
        useGrouping: true
    }).replace(/[\u202F\u00A0]/g, ' ') + ' ' + currency;
  };

  const handleExportPDF = async () => {
    const doc = new jsPDF();
    const logoData = await getLogoBuffer();

    if (logoData) {
        const logoUint8 = new Uint8Array(logoData.buffer);
        try {
             // @ts-ignore
             doc.addImage(logoUint8, logoData.format, 14, 10, 30, 30);
        } catch (e) {
            console.warn('Erreur ajout logo PDF', e);
        }
    }

    doc.setFontSize(18);
    doc.text("Historique de Consommation Budgétaire", 50, 25);
    
    doc.setFontSize(11);
    doc.text(`Période: ${mois}`, 50, 32);
    doc.text(`Date d'export: ${new Date().toLocaleDateString()}`, 50, 38);

    const tableColumn = ["Date", "Réquisition", "Demandeur", "Service", "Ligne Budgétaire", "Montant Req.", "Alloué", "Consommé", "Reste", "Statut"];
    const tableRows: any[] = [];

    history.forEach(item => {
        const reste = Number(item.montant_prevu || 0) - Number(item.montant_consomme || 0);
        const rowData = [
            new Date(item.date_creation).toLocaleDateString(),
            item.numero_requisition,
            item.demandeur,
            item.service,
            item.ligne_budgetaire,
            formatCurrencySafe(item.montant, item.devise),
            formatCurrencySafe(item.montant_prevu),
            formatCurrencySafe(item.montant_consomme),
            formatCurrencySafe(reste),
            item.statut
        ];
        tableRows.push(rowData);
    });

    autoTable(doc, {
        head: [tableColumn],
        body: tableRows,
        foot: [[
            "COÛTS TOTAUX",
            "",
            formatCurrencySafe(totalAlloue),
            formatCurrencySafe(totalConsomme),
            formatCurrencySafe(totalAlloue - totalConsomme),
            `${((totalAlloue > 0 ? (totalConsomme / totalAlloue) : 0) * 100).toFixed(0)}%`
        ]],
        startY: 45,
        styles: { fontSize: 8 },
        headStyles: { fillColor: [41, 128, 185] },
        footStyles: { fillColor: [240, 240, 240], textColor: [0, 0, 0], fontStyle: 'bold' },
    });

    const pageCount = doc.getNumberOfPages();
    for(let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setFontSize(8);
        doc.text('Page ' + i + ' / ' + pageCount, 195, 285, { align: 'right' });
    }

    doc.save(`historique_budget_${mois}.pdf`);
  };

  const handleExportExcelEtat = async () => {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Etat Budget');

    // Add Logo if available
    const logoData = await getLogoBuffer();
    if (logoData) {
        const logoId = workbook.addImage({
            buffer: logoData.buffer,
            extension: logoData.format.toLowerCase() as 'png' | 'jpeg',
        });
        worksheet.addImage(logoId, {
            tl: { col: 0, row: 0 },
            ext: { width: 100, height: 100 }
        });
    }

    // Title
    worksheet.mergeCells('C2:H2');
    const titleCell = worksheet.getCell('C2');
    titleCell.value = 'État de Consommation Budgétaire';
    titleCell.font = { name: 'Arial', size: 16, bold: true };
    titleCell.alignment = { vertical: 'middle', horizontal: 'center' };

    worksheet.mergeCells('C3:H3');
    const subtitleCell = worksheet.getCell('C3');
    subtitleCell.value = `Période: ${mois} - Exporté le ${new Date().toLocaleDateString()}`;
    subtitleCell.alignment = { vertical: 'middle', horizontal: 'center' };

    // Header Row
    const headerRowIdx = 6;
    const headers = ["Description", "Catégorie", "Budget Alloué", "Consommé", "Solde", "% Exécution"];
    const headerRow = worksheet.getRow(headerRowIdx);
    headerRow.values = headers;
    
    headerRow.eachCell((cell) => {
        cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
        cell.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FF2980B9' }
        };
        cell.alignment = { vertical: 'middle', horizontal: 'center' };
        cell.border = {
            top: { style: 'thin' },
            left: { style: 'thin' },
            bottom: { style: 'thin' },
            right: { style: 'thin' }
        };
    });

    // Data Rows
    filteredBudgets.forEach((item, index) => {
        const rowIndex = headerRowIdx + 1 + index;
        const row = worksheet.getRow(rowIndex);
        const solde = Number(item.montant_prevu || 0) - Number(item.montant_consomme || 0);
        const percent = Number(item.montant_prevu || 0) > 0 
            ? (Number(item.montant_consomme || 0) / Number(item.montant_prevu || 0))
            : 0;

        row.values = [
            item.description,
            item.classification || '-',
            Number(item.montant_prevu || 0),
            Number(item.montant_consomme || 0),
            solde,
            percent
        ];

        // Styling
        row.getCell(3).numFmt = '#,##0.00 "USD"';
        row.getCell(4).numFmt = '#,##0.00 "USD"';
        row.getCell(5).numFmt = '#,##0.00 "USD"';
        row.getCell(6).numFmt = '0%';

        // Color for Solde
        if (solde < 0) {
            row.getCell(5).font = { color: { argb: 'FFFF0000' }, bold: true };
        } else {
            row.getCell(5).font = { color: { argb: 'FF008000' }, bold: true };
        }
        
        // Color for Percent
        if (percent > 1) { // > 100%
             row.getCell(6).font = { color: { argb: 'FFFF0000' }, bold: true };
        }

        row.eachCell({ includeEmpty: true }, (cell) => {
             cell.border = {
                top: { style: 'thin' },
                left: { style: 'thin' },
                bottom: { style: 'thin' },
                right: { style: 'thin' }
            };
        });
    });

    // Add Total Row
    const totalRowIndex = headerRowIdx + 1 + filteredBudgets.length;
    const totalRow = worksheet.getRow(totalRowIndex);
    const totalSolde = totalAlloue - totalConsomme;
    
    totalRow.values = [
        "COÛTS TOTAUX",
        "",
        totalAlloue,
        totalConsomme,
        totalSolde,
        (totalAlloue > 0 ? (totalConsomme / totalAlloue) : 0)
    ];

    // Styling Total Row
    totalRow.font = { bold: true };
    totalRow.getCell(1).fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFE0E0E0' }
    };
    totalRow.getCell(3).numFmt = '#,##0.00 "USD"';
    totalRow.getCell(4).numFmt = '#,##0.00 "USD"';
    totalRow.getCell(5).numFmt = '#,##0.00 "USD"';
    totalRow.getCell(6).numFmt = '0%';
    
    totalRow.eachCell({ includeEmpty: true }, (cell) => {
         cell.border = {
            top: { style: 'medium' },
            left: { style: 'thin' },
            bottom: { style: 'thin' },
            right: { style: 'thin' }
        };
    });

    // Auto width
    worksheet.columns.forEach(column => {
        column.width = 15;
    });
    worksheet.getColumn(1).width = 40; // Description

    // Save
    const buffer = await workbook.xlsx.writeBuffer();
    saveAs(new Blob([buffer]), `Etat_Budget_${mois}.xlsx`);
  };

  const handleExportPDFEtat = async () => {
    const doc = new jsPDF();
    const logoData = await getLogoBuffer();

    if (logoData) {
        const logoUint8 = new Uint8Array(logoData.buffer);
        try {
             // @ts-ignore
             doc.addImage(logoUint8, logoData.format, 14, 10, 30, 30);
        } catch (e) {
            console.warn('Erreur ajout logo PDF', e);
        }
    }

    doc.setFontSize(18);
    doc.text("État de Consommation Budgétaire", 50, 25);
    
    doc.setFontSize(11);
    doc.text(`Période: ${mois}`, 50, 32);
    doc.text(`Date d'export: ${new Date().toLocaleDateString()}`, 50, 38);

    const tableColumn = ["Description", "Catégorie", "Alloué", "Consommé", "Solde", "%"];
    const tableRows: any[] = [];

    filteredBudgets.forEach(item => {
        const solde = Number(item.montant_prevu || 0) - Number(item.montant_consomme || 0);
        const percent = Number(item.montant_prevu || 0) > 0 
            ? (Number(item.montant_consomme || 0) / Number(item.montant_prevu || 0)) * 100 
            : 0;
            
        const rowData = [
            item.description,
            item.classification || '-',
            formatCurrencySafe(item.montant_prevu),
            formatCurrencySafe(item.montant_consomme),
            formatCurrencySafe(solde),
            `${percent.toFixed(0)}%`
        ];
        tableRows.push(rowData);
    });

    autoTable(doc, {
        head: [tableColumn],
        body: tableRows,
        startY: 45,
        styles: { fontSize: 8 },
        headStyles: { fillColor: [41, 128, 185] },
        columnStyles: {
            0: { cellWidth: 60 }, // Description wider
            2: { halign: 'right' },
            3: { halign: 'right' },
            4: { halign: 'right' },
            5: { halign: 'right' }
        }
    });

    const pageCount = doc.getNumberOfPages();
    for(let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setFontSize(8);
        doc.text('Page ' + i + ' / ' + pageCount, 195, 285, { align: 'right' });
    }

    doc.save(`etat_budget_${mois}.pdf`);
  };

  const handleExportExcel = async () => {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Historique');

    // Add Logo if available
    const logoData = await getLogoBuffer();
    if (logoData) {
        const logoId = workbook.addImage({
            buffer: logoData.buffer,
            extension: logoData.format.toLowerCase() as 'png' | 'jpeg',
        });
        worksheet.addImage(logoId, {
            tl: { col: 0, row: 0 },
            ext: { width: 100, height: 100 }
        });
    }

    // Title
    worksheet.mergeCells('C2:H2');
    const titleCell = worksheet.getCell('C2');
    titleCell.value = 'Historique de Consommation Budgétaire';
    titleCell.font = { name: 'Arial', size: 16, bold: true };
    titleCell.alignment = { vertical: 'middle', horizontal: 'center' };

    worksheet.mergeCells('C3:H3');
    const subtitleCell = worksheet.getCell('C3');
    subtitleCell.value = `Période: ${mois} - Exporté le ${new Date().toLocaleDateString()}`;
    subtitleCell.alignment = { vertical: 'middle', horizontal: 'center' };

    // Header Row
    const headerRowIdx = 6;
    const headers = ["Date", "Réquisition", "Demandeur", "Service", "Ligne Budgétaire", "Montant Req.", "Budget Alloué", "Total Consommé", "Reste à Consommer", "Statut"];
    const headerRow = worksheet.getRow(headerRowIdx);
    headerRow.values = headers;
    
    headerRow.eachCell((cell) => {
        cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
        cell.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FF2980B9' }
        };
        cell.alignment = { vertical: 'middle', horizontal: 'center' };
        cell.border = {
            top: { style: 'thin' },
            left: { style: 'thin' },
            bottom: { style: 'thin' },
            right: { style: 'thin' }
        };
    });

    // Data Rows
    history.forEach((item, index) => {
        const rowIndex = headerRowIdx + 1 + index;
        const row = worksheet.getRow(rowIndex);
        const reste = Number(item.montant_prevu || 0) - Number(item.montant_consomme || 0);

        row.values = [
            new Date(item.date_creation).toLocaleDateString(),
            item.numero_requisition,
            item.demandeur,
            item.service,
            item.ligne_budgetaire,
            Number(item.montant),
            Number(item.montant_prevu || 0),
            Number(item.montant_consomme || 0),
            reste,
            item.statut
        ];

        // Styling
        row.getCell(6).numFmt = '#,##0.00 "USD"';
        row.getCell(7).numFmt = '#,##0.00 "USD"';
        row.getCell(8).numFmt = '#,##0.00 "USD"';
        row.getCell(9).numFmt = '#,##0.00 "USD"';

        // Color for Reste
        if (reste < 0) {
            row.getCell(9).font = { color: { argb: 'FFFF0000' }, bold: true };
        } else {
            row.getCell(9).font = { color: { argb: 'FF008000' }, bold: true };
        }

        row.eachCell({ includeEmpty: true }, (cell) => {
             cell.border = {
                top: { style: 'thin' },
                left: { style: 'thin' },
                bottom: { style: 'thin' },
                right: { style: 'thin' }
            };
        });
    });

    // Auto width (approximate)
    worksheet.columns.forEach(column => {
        column.width = 20;
    });
    worksheet.getColumn(1).width = 12; // Date
    worksheet.getColumn(2).width = 25; // Req
    worksheet.getColumn(5).width = 30; // Ligne Budget

    // Save
    const buffer = await workbook.xlsx.writeBuffer();
    saveAs(new Blob([buffer]), `Historique_Budget_${mois}.xlsx`);
  };

  const handleTabChange = (event: React.SyntheticEvent, newValue: number) => {
    setTabValue(newValue);
  };

  return (
    <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
      {/* Header - No Print */}
      <Box sx={{ '@media print': { display: 'none' } }}>
        <Typography variant="h4" gutterBottom>
          Gestion Budgétaire
        </Typography>

        <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 3 }}>
          <Tabs value={tabValue} onChange={handleTabChange}>
            <Tab label="État des Budgets" icon={<AccountBalanceWallet />} iconPosition="start" />
            <Tab label="Historique Consommation" icon={<History />} iconPosition="start" />
          </Tabs>
        </Box>

        <Grid container spacing={3} sx={{ mb: 3 }}>
          <Grid size={{ xs: 12, md: 3 }}>
            <TextField
              label="Mois"
              type="month"
              value={mois}
              onChange={(e) => setMois(e.target.value)}
              fullWidth
              size="small"
              InputLabelProps={{ shrink: true }}
            />
          </Grid>
          
          {tabValue === 0 && (
            <>
              <Grid size={{ xs: 12, md: 3 }}>
                <TextField
                  label="Rechercher..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  fullWidth
                  size="small"
                  InputProps={{
                    endAdornment: <Search color="action" />
                  }}
                />
              </Grid>
              <Grid size={{ xs: 12, md: 6 }} sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                 <FormControlLabel
                    control={<Switch checked={hideUnconsumed} onChange={(e) => setHideUnconsumed(e.target.checked)} />}
                    label="Uniq. Consommés"
                    sx={{ mr: 'auto' }} 
                 />
                 <Button 
                    variant="outlined" 
                    startIcon={<TableView />} 
                    onClick={handleExportExcelEtat}
                    color="success"
                    size="small"
                 >
                    Excel
                 </Button>
                 <Button 
                    variant="outlined" 
                    startIcon={<PictureAsPdf />} 
                    onClick={handleExportPDFEtat}
                    color="error"
                    size="small"
                 >
                    PDF
                 </Button>
                 <Button 
                    variant="contained" 
                    startIcon={<Print />} 
                    onClick={handlePrint}
                    size="small"
                 >
                    Imprimer
                 </Button>
              </Grid>
            </>
          )}

           {tabValue === 1 && (
             <Grid size={{ xs: 12, md: 9 }} sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1 }}>
                 <Button 
                    variant="outlined" 
                    startIcon={<TableView />} 
                    onClick={handleExportExcel}
                    color="success"
                 >
                    Excel
                 </Button>
                 <Button 
                    variant="outlined" 
                    startIcon={<PictureAsPdf />} 
                    onClick={handleExportPDF}
                    color="error"
                 >
                    PDF
                 </Button>
                 <Button 
                    variant="contained" 
                    startIcon={<Print />} 
                    onClick={handlePrint}
                 >
                    Imprimer
                 </Button>
             </Grid>
           )}
        </Grid>

        {message && (
          <Alert severity={message.type} sx={{ mb: 2 }} onClose={() => setMessage(null)}>
            {message.text}
          </Alert>
        )}
      </Box>

      {/* Print Header */}
      <Box sx={{ display: 'none', '@media print': { display: 'block', mb: 3 } }}>
         <Typography variant="h5" align="center" gutterBottom>
            {tabValue === 0 ? 'État de Consommation Budgétaire' : 'Historique des Dépenses Budgétaires'}
         </Typography>
         <Typography variant="subtitle1" align="center">
            Période: {mois}
         </Typography>
         <Typography variant="caption" display="block" align="center">
            Imprimé le {new Date().toLocaleDateString()}
         </Typography>
      </Box>

      {/* TAB 0: ETAT BUDGET */}
      {tabValue === 0 && (
        <Box>
            {/* Import Section - No Print */}
            <Box sx={{ '@media print': { display: 'none' }, mb: 3 }}>
              <Card variant="outlined">
                <CardContent>
                  <Typography variant="h6" gutterBottom>Importer Budget (Excel)</Typography>
                  <Grid container spacing={2} alignItems="center">
                    <Grid size="grow">
                      <input
                        accept=".xlsx, .xls"
                        style={{ display: 'none' }}
                        id="raised-button-file"
                        type="file"
                        onChange={handleFileChange}
                      />
                      <label htmlFor="raised-button-file">
                        <Button variant="outlined" component="span" startIcon={<CloudUpload />}>
                          Choisir fichier
                        </Button>
                      </label>

                      {user?.role === 'admin' && (
                        <Button
                          variant="outlined"
                          color="secondary"
                          startIcon={<Add />}
                          onClick={() => setOpenAddDialog(true)}
                          disabled={loading}
                          sx={{ ml: 1 }}
                        >
                          Ajouter Ligne
                        </Button>
                      )}
                      {file && <Typography variant="caption" sx={{ ml: 1 }}>{file.name}</Typography>}
                    </Grid>
                    <Grid size="auto">
                      <Button
                        variant="contained"
                        color="primary"
                        onClick={handleImport}
                        disabled={!file || loading}
                      >
                        {loading ? <CircularProgress size={24} /> : 'Importer'}
                      </Button>
                    </Grid>
                  </Grid>
                </CardContent>
              </Card>
            </Box>

            {/* Summary Cards */}
            <Grid container spacing={2} sx={{ mb: 3 }}>
                <Grid size={{ xs: 12, md: 4 }}>
                    <Paper sx={{ p: 2, bgcolor: '#f5f5f5' }}>
                        <Typography variant="subtitle2" color="text.secondary">Total Alloué</Typography>
                        <Typography variant="h6">{(totalAlloue || 0).toLocaleString()} USD</Typography>
                    </Paper>
                </Grid>
                <Grid size={{ xs: 12, md: 4 }}>
                    <Paper sx={{ p: 2, bgcolor: '#e3f2fd' }}>
                        <Typography variant="subtitle2" color="text.secondary">Total Consommé</Typography>
                        <Typography variant="h6" color="primary">{(totalConsomme || 0).toLocaleString()} USD</Typography>
                    </Paper>
                </Grid>
                <Grid size={{ xs: 12, md: 4 }}>
                    <Paper sx={{ p: 2, bgcolor: pourcentageGlobal > 100 ? '#ffebee' : '#e8f5e9' }}>
                        <Typography variant="subtitle2" color="text.secondary">Taux d'exécution</Typography>
                        <Typography variant="h6" color={pourcentageGlobal > 100 ? 'error' : 'success'}>
                            {pourcentageGlobal.toFixed(2)}%
                        </Typography>
                    </Paper>
                </Grid>
            </Grid>

            <TableContainer component={Paper} variant="outlined">
              <Table size="small">
                <TableHead sx={{ bgcolor: '#eee' }}>
                  <TableRow>
                    <TableCell>Description</TableCell>
                    <TableCell>Catégorie</TableCell>
                    <TableCell align="right">Alloué</TableCell>
                    <TableCell align="right">Consommé</TableCell>
                    <TableCell align="right">Solde</TableCell>
                    <TableCell align="right">%</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {filteredBudgets.map((budget) => {
                    const solde = Number(budget.montant_prevu || 0) - Number(budget.montant_consomme || 0);
                    const percent = Number(budget.montant_prevu || 0) > 0 
                        ? (Number(budget.montant_consomme || 0) / Number(budget.montant_prevu || 0)) * 100 
                        : 0;
                    
                    return (
                      <TableRow key={budget.id} hover>
                        <TableCell sx={{ color: budget.is_manual ? 'red' : 'inherit', fontWeight: budget.is_manual ? 'bold' : 'normal' }}>
                          {budget.description}
                          {budget.is_manual && (
                            <Tooltip title="Ligne ajoutée manuellement">
                                <EditNote fontSize="small" color="error" sx={{ ml: 1, verticalAlign: 'middle' }} />
                            </Tooltip>
                          )}
                          {user?.role === 'admin' && (
                            <IconButton 
                                size="small" 
                                color="error" 
                                onClick={() => handleDeleteLine(budget.id, budget.description)}
                                sx={{ ml: 1, opacity: 0.5, '&:hover': { opacity: 1 } }}
                                title="Supprimer la ligne"
                            >
                                <Delete fontSize="small" />
                            </IconButton>
                          )}
                        </TableCell>
                        <TableCell>{budget.classification || '-'}</TableCell>
                        <TableCell align="right">{Number(budget.montant_prevu || 0).toLocaleString()}</TableCell>
                        <TableCell align="right" sx={{ fontWeight: 'bold', color: Number(budget.montant_consomme || 0) > 0 ? 'primary.main' : 'inherit' }}>
                            {Number(budget.montant_consomme || 0).toLocaleString()}
                        </TableCell>
                        <TableCell align="right" sx={{ color: solde < 0 ? 'error.main' : 'success.main' }}>
                            {solde.toLocaleString()}
                        </TableCell>
                        <TableCell align="right">
                             <Chip 
                                label={`${percent.toFixed(0)}%`} 
                                size="small" 
                                color={percent > 100 ? 'error' : percent > 80 ? 'warning' : 'success'} 
                                variant="outlined"
                             />
                        </TableCell>
                      </TableRow>
                    );
                  })}
                  {filteredBudgets.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={6} align="center">Aucun budget trouvé</TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </TableContainer>
        </Box>
      )}

      {/* TAB 1: HISTORIQUE */}
      {tabValue === 1 && (
          <Box>
              <TableContainer component={Paper} variant="outlined">
                  <Table size="small">
                      <TableHead sx={{ bgcolor: '#eee' }}>
                          <TableRow>
                              <TableCell>Date</TableCell>
                              <TableCell>Réquisition</TableCell>
                              <TableCell>Demandeur</TableCell>
                              <TableCell>Service</TableCell>
                              <TableCell>Ligne Budgétaire</TableCell>
                              <TableCell align="right">Montant Req.</TableCell>
                              <TableCell align="right">Budget Alloué</TableCell>
                              <TableCell align="right">Total Consommé</TableCell>
                              <TableCell align="right">Reste à Consommer</TableCell>
                              <TableCell>Statut</TableCell>
                          </TableRow>
                      </TableHead>
                      <TableBody>
                          {history.map((item, index) => {
                              const reste = Number(item.montant_prevu || 0) - Number(item.montant_consomme || 0);
                              return (
                              <TableRow key={`${item.requisition_id}-${index}`}>
                                  <TableCell>{new Date(item.date_creation).toLocaleDateString()}</TableCell>
                                  <TableCell>{item.numero_requisition}</TableCell>
                                  <TableCell>{item.demandeur}</TableCell>
                                  <TableCell>{item.service}</TableCell>
                                  <TableCell>{item.ligne_budgetaire}</TableCell>
                                  <TableCell align="right" sx={{ fontWeight: 'bold' }}>
                                      {Number(item.montant).toLocaleString()} {item.devise}
                                  </TableCell>
                                  <TableCell align="right" sx={{ color: 'text.secondary' }}>
                                      {Number(item.montant_prevu || 0).toLocaleString()} USD
                                  </TableCell>
                                  <TableCell align="right" sx={{ color: 'primary.main' }}>
                                      {Number(item.montant_consomme || 0).toLocaleString()} USD
                                  </TableCell>
                                  <TableCell align="right" sx={{ 
                                      fontWeight: 'bold', 
                                      color: reste < 0 ? 'error.main' : 'success.main' 
                                  }}>
                                      {reste.toLocaleString()} USD
                                  </TableCell>
                                  <TableCell>
                                      <Chip label={item.statut} size="small" variant="outlined" />
                                  </TableCell>
                              </TableRow>
                              );
                          })}
                          {history.length === 0 && (
                              <TableRow>
                                  <TableCell colSpan={10} align="center">Aucun historique pour cette période</TableCell>
                              </TableRow>
                          )}
                      </TableBody>
                  </Table>
              </TableContainer>
          </Box>
      )}

      {/* Modal Ajout Ligne Budget */}
      <Dialog open={openAddDialog} onClose={() => setOpenAddDialog(false)}>
        <DialogTitle>Ajouter une ligne budgétaire</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            margin="dense"
            label="Description (Ligne Budgétaire)"
            fullWidth
            value={newBudgetLine.description}
            onChange={(e) => setNewBudgetLine({ ...newBudgetLine, description: e.target.value })}
          />
          <TextField
            margin="dense"
            label="Montant Prévu (USD)"
            type="number"
            fullWidth
            value={newBudgetLine.montant_prevu}
            onChange={(e) => setNewBudgetLine({ ...newBudgetLine, montant_prevu: e.target.value })}
          />
          <TextField
            margin="dense"
            label="Classification"
            fullWidth
            select
            value={newBudgetLine.classification}
            onChange={(e) => setNewBudgetLine({ ...newBudgetLine, classification: e.target.value })}
          >
            <MenuItem value="NON_ALLOUE">Non Alloué</MenuItem>
            <MenuItem value="FIXE">Fixe</MenuItem>
            <MenuItem value="VARIABLE">Variable</MenuItem>
          </TextField>
          <Typography variant="caption" display="block" sx={{ mt: 2 }}>
            Mois cible : {mois}
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenAddDialog(false)}>Annuler</Button>
          <Button onClick={handleAddLine} variant="contained" color="primary">
            Ajouter
          </Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
};

export default BudgetsPage;
