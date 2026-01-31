import React from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Stepper,
  Step,
  StepLabel,
  StepContent,
  Chip,
  Avatar,
  Tooltip,
} from '@mui/material';
import {
  RadioButtonUnchecked,
  Person,
  Assessment,
  Verified,
  Loop,
} from '@mui/icons-material';
import { WorkflowStep, WorkflowHistory } from '../services/RequisitionService';

interface WorkflowTrackerProps {
  workflow: WorkflowHistory;
  compact?: boolean;
}

const WorkflowTracker: React.FC<WorkflowTrackerProps> = ({ workflow, compact = false }) => {
  const getStepAvatar = (step: WorkflowStep) => {
    const colors = {
      completed: '#4caf50',
      pending: '#9e9e9e',
      skipped: '#ff9800',
    };

    const getLevelIcon = () => {
      switch (step.level) {
        case 'analyst':
          return <Assessment />;
        case 'manager':
          return <Person sx={{ fontSize: 16 }} />;
        case 'director':
          return <Verified sx={{ fontSize: 18 }} />;
        default:
          return <RadioButtonUnchecked />;
      }
    };

    return (
      <Avatar
        sx={{
          bgcolor: colors[step.status],
          width: 32,
          height: 32,
          color: 'white',
        }}
      >
        {getLevelIcon()}
      </Avatar>
    );
  };

  const formatStepDate = (date?: string) => {
    if (!date) return '';
    return new Date(date).toLocaleDateString('fr-FR', {
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getStepProgress = () => {
    const completedSteps = workflow.steps.filter((s: WorkflowStep) => s.status === 'completed').length;
    return (completedSteps / workflow.steps.length) * 100;
  };

  if (compact) {
    return (
      <Card sx={{ mb: 2 }}>
        <CardContent>
          <Typography variant="h6" sx={{ mb: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
            <Loop sx={{ fontSize: 20 }} />
            Workflow - {getStepProgress().toFixed(0)}%
          </Typography>
          
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
            {workflow.steps.map((step: WorkflowStep, index: number) => (
              <Box
                key={step.id}
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 2,
                  p: 1,
                  borderRadius: 1,
                  bgcolor: step.status === 'completed' ? 'success.light' : 'grey.100',
                }}
              >
                {getStepAvatar(step)}
                <Box sx={{ flex: 1 }}>
                  <Typography variant="body2" sx={{ fontWeight: 'bold' }}>
                    {step.name}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {step.description}
                  </Typography>
                  {step.completed_at && (
                    <Typography variant="caption" color="text.secondary">
                      {formatStepDate(step.completed_at)}
                    </Typography>
                  )}
                </Box>
                <Chip
                  label={step.status}
                  size="small"
                  sx={{ 
                    minWidth: 80,
                    backgroundColor: step.status === 'completed' ? '#4caf50' : 
                                     step.status === 'pending' ? '#9e9e9e' : '#ff9800',
                    color: 'white'
                  }}
                />
              </Box>
            ))}
          </Box>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card sx={{ mb: 3 }}>
      <CardContent>
        <Typography variant="h6" sx={{ mb: 3, display: 'flex', alignItems: 'center', gap: 1 }}>
          <Loop sx={{ fontSize: 24 }} />
          Suivi du Workflow
        </Typography>
        
        <Stepper activeStep={workflow.steps.findIndex((s: WorkflowStep) => s.id === workflow.current_step)} orientation="vertical">
          {workflow.steps.map((step: WorkflowStep, index: number) => (
            <Step key={step.id} completed={step.status === 'completed'}>
              <StepLabel
                icon={getStepAvatar(step)}
                optional={
                  <Tooltip title={step.description}>
                    <Typography variant="caption">
                      {step.completed_by && `Par: ${step.completed_by}`}
                    </Typography>
                  </Tooltip>
                }
              >
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Typography variant="subtitle1" sx={{ fontWeight: 'bold' }}>
                    {step.name}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {step.level && `(${step.level.toUpperCase()})`}
                  </Typography>
                  <Chip
                    label={step.status}
                    size="small"
                    sx={{ 
                      minWidth: 80,
                      backgroundColor: step.status === 'completed' ? '#4caf50' : 
                                       step.status === 'pending' ? '#9e9e9e' : '#ff9800',
                      color: 'white'
                    }}
                  />
                </Box>
                {step.completed_at && (
                  <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5 }}>
                    {formatStepDate(step.completed_at)}
                  </Typography>
                )}
              </StepLabel>
              <StepContent>
                <Typography variant="body2" sx={{ mb: 1 }}>
                  {step.description}
                </Typography>
                {step.notes && (
                  <Box sx={{ mt: 1, p: 1, bgcolor: 'grey.50', borderRadius: 1 }}>
                    <Typography variant="caption" color="text.secondary">
                      <strong>Notes:</strong> {step.notes}
                    </Typography>
                  </Box>
                )}
                {step.completed_by && (
                  <Typography variant="caption" color="primary" sx={{ mt: 1 }}>
                    <Person sx={{ fontSize: 14, mr: 0.5, verticalAlign: 'middle' }} />
                    Complété par: {step.completed_by}
                  </Typography>
                )}
              </StepContent>
            </Step>
          ))}
        </Stepper>
        
        {/* Résumé du workflow */}
        <Box sx={{ mt: 3, p: 2, bgcolor: 'primary.light', borderRadius: 1 }}>
          <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 'bold' }}>
            Résumé du Workflow
          </Typography>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Typography variant="body2">
              Étape actuelle: <strong>{workflow.steps.find((s: WorkflowStep) => s.id === workflow.current_step)?.name}</strong>
            </Typography>
            <Typography variant="body2">
              Niveau actuel: <strong>{workflow.current_level?.toUpperCase()}</strong>
            </Typography>
            <Typography variant="body2">
              Progression: <strong>{getStepProgress().toFixed(0)}%</strong>
            </Typography>
          </Box>

          {/* Chronologie des événements */}
          <Box sx={{ mt: 2 }}>
            <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 'bold' }}>
              Chronologie des Événements
            </Typography>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
              {workflow.steps
                .filter((s: WorkflowStep) => s.status === 'completed')
                .sort((a, b) => new Date(a.completed_at || '').getTime() - new Date(b.completed_at || '').getTime())
                .map((step: WorkflowStep, index: number) => (
                  <Box 
                    key={step.id}
                    sx={{ 
                      display: 'flex', 
                      alignItems: 'center', 
                      gap: 1,
                      p: 1,
                      bgcolor: 'grey.50',
                      borderRadius: 1,
                      border: '1px solid #e0e0e0'
                    }}
                  >
                    <Typography variant="body2" sx={{ fontWeight: 'bold', minWidth: 120 }}>
                      {step.name}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {step.completed_by}
                    </Typography>
                    <Typography variant="caption" color="primary">
                      {step.completed_at && new Date(step.completed_at).toLocaleDateString('fr-FR', {
                        day: 'numeric',
                        month: 'short',
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </Typography>
                  </Box>
                ))}
            </Box>
          </Box>
        </Box>
      </CardContent>
    </Card>
  );
};

export default WorkflowTracker;
