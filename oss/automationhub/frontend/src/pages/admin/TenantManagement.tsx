/**
 * Tenant Management Page
 * Comprehensive tenant administration interface for UPM.Plus
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
  Backdrop,
  CircularProgress,
} from '@mui/material';
import {
  Add,
  Edit,
  Delete,
  Visibility,
  Block,
  CheckCircle,
  MoreVert,
  Search,
  FilterList,
  Download,
  Upload,
  Refresh,
  Settings,
  People,
  Assessment,
  AttachMoney,
  Security,
  Warning,
  Info,
  TrendingUp,
  Business,
  Email,
  Phone,
  Person,
  Group,
  Storage,
  Speed,
  Timeline,
} from '@mui/icons-material';

// Mock data - in production, this would come from API
const mockTenants = [
  {
    id: '1',
    name: 'TechCorp Inc.',
    display_name: 'TechCorp Inc.',
    email: 'admin@techcorp.com',
    subdomain: 'techcorp',
    status: 'active',
    tier: 'enterprise',
    plan: 'enterprise',
    industry: 'technology',
    company_size: 'large',
    max_users: 200,
    current_user_count: 127,
    max_workflows: 1000,
    storage_quota_gb: 1000,
    monthly_cost: 499.00,
    billing_email: 'billing@techcorp.com',
    created_at: '2024-01-15T10:30:00Z',
    last_activity: '2024-11-17T14:20:00Z',
  },
  {
    id: '2',
    name: 'Marketing Solutions',
    display_name: 'Marketing Solutions LLC',
    email: 'contact@marketing-solutions.com',
    subdomain: 'marketing-solutions',
    status: 'active',
    tier: 'professional',
    plan: 'professional',
    industry: 'marketing',
    company_size: 'medium',
    max_users: 50,
    current_user_count: 42,
    max_workflows: 250,
    storage_quota_gb: 100,
    monthly_cost: 99.00,
    billing_email: 'billing@marketing-solutions.com',
    created_at: '2024-03-20T09:15:00Z',
    last_activity: '2024-11-17T12:45:00Z',
  },
  {
    id: '3',
    name: 'StartupHub',
    display_name: 'StartupHub',
    email: 'hello@startuphub.io',
    subdomain: 'startuphub',
    status: 'suspended',
    tier: 'starter',
    plan: 'starter',
    industry: 'startup',
    company_size: 'small',
    max_users: 10,
    current_user_count: 8,
    max_workflows: 25,
    storage_quota_gb: 10,
    monthly_cost: 29.00,
    billing_email: 'billing@startuphub.io',
    suspension_reason: 'Billing issues',
    suspended_at: '2024-11-01T00:00:00Z',
    created_at: '2024-06-10T14:20:00Z',
    last_activity: '2024-10-28T16:30:00Z',
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

const TenantManagement: React.FC = () => {
  const [tabValue, setTabValue] = useState(0);
  const [tenants, setTenants] = useState(mockTenants);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterPlan, setFilterPlan] = useState('all');
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(25);

  // Dialog states
  const [createTenantDialog, setCreateTenantDialog] = useState(false);
  const [tenantDetailsDialog, setTenantDetailsDialog] = useState(false);
  const [suspendTenantDialog, setSuspendTenantDialog] = useState(false);
  const [selectedTenant, setSelectedTenant] = useState<any>(null);

  // Notification state
  const [notification, setNotification] = useState({
    open: false,
    message: '',
    severity: 'success' as 'success' | 'error' | 'warning' | 'info',
  });

  // Menu state
  const [actionMenuAnchor, setActionMenuAnchor] = useState<null | HTMLElement>(null);
  const [actionMenuTenant, setActionMenuTenant] = useState<any>(null);

  // Form states
  const [newTenantForm, setNewTenantForm] = useState({
    name: '',
    display_name: '',
    email: '',
    subdomain: '',
    tier: 'starter',
    plan: 'starter',
    industry: '',
    company_size: 'small',
    billing_email: '',
    technical_contact_email: '',
    max_users: 10,
    max_workflows: 25,
    storage_quota_gb: 10,
    auto_renew_enabled: true,
  });

  const [adminUserForm, setAdminUserForm] = useState({
    email: '',
    first_name: '',
    last_name: '',
    password: '',
    username: '',
  });

  useEffect(() => {
    loadTenants();
  }, []);

  const handleTabChange = (event: React.SyntheticEvent, newValue: number) => {
    setTabValue(newValue);
  };

  const loadTenants = async () => {
    setLoading(true);
    try {
      // In production, this would be an API call
      // const response = await fetch('/api/v1/admin/tenants');
      // const data = await response.json();
      // setTenants(data.tenants);

      // Simulate API delay
      await new Promise(resolve => setTimeout(resolve, 500));
    } catch (error) {
      showNotification('Failed to load tenants', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateTenant = async () => {
    setLoading(true);
    try {
      // In production, this would be an API call
      // const response = await fetch('/api/v1/admin/tenants', {
      //   method: 'POST',
      //   headers: { 'Content-Type': 'application/json' },
      //   body: JSON.stringify({
      //     tenant: newTenantForm,
      //     admin_user: adminUserForm,
      //   }),
      // });

      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 1000));

      showNotification('Tenant created successfully!', 'success');
      setCreateTenantDialog(false);
      resetForms();
      loadTenants();
    } catch (error) {
      showNotification('Failed to create tenant', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleSuspendTenant = async (reason: string) => {
    if (!selectedTenant) return;

    setLoading(true);
    try {
      // In production, this would be an API call
      // const response = await fetch(`/api/v1/admin/tenants/${selectedTenant.id}/suspend`, {
      //   method: 'POST',
      //   headers: { 'Content-Type': 'application/json' },
      //   body: JSON.stringify({ reason }),
      // });

      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 500));

      showNotification('Tenant suspended successfully', 'success');
      setSuspendTenantDialog(false);
      loadTenants();
    } catch (error) {
      showNotification('Failed to suspend tenant', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleReactivateTenant = async (tenantId: string) => {
    setLoading(true);
    try {
      // In production, this would be an API call
      // const response = await fetch(`/api/v1/admin/tenants/${tenantId}/reactivate`, {
      //   method: 'POST',
      // });

      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 500));

      showNotification('Tenant reactivated successfully', 'success');
      loadTenants();
    } catch (error) {
      showNotification('Failed to reactivate tenant', 'error');
    } finally {
      setLoading(false);
    }
  };

  const showNotification = (message: string, severity: 'success' | 'error' | 'warning' | 'info') => {
    setNotification({ open: true, message, severity });
  };

  const resetForms = () => {
    setNewTenantForm({
      name: '',
      display_name: '',
      email: '',
      subdomain: '',
      tier: 'starter',
      plan: 'starter',
      industry: '',
      company_size: 'small',
      billing_email: '',
      technical_contact_email: '',
      max_users: 10,
      max_workflows: 25,
      storage_quota_gb: 10,
      auto_renew_enabled: true,
    });
    setAdminUserForm({
      email: '',
      first_name: '',
      last_name: '',
      password: '',
      username: '',
    });
  };

  const filteredTenants = tenants.filter(tenant => {
    const matchesSearch = tenant.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         tenant.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         tenant.subdomain.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = filterStatus === 'all' || tenant.status === filterStatus;
    const matchesPlan = filterPlan === 'all' || tenant.plan === filterPlan;
    return matchesSearch && matchesStatus && matchesPlan;
  });

  const paginatedTenants = filteredTenants.slice(
    page * rowsPerPage,
    page * rowsPerPage + rowsPerPage
  );

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'success';
      case 'suspended': return 'error';
      case 'provisioning': return 'warning';
      default: return 'default';
    }
  };

  const getPlanColor = (plan: string) => {
    switch (plan) {
      case 'enterprise': return 'secondary';
      case 'professional': return 'primary';
      case 'starter': return 'default';
      default: return 'default';
    }
  };

  const handleActionMenuClick = (event: React.MouseEvent<HTMLElement>, tenant: any) => {
    setActionMenuAnchor(event.currentTarget);
    setActionMenuTenant(tenant);
  };

  const handleActionMenuClose = () => {
    setActionMenuAnchor(null);
    setActionMenuTenant(null);
  };

  const handleViewTenant = (tenant: any) => {
    setSelectedTenant(tenant);
    setTenantDetailsDialog(true);
    handleActionMenuClose();
  };

  const handleSuspendDialogOpen = (tenant: any) => {
    setSelectedTenant(tenant);
    setSuspendTenantDialog(true);
    handleActionMenuClose();
  };

  const handleExportTenants = () => {
    // In production, this would generate and download a CSV/Excel file
    showNotification('Export functionality coming soon!', 'info');
  };

  return (
    <Container maxWidth="xl">
      <Box sx={{ py: 4 }}>
        {/* Header */}
        <Box sx={{ mb: 4, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Box>
            <Typography variant="h3" gutterBottom fontWeight={600}>
              Tenant Management
            </Typography>
            <Typography variant="body1" color="text.secondary">
              Manage tenants, users, billing, and monitor platform usage
            </Typography>
          </Box>
          <Box sx={{ display: 'flex', gap: 2 }}>
            <Button
              variant="outlined"
              startIcon={<Download />}
              onClick={handleExportTenants}
            >
              Export
            </Button>
            <Button
              variant="contained"
              startIcon={<Add />}
              onClick={() => setCreateTenantDialog(true)}
            >
              Create Tenant
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
                    <Business />
                  </Avatar>
                  <Box>
                    <Typography variant="h4" fontWeight={600}>
                      {tenants.filter(t => t.status === 'active').length}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Active Tenants
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
                    <AttachMoney />
                  </Avatar>
                  <Box>
                    <Typography variant="h4" fontWeight={600}>
                      ${tenants.reduce((sum, t) => sum + t.monthly_cost, 0).toLocaleString()}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Monthly Revenue
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
                    <People />
                  </Avatar>
                  <Box>
                    <Typography variant="h4" fontWeight={600}>
                      {tenants.reduce((sum, t) => sum + t.current_user_count, 0).toLocaleString()}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Total Users
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
                    <Warning />
                  </Avatar>
                  <Box>
                    <Typography variant="h4" fontWeight={600}>
                      {tenants.filter(t => t.status === 'suspended').length}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Suspended
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
            <Grid item xs={12} md={4}>
              <TextField
                fullWidth
                placeholder="Search tenants..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                InputProps={{
                  startAdornment: <Search sx={{ mr: 1, color: 'text.secondary' }} />,
                }}
              />
            </Grid>
            <Grid item xs={12} sm={4} md={2}>
              <FormControl fullWidth>
                <InputLabel>Status</InputLabel>
                <Select
                  value={filterStatus}
                  onChange={(e) => setFilterStatus(e.target.value)}
                  label="Status"
                >
                  <MenuItem value="all">All</MenuItem>
                  <MenuItem value="active">Active</MenuItem>
                  <MenuItem value="suspended">Suspended</MenuItem>
                  <MenuItem value="provisioning">Provisioning</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} sm={4} md={2}>
              <FormControl fullWidth>
                <InputLabel>Plan</InputLabel>
                <Select
                  value={filterPlan}
                  onChange={(e) => setFilterPlan(e.target.value)}
                  label="Plan"
                >
                  <MenuItem value="all">All</MenuItem>
                  <MenuItem value="starter">Starter</MenuItem>
                  <MenuItem value="professional">Professional</MenuItem>
                  <MenuItem value="enterprise">Enterprise</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} sm={4} md={4}>
              <Box sx={{ display: 'flex', gap: 1 }}>
                <Button
                  variant="outlined"
                  startIcon={<Refresh />}
                  onClick={loadTenants}
                  disabled={loading}
                >
                  Refresh
                </Button>
                <Button
                  variant="outlined"
                  startIcon={<FilterList />}
                >
                  More Filters
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
            <Tab icon={<Business />} label="All Tenants" />
            <Tab icon={<Assessment />} label="Analytics" />
            <Tab icon={<AttachMoney />} label="Billing" />
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

        {/* All Tenants Tab */}
        <TabPanel value={tabValue} index={0}>
          <TableContainer component={Paper}>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Tenant</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell>Plan</TableCell>
                  <TableCell>Users</TableCell>
                  <TableCell>Storage</TableCell>
                  <TableCell>Monthly Cost</TableCell>
                  <TableCell>Last Activity</TableCell>
                  <TableCell>Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {paginatedTenants.map((tenant) => (
                  <TableRow key={tenant.id} hover>
                    <TableCell>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                        <Avatar sx={{ bgcolor: 'primary.main' }}>
                          <Business />
                        </Avatar>
                        <Box>
                          <Typography variant="subtitle2" fontWeight={600}>
                            {tenant.name}
                          </Typography>
                          <Typography variant="body2" color="text.secondary">
                            {tenant.email} • {tenant.subdomain}
                          </Typography>
                        </Box>
                      </Box>
                    </TableCell>
                    <TableCell>
                      <Chip
                        size="small"
                        label={tenant.status}
                        color={getStatusColor(tenant.status) as any}
                        icon={
                          tenant.status === 'active' ? <CheckCircle /> :
                          tenant.status === 'suspended' ? <Block /> : <Warning />
                        }
                      />
                    </TableCell>
                    <TableCell>
                      <Chip
                        size="small"
                        label={tenant.plan}
                        color={getPlanColor(tenant.plan) as any}
                        variant="outlined"
                      />
                    </TableCell>
                    <TableCell>
                      <Box>
                        <Typography variant="body2">
                          {tenant.current_user_count} / {tenant.max_users}
                        </Typography>
                        <LinearProgress
                          variant="determinate"
                          value={(tenant.current_user_count / tenant.max_users) * 100}
                          sx={{ width: 100, height: 4, mt: 0.5 }}
                        />
                      </Box>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2">
                        {tenant.storage_quota_gb} GB
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" fontWeight={600}>
                        ${tenant.monthly_cost.toLocaleString()}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2">
                        {new Date(tenant.last_activity).toLocaleDateString()}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <IconButton
                        onClick={(e) => handleActionMenuClick(e, tenant)}
                        size="small"
                      >
                        <MoreVert />
                      </IconButton>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <TablePagination
              rowsPerPageOptions={[10, 25, 50, 100]}
              component="div"
              count={filteredTenants.length}
              rowsPerPage={rowsPerPage}
              page={page}
              onPageChange={(e, newPage) => setPage(newPage)}
              onRowsPerPageChange={(e) => {
                setRowsPerPage(parseInt(e.target.value, 10));
                setPage(0);
              }}
            />
          </TableContainer>
        </TabPanel>

        {/* Analytics Tab */}
        <TabPanel value={tabValue} index={1}>
          <Grid container spacing={3}>
            <Grid item xs={12} md={8}>
              <Card>
                <CardContent>
                  <Typography variant="h6" gutterBottom>
                    Tenant Growth
                  </Typography>
                  {/* Analytics charts would go here */}
                  <Box sx={{ height: 300, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Typography variant="body2" color="text.secondary">
                      Analytics charts coming soon
                    </Typography>
                  </Box>
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={12} md={4}>
              <Card>
                <CardContent>
                  <Typography variant="h6" gutterBottom>
                    Top Tenants by Usage
                  </Typography>
                  {/* Top tenants list would go here */}
                  <Box sx={{ height: 300, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Typography variant="body2" color="text.secondary">
                      Usage metrics coming soon
                    </Typography>
                  </Box>
                </CardContent>
              </Card>
            </Grid>
          </Grid>
        </TabPanel>

        {/* Billing Tab */}
        <TabPanel value={tabValue} index={2}>
          <Grid container spacing={3}>
            <Grid item xs={12}>
              <Card>
                <CardContent>
                  <Typography variant="h6" gutterBottom>
                    Billing Overview
                  </Typography>
                  {/* Billing charts and tables would go here */}
                  <Box sx={{ height: 400, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Typography variant="body2" color="text.secondary">
                      Billing analytics coming soon
                    </Typography>
                  </Box>
                </CardContent>
              </Card>
            </Grid>
          </Grid>
        </TabPanel>

        {/* Security Tab */}
        <TabPanel value={tabValue} index={3}>
          <Grid container spacing={3}>
            <Grid item xs={12} md={6}>
              <Card>
                <CardContent>
                  <Typography variant="h6" gutterBottom>
                    Security Incidents
                  </Typography>
                  {/* Security incident log would go here */}
                  <Box sx={{ height: 300, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Typography variant="body2" color="text.secondary">
                      Security monitoring coming soon
                    </Typography>
                  </Box>
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={12} md={6}>
              <Card>
                <CardContent>
                  <Typography variant="h6" gutterBottom>
                    Compliance Status
                  </Typography>
                  {/* Compliance status would go here */}
                  <Box sx={{ height: 300, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Typography variant="body2" color="text.secondary">
                      Compliance tracking coming soon
                    </Typography>
                  </Box>
                </CardContent>
              </Card>
            </Grid>
          </Grid>
        </TabPanel>

        {/* Action Menu */}
        <Menu
          anchorEl={actionMenuAnchor}
          open={Boolean(actionMenuAnchor)}
          onClose={handleActionMenuClose}
        >
          <MenuItem onClick={() => handleViewTenant(actionMenuTenant)}>
            <Visibility sx={{ mr: 1 }} /> View Details
          </MenuItem>
          <MenuItem onClick={() => showNotification('Edit functionality coming soon!', 'info')}>
            <Edit sx={{ mr: 1 }} /> Edit Tenant
          </MenuItem>
          <MenuItem onClick={() => showNotification('User management coming soon!', 'info')}>
            <People sx={{ mr: 1 }} /> Manage Users
          </MenuItem>
          <MenuItem onClick={() => showNotification('Billing management coming soon!', 'info')}>
            <AttachMoney sx={{ mr: 1 }} /> Billing
          </MenuItem>
          {actionMenuTenant?.status === 'active' && (
            <MenuItem onClick={() => handleSuspendDialogOpen(actionMenuTenant)}>
              <Block sx={{ mr: 1 }} /> Suspend
            </MenuItem>
          )}
          {actionMenuTenant?.status === 'suspended' && (
            <MenuItem onClick={() => handleReactivateTenant(actionMenuTenant.id)}>
              <CheckCircle sx={{ mr: 1 }} /> Reactivate
            </MenuItem>
          )}
        </Menu>

        {/* Create Tenant Dialog */}
        <Dialog
          open={createTenantDialog}
          onClose={() => setCreateTenantDialog(false)}
          maxWidth="md"
          fullWidth
        >
          <DialogTitle>Create New Tenant</DialogTitle>
          <DialogContent>
            <Grid container spacing={2} sx={{ mt: 1 }}>
              <Grid item xs={12}>
                <Typography variant="h6" gutterBottom>
                  Tenant Information
                </Typography>
              </Grid>
              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  label="Company Name"
                  value={newTenantForm.name}
                  onChange={(e) => setNewTenantForm({ ...newTenantForm, name: e.target.value })}
                />
              </Grid>
              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  label="Display Name"
                  value={newTenantForm.display_name}
                  onChange={(e) => setNewTenantForm({ ...newTenantForm, display_name: e.target.value })}
                />
              </Grid>
              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  label="Email"
                  type="email"
                  value={newTenantForm.email}
                  onChange={(e) => setNewTenantForm({ ...newTenantForm, email: e.target.value })}
                />
              </Grid>
              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  label="Subdomain"
                  value={newTenantForm.subdomain}
                  onChange={(e) => setNewTenantForm({ ...newTenantForm, subdomain: e.target.value })}
                  helperText="This will be part of the URL: subdomain.upmplus.dev"
                />
              </Grid>
              <Grid item xs={12} md={6}>
                <FormControl fullWidth>
                  <InputLabel>Plan</InputLabel>
                  <Select
                    value={newTenantForm.plan}
                    onChange={(e) => setNewTenantForm({ ...newTenantForm, plan: e.target.value })}
                    label="Plan"
                  >
                    <MenuItem value="starter">Starter ($29/mo)</MenuItem>
                    <MenuItem value="professional">Professional ($99/mo)</MenuItem>
                    <MenuItem value="enterprise">Enterprise ($499/mo)</MenuItem>
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={12} md={6}>
                <FormControl fullWidth>
                  <InputLabel>Industry</InputLabel>
                  <Select
                    value={newTenantForm.industry}
                    onChange={(e) => setNewTenantForm({ ...newTenantForm, industry: e.target.value })}
                    label="Industry"
                  >
                    <MenuItem value="">Select Industry</MenuItem>
                    <MenuItem value="technology">Technology</MenuItem>
                    <MenuItem value="healthcare">Healthcare</MenuItem>
                    <MenuItem value="finance">Finance</MenuItem>
                    <MenuItem value="education">Education</MenuItem>
                    <MenuItem value="retail">Retail</MenuItem>
                    <MenuItem value="marketing">Marketing</MenuItem>
                  </Select>
                </FormControl>
              </Grid>

              <Grid item xs={12} sx={{ mt: 2 }}>
                <Typography variant="h6" gutterBottom>
                  Admin User
                </Typography>
              </Grid>
              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  label="Admin Email"
                  type="email"
                  value={adminUserForm.email}
                  onChange={(e) => setAdminUserForm({ ...adminUserForm, email: e.target.value })}
                />
              </Grid>
              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  label="Username"
                  value={adminUserForm.username}
                  onChange={(e) => setAdminUserForm({ ...adminUserForm, username: e.target.value })}
                />
              </Grid>
              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  label="First Name"
                  value={adminUserForm.first_name}
                  onChange={(e) => setAdminUserForm({ ...adminUserForm, first_name: e.target.value })}
                />
              </Grid>
              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  label="Last Name"
                  value={adminUserForm.last_name}
                  onChange={(e) => setAdminUserForm({ ...adminUserForm, last_name: e.target.value })}
                />
              </Grid>
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label="Password"
                  type="password"
                  value={adminUserForm.password}
                  onChange={(e) => setAdminUserForm({ ...adminUserForm, password: e.target.value })}
                />
              </Grid>
            </Grid>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setCreateTenantDialog(false)}>Cancel</Button>
            <Button
              onClick={handleCreateTenant}
              variant="contained"
              disabled={loading || !newTenantForm.name || !adminUserForm.email}
            >
              {loading ? 'Creating...' : 'Create Tenant'}
            </Button>
          </DialogActions>
        </Dialog>

        {/* Tenant Details Dialog */}
        <Dialog
          open={tenantDetailsDialog}
          onClose={() => setTenantDetailsDialog(false)}
          maxWidth="lg"
          fullWidth
        >
          <DialogTitle>Tenant Details</DialogTitle>
          <DialogContent>
            {selectedTenant && (
              <Grid container spacing={3} sx={{ mt: 1 }}>
                <Grid item xs={12} md={6}>
                  <Typography variant="subtitle2" color="text.secondary">
                    Company Information
                  </Typography>
                  <Box sx={{ mt: 1 }}>
                    <Typography><strong>Name:</strong> {selectedTenant.name}</Typography>
                    <Typography><strong>Email:</strong> {selectedTenant.email}</Typography>
                    <Typography><strong>Subdomain:</strong> {selectedTenant.subdomain}</Typography>
                    <Typography><strong>Industry:</strong> {selectedTenant.industry}</Typography>
                    <Typography><strong>Size:</strong> {selectedTenant.company_size}</Typography>
                  </Box>
                </Grid>
                <Grid item xs={12} md={6}>
                  <Typography variant="subtitle2" color="text.secondary">
                    Subscription Details
                  </Typography>
                  <Box sx={{ mt: 1 }}>
                    <Typography><strong>Plan:</strong> {selectedTenant.plan}</Typography>
                    <Typography><strong>Tier:</strong> {selectedTenant.tier}</Typography>
                    <Typography><strong>Monthly Cost:</strong> ${selectedTenant.monthly_cost}</Typography>
                    <Typography><strong>Users:</strong> {selectedTenant.current_user_count}/{selectedTenant.max_users}</Typography>
                    <Typography><strong>Storage:</strong> {selectedTenant.storage_quota_gb} GB</Typography>
                  </Box>
                </Grid>
                <Grid item xs={12}>
                  <Typography variant="subtitle2" color="text.secondary">
                    Activity
                  </Typography>
                  <Box sx={{ mt: 1 }}>
                    <Typography><strong>Created:</strong> {new Date(selectedTenant.created_at).toLocaleDateString()}</Typography>
                    <Typography><strong>Last Activity:</strong> {new Date(selectedTenant.last_activity).toLocaleDateString()}</Typography>
                    {selectedTenant.suspended_at && (
                      <Typography><strong>Suspended:</strong> {new Date(selectedTenant.suspended_at).toLocaleDateString()}</Typography>
                    )}
                  </Box>
                </Grid>
              </Grid>
            )}
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setTenantDetailsDialog(false)}>Close</Button>
            <Button variant="outlined">Edit Tenant</Button>
            <Button variant="outlined">Manage Users</Button>
            <Button variant="outlined">View Billing</Button>
          </DialogActions>
        </Dialog>

        {/* Suspend Tenant Dialog */}
        <Dialog
          open={suspendTenantDialog}
          onClose={() => setSuspendTenantDialog(false)}
          maxWidth="sm"
          fullWidth
        >
          <DialogTitle>Suspend Tenant</DialogTitle>
          <DialogContent>
            <Typography>
              Are you sure you want to suspend "{selectedTenant?.name}"? This will temporarily disable access for all users.
            </Typography>
            <TextField
              fullWidth
              label="Reason for suspension"
              multiline
              rows={3}
              sx={{ mt: 2 }}
              onChange={(e) => setSelectedTenant({ ...selectedTenant, suspension_reason: e.target.value })}
            />
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setSuspendTenantDialog(false)}>Cancel</Button>
            <Button
              onClick={() => handleSuspendTenant(selectedTenant?.suspension_reason || 'No reason provided')}
              color="error"
              variant="contained"
            >
              Suspend Tenant
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

export default TenantManagement;