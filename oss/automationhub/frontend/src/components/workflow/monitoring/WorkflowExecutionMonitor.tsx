/**
 * Workflow Execution Monitor
 *
 * Real-time workflow execution monitoring with:
 * - Live status updates via WebSocket
 * - Node execution progress tracking
 * - Error reporting and debugging
 * - Performance metrics visualization
 * - Resource usage monitoring
 */

import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import {
  Box,
  Paper,
  Typography,
  Card,
  CardContent,
  LinearProgress,
  Chip,
  Alert,
  IconButton,
  Tooltip,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Grid,
  useTheme,
  alpha,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Badge,
  Switch,
  FormControlLabel,
  Divider,
  Timeline,
  TimelineItem,
  TimelineSeparator,
  TimelineConnector,
  TimelineContent,
  TimelineDot,
} from '@mui/material';
import {
  PlayArrow,
  Pause,
  Stop,
  Refresh,
  Error,
  CheckCircle,
  Warning,
  Info,
  Timer,
  Memory,
  Speed,
  Visibility,
  VisibilityOff,
  Settings,
  Fullscreen,
  FullscreenExit,
  Download,
  Share,
  ExpandMore,
  ExpandLess,
  FilterList,
  Close,
} from '@mui/icons-material';
import { io, Socket } from 'socket.io-client';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
  AreaChart,
  Area,
} from 'recharts';

import { NodeStatus } from '../nodes/WorkflowNode';

interface ExecutionNode {
  id: string;
  name: string;
  status: NodeStatus;
  startTime?: string;
  endTime?: string;
  duration?: number;
  progress?: number;
  result?: any;
  error?: string;
  resources?: {
    cpu?: number;
    memory?: number;
  };
}

interface ExecutionEvent {
  id: string;
  timestamp: string;
  type: 'node_start' | 'node_complete' | 'node_error' | 'execution_start' | 'execution_complete' | 'resource_update';
  nodeId?: string;
  nodeName?: string;
  data: any;
}

interface WorkflowExecutionMonitorProps {
  executionId: string;
  workflowId?: string;
  onClose?: () => void;
  onNodeSelect?: (nodeId: string) => void;
  autoRefresh?: boolean;
  showResources?: boolean;
  showTimeline?: boolean;
  compact?: boolean;
}

interface PerformanceData {
  timestamp: string;
  cpu: number;
  memory: number;
  duration: number;
  nodesActive: number;
}

