/**
 * Workflow Template System
 *
 * Provides pre-built workflow templates for common automation scenarios:
 * - Data processing pipelines
 * - Web scraping workflows
 * - API integration flows
 * - Notification systems
 * - File processing automation
 */

import React, { useState, useMemo } from 'react';
import {
  Box,
  Card,
  CardContent,
  CardActions,
  Typography,
  Button,
  Chip,
  Grid,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  IconButton,
  Tooltip,
  useTheme,
  alpha,
  InputAdornment,
  Avatar,
  Divider,
} from '@mui/material';
import {
  Search,
  Add,
  Preview,
  Copy,
  Star,
  StarBorder,
  Share,
  Download,
  Upload,
  Category,
  TrendingUp,
  Code,
  Language,
  Storage,
  Email,
  Http,
  PlayArrow,
  Schedule,
  Computer,
  Memory,
  Transform,
} from '@mui/icons-material';

interface WorkflowTemplate {
  id: string;
  name: string;
  description: string;
  category: string;
  tags: string[];
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  estimatedTime: string;
  nodes: any[];
  edges: any[];
  author?: string;
  authorAvatar?: string;
  rating: number;
  downloads: number;
  isFavorite?: boolean;
  isCustom?: boolean;
  previewImage?: string;
  documentation?: string;
  requirements?: string[];
  outputs?: string[];
  metadata?: Record<string, any>;
}

