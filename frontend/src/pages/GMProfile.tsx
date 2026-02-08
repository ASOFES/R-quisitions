import React, { useState, useEffect } from 'react';
import {
  Container,
  Typography,
  Box,
  Card,
  CardContent,
  Avatar,
  Button,
  Chip,
  Paper,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  IconButton,
  LinearProgress,
  TextField,
  Grid,
  MenuItem,
  Select,
  InputLabel,
  FormControl,
} from '@mui/material';
import {
  Person,
  Business,
  Email,
  Analytics,
  Pending,
  CheckCircle,
  Speed,
  Visibility,
  AttachFile,
  Save,
  Cancel,
  PictureAsPdf,
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { useAuth } from '../context/AuthContext';
import RequisitionService, { Requisition } from '../services/RequisitionService';
import { API_BASE_URL } from '../config';

const GMProfile: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [requisitions, setRequisitions] = useState<Requisition[]>([]);
  const [loading, setLoading] = useState(true);
  const [editMode, setEditMode] = useState(false);
  const [filterStatus, setFilterStatus] = useState('pending');
  const [filterService, setFilterService] = useState('all');
  const [filterUrgence, setFilterUrgence] = useState('all');
  const [formData, setFormData] = useState({
    nom_complet: user?.nom_complet || '',
    email: user?.email || '',
    service_nom: user?.service_nom || '',
  });

  useEffect(() => {
    loadProfileData();
  }, []);

  const loadProfileData = async () => {
    try {
      setLoading(true);
      
      // Récupérer le token depuis localStorage
      const token = localStorage.getItem('token');
      if (!token) {
        console.error('Token non trouvé');
        setLoading(false);
        return;
      }

      // Récupérer les réquisitions depuis l'API du backend
      const response = await fetch(`${API_BASE_URL}/api/requisitions`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const allRequisitions = await response.json();
        console.log('Réquisitions récupérées depuis le backend pour GM:', allRequisitions);
        
        // Pour le GM, on garde tout ce qui est pertinent (y compris l'historique)
        // Mais on marque ceux qui sont en attente pour le tri par défaut
        const relevantRequisitions = allRequisitions.filter((req: any) => 
          req.niveau === 'gm' || 
          req.niveau === 'paiement' || 
          req.statut === 'validee' ||
          req.statut === 'payee' ||
          req.statut === 'refusee' ||
          req.statut === 'termine'
        );
        
        console.log('Réquisitions pertinentes pour GM:', relevantRequisitions);
        setRequisitions(relevantRequisitions);
      } else {
        console.error('Erreur lors de la récupération des réquisitions:', response.status);
        // En cas d'erreur, essayer avec le service local
        const requisitionService = RequisitionService.getInstance();
        const allRequisitions = requisitionService.getAllRequisitions();
        const relevantRequisitions = allRequisitions.filter(req => 
          req.niveau === 'gm' ||
          req.niveau === 'paiement' || 
          req.statut === 'validee' ||
          req.statut === 'payee' ||
          req.statut === 'refusee' ||
          req.statut === 'termine'
        );
        setRequisitions(relevantRequisitions);
      }
      
      setLoading(false);
    } catch (error) {
      console.error('Erreur lors du chargement des données:', error);
      setLoading(false);
    }
  };

  const handleSave = () => {
    setEditMode(false);
    console.log('Profil sauvegardé:', formData);
  };

  const handleCancel = () => {
    setFormData({
      nom_complet: user?.nom_complet || '',
      email: user?.email || '',
      service_nom: user?.service_nom || '',
    });
    setEditMode(false);
  };

  const handleTestPDF = () => {
    const doc = new jsPDF();
    const today = new Date().toLocaleDateString();

    // Titre
    doc.setFontSize(20);
    doc.setTextColor(40, 40, 40);
    doc.text('TEST - Réquisitions à Valider', 14, 22);
    
    doc.setFontSize(11);
    doc.setTextColor(100);
    doc.text(`Date: ${today}`, 14, 30);
    doc.text(`Validateur: TEST USER (GM)`, 14, 36);
    doc.text(`NOTE: Ceci est un document de test généré avec des données fictives.`, 14, 42);

    let yPos = 50;

    // Données fictives pour le test
    const testRequisitions = [
      {
        reference: 'REQ-TEST-001',
        created_at: new Date().toISOString(),
        emetteur_nom: 'Jean Dupont',
        emetteur_email: 'jean.dupont@company.com',
        emetteur_role: 'Emetteur',
        emetteur_zone: 'Kinshasa',
        service_nom: 'Département IT',
        objet: 'Achat de 5 ordinateurs portables',
        montant: 12500,
        devise: 'USD',
        urgence: 'HAUTE',
        statut: 'EN_COURS',
        description: 'Remplacement du parc informatique obsolète pour l\'équipe de développement. Les machines actuelles ont plus de 4 ans et ralentissent la productivité.\n\nConfiguration requise:\n- i7 12th Gen\n- 32GB RAM\n- 1TB SSD\n\nFournisseur: Dell Entreprise.'
      },
      {
        reference: 'REQ-TEST-002',
        created_at: new Date(Date.now() - 86400000).toISOString(),
        emetteur_nom: 'Marie Martin',
        emetteur_email: 'marie.martin@company.com',
        emetteur_role: 'Emetteur',
        emetteur_zone: 'Lubumbashi',
        service_nom: 'Ressources Humaines',
        objet: 'Formation Leadership',
        montant: 3500,
        devise: 'EUR',
        urgence: 'NORMALE',
        statut: 'EN_COURS',
        description: 'Session de formation pour les managers juniors. Durée: 3 jours.\nLieu: Salle de conférence principale.\nIntervenant externe: Cabinet Consulting RH.'
      }
    ];

    testRequisitions.forEach((req, index) => {
      if (index > 0) {
        doc.addPage();
        yPos = 20;
      }

      // En-tête de la réquisition
      doc.setFillColor(240, 240, 240);
      doc.rect(14, yPos, 182, 10, 'F');
      doc.setFontSize(12);
      doc.setTextColor(0);
      doc.setFont('helvetica', 'bold');
      doc.text(`Réf: ${req.reference} - ${new Date(req.created_at).toLocaleDateString()}`, 16, yPos + 7);
      
      yPos += 20;

      // Détails
      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      
      const details = [
        ['Initiateur:', (req as any).emetteur_nom],
        ['Email:', (req as any).emetteur_email],
        ['Rôle:', (req as any).emetteur_role],
        ['Zone:', (req as any).emetteur_zone],
        ['Service:', (req as any).service_nom],
        ['Objet:', req.objet],
        ['Montant:', `${req.montant.toLocaleString()} ${req.devise}`],
        ['Urgence:', req.urgence],
        ['Statut Actuel:', req.statut]
      ];

      autoTable(doc, {
        startY: yPos,
        head: [],
        body: details,
        theme: 'plain',
        styles: { fontSize: 10, cellPadding: 2 },
        columnStyles: { 0: { fontStyle: 'bold', cellWidth: 40 } },
        margin: { left: 14 }
      });

      // Récupérer la position Y après le tableau
      const finalY = (doc as any).lastAutoTable.finalY || yPos + 40;
      yPos = finalY + 10;

      // Description
      doc.setFont('helvetica', 'bold');
      doc.text('Description:', 14, yPos);
      yPos += 7;
      doc.setFont('helvetica', 'normal');
      const splitDescription = doc.splitTextToSize(req.description, 180);
      doc.text(splitDescription, 14, yPos);
      yPos += (splitDescription.length * 5) + 15;

      // Espace pour validation
      doc.setDrawColor(150);
      doc.setLineWidth(0.5);
      doc.line(14, yPos, 196, yPos); // Ligne de séparation
      yPos += 10;

      doc.setFont('helvetica', 'bold');
      doc.text('ESPACE VALIDATION (Réservé au GM)', 14, yPos);
      yPos += 10;
      
      // Cadre pour annotations
      doc.setDrawColor(200);
      doc.rect(14, yPos, 182, 80); // Grand cadre vide
      
      doc.setFontSize(9);
      doc.setTextColor(150);
      doc.text('Annotations / Signature:', 16, yPos + 8);
      
      // Options à cocher (visuel)
      yPos += 90;
      doc.rect(20, yPos, 5, 5);
      doc.text('VALIDÉ', 28, yPos + 4);
      
      doc.rect(60, yPos, 5, 5);
      doc.text('REFUSÉ', 68, yPos + 4);

      doc.rect(100, yPos, 5, 5);
      doc.text('À CORRIGER', 108, yPos + 4);
    });

    const pageCount = doc.getNumberOfPages();
    for(let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setFontSize(8);
        doc.text('Page ' + i + ' / ' + pageCount, 195, 285, { align: 'right' });
    }

    doc.save(`TEST_requisitions_gm_${new Date().toISOString().slice(0, 10)}.pdf`);
  };

  const handleExportPDF = () => {
    const doc = new jsPDF();
    const today = new Date().toLocaleDateString();

    // Titre
    doc.setFontSize(20);
    doc.setTextColor(40, 40, 40);
    doc.text('Réquisitions à Valider', 14, 22);
    
    doc.setFontSize(11);
    doc.setTextColor(100);
    doc.text(`Date: ${today}`, 14, 30);
    doc.text(`Validateur: ${user?.nom_complet || 'GM'}`, 14, 36);

    let yPos = 45;

    // Filtrer pour n'exporter que celles qui sont réellement à valider (niveau 'gm' ou 'paiement')
    const pendingRequisitions = requisitions.filter(req => req.niveau === 'gm' || req.niveau === 'paiement');

    if (pendingRequisitions.length === 0) {
      doc.text("Aucune réquisition en attente de validation.", 14, 50);
      doc.save(`requisitions_gm_vide_${new Date().toISOString().slice(0, 10)}.pdf`);
      return;
    }

    pendingRequisitions.forEach((req, index) => {
      // Nouvelle page pour chaque réquisition (sauf la première si on a de la place, mais mieux vaut séparer)
      if (index > 0) {
        doc.addPage();
        yPos = 20;
      }

      // En-tête de la réquisition
      doc.setFillColor(240, 240, 240);
      doc.rect(14, yPos, 182, 10, 'F');
      doc.setFontSize(12);
      doc.setTextColor(0);
      doc.setFont('helvetica', 'bold');
      doc.text(`Réf: ${req.reference} - ${new Date(req.created_at).toLocaleDateString()}`, 16, yPos + 7);
      
      yPos += 20;

      // Détails
      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      
      const details = [
        ['Initiateur:', (req as any).emetteur_nom || 'N/A'],
        ['Email:', (req as any).emetteur_email || 'N/A'],
        ['Rôle:', (req as any).emetteur_role || 'N/A'],
        ['Zone:', (req as any).emetteur_zone || 'N/A'],
        ['Service:', (req as any).service_nom || 'N/A'],
        ['Objet:', req.objet],
        ['Montant:', `${req.montant.toLocaleString()} ${req.devise}`],
        ['Urgence:', req.urgence.toUpperCase()],
        ['Statut Actuel:', req.statut.toUpperCase()]
      ];

      autoTable(doc, {
        startY: yPos,
        head: [],
        body: details,
        theme: 'plain',
        styles: { fontSize: 10, cellPadding: 2 },
        columnStyles: { 0: { fontStyle: 'bold', cellWidth: 40 } },
        margin: { left: 14 }
      });

      // Récupérer la position Y après le tableau
      const finalY = (doc as any).lastAutoTable.finalY || yPos + 40;
      yPos = finalY + 10;

      // Description
      doc.setFont('helvetica', 'bold');
      doc.text('Description:', 14, yPos);
      yPos += 7;
      doc.setFont('helvetica', 'normal');
      const splitDescription = doc.splitTextToSize(req.description, 180);
      doc.text(splitDescription, 14, yPos);
      yPos += (splitDescription.length * 5) + 15;

      // Espace pour validation
      doc.setDrawColor(150);
      doc.setLineWidth(0.5);
      doc.line(14, yPos, 196, yPos); // Ligne de séparation
      yPos += 10;

      doc.setFont('helvetica', 'bold');
      doc.text('ESPACE VALIDATION (Réservé au GM)', 14, yPos);
      yPos += 10;
      
      // Cadre pour annotations
      doc.setDrawColor(200);
      doc.rect(14, yPos, 182, 80); // Grand cadre vide
      
      doc.setFontSize(9);
      doc.setTextColor(150);
      doc.text('Annotations / Signature:', 16, yPos + 8);
      
      // Options à cocher (visuel)
      yPos += 90;
      doc.rect(20, yPos, 5, 5);
      doc.text('VALIDÉ', 28, yPos + 4);
      
      doc.rect(60, yPos, 5, 5);
      doc.text('REFUSÉ', 68, yPos + 4);

      doc.rect(100, yPos, 5, 5);
      doc.text('À CORRIGER', 108, yPos + 4);
    });

    const pageCount = doc.getNumberOfPages();
    for(let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setFontSize(8);
        doc.text('Page ' + i + ' / ' + pageCount, 195, 285, { align: 'right' });
    }

    doc.save(`requisitions_gm_batch_${new Date().toISOString().slice(0, 10)}.pdf`);
  };

  const getRoleLabel = (role: string) => {
    switch (role) {
      case 'admin': return 'Administrateur';
      case 'validateur': return 'Deuxième niveau de validation';
      case 'analyste': return 'Premier niveau de validation';
      case 'emetteur': return 'Initiateur';
      case 'gm': return 'Validation finale avant paiement';
      default: return role;
    }
  };

  const getRoleColor = (role: string) => {
    switch (role) {
      case 'admin': return '#9c27b0';
      case 'validateur': return '#ff9800';
      case 'analyste': return '#2196f3';
      case 'emetteur': return '#4caf50';
      case 'gm': return '#9c27b0';
      default: return '#9e9e9e';
    }
  };

  const getStatistiques = () => {
    const total = requisitions.length;
    const enAttente = requisitions.filter(req => 
      req.niveau === 'paiement' && 
      (req.statut === 'validee' || req.statut === 'en_cours')
    ).length;
    const completes = requisitions.filter(req => 
      req.statut === 'payee' || 
      req.niveau === 'termine'
    ).length;
    
    console.log('Statistiques GM:', {
      total,
      enAttente,
      completes,
      details: requisitions.map(req => ({
        id: req.id,
        reference: req.reference,
        statut: req.statut,
        niveau: req.niveau
      }))
    });
    
    return {
      total,
      enAttente,
      completes,
      tauxCompletion: total > 0 ? Math.round((completes / total) * 100) : 0,
    };
  };

  const stats = getStatistiques();

  // Extract unique services
  const services = Array.from(new Set(requisitions.map(r => (r as any).service_nom).filter(Boolean)));

  const filteredRequisitions = requisitions.filter(req => {
    const matchesStatus = 
      filterStatus === 'all' ? true :
      filterStatus === 'pending' ? (req.niveau === 'gm' || req.niveau === 'paiement' || (req.statut === 'validee' && req.niveau !== 'termine')) :
      req.statut === filterStatus;
      
    const matchesService = filterService === 'all' || (req as any).service_nom === filterService;
    const matchesUrgence = filterUrgence === 'all' || req.urgence === filterUrgence;
    
    return matchesStatus && matchesService && matchesUrgence;
  });

  const getStatutLabel = (statut: string) => {
    switch (statut) {
      case 'brouillon': return 'Brouillon';
      case 'soumise': return 'Soumise';
      case 'en_cours': return 'En cours';
      case 'validee': return 'Validée';
      case 'refusee': return 'Refusée';
      case 'en_attente': return 'En attente';
      case 'payee': return 'Payée';
      default: return statut;
    }
  };

  const getStatutColor = (statut: string) => {
    switch (statut) {
      case 'brouillon': return '#9e9e9e';
      case 'soumise': return '#2196f3';
      case 'en_cours': return '#ff9800';
      case 'validee': return '#4caf50';
      case 'refusee': return '#f44336';
      case 'en_attente': return '#9c27b0';
      case 'payee': return '#4caf50';
      default: return '#9e9e9e';
    }
  };

  const getUrgenceLabel = (urgence: string) => {
    switch (urgence) {
      case 'basse': return 'Basse';
      case 'moyenne': return 'Moyenne';
      case 'haute': return 'Haute';
      case 'critique': return 'Critique';
      default: return urgence;
    }
  };

  const getUrgenceColor = (urgence: string) => {
    switch (urgence) {
      case 'basse': return '#4caf50';
      case 'moyenne': return '#ff9800';
      case 'haute': return '#ff5722';
      case 'critique': return '#f44336';
      default: return '#9e9e9e';
    }
  };

  if (loading) {
    return (
      <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
        <Box sx={{ display: 'flex', justifyContent: 'center', mt: 8 }}>
          <LinearProgress sx={{ width: '50%' }} />
        </Box>
      </Container>
    );
  }

  return (
    <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
      <Typography variant="h4" sx={{ mb: 4, fontWeight: 'bold', color: 'primary.main' }}>
        Tableau de Bord - Validation Finale
      </Typography>

      <Box sx={{ mb: 3, display: 'flex', justifyContent: 'flex-end', gap: 2 }}>
        <Button 
          variant="outlined" 
          color="warning" 
          startIcon={<PictureAsPdf />}
          onClick={handleTestPDF}
        >
          Test PDF (Dummy Data)
        </Button>
        <Button 
          variant="contained" 
          color="secondary" 
          startIcon={<PictureAsPdf />}
          onClick={handleExportPDF}
        >
          Exporter tout en PDF (Batch)
        </Button>
      </Box>

      <Box sx={{ display: 'flex', flexDirection: { xs: 'column', md: 'row' }, gap: 3 }}>
        {/* Informations personnelles */}
        <Box sx={{ flex: { xs: '1', md: '0 0 33.333%' } }}>
          <Card sx={{ height: '100%', boxShadow: 3 }}>
            <CardContent sx={{ p: 3 }}>
              <Typography variant="h6" sx={{ mb: 3, display: 'flex', alignItems: 'center', gap: 1 }}>
                <Person color="primary" /> Informations personnelles
              </Typography>
              
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                  <Avatar 
                    sx={{ 
                      bgcolor: getRoleColor(user?.role || ''), 
                      width: 64, 
                      height: 64,
                      fontSize: 24,
                      fontWeight: 'bold'
                    }}
                  >
                    {user?.nom_complet?.charAt(0)}
                  </Avatar>
                  <Box>
                    <Typography variant="h6" fontWeight="bold">
                      {user?.nom_complet}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      @{user?.username}
                    </Typography>
                  </Box>
                </Box>

                {editMode ? (
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                    <TextField
                      fullWidth
                      label="Nom complet"
                      value={formData.nom_complet}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFormData({ ...formData, nom_complet: e.target.value })}
                      variant="outlined"
                      size="small"
                    />
                    <TextField
                      fullWidth
                      label="Email"
                      type="email"
                      value={formData.email}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFormData({ ...formData, email: e.target.value })}
                      variant="outlined"
                      size="small"
                    />
                    <TextField
                      fullWidth
                      label="Service"
                      value={formData.service_nom}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFormData({ ...formData, service_nom: e.target.value })}
                      variant="outlined"
                      size="small"
                    />
                  </Box>
                ) : (
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Email fontSize="small" color="action" />
                      <Typography variant="body2">{user?.email}</Typography>
                    </Box>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Business fontSize="small" color="action" />
                      <Typography variant="body2">{user?.service_nom}</Typography>
                    </Box>
                  </Box>
                )}

                <Chip
                  label={getRoleLabel(user?.role || '')}
                  size="medium"
                  sx={{
                    backgroundColor: getRoleColor(user?.role || ''),
                    color: 'white',
                    fontWeight: 'bold',
                    mt: 2,
                    alignSelf: 'flex-start'
                  }}
                />
              </Box>

              {editMode && (
                <Box sx={{ mt: 3, display: 'flex', gap: 1 }}>
                  <Button 
                    variant="contained" 
                    onClick={handleSave}
                    startIcon={<Save />}
                    fullWidth
                  >
                    Sauvegarder
                  </Button>
                  <Button 
                    variant="outlined" 
                    onClick={handleCancel}
                    startIcon={<Cancel />}
                    fullWidth
                  >
                    Annuler
                  </Button>
                </Box>
              )}
            </CardContent>
          </Card>
        </Box>

        {/* Statistiques */}
        <Box sx={{ flex: { xs: '1', md: '0 0 66.667%' } }}>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2 }}>
            {/* Cartes de statistiques */}
            <Box sx={{ flex: { xs: '1 1 100%', sm: '1 1 50%', md: '1 1 25%' } }}>
              <Card sx={{ boxShadow: 3 }}>
                <CardContent sx={{ textAlign: 'center', py: 3 }}>
                  <Box sx={{ display: 'flex', justifyContent: 'center', mb: 2 }}>
                    <Analytics color="primary" sx={{ fontSize: 40 }} />
                  </Box>
                  <Typography variant="h4" color="primary" fontWeight="bold">
                    {stats.total}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Total à valider
                  </Typography>
                </CardContent>
              </Card>
            </Box>

            <Box sx={{ flex: { xs: '1 1 100%', sm: '1 1 50%', md: '1 1 25%' } }}>
              <Card sx={{ boxShadow: 3 }}>
                <CardContent sx={{ textAlign: 'center', py: 3 }}>
                  <Box sx={{ display: 'flex', justifyContent: 'center', mb: 2 }}>
                    <Pending color="warning" sx={{ fontSize: 40 }} />
                  </Box>
                  <Typography variant="h4" color="warning" fontWeight="bold">
                    {stats.enAttente}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    En attente de paiement
                  </Typography>
                </CardContent>
              </Card>
            </Box>

            <Box sx={{ flex: { xs: '1 1 100%', sm: '1 1 50%', md: '1 1 25%' } }}>
              <Card sx={{ boxShadow: 3 }}>
                <CardContent sx={{ textAlign: 'center', py: 3 }}>
                  <Box sx={{ display: 'flex', justifyContent: 'center', mb: 2 }}>
                    <CheckCircle color="success" sx={{ fontSize: 40 }} />
                  </Box>
                  <Typography variant="h4" color="success" fontWeight="bold">
                    {stats.completes}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Payées
                  </Typography>
                </CardContent>
              </Card>
            </Box>

            <Box sx={{ flex: { xs: '1 1 100%', sm: '1 1 50%', md: '1 1 25%' } }}>
              <Card sx={{ boxShadow: 3 }}>
                <CardContent sx={{ textAlign: 'center', py: 3 }}>
                  <Box sx={{ display: 'flex', justifyContent: 'center', mb: 2 }}>
                    <Speed color="info" sx={{ fontSize: 40 }} />
                  </Box>
                  <Typography variant="h4" color="info" fontWeight="bold">
                    {stats.tauxCompletion}%
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Taux de paiement
                  </Typography>
                  <Box sx={{ mt: 2 }}>
                    <LinearProgress 
                      variant="determinate" 
                      value={stats.tauxCompletion} 
                      sx={{ 
                        height: 8, 
                        borderRadius: 4,
                        backgroundColor: 'grey.200'
                      }}
                    />
                  </Box>
                </CardContent>
              </Card>
            </Box>
          </Box>

          {/* Liste des réquisitions */}
          <Box sx={{ mt: 3 }}>
            <Card sx={{ boxShadow: 3 }}>
              <CardContent sx={{ p: 3 }}>
                <Box sx={{ mb: 3 }}>
                  <Typography variant="h6" sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                    <Pending color="primary" /> Liste des réquisitions
                  </Typography>
                  
                  <Grid container spacing={2}>
                    <Grid size={{ xs: 12, md: 4 }}>
                      <FormControl size="small" fullWidth>
                        <InputLabel>Filtrer par statut</InputLabel>
                        <Select
                          value={filterStatus}
                          label="Filtrer par statut"
                          onChange={(e) => setFilterStatus(e.target.value)}
                        >
                          <MenuItem value="pending">En attente de validation</MenuItem>
                          <MenuItem value="all">Tout l'historique</MenuItem>
                          <MenuItem value="validee">Validées</MenuItem>
                          <MenuItem value="payee">Payées</MenuItem>
                          <MenuItem value="refusee">Refusées</MenuItem>
                        </Select>
                      </FormControl>
                    </Grid>
                    
                    <Grid size={{ xs: 12, md: 4 }}>
                      <FormControl size="small" fullWidth>
                        <InputLabel>Service</InputLabel>
                        <Select
                          value={filterService}
                          label="Service"
                          onChange={(e) => setFilterService(e.target.value)}
                        >
                          <MenuItem value="all">Tous les services</MenuItem>
                          {services.map((s: any) => (
                            <MenuItem key={s} value={s}>{s}</MenuItem>
                          ))}
                        </Select>
                      </FormControl>
                    </Grid>
                    
                    <Grid size={{ xs: 12, md: 4 }}>
                      <FormControl size="small" fullWidth>
                        <InputLabel>Urgence</InputLabel>
                        <Select
                          value={filterUrgence}
                          label="Urgence"
                          onChange={(e) => setFilterUrgence(e.target.value)}
                        >
                          <MenuItem value="all">Toutes urgences</MenuItem>
                          <MenuItem value="basse">Basse</MenuItem>
                          <MenuItem value="normale">Normale</MenuItem>
                          <MenuItem value="haute">Haute</MenuItem>
                          <MenuItem value="critique">Critique</MenuItem>
                        </Select>
                      </FormControl>
                    </Grid>
                  </Grid>
                </Box>

                {filteredRequisitions.length === 0 ? (
                  <Paper sx={{ p: 4, textAlign: 'center', bgcolor: '#f5f5f5' }}>
                    <Typography variant="body1" color="text.secondary">
                      Aucune réquisition trouvée pour ce filtre
                    </Typography>
                  </Paper>
                ) : (
                  <List>
                    {filteredRequisitions.map((requisition) => (
                      <ListItem key={requisition.id} divider>
                        <ListItemIcon>
                          <Pending color="primary" />
                        </ListItemIcon>
                        <ListItemText
                          primary={
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                              <Typography variant="subtitle2">
                                {requisition.reference}
                              </Typography>
                              <Typography variant="body2">
                                {requisition.objet}
                              </Typography>
                            </Box>
                          }
                          secondary={
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 0.5 }}>
                              <Chip
                                label={getStatutLabel(requisition.statut)}
                                size="small"
                                sx={{
                                  backgroundColor: getStatutColor(requisition.statut),
                                  color: 'white',
                                }}
                              />
                              <Chip
                                label={getUrgenceLabel(requisition.urgence)}
                                size="small"
                                sx={{
                                  backgroundColor: getUrgenceColor(requisition.urgence),
                                  color: 'white',
                                }}
                              />
                              {(requisition as any).nb_pieces !== undefined && (requisition as any).nb_pieces > 0 && (
                                <Chip
                                  label={`${(requisition as any).nb_pieces} pièce(s)`}
                                  size="small"
                                  icon={<AttachFile sx={{ fontSize: 16 }} />}
                                  variant="outlined"
                                />
                              )}
                              <Typography variant="caption" color="text.secondary">
                                {requisition.devise} {requisition.montant.toLocaleString()}
                              </Typography>
                              <Typography variant="caption" color="text.secondary">
                                {new Date(requisition.created_at).toLocaleDateString()}
                              </Typography>
                            </Box>
                          }
                        />
                        <IconButton 
                          onClick={() => navigate(`/requisitions/${requisition.id}`)}
                          color="primary"
                        >
                          <Visibility />
                        </IconButton>
                      </ListItem>
                    ))}
                  </List>
                )}
              </CardContent>
            </Card>
          </Box>
        </Box>
      </Box>
    </Container>
  );
};

export default GMProfile;
