import React, { useState, useRef, useEffect } from 'react';
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
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
  Divider,
  Badge,
  Tooltip,
  LinearProgress,
  Tabs,
  Tab,
  Paper,
  InputAdornment,
  FormControl,
  InputLabel,
  Select,
  Switch,
  FormControlLabel,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Stepper,
  Step,
  StepLabel,
  StepContent,
} from '@mui/material';
import {
  PlayArrow,
  Stop,
  Refresh,
  Add,
  Delete,
  Edit,
  Visibility,
  MoreVert,
  Web,
  Code,
  Screenshot,
  Download,
  Upload,
  Settings,
  ExpandMore,
  CheckCircle,
  Error,
  Schedule,
  BugReport,
  Speed,
  Security,
  CloudUpload,
  DataObject,
  Timeline,
  Psychology,
  AutoFixHigh,
} from '@mui/icons-material';
import { useQuery, useMutation, useQueryClient } from 'react-query';

// Import API services
import {
  browserApi,
  BrowserSession,
  BrowserWorkflow,
  BrowserAction,
  BrowserExecutionResult,
} from '../../services/browserApi';

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

const TabPanel: React.FC<TabPanelProps> = ({ children, value, index }) => {
  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`browser-tabpanel-${index}`}
      aria-labelledby={`browser-tab-${index}`}
    >
      {value === index && <Box sx={{ p: 3 }}>{children}</Box>}
    </div>
  );
};

