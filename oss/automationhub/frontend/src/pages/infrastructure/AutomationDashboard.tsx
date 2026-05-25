/**
 * Infrastructure Automation Dashboard
 * Comprehensive Ansible automation and infrastructure management interface
 */

import React, { useState, useEffect } from 'react';
import {
  Box,
  Container,
  Typography,
  Grid,
  Card,
  CardContent,
  CardActions,
  Button,
  TextField,
  Tabs,
  Tab,
  Divider,
  Alert,
  Snackbar,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TablePagination,
  Chip,
  Avatar,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  LinearProgress,
  Tooltip,
  Badge,
  Menu,
  MenuItem,
  FormControl,
  InputLabel,
  Select,
  Switch,
  FormControlLabel,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
  Stepper,
  Step,
  StepLabel,
  StepContent,
  Backdrop,
  CircularProgress,
} from '@mui/material';
import {
  PlayArrow,
  Pause,
  Stop,
  Refresh,
  Add,
  Edit,
  Delete,
  Visibility,
  CloudUpload,
  Download,
  Settings,
  Schedule,
  Assessment,
  Security,
  Storage,
  NetworkCheck,
  MoreVert,
  ExpandMore,
  CheckCircle,
  Error,
  Warning,
  Info,
  Timer,
  Speed,
  Code,
  Terminal,
  Webhook,
  Timeline,
  FilterList,
  Search,
  Sync,
  Launch,
  History,
  BugReport,
  Shield,
  Monitoring,
  CloudQueue,
} from '@mui/icons-material';

// Mock data - in production, this would come from API
const mockPlaybooks = [
  {
    id: '1',
    name: 'Web Server Setup',
    description: 'Install and configure Nginx web server',
    category: 'web',
    tags: ['nginx', 'web', 'server'],
    execution_count: 25,
    last_executed: '2024-11-17T10:30:00Z',
    average_execution_time: 120,
    is_active: true,
  },
  {
    id: '2',
    name: 'Database Configuration',
    description: 'Setup PostgreSQL with security hardening',
    category: 'database',
    tags: ['postgresql', 'database', 'security'],
    execution_count: 18,
    last_executed: '2024-11-16T14:20:00Z',
    average_execution_time: 180,
    is_active: true,
  },
  {
    id: '3',
    name: 'Security Hardening',
    description: 'Apply security best practices',
    category: 'security',
    tags: ['security', 'hardening', 'ssh'],
    execution_count: 42,
    last_executed: '2024-11-15T09:15:00Z',
    average_execution_time: 90,
    is_active: true,
  },
];

const mockExecutions = [
  {
    id: '1',
    playbook_name: 'Web Server Setup',
    status: 'success',
    return_code: 0,
    execution_time: 125.5,
    started_at: '2024-11-17T10:30:00Z',
    finished_at: '2024-11-17T10:32:25Z',
    stats: {
      ok: 15,
      changed: 8,
      failed: 0,
      skipped: 2,
      unreachable: 0,
    },
    executor: 'admin@upmplus.com',
  },
  {
    id: '2',
    playbook_name: 'Database Configuration',
    status: 'failed',
    return_code: 1,
    execution_time: 45.2,
    started_at: '2024-11-17T09:15:00Z',
    finished_at: '2024-11-17T09:16:00Z',
    stats: {
      ok: 5,
      changed: 2,
      failed: 3,
      skipped: 0,
      unreachable: 0,
    },
    executor: 'ops@upmplus.com',
  },
  {
    id: '3',
    playbook_name: 'Security Hardening',
    status: 'running',
    return_code: null,
    execution_time: null,
    started_at: '2024-11-17T11:00:00Z',
    finished_at: null,
    stats: null,
    executor: 'admin@upmplus.com',
  },
];

