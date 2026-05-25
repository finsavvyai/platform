import React, { useState, useEffect } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Grid,
  Tabs,
  Tab,
  Button,
  Alert,
  Chip,
  LinearProgress,
  IconButton,
  Tooltip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Divider,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
  Badge,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Avatar,
  Stack,
  Fab,
  Menu,
  Switch,
  FormControlLabel,
} from '@mui/material';
import {
  Cloud as CloudIcon,
  Add as AddIcon,
  Visibility as VisibilityIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Refresh as RefreshIcon,
  PowerSettingsNew as PowerIcon,
  Security as SecurityIcon,
  Assessment as AnalyticsIcon,
  AccountBalanceWallet as CostIcon,
  Speed as PerformanceIcon,
  CheckCircle as CheckIcon,
  Error as ErrorIcon,
  Warning as WarningIcon,
  MoreVert as MoreIcon,
  TrendingUp as TrendingUpIcon,
  TrendingDown as TrendingDownIcon,
  Launch as LaunchIcon,
  Code as CodeIcon,
  Storage as StorageIcon,
  Computer as ComputeIcon,
  Router as RouterIcon,
  Database as DatabaseIcon,
  Functions as FunctionsIcon,
  Hub as HubIcon,
  Shield as ShieldIcon,
  Assignment as DeploymentIcon,
  Group as GroupIcon,
  Search as SearchIcon,
  FilterList as FilterIcon,
} from '@mui/icons-material';
import { styled } from '@mui/material/styles';

// Styled components
const DashboardCard = styled(Card)(({ theme }) => ({
  height: '100%',
  display: 'flex',
  flexDirection: 'column',
  transition: 'transform 0.2s ease-in-out',
  '&:hover': {
    transform: 'translateY(-4px)',
  },
}));

const StatusChip = styled(Chip)<{ status: string }>(({ theme, status }) => ({
  fontWeight: 'bold',
  ...(status === 'healthy' && {
    backgroundColor: theme.palette.success.light,
    color: theme.palette.success.dark,
  }),
  ...(status === 'unhealthy' && {
    backgroundColor: theme.palette.error.light,
    color: theme.palette.error.dark,
  }),
  ...(status === 'degraded' && {
    backgroundColor: theme.palette.warning.light,
    color: theme.palette.warning.dark,
  }),
}));

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

function TabPanel(props: TabPanelProps) {
  const { children, value, index, ...other } = props;
  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`multi-cloud-tabpanel-${index}`}
      aria-labelledby={`multi-cloud-tab-${index}`}
      {...other}
    >
      {value === index && <Box sx={{ p: 3 }}>{children}</Box>}
    </div>
  );
}

