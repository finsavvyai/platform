import React, { useState } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  LinearProgress,
  Chip,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Divider,
  Alert,
  Tooltip,
  Badge,
  Grid,
  Paper,
} from '@mui/material';
import {
  PlayArrow,
  Stop,
  Refresh,
  Visibility,
  Error,
  CheckCircle,
  Schedule,
  Timer,
  Code,
  Assessment,
  Close,
  ExpandMore,
  ExpandLess,
} from '@mui/icons-material';
import { useWorkflowExecutions, useStopWorkflowExecution } from '../../services/workflowApi';
import { formatDuration, calculateDuration, getExecutionStatusColor } from '../../services/workflowApi';

interface WorkflowExecutionMonitorProps {
  workflowId?: string;
  limit?: number;
  showDetails?: boolean;
}

interface ExecutionDetailProps {
  execution: any;
  onClose: () => void;
}

const ExecutionDetail: React.FC<ExecutionDetailProps> = ({ execution, onClose }) => {
  const [expanded, setExpanded] = useState(false);

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'running':
        return <Refresh sx={{ animation: 'spin 1s linear infinite' }} />;
      case 'completed':
        return <CheckCircle color="success" />;
      case 'failed':
        return <Error color="error" />;
      case 'pending':
        return <Schedule color="info" />;
      default:
        return <Schedule />;
    }
  };

  const formatJson = (obj: any) => {
    try {
      return JSON.stringify(obj, null, 2);
    } catch {
      return 'Invalid JSON';
    }
  };

  return (
    <Box sx={{ minWidth: 600, maxHeight: 600, overflow: 'auto' }}>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
        <Typography variant="h6">Execution Details</Typography>
        <IconButton onClick={onClose}>
          <Close />
        </IconButton>
      </Box>

      <Grid container spacing={2}>
        <Grid item xs={12} sm={6}>
          <Card variant="outlined">
            <CardContent>
              <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                Status
              </Typography>
              <Box display="flex" alignItems="center" gap={1}>
                {getStatusIcon(execution.status)}
                <Chip
                  label={execution.status}
                  color={getExecutionStatusColor(execution.status) as any}
                  size="small"
                />
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6}>
          <Card variant="outlined">
            <CardContent>
              <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                Duration
              </Typography>
              <Box display="flex" alignItems="center" gap={1}>
                <Timer />
                <Typography variant="body1">
                  {formatDuration(calculateDuration(execution.started_at, execution.completed_at))}
                </Typography>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12}>
          <Card variant="outlined">
            <CardContent>
              <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                Timeline
              </Typography>
              <Box display="flex" flexDirection="column" gap={1}>
                <Box display="flex" justifyContent="space-between">
                  <Typography variant="body2">Started:</Typography>
                  <Typography variant="body2">
                    {new Date(execution.started_at).toLocaleString()}
                  </Typography>
                </Box>
                {execution.completed_at && (
                  <Box display="flex" justifyContent="space-between">
                    <Typography variant="body2">Completed:</Typography>
                    <Typography variant="body2">
                      {new Date(execution.completed_at).toLocaleString()}
                    </Typography>
                  </Box>
                )}
              </Box>
            </CardContent>
          </Card>
        </Grid>

        {execution.error_message && (
          <Grid item xs={12}>
            <Alert severity="error" sx={{ mb: 2 }}>
              <Typography variant="subtitle2">Error:</Typography>
              <Typography variant="body2">{execution.error_message}</Typography>
            </Alert>
          </Grid>
        )}

        {execution.result && (
          <Grid item xs={12}>
            <Card variant="outlined">
              <CardContent>
                <Box 
                  display="flex" 
                  justifyContent="space-between" 
                  alignItems="center" 
                  sx={{ cursor: 'pointer' }}
                  onClick={() => setExpanded(!expanded)}
                >
                  <Typography variant="subtitle2" color="text.secondary">
                    Execution Result
                  </Typography>
                  {expanded ? <ExpandLess /> : <ExpandMore />}
                </Box>
                
                {expanded && (
                  <Box mt={2}>
                    <Paper variant="outlined" sx={{ p: 2, bgcolor: 'grey.50' }}>
                      <Typography 
                        variant="body2" 
                        component="pre" 
                        sx={{ 
                          fontSize: '0.75rem', 
                          overflow: 'auto',
                          maxHeight: 300,
                          whiteSpace: 'pre-wrap'
                        }}
                      >
                        {formatJson(execution.result)}
                      </Typography>
                    </Paper>
                  </Box>
                )}
              </CardContent>
            </Card>
          </Grid>
        )}
      </Grid>
    </Box>
  );
};

