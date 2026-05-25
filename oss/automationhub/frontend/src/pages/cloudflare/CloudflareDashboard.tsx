/**
 * Cloudflare Management Dashboard
 * Comprehensive Cloudflare integration interface for DNS, CDN, Workers, and infrastructure management
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
  Speed,
  Globe,
  Dns,
  Code,
  Storage,
  Security,
  CloudQueue,
  Timeline,
  FilterList,
  Search,
  Sync,
  Launch,
  History,
  BugReport,
  Shield,
  Monitoring,
  Visibility,
  Edit,
  Delete,
  PlayArrow,
  Add,
  Refresh,
  Upload,
  Download,
  Settings,
  CheckCircle,
  Error,
  Warning,
  Info,
  Timer,
  ExpandMore,
  VerifiedUser,
  ContentCopy,
  DeleteSweep,
  Lock,
  LockOpen,
  Https,
  Public,
  CloudDone,
  CloudOff,
  VirusScan,
} from '@mui/icons-material';

// Mock data - in production, this would come from Cloudflare API
const mockProviders = [
  {
    id: '1',
    name: 'Production Cloudflare',
    provider_type: 'cloudflare',
    account_id: '1234567890abcdef',
    is_active: true,
    is_connected: true,
    last_verified: '2024-11-17T10:30:00Z',
    resource_count: 25,
    capabilities: ['dns_management', 'cdn_management', 'workers', 'r2_storage', 'd1_database', 'tunnels'],
    last_sync: '2024-11-17T11:15:00Z',
  },
];

const mockZones = [
  {
    id: 'zone1',
    name: 'upmplus.dev',
    status: 'active',
    account_name: 'UPM.Plus Production',
    name_servers: ['ns1.cloudflare.com', 'ns2.cloudflare.com'],
    plan: { 'name': 'Enterprise', 'cost': 250 },
    permissions: ['#zone:read', '#zone:edit'],
    paused: false,
    type: 'full',
    development_mode: false,
    created_at: '2024-01-15T10:30:00Z',
  },
  {
    id: 'zone2',
    name: 'app.upmplus.dev',
    status: 'active',
    account_name: 'UPM.Plus Production',
    name_servers: ['ns1.cloudflare.com', 'ns2.cloudflare.com'],
    plan: { 'name': 'Pro', 'cost': 20 },
    permissions: ['#zone:read', '#zone:edit'],
    paused: false,
    type: 'full',
    development_mode: false,
    created_at: '2024-02-20T14:20:00Z',
  },
];

const mockDNSRecords = [
  {
    id: 'dns1',
    zone_id: 'zone1',
    zone_name: 'upmplus.dev',
    name: 'www',
    type: 'A',
    content: '192.168.1.1',
    ttl: 300,
    proxied: true,
    priority: null,
    comment: 'Main website',
    tags: ['web'],
  },
  {
    id: 'dns2',
    zone_id: 'zone1',
    zone_name: 'upmplus.dev',
    name: 'api',
    type: 'A',
    content: '192.168.1.2',
    ttl: 300,
    proxied: true,
    priority: null,
    comment: 'API server',
    tags: ['api'],
  },
  {
    id: 'dns3',
    zone_id: 'zone1',
    zone_name: 'upmplus.dev',
    name: 'mail',
    type: 'MX',
    content: '10 mx.upmplus.dev',
    ttl: 3600,
    proxied: false,
    priority: 10,
    comment: 'Mail server',
    tags: ['email'],
  },
];

const mockWorkers = [
  {
    id: 'worker1',
    script_name: 'api-gateway',
    size: 1024,
    modified_on: '2024-11-17T09:15:00Z',
    usage_model: 'bundled',
    placement: { 'mode': 'smart' },
    compatibility_date: '2023-10-30',
    status: 'active',
  },
  {
    id: 'worker2',
    script_name: 'image-processor',
    size: 2048,
    modified_on: '2024-11-16T14:30:00Z',
    usage_model: 'bundled',
    placement: { 'mode': 'smart' },
    compatibility_date: '2023-10-30',
    status: 'active',
  },
];

const mockR2Buckets = [
  {
    id: 'r2-1',
    name: 'upmplus-assets',
    creation_date: '2024-11-01T00:00:00Z',
    location: 'wnam',
    size: 1024,  # MB
  },
  {
    id: 'r2-2',
    name: 'upmplus-backups',
    creation_date: '2024-11-15T00:00:00Z',
    location: 'eunam',
    size: 5120,
  },
];

const mockTunnels = [
  {
    id: 'tunnel-1',
    name: 'development-tunnel',
    uuid: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
    status: 'active',
    destination: 'localhost:3000',
    proto: 'http',
    created_at: '2024-11-10T12:00:00Z',
  },
];

const mockAnalytics = {
  total_requests: 2500000,
  total_bandwidth: '12.5TB',
  total_unique_visitors: 150000,
  average_response_time: '180ms',
  uptime_percentage: 99.95,
  cache_hit_ratio: 85,
  security_events: 1250,
};

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

const CloudflareDashboard: React.FC = () => {
  const [tabValue, setTabValue] = useState(0);
  const [providers, setProviders] = useState(mockProviders);
  const [zones, setZones] = useState(mockZones);
  const [dnsRecords, setDnsRecords] = useState(mockDNSRecords);
  const [workers, setWorkers] = useState(mockWorkers);
  const [r2Buckets, setR2Buckets] = useState(mockR2Buckets);
  const [tunnels, setTunnels] = useState(mockTunnels);
  const [analytics, setAnalytics] = useState(mockAnalytics);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterProvider, setFilterProvider] = useState('all');

  // Dialog states
  const [createProviderDialog, setCreateProviderDialog] = useState(false);
  const [createZoneDialog, setCreateZoneDialog] = useState(false);
  const [createDNSDialog, setCreateDNSDialog] = useState(false);
  const [deployWorkerDialog, setDeployWorkerDialog] = useState(false);
  const [createTunnelDialog, setCreateTunnelDialog] = useState(false);
  const [purgeCacheDialog, setPurgeCacheDialog] = useState(false);

  // Notification state
  const [notification, setNotification] = useState({
    open: false,
    message: '',
    severity: 'success' as 'success' | 'error' | 'warning' | 'info',
  });

  // Menu state
  const [actionMenuAnchor, setActionMenuAnchor] = useState<null | HTMLElement>(null);
  const [actionMenuType, setActionMenuType] = useState<'zone' | 'dns' | 'worker' | 'bucket' | 'tunnel' | null>(null);
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
      showNotification('Failed to load Cloudflare data', 'error');
    } finally {
      setLoading(false);
    }
  };

  const showNotification = (message: string, severity: 'success' | 'error' | 'warning' | 'info') => {
    setNotification({ open: true, message, severity });
  };

  const handleActionMenuClick = (event: React.MouseEvent<HTMLElement>, type: 'zone' | 'dns' | 'worker' | 'bucket' | 'tunnel', item: any) => {
    setActionMenuAnchor(event.currentTarget);
    setActionMenuType(type);
    setActionMenuItem(item);
  };

  const handleActionMenuClose = () => {
    setActionMenuAnchor(null);
    setActionMenuType(null);
    setActionMenuItem(null);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
      case 'success':
      case 'verified':
        return 'success';
      case 'failed':
      case 'error':
      case 'unhealthy':
        return 'error';
      case 'pending':
      case 'degraded':
        return 'warning';
      default:
        return 'info';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'active':
      case 'success':
      case 'verified':
        return <CheckCircle />;
      case 'failed':
      case 'error':
      case 'unhealthy':
        return <Error />;
      case 'pending':
      case 'degraded':
        return <Timer />;
      default:
        return <Info />;
    }
  };

  const getRecordTypeColor = (type: string) => {
    switch (type) {
      case 'A':
      case 'AAAA':
        return 'primary';
      case 'CNAME':
        return 'secondary';
      case 'TXT':
        return 'info';
      case 'MX':
        return 'warning';
      case 'SRV':
        return 'success';
      default:
        return 'default';
    }
  };

  const filteredZones = zones.filter(zone =>
    zone.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredDNSRecords = dnsRecords.filter(record =>
    record.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    record.content.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <Container maxWidth="xl">
      <Box sx={{ py: 4 }}>
        {/* Header */}
        <Box sx={{ mb: 4, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Box>
            <Typography variant="h3" gutterBottom fontWeight={600}>
              Cloudflare Management
            </Typography>
            <Typography variant="body1" color="text.secondary">
              Manage DNS, CDN, Workers, R2 storage, and Cloudflare infrastructure
            </Typography>
          </Box>
          <Box sx={{ display: 'flex', gap: 2 }}>
            <Button
              variant="outlined"
              startIcon={<Refresh />}
              onClick={loadData}
              disabled={loading}
            >
              Sync
            </Button>
            <Button
              variant="contained"
              startIcon={<Add />}
              onClick={() => setCreateProviderDialog(true)}
            >
              Add Provider
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
                    <CloudQueue />
                  </Avatar>
                  <Box>
                    <Typography variant="h4" fontWeight={600}>
                      {analytics.total_requests.toLocaleString()}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Total Requests
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
                    <Globe />
                  </Avatar>
                  <Box>
                    <Typography variant="h4" fontWeight={600}>
                      {zones.length}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Active Zones
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
                    <Dns />
                  </Avatar>
                  <Box>
                    <Typography variant="h4" fontWeight={600}>
                      {dnsRecords.length}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      DNS Records
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
                    <Storage />
                  </Avatar>
                  <Box>
                    <Typography variant="h4" fontWeight={600}>
                      {r2Buckets.length}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      R2 Buckets
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
                placeholder="Search zones, DNS records, workers..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                InputProps={{
                  startAdornment: <Search sx={{ mr: 1, color: 'text.secondary' }} />,
                }}
              />
            </Grid>
            <Grid item xs={12} md={3}>
              <FormControl fullWidth>
                <InputLabel>Provider</InputLabel>
                <Select
                  value={filterProvider}
                  onChange={(e) => setFilterProvider(e.target.value)}
                  label="Provider"
                >
                  <MenuItem value="all">All Providers</MenuItem>
                  {providers.map((provider) => (
                    <MenuItem key={provider.id} value={provider.id}>
                      {provider.name}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} md={3}>
              <Box sx={{ display: 'flex', gap: 1 }}>
                <Button
                  variant="outlined"
                  startIcon={<FilterList />}
                  onClick={() => showNotification('Advanced filters coming soon!', 'info')}
                >
                  Filters
                </Button>
                <Button
                  variant="outlined"
                  startIcon={<CloudDone />}
                  onClick={() => showNotification('Analytics export coming soon!', 'info')}
                >
                  Export
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
            <Tab icon={<Globe />} label="Zones" />
            <Tab icon={<Dns />} label="DNS Records" />
            <Tab icon={<Code />} label="Workers" />
            <Tab icon={<Storage />} label="R2 Storage" />
            <Tab icon={<CloudDone />} label="Tunnels" />
            <Tab icon={<Monitoring />} label="Analytics" />
            <Tab icon={<Security />} label="Security" />
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

        {/* Zones Tab */}
        <TabPanel value={tabValue} index={0}>
          <Grid container spacing={3}>
            {filteredZones.map((zone) => (
              <Grid item xs={12} md={6} lg={4} key={zone.id}>
                <Card>
                  <CardContent>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
                      <Avatar sx={{ bgcolor: 'primary.main' }}>
                        <Globe />
                      </Avatar>
                      <Box sx={{ flex: 1 }}>
                        <Typography variant="h6" gutterBottom>
                          {zone.name}
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          {zone.account_name}
                        </Typography>
                      </Box>
                    </Box>

                    <Box sx={{ mb: 2 }}>
                      <Chip
                        size="small"
                        label={zone.status}
                        color={getStatusColor(zone.status) as any}
                        icon={getStatusIcon(zone.status)}
                      />
                      <Chip
                        size="small"
                        label={zone.plan.name}
                        variant="outlined"
                      sx={{ ml: 1 }}
                      />
                    </Box>

                    <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                      <Typography variant="body2" color="text.secondary">
                        Name Servers: {zone.name_servers.length}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        Created: {new Date(zone.created_at).toLocaleDateString()}
                      </Typography>
                    </Box>

                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mb: 2 }}>
                      {zone.permissions.map((permission) => (
                        <Chip
                          key={permission}
                          size="small"
                          label={permission}
                          variant="outlined"
                          sx={{ fontSize: '0.7rem' }}
                        />
                      ))}
                    </Box>
                  </CardContent>
                  <CardActions>
                    <Button
                      size="small"
                      startIcon={<Dns />}
                      onClick={() => showNotification('DNS management coming soon!', 'info')}
                    >
                      DNS
                    </Button>
                    <Button
                      size="small"
                      startIcon={<Security />}
                      onClick={() => showNotification('Security settings coming soon!', 'info')}
                    >
                      Security
                    </Button>
                    <Button
                      size="small"
                      startIcon={<Speed />}
                      onClick={() => showNotification('Analytics coming soon!', 'info')}
                    >
                      Analytics
                    </Button>
                    <IconButton
                      size="small"
                      onClick={(e) => handleActionMenuClick(e, 'zone', zone)}
                    >
                      <MoreVert />
                    </IconButton>
                  </CardActions>
                </Card>
              </Grid>
            ))}
          </Grid>
        </TabPanel>

        {/* DNS Records Tab */}
        <TabPanel value={tabValue} index={1}>
          <TableContainer component={Paper}>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Zone</TableCell>
                  <TableCell>Name</TableCell>
                  <TableCell>Type</TableCell>
                  <TableCell>Content</TableCell>
