import React, { useState, useEffect } from 'react';
import { 
  Typography, 
  Box, 
  Card, 
  CardContent, 
  TextField, 
  Button,
  Paper,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  IconButton,
  Chip,
  Alert,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  CircularProgress,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Divider,
  useTheme,
  alpha,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow
} from '@mui/material';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  Upload,
  Delete,
  Description,
  AttachFile,
  CloudUpload,
  PriorityHigh,
  ExpandMore,
  Reply,
  Edit,
  Add,
  Remove
} from '@mui/icons-material';
import RequisitionService from '../services/RequisitionService';
import { servicesAPI, Service, sitesAPI, Site } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { API_BASE_URL } from '../config';

interface FileAttachment {
  id: string;
  name: string;
  size: number;
  type: string;
  file: File;
  data: string | null; // Base64 data
}

interface RequisitionItem {
  id: string;
  description: string;
  quantite: number;
  prix_unitaire: number;
  total: number;
  site_id?: string; // Optional override
}

export default function RequisitionForm() {
  const navigate = useNavigate();
  const theme = useTheme();
  const [searchParams] = useSearchParams();
  const { user } = useAuth();
  
  console.log('RequisitionForm - User:', user);
  console.log('RequisitionForm - Component loaded');
  
  const [attachments, setAttachments] = useState<FileAttachment[]>([]);
  const [items, setItems] = useState<RequisitionItem[]>([
    { id: '1', description: '', quantite: 1, prix_unitaire: 0, total: 0 }
  ]);
  const [dragActive, setDragActive] = useState(false);
  const [loading, setLoading] = useState(false);
  const [relatedRequisition, setRelatedRequisition] = useState<any>(null);
  const [services, setServices] = useState<Service[]>([]);
  const [sites, setSites] = useState<Site[]>([]);
  
  // Vérifier si c'est une réponse à une réquisition existante ou une modification
  const relatedRequisitionId = searchParams.get('related_to');
  const editRequisitionId = searchParams.get('edit');
  const isResponse = !!relatedRequisitionId;
  const isEdit = !!editRequisitionId;
  
  const [formData, setFormData] = useState({
    objet: '',
    description: '',
    montant: '',
    urgence: 'normale',
    serviceDemandeur: '',
    siteId: '',
    explication: '' // Champ pour les explications supplémentaires
  });

  // Charger la réquisition à modifier
  useEffect(() => {
    if (editRequisitionId) {
      const fetchRequisition = async () => {
        try {
          const token = localStorage.getItem('token');
          const response = await fetch(`${API_BASE_URL}/api/requisitions/${editRequisitionId}`, {
            headers: {
              'Authorization': `Bearer ${token}`
            }
          });
          if (response.ok) {
            const data = await response.json();
            const req = data.requisition;
            const existingItems = data.items;
            
            // Empêcher la modification si la réquisition est terminée
            if (['validee', 'refusee', 'termine', 'payee', 'valide'].includes(req.statut) && (user as any)?.role !== 'admin') {
              alert("Cette réquisition est terminée et ne peut plus être modifiée.");
              navigate('/requisitions');
              return;
            }

            // setEditingRequisition(req);
            setFormData(prev => ({
              ...prev,
              objet: req.objet,
              description: req.commentaire_initial || '',
              montant: req.montant_usd?.toString() || req.montant_cdf?.toString() || '',
              serviceDemandeur: req.service_id?.toString() || '',
              siteId: req.site_id?.toString() || '',
              urgence: 'normale' // TODO: Ajouter urgence au modèle si nécessaire
            }));

            // Load existing items if any
            if (existingItems && existingItems.length > 0) {
                setItems(existingItems.map((item: any) => ({
                    id: Math.random().toString(36).substr(2, 9), // Generate new temp ID for frontend handling
                    description: item.description,
                    quantite: item.quantite,
                    prix_unitaire: item.prix_unitaire,
                    total: item.prix_total,
                    site_id: item.site_id?.toString() || ''
                })));
            }
            
            // Note: On ne charge pas les pièces jointes existantes dans le state 'attachments'
            // car ce sont de nouveaux fichiers. On pourrait afficher les existants séparément.
          }
        } catch (error) {
          console.error('Erreur chargement réquisition:', error);
        }
      };
      fetchRequisition();
    }
  }, [editRequisitionId, navigate]);

  // Charger la réquisition liée si existante
  useEffect(() => {
    if (relatedRequisitionId) {
      const requisitionService = RequisitionService.getInstance();
      const requisition = requisitionService.getAllRequisitions().find(r => r.id === parseInt(relatedRequisitionId));
      if (requisition) {
        setRelatedRequisition(requisition);
        // Pré-remplir avec des informations de base
        setFormData(prev => ({
          ...prev,
          objet: `Réponse à: ${requisition.objet}`,
          description: `Réponse à la réquisition ${requisition.reference}\n\n`,
          serviceDemandeur: requisition.service_id?.toString() || '',
          urgence: requisition.urgence
        }));
      }
    }
  }, [relatedRequisitionId]);

  useEffect(() => {
    const loadData = async () => {
      try {
        const [servicesData, sitesData] = await Promise.all([
          servicesAPI.getAll(),
          sitesAPI.getAll()
        ]);
        
        setServices(servicesData);
        setSites(sitesData);
        
        setFormData(prev => {
          if (prev.serviceDemandeur) {
            return prev;
          }
          let serviceValue = '';
          const userServiceId = (user as any)?.service_id;
          if (userServiceId) {
            serviceValue = String(userServiceId);
          } else if ((user as any)?.service_code) {
            const matchByCode = servicesData.find((s: Service) => s.code === (user as any).service_code);
            if (matchByCode) {
              serviceValue = String(matchByCode.id);
            }
          } else if (servicesData.length > 0) {
            serviceValue = String(servicesData[0].id);
          }
          if (!serviceValue) {
            return prev;
          }
          return {
            ...prev,
            serviceDemandeur: serviceValue
          };
        });
      } catch (error) {
        console.error('Erreur lors du chargement des données:', error);
      }
    };
    loadData();
  }, [user]);

  const handleFileUpload = (files: FileList | null) => {
    if (!files) return;

    const newAttachments: FileAttachment[] = Array.from(files).map(file => ({
      id: Math.random().toString(36).substr(2, 9),
      name: file.name,
      size: file.size,
      type: file.type,
      file: file,
      data: null // Sera ajouté lors de la soumission
    }));

    setAttachments(prev => [...prev, ...newAttachments]);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(false);
    handleFileUpload(e.dataTransfer.files);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(false);
  };

  const removeAttachment = (id: string) => {
    setAttachments(prev => prev.filter(att => att.id !== id));
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };



  // Fonction pour convertir le service demandeur en nom lisible
  const getServiceNom = (serviceCode: string) => {
    const service = services.find(
      s => String(s.id) === serviceCode || s.code === serviceCode
    );
    if (service) {
      return service.nom;
    }
    const localServices: { [key: string]: string } = {
      'informatique': 'Informatique',
      'finance': 'Finance',
      'rh': 'Ressources Humaines',
      'logistique': 'Logistique',
      'marketing': 'Marketing',
      'juridique': 'Juridique',
      'commercial': 'Commercial',
      'production': 'Production'
    };
    return localServices[serviceCode] || 'Autre';
  };

  const handleAddItem = () => {
    setItems(prev => [...prev, {
      id: Math.random().toString(36).substr(2, 9),
      description: '',
      quantite: 1,
      prix_unitaire: 0,
      total: 0,
      site_id: formData.siteId || ''
    }]);
  };

  const handleRemoveItem = (id: string) => {
    setItems(prev => prev.filter(item => item.id !== id));
  };

  const handleUpdateItem = (id: string, field: keyof RequisitionItem, value: any) => {
    setItems(prev => prev.map(item => {
      if (item.id === id) {
        const updatedItem = { ...item, [field]: value };
        
        // Recalculate total if quantity or price changes
        if (field === 'quantite' || field === 'prix_unitaire') {
          const qty = field === 'quantite' ? Number(value) : item.quantite;
          const price = field === 'prix_unitaire' ? Number(value) : item.prix_unitaire;
          updatedItem.total = qty * price;
        }
        
        return updatedItem;
      }
      return item;
    }));
  };

  useEffect(() => {
    const total = items.reduce((sum, item) => sum + item.total, 0);
    setFormData(prev => ({ ...prev, montant: total.toFixed(2) }));
  }, [items]);

  const handleSubmit = async () => {
    // Validation simple des champs
    if (!formData.objet.trim()) {
      alert('Veuillez remplir l\'objet de la réquisition');
      return;
    }
    
    if (!formData.description.trim()) {
      alert('Veuillez remplir la description');
      return;
    }
    
    if (!formData.montant || parseFloat(formData.montant) <= 0) {
      alert('Veuillez entrer un montant valide');
      return;
    }
    
    if (!formData.serviceDemandeur.trim()) {
      alert('Veuillez sélectionner le service demandeur');
      return;
    }

    setLoading(true);

    try {
      // Récupérer le token depuis localStorage
      const token = localStorage.getItem('token');
      if (!token) {
        alert('Vous devez être connecté pour créer une réquisition');
        return;
      }

      // Préparer les données pour l'API
      const formDataAPI = new FormData();
      formDataAPI.append('objet', formData.objet);
      formDataAPI.append('montant_usd', formData.montant);
      formDataAPI.append('commentaire_initial', formData.description);
      formDataAPI.append('service_id', formData.serviceDemandeur);
      if (formData.siteId) {
        formDataAPI.append('site_id', formData.siteId);
      }
      
      // Add items
      formDataAPI.append('items', JSON.stringify(items.map(item => ({
        description: item.description,
        quantite: item.quantite,
        prix_unitaire: item.prix_unitaire,
        prix_total: item.total,
        site_id: item.site_id || formData.siteId || null
      }))));
      
      // Ajouter related_to si présent
      if (relatedRequisitionId) {
        formDataAPI.append('related_to', relatedRequisitionId);
      }

      // Si mode édition (correction)
      if (isEdit) {
        formDataAPI.append('resubmit', 'true');
      }
      
      // Ajouter les pièces jointes
      attachments.forEach((attachment) => {
        formDataAPI.append('pieces', attachment.file);
      });

      // Appeler l'API backend
      const url = isEdit 
        ? `${API_BASE_URL}/api/requisitions/${editRequisitionId}`
        : `${API_BASE_URL}/api/requisitions`;
        
      const method = isEdit ? 'PUT' : 'POST';

      const response = await fetch(url, {
        method: method,
        headers: {
          'Authorization': `Bearer ${token}`,
        },
        body: formDataAPI
      });

      if (response.ok) {
        const result = await response.json();
        console.log(`Réquisition ${isEdit ? 'mise à jour' : 'créée'} via API:`, result);
        
        const message = isEdit 
          ? 'Réquisition corrigée et resoumise avec succès !'
          : `Réquisition soumise avec succès!\n\nNuméro: ${result.numero}\nObjet: ${formData.objet}\nMontant: ${formData.montant}\nService: ${getServiceNom(formData.serviceDemandeur)}\nInitiateur: ${user?.nom_complet || user?.username || 'Moi'}\nPièces jointes: ${attachments.length}`;
          
        alert(message);
        
        // Redirection vers la liste des réquisitions
        setTimeout(() => {
          navigate('/requisitions');
        }, 1500);
      } else {
        const errorData = await response.json();
        console.error('Erreur API:', errorData);
        alert(`Erreur: ${errorData.error || 'Erreur lors de la création de la réquisition'}`);
      }
    } catch (error) {
      console.error('Erreur lors de la soumission:', error);
      alert('Une erreur est survenue lors de la soumission. Veuillez réessayer.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box sx={{ maxWidth: '100%' }}>
      <Typography variant="h4" sx={{ fontWeight: 'bold', mb: 3, color: 'primary.main' }}>
        {isResponse ? (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Reply />
            Réponse à une réquisition
          </Box>
        ) : isEdit ? (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Edit />
            Correction de la réquisition
          </Box>
        ) : (
          'Nouvelle Réquisition'
        )}
      </Typography>

      {/* Afficher la réquisition liée si c'est une réponse */}
      {isResponse && relatedRequisition && (
        <Alert severity="info" sx={{ mb: 3, borderRadius: 2 }}>
          <Typography variant="subtitle2" sx={{ fontWeight: 'bold', mb: 1 }}>
            Réquisition référencée: {relatedRequisition.reference}
          </Typography>
          <Typography variant="body2" sx={{ mb: 1 }}>
            <strong>Objet:</strong> {relatedRequisition.objet}
          </Typography>
          <Typography variant="body2" sx={{ mb: 1 }}>
            <strong>Statut:</strong> {relatedRequisition.statut}
          </Typography>
          {relatedRequisition.analyses && relatedRequisition.analyses.length > 0 && (
            <Accordion sx={{ mt: 2, bgcolor: 'transparent', boxShadow: 'none', '&:before': { display: 'none' } }}>
              <AccordionSummary expandIcon={<ExpandMore />} sx={{ p: 0 }}>
                <Typography variant="body2" sx={{ fontWeight: 600, color: 'primary.main' }}>
                  Voir les annotations et recommandations
                </Typography>
              </AccordionSummary>
              <AccordionDetails sx={{ p: 0 }}>
                {relatedRequisition.analyses.map((analysis: any, index: number) => (
                  <Box key={index} sx={{ mb: 2, p: 2, bgcolor: 'background.paper', borderRadius: 1, border: 1, borderColor: 'divider' }}>
                    <Typography variant="subtitle2" sx={{ mb: 1, color: 'primary.main' }}>
                      Analyse #{index + 1} - {new Date(analysis.analysis_date).toLocaleDateString()}
                    </Typography>
                    <Typography variant="body2" sx={{ mb: 1 }}>
                      <strong>Notes:</strong> {analysis.notes}
                    </Typography>
                    <Typography variant="body2" sx={{ mb: 1 }}>
                      <strong>Évaluation:</strong> {analysis.rating}/5
                    </Typography>
                    <Typography variant="body2">
                      <strong>Recommandation:</strong> {analysis.recommendation}
                    </Typography>
                  </Box>
                ))}
              </AccordionDetails>
            </Accordion>
          )}
        </Alert>
      )}
      
      <Card sx={{ borderRadius: 2, boxShadow: '0 4px 20px rgba(0,0,0,0.05)' }}>
        <CardContent sx={{ p: 4 }}>
          <Typography variant="h6" sx={{ mb: 3, fontWeight: 600, color: 'text.secondary', borderBottom: 1, borderColor: 'divider', pb: 1 }}>
            Informations générales
          </Typography>
          
          <Box sx={{ display: 'flex', gap: 3, flexDirection: { xs: 'column', md: 'row' }, mb: 3 }}>
            <TextField
              fullWidth
              label="Objet de la réquisition"
              value={formData.objet}
              onChange={(e) => setFormData(prev => ({ ...prev, objet: e.target.value }))}
              placeholder="Ex: Achat de matériel informatique"
              variant="outlined"
            />
            <TextField
              fullWidth
              label="Montant Total"
              type="number"
              value={formData.montant}
              InputProps={{
                readOnly: true,
                startAdornment: <Box component="span" sx={{ color: 'text.secondary', mr: 1 }}>$</Box>,
              }}
              sx={{ maxWidth: { md: 300 }, bgcolor: 'grey.100' }}
            />
          </Box>
          
          <Box sx={{ display: 'flex', gap: 3, flexDirection: { xs: 'column', md: 'row' }, mb: 3 }}>
            <FormControl fullWidth>
              <InputLabel>Service demandeur</InputLabel>
              <Select
                value={formData.serviceDemandeur}
                onChange={(e) => setFormData(prev => ({ ...prev, serviceDemandeur: e.target.value }))}
                label="Service demandeur"
              >
                {services.length > 0 ? (
                  services.map(service => (
                    <MenuItem key={service.id} value={String(service.id)}>
                      {service.nom}
                    </MenuItem>
                  ))
                ) : (
                  <MenuItem value="">Aucun service disponible</MenuItem>
                )}
              </Select>
            </FormControl>

            <FormControl fullWidth>
              <InputLabel>Site (Optionnel)</InputLabel>
              <Select
                value={formData.siteId}
                onChange={(e) => {
                  const newSiteId = e.target.value;
                  setFormData(prev => ({ ...prev, siteId: newSiteId }));
                  // Update items that don't have a specific site set (or all items if user wants?)
                  // For now, let's just update the state, and new items will pick it up.
                }}
                label="Site (Optionnel)"
              >
                <MenuItem value="">Aucun site global</MenuItem>
                {sites.map(site => (
                  <MenuItem key={site.id} value={String(site.id)}>
                    {site.nom}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            <FormControl fullWidth>
              <InputLabel>Niveau d'urgence</InputLabel>
              <Select
                value={formData.urgence}
                onChange={(e) => setFormData(prev => ({ ...prev, urgence: e.target.value }))}
                label="Niveau d'urgence"
              >
                <MenuItem value="basse">
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <PriorityHigh sx={{ color: '#4caf50', fontSize: 16 }} />
                    Basse
                  </Box>
                </MenuItem>
                <MenuItem value="normale">
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <PriorityHigh sx={{ color: '#2196f3', fontSize: 16 }} />
                    Normale
                  </Box>
                </MenuItem>
                <MenuItem value="haute">
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <PriorityHigh sx={{ color: '#ff9800', fontSize: 16 }} />
                    Haute
                  </Box>
                </MenuItem>
                <MenuItem value="critique">
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <PriorityHigh sx={{ color: '#f44336', fontSize: 16 }} />
                    Critique
                  </Box>
                </MenuItem>
              </Select>
            </FormControl>
          </Box>

          <Typography variant="h6" sx={{ mb: 2, fontWeight: 600, color: 'text.secondary', borderBottom: 1, borderColor: 'divider', pb: 1 }}>
            Détails des articles
          </Typography>

          <TableContainer component={Paper} variant="outlined" sx={{ mb: 3 }}>
            <Table size="small">
              <TableHead>
                <TableRow sx={{ bgcolor: 'grey.50' }}>
                  <TableCell width="40%">Description</TableCell>
                  <TableCell width="10%">Qté</TableCell>
                  <TableCell width="15%">P.U ($)</TableCell>
                  <TableCell width="15%">Total ($)</TableCell>
                  <TableCell width="15%">Site (Optionnel)</TableCell>
                  <TableCell width="5%"></TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {items.map((item, index) => (
                  <TableRow key={item.id}>
                    <TableCell>
                      <TextField
                        fullWidth
                        size="small"
                        variant="standard"
                        placeholder="Description de l'article"
                        value={item.description}
                        onChange={(e) => handleUpdateItem(item.id, 'description', e.target.value)}
                      />
                    </TableCell>
                    <TableCell>
                      <TextField
                        fullWidth
                        size="small"
                        variant="standard"
                        type="number"
                        value={item.quantite}
                        onChange={(e) => handleUpdateItem(item.id, 'quantite', e.target.value)}
                      />
                    </TableCell>
                    <TableCell>
                      <TextField
                        fullWidth
                        size="small"
                        variant="standard"
                        type="number"
                        value={item.prix_unitaire}
                        onChange={(e) => handleUpdateItem(item.id, 'prix_unitaire', e.target.value)}
                      />
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" fontWeight="bold">
                        {item.total.toFixed(2)} $
                      </Typography>
                    </TableCell>
                    <TableCell>
                       <Select
                        fullWidth
                        variant="standard"
                        size="small"
                        value={item.site_id || ''}
                        displayEmpty
                        onChange={(e) => handleUpdateItem(item.id, 'site_id', e.target.value)}
                      >
                        <MenuItem value="">
                          <Typography variant="caption" color="text.secondary">
                            {formData.siteId ? '(Site global)' : 'Aucun'}
                          </Typography>
                        </MenuItem>
                        {sites.map(site => (
                          <MenuItem key={site.id} value={String(site.id)}>
                            {site.nom}
                          </MenuItem>
                        ))}
                      </Select>
                    </TableCell>
                    <TableCell>
                      <IconButton 
                        size="small" 
                        color="error" 
                        onClick={() => handleRemoveItem(item.id)}
                        disabled={items.length === 1}
                      >
                        <Remove fontSize="small" />
                      </IconButton>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <Box sx={{ p: 1, display: 'flex', justifyContent: 'space-between', alignItems: 'center', bgcolor: 'grey.50' }}>
              <Button 
                startIcon={<Add />} 
                onClick={handleAddItem}
                size="small"
              >
                Ajouter une ligne
              </Button>
              <Typography variant="subtitle1" fontWeight="bold">
                Total: {items.reduce((sum, item) => sum + item.total, 0).toFixed(2)} $
              </Typography>
            </Box>
          </TableContainer>

          <TextField
            fullWidth
            label="Description détaillée"
            multiline
            rows={4}
            value={formData.description}
            onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
            sx={{ mb: 3 }}
            placeholder="Décrivez votre besoin en détail..."
          />

          {/* Champ d'explication supplémentaire */}
          {isResponse && (
            <TextField
              fullWidth
              label="Explications supplémentaires"
              multiline
              rows={3}
              placeholder="Veuillez fournir des explications supplémentaires concernant votre réponse..."
              value={formData.explication}
              onChange={(e) => setFormData(prev => ({ ...prev, explication: e.target.value }))}
              sx={{ mb: 3 }}
              helperText="Ce champ permet d'expliquer les raisons de votre réponse"
            />
          )}
          
          {/* Section pièces justificatives */}
          <Typography variant="h6" sx={{ mb: 2, display: 'flex', alignItems: 'center', gap: 1, fontWeight: 600, color: 'text.secondary', borderBottom: 1, borderColor: 'divider', pb: 1, mt: 4 }}>
            <AttachFile />
            Pièces Justificatives
            <Chip 
              label={attachments.length + ' fichier(s)'} 
              size="small" 
              color="primary" 
              variant="outlined"
            />
          </Typography>

          {/* Zone de drag & drop */}
          <Paper
            elevation={0}
            sx={{
              p: 4,
              mb: 3,
              border: '2px dashed',
              borderColor: dragActive ? 'primary.main' : 'grey.300',
              backgroundColor: dragActive ? alpha(theme.palette.primary.main, 0.1) : 'grey.50',
              cursor: 'pointer',
              borderRadius: 2,
              transition: 'all 0.3s ease',
              '&:hover': {
                borderColor: 'primary.main',
                backgroundColor: alpha(theme.palette.primary.main, 0.05),
                transform: 'scale(1.01)'
              }
            }}
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onClick={() => document.getElementById('file-input')?.click()}
          >
            <Box sx={{ textAlign: 'center' }}>
              <CloudUpload sx={{ fontSize: 48, color: 'primary.light', mb: 2 }} />
              <Typography variant="h6" color="text.primary" sx={{ mb: 1, fontWeight: 500 }}>
                Glissez les fichiers ici
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                ou cliquez pour sélectionner depuis votre ordinateur
              </Typography>
              <Button variant="contained" startIcon={<Upload />} sx={{ mt: 1 }}>
                Parcourir les fichiers
              </Button>
              <input
                id="file-input"
                type="file"
                multiple
                hidden
                onChange={(e) => handleFileUpload(e.target.files)}
                accept=".pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png"
              />
            </Box>
          </Paper>

          {/* Liste des fichiers attachés */}
          {attachments.length > 0 && (
            <Paper variant="outlined" sx={{ mb: 3, borderRadius: 2 }}>
              <Box sx={{ p: 2, backgroundColor: 'grey.50', borderBottom: 1, borderColor: 'divider' }}>
                <Typography variant="subtitle2" color="text.secondary" fontWeight={600}>
                  Fichiers sélectionnés
                </Typography>
              </Box>
              <List dense sx={{ p: 0 }}>
                {attachments.map((attachment, index) => (
                  <React.Fragment key={attachment.id}>
                    {index > 0 && <Divider />}
                    <ListItem sx={{ py: 1.5 }}>
                      <ListItemIcon>
                        <Description color="primary" />
                      </ListItemIcon>
                      <ListItemText
                        primary={<Typography variant="body2" fontWeight={500}>{attachment.name}</Typography>}
                        secondary={formatFileSize(attachment.size)}
                      />
                      <IconButton
                        edge="end"
                        onClick={() => removeAttachment(attachment.id)}
                        color="error"
                        size="small"
                      >
                        <Delete />
                      </IconButton>
                    </ListItem>
                  </React.Fragment>
                ))}
              </List>
            </Paper>
          )}

          {/* Message d'aide */}
          <Alert severity="info" sx={{ mb: 4, borderRadius: 2 }}>
            <Typography variant="body2">
              Formats acceptés : PDF, DOC, DOCX, XLS, XLSX, JPG, JPEG, PNG. 
              Vous pouvez joindre plusieurs fichiers pour une seule réquisition.
            </Typography>
          </Alert>
          
          <Box sx={{ display: 'flex', gap: 2, justifyContent: 'flex-end', pt: 2, borderTop: 1, borderColor: 'divider' }}>
            <Button
              variant="outlined"
              onClick={() => navigate('/requisitions')}
              sx={{ px: 3 }}
            >
              Annuler
            </Button>
            <Button 
              variant="contained"
              onClick={handleSubmit}
              disabled={loading}
              sx={{ minWidth: 150, px: 4, py: 1, boxShadow: '0 4px 12px rgba(13, 71, 161, 0.2)' }}
            >
              {loading ? (
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <CircularProgress size={20} color="inherit" />
                  Soumission...
                </Box>
              ) : (
                <>
                  Soumettre{attachments.length > 0 ? ` (${attachments.length})` : ''}
                </>
              )}
            </Button>
          </Box>
        </CardContent>
      </Card>
    </Box>
  );
}
