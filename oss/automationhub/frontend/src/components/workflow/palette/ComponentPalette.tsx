/**
 * Component Palette for Workflow Designer
 *
 * Provides a searchable, categorized library of workflow components
 * that can be dragged into the workflow canvas.
 */

import React, { useState, useMemo, useCallback } from 'react';
import {
  Box,
  Paper,
  Typography,
  TextField,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Chip,
  IconButton,
  Tooltip,
  Grid,
  Card,
  CardContent,
  useTheme,
  alpha,
  InputAdornment,
} from '@mui/material';
import {
  Search,
  ExpandMore,
  DragIndicator,
  Info,
  Add,
  Star,
  Category,
  PlayArrow,
  Computer,
  Memory,
  Http,
  Email,
  CallSplit,
  Timer,
  Input,
  Output,
  Transform,
  Settings,
} from '@mui/icons-material';

import { NodeCategory, WorkflowNodeConfig, WORKFLOW_NODE_TYPES } from '../types/NodeTypes';

// Icon mapping for node types
const ICON_MAP: Record<string, React.ElementType> = {
  'PlayArrow': PlayArrow,
  'Http': Http,
  'Computer': Computer,
  'Memory': Memory,
  'Email': Email,
  'CallSplit': CallSplit,
  'Timer': Timer,
  'Input': Input,
  'Output': Output,
  'Transform': Transform,
  'Schedule': Timer,
  'Computer': Computer,
  'Settings': Settings,
};

interface ComponentPaletteProps {
  onNodeSelect?: (nodeType: string) => void;
  onNodeAdd?: (nodeType: string, position: { x: number; y: number }) => void;
  favoriteNodes?: string[];
  recentlyUsed?: string[];
  categories?: NodeCategory[];
  expandedCategories?: string[];
}

