import React from 'react';
import { Container, Typography, Box, Button } from '@mui/material';
import { ArrowBack } from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';

const FinancialPage: React.FC = () => {
  const navigate = useNavigate();

  return (
    <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', mb: 4 }}>
        <Button onClick={() => navigate('/dashboard')} startIcon={<ArrowBack />} sx={{ mr: 2 }}>
          Retour
        </Button>
        <Typography variant="h4">Historique financier</Typography>
      </Box>
      
      <Box sx={{ p: 3, border: '1px solid #e0e0e0', borderRadius: 2, textAlign: 'center' }}>
        <Typography variant="h6" color="text.secondary" sx={{ mb: 2 }}>
          🚧 En construction
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Cette page sera bientôt disponible pour consulter l'historique financier.
        </Typography>
      </Box>
    </Container>
  );
};

export default FinancialPage;