const WorkflowBuilder: React.FC<{
  workflow?: BrowserWorkflow;
  onSave: (workflow: BrowserWorkflow) => void;
  onCancel: () => void;
}> = ({ workflow, onSave, onCancel }) => {
  const [activeStep, setActiveStep] = useState(0);
  const [workflowName, setWorkflowName] = useState(workflow?.name || '');
  const [workflowDescription, setWorkflowDescription] = useState(workflow?.description || '');
  const [actions, setActions] = useState<BrowserAction[]>(workflow?.actions || []);
  const [sessionConfig, setSessionConfig] = useState(workflow?.session_config || {});

  const addAction = () => {
    const newAction: BrowserAction = {
      id: `action_${Date.now()}`,
      type: 'navigate',
      selector: '',
      value: '',
      url: '',
      timeout: 30000,
      description: '',
      retry_count: 3,
      self_healing: true,
    };
    setActions([...actions, newAction]);
  };

  const updateAction = (index: number, field: string, value: any) => {
    const updatedActions = [...actions];
    updatedActions[index] = { ...updatedActions[index], [field]: value };
    setActions(updatedActions);
  };

  const removeAction = (index: number) => {
    setActions(actions.filter((_, i) => i !== index));
  };

  const handleSave = () => {
    const workflowData: BrowserWorkflow = {
      id: workflow?.id || `workflow_${Date.now()}`,
      name: workflowName,
      description: workflowDescription,
      actions,
      session_config,
      created_at: workflow?.created_at || new Date().toISOString(),
    };
    onSave(workflowData);
  };

  const actionTypes = [
    { value: 'navigate', label: 'Navigate to URL' },
    { value: 'click', label: 'Click Element' },
    { value: 'fill', label: 'Fill Form Field' },
    { value: 'select', label: 'Select Dropdown' },
    { value: 'extract', label: 'Extract Data' },
    { value: 'wait', label: 'Wait for Element' },
    { value: 'screenshot', label: 'Take Screenshot' },
    { value: 'scroll', label: 'Scroll Page' },
    { value: 'hover', label: 'Hover Element' },
    { value: 'double_click', label: 'Double Click' },
  ];

  return (
    <Box>
      <Typography variant="h6" gutterBottom>
        Workflow Builder
      </Typography>

      {/* Basic Information */}
      <Paper sx={{ p: 2, mb: 3 }}>
        <Typography variant="subtitle1" gutterBottom>
          Basic Information
        </Typography>
        <Grid container spacing={2}>
          <Grid item xs={12} md={6}>
            <TextField
              fullWidth
              label="Workflow Name"
              value={workflowName}
              onChange={(e) => setWorkflowName(e.target.value)}
            />
          </Grid>
          <Grid item xs={12} md={6}>
            <TextField
              fullWidth
              label="Description"
              value={workflowDescription}
              onChange={(e) => setWorkflowDescription(e.target.value)}
            />
          </Grid>
        </Grid>
      </Paper>

      {/* Actions */}
      <Paper sx={{ p: 2, mb: 3 }}>
        <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
          <Typography variant="subtitle1">
            Actions ({actions.length})
          </Typography>
          <Button
            variant="outlined"
            startIcon={<Add />}
            onClick={addAction}
          >
            Add Action
          </Button>
        </Box>

        {actions.map((action, index) => (
          <Accordion key={action.id} sx={{ mb: 1 }}>
            <AccordionSummary expandIcon={<ExpandMore />}>
              <Box display="flex" alignItems="center" gap={1} width="100%">
                <Typography variant="body2" sx={{ flexGrow: 1 }}>
                  {index + 1}. {actionTypes.find(t => t.value === action.type)?.label || action.type}
                </Typography>
                {action.description && (
                  <Typography variant="caption" color="text.secondary">
                    {action.description}
                  </Typography>
                )}
                <IconButton
                  size="small"
                  onClick={(e) => {
                    e.stopPropagation();
                    removeAction(index);
                  }}
                >
                  <Delete />
                </IconButton>
              </Box>
            </AccordionSummary>
            <AccordionDetails>
              <Grid container spacing={2}>
                <Grid item xs={12} md={4}>
                  <FormControl fullWidth>
                    <InputLabel>Action Type</InputLabel>
                    <Select
                      value={action.type}
                      label="Action Type"
                      onChange={(e) => updateAction(index, 'type', e.target.value)}
                    >
                      {actionTypes.map((type) => (
                        <MenuItem key={type.value} value={type.value}>
                          {type.label}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </Grid>
                <Grid item xs={12} md={4}>
                  <TextField
                    fullWidth
                    label="Selector (CSS/XPath)"
                    value={action.selector || ''}
                    onChange={(e) => updateAction(index, 'selector', e.target.value)}
                    placeholder="e.g., #button, .class, //div[@id='test']"
                  />
                </Grid>
                <Grid item xs={12} md={4}>
                  <TextField
                    fullWidth
                    label="Value"
                    value={action.value || ''}
                    onChange={(e) => updateAction(index, 'value', e.target.value)}
                    placeholder="Text to type or select value"
                  />
                </Grid>
                {action.type === 'navigate' && (
                  <Grid item xs={12}>
                    <TextField
                      fullWidth
                      label="URL"
                      value={action.url || ''}
                      onChange={(e) => updateAction(index, 'url', e.target.value)}
                      placeholder="https://example.com"
                    />
                  </Grid>
                )}
                <Grid item xs={12} md={6}>
                  <TextField
                    fullWidth
                    type="number"
                    label="Timeout (ms)"
                    value={action.timeout}
                    onChange={(e) => updateAction(index, 'timeout', parseInt(e.target.value))}
                  />
                </Grid>
                <Grid item xs={12} md={6}>
                  <TextField
                    fullWidth
                    label="Description"
                    value={action.description}
                    onChange={(e) => updateAction(index, 'description', e.target.value)}
                  />
                </Grid>
                <Grid item xs={12} md={6}>
                  <TextField
                    fullWidth
                    type="number"
                    label="Retry Count"
                    value={action.retry_count}
                    onChange={(e) => updateAction(index, 'retry_count', parseInt(e.target.value))}
                  />
                </Grid>
                <Grid item xs={12} md={6}>
                  <FormControlLabel
                    control={
                      <Switch
                        checked={action.self_healing}
                        onChange={(e) => updateAction(index, 'self_healing', e.target.checked)}
                      />
                    }
                    label="Enable Self-Healing"
                  />
                </Grid>
              </Grid>
            </AccordionDetails>
          </Accordion>
        ))}

        {actions.length === 0 && (
          <Box textAlign="center" py={4}>
            <Typography variant="body2" color="text.secondary">
              No actions added yet. Click "Add Action" to get started.
            </Typography>
          </Box>
        )}
      </Paper>

      {/* Session Configuration */}
      <Paper sx={{ p: 2, mb: 3 }}>
        <Typography variant="subtitle1" gutterBottom>
          Session Configuration
        </Typography>
        <Grid container spacing={2}>
          <Grid item xs={12} md={4}>
            <FormControl fullWidth>
              <InputLabel>Browser Type</InputLabel>
              <Select
                value={sessionConfig.browser_type || 'chromium'}
                label="Browser Type"
                onChange={(e) => setSessionConfig({ ...sessionConfig, browser_type: e.target.value })}
              >
                <MenuItem value="chromium">Chromium</MenuItem>
                <MenuItem value="firefox">Firefox</MenuItem>
                <MenuItem value="webkit">WebKit (Safari)</MenuItem>
              </Select>
            </FormControl>
          </Grid>
          <Grid item xs={12} md={4}>
            <FormControlLabel
              control={
                <Switch
                  checked={sessionConfig.headless !== false}
                  onChange={(e) => setSessionConfig({ ...sessionConfig, headless: e.target.checked })}
                />
              }
              label="Headless Mode"
            />
          </Grid>
          <Grid item xs={12} md={4}>
            <TextField
              fullWidth
              label="User Agent"
              value={sessionConfig.user_agent || ''}
              onChange={(e) => setSessionConfig({ ...sessionConfig, user_agent: e.target.value })}
            />
          </Grid>
        </Grid>
      </Paper>

      {/* Actions */}
      <Box display="flex" gap={2} justifyContent="flex-end">
        <Button onClick={onCancel}>
          Cancel
        </Button>
        <Button
          variant="contained"
          onClick={handleSave}
          disabled={!workflowName.trim()}
        >
          Save Workflow
        </Button>
      </Box>
    </Box>
  );
};

const WorkflowCard: React.FC<{
  workflow: BrowserWorkflow;
  onEdit: (workflow: BrowserWorkflow) => void;
  onDelete: (workflowId: string) => void;
  onExecute: (workflowId: string) => void;
  onDuplicate: (workflow: BrowserWorkflow) => void;
}> = ({ workflow, onEdit, onDelete, onExecute, onDuplicate }) => {
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);

  const handleMenuClick = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleMenuClose = () => {
    setAnchorEl(null);
  };

  const getStatusIcon = () => {
    switch (workflow.status) {
      case 'completed':
        return <CheckCircle color="success" />;
      case 'running':
        return <Refresh color="warning" />;
      case 'failed':
        return <Error color="error" />;
      default:
        return <Schedule color="info" />;
    }
  };

  return (
    <Card sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <CardContent sx={{ flexGrow: 1 }}>
        <Box display="flex" justifyContent="space-between" alignItems="flex-start" mb={2}>
          <Box display="flex" alignItems="center" gap={1}>
            <Web />
            <Typography variant="h6" component="h2" noWrap>
              {workflow.name}
            </Typography>
          </Box>
          <Box display="flex" alignItems="center" gap={1}>
            {getStatusIcon()}
            <IconButton size="small" onClick={handleMenuClick}>
              <MoreVert />
            </IconButton>
          </Box>
        </Box>

        <Typography variant="body2" color="text.secondary" paragraph>
          {workflow.description}
        </Typography>

        <Box display="flex" gap={1} mb={2} flexWrap="wrap">
          <Chip
            label={`${workflow.actions?.length || 0} actions`}
            size="small"
            icon={<Code />}
          />
          <Chip
            label={workflow.session_config?.browser_type || 'chromium'}
            variant="outlined"
            size="small"
            icon={<Web />}
          />
          {workflow.last_execution && (
            <Chip
              label={`Executed ${new Date(workflow.last_execution).toLocaleDateString()}`}
              variant="outlined"
              size="small"
              icon={<Timeline />}
            />
          )}
        </Box>

        <Typography variant="caption" color="text.secondary">
          Created: {new Date(workflow.created_at).toLocaleDateString()}
        </Typography>
      </CardContent>

      <CardActions>
        <Button
          size="small"
          startIcon={<PlayArrow />}
          onClick={() => onExecute(workflow.id)}
          variant="contained"
        >
          Execute
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
          onClick={() => {/* TODO: View execution history */}}
        >
          History
        </Button>
      </CardActions>

      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={handleMenuClose}
      >
        <MenuItem onClick={() => { onEdit(workflow); handleMenuClose(); }}>
          <Edit sx={{ mr: 1 }} /> Edit
        </MenuItem>
        <MenuItem onClick={() => { onDuplicate(workflow); handleMenuClose(); }}>
          <ContentCopy sx={{ mr: 1 }} /> Duplicate
        </MenuItem>
        <MenuItem onClick={() => { onExecute(workflow.id); handleMenuClose(); }}>
          <PlayArrow sx={{ mr: 1 }} /> Execute
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

const BrowserAutomation: React.FC = () => {
  const [tabValue, setTabValue] = useState(0);
  const [selectedWorkflow, setSelectedWorkflow] = useState<BrowserWorkflow | null>(null);
  const [isBuilderOpen, setIsBuilderOpen] = useState(false);
  const [isNewWorkflow, setIsNewWorkflow] = useState(false);
  const [alert, setAlert] = useState<{ message: string; severity: 'success' | 'error' } | null>(null);

  const queryClient = useQueryClient();

  // Mock data - replace with actual API calls
  const { data: workflows = [], isLoading, error } = useQuery(
    'browser-workflows',
    () => Promise.resolve([
      {
        id: 'workflow_1',
        name: 'E-commerce Product Scraper',
        description: 'Extract product information from e-commerce websites',
        actions: [
          { type: 'navigate', url: 'https://example.com' },
          { type: 'extract', selector: '.product-title' },
        ],
        session_config: { browser_type: 'chromium', headless: true },
        status: 'completed',
        created_at: '2024-01-01T00:00:00Z',
        last_execution: '2024-01-02T10:30:00Z',
      },
      {
        id: 'workflow_2',
        name: 'Form Auto-Filler',
        description: 'Automatically fill and submit web forms',
        actions: [
          { type: 'navigate', url: 'https://forms.example.com' },
          { type: 'fill', selector: '#name', value: 'John Doe' },
        ],
        session_config: { browser_type: 'firefox', headless: false },
        status: 'pending',
        created_at: '2024-01-01T00:00:00Z',
      },
    ] as BrowserWorkflow[]),
    {
      refetchInterval: 30000,
    }
  );

  const handleTabChange = (event: React.SyntheticEvent, newValue: number) => {
    setTabValue(newValue);
  };

  const handleCreateWorkflow = () => {
    setIsNewWorkflow(true);
    setSelectedWorkflow(null);
    setIsBuilderOpen(true);
  };

  const handleEditWorkflow = (workflow: BrowserWorkflow) => {
    setIsNewWorkflow(false);
    setSelectedWorkflow(workflow);
    setIsBuilderOpen(true);
  };

  const handleSaveWorkflow = (workflow: BrowserWorkflow) => {
    // TODO: Implement save workflow API call
    console.log('Saving workflow:', workflow);
    setAlert({ message: 'Workflow saved successfully!', severity: 'success' });
    setIsBuilderOpen(false);
    setSelectedWorkflow(null);
  };

  const handleDeleteWorkflow = (workflowId: string) => {
    if (window.confirm('Are you sure you want to delete this workflow?')) {
      // TODO: Implement delete workflow API call
      console.log('Deleting workflow:', workflowId);
      setAlert({ message: 'Workflow deleted successfully!', severity: 'success' });
    }
  };

  const handleExecuteWorkflow = (workflowId: string) => {
    // TODO: Implement execute workflow API call
    console.log('Executing workflow:', workflowId);
    setAlert({ message: 'Workflow execution started!', severity: 'success' });
  };

  const handleDuplicateWorkflow = (workflow: BrowserWorkflow) => {
    const duplicated = {
      ...workflow,
      id: `workflow_${Date.now()}`,
      name: `${workflow.name} (Copy)`,
      created_at: new Date().toISOString(),
    };
    handleSaveWorkflow(duplicated);
  };

  const stats = {
    total: workflows.length,
    running: workflows.filter(w => w.status === 'running').length,
    completed: workflows.filter(w => w.status === 'completed').length,
    failed: workflows.filter(w => w.status === 'failed').length,
  };

  if (error) {
    return (
      <Alert severity="error" sx={{ m: 2 }}>
        Failed to load browser workflows. Please try again.
      </Alert>
    );
  }

  return (
    <Box>
      {/* Header */}
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Box>
          <Typography variant="h3" component="h1" gutterBottom>
            Browser Automation
          </Typography>
          <Typography variant="body1" color="text.secondary">
            Create and manage AI-powered web automation workflows
          </Typography>
        </Box>
        <Button
          variant="contained"
          startIcon={<Add />}
          onClick={handleCreateWorkflow}
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
                <Badge badgeContent={stats.total} color="primary">
                  <Web color="action" />
                </Badge>
                <Box ml={2}>
                  <Typography variant="h6">Total Workflows</Typography>
                  <Typography variant="body2" color="text.secondary">
                    All automation workflows
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
                <Badge badgeContent={stats.running} color="warning">
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
                <Badge badgeContent={stats.completed} color="success">
                  <CheckCircle color="action" />
                </Badge>
                <Box ml={2}>
                  <Typography variant="h6">Completed</Typography>
                  <Typography variant="body2" color="text.secondary">
                    Successful executions
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
                <Badge badgeContent={stats.failed} color="error">
                  <Error color="action" />
                </Badge>
                <Box ml={2}>
                  <Typography variant="h6">Failed</Typography>
                  <Typography variant="body2" color="text.secondary">
                    Failed executions
                  </Typography>
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Tabs */}
      <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
        <Tabs value={tabValue} onChange={handleTabChange}>
          <Tab label="Workflows" />
          <Tab label="Sessions" />
          <Tab label="Executions" />
          <Tab label="Analytics" />
        </Tabs>
      </Box>

      {/* Workflows Tab */}
      <TabPanel value={tabValue} index={0}>
        <Grid container spacing={3}>
          {workflows.map((workflow) => (
            <Grid item xs={12} sm={6} md={4} key={workflow.id}>
              <WorkflowCard
                workflow={workflow}
                onEdit={handleEditWorkflow}
                onDelete={handleDeleteWorkflow}
                onExecute={handleExecuteWorkflow}
                onDuplicate={handleDuplicateWorkflow}
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
            <Web sx={{ fontSize: 64, color: 'text.secondary', mb: 2 }} />
            <Typography variant="h6" color="text.secondary" gutterBottom>
              No workflows found
            </Typography>
            <Typography variant="body2" color="text.secondary" paragraph>
              Create your first browser automation workflow to get started
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
      </TabPanel>

      {/* Sessions Tab */}
      <TabPanel value={tabValue} index={1}>
        <Typography variant="h6" gutterBottom>
          Browser Sessions
        </Typography>
        <Typography variant="body2" color="text.secondary" paragraph>
          Manage active browser sessions and configurations.
        </Typography>
        <Alert severity="info" sx={{ mb: 3 }}>
          Browser session management will be available once workflows are created.
        </Alert>
      </TabPanel>

      {/* Executions Tab */}
      <TabPanel value={tabValue} index={2}>
        <Typography variant="h6" gutterBottom>
          Execution History
        </Typography>
        <Typography variant="body2" color="text.secondary" paragraph>
          View detailed execution history and results.
        </Typography>
        <Alert severity="info" sx={{ mb: 3 }}>
          Execution history will be available once workflows are executed.
        </Alert>
      </TabPanel>

      {/* Analytics Tab */}
      <TabPanel value={tabValue} index={3}>
        <Typography variant="h6" gutterBottom>
          Performance Analytics
        </Typography>
        <Typography variant="body2" color="text.secondary" paragraph>
          Monitor workflow performance and success rates.
        </Typography>
        <Alert severity="info" sx={{ mb: 3 }}>
          Performance analytics will be available once workflows are executed.
        </Alert>
      </TabPanel>

      {/* Workflow Builder Dialog */}
      <Dialog
        open={isBuilderOpen}
        onClose={() => setIsBuilderOpen(false)}
        maxWidth="lg"
        fullWidth
        PaperProps={{ sx: { height: '80vh' } }}
      >
        <DialogTitle>
          {isNewWorkflow ? 'Create New Workflow' : 'Edit Workflow'}
        </DialogTitle>
        <DialogContent sx={{ pb: 0 }}>
          {isBuilderOpen && (
            <WorkflowBuilder
              workflow={selectedWorkflow || undefined}
              onSave={handleSaveWorkflow}
              onCancel={() => setIsBuilderOpen(false)}
            />
          )}
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

export default BrowserAutomation;
