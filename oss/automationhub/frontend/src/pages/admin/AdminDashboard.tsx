import React, { useState } from 'react';
import {
  Box,
  Grid,
  Card,
  CardContent,
  Typography,
  Button,
  Tabs,
  Tab,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  IconButton,
  Chip,
  Avatar,
  TextField,
  InputAdornment,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Switch,
  FormControlLabel,
  Alert,
  Divider,
} from '@mui/material';
import {
  Search as SearchIcon,
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Block as BlockIcon,
  VpnKey as KeyIcon,
  Download as DownloadIcon,
  Person as PersonIcon,
  History as HistoryIcon,
  Settings as SettingsIcon,
} from '@mui/icons-material';

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

function TabPanel(props: TabPanelProps) {
  const { children, value, index, ...other } = props;
  return (
    <div role="tabpanel" hidden={value !== index} {...other}>
      {value === index && <Box sx={{ pt: 3 }}>{children}</Box>}
    </div>
  );
}

const UserManagement: React.FC = () => {
  const [search, setSearch] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);

  const mockUsers = [
    { id: '1', email: 'admin@example.com', full_name: 'Admin User', role: 'super_admin', is_active: true, mfa_enabled: true, created_at: '2024-01-01' },
    { id: '2', email: 'user@example.com', full_name: 'Regular User', role: 'user', is_active: true, mfa_enabled: false, created_at: '2024-01-02' },
  ];

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 3 }}>
        <TextField
          placeholder="Search users..."
          size="small"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          InputProps={{ startAdornment: <InputAdornment position="start"><SearchIcon /></InputAdornment> }}
          sx={{ width: 300 }}
        />
        <Button variant="contained" startIcon={<AddIcon />} onClick={() => setDialogOpen(true)}>Add User</Button>
      </Box>
      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>User</TableCell>
              <TableCell>Role</TableCell>
              <TableCell>Status</TableCell>
              <TableCell>MFA</TableCell>
              <TableCell align="right">Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {mockUsers.map((user) => (
              <TableRow key={user.id}>
                <TableCell>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                    <Avatar sx={{ bgcolor: 'primary.main' }}>{user.full_name?.charAt(0)}</Avatar>
                    <Box>
                      <Typography variant="body2" fontWeight={500}>{user.full_name}</Typography>
                      <Typography variant="caption" color="text.secondary">{user.email}</Typography>
                    </Box>
                  </Box>
                </TableCell>
                <TableCell><Chip label={user.role} size="small" color={user.role === 'super_admin' ? 'error' : 'default'} /></TableCell>
                <TableCell><Chip label={user.is_active ? 'Active' : 'Inactive'} size="small" color={user.is_active ? 'success' : 'default'} /></TableCell>
                <TableCell>{user.mfa_enabled ? <Chip label="Enabled" size="small" color="success" /> : <Chip label="Disabled" size="small" variant="outlined" />}</TableCell>
                <TableCell align="right">
                  <IconButton size="small"><EditIcon fontSize="small" /></IconButton>
                  <IconButton size="small"><BlockIcon fontSize="small" /></IconButton>
                  <IconButton size="small" color="error"><DeleteIcon fontSize="small" /></IconButton>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Add User</DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
            <TextField label="Full Name" fullWidth />
            <TextField label="Email" type="email" fullWidth />
            <TextField label="Password" type="password" fullWidth />
            <FormControl fullWidth>
              <InputLabel>Role</InputLabel>
              <Select label="Role" defaultValue="user">
                <MenuItem value="super_admin">Super Admin</MenuItem>
                <MenuItem value="admin">Admin</MenuItem>
                <MenuItem value="user">User</MenuItem>
              </Select>
            </FormControl>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={() => setDialogOpen(false)}>Create</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

const APIKeyManagement: React.FC = () => {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [newKey, setNewKey] = useState<string | null>(null);

  const mockKeys = [
    { id: '1', name: 'Production Key', key_prefix: 'sk-prod-xxx', scopes: ['read', 'write'], created_at: '2024-01-01' },
  ];

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 3 }}>
        <Typography variant="body2" color="text.secondary">API keys allow programmatic access.</Typography>
        <Button variant="contained" startIcon={<AddIcon />} onClick={() => setDialogOpen(true)}>Create API Key</Button>
      </Box>
      {newKey && (
        <Alert severity="success" sx={{ mb: 3 }} onClose={() => setNewKey(null)}>
          <Typography variant="body2" fontWeight={500}>Your new API key:</Typography>
          <Typography variant="body2" sx={{ fontFamily: 'monospace' }}>{newKey}</Typography>
        </Alert>
      )}
      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Name</TableCell>
              <TableCell>Key Prefix</TableCell>
              <TableCell>Scopes</TableCell>
              <TableCell align="right">Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {mockKeys.map((key) => (
              <TableRow key={key.id}>
                <TableCell><Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}><KeyIcon fontSize="small" color="primary" />{key.name}</Box></TableCell>
                <TableCell><Typography sx={{ fontFamily: 'monospace' }}>{key.key_prefix}...</Typography></TableCell>
                <TableCell>{key.scopes.map((s) => <Chip key={s} label={s} size="small" sx={{ mr: 0.5 }} />)}</TableCell>
                <TableCell align="right"><IconButton size="small" color="error"><DeleteIcon fontSize="small" /></IconButton></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Create API Key</DialogTitle>
        <DialogContent>
          <TextField label="Key Name" fullWidth sx={{ mt: 1 }} />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={() => { setNewKey('sk-live-abc123'); setDialogOpen(false); }}>Create</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

const AuditLogs: React.FC = () => {
  const mockLogs = [
    { id: '1', user_email: 'admin@example.com', action: 'user.create', status: 'success', ip_address: '192.168.1.1', created_at: '2024-01-01T10:00:00' },
  ];

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 3 }}>
        <Typography variant="body2" color="text.secondary">View all actions performed in your organization</Typography>
        <Button variant="outlined" startIcon={<DownloadIcon />}>Export Logs</Button>
      </Box>
      <TableContainer component={Paper}>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Timestamp</TableCell>
              <TableCell>User</TableCell>
              <TableCell>Action</TableCell>
              <TableCell>Status</TableCell>
              <TableCell>IP Address</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {mockLogs.map((log) => (
              <TableRow key={log.id}>
                <TableCell>{new Date(log.created_at).toLocaleString()}</TableCell>
                <TableCell>{log.user_email}</TableCell>
                <TableCell><Chip label={log.action} size="small" variant="outlined" /></TableCell>
                <TableCell><Chip label={log.status} size="small" color={log.status === 'success' ? 'success' : 'error'} /></TableCell>
                <TableCell><Typography sx={{ fontFamily: 'monospace' }}>{log.ip_address}</Typography></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    </Box>
  );
};

const SystemSettingsPanel: React.FC = () => {
  return (
    <Grid container spacing={3}>
      <Grid item xs={12} md={6}>
        <Card>
          <CardContent>
            <Typography variant="h6" gutterBottom>Security Settings</Typography>
            <Divider sx={{ mb: 2 }} />
            <FormControlLabel control={<Switch defaultChecked />} label="Require MFA for all users" />
            <FormControlLabel control={<Switch />} label="Require email verification" />
          </CardContent>
        </Card>
      </Grid>
      <Grid item xs={12} md={6}>
        <Card>
          <CardContent>
            <Typography variant="h6" gutterBottom>System Status</Typography>
            <Divider sx={{ mb: 2 }} />
            <FormControlLabel control={<Switch color="warning" />} label="Maintenance Mode" />
          </CardContent>
        </Card>
      </Grid>
    </Grid>
  );
};

const AdminDashboard: React.FC = () => {
  const [tabValue, setTabValue] = useState(0);

  return (
    <Box>
      <Box sx={{ mb: 4 }}>
        <Typography variant="h4" fontWeight={700} gutterBottom>Admin Console</Typography>
        <Typography variant="body1" color="text.secondary">Manage users, API keys, and system settings</Typography>
      </Box>
      <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
        <Tabs value={tabValue} onChange={(_, v) => setTabValue(v)}>
          <Tab icon={<PersonIcon />} iconPosition="start" label="Users" />
          <Tab icon={<KeyIcon />} iconPosition="start" label="API Keys" />
          <Tab icon={<HistoryIcon />} iconPosition="start" label="Audit Logs" />
          <Tab icon={<SettingsIcon />} iconPosition="start" label="Settings" />
        </Tabs>
      </Box>
      <TabPanel value={tabValue} index={0}><UserManagement /></TabPanel>
      <TabPanel value={tabValue} index={1}><APIKeyManagement /></TabPanel>
      <TabPanel value={tabValue} index={2}><AuditLogs /></TabPanel>
      <TabPanel value={tabValue} index={3}><SystemSettingsPanel /></TabPanel>
    </Box>
  );
};

export default AdminDashboard;
