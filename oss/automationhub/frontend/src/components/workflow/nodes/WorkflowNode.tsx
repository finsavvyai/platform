/**
 * Enhanced Workflow Node Component
 *
 * A comprehensive workflow node component with advanced features including:
 * - Dynamic rendering based on node type
 * - Real-time status updates
 * - Configuration validation
 * - Keyboard shortcuts
 * - Accessibility support
 */

import React, { memo, useCallback, useMemo, useState, useEffect } from 'react';
import {
  Handle,
  Position,
  NodeProps,
  useReactFlow,
  useStoreApi,
} from 'reactflow';
import {
  Paper,
  Box,
  Typography,
  IconButton,
  Menu,
  MenuItem,
  Tooltip,
  Chip,
  LinearProgress,
  Alert,
  Collapse,
  useTheme,
} from '@mui/material';
import {
  MoreVert,
  Settings,
  Delete,
  PlayArrow,
  Pause,
  Stop,
  Error,
  CheckCircle,
  Warning,
  Info,
  Copy,
  ContentCut,
  ContentPaste,
} from '@mui/icons-material';
import { WorkflowNodeConfig, validateNodeConfig } from '../types/NodeTypes';

// Node status types
export enum NodeStatus {
  IDLE = 'idle',
  RUNNING = 'running',
  SUCCESS = 'success',
  ERROR = 'error',
  WARNING = 'warning',
  DISABLED = 'disabled',
}

// Extended node data interface
interface ExtendedNodeData extends Record<string, any> {
  nodeType: string;
  label: string;
  status: NodeStatus;
  config: Record<string, any>;
  lastResult?: any;
  lastError?: string;
  executionTime?: number;
  progress?: number;
  isBreakpoint?: boolean;
  isDisabled?: boolean;
  metadata?: Record<string, any>;
}

interface WorkflowNodeComponentProps extends NodeProps<ExtendedNodeData> {
  onConfigChange?: (nodeId: string, config: Record<string, any>) => void;
  onStatusChange?: (nodeId: string, status: NodeStatus) => void;
  onDelete?: (nodeId: string) => void;
  onDuplicate?: (nodeId: string) => void;
  onExecute?: (nodeId: string) => void;
  onDebug?: (nodeId: string) => void;
  onToggleBreakpoint?: (nodeId: string) => void;
  onToggleDisabled?: (nodeId: string) => void;
}