const WorkflowExecutionMonitor: React.FC<WorkflowExecutionMonitorProps> = ({
  executionId,
  workflowId,
  onClose,
  onNodeSelect,
  autoRefresh = true,
  showResources = true,
  showTimeline = true,
  compact = false,
}) => {
  const theme = useTheme();
  const socketRef = useRef<Socket | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<'disconnected' | 'connecting' | 'connected'>('disconnected');

  // Execution state
  const [executionStatus, setExecutionStatus] = useState<'idle' | 'running' | 'completed' | 'failed' | 'paused' | 'cancelled'>('idle');
  const [progress, setProgress] = useState(0);
  const [startTime, setStartTime] = useState<string | null>(null);
  const [endTime, setEndTime] = useState<string | null>(null);
  const [duration, setDuration] = useState(0);

  // Nodes state
  const [nodes, setNodes] = useState<Map<string, ExecutionNode>>(new Map());
  const [selectedNode, setSelectedNode] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState<NodeStatus | 'all'>('all');

  // Events and timeline
  const [events, setEvents] = useState<ExecutionEvent[]>([]);
  const [performanceData, setPerformanceData] = useState<PerformanceData[]>([]);

  // UI state
  const [showDetails, setShowDetails] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [autoScroll, setAutoScroll] = useState(true);
  const eventListRef = useRef<HTMLDivElement>(null);

  // Initialize WebSocket connection
  useEffect(() => {
    if (!autoRefresh || !executionId) return;

    const wsUrl = process.env.REACT_APP_WS_URL || 'ws://localhost:8000';
    socketRef.current = io(wsUrl, {
      auth: {
        executionId,
      },
    });

    const socket = socketRef.current;

    socket.on('connect', () => {
      setConnectionStatus('connected');
      console.log('Connected to execution monitor');
    });

    socket.on('disconnect', () => {
      setConnectionStatus('disconnected');
      console.log('Disconnected from execution monitor');
    });

    // Execution status updates
    socket.on('execution_status', (data: any) => {
      setExecutionStatus(data.status);
      setProgress(data.progress || 0);
      setStartTime(data.startTime);
      setEndTime(data.endTime);
      setDuration(data.duration || 0);
    });

    // Node status updates
    socket.on('node_status', (data: any) => {
      setNodes(prev => {
        const newNodes = new Map(prev);
        newNodes.set(data.nodeId, {
          ...newNodes.get(data.nodeId),
          ...data,
        });
        return newNodes;
      });

      // Add to events
      const event: ExecutionEvent = {
        id: `${data.nodeId}_${Date.now()}`,
        timestamp: data.timestamp || new Date().toISOString(),
        type: data.status === 'running' ? 'node_start' :
              data.status === 'completed' ? 'node_complete' : 'node_error',
        nodeId: data.nodeId,
        nodeName: data.name,
        data,
      };
      setEvents(prev => [...prev, event]);
    });

    // Performance updates
    socket.on('performance_update', (data: any) => {
      setPerformanceData(prev => {
        const newData = [...prev, {
          timestamp: data.timestamp || new Date().toISOString(),
          cpu: data.cpu || 0,
          memory: data.memory || 0,
          duration: data.duration || 0,
          nodesActive: data.nodesActive || 0,
        }];
        // Keep only last 100 data points
        return newData.slice(-100);
      });
    });

    // Initial state
    socket.on('initial_state', (data: any) => {
      setExecutionStatus(data.status);
      setProgress(data.progress || 0);
      setStartTime(data.startTime);
      setEndTime(data.endTime);
      setDuration(data.duration || 0);

      if (data.nodes) {
        const nodesMap = new Map<string, ExecutionNode>();
        Object.values(data.nodes).forEach((node: any) => {
          nodesMap.set(node.id, node);
        });
        setNodes(nodesMap);
      }

      if (data.events) {
        setEvents(data.events);
      }
    });

    return () => {
      socket.disconnect();
    };
  }, [autoRefresh, executionId]);

  // Auto-scroll events
  useEffect(() => {
    if (autoScroll && eventListRef.current && events.length > 0) {
      eventListRef.current.scrollTop = eventListRef.current.scrollHeight;
    }
  }, [events, autoScroll]);

  // Calculate statistics
  const statistics = useMemo(() => {
    const nodeArray = Array.from(nodes.values());
    const totalNodes = nodeArray.length;
    const completedNodes = nodeArray.filter(n => n.status === NodeStatus.SUCCESS).length;
    const failedNodes = nodeArray.filter(n => n.status === NodeStatus.ERROR).length;
    const runningNodes = nodeArray.filter(n => n.status === NodeStatus.RUNNING).length;

    return {
      total: totalNodes,
      completed: completedNodes,
      failed: failedNodes,
      running: runningNodes,
      pending: totalNodes - completedNodes - failedNodes - runningNodes,
      successRate: totalNodes > 0 ? (completedNodes / totalNodes) * 100 : 0,
    };
  }, [nodes]);

  // Filter nodes
  const filteredNodes = useMemo(() => {
    if (filterStatus === 'all') {
      return Array.from(nodes.values());
    }
    return Array.from(nodes.values()).filter(node => node.status === filterStatus);
  }, [nodes, filterStatus]);

  // Get status icon and color
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
      default:
        return theme.palette.grey[500];
    }
  }, [theme]);

  // Handle node click
  const handleNodeClick = useCallback((nodeId: string) => {
    setSelectedNode(nodeId === selectedNode ? null : nodeId);
    onNodeSelect?.(nodeId);
  }, [selectedNode, onNodeSelect]);

  // Handle pause/resume
  const handlePauseResume = useCallback(() => {
    // Send pause/resume command via WebSocket
    if (socketRef.current) {
      const action = executionStatus === 'running' ? 'pause' : 'resume';
      socketRef.current.emit('execution_control', {
        action,
        executionId,
      });
    }
  }, [executionStatus, executionId]);

  // Handle stop
  const handleStop = useCallback(() => {
    if (socketRef.current) {
      socketRef.current.emit('execution_control', {
        action: 'stop',
        executionId,
      });
    }
  }, [executionId]);

  // Format duration
  const formatDuration = useCallback((ms: number) => {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);

    if (hours > 0) {
      return `${hours}h ${minutes % 60}m ${seconds % 60}s`;
    } else if (minutes > 0) {
      return `${minutes}m ${seconds % 60}s`;
    } else {
      return `${seconds}s`;
    }
  }, []);

  if (compact) {
    return (
      <Card sx={{ p: 2 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <Badge
              color={executionStatus === 'running' ? 'primary' : executionStatus === 'error' ? 'error' : 'default'}
              variant="dot"
            >
              <Typography variant="subtitle2">
                Execution {executionStatus}
              </Typography>
            </Badge>
            <LinearProgress
              variant="determinate"
              value={progress}
              sx={{ width: 100 }}
            />
            <Typography variant="caption">
              {statistics.completed}/{statistics.total} nodes
            </Typography>
          </Box>

          <Box sx={{ display: 'flex', gap: 1 }}>
            {executionStatus === 'running' && (
              <IconButton size="small" onClick={handlePauseResume}>
                <Pause />
              </IconButton>
            )}
            <IconButton size="small" onClick={() => window.open(`/monitor/${executionId}`, '_blank')}>
              <Fullscreen />
            </IconButton>
          </Box>
        </Box>
      </Card>
    );
  }

  return (
    <Box sx={{ height: '100vh', display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <Paper sx={{ p: 2, borderBottom: 1, borderColor: 'divider' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <Typography variant="h6">
              Execution Monitor
            </Typography>
            <Chip
              label={executionId}
              size="small"
              variant="outlined"
            />
            <Badge
              color={connectionStatus === 'connected' ? 'success' : 'error'}
              variant="dot"
            >
              <Chip
                label={connectionStatus}
                size="small"
                color={connectionStatus === 'connected' ? 'success' : 'default'}
              />
            </Badge>
            <Chip
              label={executionStatus}
              color={
                executionStatus === 'running' ? 'primary' :
                executionStatus === 'completed' ? 'success' :
                executionStatus === 'failed' ? 'error' : 'default'
              }
            />
          </Box>

          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Typography variant="body2" sx={{ minWidth: 80 }}>
              Progress: {Math.round(progress)}%
            </Typography>
            <Typography variant="body2">
              {statistics.completed}/{statistics.total} nodes
            </Typography>
            {startTime && (
              <Typography variant="body2">
                Duration: {formatDuration(duration)}
              </Typography>
            )}
            <Divider orientation="vertical" flexItem />
            {executionStatus === 'running' && (
              <IconButton size="small" onClick={handlePauseResume}>
                <Pause />
              </IconButton>
            )}
            <IconButton size="small" onClick={handleStop}>
              <Stop />
            </IconButton>
            <IconButton size="small" onClick={() => setShowDetails(!showDetails)}>
              {showDetails ? <ExpandLess /> : <ExpandMore />}
            </IconButton>
            <IconButton size="small" onClick={() => setIsFullscreen(!isFullscreen)}>
              {isFullscreen ? <FullscreenExit /> : <Fullscreen />}
            </IconButton>
            {onClose && (
              <IconButton size="small" onClick={onClose}>
                <Close />
              </IconButton>
            )}
          </Box>
        </Box>

        {/* Progress Bar */}
        <Box sx={{ mt: 2 }}>
          <LinearProgress
            variant="determinate"
            value={progress}
            sx={{ height: 8, borderRadius: 4 }}
          />
        </Box>
      </Paper>

      {/* Main Content */}
      {showDetails && (
        <Box sx={{ flex: 1, overflow: 'auto', p: 2 }}>
          <Grid container spacing={2}>
            {/* Statistics */}
            <Grid item xs={12} md={3}>
              <Card>
                <CardContent>
                  <Typography variant="h6" gutterBottom>
                    Statistics
                  </Typography>
                  <List dense>
                    <ListItem>
                      <ListItemText primary="Total Nodes" secondary={statistics.total} />
                    </ListItem>
                    <ListItem>
                      <ListItemText primary="Completed" secondary={statistics.completed} />
                    </ListItem>
                    <ListItem>
                      <ListItemText primary="Failed" secondary={statistics.failed} />
                    </ListItem>
                    <ListItem>
                      <ListItemText primary="Running" secondary={statistics.running} />
                    </ListItem>
                    <ListItem>
                      <ListItemText
                        primary="Success Rate"
                        secondary={`${Math.round(statistics.successRate)}%`}
                      />
                    </ListItem>
                  </List>
                </CardContent>
              </Card>

              {/* Performance Chart */}
              {showResources && performanceData.length > 0 && (
                <Card sx={{ mt: 2 }}>
                  <CardContent>
                    <Typography variant="h6" gutterBottom>
                      Performance
                    </Typography>
                    <ResponsiveContainer width="100%" height={200}>
                      <AreaChart data={performanceData}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis
                          dataKey="timestamp"
                          tickFormatter={(value) => new Date(value).toLocaleTimeString()}
                        />
                        <YAxis />
                        <RechartsTooltip />
                        <Area
                          type="monotone"
                          dataKey="cpu"
                          stackId="1"
                          stroke={theme.palette.primary.main}
                          fill={alpha(theme.palette.primary.main, 0.3)}
                        />
                        <Area
                          type="monotone"
                          dataKey="memory"
                          stackId="1"
                          stroke={theme.palette.secondary.main}
                          fill={alpha(theme.palette.secondary.main, 0.3)}
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>
              )}
            </Grid>

            {/* Node List */}
            <Grid item xs={12} md={4}>
              <Card>
                <CardContent>
                  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
                    <Typography variant="h6">
                      Nodes
                    </Typography>
                    <FormControlLabel
                      control={
                        <Switch
                          size="small"
                          checked={autoScroll}
                          onChange={(e) => setAutoScroll(e.target.checked)}
                        />
                      }
                      label="Auto-scroll"
                    />
                  </Box>

                  {/* Filter */}
                  <Box sx={{ mb: 2, display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                    {['all', NodeStatus.RUNNING, NodeStatus.SUCCESS, NodeStatus.ERROR].map((status) => (
                      <Chip
                        key={status}
                        label={status}
                        size="small"
                        onClick={() => setFilterStatus(status as any)}
                        color={filterStatus === status ? 'primary' : 'default'}
                        clickable
                      />
                    ))}
                  </Box>

                  {/* Nodes */}
                  <Box sx={{ maxHeight: 400, overflow: 'auto' }}>
                    <List dense>
                      {filteredNodes.map((node) => (
                        <ListItem
                          key={node.id}
                          button
                          selected={selectedNode === node.id}
                          onClick={() => handleNodeClick(node.id)}
                          sx={{
                            borderLeft: `4px solid ${getStatusColor(node.status)}`,
                            mb: 1,
                          }}
                        >
                          <ListItemIcon>
                            {getStatusIcon(node.status)}
                          </ListItemIcon>
                          <ListItemText
                            primary={node.name}
                            secondary={
                              node.duration && `Duration: ${formatDuration(node.duration)}`
                            }
                          />
                          {node.progress !== undefined && (
                            <Box sx={{ minWidth: 60 }}>
                              <LinearProgress
                                variant="determinate"
                                value={node.progress}
                                size="small"
                              />
                            </Box>
                          )}
                        </ListItem>
                      ))}
                    </List>
                  </Box>
                </CardContent>
              </Card>
            </Grid>

            {/* Timeline */}
            {showTimeline && (
              <Grid item xs={12} md={5}>
                <Card>
                  <CardContent>
                    <Typography variant="h6" gutterBottom>
                      Event Timeline
                    </Typography>
                    <Box sx={{ maxHeight: 600, overflow: 'auto' }} ref={eventListRef}>
                      <Timeline>
                        {events.slice(-50).map((event, index) => (
                          <TimelineItem key={event.id}>
                            <TimelineSeparator>
                              <TimelineDot
                                color={
                                  event.type === 'node_error' ? 'error' :
                                  event.type === 'node_complete' ? 'success' :
                                  event.type === 'execution_complete' ? 'success' :
                                  'primary'
                                }
                              />
                              {index < events.length - 1 && <TimelineConnector />}
                            </TimelineSeparator>
                            <TimelineContent>
                              <Typography variant="caption" color="textSecondary">
                                {new Date(event.timestamp).toLocaleTimeString()}
                              </Typography>
                              <Typography variant="body2">
                                {event.type === 'node_start' && `Started: ${event.nodeName}`}
                                {event.type === 'node_complete' && `Completed: ${event.nodeName}`}
                                {event.type === 'node_error' && `Error: ${event.nodeName}`}
                                {event.type === 'execution_start' && 'Execution started'}
                                {event.type === 'execution_complete' && 'Execution completed'}
                              </Typography>
                              {event.error && (
                                <Alert severity="error" sx={{ mt: 1 }}>
                                  {event.error}
                                </Alert>
                              )}
                            </TimelineContent>
                          </TimelineItem>
                        ))}
                      </Timeline>
                    </Box>
                  </CardContent>
                </Card>
              </Grid>
            )}
          </Grid>
        </Box>
      )}
    </Box>
  );
};

export default WorkflowExecutionMonitor;