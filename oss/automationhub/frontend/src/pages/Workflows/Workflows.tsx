import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Button,
  Grid,
  Card,
  CardContent,
  CardActions,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Chip,
  IconButton,
  Menu,
  MenuItem,
  Alert,
  Snackbar,
  Fab,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
  Divider,
  Badge,
  Tooltip,
} from '@mui/material';
import {
  Add,
  PlayArrow,
  Edit,
  Delete,
  MoreVert,
  SmartToy,
  Psychology,
  Storage,
  Code,
  Visibility,
  Stop,
  Refresh,
  Timeline,
  Assessment,
} from '@mui/icons-material';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import { useNavigate } from 'react-router-dom';

// Import the WorkflowBuilder component
import WorkflowBuilder from '../WorkflowBuilder/WorkflowBuilder';

// Types
interface Workflow {
  id: string;
  name: string;
  description: string;
  definition: any;
  status: 'active' | 'inactive' | 'running' | 'completed' | 'failed';
  owner_id: string;
  created_at: string;
  updated_at: string;
  execution_count?: number;
  last_execution?: string;
}

interface WorkflowExecution {
  id: string;
  workflow_id: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  result?: any;
  error_message?: string;
  started_at: string;
  completed_at?: string;
}

import { useWorkflows, useExecuteWorkflow, useDeleteWorkflow } from '../../services/workflowApi';

const WorkflowCard: React.FC<{
  workflow: Workflow;
  onEdit: (workflow: Workflow) => void;
  onExecute: (workflowId: string) => void;
  onDelete: (workflowId: string) => void;
}> = ({ workflow, onEdit, onExecute, onDelete }) => {
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [isExecuting, setIsExecuting] = useState(false);

  const handleMenuClick = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleMenuClose = () => {
    setAnchorEl(null);
  };

  const handleExecute = async () => {
    setIsExecuting(true);
    await onExecute(workflow.id);
    setTimeout(() => setIsExecuting(false), 3000);
    handleMenuClose();
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
        return 'success';
      case 'running':
        return 'warning';
      case 'completed':
        return 'primary';
      case 'failed':
        return 'error';
      default:
        return 'default';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'running':
        return <PlayArrow />;
      case 'completed':
        return <Assessment />;
      case 'failed':
        return <Stop />;
      default:
        return <Timeline />;
    }
  };

  return (
    <Card sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <CardContent sx={{ flexGrow: 1 }}>
        <Box display="flex" justifyContent="space-between" alignItems="flex-start" mb={2}>
          <Typography variant="h6" component="h2" gutterBottom>
            {workflow.name}
          </Typography>
          <IconButton size="small" onClick={handleMenuClick}>
            <MoreVert />
          </IconButton>
        </Box>

        <Typography variant="body2" color="text.secondary" paragraph>
          {workflow.description}
        </Typography>

        <Box display="flex" gap={1} mb={2} flexWrap="wrap">
          <Chip
            label={workflow.status}
            color={getStatusColor(workflow.status) as any}
            size="small"
            icon={getStatusIcon(workflow.status)}
          />
          <Chip
            label={`${workflow.execution_count || 0} executions`}
            variant="outlined"
            size="small"
            icon={<Assessment />}
          />
        </Box>

        {workflow.last_execution && (
          <Typography variant="caption" color="text.secondary">
            Last run: {new Date(workflow.last_execution).toLocaleString()}
          </Typography>
        )}
      </CardContent>

      <CardActions>
        <Button
          size="small"
          startIcon={<PlayArrow />}
          onClick={() => onExecute(workflow.id)}
          disabled={isExecuting || workflow.status === 'running'}
          variant="contained"
        >
          {isExecuting ? 'Running...' : 'Run'}
        </Button>
        <Button
          size="small"
          startIcon={<Edit />}
          onClick={() => onEdit(workflow)}
        >
          Edit
        </Button>
        <Button
          size="small"
          startIcon={<Visibility />}
          onClick={() => {/* TODO: Show execution history */}}
        >
          History
        </Button>
      </CardActions>

      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={handleMenuClose}
      >
        <MenuItem onClick={handleExecute}>
          <PlayArrow sx={{ mr: 1 }} /> Run Now
        </MenuItem>
        <MenuItem onClick={() => { onEdit(workflow); handleMenuClose(); }}>
          <Edit sx={{ mr: 1 }} /> Edit
        </MenuItem>
        <MenuItem onClick={() => {/* TODO: Duplicate workflow */}}>
          <Add sx={{ mr: 1 }} /> Duplicate
        </MenuItem>
        <MenuItem onClick={() => {/* TODO: Export workflow */}}>
          <Visibility sx={{ mr: 1 }} /> Export
        </MenuItem>
        <Divider />
        <MenuItem
          onClick={() => { onDelete(workflow.id); handleMenuClose(); }}
          sx={{ color: 'error.main' }}
        >
          <Delete sx={{ mr: 1 }} /> Delete
        </MenuItem>
      </Menu>
    </Card>
  );
};

