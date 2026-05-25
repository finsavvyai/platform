/**
 * Branding Settings Page
 * Complete interface for customizing tenant branding and white-labeling
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
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
  Switch,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
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
} from '@mui/material';
import {
  Save,
  Upload,
  Download,
  Delete,
  Edit,
  Add,
  Visibility,
  VisibilityOff,
  Refresh,
  Check,
  Close,
  Warning,
  Info,
  Palette,
  Font,
  Layout,
  Globe,
  Mail,
  Folder,
  CloudUpload,
  CloudDone,
  CloudOff,
} from '@mui/icons-material';

import { useBranding, useTheme } from '../components/Branding/ThemeProvider';
import BrandAssetUpload from '../components/Branding/BrandAssetUpload';
import ThemePreview from '../components/Branding/ThemePreview';
import DomainVerification from '../components/Branding/DomainVerification';

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

const BrandingSettings: React.FC = () => {
  const { branding, updateBranding, refreshBranding } = useBranding();
  const { toggleTheme, isDarkMode } = useTheme();

  const [tabValue, setTabValue] = useState(0);
  const [formData, setFormData] = useState({
    identity: {
      company_name: '',
      tagline: '',
      description: '',
    },
    theme: {
      theme_name: '',
      primary_color: '#3B82F6',
      secondary_color: '#10B981',
      accent_color: '#F59E0B',
      background_color: '#FFFFFF',
      surface_color: '#F9FAFB',
      text_color: '#1F2937',
      text_secondary_color: '#6B7280',
    },
    typography: {
      font_family_primary: 'Inter, sans-serif',
      font_family_secondary: 'Inter, sans-serif',
      font_family_mono: 'JetBrains Mono, monospace',
      font_size_base: 16,
      font_scale: 1.0,
    },
    layout: {
      border_radius: 8,
      spacing: 8,
      sidebar_width: 280,
      sidebar_style: 'sidebar',
      header_height: 64,
    },
    features: {
      white_label_mode: false,
      hide_upm_branding: false,
      custom_login_page: false,
    },
  });

  const [loading, setLoading] = useState(false);
  const [notification, setNotification] = useState({
    open: false,
    message: '',
    severity: 'success' as 'success' | 'error' | 'warning' | 'info',
  });

  const [brandAssets, setBrandAssets] = useState([]);
  const [themePresets, setThemePresets] = useState([]);
  const [emailTemplates, setEmailTemplates] = useState([]);
  const [domainVerifications, setDomainVerifications] = useState([]);

  // Load initial data
  useEffect(() => {
    if (branding) {
      setFormData({
        identity: {
          company_name: branding.identity?.company_name || '',
          tagline: branding.identity?.tagline || '',
          description: branding.identity?.description || '',
        },
        theme: {
          theme_name: branding.theme?.theme_name || '',
          primary_color: branding.theme?.colors?.primary || '#3B82F6',
          secondary_color: branding.theme?.colors?.secondary || '#10B981',
          accent_color: branding.theme?.colors?.accent || '#F59E0B',
          background_color: branding.theme?.colors?.background || '#FFFFFF',
          surface_color: branding.theme?.colors?.surface || '#F9FAFB',
          text_color: branding.theme?.colors?.text || '#1F2937',
          text_secondary_color: branding.theme?.colors?.textSecondary || '#6B7280',
        },
        typography: {
          font_family_primary: branding.theme?.typography?.fontFamily?.primary || 'Inter, sans-serif',
          font_family_secondary: branding.theme?.typography?.fontFamily?.secondary || 'Inter, sans-serif',
          font_family_mono: branding.theme?.typography?.fontFamily?.mono || 'JetBrains Mono, monospace',
          font_size_base: branding.theme?.typography?.fontSize?.base || 16,
          font_scale: branding.theme?.typography?.fontSize?.scale || 1.0,
        },
        layout: {
          border_radius: branding.theme?.layout?.borderRadius || 8,
          spacing: branding.theme?.layout?.spacing || 8,
          sidebar_width: branding.theme?.layout?.sidebar?.width || 280,
          sidebar_style: branding.theme?.layout?.sidebar?.style || 'sidebar',
          header_height: branding.theme?.layout?.header?.height || 64,
        },
        features: {
          white_label_mode: branding.features?.whiteLabelMode || false,
          hide_upm_branding: branding.features?.hideUpmBranding || false,
          custom_login_page: branding.features?.customLoginPage || false,
        },
      });
    }
  }, [branding]);

  useEffect(() => {
    loadBrandAssets();
    loadThemePresets();
    loadEmailTemplates();
    loadDomainVerifications();
  }, []);

  const handleTabChange = (event: React.SyntheticEvent, newValue: number) => {
    setTabValue(newValue);
  };

  const handleInputChange = (section: string, field: string, value: any) => {
    setFormData(prev => ({
      ...prev,
      [section]: {
        ...prev[section as keyof typeof prev],
        [field]: value,
      },
    }));
  };

  const handleSaveBranding = async () => {
    setLoading(true);
    try {
      await updateBranding(formData);
      setNotification({
        open: true,
        message: 'Branding settings saved successfully!',
        severity: 'success',
      });
    } catch (error) {
      setNotification({
        open: true,
        message: 'Failed to save branding settings',
        severity: 'error',
      });
    } finally {
      setLoading(false);
    }
  };

  const showNotification = (message: string, severity: 'success' | 'error' | 'warning' | 'info') => {
    setNotification({ open: true, message, severity });
  };

  const loadBrandAssets = async () => {
    try {
      const response = await fetch('/api/v1/branding/assets');
      const data = await response.json();
      setBrandAssets(data);
    } catch (error) {
      console.error('Failed to load brand assets:', error);
    }
  };

  const loadThemePresets = async () => {
    try {
      const response = await fetch('/api/v1/branding/theme-presets');
      const data = await response.json();
      setThemePresets(data);
    } catch (error) {
      console.error('Failed to load theme presets:', error);
    }
  };

  const loadEmailTemplates = async () => {
    try {
      const response = await fetch('/api/v1/branding/email-templates');
      const data = await response.json();
      setEmailTemplates(data);
    } catch (error) {
      console.error('Failed to load email templates:', error);
    }
  };

  const loadDomainVerifications = async () => {
    try {
      const response = await fetch('/api/v1/branding/domains');
      const data = await response.json();
      setDomainVerifications(data);
    } catch (error) {
      console.error('Failed to load domain verifications:', error);
    }
  };

  const applyThemePreset = async (presetId: string) => {
    try {
      setLoading(true);
      const response = await fetch(`/api/v1/branding/theme-presets/${presetId}/apply`, {
        method: 'POST',
      });

      if (response.ok) {
        await refreshBranding();
        showNotification('Theme preset applied successfully!', 'success');
      } else {
        showNotification('Failed to apply theme preset', 'error');
      }
    } catch (error) {
      showNotification('Failed to apply theme preset', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Container maxWidth="xl">
      <Box sx={{ py: 4 }}>
        {/* Header */}
        <Box sx={{ mb: 4, textAlign: 'center' }}>
          <Typography variant="h3" gutterBottom fontWeight={600}>
            Branding & White-Labeling
          </Typography>
          <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
            Customize the look and feel of your application with your own branding
          </Typography>
        </Box>

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

        {/* Tabs */}
        <Paper sx={{ mb: 3 }}>
          <Tabs
            value={tabValue}
            onChange={handleTabChange}
            variant="scrollable"
            scrollButtons="auto"
            sx={{ borderBottom: 1, borderColor: 'divider' }}
          >
            <Tab icon={<Palette />} label="Colors & Theme" />
            <Tab icon={<Font />} label="Typography" />
            <Tab icon={<Layout />} label="Layout & UI" />
            <Tab icon={<Upload />} label="Assets & Media" />
            <Tab icon={<Mail />} label="Email Templates" />
            <Tab icon={<Globe />} label="Custom Domains" />
            <Tab icon={<Folder />} label="Advanced" />
          </Tabs>
        </Paper>

        {/* Loading indicator */}
        {loading && <LinearProgress sx={{ mb: 2 }} />}

        {/* Colors & Theme Tab */}
        <TabPanel value={tabValue} index={0}>
          <Grid container spacing={3}>
            <Grid item xs={12} lg={8}>
              <Card>
                <CardContent>
                  <Typography variant="h6" gutterBottom>
                    Brand Identity
                  </Typography>
                  <Grid container spacing={3}>
                    <Grid item xs={12} md={6}>
                      <TextField
                        fullWidth
                        label="Company Name"
                        value={formData.identity.company_name}
                        onChange={(e) => handleInputChange('identity', 'company_name', e.target.value)}
                        sx={{ mb: 2 }}
                      />
                    </Grid>
                    <Grid item xs={12} md={6}>
                      <TextField
                        fullWidth
                        label="Tagline"
                        value={formData.identity.tagline}
                        onChange={(e) => handleInputChange('identity', 'tagline', e.target.value)}
                        sx={{ mb: 2 }}
                      />
                    </Grid>
                    <Grid item xs={12}>
                      <TextField
                        fullWidth
                        multiline
                        rows={3}
                        label="Description"
                        value={formData.identity.description}
                        onChange={(e) => handleInputChange('identity', 'description', e.target.value)}
                        sx={{ mb: 2 }}
                      />
                    </Grid>
                  </Grid>
                </CardContent>
              </Card>

              <Card sx={{ mt: 3 }}>
                <CardContent>
                  <Typography variant="h6" gutterBottom>
                    Color Scheme
                  </Typography>
                  <Grid container spacing={3}>
                    <Grid item xs={12} md={6}>
                      <TextField
                        fullWidth
                        label="Primary Color"
                        type="color"
                        value={formData.theme.primary_color}
                        onChange={(e) => handleInputChange('theme', 'primary_color', e.target.value)}
                        sx={{ mb: 2 }}
                      />
                    </Grid>
                    <Grid item xs={12} md={6}>
                      <TextField
                        fullWidth
                        label="Secondary Color"
                        type="color"
                        value={formData.theme.secondary_color}
                        onChange={(e) => handleInputChange('theme', 'secondary_color', e.target.value)}
                        sx={{ mb: 2 }}
                      />
                    </Grid>
                    <Grid item xs={12} md={6}>
                      <TextField
                        fullWidth
                        label="Accent Color"
                        type="color"
                        value={formData.theme.accent_color}
                        onChange={(e) => handleInputChange('theme', 'accent_color', e.target.value)}
                        sx={{ mb: 2 }}
                      />
                    </Grid>
                    <Grid item xs={12} md={6}>
                      <TextField
                        fullWidth
                        label="Background Color"
                        type="color"
                        value={formData.theme.background_color}
                        onChange={(e) => handleInputChange('theme', 'background_color', e.target.value)}
                        sx={{ mb: 2 }}
                      />
                    </Grid>
                  </Grid>
                </CardContent>
              </Card>
            </Grid>

            <Grid item xs={12} lg={4}>
              <ThemePreview config={formData} />

              <Card sx={{ mt: 3 }}>
                <CardContent>
                  <Typography variant="h6" gutterBottom>
                    Theme Presets
                  </Typography>
                  <List dense>
                    {themePresets.map((preset) => (
                      <ListItem key={preset.id}>
                        <Avatar sx={{ mr: 2, bgcolor: preset.colors?.primary }}>
                          <Palette />
                        </Avatar>
                        <ListItemText
                          primary={preset.display_name}
                          secondary={preset.description}
                        />
                        <Button
                          size="small"
                          onClick={() => applyThemePreset(preset.id)}
                          disabled={loading}
                        >
                          Apply
                        </Button>
                      </ListItem>
                    ))}
                  </List>
                </CardContent>
              </Card>
            </Grid>
          </Grid>
        </TabPanel>

        {/* Typography Tab */}
        <TabPanel value={tabValue} index={1}>
          <Grid container spacing={3}>
            <Grid item xs={12} md={6}>
              <Card>
                <CardContent>
                  <Typography variant="h6" gutterBottom>
                    Font Families
                  </Typography>
                  <FormControl fullWidth sx={{ mb: 2 }}>
                    <InputLabel>Primary Font</InputLabel>
                    <Select
                      value={formData.typography.font_family_primary}
                      onChange={(e) => handleInputChange('typography', 'font_family_primary', e.target.value)}
                    >
                      <MenuItem value="Inter, sans-serif">Inter</MenuItem>
                      <MenuItem value="Roboto, sans-serif">Roboto</MenuItem>
                      <MenuItem value="Open Sans, sans-serif">Open Sans</MenuItem>
                      <MenuItem value="Lato, sans-serif">Lato</MenuItem>
                      <MenuItem value="Montserrat, sans-serif">Montserrat</MenuItem>
                      <MenuItem value="Poppins, sans-serif">Poppins</MenuItem>
                    </Select>
                  </FormControl>
                  <FormControl fullWidth sx={{ mb: 2 }}>
                    <InputLabel>Secondary Font</InputLabel>
                    <Select
                      value={formData.typography.font_family_secondary}
                      onChange={(e) => handleInputChange('typography', 'font_family_secondary', e.target.value)}
                    >
                      <MenuItem value="Inter, sans-serif">Inter</MenuItem>
                      <MenuItem value="Roboto, sans-serif">Roboto</MenuItem>
                      <MenuItem value="Open Sans, sans-serif">Open Sans</MenuItem>
                      <MenuItem value="Lato, sans-serif">Lato</MenuItem>
                      <MenuItem value="Montserrat, sans-serif">Montserrat</MenuItem>
                      <MenuItem value="Poppins, sans-serif">Poppins</MenuItem>
                    </Select>
                  </FormControl>
                  <FormControl fullWidth sx={{ mb: 2 }}>
                    <InputLabel>Monospace Font</InputLabel>
                    <Select
                      value={formData.typography.font_family_mono}
                      onChange={(e) => handleInputChange('typography', 'font_family_mono', e.target.value)}
                    >
                      <MenuItem value="JetBrains Mono, monospace">JetBrains Mono</MenuItem>
                      <MenuItem value="Fira Code, monospace">Fira Code</MenuItem>
                      <MenuItem value="Source Code Pro, monospace">Source Code Pro</MenuItem>
                      <MenuItem value="Courier New, monospace">Courier New</MenuItem>
                    </Select>
                  </FormControl>
                </CardContent>
              </Card>
            </Grid>

            <Grid item xs={12} md={6}>
              <Card>
                <CardContent>
                  <Typography variant="h6" gutterBottom>
                    Font Sizing
                  </Typography>
                  <TextField
                    fullWidth
                    label="Base Font Size (px)"
                    type="number"
                    value={formData.typography.font_size_base}
                    onChange={(e) => handleInputChange('typography', 'font_size_base', parseInt(e.target.value))}
                    sx={{ mb: 2 }}
                    inputProps={{ min: 12, max: 24 }}
                  />
                  <TextField
                    fullWidth
                    label="Font Scale"
                    type="number"
                    value={formData.typography.font_scale}
                    onChange={(e) => handleInputChange('typography', 'font_scale', parseFloat(e.target.value))}
                    sx={{ mb: 2 }}
                    inputProps={{ min: 0.8, max: 1.5, step: 0.1 }}
                  />
                  <Typography variant="body2" color="text.secondary">
                    Font scale affects the relative size of all text elements.
                    1.0 is normal scaling, 1.2 makes everything 20% larger.
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
          </Grid>
        </TabPanel>

        {/* Layout & UI Tab */}
        <TabPanel value={tabValue} index={2}>
          <Grid container spacing={3}>
            <Grid item xs={12} md={6}>
              <Card>
                <CardContent>
                  <Typography variant="h6" gutterBottom>
                    Layout Settings
                  </Typography>
                  <TextField
                    fullWidth
                    label="Border Radius (px)"
                    type="number"
                    value={formData.layout.border_radius}
                    onChange={(e) => handleInputChange('layout', 'border_radius', parseInt(e.target.value))}
                    sx={{ mb: 2 }}
                    inputProps={{ min: 0, max: 20 }}
                  />
                  <TextField
                    fullWidth
                    label="Spacing Unit (px)"
                    type="number"
                    value={formData.layout.spacing}
                    onChange={(e) => handleInputChange('layout', 'spacing', parseInt(e.target.value))}
                    sx={{ mb: 2 }}
                    inputProps={{ min: 4, max: 16 }}
                  />
                  <TextField
                    fullWidth
                    label="Sidebar Width (px)"
                    type="number"
                    value={formData.layout.sidebar_width}
                    onChange={(e) => handleInputChange('layout', 'sidebar_width', parseInt(e.target.value))}
                    sx={{ mb: 2 }}
                    inputProps={{ min: 200, max: 400 }}
                  />
                  <TextField
                    fullWidth
                    label="Header Height (px)"
                    type="number"
                    value={formData.layout.header_height}
                    onChange={(e) => handleInputChange('layout', 'header_height', parseInt(e.target.value))}
                    sx={{ mb: 2 }}
                    inputProps={{ min: 48, max: 100 }}
                  />
                </CardContent>
              </Card>
            </Grid>

            <Grid item xs={12} md={6}>
              <Card>
                <CardContent>
                  <Typography variant="h6" gutterBottom>
                    White-Label Features
                  </Typography>
                  <List>
                    <ListItem>
                      <ListItemText
                        primary="White Label Mode"
                        secondary="Remove all UPM.Plus branding"
                      />
                      <Switch
                        checked={formData.features.white_label_mode}
                        onChange={(e) => handleInputChange('features', 'white_label_mode', e.target.checked)}
                      />
                    </ListItem>
                    <ListItem>
                      <ListItemText
                        primary="Hide UPM Branding"
                        secondary="Hide UPM.Plus references in footer"
                      />
                      <Switch
                        checked={formData.features.hide_upm_branding}
                        onChange={(e) => handleInputChange('features', 'hide_upm_branding', e.target.checked)}
                      />
                    </ListItem>
                    <ListItem>
                      <ListItemText
                        primary="Custom Login Page"
                        secondary="Use custom branded login page"
                      />
                      <Switch
                        checked={formData.features.custom_login_page}
                        onChange={(e) => handleInputChange('features', 'custom_login_page', e.target.checked)}
                      />
                    </ListItem>
                  </List>
                </CardContent>
              </Card>
            </Grid>
          </Grid>
        </TabPanel>

        {/* Assets & Media Tab */}
        <TabPanel value={tabValue} index={3}>
          <BrandAssetUpload onAssetUploaded={loadBrandAssets} />

          <Grid container spacing={3} sx={{ mt: 2 }}>
            {brandAssets.map((asset) => (
              <Grid item xs={12} sm={6} md={4} lg={3} key={asset.id}>
                <Card>
                  <CardContent>
                    {asset.asset_type === 'logo' && (
                      <Box sx={{ textAlign: 'center', py: 2 }}>
                        <Avatar
                          src={asset.file_url}
                          sx={{ width: 80, height: 80, mx: 'auto', mb: 1 }}
                        >
                          <Upload />
                        </Avatar>
                      </Box>
                    )}
                    <Typography variant="subtitle2" gutterBottom>
                      {asset.name}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      {asset.asset_type} • {Math.round(asset.file_size / 1024)}KB
                    </Typography>
                    {asset.is_default && (
                      <Chip
                        size="small"
                        label="Default"
                        color="primary"
                        sx={{ mt: 1 }}
                      />
                    )}
                  </CardContent>
                  <CardActions>
                    <Button size="small" startIcon={<Edit />}>
                      Edit
                    </Button>
                    {!asset.is_default && (
                      <Button size="small" color="error" startIcon={<Delete />}>
                        Delete
                      </Button>
                    )}
                  </CardActions>
                </Card>
              </Grid>
            ))}
          </Grid>
        </TabPanel>

        {/* Email Templates Tab */}
        <TabPanel value={tabValue} index={4}>
          <Box sx={{ mb: 3 }}>
            <Button
              variant="contained"
              startIcon={<Add />}
              onClick={() => showNotification('Email template editor coming soon!', 'info')}
            >
              Create New Template
            </Button>
          </Box>

          <Grid container spacing={3}>
            {emailTemplates.map((template) => (
              <Grid item xs={12} md={6} lg={4} key={template.id}>
                <Card>
                  <CardContent>
                    <Typography variant="h6" gutterBottom>
                      {template.name}
                    </Typography>
                    <Chip
                      size="small"
                      label={template.template_type}
                      sx={{ mb: 1 }}
                    />
                    <Typography variant="body2" color="text.secondary" gutterBottom>
                      Subject: {template.subject}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Language: {template.language} • Version: {template.version}
                    </Typography>
                    {template.is_default && (
                      <Chip
                        size="small"
                        label="Default"
                        color="primary"
                        sx={{ mt: 1 }}
                      />
                    )}
                  </CardContent>
                  <CardActions>
                    <Button size="small" startIcon={<Edit />}>
                      Edit
                    </Button>
                    <Button size="small" startIcon={<Visibility />}>
                      Preview
                    </Button>
                  </CardActions>
                </Card>
              </Grid>
            ))}
          </Grid>
        </TabPanel>

        {/* Custom Domains Tab */}
        <TabPanel value={tabValue} index={5}>
          <DomainVerification onDomainUpdated={loadDomainVerifications} />

          <Grid container spacing={3} sx={{ mt: 2 }}>
            {domainVerifications.map((domain) => (
              <Grid item xs={12} md={6} lg={4} key={domain.id}>
                <Card>
                  <CardContent>
                    <Typography variant="h6" gutterBottom>
                      {domain.domain}
                    </Typography>
                    <Chip
                      size="small"
                      label={domain.verification_status}
                      color={
                        domain.verification_status === 'verified'
                          ? 'success'
                          : domain.verification_status === 'failed'
                          ? 'error'
                          : 'warning'
                      }
                      sx={{ mb: 2 }}
                    />
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      {domain.ssl_enabled ? (
                        <CloudDone color="success" />
                      ) : (
                        <CloudOff color="disabled" />
                      )}
                      <Typography variant="body2" color="text.secondary">
                        SSL: {domain.ssl_enabled ? 'Enabled' : 'Disabled'}
                      </Typography>
                    </Box>
                  </CardContent>
                  <CardActions>
                    <Button size="small" startIcon={<Refresh />}>
                      Verify
                    </Button>
                    {domain.verification_status === 'pending' && (
                      <Button size="small" startIcon={<Info />}>
                        Instructions
                      </Button>
                    )}
                  </CardActions>
                </Card>
              </Grid>
            ))}
          </Grid>
        </TabPanel>

        {/* Advanced Tab */}
        <TabPanel value={tabValue} index={6}>
          <Grid container spacing={3}>
            <Grid item xs={12} md={6}>
              <Card>
                <CardContent>
                  <Typography variant="h6" gutterBottom>
                    Custom CSS
                  </Typography>
                  <TextField
                    fullWidth
                    multiline
                    rows={8}
                    placeholder="/* Add custom CSS rules here */"
                    variant="outlined"
                    sx={{ fontFamily: 'monospace' }}
                  />
                  <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                    Custom CSS will be applied after the main stylesheets.
                  </Typography>
                </CardContent>
              </Card>
            </Grid>

            <Grid item xs={12} md={6}>
              <Card>
                <CardContent>
                  <Typography variant="h6" gutterBottom>
                    Custom JavaScript
                  </Typography>
                  <TextField
                    fullWidth
                    multiline
                    rows={8}
                    placeholder="// Add custom JavaScript here"
                    variant="outlined"
                    sx={{ fontFamily: 'monospace' }}
                  />
                  <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                    Custom JavaScript will be executed after page load.
                    Use with caution and test thoroughly.
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
          </Grid>
        </TabPanel>

        {/* Save Button */}
        <Box sx={{ mt: 4, textAlign: 'center' }}>
          <Button
            variant="contained"
            size="large"
            onClick={handleSaveBranding}
            disabled={loading}
            startIcon={<Save />}
          >
            {loading ? 'Saving...' : 'Save All Changes'}
          </Button>
        </Box>
      </Box>
    </Container>
  );
};

export default BrandingSettings;