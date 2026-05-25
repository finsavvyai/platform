import React, { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Grid,
  LinearProgress,
  Chip,
  IconButton,
  Paper,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Alert,
  CircularProgress,
  Tooltip,
} from '@mui/material';
import {
  Refresh,
  PlayArrow,
  Pause,
  Stop,
  Error,
  CheckCircle,
  Warning,
  Info,
  Timeline,
  Memory,
  Speed,
  Storage,
  Code,
  SmartToy,
  TaskAlt,
  EventAvailable,
} from '@mui/icons-material';
import { LineChart, Line, AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { io, Socket } from 'socket.io-client';
import { format } from 'date-fns';

// Types
interface SystemMetrics {
  cpu: number;
  memory: number;
  disk: number;
  network: { in: number; out: number };
  timestamp: string;
}

interface WorkflowExecution {
  id: string;
  name: string;
  status: 'running' | 'completed' | 'failed' | 'paused';
  progress: number;
  startTime: string;
  endTime?: string;
  currentStep?: string;
  nodeId?: string;
  errorMessage?: string;
}

interface AgentStatus {
  id: string;
  name: string;
  type: string;
  status: 'idle' | 'busy' | 'offline' | 'error';
  currentTask?: string;
  lastActivity: string;
  tasksCompleted: number;
  errorCount: number;
}

interface LogEntry {
  id: string;
  timestamp: string;
  level: 'info' | 'warning' | 'error' | 'debug';
  source: string;
  message: string;
  metadata?: any;
}

interface MonitoringDashboardProps {
  apiUrl?: string;
}

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8'];

const MonitoringDashboard: React.FC<MonitoringDashboardProps> = ({
  apiUrl = 'http://localhost:8000',
}) => {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [connected, setConnected] = useState(false);
  const [systemMetrics, setSystemMetrics] = useState<SystemMetrics[]>([]);
  const [currentMetrics, setCurrentMetrics] = useState<SystemMetrics | null>(null);
  const [workflowExecutions, setWorkflowExecutions] = useState<WorkflowExecution[]>([]);
  const [agents, setAgents] = useState<AgentStatus[]>([]);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Initialize WebSocket connection
  useEffect(() => {
    const newSocket = io(apiUrl, {
      path: '/ws',
      transports: ['websocket'],
    });

    newSocket.on('connect', () => {
      setConnected(true);
      setError(null);
      console.log('Connected to monitoring WebSocket');
    });

    newSocket.on('disconnect', () => {
      setConnected(false);
      console.log('Disconnected from monitoring WebSocket');
    });

    newSocket.on('system_metrics', (metrics: SystemMetrics) => {
      setCurrentMetrics(metrics);
      setSystemMetrics((prev) => {
        const updated = [...prev, metrics];
        // Keep only last 50 data points
        return updated.slice(-50);
      });
    });

    newSocket.on('workflow_update', (execution: WorkflowExecution) => {
      setWorkflowExecutions((prev) => {
        const existing = prev.find((w) => w.id === execution.id);
        if (existing) {
          return prev.map((w) => (w.id === execution.id ? execution : w));
        } else {
          return [execution, ...prev].slice(0, 20); // Keep last 20 executions
        }
      });
    });

    newSocket.on('agent_status', (agentData: AgentStatus[]) => {
      setAgents(agentData);
    });

    newSocket.on('log_entry', (log: LogEntry) => {
      setLogs((prev) => [log, ...prev].slice(0, 100)); // Keep last 100 logs
    });

    newSocket.on('error', (errorMsg: string) => {
      setError(errorMsg);
    });

    setSocket(newSocket);

    return () => {
      newSocket.close();
    };
  }, [apiUrl]);

  // Fetch initial data
  useEffect(() => {
    const fetchInitialData = async () => {
      try {
        setLoading(true);

        // Fetch initial workflow executions
        const executionsResponse = await fetch(`${apiUrl}/api/v1/workflows/executions?limit=20`);
        if (executionsResponse.ok) {
          const executionsData = await executionsResponse.json();
          setWorkflowExecutions(executionsData.executions || []);
        }

        // Fetch initial agent status
        const agentsResponse = await fetch(`${apiUrl}/api/v1/agents/status`);
        if (agentsResponse.ok) {
          const agentsData = await agentsResponse.json();
          setAgents(agentsData.agents || []);
        }

        // Fetch initial logs
        const logsResponse = await fetch(`${apiUrl}/api/v1/logs?limit=100`);
        if (logsResponse.ok) {
          const logsData = await logsResponse.json();
          setLogs(logsData.logs || []);
        }

      } catch (err) {
        console.error('Failed to fetch initial data:', err);
        setError('Failed to load initial monitoring data');
      } finally {
        setLoading(false);
      }
    };

    fetchInitialData();
  }, [apiUrl]);

  const handleControlWorkflow = useCallback(async (executionId: string, action: 'pause' | 'resume' | 'stop') => {
    try {
      const response = await fetch(`${apiUrl}/api/v1/workflows/executions/${executionId}/control`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ action }),
      });

      if (!response.ok) {
        throw new Error(`Failed to ${action} workflow`);
      }
    } catch (err) {
      console.error(`Failed to ${action} workflow:`, err);
      setError(`Failed to ${action} workflow`);
    }
  }, [apiUrl]);

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'running':
        return <PlayArrow color="success" />;
      case 'completed':
        return <CheckCircle color="success" />;
      case 'failed':
        return <Error color="error" />;
      case 'paused':
        return <Pause color="warning" />;
      case 'idle':
        return <CircularProgress size={20} />;
      case 'busy':
        return <TaskAlt color="primary" />;
      case 'offline':
        return <Error color="disabled" />;
      case 'error':
        return <Error color="error" />;
      default:
        return <Info />;
    }
  };

  const getStatusColor = (status: string): 'success' | 'warning' | 'error' | 'default' => {
    switch (status) {
      case 'running':
      case 'completed':
      case 'busy':
        return 'success';
      case 'failed':
      case 'error':
        return 'error';
      case 'paused':
        return 'warning';
      default:
        return 'default';
    }
  };

  const getLogIcon = (level: string) => {
    switch (level) {
      case 'error':
        return <Error color="error" />;
      case 'warning':
        return <Warning color="warning" />;
      case 'info':
        return <Info color="info" />;
      default:
        return <Info color="disabled" />;
    }
  };

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" height="400px">
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box sx={{ p: 3 }}>
      {/* Connection Status */}
      <Box sx={{ mb: 3 }}>
        <Alert
          severity={connected ? 'success' : 'warning'}
          action={
            <Tooltip title="Refresh connection">
              <IconButton onClick={() => socket?.connect()}>
                <Refresh />
              </IconButton>
            </Tooltip>
          }
        >
          {connected ? 'Connected to real-time monitoring' : 'Disconnected from monitoring server'}
        </Alert>
      </Box>

      {error && (
        <Box sx={{ mb: 3 }}>
          <Alert severity="error" onClose={() => setError(null)}>
            {error}
          </Alert>
        </Box>
      )}

      <Grid container spacing={3}>
        {/* System Metrics Overview */}
        <Grid item xs={12} md={4}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                System Resources
              </Typography>
              {currentMetrics ? (
                <Stack spacing={2}>
                  <Box>
                    <Box display="flex" justifyContent="space-between" alignItems="center" mb={1}>
                      <Typography variant="body2">CPU Usage</Typography>
                      <Typography variant="body2">{currentMetrics.cpu}%</Typography>
                    </Box>
                    <LinearProgress
                      variant="determinate"
                      value={currentMetrics.cpu}
                      color={currentMetrics.cpu > 80 ? 'error' : currentMetrics.cpu > 60 ? 'warning' : 'primary'}
                    />
                  </Box>
                  <Box>
                    <Box display="flex" justifyContent="space-between" alignItems="center" mb={1}>
                      <Typography variant="body2">Memory Usage</Typography>
                      <Typography variant="body2">{currentMetrics.memory}%</Typography>
                    </Box>
                    <LinearProgress
                      variant="determinate"
                      value={currentMetrics.memory}
                      color={currentMetrics.memory > 80 ? 'error' : currentMetrics.memory > 60 ? 'warning' : 'primary'}
                    />
                  </Box>
                  <Box>
                    <Box display="flex" justifyContent="space-between" alignItems="center" mb={1}>
                      <Typography variant="body2">Disk Usage</Typography>
                      <Typography variant="body2">{currentMetrics.disk}%</Typography>
                    </Box>
                    <LinearProgress
                      variant="determinate"
                      value={currentMetrics.disk}
                      color={currentMetrics.disk > 80 ? 'error' : currentMetrics.disk > 60 ? 'warning' : 'primary'}
                    />
                  </Box>
                </Stack>
              ) : (
                <Typography variant="body2" color="textSecondary">
                  No metrics available
                </Typography>
              )}
            </CardContent>
          </Card>
        </Grid>

        {/* Performance Chart */}
        <Grid item xs={12} md={8}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Performance Overview
              </Typography>
              <ResponsiveContainer width="100%" height={200}>
                <LineChart data={systemMetrics}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis
                    dataKey="timestamp"
                    tickFormatter={(value) => format(new Date(value), 'HH:mm:ss')}
                  />
                  <YAxis />
                  <RechartsTooltip
                    labelFormatter={(value) => format(new Date(value), 'HH:mm:ss')}
                  />
                  <Line
                    type="monotone"
                    dataKey="cpu"
                    stroke="#8884d8"
                    strokeWidth={2}
                    dot={false}
                    name="CPU %"
                  />
                  <Line
                    type="monotone"
                    dataKey="memory"
                    stroke="#82ca9d"
                    strokeWidth={2}
                    dot={false}
                    name="Memory %"
                  />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </Grid>

        {/* Workflow Executions */}
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Active Workflows
              </Typography>
              <List dense>
                {workflowExecutions.slice(0, 5).map((execution) => (
                  <ListItem key={execution.id}>
                    <ListItemIcon>
                      {getStatusIcon(execution.status)}
                    </ListItemIcon>
                    <ListItemText
                      primary={execution.name}
                      secondary={
                        <Box>
                          <Typography variant="caption" display="block">
                            {execution.currentStep || 'No current step'}
                          </Typography>
                          <LinearProgress
                            variant="determinate"
                            value={execution.progress}
                            sx={{ mt: 1 }}
                          />
                        </Box>
                      }
                    />
                    <Box>
                      <Chip
                        label={execution.status}
                        color={getStatusColor(execution.status)}
                        size="small"
                      />
                      {execution.status === 'running' && (
                        <IconButton
                          size="small"
                          onClick={() => handleControlWorkflow(execution.id, 'pause')}
                        >
                          <Pause />
                        </IconButton>
                      )}
                      {execution.status === 'paused' && (
                        <IconButton
                          size="small"
                          onClick={() => handleControlWorkflow(execution.id, 'resume')}
                        >
                          <PlayArrow />
                        </IconButton>
                      )}
                      <IconButton
                        size="small"
                        onClick={() => handleControlWorkflow(execution.id, 'stop')}
                      >
                        <Stop />
                      </IconButton>
                    </Box>
                  </ListItem>
                ))}
              </List>
              {workflowExecutions.length === 0 && (
                <Typography variant="body2" color="textSecondary" sx={{ textAlign: 'center', py: 2 }}>
                  No active workflow executions
                </Typography>
              )}
            </CardContent>
          </Card>
        </Grid>

        {/* Agent Status */}
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Agent Status
              </Typography>
              <List dense>
                {agents.map((agent) => (
                  <ListItem key={agent.id}>
                    <ListItemIcon>
                      {getStatusIcon(agent.status)}
                    </ListItemIcon>
                    <ListItemText
                      primary={agent.name}
                      secondary={
                        <Box>
                          <Typography variant="caption" display="block">
                            {agent.type} • {agent.currentTask || 'Idle'}
                          </Typography>
                          <Typography variant="caption" color="textSecondary">
                            Tasks: {agent.tasksCompleted} • Errors: {agent.errorCount}
                          </Typography>
                        </Box>
                      }
                    />
                    <Chip
                      label={agent.status}
                      color={getStatusColor(agent.status)}
                      size="small"
                    />
                  </ListItem>
                ))}
              </List>
              {agents.length === 0 && (
                <Typography variant="body2" color="textSecondary" sx={{ textAlign: 'center', py: 2 }}>
                  No agents registered
                </Typography>
              )}
            </CardContent>
          </Card>
        </Grid>

        {/* Recent Logs */}
        <Grid item xs={12}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Recent Logs
              </Typography>
              <Paper variant="outlined" sx={{ maxHeight: 300, overflow: 'auto' }}>
                <List dense>
                  {logs.slice(0, 20).map((log) => (
                    <ListItem key={log.id} divider>
                      <ListItemIcon>
                        {getLogIcon(log.level)}
                      </ListItemIcon>
                      <ListItemText
                        primary={
                          <Box display="flex" justifyContent="space-between">
                            <Typography variant="body2">
                              {log.message}
                            </Typography>
                            <Typography variant="caption" color="textSecondary">
                              {format(new Date(log.timestamp), 'HH:mm:ss')}
                            </Typography>
                          </Box>
                        }
                        secondary={
                          <Typography variant="caption" color="textSecondary">
                            {log.source}
                          </Typography>
                        }
                      />
                    </ListItem>
                  ))}
                </List>
              </Paper>
              {logs.length === 0 && (
                <Typography variant="body2" color="textSecondary" sx={{ textAlign: 'center', py: 2 }}>
                  No log entries
                </Typography>
              )}
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
};

export default MonitoringDashboard;