const ComponentPalette: React.FC<ComponentPaletteProps> = ({
  onNodeSelect,
  onNodeAdd,
  favoriteNodes = [],
  recentlyUsed = [],
  categories = Object.values(NodeCategory),
  expandedCategories = [NodeCategory.TRIGGER, NodeCategory.AGENT],
}) => {
  const theme = useTheme();
  const [searchTerm, setSearchTerm] = useState('');
  const [expanded, setExpanded] = useState<string[]>(expandedCategories);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  // Group nodes by category
  const nodesByCategory = useMemo(() => {
    const grouped: Record<NodeCategory, WorkflowNodeConfig[]> = {
      [NodeCategory.TRIGGER]: [],
      [NodeCategory.AGENT]: [],
      [NodeCategory.ACTION]: [],
      [NodeCategory.CONTROL]: [],
      [NodeCategory.DATA]: [],
      [NodeCategory.INTEGRATION]: [],
      [NodeCategory.UTILITY]: [],
    };

    Object.values(WORKFLOW_NODE_TYPES).forEach(node => {
      if (categories.includes(node.category)) {
        grouped[node.category].push(node);
      }
    });

    // Sort nodes within each category (favorites first)
    Object.keys(grouped).forEach(category => {
      grouped[category as NodeCategory].sort((a, b) => {
        const aFav = favoriteNodes.includes(a.id);
        const bFav = favoriteNodes.includes(b.id);
        if (aFav && !bFav) return -1;
        if (!aFav && bFav) return 1;
        return a.label.localeCompare(b.label);
      });
    });

    return grouped;
  }, [categories, favoriteNodes]);

  // Filter nodes based on search
  const filteredNodesByCategory = useMemo(() => {
    if (!searchTerm.trim()) {
      return nodesByCategory;
    }

    const filtered: Record<NodeCategory, WorkflowNodeConfig[]> = {
      [NodeCategory.TRIGGER]: [],
      [NodeCategory.AGENT]: [],
      [NodeCategory.ACTION]: [],
      [NodeCategory.CONTROL]: [],
      [NodeCategory.DATA]: [],
      [NodeCategory.INTEGRATION]: [],
      [NodeCategory.UTILITY]: [],
    };

    const lowerSearchTerm = searchTerm.toLowerCase();

    Object.entries(nodesByCategory).forEach(([category, nodes]) => {
      filtered[category as NodeCategory] = nodes.filter(node =>
        node.label.toLowerCase().includes(lowerSearchTerm) ||
        node.description.toLowerCase().includes(lowerSearchTerm) ||
        node.type.toLowerCase().includes(lowerSearchTerm)
      );
    });

    return filtered;
  }, [nodesByCategory, searchTerm]);

  // Category metadata
  const categoryMetadata: Record<NodeCategory, { label: string; icon: React.ElementType; color: string }> = {
    [NodeCategory.TRIGGER]: { label: 'Triggers', icon: PlayArrow, color: theme.palette.success.main },
    [NodeCategory.AGENT]: { label: 'AI Agents', icon: Computer, color: theme.palette.primary.main },
    [NodeCategory.ACTION]: { label: 'Actions', icon: Http, color: theme.palette.error.main },
    [NodeCategory.CONTROL]: { label: 'Control Flow', icon: CallSplit, color: theme.palette.warning.main },
    [NodeCategory.DATA]: { label: 'Data', icon: Memory, color: theme.palette.info.main },
    [NodeCategory.INTEGRATION]: { label: 'Integrations', icon: Settings, color: theme.palette.secondary.main },
    [NodeCategory.UTILITY]: { label: 'Utilities', icon: Transform, color: theme.palette.grey[600] },
  };

  // Handle node selection
  const handleNodeSelect = useCallback((nodeType: string, event?: React.MouseEvent) => {
    onNodeSelect?.(nodeType);

    if (event?.shiftKey && onNodeAdd) {
      // Add node at default position when Shift+Click
      onNodeAdd(nodeType, { x: 250, y: 150 });
    }
  }, [onNodeSelect, onNodeAdd]);

  // Handle drag start
  const handleDragStart = useCallback((event: React.DragEvent, nodeType: string) => {
    event.dataTransfer.setData('application/reactflow', nodeType);
    event.dataTransfer.effectAllowed = 'move';
  }, []);

  // Handle accordion change
  const handleAccordionChange = useCallback((category: string) => (event: React.SyntheticEvent, isExpanded: boolean) => {
    setExpanded(prev => {
      if (isExpanded) {
        return [...prev, category];
      } else {
        return prev.filter(c => c !== category);
      }
    });
  }, []);

  // Render node card
  const renderNodeCard = useCallback((node: WorkflowNodeConfig) => {
    const Icon = ICON_MAP[node.icon] || Settings;
    const isFavorite = favoriteNodes.includes(node.id);
    const isRecentlyUsed = recentlyUsed.includes(node.id);

    return (
      <Card
        key={node.id}
        sx={{
          cursor: 'pointer',
          transition: 'all 0.2s ease-in-out',
          border: `1px solid ${alpha(theme.palette.divider, 0.8)}`,
          '&:hover': {
            transform: 'translateY(-2px)',
            boxShadow: theme.shadows[4],
            borderColor: theme.palette.primary.main,
          },
          position: 'relative',
        }}
        onClick={() => handleNodeSelect(node.id)}
        draggable
        onDragStart={(event) => handleDragStart(event, node.id)}
      >
        {/* Favorite indicator */}
        {isFavorite && (
          <Star
            sx={{
              position: 'absolute',
              top: 4,
              right: 4,
              fontSize: 16,
              color: theme.palette.warning.main,
              zIndex: 1,
            }}
          />
        )}

        {/* Recently used indicator */}
        {isRecentlyUsed && !isFavorite && (
          <Chip
            label="Recent"
            size="small"
            sx={{
              position: 'absolute',
              top: 4,
              right: 4,
              fontSize: '9px',
              height: 16,
              zIndex: 1,
            }}
          />
        )}

        <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
            <DragIndicator sx={{ fontSize: 16, color: theme.palette.text.secondary }} />
            <Box
              sx={{
                width: 24,
                height: 24,
                borderRadius: '50%',
                backgroundColor: node.color,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'white',
              }}
            >
              <Icon sx={{ fontSize: 14 }} />
            </Box>
            <Typography variant="subtitle2" sx={{ fontWeight: 600, flex: 1 }}>
              {node.label}
            </Typography>
          </Box>

          <Typography
            variant="caption"
            color="textSecondary"
            sx={{
              display: 'block',
              lineHeight: 1.3,
              mb: 1,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              display: '-webkit-box',
              WebkitLineClamp: 2,
              WebkitBoxOrient: 'vertical',
            }}
          >
            {node.description}
          </Typography>

          <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
            <Chip
              label={`${node.inputs.length} inputs`}
              size="small"
              sx={{ fontSize: '9px', height: 18 }}
            />
            <Chip
              label={`${node.outputs.length} outputs`}
              size="small"
              sx={{ fontSize: '9px', height: 18 }}
            />
          </Box>

          <Box sx={{ mt: 1, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <IconButton
              size="small"
              onClick={(e) => {
                e.stopPropagation();
                // Toggle favorite (would update state/store)
              }}
              sx={{ p: 0.5 }}
            >
              <Star
                sx={{
                  fontSize: 16,
                  color: isFavorite ? theme.palette.warning.main : theme.palette.action.disabled,
                }}
              />
            </IconButton>
            <Tooltip title="Quick Add (Shift+Click)">
              <IconButton
                size="small"
                onClick={(e) => handleNodeSelect(node.id, e)}
                sx={{ p: 0.5 }}
              >
                <Add sx={{ fontSize: 16 }} />
              </IconButton>
            </Tooltip>
          </Box>
        </CardContent>
      </Card>
    );
  }, [favoriteNodes, recentlyUsed, handleNodeSelect, handleDragStart, theme]);

  return (
    <Paper
      sx={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        borderRight: 1,
        borderColor: 'divider',
        backgroundColor: theme.palette.background.paper,
      }}
    >
      {/* Header */}
      <Box sx={{ p: 2, borderBottom: 1, borderColor: 'divider' }}>
        <Typography variant="h6" sx={{ mb: 2, fontWeight: 600 }}>
          Components
        </Typography>

        {/* Search */}
        <TextField
          fullWidth
          size="small"
          placeholder="Search components..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <Search fontSize="small" />
              </InputAdornment>
            ),
          }}
          sx={{ mb: 2 }}
        />

        {/* Category filters */}
        <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
          {Object.entries(categoryMetadata).map(([category, meta]) => {
            const Icon = meta.icon;
            const hasNodes = filteredNodesByCategory[category as NodeCategory].length > 0;

            return (
              <Chip
                key={category}
                icon={<Icon sx={{ fontSize: 14 }} />}
                label={meta.label}
                size="small"
                onClick={() => setSelectedCategory(selectedCategory === category ? null : category)}
                sx={{
                  backgroundColor: selectedCategory === category ? alpha(meta.color, 0.1) : 'transparent',
                  color: selectedCategory === category ? meta.color : 'inherit',
                  border: selectedCategory === category ? `1px solid ${meta.color}` : '1px solid transparent',
                  opacity: hasNodes ? 1 : 0.5,
                  cursor: hasNodes ? 'pointer' : 'not-allowed',
                }}
              />
            );
          })}
        </Box>
      </Box>

      {/* Node List */}
      <Box sx={{ flex: 1, overflow: 'auto', p: 2 }}>
        {Object.entries(filteredNodesByCategory).map(([category, nodes]) => {
          if (nodes.length === 0) return null;
          if (selectedCategory && selectedCategory !== category) return null;

          const meta = categoryMetadata[category as NodeCategory];
          const Icon = meta.icon;

          return (
            <Accordion
              key={category}
              expanded={expanded.includes(category)}
              onChange={handleAccordionChange(category)}
              sx={{
                mb: 1,
                '&::before': { display: 'none' },
                boxShadow: 'none',
                border: `1px solid ${alpha(theme.palette.divider, 0.8)}`,
              }}
            >
              <AccordionSummary
                expandIcon={<ExpandMore />}
                sx={{
                  backgroundColor: alpha(meta.color, 0.05),
                  '&:hover': {
                    backgroundColor: alpha(meta.color, 0.1),
                  },
                }}
              >
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Box
                    sx={{
                      width: 20,
                      height: 20,
                      borderRadius: '50%',
                      backgroundColor: meta.color,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: 'white',
                    }}
                  >
                    <Icon sx={{ fontSize: 12 }} />
                  </Box>
                  <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                    {meta.label}
                  </Typography>
                  <Chip
                    label={nodes.length}
                    size="small"
                    sx={{ fontSize: '9px', height: 16, ml: 'auto' }}
                  />
                </Box>
              </AccordionSummary>
              <AccordionDetails sx={{ p: 2, pt: 0 }}>
                <Grid container spacing={1}>
                  {nodes.map(renderNodeCard)}
                </Grid>
              </AccordionDetails>
            </Accordion>
          );
        })}

        {/* No results */}
        {searchTerm && Object.values(filteredNodesByCategory).every(nodes => nodes.length === 0) && (
          <Box sx={{ textAlign: 'center', py: 4 }}>
            <Typography color="textSecondary" variant="body2">
              No components found matching "{searchTerm}"
            </Typography>
          </Box>
        )}
      </Box>

      {/* Footer */}
      <Box sx={{ p: 2, borderTop: 1, borderColor: 'divider' }}>
        <Typography variant="caption" color="textSecondary">
          Drag components to canvas or Shift+Click to add
        </Typography>
      </Box>
    </Paper>
  );
};

export default ComponentPalette;