const WorkflowTemplates: React.FC<{
  onTemplateSelect?: (template: WorkflowTemplate) => void;
  onTemplateInstall?: (template: WorkflowTemplate) => void;
  favorites?: string[];
  recentlyUsed?: string[];
}> = ({
  onTemplateSelect,
  onTemplateInstall,
  favorites = [],
  recentlyUsed = [],
}) => {
  const theme = useTheme();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedTemplate, setSelectedTemplate] = useState<WorkflowTemplate | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [sortBy, setSortBy] = useState<'name' | 'rating' | 'downloads' | 'recent'>('recent');

  // Template categories
  const categories = [
    { id: 'all', name: 'All Templates', icon: Category },
    { id: 'web-scraping', name: 'Web Scraping', icon: Language },
    { id: 'data-processing', name: 'Data Processing', icon: Transform },
    { id: 'api-integration', name: 'API Integration', icon: Http },
    { id: 'file-processing', name: 'File Processing', icon: Storage },
    { id: 'notification', name: 'Notifications', icon: Email },
    { id: 'automation', name: 'General Automation', icon: PlayArrow },
    { id: 'monitoring', name: 'Monitoring', icon: TrendingUp },
  ];

  // Sample workflow templates
  const templates: WorkflowTemplate[] = [
    {
      id: 'web-scraper-basic',
      name: 'Basic Web Scraper',
      description: 'Extract data from websites using browser automation',
      category: 'web-scraping',
      tags: ['scraping', 'browser', 'data-extraction'],
      difficulty: 'beginner',
      estimatedTime: '10 min',
      rating: 4.5,
      downloads: 1250,
      nodes: [
        {
          id: 'start',
          type: 'workflowNode',
          position: { x: 100, y: 100 },
          data: {
            nodeType: 'manual-trigger',
            label: 'Start',
            status: 'idle',
            config: {},
          },
        },
        {
          id: 'browser',
          type: 'workflowNode',
          position: { x: 300, y: 100 },
          data: {
            nodeType: 'browser-automation',
            label: 'Navigate to Website',
            status: 'idle',
            config: {
              task_type: 'navigate',
              url: 'https://example.com',
            },
          },
        },
      ],
      edges: [
        { id: 'e1', source: 'start', target: 'browser' },
      ],
      author: 'Automation Team',
      rating: 4.5,
      downloads: 1250,
    },
    {
      id: 'api-data-pipeline',
      name: 'API Data Pipeline',
      description: 'Fetch data from APIs and process it',
      category: 'api-integration',
      tags: ['api', 'data-processing', 'rest'],
      difficulty: 'intermediate',
      estimatedTime: '15 min',
      rating: 4.8,
      downloads: 890,
      nodes: [],
      edges: [],
    },
    {
      id: 'email-notification',
      name: 'Email Notification System',
      description: 'Send automated email notifications based on triggers',
      category: 'notification',
      tags: ['email', 'notifications', 'automation'],
      difficulty: 'beginner',
      estimatedTime: '5 min',
      rating: 4.3,
      downloads: 2100,
      nodes: [],
      edges: [],
    },
    {
      id: 'file-processor',
      name: 'Batch File Processor',
      description: 'Process multiple files with automation',
      category: 'file-processing',
      tags: ['files', 'batch', 'processing'],
      difficulty: 'advanced',
      estimatedTime: '20 min',
      rating: 4.6,
      downloads: 650,
      nodes: [],
      edges: [],
    },
    {
      id: 'data-transform',
      name: 'Data Transformation Pipeline',
      description: 'Transform and clean data using AI',
      category: 'data-processing',
      tags: ['transform', 'ai', 'data'],
      difficulty: 'intermediate',
      estimatedTime: '12 min',
      rating: 4.7,
      downloads: 780,
      nodes: [],
      edges: [],
    },
  ];

  // Filter and sort templates
  const filteredTemplates = useMemo(() => {
    let filtered = templates;

    // Filter by category
    if (selectedCategory !== 'all') {
      filtered = filtered.filter(t => t.category === selectedCategory);
    }

    // Filter by search term
    if (searchTerm) {
      const lowerSearch = searchTerm.toLowerCase();
      filtered = filtered.filter(t =>
        t.name.toLowerCase().includes(lowerSearch) ||
        t.description.toLowerCase().includes(lowerSearch) ||
        t.tags.some(tag => tag.toLowerCase().includes(lowerSearch))
      );
    }

    // Sort templates
    filtered.sort((a, b) => {
      switch (sortBy) {
        case 'name':
          return a.name.localeCompare(b.name);
        case 'rating':
          return b.rating - a.rating;
        case 'downloads':
          return b.downloads - a.downloads;
        case 'recent':
          return 0; // Would sort by creation date
        default:
          return 0;
      }
    });

    return filtered;
  }, [templates, selectedCategory, searchTerm, sortBy]);

  // Get category icon
  const getCategoryIcon = (categoryId: string) => {
    const category = categories.find(c => c.id === categoryId);
    return category?.icon || Category;
  };

  // Get difficulty color
  const getDifficultyColor = (difficulty: string) => {
    switch (difficulty) {
      case 'beginner':
        return 'success';
      case 'intermediate':
        return 'warning';
      case 'advanced':
        return 'error';
      default:
        return 'default';
    }
  };

  // Handle template selection
  const handleTemplateClick = (template: WorkflowTemplate) => {
    setSelectedTemplate(template);
    setPreviewOpen(true);
  };

  // Handle template installation
  const handleInstallTemplate = (template: WorkflowTemplate) => {
    onTemplateInstall?.(template);
    setPreviewOpen(false);
  };

  // Handle template copy
  const handleCopyTemplate = (template: WorkflowTemplate) => {
    onTemplateSelect?.(template);
    setPreviewOpen(false);
  };

  return (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <Box sx={{ p: 3, borderBottom: 1, borderColor: 'divider' }}>
        <Typography variant="h4" gutterBottom>
          Workflow Templates
        </Typography>
        <Typography variant="body1" color="textSecondary">
          Choose from pre-built workflow templates to get started quickly
        </Typography>
      </Box>

      {/* Search and Filters */}
      <Box sx={{ p: 3, borderBottom: 1, borderColor: 'divider' }}>
        <TextField
          fullWidth
          placeholder="Search templates..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <Search />
              </InputAdornment>
            ),
          }}
          sx={{ mb: 2 }}
        />

        {/* Category Filter */}
        <Box sx={{ display: 'flex', gap: 1, mb: 2, flexWrap: 'wrap' }}>
          {categories.map((category) => {
            const Icon = category.icon;
            return (
              <Button
                key={category.id}
                variant={selectedCategory === category.id ? 'contained' : 'outlined'}
                startIcon={<Icon />}
                onClick={() => setSelectedCategory(category.id)}
                size="small"
                sx={{ mb: 1 }}
              >
                {category.name}
              </Button>
            );
          })}
        </Box>

        {/* Sort Options */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <Typography variant="body2" color="textSecondary">
            Sort by:
          </Typography>
          <Button
            size="small"
            variant={sortBy === 'recent' ? 'contained' : 'text'}
            onClick={() => setSortBy('recent')}
          >
            Recent
          </Button>
          <Button
            size="small"
            variant={sortBy === 'rating' ? 'contained' : 'text'}
            onClick={() => setSortBy('rating')}
          >
            Rating
          </Button>
          <Button
            size="small"
            variant={sortBy === 'downloads' ? 'contained' : 'text'}
            onClick={() => setSortBy('downloads')}
          >
            Downloads
          </Button>
          <Button
            size="small"
            variant={sortBy === 'name' ? 'contained' : 'text'}
            onClick={() => setSortBy('name')}
          >
            Name
          </Button>
        </Box>
      </Box>

      {/* Templates Grid */}
      <Box sx={{ flex: 1, overflow: 'auto', p: 3 }}>
        <Grid container spacing={3}>
          {filteredTemplates.map((template) => {
            const CategoryIcon = getCategoryIcon(template.category);
            const isFavorite = favorites.includes(template.id);
            const isRecentlyUsed = recentlyUsed.includes(template.id);

            return (
              <Grid item xs={12} sm={6} md={4} lg={3} key={template.id}>
                <Card
                  sx={{
                    height: '100%',
                    display: 'flex',
                    flexDirection: 'column',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease-in-out',
                    '&:hover': {
                      transform: 'translateY(-4px)',
                      boxShadow: theme.shadows[8],
                    },
                  }}
                  onClick={() => handleTemplateClick(template)}
                >
                  {/* Card Header */}
                  <Box sx={{ p: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Avatar
                      sx={{
                        backgroundColor: alpha(theme.palette.primary.main, 0.1),
                        color: theme.palette.primary.main,
                      }}
                    >
                      <CategoryIcon />
                    </Avatar>
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                      <Typography variant="subtitle2" noWrap>
                        {template.name}
                      </Typography>
                      <Typography variant="caption" color="textSecondary">
                        by {template.author}
                      </Typography>
                    </Box>
                    <IconButton
                      size="small"
                      onClick={(e) => {
                        e.stopPropagation();
                        // Toggle favorite
                      }}
                    >
                      {isFavorite ? <Star color="warning" /> : <StarBorder />}
                    </IconButton>
                  </Box>

                  {/* Card Content */}
                  <CardContent sx={{ pt: 0, flex: 1 }}>
                    <Typography variant="body2" color="textSecondary" sx={{ mb: 2 }}>
                      {template.description}
                    </Typography>

                    {/* Tags */}
                    <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap', mb: 2 }}>
                      {template.tags.slice(0, 3).map((tag) => (
                        <Chip
                          key={tag}
                          label={tag}
                          size="small"
                          variant="outlined"
                          sx={{ fontSize: '10px' }}
                        />
                      ))}
                      {template.tags.length > 3 && (
                        <Chip
                          label={`+${template.tags.length - 3}`}
                          size="small"
                          variant="outlined"
                          sx={{ fontSize: '10px' }}
                        />
                      )}
                    </Box>

                    {/* Metadata */}
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <Chip
                        label={template.difficulty}
                        size="small"
                        color={getDifficultyColor(template.difficulty) as any}
                        sx={{ fontSize: '10px' }}
                      />
                      <Typography variant="caption" color="textSecondary">
                        {template.estimatedTime}
                      </Typography>
                    </Box>

                    {/* Indicators */}
                    {(isRecentlyUsed || template.isCustom) && (
                      <Box sx={{ display: 'flex', gap: 1, mt: 1 }}>
                        {isRecentlyUsed && (
                          <Chip label="Recent" size="small" color="info" />
                        )}
                        {template.isCustom && (
                          <Chip label="Custom" size="small" color="secondary" />
                        )}
                      </Box>
                    )}

                    {/* Stats */}
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 2 }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                        <Star sx={{ fontSize: 16, color: theme.palette.warning.main }} />
                        <Typography variant="caption">
                          {template.rating}
                        </Typography>
                      </Box>
                      <Typography variant="caption" color="textSecondary">
                        {template.downloads.toLocaleString()} downloads
                      </Typography>
                    </Box>
                  </CardContent>

                  {/* Card Actions */}
                  <CardActions sx={{ pt: 0 }}>
                    <Button
                      size="small"
                      startIcon={<Preview />}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleTemplateClick(template);
                      }}
                    >
                      Preview
                    </Button>
                    <Button
                      size="small"
                      startIcon={<Copy />}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleCopyTemplate(template);
                      }}
                    >
                      Use
                    </Button>
                    <IconButton
                      size="small"
                      onClick={(e) => {
                        e.stopPropagation();
                        // Share functionality
                      }}
                    >
                      <Share />
                    </IconButton>
                  </CardActions>
                </Card>
              </Grid>
            );
          })}
        </Grid>

        {filteredTemplates.length === 0 && (
          <Box sx={{ textAlign: 'center', py: 8 }}>
            <Typography variant="h6" color="textSecondary" gutterBottom>
              No templates found
            </Typography>
            <Typography variant="body2" color="textSecondary">
              Try adjusting your search or filters
            </Typography>
          </Box>
        )}
      </Box>

      {/* Template Preview Dialog */}
      <Dialog
        open={previewOpen}
        onClose={() => setPreviewOpen(false)}
        maxWidth="md"
        fullWidth
        PaperProps={{
          sx: { height: '80vh', display: 'flex', flexDirection: 'column' },
        }}
      >
        {selectedTemplate && (
          <>
            <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <Avatar
                sx={{
                  backgroundColor: alpha(theme.palette.primary.main, 0.1),
                  color: theme.palette.primary.main,
                }}
              >
                {React.createElement(getCategoryIcon(selectedTemplate.category))}
              </Avatar>
              <Box sx={{ flex: 1 }}>
                <Typography variant="h6">{selectedTemplate.name}</Typography>
                <Typography variant="body2" color="textSecondary">
                  by {selectedTemplate.author}
                </Typography>
              </Box>
              <Chip
                label={selectedTemplate.difficulty}
                color={getDifficultyColor(selectedTemplate.difficulty) as any}
                size="small"
              />
            </DialogTitle>

            <DialogContent sx={{ flex: 1, overflow: 'auto' }}>
              <Typography variant="body1" paragraph>
                {selectedTemplate.description}
              </Typography>

              <Divider sx={{ my: 2 }} />

              {/* Template Details */}
              <Grid container spacing={2}>
                <Grid item xs={6}>
                  <Typography variant="subtitle2" gutterBottom>
                    Category
                  </Typography>
                  <Typography variant="body2">
                    {selectedTemplate.category}
                  </Typography>
                </Grid>
                <Grid item xs={6}>
                  <Typography variant="subtitle2" gutterBottom>
                    Estimated Time
                  </Typography>
                  <Typography variant="body2">
                    {selectedTemplate.estimatedTime}
                  </Typography>
                </Grid>
                <Grid item xs={6}>
                  <Typography variant="subtitle2" gutterBottom>
                    Rating
                  </Typography>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                    <Star sx={{ fontSize: 16, color: theme.palette.warning.main }} />
                    <Typography variant="body2">
                      {selectedTemplate.rating}
                    </Typography>
                  </Box>
                </Grid>
                <Grid item xs={6}>
                  <Typography variant="subtitle2" gutterBottom>
                    Downloads
                  </Typography>
                  <Typography variant="body2">
                    {selectedTemplate.downloads.toLocaleString()}
                  </Typography>
                </Grid>
              </Grid>

              {selectedTemplate.tags.length > 0 && (
                <>
                  <Typography variant="subtitle2" sx={{ mt: 2, mb: 1 }}>
                    Tags
                  </Typography>
                  <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
                    {selectedTemplate.tags.map((tag) => (
                      <Chip key={tag} label={tag} size="small" variant="outlined" />
                    ))}
                  </Box>
                </>
              )}

              {selectedTemplate.documentation && (
                <>
                  <Typography variant="subtitle2" sx={{ mt: 3, mb: 1 }}>
                    Documentation
                  </Typography>
                  <Typography variant="body2" component="pre" sx={{
                    backgroundColor: alpha(theme.palette.background.default, 0.5),
                    p: 2,
                    borderRadius: 1,
                    overflow: 'auto',
                    maxHeight: '200px',
                  }}>
                    {selectedTemplate.documentation}
                  </Typography>
                </>
              )}
            </DialogContent>

            <DialogActions sx={{ p: 3 }}>
              <Button onClick={() => setPreviewOpen(false)}>
                Close
              </Button>
              <Button
                variant="outlined"
                startIcon={<Copy />}
                onClick={() => handleCopyTemplate(selectedTemplate)}
              >
                Copy to Editor
              </Button>
              <Button
                variant="contained"
                startIcon={<Add />}
                onClick={() => handleInstallTemplate(selectedTemplate)}
              >
                Install Template
              </Button>
            </DialogActions>
          </>
        )}
      </Dialog>
    </Box>
  );
};

export default WorkflowTemplates;