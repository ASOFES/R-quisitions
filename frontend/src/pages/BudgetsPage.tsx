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
  IconButton
} from '@mui/material';
import { CloudUpload, Refresh, Search } from '@mui/icons-material';
import api from '../services/api';

const BudgetsPage: React.FC = () => {
  const [file, setFile] = useState<File | null>(null);
  const [mois, setMois] = useState<string>(new Date().toISOString().slice(0, 7)); // YYYY-MM
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);
  const [budgets, setBudgets] = useState<any[]>([]);
  const [search, setSearch] = useState('');

  useEffect(() => {
    fetchBudgets();
  }, [mois]);

  const fetchBudgets = async () => {
    try {
      const response = await api.get(`/budgets?mois=${mois}`);
      setBudgets(response.data);
    } catch (error) {
      console.error('Erreur chargement budgets:', error);
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
      // Reset input file if possible, or just ignore
      fetchBudgets();
    } catch (error: any) {
      console.error('Erreur import:', error);
      setMessage({ type: 'error', text: error.response?.data?.error || 'Erreur lors de l\'importation.' });
    } finally {
      setLoading(false);
    }
  };

  const filteredBudgets = budgets.filter(b => 
    b.description.toLowerCase().includes(search.toLowerCase()) ||
    b.classification?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
      <Typography variant="h4" gutterBottom>
        Gestion des Budgets
      </Typography>

      <Grid container spacing={3}>
        {/* Import Section */}
        <Grid size={{ xs: 12, md: 4 }}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Importer un budget (Excel)
              </Typography>
              
              <Box sx={{ mb: 2 }}>
                <TextField
                  label="Mois"
                  type="month"
                  value={mois}
                  onChange={(e) => setMois(e.target.value)}
                  fullWidth
                  InputLabelProps={{ shrink: true }}
                />
              </Box>

              <Box sx={{ mb: 2 }}>
                <Button
                  variant="outlined"
                  component="label"
                  fullWidth
                  startIcon={<CloudUpload />}
                >
                  Choisir le fichier
                  <input
                    type="file"
                    hidden
                    accept=".xlsx, .xls"
                    onChange={handleFileChange}
                  />
                </Button>
                {file && <Typography variant="caption" display="block" sx={{ mt: 1 }}>{file.name}</Typography>}
              </Box>

              <Button
                variant="contained"
                color="primary"
                fullWidth
                onClick={handleImport}
                disabled={loading || !file}
              >
                {loading ? <CircularProgress size={24} /> : 'Importer'}
              </Button>

              {message && (
                <Alert severity={message.type} sx={{ mt: 2 }}>
                  {message.text}
                </Alert>
              )}
            </CardContent>
          </Card>
        </Grid>

        {/* List Section */}
        <Grid size={{ xs: 12, md: 8 }}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                <Typography variant="h6">
                  Lignes budgétaires ({filteredBudgets.length})
                </Typography>
                <IconButton onClick={fetchBudgets}>
                  <Refresh />
                </IconButton>
              </Box>

              <TextField
                placeholder="Rechercher..."
                size="small"
                fullWidth
                sx={{ mb: 2 }}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                InputProps={{
                  startAdornment: <Search color="action" sx={{ mr: 1 }} />
                }}
              />

              <TableContainer component={Paper} sx={{ maxHeight: 400 }}>
                <Table stickyHeader size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Description</TableCell>
                      <TableCell>Classification</TableCell>
                      <TableCell align="right">Prévu</TableCell>
                      <TableCell align="right">Consommé</TableCell>
                      <TableCell align="right">Reste</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {filteredBudgets.length > 0 ? (
                      filteredBudgets.map((row) => (
                        <TableRow key={row.id}>
                          <TableCell>{row.description}</TableCell>
                          <TableCell>{row.classification}</TableCell>
                          <TableCell align="right">{row.montant_prevu?.toLocaleString()} USD</TableCell>
                          <TableCell align="right">{row.montant_consomme?.toLocaleString()} USD</TableCell>
                          <TableCell align="right" sx={{ 
                            color: (row.montant_prevu - row.montant_consomme) < 0 ? 'error.main' : 'success.main',
                            fontWeight: 'bold'
                          }}>
                            {(row.montant_prevu - row.montant_consomme)?.toLocaleString()} USD
                          </TableCell>
                        </TableRow>
                      ))
                    ) : (
                      <TableRow>
                        <TableCell colSpan={5} align="center">Aucun budget trouvé pour ce mois</TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </TableContainer>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Container>
  );
};

export default BudgetsPage;
