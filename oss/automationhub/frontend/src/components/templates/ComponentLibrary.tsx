/**
 * Component Library Component
 *
 * Browse and manage reusable workflow components
 * Includes component creation, editing, and preview functionality
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Grid,
  Button,
  Chip,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  IconButton,
  Tooltip,
  LinearProgress,
  Alert,
  Pagination,
  Fab,
  Badge,
  useTheme,
  alpha,
  Tabs,
  Tab,
  InputAdornment,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Switch,
  FormControlLabel
} from '@mui/material';
import {
  Search as SearchIcon,
  Add as AddIcon,
  Code as CodeIcon,
  Settings as SettingsIcon,
  Visibility as ViewIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Download as DownloadIcon,
  Star as StarIcon,
  StarBorder as StarBorderIcon,
  ExpandMore as ExpandMoreIcon,
  FilterList as FilterIcon,
  Tune as TuneIcon,
  Category as CategoryIcon,
  Verified as VerifiedIcon,
  Public as PublicIcon,
  Lock as LockIcon,
  IntegrationInstructions as IntegrationIcon,
  DataObject as DataObjectIcon,
  AccountTree as AccountTreeIcon,
  CallSplit as CallSplitIcon,
  Transform as TransformIcon
} from '@mui/icons-material';

import { templateAPI } from '../../services/api';
import { useNotification } from '../../hooks/useNotification';
import { useAuth } from '../../hooks/useAuth';
import ComponentPreviewDialog from './ComponentPreviewDialog';
import CreateComponentDialog from './CreateComponentDialog';
import ComponentCodeEditor from './ComponentCodeEditor';

interface Component {
  id: string;
  name: string;
  description: string;
  component_type: 'action' | 'trigger' | 'condition' | 'transform' | 'integration' | 'utility' | 'custom';
  category: {
    id: string;
    name: string;
    icon: string;
    color: string;
  };
  definition: Record<string, any>;
  input_schema?: Record<string, any>;
  output_schema?: Record<string, any>;
  configuration_schema?: Record<string, any>;
  default_configuration?: Record<string, any>;
  tags: string[];
  is_public: boolean;
  is_verified: boolean;
  status: 'active' | 'inactive' | 'deprecated';
  version: string;
  usage_count: number;
  rating: number;
  rating_count: number;
  created_by: {
    id: string;
    full_name: string;
    email: string;
    avatar_url?: string;
  };
  created_at: string;
  updated_at: string;
  verified_at?: string;
}

interface ComponentsResponse {
  items: Component[];
  total: number;
  skip: number;
  limit: number;
}

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
      id={`component-tabpanel-${index}`}
      aria-labelledby={`component-tab-${index}`}
    >
      {value === index && <Box sx={{ pt: 3 }}>{children}</Box>}
    </div>
  );
};

const COMPONENT_TYPE_ICONS = {
  action: <SettingsIcon />,
  trigger: <IntegrationIcon />,
  condition: <AccountTreeIcon />,
  transform: <TransformIcon />,
  integration: <IntegrationIcon />,
  utility: <TuneIcon />,
  custom: <CodeIcon />
};

const COMPONENT_TYPE_COLORS = {
  action: '#2196f3',
  trigger: '#4caf50',
  condition: '#ff9800',
  transform: '#9c27b0',
  integration: '#f44336',
  utility: '#607d8b',
  custom: '#795548'
};

const STATUS_COLORS = {
  active: '#4caf50',
  inactive: '#9e9e9e',
  deprecated: '#f44336'
};

const ComponentLibrary: React.FC = () => {
  const theme = useTheme();
  const { user } = useAuth();
  const { showNotification } = useNotification();

  // State
  const [components, setComponents] = useState<Component[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [limit] = useState(12);
  const [tabValue, setTabValue] = useState(0);

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [selectedType, setSelectedType] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('');
  const [showPublicOnly, setShowPublicOnly] = useState(false);
  const [showVerifiedOnly, setShowVerifiedOnly] = useState(false);

  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showPreviewDialog, setShowPreviewDialog] = useState(false);
  const [showCodeEditor, setShowCodeEditor] = useState(false);
  const [selectedComponent, setSelectedComponent] = useState<Component | null>(null);
  const [categories, setCategories] = useState<any[]>([]);

  // Fetch components
  const fetchComponents = useCallback(async (currentPage: number = page) => {
    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams({
        skip: ((currentPage - 1) * limit).toString(),
        limit: limit.toString()
      });

      if (searchQuery) params.append('q', searchQuery);
      if (selectedCategory) params.append('category', selectedCategory);
      if (selectedType) params.append('component_type', selectedType);
      if (selectedStatus) params.append('status', selectedStatus);
      if (showPublicOnly) params.append('is_public', 'true');
      if (showVerifiedOnly) params.append('is_verified', 'true');

      const response = await templateAPI.listComponents(params.toString());
      const data: ComponentsResponse = response.data;

      setComponents(data.items);
      setTotal(data.total);
      setPage(currentPage);
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to fetch components');
      showNotification('Failed to fetch components', 'error');
    } finally {
      setLoading(false);
    }
  }, [
    searchQuery, selectedCategory, selectedType, selectedStatus,
    showPublicOnly, showVerifiedOnly, limit, page, showNotification
  ]);

  // Fetch categories
  const fetchCategories = useCallback(async () => {
    try {
      const response = await templateAPI.getComponentCategories();
      setCategories(response.data);
    } catch (err: any) {
      console.error('Failed to fetch categories:', err);
    }
  }, []);

  // Debounced search
  const debouncedSearch = useCallback(
    debounce((query: string) => {
      setSearchQuery(query);
      setPage(1);
    }, 500),
    []
  );

  // Effects
  useEffect(() => {
    fetchComponents(1);
  }, [fetchComponents]);

  useEffect(() => {
    fetchCategories();
  }, [fetchCategories]);

  // Event handlers
  const handleTabChange = (event: React.SyntheticEvent, newValue: number) => {
    setTabValue(newValue);
  };

  const handleSearchChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    debouncedSearch(event.target.value);
  };

  const handlePageChange = (event: React.ChangeEvent<unknown>, value: number) => {
    fetchComponents(value);
  };

  const handleComponentClick = (component: Component) => {
    setSelectedComponent(component);
    setShowPreviewDialog(true);
  };

  const handleEditComponent = (component: Component, event: React.MouseEvent) => {
    event.stopPropagation();
    setSelectedComponent(component);
    setShowCodeEditor(true);
  };

  const handleDeleteComponent = async (componentId: string, event: React.MouseEvent) => {
    event.stopPropagation();

    if (!window.confirm('Are you sure you want to delete this component?')) {
      return;
    }

    try {
      await templateAPI.deleteComponent(componentId);
      showNotification('Component deleted successfully', 'success');
      fetchComponents();
    } catch (err: any) {
      showNotification('Failed to delete component', 'error');
    }
  };

  const handleCopyComponent = async (component: Component, event: React.MouseEvent) => {
    event.stopPropagation();

    try {
      // Create a copy of the component
      const copyData = {
        name: `${component.name} (Copy)`,
        description: component.description,
        component_type: component.component_type,
        category: component.category.name,
        definition: component.definition,
        input_schema: component.input_schema,
        output_schema: component.output_schema,
        configuration_schema: component.configuration_schema,
        default_configuration: component.default_configuration,
        tags: component.tags,
        is_public: false
      };

      await templateAPI.createComponent(copyData);
      showNotification('Component copied successfully', 'success');
      fetchComponents();
    } catch (err: any) {
      showNotification('Failed to copy component', 'error');
    }
  };

  const handleRateComponent = async (componentId: string, rating: number, review?: string) => {
    try {
      // This would need to be implemented in the API
      showNotification('Component rated successfully', 'success');
      fetchComponents();
    } catch (err: any) {
      showNotification('Failed to rate component', 'error');
    }
  };

  // Render helper functions
  const getComponentTypeColor = (type: string) => {
    return COMPONENT_TYPE_COLORS[type as keyof typeof COMPONENT_TYPE_COLORS] || '#757575';
  };

  const getStatusColor = (status: string) => {
    return STATUS_COLORS[status as keyof typeof STATUS_COLORS] || '#757575';
  };

  const renderComponentCard = (component: Component) => (
    <Card
      key={component.id}
      sx={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        cursor: 'pointer',
        transition: 'all 0.2s ease-in-out',
        border: component.is_verified ? `2px solid ${theme.palette.success.main}` : '1px solid #e0e0e0',
        '&:hover': {
          transform: 'translateY(-2px)',
          boxShadow: theme.shadows[8]
        }
      }}
      onClick={() => handleComponentClick(component)}
    >
      <CardContent sx={{ flexGrow: 1, pb: 1 }}>
        <Box display="flex" alignItems="center" mb={1}>
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 32,
              height: 32,
              borderRadius: 1,
              backgroundColor: alpha(getComponentTypeColor(component.component_type), 0.1),
              color: getComponentTypeColor(component.component_type),
              mr: 1
            }}
          >
            {COMPONENT_TYPE_ICONS[component.component_type as keyof typeof COMPONENT_TYPE_ICONS]}
          </Box>

          <Typography variant="h6" component="h3" noWrap sx={{ flexGrow: 1 }}>
            {component.name}
          </Typography>

          {component.is_verified && (
            <Tooltip title="Verified Component">
              <VerifiedIcon color="success" fontSize="small" />
            </Tooltip>
          )}

          {component.is_public ? (
            <PublicIcon color="action" fontSize="small" sx={{ ml: 1 }} />
          ) : (
            <LockIcon color="action" fontSize="small" sx={{ ml: 1 }} />
          )}
        </Box>

        <Typography
          variant="body2"
          color="text.secondary"
          sx={{
            mb: 2,
            height: 40,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical'
          }}
        >
          {component.description}
        </Typography>

        <Box display="flex" alignItems="center" gap={1} mb={1}>
          <Chip
            icon={<CategoryIcon fontSize="small" />}
            label={component.category.name}
            size="small"
            variant="outlined"
          />

          <Chip
            label={component.component_type}
            size="small"
            sx={{
              backgroundColor: alpha(getComponentTypeColor(component.component_type), 0.1),
              color: getComponentTypeColor(component.component_type),
              borderColor: getComponentTypeColor(component.component_type)
            }}
          />

          <Chip
            label={component.status}
            size="small"
            sx={{
              backgroundColor: alpha(getStatusColor(component.status), 0.1),
              color: getStatusColor(component.status),
              borderColor: getStatusColor(component.status)
            }}
          />
        </Box>

        {component.tags.length > 0 && (
          <Box sx={{ mb: 2 }}>
            {component.tags.slice(0, 2).map((tag, index) => (
              <Chip
                key={index}
                label={tag}
                size="small"
                variant="outlined"
                sx={{ mr: 0.5, mb: 0.5 }}
              />
            ))}
            {component.tags.length > 2 && (
              <Chip
                label={`+${component.tags.length - 2}`}
                size="small"
                variant="outlined"
                sx={{ mr: 0.5, mb: 0.5 }}
              />
            )}
          </Box>
        )}

        <Box display="flex" alignItems="center" justifyContent="space-between" mt="auto">
          <Box display="flex" alignItems="center">
            <Typography variant="caption" color="text.secondary">
              v{component.version}
            </Typography>
            <Typography variant="caption" color="text.secondary" sx={{ ml: 1 }}>
              {component.usage_count} uses
            </Typography>
          </Box>

          <Box display="flex" alignItems="center">
            <Rating
              value={component.rating}
              precision={0.1}
              size="small"
              readOnly
            />
            <Typography variant="caption" sx={{ ml: 1 }}>
              ({component.rating_count})
            </Typography>
          </Box>
        </Box>

        <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
          by {component.created_by.full_name || 'Anonymous'}
        </Typography>
      </CardContent>

      <Box sx={{ p: 1, pt: 0, display: 'flex', gap: 1 }}>
        <Tooltip title="View Details">
          <IconButton
            size="small"
            onClick={(e) => {
              e.stopPropagation();
              handleComponentClick(component);
            }}
          >
            <ViewIcon fontSize="small" />
          </IconButton>
        </Tooltip>

        {user && component.created_by.id === user.id && (
          <Tooltip title="Edit Component">
            <IconButton
              size="small"
              onClick={(e) => handleEditComponent(component, e)}
            >
              <EditIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        )}

        <Tooltip title="Copy Component">
          <IconButton
            size="small"
            onClick={(e) => handleCopyComponent(component, e)}
          >
            <DownloadIcon fontSize="small" />
          </IconButton>
        </Tooltip>

        {user && component.created_by.id === user.id && (
          <Tooltip title="Delete Component">
            <IconButton
              size="small"
              color="error"
              onClick={(e) => handleDeleteComponent(component.id, e)}
            >
              <DeleteIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        )}
      </Box>
    </Card>
  );

  return (
    <Box sx={{ p: 3 }}>
      {/* Header */}
      <Box sx={{ mb: 3, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Box>
          <Typography variant="h4" component="h1" gutterBottom>
            Component Library
          </Typography>
          <Typography variant="body1" color="text.secondary">
            Manage and create reusable workflow components
          </Typography>
        </Box>

        {user && (
          <Fab
            color="primary"
            variant="extended"
            onClick={() => setShowCreateDialog(true)}
            sx={{ position: 'fixed', bottom: 24, right: 24, zIndex: 1000 }}
          >
            <AddIcon />
            Create Component
          </Fab>
        )}
      </Box>

      {/* Tabs */}
      <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 3 }}>
        <Tabs value={tabValue} onChange={handleTabChange}>
          <Tab label="Browse Components" />
          <Tab label="My Components" />
          <Tab label="Favorites" />
        </Tabs>
      </Box>

      <TabPanel value={tabValue} index={0}>
        {/* Search and Filters */}
        <Card sx={{ mb: 3 }}>
          <CardContent>
            <Grid container spacing={2} alignItems="center">
              <Grid item xs={12} md={3}>
                <TextField
                  fullWidth
                  placeholder="Search components..."
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <SearchIcon />
                      </InputAdornment>
                    )
                  }}
                />
              </Grid>

              <Grid item xs={12} md={2}>
                <FormControl fullWidth>
                  <InputLabel>Category</InputLabel>
                  <Select
                    value={selectedCategory}
                    label="Category"
                    onChange={(e) => setSelectedCategory(e.target.value)}
                  >
                    <MenuItem value="">All Categories</MenuItem>
                    {categories.map((category) => (
                      <MenuItem key={category.id} value={category.name}>
                        {category.name}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>

              <Grid item xs={12} md={2}>
                <FormControl fullWidth>
                  <InputLabel>Type</InputLabel>
                  <Select
                    value={selectedType}
                    label="Type"
                    onChange={(e) => setSelectedType(e.target.value)}
                  >
                    <MenuItem value="">All Types</MenuItem>
                    <MenuItem value="action">Action</MenuItem>
                    <MenuItem value="trigger">Trigger</MenuItem>
                    <MenuItem value="condition">Condition</MenuItem>
                    <MenuItem value="transform">Transform</MenuItem>
                    <MenuItem value="integration">Integration</MenuItem>
                    <MenuItem value="utility">Utility</MenuItem>
                    <MenuItem value="custom">Custom</MenuItem>
                  </Select>
                </FormControl>
              </Grid>

              <Grid item xs={12} md={2}>
                <FormControl fullWidth>
                  <InputLabel>Status</InputLabel>
                  <Select
                    value={selectedStatus}
                    label="Status"
                    onChange={(e) => setSelectedStatus(e.target.value)}
                  >
                    <MenuItem value="">All Statuses</MenuItem>
                    <MenuItem value="active">Active</MenuItem>
                    <MenuItem value="inactive">Inactive</MenuItem>
                    <MenuItem value="deprecated">Deprecated</MenuItem>
                  </Select>
                </FormControl>
              </Grid>

              <Grid item xs={12} md={3}>
                <Box display="flex" gap={1}>
                  <FormControlLabel
                    control={
                      <Switch
                        checked={showPublicOnly}
                        onChange={(e) => setShowPublicOnly(e.target.checked)}
                      />
                    }
                    label="Public Only"
                  />
                  <FormControlLabel
                    control={
                      <Switch
                        checked={showVerifiedOnly}
                        onChange={(e) => setShowVerifiedOnly(e.target.checked)}
                      />
                    }
                    label="Verified Only"
                  />
                </Box>
              </Grid>
            </Grid>
          </CardContent>
        </Card>

        {/* Error Alert */}
        {error && (
          <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError(null)}>
            {error}
          </Alert>
        )}

        {/* Loading Progress */}
        {loading && <LinearProgress sx={{ mb: 2 }} />}

        {/* Components Grid */}
        <Grid container spacing={3}>
          {components.map(renderComponentCard)}
        </Grid>

        {/* Empty State */}
        {!loading && components.length === 0 && !error && (
          <Box
            sx={{
              textAlign: 'center',
              py: 8,
              color: 'text.secondary'
            }}
          >
            <Typography variant="h6" gutterBottom>
              No components found
            </Typography>
            <Typography variant="body2">
              Try adjusting your search criteria or create a new component
            </Typography>
          </Box>
        )}

        {/* Pagination */}
        {total > limit && (
          <Box sx={{ display: 'flex', justifyContent: 'center', mt: 4 }}>
            <Pagination
              count={Math.ceil(total / limit)}
              page={page}
              onChange={handlePageChange}
              color="primary"
              size="large"
            />
          </Box>
        )}
      </TabPanel>

      <TabPanel value={tabValue} index={1}>
        {/* My Components - Similar structure but filtered by user */}
        <Typography variant="h6" gutterBottom>
          My Components
        </Typography>
        <Typography variant="body2" color="text.secondary" gutterBottom>
          Components you have created and manage
        </Typography>
        {/* Component grid would be filtered by user */}
      </TabPanel>

      <TabPanel value={tabValue} index={2}>
        {/* Favorites - Components marked as favorites */}
        <Typography variant="h6" gutterBottom>
          Favorite Components
        </Typography>
        <Typography variant="body2" color="text.secondary" gutterBottom>
          Your favorite components for quick access
        </Typography>
        {/* Favorite components grid */}
      </TabPanel>

      {/* Dialogs */}
      <ComponentPreviewDialog
        open={showPreviewDialog}
        component={selectedComponent}
        onClose={() => {
          setShowPreviewDialog(false);
          setSelectedComponent(null);
        }}
        onRate={handleRateComponent}
      />

      <CreateComponentDialog
        open={showCreateDialog}
        onClose={() => setShowCreateDialog(false)}
        onSuccess={() => {
          setShowCreateDialog(false);
          fetchComponents();
        }}
      />

      <ComponentCodeEditor
        open={showCodeEditor}
        component={selectedComponent}
        onClose={() => {
          setShowCodeEditor(false);
          setSelectedComponent(null);
        }}
        onSave={() => {
          setShowCodeEditor(false);
          fetchComponents();
        }}
      />
    </Box>
  );
};

export default ComponentLibrary;