const WorkflowNodeComponent: React.FC<WorkflowNodeComponentProps> = ({
  id,
  data,
  selected,
  onConfigChange,
  onStatusChange,
  onDelete,
  onDuplicate,
  onExecute,
  onDebug,
  onToggleBreakpoint,
  onToggleDisabled,
}) => {
  const theme = useTheme();
  const { setNodes } = useReactFlow();
  const store = useStoreApi();
  const [menuAnchor, setMenuAnchor] = useState<null | HTMLElement>(null);
  const [showDetails, setShowDetails] = useState(false);

  // Get node type configuration
  const nodeTypeConfig = useMemo(() => {
    // This would normally come from a registry or context
    const nodeTypes = import('../types/NodeTypes');
    return (nodeTypes as any).WORKFLOW_NODE_TYPES[data.nodeType] as WorkflowNodeConfig;
  }, [data.nodeType]);

  // Validate configuration
  const validationResult = useMemo(() => {
    if (!nodeTypeConfig || !data.config) {
      return { isValid: true, errors: [] };
    }
    return validateNodeConfig(data.nodeType, data.config);
  }, [nodeTypeConfig, data.config]);

  // Status color mapping
  const getStatusColor = useCallback((status: NodeStatus) => {
    switch (status) {
      case NodeStatus.RUNNING:
        return theme.palette.primary.main;
      case NodeStatus.SUCCESS:
        return theme.palette.success.main;
      case NodeStatus.ERROR:
        return theme.palette.error.main;
      case NodeStatus.WARNING:
        return theme.palette.warning.main;
      case NodeStatus.DISABLED:
        return theme.palette.grey[500];
      default:
        return theme.palette.grey[600];
    }
  }, [theme]);

  // Status icon mapping
  const getStatusIcon = useCallback((status: NodeStatus) => {
    switch (status) {
      case NodeStatus.RUNNING:
        return <PlayArrow fontSize="small" />;
      case NodeStatus.SUCCESS:
        return <CheckCircle fontSize="small" />;
      case NodeStatus.ERROR:
        return <Error fontSize="small" />;
      case NodeStatus.WARNING:
        return <Warning fontSize="small" />;
      default:
        return <Info fontSize="small" />;
    }
  }, []);

  // Handle menu actions
  const handleMenuAction = useCallback((action: string) => {
    setMenuAnchor(null);

    switch (action) {
      case 'configure':
        // Trigger configuration dialog
        onConfigChange?.(id, data.config);
        break;
      case 'delete':
        onDelete?.(id);
        break;
      case 'duplicate':
        onDuplicate?.(id);
        break;
      case 'execute':
        onExecute?.(id);
        break;
      case 'debug':
        onDebug?.(id);
        break;
      case 'breakpoint':
        onToggleBreakpoint?.(id);
        break;
      case 'disable':
        onToggleDisabled?.(id);
        break;
      case 'copy':
        navigator.clipboard.writeText(JSON.stringify(data.config, null, 2));
        break;
      case 'paste':
        navigator.clipboard.readText().then(text => {
          try {
            const config = JSON.parse(text);
            onConfigChange?.(id, config);
          } catch (e) {
            console.error('Failed to paste configuration:', e);
          }
        });
        break;
    }
  }, [id, data, onConfigChange, onDelete, onDuplicate, onExecute, onDebug, onToggleBreakpoint, onToggleDisabled]);

  // Handle node data updates
  const handleNodeUpdate = useCallback((updates: Partial<ExtendedNodeData>) => {
    setNodes((nodes) =>
      nodes.map((node) =>
        node.id === id
          ? { ...node, data: { ...node.data, ...updates } }
          : node
      )
    );
  }, [id, setNodes]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (!selected) return;

      // Ctrl/Cmd + Enter: Execute node
      if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') {
        event.preventDefault();
        onExecute?.(id);
      }

      // Ctrl/Cmd + D: Duplicate node
      if ((event.ctrlKey || event.metaKey) && event.key === 'd') {
        event.preventDefault();
        onDuplicate?.(id);
      }

      // Delete: Remove node
      if (event.key === 'Delete') {
        event.preventDefault();
        onDelete?.(id);
      }

      // F9: Toggle breakpoint
      if (event.key === 'F9') {
        event.preventDefault();
        onToggleBreakpoint?.(id);
      }

      // Space: Toggle disabled
      if (event.key === ' ' && !event.target || (event.target as HTMLElement).tagName !== 'INPUT') {
        event.preventDefault();
        onToggleDisabled?.(id);
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [selected, id, onExecute, onDuplicate, onDelete, onToggleBreakpoint, onToggleDisabled]);

  // Auto-hide progress bar when complete
  useEffect(() => {
    if (data.progress === 100) {
      const timer = setTimeout(() => {
        handleNodeUpdate({ progress: undefined });
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [data.progress, handleNodeUpdate]);

  if (!nodeTypeConfig) {
    return (
      <Alert severity="error">
        Unknown node type: {data.nodeType}
      </Alert>
    );
  }

  const Icon = nodeTypeConfig.icon;

  return (
    <>
      {/* Input Handles */}
      {nodeTypeConfig.inputs.map((input) => (
        <Handle
          key={input.id}
          type="target"
          position={Position.Top}
          id={input.id}
          title={`${input.name}${input.required ? ' (Required)' : ''}`}
          style={{
            background: input.required ? theme.palette.error.main : theme.palette.grey[500],
            width: input.required ? 12 : 8,
            height: input.required ? 12 : 8,
          }}
        />
      ))}

      {/* Main Node Content */}
      <Paper
        sx={{
          p: 2,
          minWidth: 200,
          maxWidth: 300,
          border: selected ? `2px solid ${theme.palette.primary.main}` : '1px solid #ddd',
          backgroundColor: data.isDisabled
            ? theme.palette.grey[100]
            : nodeTypeConfig.backgroundColor,
          borderRadius: 2,
          opacity: data.isDisabled ? 0.6 : 1,
          position: 'relative',
          transition: 'all 0.2s ease-in-out',
          '&:hover': {
            boxShadow: theme.shadows[4],
            transform: 'translateY(-1px)',
          },
        }}
        elevation={selected ? 8 : 2}
      >
        {/* Status Indicator */}
        <Box
          sx={{
            position: 'absolute',
            top: 4,
            right: 4,
            display: 'flex',
            alignItems: 'center',
            gap: 0.5,
          }}
        >
          {/* Breakpoint Indicator */}
          {data.isBreakpoint && (
            <Tooltip title="Breakpoint (Press F9 to toggle)">
              <Box
                sx={{
                  width: 8,
                  height: 8,
                  borderRadius: '50%',
                  backgroundColor: theme.palette.error.main,
                }}
              />
            </Tooltip>
          )}

          {/* Status Icon */}
          <Tooltip title={`Status: ${data.status}`}>
            <Box
              sx={{
                color: getStatusColor(data.status),
                display: 'flex',
                alignItems: 'center',
              }}
            >
              {getStatusIcon(data.status)}
            </Box>
          </Tooltip>

          {/* Context Menu */}
          <IconButton
            size="small"
            onClick={(e) => setMenuAnchor(e.currentTarget)}
            sx={{ p: 0.5 }}
          >
            <MoreVert fontSize="small" />
          </IconButton>
        </Box>

        {/* Progress Bar */}
        {data.progress !== undefined && data.progress > 0 && (
          <Box sx={{ mb: 1 }}>
            <LinearProgress
              variant="determinate"
              value={data.progress}
              sx={{
                height: 4,
                borderRadius: 2,
                backgroundColor: theme.palette.grey[200],
              }}
            />
          </Box>
        )}

        {/* Node Header */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
          <Box
            sx={{
              width: 24,
              height: 24,
              borderRadius: '50%',
              backgroundColor: nodeTypeConfig.color,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'white',
            }}
          >
            <Icon sx={{ fontSize: 14 }} />
          </Box>
          <Typography
            variant="subtitle2"
            sx={{
              fontWeight: 600,
              color: data.isDisabled ? theme.palette.text.secondary : 'inherit',
            }}
          >
            {data.label}
          </Typography>
        </Box>

        {/* Node Type */}
        <Chip
          label={nodeTypeConfig.label}
          size="small"
          sx={{
            mb: 1,
            backgroundColor: nodeTypeConfig.color,
            color: 'white',
            fontWeight: 500,
          }}
        />

        {/* Node Description */}
        {nodeTypeConfig.description && (
          <Typography
            variant="caption"
            color="textSecondary"
            sx={{
              display: 'block',
              mb: 1,
              lineHeight: 1.2,
            }}
          >
            {nodeTypeConfig.description}
          </Typography>
        )}

        {/* Configuration Validation Errors */}
        {!validationResult.isValid && (
          <Alert severity="error" sx={{ mb: 1 }}>
            {validationResult.errors[0]}
          </Alert>
        )}

        {/* Execution Results */}
        {data.lastResult && (
          <Collapse in={showDetails}>
            <Alert severity="success" sx={{ mb: 1 }}>
              <Typography variant="caption">
                Execution successful
                {data.executionTime && ` (${data.executionTime}ms)`}
              </Typography>
              {typeof data.lastResult === 'object' && (
                <pre
                  style={{
                    fontSize: '11px',
                    margin: '4px 0 0 0',
                    maxHeight: '100px',
                    overflow: 'auto',
                  }}
                >
                  {JSON.stringify(data.lastResult, null, 2)}
                </pre>
              )}
            </Alert>
          </Collapse>
        )}

        {/* Execution Errors */}
        {data.lastError && (
          <Collapse in={showDetails}>
            <Alert severity="error" sx={{ mb: 1 }}>
              <Typography variant="caption">
                {data.lastError}
              </Typography>
            </Alert>
          </Collapse>
        )}

        {/* Expand/Collapse Details */}
        {(data.lastResult || data.lastError) && (
          <Box sx={{ textAlign: 'center' }}>
            <IconButton
              size="small"
              onClick={() => setShowDetails(!showDetails)}
              sx={{ p: 0.5 }}
            >
              {showDetails ? '▲' : '▼'}
            </IconButton>
          </Box>
        )}
      </Paper>

      {/* Output Handles */}
      {nodeTypeConfig.outputs.map((output) => (
        <Handle
          key={output.id}
          type="source"
          position={Position.Bottom}
          id={output.id}
          title={output.name}
          style={{
            background: output.type === 'error'
              ? theme.palette.error.main
              : output.type === 'condition'
              ? theme.palette.warning.main
              : theme.palette.success.main,
            width: 10,
            height: 10,
          }}
        />
      ))}

      {/* Context Menu */}
      <Menu
        anchorEl={menuAnchor}
        open={Boolean(menuAnchor)}
        onClose={() => setMenuAnchor(null)}
      >
        <MenuItem onClick={() => handleMenuAction('configure')}>
          <Settings sx={{ mr: 1 }} fontSize="small" />
          Configure
        </MenuItem>
        <MenuItem onClick={() => handleMenuAction('execute')}>
          <PlayArrow sx={{ mr: 1 }} fontSize="small" />
          Execute
        </MenuItem>
        <MenuItem onClick={() => handleMenuAction('debug')}>
          <Info sx={{ mr: 1 }} fontSize="small" />
          Debug
        </MenuItem>
        <MenuItem onClick={() => handleMenuAction('duplicate')}>
          <Copy sx={{ mr: 1 }} fontSize="small" />
          Duplicate
        </MenuItem>
        <MenuItem onClick={() => handleMenuAction('breakpoint')}>
          <Error sx={{ mr: 1 }} fontSize="small" />
          {data.isBreakpoint ? 'Remove Breakpoint' : 'Set Breakpoint'}
        </MenuItem>
        <MenuItem onClick={() => handleMenuAction('disable')}>
          <Pause sx={{ mr: 1 }} fontSize="small" />
          {data.isDisabled ? 'Enable' : 'Disable'}
        </MenuItem>
        <MenuItem onClick={() => handleMenuAction('copy')}>
          <ContentCopy sx={{ mr: 1 }} fontSize="small" />
          Copy Config
        </MenuItem>
        <MenuItem onClick={() => handleMenuAction('paste')}>
          <ContentPaste sx={{ mr: 1 }} fontSize="small" />
          Paste Config
        </MenuItem>
        <MenuItem onClick={() => handleMenuAction('delete')} sx={{ color: theme.palette.error.main }}>
          <Delete sx={{ mr: 1 }} fontSize="small" />
          Delete
        </MenuItem>
      </Menu>
    </>
  );
};

export default memo(WorkflowNodeComponent);