const Workflows: React.FC = () => {
  const [selectedWorkflow, setSelectedWorkflow] = useState<Workflow | null>(null);
  const [isBuilderOpen, setIsBuilderOpen] = useState(false);
  const [isNewWorkflow, setIsNewWorkflow] = useState(false);
  const [alert, setAlert] = useState<{ message: string; severity: 'success' | 'error' } | null>(null);

  const navigate = useNavigate();
  const queryClient = useQueryClient();

  // Fetch workflows
  const { data: workflows = [], isLoading, error } = useWorkflows();

  // Execute workflow mutation
  const executeMutation = useExecuteWorkflow();

  // Delete workflow mutation
  const deleteMutation = useDeleteWorkflow();

  const handleCreateWorkflow = () => {
    setIsNewWorkflow(true);
    setSelectedWorkflow(null);
    setIsBuilderOpen(true);
  };

  const handleEditWorkflow = (workflow: Workflow) => {
    setIsNewWorkflow(false);
    setSelectedWorkflow(workflow);
    setIsBuilderOpen(true);
  };

  const handleExecuteWorkflow = (workflowId: string) => {
    executeMutation.mutate(workflowId, {
      onSuccess: () => {
        setAlert({ message: 'Workflow execution started!', severity: 'success' });
      },
      onError: () => {
        setAlert({ message: 'Failed to execute workflow', severity: 'error' });
      },
    });
  };

  const handleDeleteWorkflow = (workflowId: string) => {
    if (window.confirm('Are you sure you want to delete this workflow?')) {
      deleteMutation.mutate(workflowId, {
        onSuccess: () => {
          setAlert({ message: 'Workflow deleted successfully!', severity: 'success' });
        },
        onError: () => {
          setAlert({ message: 'Failed to delete workflow', severity: 'error' });
        },
      });
    }
  };

  const handleBuilderClose = () => {
    setIsBuilderOpen(false);
    setSelectedWorkflow(null);
    setIsNewWorkflow(false);
  };

  const handleSaveWorkflow = (workflowData: any) => {
    // This will be handled by the WorkflowBuilder component's save mutation
    // Just show success message and close
    setAlert({ message: 'Workflow saved successfully!', severity: 'success' });
    handleBuilderClose();
  };

  const activeWorkflows = workflows.filter(w => w.status === 'active');
  const runningWorkflows = workflows.filter(w => w.status === 'running');

  if (error) {
    return (
      <Alert severity="error" sx={{ m: 2 }}>
        Failed to load workflows. Please try again.
      </Alert>
    );
  }

  return (
    <Box sx={{ p: 3 }}>
      {/* Header */}
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Box>
          <Typography variant="h3" component="h1" gutterBottom>
            Workflows
          </Typography>
          <Typography variant="body1" color="text.secondary">
            Create and manage automated workflows with AI-powered agents
          </Typography>
        </Box>
        <Button
          variant="contained"
          startIcon={<Add />}
          onClick={handleCreateWorkflow}
          size="large"
        >
          Create Workflow
        </Button>
      </Box>

      {/* Stats Cards */}
      <Grid container spacing={3} sx={{ mb: 3 }}>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Box display="flex" alignItems="center">
                <Badge badgeContent={workflows.length} color="primary">
                  <Timeline color="action" />
                </Badge>
                <Box ml={2}>
                  <Typography variant="h6">Total Workflows</Typography>
                  <Typography variant="body2" color="text.secondary">
                    All workflows
                  </Typography>
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Box display="flex" alignItems="center">
                <Badge badgeContent={activeWorkflows.length} color="success">
                  <PlayArrow color="action" />
                </Badge>
                <Box ml={2}>
                  <Typography variant="h6">Active</Typography>
                  <Typography variant="body2" color="text.secondary">
                    Ready to run
                  </Typography>
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Box display="flex" alignItems="center">
                <Badge badgeContent={runningWorkflows.length} color="warning">
                  <Refresh color="action" />
                </Badge>
                <Box ml={2}>
                  <Typography variant="h6">Running</Typography>
                  <Typography variant="body2" color="text.secondary">
                    Currently executing
                  </Typography>
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Box display="flex" alignItems="center">
                <Assessment color="action" />
                <Box ml={2}>
                  <Typography variant="h6">
                    {workflows.reduce((sum, w) => sum + (w.execution_count || 0), 0)}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Total Executions
                  </Typography>
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Workflow Grid */}
      <Grid container spacing={3}>
        {workflows.map((workflow) => (
          <Grid item xs={12} sm={6} md={4} key={workflow.id}>
            <WorkflowCard
              workflow={workflow}
              onEdit={handleEditWorkflow}
              onExecute={handleExecuteWorkflow}
              onDelete={handleDeleteWorkflow}
            />
          </Grid>
        ))}
      </Grid>

      {/* Empty State */}
      {workflows.length === 0 && !isLoading && (
        <Box
          display="flex"
          flexDirection="column"
          alignItems="center"
          justifyContent="center"
          sx={{ py: 8 }}
        >
          <Typography variant="h6" color="text.secondary" gutterBottom>
            No workflows yet
          </Typography>
          <Typography variant="body2" color="text.secondary" paragraph>
            Create your first workflow to get started with automation
          </Typography>
          <Button
            variant="contained"
            startIcon={<Add />}
            onClick={handleCreateWorkflow}
          >
            Create Your First Workflow
          </Button>
        </Box>
      )}

      {/* Workflow Builder Dialog */}
      <Dialog
        open={isBuilderOpen}
        onClose={handleBuilderClose}
        maxWidth="xl"
        fullWidth
        PaperProps={{
          sx: { height: '90vh' }
        }}
      >
        <DialogTitle>
          {isNewWorkflow ? 'Create New Workflow' : `Edit: ${selectedWorkflow?.name}`}
        </DialogTitle>
        <DialogContent sx={{ p: 0 }}>
          <WorkflowBuilder
            workflow={selectedWorkflow?.definition}
            onSave={handleSaveWorkflow}
            onCancel={handleBuilderClose}
          />
        </DialogContent>
      </Dialog>

      {/* Success/Error Alerts */}
      <Snackbar
        open={!!alert}
        autoHideDuration={6000}
        onClose={() => setAlert(null)}
      >
        {alert && (
          <Alert
            onClose={() => setAlert(null)}
            severity={alert.severity}
            sx={{ width: '100%' }}
          >
            {alert.message}
          </Alert>
        )}
      </Snackbar>
    </Box>
  );
};

export default Workflows;