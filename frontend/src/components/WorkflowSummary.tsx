import React from 'react';
import {
  Box,
  Typography,
  Chip,
  Tooltip,
  Menu,
  MenuItem,
  ListItemIcon,
  ListItemText,
} from '@mui/material';
import {
  Timeline,
  MoreVert,
  CheckCircle,
  RadioButtonUnchecked,
  Schedule,
} from '@mui/icons-material';
import { WorkflowHistory, WorkflowStep } from '../services/RequisitionService';

interface WorkflowSummaryProps {
  workflow: WorkflowHistory;
  onShowDetails?: () => void;
}

const WorkflowSummary: React.FC<WorkflowSummaryProps> = ({ workflow, onShowDetails }) => {
  const [anchorEl, setAnchorEl] = React.useState<null | HTMLElement>(null);
  const open = Boolean(anchorEl);

  const handleClick = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleClose = () => {
    setAnchorEl(null);
  };

  const getCompletedSteps = () => {
    return workflow.steps.filter((s: WorkflowStep) => s.status === 'completed');
  };

  const getCurrentStep = () => {
    return workflow.steps.find((s: WorkflowStep) => s.id === workflow.current_step);
  };

  const getProgressPercentage = () => {
    const completed = getCompletedSteps().length;
    return Math.round((completed / workflow.steps.length) * 100);
  };

  const formatDateTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('fr-FR', {
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getStepStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle sx={{ fontSize: 16, color: '#4caf50' }} />;
      case 'pending':
        return <RadioButtonUnchecked sx={{ fontSize: 16, color: '#9e9e9e' }} />;
      case 'skipped':
        return <Schedule sx={{ fontSize: 16, color: '#ff9800' }} />;
      default:
        return <RadioButtonUnchecked sx={{ fontSize: 16, color: '#9e9e9e' }} />;
    }
  };

  return (
    <Box>
      {/* Bouton d'action principal */}
      <Tooltip title="Suivi de la demande">
        <Chip
          label={`Suivi de la demande - ${getProgressPercentage()}%`}
          icon={<Timeline />}
          onClick={handleClick}
          sx={{
            cursor: 'pointer',
            '&:hover': {
              backgroundColor: 'primary.light',
            },
          }}
        />
      </Tooltip>

      {/* Menu déroulant avec la chronologie */}
      <Menu
        anchorEl={anchorEl}
        open={open}
        onClose={handleClose}
        PaperProps={{
          sx: {
            maxHeight: 400,
            width: 350,
            p: 1,
          },
        }}
      >
        <MenuItem disabled>
          <ListItemIcon>
            <Timeline />
          </ListItemIcon>
          <ListItemText
            primary="Chronologie de la demande"
            secondary={`Progression: ${getProgressPercentage()}%`}
          />
        </MenuItem>

        {getCompletedSteps()
          .sort((a, b) => new Date(a.completed_at || '').getTime() - new Date(b.completed_at || '').getTime())
          .map((step: WorkflowStep) => (
            <MenuItem key={step.id} onClick={handleClose}>
              <ListItemIcon>
                {getStepStatusIcon(step.status)}
              </ListItemIcon>
              <ListItemText
                primary={step.name}
                secondary={
                  <Box>
                    <Typography variant="caption" display="block">
                      {step.completed_by}
                    </Typography>
                    <Typography variant="caption" color="primary">
                      {step.completed_at && formatDateTime(step.completed_at)}
                    </Typography>
                  </Box>
                }
              />
            </MenuItem>
          ))}

        {/* Étape actuelle */}
        {getCurrentStep() && getCurrentStep()?.status === 'pending' && (
          <MenuItem disabled>
            <ListItemIcon>
              {getStepStatusIcon('pending')}
            </ListItemIcon>
            <ListItemText
              primary={getCurrentStep()?.name}
              secondary="En attente..."
            />
          </MenuItem>
        )}

        <MenuItem onClick={handleClose}>
          <ListItemIcon>
            <MoreVert />
          </ListItemIcon>
          <ListItemText primary="Voir les détails complets" />
        </MenuItem>
      </Menu>
    </Box>
  );
};

export default WorkflowSummary;
