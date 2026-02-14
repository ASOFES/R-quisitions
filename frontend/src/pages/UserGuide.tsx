import React from 'react';
import {
  Container,
  Typography,
  Box,
  Paper,
  Divider,
  Grid,
  Card,
  CardContent,
  Avatar,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
} from '@mui/material';
import {
  Help as HelpIcon,
  Person as PersonIcon,
  Assignment as AssignmentIcon,
  Security as AdminIcon,
  CheckCircle as CheckIcon,
  LocalAtm as MoneyIcon,
  Engineering as TechIcon,
  SupervisedUserCircle as SupervisorIcon,
  VerifiedUser as VerifiedIcon,
} from '@mui/icons-material';

const UserGuide: React.FC = () => {
  const roles = [
    {
      title: 'Émetteur (L\'Initiateur)',
      icon: <PersonIcon sx={{ fontSize: 40, color: 'primary.main' }} />,
      color: '#1976d2',
      summary: 'Point de départ de toute demande. Il transforme un besoin métier en une réquisition formelle.',
      responsibilities: [
        'Créer les réquisitions avec précision (objets, montants, pièces jointes).',
        'Suivre l\'avancement de ses propres demandes.',
        'Apporter les corrections demandées si une réquisition lui est retournée.',
      ],
      tip: 'Consultez régulièrement l\'onglet "À corriger" pour ne pas bloquer vos demandes en attente de précisions.',
    },
    {
      title: 'Chef de Service (Rôle Transversal)',
      icon: <SupervisorIcon sx={{ fontSize: 40, color: 'warning.main' }} />,
      color: '#ed6c02',
      summary: 'Premier filtre managérial. Tout rôle peut être Chef de Service pour son département.',
      responsibilities: [
        'Approuver ou refuser les demandes des membres de son service avant l\'examen de l\'Analyste.',
        'Garantir la pertinence opérationnelle de la dépense.',
      ],
      tip: 'Votre validation est le "feu vert" qui lance le processus officiel. Soyez vigilant sur la conformité.',
    },
    {
      title: 'Analyste (Le Superviseur du Flux)',
      icon: <AssignmentIcon sx={{ fontSize: 40, color: 'info.main' }} />,
      color: '#0288d1',
      summary: 'Gardien de la conformité et de la cohérence globale du système.',
      responsibilities: [
        'Examiner chaque demande entrante et vérifier l\'imputation budgétaire.',
        'Orienter la réquisition vers le Challenger ou le Validateur.',
        'Suivre le workflow de bout en bout (émission jusqu\'au paiement).',
      ],
      tip: 'Utilisez les filtres d\'urgence pour prioriser les dossiers critiques nécessitant une analyse rapide.',
    },
    {
      title: 'Challenger (Le Contrôleur des Coûts)',
      icon: <TechIcon sx={{ fontSize: 40, color: 'success.main' }} />,
      color: '#2e7d32',
      summary: 'Expert en optimisation et vérification de la justesse des coûts.',
      responsibilities: [
        'Challenger les prix et les quantités proposés.',
        'S\'assurer du meilleur rapport qualité/prix pour l\'entreprise.',
      ],
      tip: 'Votre rôle est d\'ajouter de la valeur par l\'économie. Demandez des devis comparatifs via les commentaires.',
    },
    {
      title: 'Validateur / PM (Le Décideur de Service)',
      icon: <VerifiedIcon sx={{ fontSize: 40, color: 'secondary.main' }} />,
      color: '#9c27b0',
      summary: 'Autorité budgétaire pour un service ou un projet spécifique.',
      responsibilities: [
        'Engager officiellement le budget de son service ou projet.',
        'Valider la faisabilité financière finale à son niveau hiérarchique.',
      ],
      tip: 'Surveillez vos statistiques de "Montant Total Validé" pour suivre la consommation de votre enveloppe.',
    },
    {
      title: 'GM (La Validation Finale)',
      icon: <CheckIcon sx={{ fontSize: 40, color: 'error.main' }} />,
      color: '#d32f2f',
      summary: 'Autorité suprême de l\'application pour la signature finale.',
      responsibilities: [
        'Apposer la signature finale pour les validations critiques.',
        'Arbitrer les priorités stratégiques de l\'entreprise.',
        'Exporter les bordereaux pour signature physique si nécessaire.',
      ],
      tip: 'Utilisez la fonction "Export PDF" pour générer vos bordereaux de signature en un clic.',
    },
    {
      title: 'Comptable (Le Gestionnaire des Fonds)',
      icon: <MoneyIcon sx={{ fontSize: 40, color: 'primary.dark' }} />,
      color: '#1565c0',
      summary: 'Exécuteur financier responsable du décaissement.',
      responsibilities: [
        'Procéder au paiement effectif et mettre à jour les soldes de caisse/banque.',
        'Clôturer définitivement la réquisition après paiement.',
      ],
      tip: 'Assurez-vous que le mode de paiement est renseigné avant de "Payer" pour une traçabilité parfaite.',
    },
    {
      title: 'Admin (Le Pilote)',
      icon: <AdminIcon sx={{ fontSize: 40, color: 'text.primary' }} />,
      color: '#212121',
      summary: 'Garant de la configuration, des accès et de la stabilité du système.',
      responsibilities: [
        'Gérer les utilisateurs, les services, les zones et les sites.',
        'Configurer les taux de change et les délais de validation automatique.',
      ],
      tip: 'Ajustez les délais de validation automatique pour éviter les goulots d\'étranglement.',
    },
  ];

  return (
    <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
      <Box sx={{ mb: 4, textAlign: 'center' }}>
        <HelpIcon sx={{ fontSize: 60, color: 'primary.main', mb: 2 }} />
        <Typography variant="h3" gutterBottom sx={{ fontWeight: 'bold', color: 'primary.main' }}>
          Guide d'Utilisation
        </Typography>
        <Typography variant="h6" color="text.secondary">
          Comprendre les rôles et responsabilités au sein du workflow des réquisitions
        </Typography>
      </Box>

      <Grid container spacing={4}>
        {roles.map((role, index) => (
          <Grid size={{ xs: 12, md: 6 }} key={index}>
            <Card 
              sx={{ 
                height: '100%', 
                display: 'flex', 
                flexDirection: 'column',
                borderRadius: 4,
                boxShadow: '0 4px 20px rgba(0,0,0,0.08)',
                transition: 'transform 0.2s',
                '&:hover': { transform: 'translateY(-4px)' }
              }}
            >
              <Box sx={{ p: 2, display: 'flex', alignItems: 'center', bgcolor: `${role.color}10` }}>
                <Avatar sx={{ bgcolor: 'white', p: 1, width: 60, height: 60, boxShadow: 1 }}>
                  {role.icon}
                </Avatar>
                <Typography variant="h5" sx={{ ml: 2, fontWeight: 'bold', color: role.color }}>
                  {role.title}
                </Typography>
              </Box>
              <CardContent sx={{ flexGrow: 1 }}>
                <Typography variant="subtitle1" gutterBottom sx={{ fontStyle: 'italic', color: 'text.primary', mb: 2 }}>
                  {role.summary}
                </Typography>
                
                <Typography variant="body2" sx={{ fontWeight: 'bold', mb: 1, textTransform: 'uppercase', color: 'text.secondary' }}>
                  Responsabilités :
                </Typography>
                <List dense>
                  {role.responsibilities.map((resp, i) => (
                    <ListItem key={i} sx={{ px: 0 }}>
                      <ListItemIcon sx={{ minWidth: 30 }}>
                        <CheckIcon sx={{ fontSize: 18, color: role.color }} />
                      </ListItemIcon>
                      <ListItemText primary={resp} />
                    </ListItem>
                  ))}
                </List>

                <Box sx={{ mt: 2, p: 2, bgcolor: 'grey.50', borderRadius: 2, borderLeft: `4px solid ${role.color}` }}>
                  <Typography variant="body2" sx={{ fontWeight: 'bold' }}>
                    💡 Conseil d'utilisation :
                  </Typography>
                  <Typography variant="body2">
                    {role.tip}
                  </Typography>
                </Box>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>
    </Container>
  );
};

export default UserGuide;
