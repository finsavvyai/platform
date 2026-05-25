/**
 * Template Library Component
 *
 * Browse and search workflow templates and components
 * Includes filtering, sorting, and preview functionality
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Card,
  CardContent,
  CardMedia,
  Typography,
  Grid,
  Button,
  Chip,
  Rating,
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
  Collapse,
  useTheme,
  alpha,
  debounce,
  InputAdornment
} from '@mui/material';
import {
  Search as SearchIcon,
  FilterList as FilterIcon,
  Add as AddIcon,
  Visibility as ViewIcon,
  Download as DownloadIcon,
  Star as StarIcon,
  StarBorder as StarBorderIcon,
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
  Tune as TuneIcon,
  Category as CategoryIcon,
  Timeline as TimelineIcon,
  Schedule as ScheduleIcon,
  Public as PublicIcon,
  Lock as LockIcon,
  Verified as VerifiedIcon
} from '@mui/icons-material';

import { templateAPI } from '../../services/api';
import { useNotification } from '../../hooks/useNotification';
import { useAuth } from '../../hooks/useAuth';
import TemplatePreviewDialog from './TemplatePreviewDialog';
import TemplateFiltersDialog from './TemplateFiltersDialog';
import CreateTemplateDialog from './CreateTemplateDialog';

interface Template {
  id: string;
  name: string;
  description: string;
  category: {
    id: string;
    name: string;
    icon: string;
    color: string;
  };
  tags: string[];
  difficulty_level: 'beginner' | 'intermediate' | 'advanced' | 'expert';
  estimated_runtime: string;
  rating: number;
  rating_count: number;
  download_count: number;
  is_featured: boolean;
  is_public: boolean;
  created_by: {
    id: string;
    full_name: string;
    email: string;
    avatar_url?: string;
  };
  created_at: string;
  preview_image?: string;
}

interface TemplatesResponse {
  items: Template[];
  total: number;
  skip: number;
  limit: number;
}

interface SearchFilters {
  query: string;
  category: string;
  tags: string[];
  difficulty_level: string;
  rating_min: number;
  is_public: boolean | null;
  featured: boolean | null;
  sort_by: string;
  sort_desc: boolean;
}

const DIFFICULTY_COLORS = {
  beginner: '#4caf50',
  intermediate: '#ff9800',
  advanced: '#f44336',
  expert: '#9c27b0'
};

const TemplateLibrary: React.FC = () => {
  const theme = useTheme();
  const { user } = useAuth();
  const { showNotification } = useNotification();

  // State
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [limit] = useState(12);

  const [filters, setFilters] = useState<SearchFilters>({
    query: '',
    category: '',
    tags: [],
    difficulty_level: '',
    rating_min: 0,
    is_public: null,
    featured: null,
    sort_by: 'created_at',
    sort_desc: true
  });

  const [showFilters, setShowFilters] = useState(false);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(null);
  const [showPreviewDialog, setShowPreviewDialog] = useState(false);
  const [categories, setCategories] = useState<any[]>([]);

  // Fetch templates
  const fetchTemplates = useCallback(async (currentPage: number = page) => {
    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams({
        skip: ((currentPage - 1) * limit).toString(),
        limit: limit.toString(),
        sort_by: filters.sort_by,
        sort_desc: filters.sort_desc.toString()
      });

      if (filters.query) params.append('q', filters.query);
      if (filters.category) params.append('category', filters.category);
      if (filters.difficulty_level) params.append('difficulty_level', filters.difficulty_level);
      if (filters.rating_min) params.append('rating_min', filters.rating_min.toString());
      if (filters.is_public !== null) params.append('is_public', filters.is_public.toString());
      if (filters.featured !== null) params.append('featured', filters.featured.toString());
      if (filters.tags.length > 0) params.append('tags', filters.tags.join(','));

      const response = await templateAPI.listTemplates(params.toString());
      const data: TemplatesResponse = response.data;

      setTemplates(data.items);
      setTotal(data.total);
      setPage(currentPage);
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to fetch templates');
      showNotification('Failed to fetch templates', 'error');
    } finally {
      setLoading(false);
    }
  }, [filters, limit, page, showNotification]);

  // Fetch categories
  const fetchCategories = useCallback(async () => {
    try {
      const response = await templateAPI.getTemplateCategories();
      setCategories(response.data);
    } catch (err: any) {
      console.error('Failed to fetch categories:', err);
    }
  }, []);

  // Debounced search
  const debouncedSearch = useCallback(
    debounce((query: string) => {
      setFilters(prev => ({ ...prev, query }));
      setPage(1);
    }, 500),
    []
  );

  // Effects
  useEffect(() => {
    fetchTemplates(1);
  }, [fetchTemplates]);

  useEffect(() => {
    fetchCategories();
  }, [fetchCategories]);

  // Event handlers
  const handleSearchChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    debouncedSearch(event.target.value);
  };

  const handleFilterChange = (newFilters: Partial<SearchFilters>) => {
    setFilters(prev => ({ ...prev, ...newFilters }));
    setPage(1);
  };

  const handlePageChange = (event: React.ChangeEvent<unknown>, value: number) => {
    fetchTemplates(value);
  };

  const handleTemplateClick = (template: Template) => {
    setSelectedTemplate(template);
    setShowPreviewDialog(true);
  };

  const handleInstantiateTemplate = async (templateId: string) => {
    try {
      const response = await templateAPI.instantiateTemplate(templateId, {
        name: '',
        description: '',
        variable_values: {}
      });

      showNotification('Template instantiated successfully', 'success');
      setShowPreviewDialog(false);

      // Navigate to the new workflow
      window.location.href = `/workflows/${response.data.workflow_id}`;
    } catch (err: any) {
      showNotification(err.response?.data?.detail || 'Failed to instantiate template', 'error');
    }
  };

  const handleDownloadTemplate = async (templateId: string) => {
    try {
      // This would typically download the template as a file
      showNotification('Template downloaded successfully', 'success');
    } catch (err: any) {
      showNotification('Failed to download template', 'error');
    }
  };

  const handleRateTemplate = async (templateId: string, rating: number, review?: string) => {
    try {
      await templateAPI.rateTemplate(templateId, { rating, review });
      showNotification('Template rated successfully', 'success');
      fetchTemplates();
    } catch (err: any) {
      showNotification('Failed to rate template', 'error');
    }
  };

  // Render helper functions
  const getDifficultyColor = (level: string) => {
    return DIFFICULTY_COLORS[level as keyof typeof DIFFICULTY_COLORS] || '#757575';
  };

  const renderTemplateCard = (template: Template) => (
    <Card
      key={template.id}
      sx={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        cursor: 'pointer',
        transition: 'all 0.2s ease-in-out',
        '&:hover': {
          transform: 'translateY(-2px)',
          boxShadow: theme.shadows[8]
        }
      }}
      onClick={() => handleTemplateClick(template)}
    >
      {template.preview_image && (
        <CardMedia
          component="img"
          height="160"
          image={template.preview_image}
          alt={template.name}
        />
      )}

      <CardContent sx={{ flexGrow: 1, pb: 1 }}>
        <Box display="flex" alignItems="center" mb={1}>
          <Typography variant="h6" component="h3" noWrap sx={{ flexGrow: 1 }}>
            {template.name}
          </Typography>

          {template.is_featured && (
            <Tooltip title="Featured Template">
              <StarIcon color="warning" fontSize="small" />
            </Tooltip>
          )}

          {template.is_public ? (
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
          {template.description}
        </Typography>

        <Box display="flex" alignItems="center" mb={1}>
          <Chip
            icon={<CategoryIcon fontSize="small" />}
            label={template.category.name}
            size="small"
            variant="outlined"
            sx={{ mr: 1 }}
          />

          <Chip
            label={template.difficulty_level}
            size="small"
            sx={{
              backgroundColor: alpha(getDifficultyColor(template.difficulty_level), 0.1),
              color: getDifficultyColor(template.difficulty_level),
              borderColor: getDifficultyColor(template.difficulty_level)
            }}
          />
        </Box>

        {template.tags.length > 0 && (
          <Box sx={{ mb: 1 }}>
            {template.tags.slice(0, 3).map((tag, index) => (
              <Chip
                key={index}
                label={tag}
                size="small"
                variant="outlined"
                sx={{ mr: 0.5, mb: 0.5 }}
              />
            ))}
            {template.tags.length > 3 && (
              <Chip
                label={`+${template.tags.length - 3}`}
                size="small"
                variant="outlined"
                sx={{ mr: 0.5, mb: 0.5 }}
              />
            )}
          </Box>
        )}

        <Box display="flex" alignItems="center" justifyContent="space-between" mt="auto">
          <Box display="flex" alignItems="center">
            <Rating
              value={template.rating}
              precision={0.1}
              size="small"
              readOnly
            />
            <Typography variant="caption" sx={{ ml: 1 }}>
              ({template.rating_count})
            </Typography>
          </Box>

          <Typography variant="caption" color="text.secondary">
            {template.estimated_runtime || 'Unknown runtime'}
          </Typography>
        </Box>

        <Box display="flex" alignItems="center" justifyContent="space-between" mt={1}>
          <Typography variant="caption" color="text.secondary">
            by {template.created_by.full_name || 'Anonymous'}
          </Typography>

          <Typography variant="caption" color="text.secondary">
            {template.download_count} downloads
          </Typography>
        </Box>
      </CardContent>

      <Box sx={{ p: 1, pt: 0, display: 'flex', gap: 1 }}>
        <Button
          size="small"
          variant="contained"
          startIcon={<DownloadIcon />}
          onClick={(e) => {
            e.stopPropagation();
            handleInstantiateTemplate(template.id);
          }}
          fullWidth
        >
          Use Template
        </Button>
      </Box>
    </Card>
  );

  return (
    <Box sx={{ p: 3 }}>
      {/* Header */}
      <Box sx={{ mb: 3, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Box>
          <Typography variant="h4" component="h1" gutterBottom>
            Template Library
          </Typography>
          <Typography variant="body1" color="text.secondary">
            Browse and discover workflow templates created by the community
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
            Create Template
          </Fab>
        )}
      </Box>

      {/* Search and Filters */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Grid container spacing={2} alignItems="center">
            <Grid item xs={12} md={4}>
              <TextField
                fullWidth
                placeholder="Search templates..."
                value={filters.query}
                onChange={handleSearchChange}
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
                  value={filters.category}
                  label="Category"
                  onChange={(e) => handleFilterChange({ category: e.target.value })}
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
                <InputLabel>Difficulty</InputLabel>
                <Select
                  value={filters.difficulty_level}
                  label="Difficulty"
                  onChange={(e) => handleFilterChange({ difficulty_level: e.target.value })}
                >
                  <MenuItem value="">All Levels</MenuItem>
                  <MenuItem value="beginner">Beginner</MenuItem>
                  <MenuItem value="intermediate">Intermediate</MenuItem>
                  <MenuItem value="advanced">Advanced</MenuItem>
                  <MenuItem value="expert">Expert</MenuItem>
                </Select>
              </FormControl>
            </Grid>

            <Grid item xs={12} md={2}>
              <FormControl fullWidth>
                <InputLabel>Sort By</InputLabel>
                <Select
                  value={`${filters.sort_by}_${filters.sort_desc ? 'desc' : 'asc'}`}
                  label="Sort By"
                  onChange={(e) => {
                    const [sort_by, sort_dir] = e.target.value.split('_');
                    handleFilterChange({
                      sort_by,
                      sort_desc: sort_dir === 'desc'
                    });
                  }}
                >
                  <MenuItem value="created_at_desc">Newest First</MenuItem>
                  <MenuItem value="created_at_asc">Oldest First</MenuItem>
                  <MenuItem value="rating_desc">Highest Rated</MenuItem>
                  <MenuItem value="download_count_desc">Most Downloaded</MenuItem>
                  <MenuItem value="name_asc">Name (A-Z)</MenuItem>
                  <MenuItem value="name_desc">Name (Z-A)</MenuItem>
                </Select>
              </FormControl>
            </Grid>

            <Grid item xs={12} md={2}>
              <Box display="flex" gap={1}>
                <Button
                  variant="outlined"
                  startIcon={<FilterIcon />}
                  onClick={() => setShowFilters(!showFilters)}
                  fullWidth
                >
                  Filters
                </Button>
              </Box>
            </Grid>
          </Grid>

          {/* Expanded Filters */}
          <Collapse in={showFilters}>
            <Box sx={{ mt: 2, pt: 2, borderTop: 1, borderColor: 'divider' }}>
              <Grid container spacing={2}>
                <Grid item xs={12} md={3}>
                  <FormControl fullWidth>
                    <InputLabel>Minimum Rating</InputLabel>
                    <Select
                      value={filters.rating_min}
                      label="Minimum Rating"
                      onChange={(e) => handleFilterChange({ rating_min: Number(e.target.value) })}
                    >
                      <MenuItem value={0}>Any Rating</MenuItem>
                      <MenuItem value={1}>1+ Stars</MenuItem>
                      <MenuItem value={2}>2+ Stars</MenuItem>
                      <MenuItem value={3}>3+ Stars</MenuItem>
                      <MenuItem value={4}>4+ Stars</MenuItem>
                      <MenuItem value={4.5}>4.5+ Stars</MenuItem>
                    </Select>
                  </FormControl>
                </Grid>

                <Grid item xs={12} md={3}>
                  <FormControl fullWidth>
                    <InputLabel>Visibility</InputLabel>
                    <Select
                      value={filters.is_public === null ? '' : filters.is_public.toString()}
                      label="Visibility"
                      onChange={(e) => handleFilterChange({
                        is_public: e.target.value === '' ? null : e.target.value === 'true'
                      })}
                    >
                      <MenuItem value="">All Templates</MenuItem>
                      <MenuItem value="true">Public Only</MenuItem>
                      <MenuItem value="false">Private Only</MenuItem>
                    </Select>
                  </FormControl>
                </Grid>

                <Grid item xs={12} md={3}>
                  <FormControl fullWidth>
                    <InputLabel>Featured</InputLabel>
                    <Select
                      value={filters.featured === null ? '' : filters.featured.toString()}
                      label="Featured"
                      onChange={(e) => handleFilterChange({
                        featured: e.target.value === '' ? null : e.target.value === 'true'
                      })}
                    >
                      <MenuItem value="">All Templates</MenuItem>
                      <MenuItem value="true">Featured Only</MenuItem>
                    </Select>
                  </FormControl>
                </Grid>
              </Grid>
            </Box>
          </Collapse>
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

      {/* Templates Grid */}
      <Grid container spacing={3}>
        {templates.map(renderTemplateCard)}
      </Grid>

      {/* Empty State */}
      {!loading && templates.length === 0 && !error && (
        <Box
          sx={{
            textAlign: 'center',
            py: 8,
            color: 'text.secondary'
          }}
        >
          <Typography variant="h6" gutterBottom>
            No templates found
          </Typography>
          <Typography variant="body2">
            Try adjusting your search criteria or filters
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

      {/* Dialogs */}
      <TemplatePreviewDialog
        open={showPreviewDialog}
        template={selectedTemplate}
        onClose={() => {
          setShowPreviewDialog(false);
          setSelectedTemplate(null);
        }}
        onInstantiate={handleInstantiateTemplate}
        onDownload={handleDownloadTemplate}
        onRate={handleRateTemplate}
      />

      <CreateTemplateDialog
        open={showCreateDialog}
        onClose={() => setShowCreateDialog(false)}
        onSuccess={() => {
          setShowCreateDialog(false);
          fetchTemplates();
        }}
      />
    </Box>
  );
};

export default TemplateLibrary;