TableCell>
TableCell>Proxy</TableCell>
                  <TableCell>TTL</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell>Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {filteredDNSRecords.map((record) => (
                  <TableRow key={record.id} hover>
                    <TableCell>{record.zone_name}</TableCell>
                    <TableCell>{record.name}</TableCell>
                    <TableCell>
                      <Chip
                        size="small"
                        label={record.type}
                        color={getRecordTypeColor(record.type) as any}
                      />
                    </TableCell>
                    <TableCell>{record.content}</TableCell>
                    <TableCell>
                      {record.proxied ? (
                        <Chip size="small" label="Proxied" color="primary" />
                      ) : (
                        <Chip size="small" label="DNS Only" color="default" />
                      )}
                    </TableCell>
                    <TableCell>{record.ttl}s</TableCell>
                    <TableCell>
                      <Chip
                        size="small"
                        label="Active"
                        color="success"
                      />
                    </TableCell>
                    <TableCell>
                      <IconButton
                        size="small"
                        onClick={() => showNotification('Edit DNS record coming soon!', 'info')}
                      >
                        <Edit />
                      </IconButton>
                      <IconButton
                        size="small"
                        onClick={() => showNotification('Delete DNS record coming soon!', 'info')}
                      >
                        <Delete />
                      </IconButton>
                      <IconButton
                        size="small"
                        onClick={(e) => handleActionMenuClick(e, 'dns', record)}
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

        {/* Workers Tab */}
        <TabPanel value={tabValue} index={2}>
          <Grid container spacing={3}>
            <Grid item xs={12}>
              <Paper sx={{ p: 2, mb: 3 }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Typography variant="h6">Workers</Typography>
                  <Button
                    variant="contained"
                    startIcon={<Add />}
                    onClick={() => setDeployWorkerDialog(true)}
                  >
                    Deploy Worker
                  </Button>
                </Box>
              </Paper>

              {workers.map((worker) => (
                <Grid item xs={12} md={6} key={worker.id}>
                  <Card>
                    <CardContent>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
                      <Avatar sx={{ bgcolor: 'primary.main' }}>
                        <Code />
                      </Avatar>
                      <Box sx={{ flex: 1 }}>
                        <Typography variant="h6" gutterBottom>
                          {worker.script_name}
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          Size: {worker.size} bytes
                        </Typography>
                      </Box>
                    </Box>

                    <Box sx={{ mb: 2 }}>
                      <Chip
                        size="small"
                        label={worker.status}
                        color="success"
                      />
                      <Chip
                        size="small"
                        label={worker.usage_model}
                        variant="outlined"
                        sx={{ ml: 1 }}
                      />
                    </Box>

                    <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                      <Typography variant="body2" color="text.secondary">
                        Compatibility: {worker.compatibility_date}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        Modified: {new Date(worker.modified_on).toLocaleDateString()}
                      </Typography>
                    </Box>
                  </CardContent>
                  <CardActions>
                    <Button
                      size="small"
                      startIcon={<Code />}
                      onClick={() => showNotification('Edit worker coming soon!', 'info')}
                    >
                      Edit
                    </Button>
                    <Button
                      size="small"
                      startIcon={<Visibility />}
                      onClick={() => showNotification('View logs coming soon!', 'info')}
                    >
                      Logs
                    </Button>
                    <IconButton
                      size="small"
                      onClick={() => showNotification('Worker actions coming soon!', 'info')}
                    >
                      <MoreVert />
                    </IconButton>
                  </CardActions>
                </Card>
              </Grid>
            ))}
          </Grid>
        </TabPanel>

        {/* R2 Storage Tab */}
        <TabPanel value={tabValue} index={3}>
          <Grid container spacing={3}>
            <Grid item xs={12}>
              <Paper sx={{ p: 2, mb: 3 }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Typography variant="h6">R2 Object Storage</Typography>
                  <Button
                    variant="contained"
                    startIcon={<Add />}
                    onClick={() => showNotification('Create R2 bucket coming soon!', 'info')}
                  >
                    Create Bucket
                  </Button>
                </Box>
              </Paper>

              {r2Buckets.map((bucket) => (
                <Grid item xs={12} md={6} lg={4} key={bucket.id}>
                  <Card>
                    <CardContent>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
                      <Avatar sx={{ bgcolor: 'info.main' }}>
                        <Storage />
                      </Avatar>
                      <Box sx={{ flex: 1 }}>
                        <Typography variant="h6" gutterBottom>
                          {bucket.name}
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          Location: {bucket.location}
                        </Typography>
                      </Box>
                    </Box>

                    <Box sx={{ mb: 2 }}>
                      <Chip
                        size="small"
                        label="R2 Bucket"
                        color="primary"
                      />
                    </Box>

                    <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                      <Typography variant="body2" color="text.secondary">
                        Created: {new Date(bucket.creation_date).toLocaleDateString()}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        {bucket.size}MB
                      </Typography>
                    </Box>
                  </CardContent>
                  <CardActions>
                    <Button
                      size="small"
                      startIcon={<Upload />}
                      onClick={() => showNotification('Upload files coming soon!', 'info')}
                    >
                      Upload
                    </Button>
                    <Button
                      size="small"
                      startIcon={<Visibility />}
                      onClick={() => showNotification('Browse files coming soon!', 'info')}
                    >
                      Browse
                    </Button>
                    <IconButton
                      size="small"
                      onClick={() => showNotification('Bucket actions coming soon!', 'info')}
                    >
                      <MoreVert />
                    </IconButton>
                  </CardActions>
                </Card>
              </Grid>
            ))}
          </Grid>
        </TabPanel>

        {/* Tunnels Tab */}
        <TabPanel value={tabValue} index={4}>
          <Grid container spacing={3}>
            <Grid item xs={12}>
              <Paper sx={{ p:2, mb: 3 }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Typography variant="h6">Argo Tunnels</Typography>
                  <Button
                    variant="contained"
                    startIcon={<Add />}
                    onClick={() => setCreateTunnelDialog(true)}
                  >
                    Create Tunnel
                  </Button>
                </Box>
              </Paper>

              {tunnels.map((tunnel) => (
                <Grid item xs={12} md={6} lg={4} key={tunnel.id}>
                  <Card>
                    <CardContent>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
                      <Avatar sx={{ bgcolor: 'warning.main' }}>
                        <CloudDone />
                      </Avatar>
                      <Box sx={{ flex: 1 }}>
                        <Typography variant="h6" gutterBottom>
                          {tunnel.name}
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          {tunnel.destination} ({tunnel.proto})
                        </Typography>
                      </Box>
                    </Box>

                    <Box sx={{ mb: 2 }}>
                      <Chip
                        size="small"
                        label={tunnel.status}
                        color="success"
                      />
                    </Box>

                    <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                      <Typography variant="body2" color="text.secondary">
                        UUID: {tunnel.uuid.slice(0, 8)}...
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        Created: {new Date(tunnel.created_at).toLocaleDateString()}
                      </Typography>
                    </Box>
                  </CardContent>
                  <CardActions>
                    <Button
                      size="small"
                      startIcon={<Public />}
                      onClick={() => showNotification('Get tunnel URL coming soon!', 'info')}
                    >
                      URL
                    </Button>
                    <Button
                      size="small"
                      startIcon={<Lock />}
                      onClick={() => showNotification('Tunnel settings coming soon!', 'info')}
                    >
                      Settings
                    </Button>
                    <IconButton
                      size="small"
                      onClick={() => showNotification('Tunnel actions coming soon!', 'info')}
                    >
                      <MoreVert />
                    </IconButton>
                  </CardActions>
                </Card>
              </Grid>
            ))}
          </Grid>
        </TabPanel>

        {/* Analytics Tab */}
        <TabPanel value={tabValue} index={5}>
          <Grid container spacing={3}>
            <Grid item xs={12} md={8}>
              <Paper sx={{ p: 3 }}>
                <Typography variant="h6" gutterBottom>
                  Traffic Overview
                </Typography>
                {/* Analytics charts would go here */}
                <Box sx={{ height: 400, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 2 }}>
                  <Speed sx={{ fontSize: 64, color: 'text.secondary' }} />
                  <Typography variant="body2" color="text.secondary">
                    Analytics dashboard coming soon
                  </Typography>
                </Box>
              </Paper>
            </Grid>

            <Grid item xs={12} md={4}>
              <Paper sx={{ p: 3 }}>
                <Typography variant="h6" gutterBottom>
                  Key Metrics
                </Typography>
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                      <Typography variant="body2">Total Requests</Typography>
                      <Typography variant="h6" fontWeight={600}>
                        {analytics.total_requests.toLocaleString()}
                      </Typography>
                    </Box>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                      <Typography variant="body2">Bandwidth</Typography>
                      <Typography variant="h6" fontWeight={600}>
                        {analytics.total_bandwidth}
                      </Typography>
                    </Box>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                      <Typography variant="body2">Avg Response Time</Typography>
                      <Typography variant="h6" fontWeight={600}>
                        {analytics.average_response_time}
                      </Typography>
                    </Box>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                      <Typography variant="body2">Uptime</Typography>
                      <Typography variant="h6" fontWeight={600}>
                        {analytics.uptime_percentage}%
                      </Typography>
                    </Box>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                      <Typography variant="body2">Cache Hit Ratio</Typography>
                      <Typography variant="h6" fontWeight={600}>
                        {analytics.cache_hit_ratio}%
                      </Typography>
                    </Box>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                      <Typography variant="body2">Security Events</Typography>
                      <Typography variant="h6" fontWeight={600}>
                        {analytics.security_events.toLocaleString()}
                      </Typography>
                    </Box>
                </Box>
              </Paper>
            </Grid>
          </Grid>
        </TabPanel>

        {/* Security Tab */}
        <TabPanel value={tabValue} index={6}>
          <Box sx={{ textAlign: 'center', py: 8 }}>
            <Security sx={{ fontSize: 64, color: 'text.secondary', mb: 2 }} />
            <Typography variant="h6" color="text.secondary" gutterBottom>
              Cloudflare Security
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Web Application Firewall, DDoS protection, and security settings
            </Typography>
            <Button
              variant="contained"
              sx={{ mt: 2 }}
              onClick={() => showNotification('WAF configuration coming soon!', 'info')}
            >
              Configure WAF
            </Button>
          </Box>
        </TabPanel>

        {/* Action Menu */}
        <Menu
          anchorEl={actionMenuAnchor}
          open={Boolean(actionMenuAnchor)}
          onClose={handleActionMenuClose}
        >
          {actionMenuType === 'zone' && actionMenuItem && (
            <>
              <MenuItem onClick={() => showNotification('Zone settings coming soon!', 'info')}>
                <Settings sx={{ mr: 1 }} /> Settings
              </MenuItem>
              <MenuItem onClick={() => showNotification('DNS management coming soon!', 'info')}>
                <Dns sx={{ mr: 1 }} /> DNS
              </MenuItem>
              <MenuItem onClick={() => showNotification('Analytics coming soon!', 'info')}>
                <Assessment sx={{ mr: 1 }} /> Analytics
              </MenuItem>
              <MenuItem onClick={() => showNotification('Security settings coming soon!', 'info')}>
                <Shield sx={{ mr: 1 }} /> Security
              </MenuItem>
              <MenuItem onClick={() => showNotification('Export zone data coming soon!', 'info')}>
                <Download sx={{ mr: 1 }} /> Export
              </MenuItem>
              <MenuItem onClick={() => showNotification('Delete zone coming soon!', 'info')}>
                <Delete sx={{ mr: 1 }} /> Delete
              </MenuItem>
            </>
          )}
          {actionMenuType === 'dns' && actionMenuItem && (
            <>
              <MenuItem onClick={() => showNotification('Edit DNS record coming soon!', 'info')}>
                <Edit sx={{ mr: 1 }} /> Edit
              </MenuItem>
              <MenuItem onClick={() => showNotification('Copy record coming soon!', 'info')}>
                <ContentCopy sx={{ mr: 1 }} /> Copy
              </MenuItem>
              <MenuItem onClick={() => showNotification('Delete DNS record coming soon!', 'info')}>
                <Delete sx={{ mr: 1 }} /> Delete
              </MenuItem>
            </>
          )}
        </Menu>

        {/* Create Provider Dialog */}
        <Dialog
          open={createProviderDialog}
          onClose={() => setCreateProviderDialog(false)}
          maxWidth="md"
          fullWidth
        >
          <DialogTitle>Add Cloudflare Provider</DialogTitle>
          <DialogContent>
            <Box sx={{ mt: 2 }}>
              <Grid container spacing={2}>
                <Grid item xs={12} md={6}>
                  <TextField
                    fullWidth
                    label="Provider Name"
                    value="Production Cloudflare"
                    onChange={(e) => showNotification('Form editing coming soon!', 'info')}
                  />
                </Grid>
                <Grid item xs={12} md={6}>
                  <TextField
                    fullWidth
                    label="Account ID"
                    value="1234567890abcdef"
                    onChange={(e) => showNotification('Form editing coming soon!', 'info')}
                  />
                </Grid>
                <Grid item xs={12}>
                  <TextField
                    fullWidth
                    label="API Token"
                    type="password"
                    value="•••••••••••••••••••••••••••••••••••••••••••••••"
                    onChange={(e) => showNotification('Form editing coming soon!', 'info')}
                  />
                </Grid>
                <Grid item xs={12}>
                  <TextField
                    fullWidth
                    label="Email (optional, for legacy auth)"
                    value="admin@upmplus.com"
                    onChange={(e) => showNotification('Form editing coming soon!', 'info')}
                  />
                </Grid>
                <Grid item xs={12}>
                  <TextField
                    fullWidth
                    label="API Key (optional, for legacy auth)"
                    type="password"
                    value="•••••••••••••••••••••••••••••••••••••••••••"
                    onChange={(e) => showNotification('Form editing coming soon!', 'info')}
                  />
                </Grid>
              </Grid>
            </Box>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setCreateProviderDialog(false)}>Cancel</Button>
            <Button
              variant="contained"
              onClick={() => {
                showNotification('Cloudflare provider created successfully!', 'success');
                setCreateProviderDialog(false);
              }}
            >
              Create
            </Button>
          </DialogActions>
        </Dialog>

        {/* Create Zone Dialog */}
        <Dialog
          open={createZoneDialog}
          onClose={() => setCreateZoneDialog(false)}
          maxWidth="sm"
          fullWidth
        >
          <DialogTitle>Create Zone</DialogTitle>
          <DialogContent>
            <Box sx={{ mt: 2 }}>
              <TextField
                fullWidth
                label="Domain Name"
                placeholder="example.com"
                onChange={(e) => showNotification('Zone creation coming soon!', 'info')}
                sx={{ mb: 2 }}
              />
              <FormControlLabel>
                <FormControlLabel control={<Switch defaultChecked />} label="Use jump start for quick setup" />
              </FormControlLabel>
            </Box>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setCreateZoneDialog(false)}>Cancel</Button>
            <Button
              variant="contained"
              onClick={() => {
                showNotification('Zone created successfully!', 'success');
                setCreateZoneDialog(false);
              }}
            >
              Create Zone
            </Button>
          </DialogActions>
        </Dialog>

        {/* Create DNS Dialog */}
        <Dialog
          open={createDNSDialog}
          onClose={() => setCreateDNSDialog(false)}
          maxWidth="sm"
          fullWidth
        >
          <DialogTitle>Create DNS Record</DialogTitle>
          <DialogContent>
            <Box sx={{ mt: 2 }}>
              <TextField
                fullWidth
                label="Record Name"
                placeholder="www"
                onChange={(e) => showNotification('DNS creation coming soon!', 'info')}
                sx={{ mb: 2 }}
              />
              <FormControl fullWidth sx={{ mb: 2 }}>
                <InputLabel>Type</InputLabel>
                <Select label="DNS Record Type" defaultValue="A">
                  <MenuItem value="A">A Record</MenuItem>
                  <MenuItem value="AAAA">AAAA Record</MenuItem>
                  <MenuItem value="CNAME">CNAME Record</MenuItem>
                  <MenuItem value="TXT">TXT Record</MenuItem>
                  <MenuItem value="MX">MX Record</MenuItem>
                  <MenuItem value="SRV">SRV Record</MenuItem>
                </Select>
              </FormControl>
              <TextField
                fullWidth
                label="Content/Value"
                placeholder="192.168.1.1"
                onChange={(e) => showNotification('DNS creation coming soon!', 'info')}
                sx={{ mb: 2 }}
              />
              <TextField
                fullWidth
                label="TTL"
                type="number"
                defaultValue="300"
                onChange={(e) => showNotification('DNS creation coming soon!', 'info')}
                sx={{ mb: 2 }}
              />
              <FormControlLabel>
                <FormControlLabel control={<Switch defaultChecked />} label="Proxy through Cloudflare" />
              </FormControlLabel>
            </Box>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setCreateDNSDialog(false)}>Cancel</Button>
            <Button
              variant="contained"
              onClick={() => {
                showNotification('DNS record created successfully!', 'success');
                setCreateDNSDialog(false);
              }}
            >
              Create Record
            </Button>
          </DialogActions>
        </Dialog>

        {/* Deploy Worker Dialog */}
        <Dialog
          open={deployWorkerDialog}
          onClose={() => setDeployWorkerDialog(false)}
          maxWidth="lg"
          fullWidth
        >
          <DialogTitle>Deploy Worker</DialogTitle>
          <DialogContent>
            <Box sx={{ mt: 2 }}>
              <TextField
                fullWidth
                label="Script Name"
                placeholder="my-worker"
                onChange={(e) => showNotification('Worker deployment coming soon!', 'info')}
                sx={{ mb: 2 }}
              />
              <TextField
                fullWidth
                multiline
                rows={10}
                label="Worker Script"
                placeholder="// Your worker code here
                onChange={(e) => showNotification('Worker deployment coming soon!', 'info')}
                sx={{ mb: 2 }}
              />
              <FormControlLabel>
                <FormControlLabel control={<Switch />} label="Development mode" />
              </FormControlLabel>
            </Box>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setDeployWorkerDialog(false)}>Cancel</Button>
            <Button
              variant="contained"
              onClick={() => {
                showNotification('Worker deployed successfully!', 'success');
                setDeployWorkerDialog(false);
              }}
              startIcon={<Code />}
            >
              Deploy
            </Button>
          </DialogActions>
        </Dialog>

        {/* Create Tunnel Dialog */}
        <Dialog
          open={createTunnelDialog}
          onClose={() => setCreateTunnelDialog(false)}
          maxWidth="sm"
          fullWidth
        >
          <DialogTitle>Create Tunnel</DialogTitle>
          <DialogContent>
            <Box sx={{ mt: 2 }}>
              <TextField
                fullWidth
                label="Tunnel Name"
                placeholder="development-tunnel"
                onChange={(e) => showNotification('Tunnel creation coming soon!', 'info')}
                sx={{ mb: 2 }}
              />
              <TextField
                fullWidth
                label="Destination"
                placeholder="localhost:3000"
                onChange={(e) => showNotification('Tunnel creation coming soon!', 'info')}
                sx={{ mb: 2 }}
              />
              <FormControl fullWidth sx={{ mb: 2 }}>
                <InputLabel>Protocol</InputLabel>
                <Select label="Protocol" defaultValue="http">
                  <MenuItem value="http">HTTP</MenuItem>
                  <MenuItem value="https">HTTPS</MenuItem>
                  <MenuItem value="tcp">TCP</MenuItem>
                  <MenuItem value="udp">UDP</MenuItem>
                </Select>
              </FormControl>
              <TextField
                fullWidth
                label="Secret (optional)"
                type="password"
                placeholder="Auto-generated"
                onChange={(e) => showNotification('Tunnel creation coming soon!', 'info')}
                sx={{ mb: 2 }}
              />
            </Box>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setCreateTunnelDialog(false)}>Cancel</Button>
            <Button
              variant="contained"
              onClick={() => {
                showNotification('Tunnel created successfully!', 'success');
                setCreateTunnelDialog(false);
              }}
              startIcon={<CloudDone />}
            >
              Create Tunnel
            </Button>
          </DialogActions>
        </Dialog>

        {/* Purge Cache Dialog */}
        <Dialog
          open={purgeCacheDialog}
          onClose={() => setPurgeCacheDialog(false)}
          maxWidth="sm"
          fullWidth
        >
          <DialogTitle>Purge Cache</DialogTitle>
          <DialogContent>
            <Box sx={{ mt: 2 }}>
              <Typography variant="body2" gutterBottom>
                Select what to purge:
              </Typography>
              <FormControlLabel
                control={<Checkbox defaultChecked />}
                label="Purge everything"
              />
              <FormControlLabel
                control={<Checkbox />}
                label="Purge by URL pattern"
              />
              <FormControlLabel
                <Control={<Checkbox />}
                label="Purge by tags"
              />
              <FormControlLabel
                control={<Checkbox />}
                label="Purge by host"
              />
            </Box>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setPurgeCacheDialog(false)}>Cancel</Button>
            <Button
              variant="contained"
              onClick={() => {
                showNotification('Cache purged successfully!', 'success');
                setPurgeCacheDialog(false);
              }}
              startIcon={<Refresh />}
            >
              Purge
            </Button>
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

export default CloudflareDashboard;