const mockInventories = [
  {
    id: '1',
    name: 'Production Servers',
    description: 'Production environment servers',
    inventory_type: 'static',
    host_count: 15,
    group_count: 3,
    last_synced: '2024-11-17T08:00:00Z',
    is_active: true,
  },
  {
    id: '2',
    name: 'AWS Dynamic Inventory',
    description: 'Dynamic AWS EC2 instances',
    inventory_type: 'dynamic',
    host_count: 42,
    group_count: 8,
    last_synced: '2024-11-17T11:30:00Z',
    is_active: true,
  },
];

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

function TabPanel({ children, value, index }: TabPanelProps) {
  return (
    <div hidden={value !== index}>
      {value === index && <Box sx={{ py: 3 }}>{children}</Box>}
    </div>
  );
}

const InfrastructureAutomation: React.FC = () => {
  const [tabValue, setTabValue] = useState(0);
  const [playbooks, setPlaybooks] = useState(mockPlaybooks);
  const [executions, setExecutions] = useState(mockExecutions);
  const [inventories, setInventories] = useState(mockInventories);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterCategory, setFilterCategory] = useState('all');

  // Dialog states
  const [createPlaybookDialog, setCreatePlaybookDialog] = useState(false);
  const [executePlaybookDialog, setExecutePlaybookDialog] = useState(false);
  const [executionDetailsDialog, setExecutionDetailsDialog] = useState(false);
  const [selectedItem, setSelectedItem] = useState<any>(null);

  // Notification state
  const [notification, setNotification] = useState({
    open: false,
    message: '',
    severity: 'success' as 'success' | 'error' | 'warning' | 'info',
  });

  // Menu state
  const [actionMenuAnchor, setActionMenuAnchor] = useState<null | HTMLElement>(null);
  const [actionMenuType, setActionMenuType] = useState<'playbook' | 'execution' | 'inventory' | null>(null);
  const [actionMenuItem, setActionMenuItem] = useState<any>(null);

  useEffect(() => {
    loadData();
  }, []);

  const handleTabChange = (event: React.SyntheticEvent, newValue: number) => {
    setTabValue(newValue);
  };

  const loadData = async () => {
    setLoading(true);
    try {
      // In production, this would be API calls
      await new Promise(resolve => setTimeout(resolve, 500));
    } catch (error) {
      showNotification('Failed to load data', 'error');
    } finally {
      setLoading(false);
    }
  };

  const showNotification = (message: string, severity: 'success' | 'error' | 'warning' | 'info') => {
    setNotification({ open: true, message, severity });
  };

  const handleActionMenuClick = (event: React.MouseEvent<HTMLElement>, type: 'playbook' | 'execution' | 'inventory', item: any) => {
    setActionMenuAnchor(event.currentTarget);
    setActionMenuType(type);
    setActionMenuItem(item);
  };

  const handleActionMenuClose = () => {
    setActionMenuAnchor(null);
    setActionMenuType(null);
    setActionMenuItem(null);
  };

  const handleExecutePlaybook = (playbook: any) => {
    setSelectedItem(playbook);
    setExecutePlaybookDialog(true);
    handleActionMenuClose();
  };

  const handleViewExecution = (execution: any) => {
    setSelectedItem(execution);
    setExecutionDetailsDialog(true);
    handleActionMenuClose();
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'success': return 'success';
      case 'failed': return 'error';
      case 'running': return 'warning';
      case 'pending': return 'info';
      default: return 'default';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'success': return <CheckCircle />;
      case 'failed': return <Error />;
      case 'running': return <Timer />;
      case 'pending': return <Schedule />;
      default: return <Info />;
    }
  };

  const filteredPlaybooks = playbooks.filter(playbook =>
    playbook.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    playbook.description.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'web': return <CloudQueue />;
      case 'database': return <Storage />;
      case 'security': return <Shield />;
      case 'network': return <NetworkCheck />;
      default: return <Settings />;
    }
  };

  return (
    <Container maxWidth="xl">
      <Box sx={{ py: 4 }}>
        {/* Header */}
        <Box sx={{ mb: 4, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Box>
            <Typography variant="h3" gutterBottom fontWeight={600}>
              Infrastructure Automation
            </Typography>
            <Typography variant="body1" color="text.secondary">
              Manage Ansible playbooks, automate infrastructure, and monitor deployments
            </Typography>
          </Box>
          <Box sx={{ display: 'flex', gap: 2 }}>
            <Button
              variant="outlined"
              startIcon={<CloudUpload />}
              onClick={() => showNotification('Upload functionality coming soon!', 'info')}
            >
              Upload Playbook
            </Button>
            <Button
              variant="contained"
              startIcon={<Add />}
              onClick={() => setCreatePlaybookDialog(true)}
            >
              Create Playbook
            </Button>
          </Box>
        </Box>

        {/* Stats Cards */}
        <Grid container spacing={3} sx={{ mb: 4 }}>
          <Grid item xs={12} sm={6} md={3}>
            <Card>
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                  <Avatar sx={{ bgcolor: 'primary.main' }}>
                    <Code />
                  </Avatar>
                  <Box>
                    <Typography variant="h4" fontWeight={600}>
                      {playbooks.length}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Active Playbooks
                    </Typography>
                  </Box>
                </Box>
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={12} sm={6} md={3}>
            <Card>
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                  <Avatar sx={{ bgcolor: 'success.main' }}>
                    <PlayArrow />
                  </Avatar>
                  <Box>
                    <Typography variant="h4" fontWeight={600}>
                      {executions.filter(e => e.status === 'success').length}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Successful Runs
                    </Typography>
                  </Box>
                </Box>
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={12} sm={6} md={3}>
            <Card>
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                  <Avatar sx={{ bgcolor: 'info.main' }}>
                    <NetworkCheck />
                  </Avatar>
                  <Box>
                    <Typography variant="h4" fontWeight={600}>
                      {inventories.reduce((sum, inv) => sum + inv.host_count, 0)}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Managed Hosts
                    </Typography>
                  </Box>
                </Box>
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={12} sm={6} md={3}>
            <Card>
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                  <Avatar sx={{ bgcolor: 'warning.main' }}>
                    <Speed />
                  </Avatar>
                  <Box>
                    <Typography variant="h4" fontWeight={600}>
                      {Math.round(executions.reduce((sum, e) => sum + (e.execution_time || 0), 0) / executions.length || 0)}s
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Avg Execution Time
                    </Typography>
                  </Box>
                </Box>
              </CardContent>
            </Card>
          </Grid>
        </Grid>

        {/* Search and Filters */}
        <Paper sx={{ p: 2, mb: 3 }}>
          <Grid container spacing={2} alignItems="center">
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                placeholder="Search playbooks..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                InputProps={{
                  startAdornment: <Search sx={{ mr: 1, color: 'text.secondary' }} />,
                }}
              />
            </Grid>
            <Grid item xs={12} md={3}>
              <FormControl fullWidth>
                <InputLabel>Category</InputLabel>
                <Select
                  value={filterCategory}
                  onChange={(e) => setFilterCategory(e.target.value)}
                  label="Category"
                >
                  <MenuItem value="all">All Categories</MenuItem>
                  <MenuItem value="web">Web</MenuItem>
                  <MenuItem value="database">Database</MenuItem>
                  <MenuItem value="security">Security</MenuItem>
                  <MenuItem value="network">Network</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} md={3}>
              <Box sx={{ display: 'flex', gap: 1 }}>
                <Button
                  variant="outlined"
                  startIcon={<Refresh />}
                  onClick={loadData}
                  disabled={loading}
                >
                  Refresh
                </Button>
                <Button
                  variant="outlined"
                  startIcon={<FilterList />}
                >
                  Filters
                </Button>
              </Box>
            </Grid>
          </Grid>
        </Paper>

        {/* Tabs */}
        <Paper sx={{ mb: 3 }}>
          <Tabs
            value={tabValue}
            onChange={handleTabChange}
            variant="scrollable"
            scrollButtons="auto"
          >
            <Tab icon={<Code />} label="Playbooks" />
            <Tab icon={<History />} label="Executions" />
            <Tab icon={<NetworkCheck />} label="Inventories" />
            <Tab icon={<Schedule />} label="Scheduled" />
            <Tab icon={<Monitoring />} label="Monitoring" />
            <Tab icon={<Webhook />} label="Webhooks" />
          </Tabs>
        </Paper>

        {/* Loading indicator */}
        {loading && <LinearProgress sx={{ mb: 2 }} />}

        {/* Notification */}
        <Snackbar
          open={notification.open}
          autoHideDuration={6000}
          onClose={() => setNotification(prev => ({ ...prev, open: false }))}
        >
          <Alert
            onClose={() => setNotification(prev => ({ ...prev, open: false }))}
            severity={notification.severity}
            sx={{ width: '100%' }}
          >
            {notification.message}
          </Alert>
        </Snackbar>

        {/* Playbooks Tab */}
        <TabPanel value={tabValue} index={0}>
          <Grid container spacing={3}>
            {filteredPlaybooks.map((playbook) => (
              <Grid item xs={12} md={6} lg={4} key={playbook.id}>
                <Card>
                  <CardContent>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
                      <Avatar sx={{ bgcolor: 'primary.main' }}>
                        {getCategoryIcon(playbook.category)}
                      </Avatar>
                      <Box sx={{ flex: 1 }}>
                        <Typography variant="h6" gutterBottom>
                          {playbook.name}
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          {playbook.description}
                        </Typography>
                      </Box>
                    </Box>

                    <Box sx={{ mb: 2 }}>
                      <Chip
                        size="small"
                        label={playbook.category}
                        sx={{ mr: 1 }}
                      />
                      {playbook.tags.map((tag) => (
                        <Chip
                          key={tag}
                          size="small"
                          label={tag}
                          variant="outlined"
                          sx={{ mr: 1 }}
                        />
                      ))}
                    </Box>

                    <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                      <Typography variant="body2" color="text.secondary">
                        Executions: {playbook.execution_count}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        Avg Time: {playbook.average_execution_time}s
                      </Typography>
                    </Box>

                    <Typography variant="body2" color="text.secondary">
                      Last run: {playbook.last_executed ? new Date(playbook.last_executed).toLocaleDateString() : 'Never'}
                    </Typography>
                  </CardContent>
                  <CardActions>
                    <Button
                      size="small"
                      startIcon={<PlayArrow />}
                      onClick={() => handleExecutePlaybook(playbook)}
                    >
                      Execute
                    </Button>
                    <Button
                      size="small"
                      startIcon={<Visibility />}
                      onClick={() => showNotification('Playbook viewer coming soon!', 'info')}
                    >
                      View
                    </Button>
                    <IconButton
                      size="small"
                      onClick={(e) => handleActionMenuClick(e, 'playbook', playbook)}
                    >
                      <MoreVert />
                    </IconButton>
                  </CardActions>
                </Card>
              </Grid>
            ))}
          </Grid>
        </TabPanel>

        {/* Executions Tab */}
        <TabPanel value={tabValue} index={1}>
          <TableContainer component={Paper}>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Playbook</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell>Executor</TableCell>
                  <TableCell>Duration</TableCell>
                  <TableCell>Stats</TableCell>
                  <TableCell>Started</TableCell>
                  <TableCell>Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {executions.map((execution) => (
                  <TableRow key={execution.id} hover>
                    <TableCell>
                      <Typography variant="body2" fontWeight={600}>
                        {execution.playbook_name}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Chip
                        size="small"
                        label={execution.status}
                        color={getStatusColor(execution.status) as any}
                        icon={getStatusIcon(execution.status)}
                      />
                    </TableCell>
                    <TableCell>{execution.executor}</TableCell>
                    <TableCell>
                      {execution.execution_time ? `${execution.execution_time}s` : '-'}
                    </TableCell>
                    <TableCell>
                      {execution.stats ? (
                        <Box sx={{ display: 'flex', gap: 1 }}>
                          <Chip size="small" label={`OK: ${execution.stats.ok}`} color="success" />
                          <Chip size="small" label={`Changed: ${execution.stats.changed}`} color="warning" />
                          {execution.stats.failed > 0 && (
                            <Chip size="small" label={`Failed: ${execution.stats.failed}`} color="error" />
                          )}
                        </Box>
                      ) : '-'}
                    </TableCell>
                    <TableCell>
                      {new Date(execution.started_at).toLocaleString()}
                    </TableCell>
                    <TableCell>
                      <IconButton
                        size="small"
                        onClick={() => handleViewExecution(execution)}
                      >
                        <Visibility />
                      </IconButton>
                      <IconButton
                        size="small"
                        onClick={(e) => handleActionMenuClick(e, 'execution', execution)}
                      >
                        <MoreVert />
                      </IconButton>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </TabPanel>

        {/* Inventories Tab */}
        <TabPanel value={tabValue} index={2}>
          <Grid container spacing={3}>
            {inventories.map((inventory) => (
              <Grid item xs={12} md={6} lg={4} key={inventory.id}>
                <Card>
                  <CardContent>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
                      <Avatar sx={{ bgcolor: 'info.main' }}>
                        <NetworkCheck />
                      </Avatar>
                      <Box sx={{ flex: 1 }}>
                        <Typography variant="h6" gutterBottom>
                          {inventory.name}
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          {inventory.description}
                        </Typography>
                      </Box>
                    </Box>

                    <Box sx={{ mb: 2 }}>
                      <Chip
                        size="small"
                        label={inventory.inventory_type}
                        color="primary"
                        sx={{ mr: 1 }}
                      />
                      {inventory.is_active && (
                        <Chip
                          size="small"
                          label="Active"
                          color="success"
                        />
                      )}
                    </Box>

                    <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                      <Typography variant="body2" color="text.secondary">
                        Hosts: {inventory.host_count}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        Groups: {inventory.group_count}
                      </Typography>
                    </Box>

                    <Typography variant="body2" color="text.secondary">
                      Last synced: {new Date(inventory.last_synced).toLocaleString()}
                    </Typography>
                  </CardContent>
                  <CardActions>
                    <Button
                      size="small"
                      startIcon={<Sync />}
                      onClick={() => showNotification('Sync functionality coming soon!', 'info')}
                    >
                      Sync
                    </Button>
                    <Button
                      size="small"
                      startIcon={<Visibility />}
                      onClick={() => showNotification('Inventory viewer coming soon!', 'info')}
                    >
                      View
                    </Button>
                    <IconButton
                      size="small"
                      onClick={(e) => handleActionMenuClick(e, 'inventory', inventory)}
                    >
                      <MoreVert />
                    </IconButton>
                  </CardActions>
                </Card>
              </Grid>
            ))}
          </Grid>
        </TabPanel>

        {/* Scheduled Tab */}
        <TabPanel value={tabValue} index={3}>
          <Box sx={{ textAlign: 'center', py: 8 }}>
            <Schedule sx={{ fontSize: 64, color: 'text.secondary', mb: 2 }} />
            <Typography variant="h6" color="text.secondary" gutterBottom>
              Scheduled Executions
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Set up recurring playbook executions
            </Typography>
            <Button
              variant="contained"
              sx={{ mt: 2 }}
              onClick={() => showNotification('Scheduled executions coming soon!', 'info')}
            >
              Create Schedule
            </Button>
          </Box>
        </TabPanel>

        {/* Monitoring Tab */}
        <TabPanel value={tabValue} index={4}>
          <Box sx={{ textAlign: 'center', py: 8 }}>
            <Monitoring sx={{ fontSize: 64, color: 'text.secondary', mb: 2 }} />
            <Typography variant="h6" color="text.secondary" gutterBottom>
              Infrastructure Monitoring
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Real-time monitoring and alerting
            </Typography>
            <Button
              variant="contained"
              sx={{ mt: 2 }}
              onClick={() => showNotification('Monitoring dashboard coming soon!', 'info')}
            >
              Open Dashboard
            </Button>
          </Box>
        </TabPanel>

        {/* Webhooks Tab */}
        <TabPanel value={tabValue} index={5}>
          <Box sx={{ textAlign: 'center', py: 8 }}>
            <Webhook sx={{ fontSize: 64, color: 'text.secondary', mb: 2 }} />
            <Typography variant="h6" color="text.secondary" gutterBottom>
              Webhook Integrations
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Configure webhooks for automation events
            </Typography>
            <Button
              variant="contained"
              sx={{ mt: 2 }}
              onClick={() => showNotification('Webhook configuration coming soon!', 'info')}
            >
              Configure Webhooks
            </Button>
          </Box>
        </TabPanel>

        {/* Action Menu */}
        <Menu
          anchorEl={actionMenuAnchor}
          open={Boolean(actionMenuAnchor)}
          onClose={handleActionMenuClose}
        >
          {actionMenuType === 'playbook' && actionMenuItem && (
            <>
              <MenuItem onClick={() => handleExecutePlaybook(actionMenuItem)}>
                <PlayArrow sx={{ mr: 1 }} /> Execute
              </MenuItem>
              <MenuItem onClick={() => showNotification('Edit functionality coming soon!', 'info')}>
                <Edit sx={{ mr: 1 }} /> Edit
              </MenuItem>
              <MenuItem onClick={() => showNotification('Duplicate functionality coming soon!', 'info')}>
                <ContentCopy sx={{ mr: 1 }} /> Duplicate
              </MenuItem>
              <MenuItem onClick={() => showNotification('Export functionality coming soon!', 'info')}>
                <Download sx={{ mr: 1 }} /> Export
              </MenuItem>
              <MenuItem onClick={() => showNotification('Delete functionality coming soon!', 'info')}>
                <Delete sx={{ mr: 1 }} /> Delete
              </MenuItem>
            </>
          )}
          {actionMenuType === 'execution' && actionMenuItem && (
            <>
              <MenuItem onClick={() => handleViewExecution(actionMenuItem)}>
                <Visibility sx={{ mr: 1 }} /> View Details
              </MenuItem>
              <MenuItem onClick={() => showNotification('Log viewer coming soon!', 'info')}>
                <Terminal sx={{ mr: 1 }} /> View Logs
              </MenuItem>
              <MenuItem onClick={() => showNotification('Download logs coming soon!', 'info')}>
                <Download sx={{ mr: 1 }} /> Download Logs
              </MenuItem>
              {actionMenuItem.status === 'running' && (
                <MenuItem onClick={() => showNotification('Cancel execution coming soon!', 'info')}>
                  <Stop sx={{ mr: 1 }} /> Cancel
                </MenuItem>
              )}
              {actionMenuItem.status === 'failed' && (
                <MenuItem onClick={() => showNotification('Rollback functionality coming soon!', 'info')}>
                  <Refresh sx={{ mr: 1 }} > Rollback
                </MenuItem>
              )}
            </>
          )}
          {actionMenuType === 'inventory' && actionMenuItem && (
            <>
              <MenuItem onClick={() => showNotification('Sync inventory coming soon!', 'info')}>
                <Sync sx={{ mr: 1 }} /> Sync Now
              </MenuItem>
              <MenuItem onClick={() => showNotification('Edit inventory coming soon!', 'info')}>
                <Edit sx={{ mr: 1 }} /> Edit
              </MenuItem>
              <MenuItem onClick={() => showNotification('Validate inventory coming soon!', 'info')}>
                <CheckCircle sx={{ mr: 1 }} /> Validate
              </MenuItem>
              <MenuItem onClick={() => showNotification('Export inventory coming soon!', 'info')}>
                <Download sx={{ mr: 1 }} /> Export
              </MenuItem>
              <MenuItem onClick={() => showNotification('Delete inventory coming soon!', 'info')}>
                <Delete sx={{ mr: 1 }} /> Delete
              </MenuItem>
            </>
          )}
        </Menu>

        {/* Execute Playbook Dialog */}
        <Dialog
          open={executePlaybookDialog}
          onClose={() => setExecutePlaybookDialog(false)}
          maxWidth="md"
          fullWidth
        >
          <DialogTitle>Execute Playbook</DialogTitle>
          <DialogContent>
            {selectedItem && (
              <Box sx={{ mt: 2 }}>
                <Typography variant="h6" gutterBottom>
                  {selectedItem.name}
                </Typography>
                <Typography variant="body2" color="text.secondary" gutterBottom>
                  {selectedItem.description}
                </Typography>

                <Accordion sx={{ mt: 2 }}>
                  <AccordionSummary expandIcon={<ExpandMore />}>
                    <Typography>Execution Options</Typography>
                  </AccordionSummary>
                  <AccordionDetails>
                    <Grid container spacing={2}>
                      <Grid item xs={12} md={6}>
                        <FormControl fullWidth sx={{ mb: 2 }}>
                          <InputLabel>Inventory</InputLabel>
                          <Select label="Inventory" defaultValue="">
                            <MenuItem value="">Default Inventory</MenuItem>
                            {inventories.map((inventory) => (
                              <MenuItem key={inventory.id} value={inventory.id}>
                                {inventory.name}
                              </MenuItem>
                            ))}
                          </Select>
                        </FormControl>
                      </Grid>
                      <Grid item xs={12} md={6}>
                        <TextField
                          fullWidth
                          label="Forks"
                          type="number"
                          defaultValue="10"
                          sx={{ mb: 2 }}
                        />
                      </Grid>
                      <Grid item xs={12}>
                        <TextField
                          fullWidth
                          label="Extra Variables (JSON)"
                          multiline
                          rows={3}
                          placeholder='{"key": "value"}'
                          sx={{ mb: 2 }}
                        />
                      </Grid>
                      <Grid item xs={12}>
                        <TextField
                          fullWidth
                          label="Limit to hosts"
                          placeholder="web-servers"
                          sx={{ mb: 2 }}
                        />
                      </Grid>
                    </Grid>
                  </AccordionDetails>
                </Accordion>

                <Accordion>
                  <AccordionSummary expandIcon={<ExpandMore />}>
                    <Typography>Advanced Options</Typography>
                  </AccordionSummary>
                  <AccordionDetails>
                    <Grid container spacing={2}>
                      <Grid item xs={12} md={6}>
                        <FormControl fullWidth sx={{ mb: 2 }}>
                          <InputLabel>Tags</InputLabel>
                          <Select multiple label="Tags" defaultValue={[]}>
                            <MenuItem value="deploy">Deploy</MenuItem>
                            <MenuItem value="update">Update</MenuItem>
                            <MenuItem value="config">Config</MenuItem>
                          </Select>
                        </FormControl>
                      </Grid>
                      <Grid item xs={12} md={6}>
                        <TextField
                          fullWidth
                          label="Timeout (seconds)"
                          type="number"
                          defaultValue="3600"
                          sx={{ mb: 2 }}
                        />
                      </Grid>
                    </Grid>
                  </AccordionDetails>
                </Accordion>
              </Box>
            )}
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setExecutePlaybookDialog(false)}>Cancel</Button>
            <Button
              variant="contained"
              onClick={() => {
                showNotification('Playbook execution started!', 'success');
                setExecutePlaybookDialog(false);
              }}
              startIcon={<PlayArrow />}
            >
              Execute
            </Button>
          </DialogActions>
        </Dialog>

        {/* Execution Details Dialog */}
        <Dialog
          open={executionDetailsDialog}
          onClose={() => setExecutionDetailsDialog(false)}
          maxWidth="lg"
          fullWidth
        >
          <DialogTitle>Execution Details</DialogTitle>
          <DialogContent>
            {selectedItem && (
              <Box sx={{ mt: 2 }}>
                <Grid container spacing={2}>
                  <Grid item xs={12} md={6}>
                    <Typography variant="subtitle2" color="text.secondary">
                      Playbook
                    </Typography>
                    <Typography variant="body1" gutterBottom>
                      {selectedItem.playbook_name}
                    </Typography>
                  </Grid>
                  <Grid item xs={12} md={6}>
                    <Typography variant="subtitle2" color="text.secondary">
                      Status
                    </Typography>
                    <Chip
                      label={selectedItem.status}
                      color={getStatusColor(selectedItem.status) as any}
                      icon={getStatusIcon(selectedItem.status)}
                    />
                  </Grid>
                  <Grid item xs={12} md={6}>
                    <Typography variant="subtitle2" color="text.secondary">
                      Executor
                    </Typography>
                    <Typography variant="body1" gutterBottom>
                      {selectedItem.executor}
                    </Typography>
                  </Grid>
                  <Grid item xs={12} md={6}>
                    <Typography variant="subtitle2" color="text.secondary">
                      Duration
                    </Typography>
                    <Typography variant="body1" gutterBottom>
                      {selectedItem.execution_time ? `${selectedItem.execution_time}s` : '-'}
                    </Typography>
                  </Grid>
                  <Grid item xs={12}>
                    <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                      Execution Statistics
                    </Typography>
                    {selectedItem.stats ? (
                      <Box sx={{ display: 'flex', gap: 1 }}>
                        <Chip label={`OK: ${selectedItem.stats.ok}`} color="success" />
                        <Chip label={`Changed: ${selectedItem.stats.changed}`} color="warning" />
                        <Chip label={`Failed: ${selectedItem.stats.failed}`} color="error" />
                        <Chip label={`Skipped: ${selectedItem.stats.skipped}`} color="default" />
                        <Chip label={`Unreachable: ${selectedItem.stats.unreachable}`} color="secondary" />
                      </Box>
                    ) : (
                      <Typography variant="body2" color="text.secondary">
                        No statistics available
                      </Typography>
                    )}
                  </Grid>
                  <Grid item xs={12}>
                    <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                      Timeline
                    </Typography>
                    <Timeline>
                      <Timeline>
                        <TimelineItem>
                          <TimelineSeparator>
                            <TimelineDot color="primary" />
                            <TimelineConnector />
                          </TimelineSeparator>
                          <TimelineContent>
                            <Typography variant="body2">
                              Started: {new Date(selectedItem.started_at).toLocaleString()}
                            </Typography>
                          </TimelineContent>
                        </TimelineItem>
                        {selectedItem.finished_at && (
                          <TimelineItem>
                            <TimelineSeparator>
                              <TimelineDot
                                color={
                                  selectedItem.status === 'success' ? 'success' :
                                  selectedItem.status === 'failed' ? 'error' : 'primary'
                                }
                              />
                            </TimelineSeparator>
                            <TimelineContent>
                              <Typography variant="body2">
                                Finished: {new Date(selectedItem.finished_at).toLocaleString()}
                              </Typography>
                            </TimelineContent>
                          </TimelineItem>
                        )}
                      </Timeline>
                    </Timeline>
                  </Grid>
                </Grid>
              </Box>
            )}
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setExecutionDetailsDialog(false)}>Close</Button>
            <Button
              variant="outlined"
              startIcon={<Terminal />}
              onClick={() => showNotification('Full log viewer coming soon!', 'info')}
            >
              View Full Logs
            </Button>
          </DialogActions>
        </Dialog>

        {/* Create Playbook Dialog */}
        <Dialog
          open={createPlaybookDialog}
          onClose={() => setCreatePlaybookDialog(false)}
          maxWidth="lg"
          fullWidth
        >
          <DialogTitle>Create Playbook</DialogTitle>
          <DialogContent>
            <Box sx={{ mt: 2 }}>
              <Typography variant="body2" color="text.secondary" gutterBottom>
                Playbook creation wizard coming soon! For now, upload existing playbooks using the Upload button.
              </Typography>
            </Box>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setCreatePlaybookDialog(false)}>Cancel</Button>
          </DialogActions>
        </Dialog>

        {/* Loading Backdrop */}
        <Backdrop
          sx={{ color: '#fff', zIndex: (theme) => theme.zIndex.drawer + 1 }}
          open={loading}
        >
          <CircularProgress color="inherit" />
        </Backdrop>
      </Box>
    </Container>
  );
};

export default InfrastructureAutomation;