const MultiCloudDashboard: React.FC = () => {
  const [currentTab, setCurrentTab] = useState(0);
  const [providers, setProviders] = useState<any[]>([]);
  const [resources, setResources] = useState<any[]>([]);
  const [deployments, setDeployments] = useState<any[]>([]);
  const [costData, setCostData] = useState<any>(null);
  const [healthStatus, setHealthStatus] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Dialog states
  const [providerDialogOpen, setProviderDialogOpen] = useState(false);
  const [resourceDialogOpen, setResourceDialogOpen] = useState(false);
  const [deploymentDialogOpen, setDeploymentDialogOpen] = useState(false);

  // Form states
  const [providerForm, setProviderForm] = useState({
    name: '',
    provider_type: 'aws',
    description: '',
    credentials: {},
    region: '',
  });

  // Mock data - would be replaced with API calls
  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    setLoading(true);
    setError(null);
    try {
      // Simulate API calls
      await new Promise(resolve => setTimeout(resolve, 1000));

      setProviders([
        {
          id: '1',
          name: 'AWS Production',
          provider_type: 'aws',
          region: 'us-east-1',
          is_active: true,
          is_connected: true,
          health_status: 'healthy',
          resource_count: 45,
          monthly_cost: 12500.50,
          last_health_check: new Date(),
        },
        {
          id: '2',
          name: 'Azure Development',
          provider_type: 'azure',
          region: 'eastus',
          is_active: true,
          is_connected: true,
          health_status: 'healthy',
          resource_count: 23,
          monthly_cost: 3400.75,
          last_health_check: new Date(),
        },
        {
          id: '3',
          name: 'GCP Analytics',
          provider_type: 'gcp',
          region: 'us-central1',
          is_active: true,
          is_connected: false,
          health_status: 'unhealthy',
          resource_count: 12,
          monthly_cost: 2100.25,
          last_health_check: new Date(Date.now() - 3600000), // 1 hour ago
        },
      ]);

      setResources([
        {
          id: '1',
          name: 'web-server-01',
          type: 'compute',
          provider_id: '1',
          provider_name: 'AWS Production',
          status: 'active',
          health_status: 'healthy',
          cost_monthly: 150.00,
          created_at: new Date(),
        },
        {
          id: '2',
          name: 'production-db',
          type: 'database',
          provider_id: '1',
          provider_name: 'AWS Production',
          status: 'active',
          health_status: 'healthy',
          cost_monthly: 750.00,
          created_at: new Date(),
        },
        {
          id: '3',
          name: 'dev-app-vm',
          type: 'compute',
          provider_id: '2',
          provider_name: 'Azure Development',
          status: 'active',
          health_status: 'healthy',
          cost_monthly: 85.00,
          created_at: new Date(),
        },
      ]);

      setDeployments([
        {
          id: '1',
          name: 'Web Application Stack',
          provider_id: '1',
          provider_name: 'AWS Production',
          status: 'success',
          resource_count: 5,
          progress_percentage: 100,
          created_at: new Date(),
          completed_at: new Date(Date.now() - 86400000), // 1 day ago
        },
        {
          id: '2',
          name: 'Analytics Pipeline',
          provider_id: '3',
          provider_name: 'GCP Analytics',
          status: 'in_progress',
          resource_count: 8,
          progress_percentage: 65,
          created_at: new Date(),
        },
      ]);

      setCostData({
        total_cost: 18001.50,
        costs_by_provider: {
          aws: 12500.50,
          azure: 3400.75,
          gcp: 2100.25,
        },
        costs_by_type: {
          compute: 8500.00,
          storage: 3200.00,
          database: 4500.00,
          network: 1801.50,
        },
        monthly_trend: [
          { month: 'Jan', cost: 15000 },
          { month: 'Feb', cost: 16500 },
          { month: 'Mar', cost: 17200 },
          { month: 'Apr', cost: 18001.50 },
        ],
      });

      setHealthStatus({
        overall_status: 'healthy',
        total_providers: 3,
        healthy_providers: 2,
        unhealthy_providers: 1,
        timestamp: new Date(),
      });

    } catch (err) {
      setError('Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  };

  const handleTabChange = (event: React.SyntheticEvent, newValue: number) => {
    setCurrentTab(newValue);
  };

  const handleRefresh = () => {
    loadDashboardData();
  };

  const handleAddProvider = () => {
    setProviderDialogOpen(true);
  };

  const handleProviderDialogClose = () => {
    setProviderDialogOpen(false);
    setProviderForm({
      name: '',
      provider_type: 'aws',
      description: '',
      credentials: {},
      region: '',
    });
  };

  const getResourceIcon = (type: string) => {
    switch (type) {
      case 'compute': return <ComputeIcon />;
      case 'storage': return <StorageIcon />;
      case 'network': return <RouterIcon />;
      case 'database': return <DatabaseIcon />;
      case 'serverless': return <FunctionsIcon />;
      case 'dns': return <HubIcon />;
      case 'cdn': return <CloudIcon />;
      case 'security': return <ShieldIcon />;
      default: return <CloudIcon />;
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'healthy':
      case 'success':
      case 'active': return <CheckIcon color="success" />;
      case 'unhealthy':
      case 'failed': return <ErrorIcon color="error" />;
      case 'degraded':
      case 'warning': return <WarningIcon color="warning" />;
      default: return <WarningIcon color="disabled" />;
    }
  };

  const getProviderIcon = (type: string) => {
    switch (type) {
      case 'aws': return '/icons/aws-logo.png';
      case 'azure': return '/icons/azure-logo.png';
      case 'gcp': return '/icons/gcp-logo.png';
      case 'cloudflare': return '/icons/cloudflare-logo.png';
      default: return '/icons/cloud-default.png';
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount);
  };

  if (loading) {
    return (
      <Box sx={{ width: '100%', mt: 4 }}>
        <Typography variant="h4" gutterBottom>
          Multi-Cloud Infrastructure
        </Typography>
        <LinearProgress />
        <Typography variant="body1" sx={{ mt: 2, textAlign: 'center' }}>
          Loading multi-cloud dashboard...
        </Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ width: '100%', mt: 2 }}>
      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4" component="h1">
          Multi-Cloud Infrastructure
        </Typography>
        <Box sx={{ display: 'flex', gap: 2 }}>
          <Button
            variant="outlined"
            startIcon={<RefreshIcon />}
            onClick={handleRefresh}
          >
            Refresh
          </Button>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={handleAddProvider}
          >
            Add Provider
          </Button>
        </Box>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {error}
        </Alert>
      )}

      {/* Overview Cards */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        <Grid item xs={12} md={3}>
          <DashboardCard>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                <Avatar sx={{ bgcolor: 'primary.main', mr: 2 }}>
                  <CloudIcon />
                </Avatar>
                <Box>
                  <Typography variant="h6" component="div">
                    {providers.length}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Total Providers
                  </Typography>
                </Box>
              </Box>
              <Box sx={{ display: 'flex', gap: 1 }}>
                <Chip label="Connected" color="success" size="small" />
                <Chip label={`${providers.filter(p => p.is_connected).length}/${providers.length}`} size="small" />
              </Box>
            </CardContent>
          </DashboardCard>
        </Grid>

        <Grid item xs={12} md={3}>
          <DashboardCard>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                <Avatar sx={{ bgcolor: 'info.main', mr: 2 }}>
                  <RouterIcon />
                </Avatar>
                <Box>
                  <Typography variant="h6" component="div">
                    {resources.length}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Active Resources
                  </Typography>
                </Box>
              </Box>
              <Typography variant="body2" color="text.secondary">
                Across {providers.length} providers
              </Typography>
            </CardContent>
          </DashboardCard>
        </Grid>

        <Grid item xs={12} md={3}>
          <DashboardCard>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                <Avatar sx={{ bgcolor: 'warning.main', mr: 2 }}>
                  <CostIcon />
                </Avatar>
                <Box>
                  <Typography variant="h6" component="div">
                    {formatCurrency(costData?.total_cost || 0)}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Monthly Cost
                  </Typography>
                </Box>
              </Box>
              <Box sx={{ display: 'flex', alignItems: 'center' }}>
                <TrendingUpIcon color="success" sx={{ mr: 1, fontSize: 16 }} />
                <Typography variant="body2" color="success.main">
                  +8.2% from last month
                </Typography>
              </Box>
            </CardContent>
          </DashboardCard>
        </Grid>

        <Grid item xs={12} md={3}>
          <DashboardCard>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                <Avatar sx={{ bgcolor: healthStatus?.overall_status === 'healthy' ? 'success.main' : 'error.main', mr: 2 }}>
                  <SecurityIcon />
                </Avatar>
                <Box>
                  <Typography variant="h6" component="div">
                    {healthStatus?.healthy_providers || 0}/{healthStatus?.total_providers || 0}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Healthy Providers
                  </Typography>
                </Box>
              </Box>
              <StatusChip
                label={healthStatus?.overall_status || 'unknown'}
                status={healthStatus?.overall_status || 'unknown'}
                size="small"
              />
            </CardContent>
          </DashboardCard>
        </Grid>
      </Grid>

      {/* Main Content Tabs */}
      <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
        <Tabs value={currentTab} onChange={handleTabChange}>
          <Tab icon={<CloudIcon />} label="Providers" />
          <Tab icon={<RouterIcon />} label="Resources" />
          <Tab icon={<DeploymentIcon />} label="Deployments" />
          <Tab icon={<AnalyticsIcon />} label="Analytics" />
          <Tab icon={<CostIcon />} label="Cost Management" />
          <Tab icon={<SecurityIcon />} label="Security" />
        </Tabs>
      </Box>

      {/* Providers Tab */}
      <TabPanel value={currentTab} index={0}>
        <Grid container spacing={3}>
          {providers.map((provider) => (
            <Grid item xs={12} md={6} lg={4} key={provider.id}>
              <Card>
                <CardContent>
                  <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                    <Avatar src={getProviderIcon(provider.provider_type)} sx={{ mr: 2 }}>
                      <CloudIcon />
                    </Avatar>
                    <Box sx={{ flex: 1 }}>
                      <Typography variant="h6" component="div">
                        {provider.name}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        {provider.provider_type.toUpperCase()} • {provider.region}
                      </Typography>
                    </Box>
                    <IconButton size="small">
                      <MoreIcon />
                    </IconButton>
                  </Box>

                  <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2 }}>
                    <StatusChip
                      label={provider.health_status}
                      status={provider.health_status}
                      size="small"
                    />
                    <Chip
                      label={`${provider.resource_count} resources`}
                      variant="outlined"
                      size="small"
                    />
                  </Box>

                  <Typography variant="h6" color="primary" sx={{ mb: 1 }}>
                    {formatCurrency(provider.monthly_cost)}
                  </Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                    Monthly spend
                  </Typography>

                  <Box sx={{ display: 'flex', gap: 1 }}>
                    <Button size="small" startIcon={<VisibilityIcon />}>
                      View
                    </Button>
                    <Button size="small" startIcon={<EditIcon />} variant="outlined">
                      Edit
                    </Button>
                    <Button
                      size="small"
                      startIcon={<PowerIcon />}
                      color={provider.is_active ? 'error' : 'success'}
                      variant="outlined"
                    >
                      {provider.is_active ? 'Disable' : 'Enable'}
                    </Button>
                  </Box>
                </CardContent>
              </Card>
            </Grid>
          ))}
        </Grid>
      </TabPanel>

      {/* Resources Tab */}
      <TabPanel value={currentTab} index={1}>
        <TableContainer component={Paper}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Resource</TableCell>
                <TableCell>Type</TableCell>
                <TableCell>Provider</TableCell>
                <TableCell>Status</TableCell>
                <TableCell>Health</TableCell>
                <TableCell>Monthly Cost</TableCell>
                <TableCell>Created</TableCell>
                <TableCell>Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {resources.map((resource) => (
                <TableRow key={resource.id}>
                  <TableCell>
                    <Box sx={{ display: 'flex', alignItems: 'center' }}>
                      {getResourceIcon(resource.type)}
                      <Typography sx={{ ml: 1, fontWeight: 'medium' }}>
                        {resource.name}
                      </Typography>
                    </Box>
                  </TableCell>
                  <TableCell>
                    <Chip
                      label={resource.type.toUpperCase()}
                      variant="outlined"
                      size="small"
                    />
                  </TableCell>
                  <TableCell>{resource.provider_name}</TableCell>
                  <TableCell>
                    <Box sx={{ display: 'flex', alignItems: 'center' }}>
                      {getStatusIcon(resource.status)}
                      <Typography sx={{ ml: 1 }}>
                        {resource.status}
                      </Typography>
                    </Box>
                  </TableCell>
                  <TableCell>
                    <StatusChip
                      label={resource.health_status}
                      status={resource.health_status}
                      size="small"
                    />
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2" fontWeight="medium">
                      {formatCurrency(resource.cost_monthly)}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2">
                      {new Date(resource.created_at).toLocaleDateString()}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <IconButton size="small">
                      <VisibilityIcon />
                    </IconButton>
                    <IconButton size="small">
                      <EditIcon />
                    </IconButton>
                    <IconButton size="small">
                      <DeleteIcon />
                    </IconButton>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      </TabPanel>

      {/* Deployments Tab */}
      <TabPanel value={currentTab} index={2}>
        <Grid container spacing={3}>
          {deployments.map((deployment) => (
            <Grid item xs={12} md={6} key={deployment.id}>
              <Card>
                <CardContent>
                  <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                    <Avatar sx={{ bgcolor: 'info.main', mr: 2 }}>
                      <DeploymentIcon />
                    </Avatar>
                    <Box sx={{ flex: 1 }}>
                      <Typography variant="h6" component="div">
                        {deployment.name}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        {deployment.provider_name}
                      </Typography>
                    </Box>
                    <StatusChip
                      label={deployment.status}
                      status={deployment.status === 'success' ? 'healthy' : deployment.status}
                      size="small"
                    />
                  </Box>

                  {deployment.status === 'in_progress' && (
                    <Box sx={{ mb: 2 }}>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                        <Typography variant="body2">
                          Progress: {deployment.progress_percentage}%
                        </Typography>
                      </Box>
                      <LinearProgress
                        variant="determinate"
                        value={deployment.progress_percentage}
                        sx={{ mb: 2 }}
                      />
                    </Box>
                  )}

                  <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                    {deployment.resource_count} resources • Created {new Date(deployment.created_at).toLocaleDateString()}
                  </Typography>

                  <Box sx={{ display: 'flex', gap: 1 }}>
                    <Button size="small" startIcon={<VisibilityIcon />}>
                      View Details
                    </Button>
                    {deployment.status === 'in_progress' && (
                      <Button size="small" color="error" variant="outlined">
                        Cancel
                      </Button>
                    )}
                  </Box>
                </CardContent>
              </Card>
            </Grid>
          ))}
        </Grid>
      </TabPanel>

      {/* Analytics Tab */}
      <TabPanel value={currentTab} index={3}>
        <Grid container spacing={3}>
          <Grid item xs={12} md={8}>
            <Paper sx={{ p: 3 }}>
              <Typography variant="h6" gutterBottom>
                Resource Distribution
              </Typography>
              <Box sx={{ height: 300 }}>
                {/* Placeholder for chart */}
                <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%', border: '2px dashed #ccc', borderRadius: 1 }}>
                  <Typography variant="body2" color="text.secondary">
                    Resource distribution chart would be rendered here
                  </Typography>
                </Box>
              </Box>
            </Paper>
          </Grid>

          <Grid item xs={12} md={4}>
            <Paper sx={{ p: 3 }}>
              <Typography variant="h6" gutterBottom>
                Quick Stats
              </Typography>
              <List>
                <ListItem>
                  <ListItemText primary="Total Resources" secondary={resources.length} />
                </ListItem>
                <ListItem>
                  <ListItemText primary="Active Deployments" secondary={deployments.filter(d => d.status === 'in_progress').length} />
                </ListItem>
                <ListItem>
                  <ListItemText primary="Successful Deployments" secondary={deployments.filter(d => d.status === 'success').length} />
                </ListItem>
                <ListItem>
                  <ListItemText primary="Avg. Response Time" secondary="125ms" />
                </ListItem>
              </List>
            </Paper>
          </Grid>
        </Grid>
      </TabPanel>

      {/* Cost Management Tab */}
      <TabPanel value={currentTab} index={4}>
        <Grid container spacing={3}>
          <Grid item xs={12} md={8}>
            <Paper sx={{ p: 3 }}>
              <Typography variant="h6" gutterBottom>
                Cost Trends
              </Typography>
              <Box sx={{ height: 300 }}>
                {/* Placeholder for cost trend chart */}
                <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%', border: '2px dashed #ccc', borderRadius: 1 }}>
                  <Typography variant="body2" color="text.secondary">
                    Cost trend chart would be rendered here
                  </Typography>
                </Box>
              </Box>
            </Paper>
          </Grid>

          <Grid item xs={12} md={4}>
            <Paper sx={{ p: 3 }}>
              <Typography variant="h6" gutterBottom>
                Cost Breakdown
              </Typography>
              <Box sx={{ mb: 3 }}>
                <Typography variant="body2" color="text.secondary" gutterBottom>
                  By Provider
                </Typography>
                {Object.entries(costData?.costs_by_provider || {}).map(([provider, cost]) => (
                  <Box key={provider} sx={{ mb: 1 }}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                      <Typography variant="body2">
                        {provider.toUpperCase()}
                      </Typography>
                      <Typography variant="body2" fontWeight="medium">
                        {formatCurrency(cost as number)}
                      </Typography>
                    </Box>
                    <LinearProgress
                      variant="determinate"
                      value={(cost as number) / (costData?.total_cost || 1) * 100}
                      sx={{ height: 4 }}
                    />
                  </Box>
                ))}
              </Box>

              <Divider sx={{ my: 2 }} />

              <Box>
                <Typography variant="body2" color="text.secondary" gutterBottom>
                  By Resource Type
                </Typography>
                {Object.entries(costData?.costs_by_type || {}).map(([type, cost]) => (
                  <Box key={type} sx={{ mb: 1 }}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                      <Typography variant="body2">
                        {type.charAt(0).toUpperCase() + type.slice(1)}
                      </Typography>
                      <Typography variant="body2" fontWeight="medium">
                        {formatCurrency(cost as number)}
                      </Typography>
                    </Box>
                  </Box>
                ))}
              </Box>
            </Paper>
          </Grid>
        </Grid>
      </TabPanel>

      {/* Security Tab */}
      <TabPanel value={currentTab} index={5}>
        <Grid container spacing={3}>
          <Grid item xs={12} md={6}>
            <Paper sx={{ p: 3 }}>
              <Typography variant="h6" gutterBottom>
                Security Overview
              </Typography>
              <List>
                <ListItem>
                  <Box sx={{ display: 'flex', alignItems: 'center', width: '100%' }}>
                    <SecurityIcon color="success" sx={{ mr: 2 }} />
                    <ListItemText
                      primary="All providers encrypted"
                      secondary="Data at rest and in transit is encrypted"
                    />
                    <CheckIcon color="success" />
                  </Box>
                </ListItem>
                <ListItem>
                  <Box sx={{ display: 'flex', alignItems: 'center', width: '100%' }}>
                    <ShieldIcon color="warning" sx={{ mr: 2 }} />
                    <ListItemText
                      primary="3 security policies applied"
                      secondary="Automated security compliance checking"
                    />
                    <WarningIcon color="warning" />
                  </Box>
                </ListItem>
                <ListItem>
                  <Box sx={{ display: 'flex', alignItems: 'center', width: '100%' }}>
                    <SecurityIcon color="success" sx={{ mr: 2 }} />
                    <ListItemText
                      primary="Access logging enabled"
                      secondary="All API calls and resource changes are logged"
                    />
                    <CheckIcon color="success" />
                  </Box>
                </ListItem>
              </List>
            </Paper>
          </Grid>

          <Grid item xs={12} md={6}>
            <Paper sx={{ p: 3 }}>
              <Typography variant="h6" gutterBottom>
                Compliance Status
              </Typography>
              <Box sx={{ mb: 3 }}>
                {[
                  { framework: 'SOC 2', status: 'compliant', color: 'success' },
                  { framework: 'GDPR', status: 'compliant', color: 'success' },
                  { framework: 'ISO 27001', status: 'partial', color: 'warning' },
                  { framework: 'HIPAA', status: 'not_applicable', color: 'disabled' },
                ].map((item) => (
                  <Box key={item.framework} sx={{ mb: 2 }}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <Typography variant="body2" fontWeight="medium">
                        {item.framework}
                      </Typography>
                      <Chip
                        label={item.status.replace('_', ' ')}
                        color={item.color as any}
                        size="small"
                      />
                    </Box>
                  </Box>
                ))}
              </Box>
            </Paper>
          </Grid>
        </Grid>
      </TabPanel>

      {/* Add Provider Dialog */}
      <Dialog open={providerDialogOpen} onClose={handleProviderDialogClose} maxWidth="md" fullWidth>
        <DialogTitle>Add Cloud Provider</DialogTitle>
        <DialogContent>
          <Box sx={{ pt: 2 }}>
            <Grid container spacing={2}>
              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  label="Provider Name"
                  value={providerForm.name}
                  onChange={(e) => setProviderForm({ ...providerForm, name: e.target.value })}
                />
              </Grid>
              <Grid item xs={12} md={6}>
                <FormControl fullWidth>
                  <InputLabel>Provider Type</InputLabel>
                  <Select
                    value={providerForm.provider_type}
                    label="Provider Type"
                    onChange={(e) => setProviderForm({ ...providerForm, provider_type: e.target.value })}
                  >
                    <MenuItem value="aws">Amazon Web Services</MenuItem>
                    <MenuItem value="azure">Microsoft Azure</MenuItem>
                    <MenuItem value="gcp">Google Cloud Platform</MenuItem>
                    <MenuItem value="cloudflare">Cloudflare</MenuItem>
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label="Description"
                  multiline
                  rows={3}
                  value={providerForm.description}
                  onChange={(e) => setProviderForm({ ...providerForm, description: e.target.value })}
                />
              </Grid>
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label="Default Region"
                  value={providerForm.region}
                  onChange={(e) => setProviderForm({ ...providerForm, region: e.target.value })}
                />
              </Grid>
            </Grid>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleProviderDialogClose}>Cancel</Button>
          <Button onClick={handleProviderDialogClose} variant="contained">
            Add Provider
          </Button>
        </DialogActions>
      </Dialog>

      {/* Floating Action Button for Quick Actions */}
      <Fab
        color="primary"
        aria-label="quick actions"
        sx={{ position: 'fixed', bottom: 16, right: 16 }}
      >
        <AddIcon />
      </Fab>
    </Box>
  );
};

export default MultiCloudDashboard;