const ExecutionListItem: React.FC<{
  execution: any;
  onView: (execution: any) => void;
  onStop: (executionId: string) => void;
}> = ({ execution, onView, onStop }) => {
  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'running':
        return <Refresh sx={{ animation: 'spin 1s linear infinite' }} />;
      case 'completed':
        return <CheckCircle color="success" />;
      case 'failed':
        return <Error color="error" />;
      case 'pending':
        return <Schedule color="info" />;
      default:
        return <Schedule />;
    }
  };

  const duration = calculateDuration(execution.started_at, execution.completed_at);
  const isActive = execution.status === 'running' || execution.status === 'pending';

  return (
    <ListItem sx={{ pl: 0 }}>
      <ListItemIcon>
        {getStatusIcon(execution.status)}
      </ListItemIcon>
      <ListItemText
        primary={
          <Box display="flex" alignItems="center" gap={1}>
            <Typography variant="body1">
              Execution {execution.id.slice(-8)}
            </Typography>
            <Chip
              label={execution.status}
              color={getExecutionStatusColor(execution.status) as any}
              size="small"
            />
            {isActive && (
              <LinearProgress
                variant="indeterminate"
                sx={{ width: 60, height: 6 }}
              />
            )}
          </Box>
        }
        secondary={
          <Box>
            <Typography variant="body2" color="text.secondary">
              Duration: {formatDuration(duration)}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              Started: {new Date(execution.started_at).toLocaleString()}
            </Typography>
          </Box>
        }
      />
      <Box display="flex" gap={1}>
        <Tooltip title="View Details">
          <IconButton size="small" onClick={() => onView(execution)}>
            <Visibility />
          </IconButton>
        </Tooltip>
        {isActive && (
          <Tooltip title="Stop Execution">
            <IconButton 
              size="small" 
              onClick={() => onStop(execution.id)}
              color="error"
            >
              <Stop />
            </IconButton>
          </Tooltip>
        )}
      </Box>
    </ListItem>
  );
};

const WorkflowExecutionMonitor: React.FC<WorkflowExecutionMonitorProps> = ({
  workflowId,
  limit = 10,
  showDetails = true,
}) => {
  const [selectedExecution, setSelectedExecution] = useState<any>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);

  const { data: executions = [], isLoading, error, refetch } = useWorkflowExecutions(workflowId);
  const stopExecutionMutation = useStopWorkflowExecution();

  const handleViewExecution = (execution: any) => {
    setSelectedExecution(execution);
    setIsDetailOpen(true);
  };

  const handleStopExecution = async (executionId: string) => {
    if (window.confirm('Are you sure you want to stop this execution?')) {
      stopExecutionMutation.mutate(executionId);
    }
  };

  const handleCloseDetail = () => {
    setIsDetailOpen(false);
    setSelectedExecution(null);
  };

  const displayExecutions = executions.slice(0, limit);
  const activeExecutions = displayExecutions.filter(e => e.status === 'running' || e.status === 'pending');
  const completedExecutions = displayExecutions.filter(e => e.status === 'completed');
  const failedExecutions = displayExecutions.filter(e => e.status === 'failed');

  if (error) {
    return (
      <Alert severity="error" sx={{ m: 2 }}>
        Failed to load workflow executions. Please try again.
      </Alert>
    );
  }

  return (
    <Box>
      {/* Header */}
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
        <Typography variant="h6">
          Execution Monitor
          {workflowId && ` - Workflow ${workflowId.slice(-8)}`}
        </Typography>
        <IconButton onClick={() => refetch()} size="small">
          <Refresh />
        </IconButton>
      </Box>

      {/* Status Summary */}
      <Grid container spacing={2} sx={{ mb: 2 }}>
        <Grid item xs={6} sm={3}>
          <Card variant="outlined">
            <CardContent sx={{ textAlign: 'center', py: 1 }}>
              <Badge badgeContent={activeExecutions.length} color="warning">
                <Refresh color="action" />
              </Badge>
              <Typography variant="caption" display="block">
                Active
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={6} sm={3}>
          <Card variant="outlined">
            <CardContent sx={{ textAlign: 'center', py: 1 }}>
              <Badge badgeContent={completedExecutions.length} color="success">
                <CheckCircle color="action" />
              </Badge>
              <Typography variant="caption" display="block">
                Completed
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={6} sm={3}>
          <Card variant="outlined">
            <CardContent sx={{ textAlign: 'center', py: 1 }}>
              <Badge badgeContent={failedExecutions.length} color="error">
                <Error color="action" />
              </Badge>
              <Typography variant="caption" display="block">
                Failed
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={6} sm={3}>
          <Card variant="outlined">
            <CardContent sx={{ textAlign: 'center', py: 1 }}>
              <Badge badgeContent={displayExecutions.length} color="primary">
                <Assessment color="action" />
              </Badge>
              <Typography variant="caption" display="block">
                Total
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Execution List */}
      <Card variant="outlined">
        <CardContent sx={{ p: 0 }}>
          {isLoading ? (
            <Box p={2}>
              <LinearProgress />
              <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                Loading executions...
              </Typography>
            </Box>
          ) : displayExecutions.length === 0 ? (
            <Box p={3} textAlign="center">
              <Typography variant="body2" color="text.secondary">
                No executions found
              </Typography>
            </Box>
          ) : (
            <List>
              {displayExecutions.map((execution, index) => (
                <React.Fragment key={execution.id}>
                  <ExecutionListItem
                    execution={execution}
                    onView={handleViewExecution}
                    onStop={handleStopExecution}
                  />
                  {index < displayExecutions.length - 1 && <Divider />}
                </React.Fragment>
              ))}
            </List>
          )}
        </CardContent>
      </Card>

      {/* Execution Detail Dialog */}
      <Dialog open={isDetailOpen} onClose={handleCloseDetail} maxWidth="md" fullWidth>
        <DialogContent sx={{ p: 3 }}>
          {selectedExecution && (
            <ExecutionDetail
              execution={selectedExecution}
              onClose={handleCloseDetail}
            />
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseDetail}>Close</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default WorkflowExecutionMonitor;
