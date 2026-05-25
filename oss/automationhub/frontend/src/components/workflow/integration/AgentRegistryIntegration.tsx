/**
 * Agent Registry Integration for Workflow Designer
 *
 * Provides seamless integration with the existing agent registry:
 * - Dynamic agent node configuration
 * - Real-time agent status monitoring
 * - Agent capability discovery
 * - Resource usage tracking
 * - Performance optimization suggestions
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  ListItemSecondaryAction,
  Chip,
  Button,
  IconButton,
  Tooltip,
  Switch,
  FormControlLabel,
  Grid,
  Alert,
  LinearProgress,
  Avatar,
  Divider,
  Badge,
  useTheme,
  alpha,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
} from '@mui/material';
import {
  Computer,
  Memory,
  Speed,
  CheckCircle,
  Error,
  Warning,
  Info,
  Refresh,
  Settings,
  PlayArrow,
  Pause,
  Stop,
  Visibility,
  Edit,
  Delete,
  Add,
  FilterList,
  Tune,
} from '@mui/icons-material';

interface Agent {
  id: string;
  name: string;
  type: string;
  status: 'idle' | 'running' | 'busy' | 'error' | 'offline';
  capabilities: string[];
  version: string;
  endpoint?: string;
  resources?: {
    cpu: number;
    memory: number;
    storage: number;
    network: number;
  };
  performance?: {
    avgResponseTime: number;
    successRate: number;
    totalRequests: number;
    errorRate: number;
  };
  metadata?: {
    description: string;
    author: string;
    createdAt: string;
    lastUsed: string;
    tags: string[];
  };
  config?: Record<string, any>;
}

interface AgentRegistryIntegrationProps {
  onAgentSelect?: (agent: Agent) => void;
  onAgentUpdate?: (agentId: string, updates: Partial<Agent>) => void;
  onAgentExecute?: (agentId: string, task: any) => void;
  filterCapabilities?: string[];
  showInactive?: boolean;
  compact?: boolean;
  enableManagement?: boolean;
}

const AgentRegistryIntegration: React.FC<AgentRegistryIntegrationProps> = ({
  onAgentSelect,
  onAgentUpdate,
  onAgentExecute,
  filterCapabilities = [],
  showInactive = false,
  compact = false,
  enableManagement = false,
}) => {
  const theme = useTheme();

  // State
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedAgents, setSelectedAgents] = useState<string[]>([]);
  const [filterType, setFilterType] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState<'name' | 'status' | 'performance' | 'usage'>('name');
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [refreshInterval, setRefreshInterval] = useState(5000);

  // Load agents from registry
  const loadAgents = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      // Mock API call - in production, this would fetch from the agent registry
      const response = await fetch('/api/v1/agents/registry');
      if (!response.ok) {
        throw new Error('Failed to fetch agents');
      }

      const data = await response.json();
      setAgents(data.agents || []);

    } catch (err) {
      console.error('Error loading agents:', err);
      setError(err instanceof Error ? err.message : 'Failed to load agents');

      // Fallback to mock data for development
      setAgents(getMockAgents());
    } finally {
      setLoading(false);
    }
  }, []);

  // Auto-refresh effect
  useEffect(() => {
    loadAgents();

    let interval: NodeJS.Timeout | null = null;
    if (autoRefresh) {
      interval = setInterval(loadAgents, refreshInterval);
    }

    return () => {
      if (interval) {
        clearInterval(interval);
      }
    };
  }, [loadAgents, autoRefresh, refreshInterval]);

  // Filter and sort agents
  const filteredAgents = useMemo(() => {
    let filtered = agents;

    // Filter by type
    if (filterType !== 'all') {
      filtered = filtered.filter(agent => agent.type === filterType);
    }

    // Filter by status
    if (filterStatus !== 'all') {
      filtered = filtered.filter(agent => agent.status === filterStatus);
    }

    // Filter by search term
    if (searchTerm) {
      const lowerSearch = searchTerm.toLowerCase();
      filtered = filtered.filter(agent =>
        agent.name.toLowerCase().includes(lowerSearch) ||
        agent.type.toLowerCase().includes(lowerSearch) ||
        agent.capabilities.some(cap => cap.toLowerCase().includes(lowerSearch)) ||
        (agent.metadata?.description || '').toLowerCase().includes(lowerSearch)
      );
    }

    // Filter by capabilities
    if (filterCapabilities.length > 0) {
      filtered = filtered.filter(agent =>
        filterCapabilities.every(cap => agent.capabilities.includes(cap))
      );
    }

    // Filter out inactive agents if requested
    if (!showInactive) {
      filtered = filtered.filter(agent => agent.status !== 'offline');
    }

    // Sort agents
    filtered.sort((a, b) => {
      switch (sortBy) {
        case 'name':
          return a.name.localeCompare(b.name);
        case 'status':
          return a.status.localeCompare(b.status);
        case 'performance':
          return (b.performance?.successRate || 0) - (a.performance?.successRate || 0);
        case 'usage':
          return (b.performance?.totalRequests || 0) - (a.performance?.totalRequests || 0);
        default:
          return 0;
      }
    });

    return filtered;
  }, [agents, filterType, filterStatus, searchTerm, sortBy, filterCapabilities, showInactive]);

  // Get status icon and color
  const getStatusIcon = useCallback((status: Agent['status']) => {
    switch (status) {
      case 'idle':
        return <Computer color="action" />;
      case 'running':
        return <PlayArrow color="success" />;
      case 'busy':
        return <Pause color="warning" />;
      case 'error':
        return <Error color="error" />;
      case 'offline':
        return <Stop color="disabled" />;
      default:
        return <Info color="action" />;
    }
  }, []);

  const getStatusColor = useCallback((status: Agent['status']) => {
    switch (status) {
      case 'idle':
        return theme.palette.info.main;
      case 'running':
        return theme.palette.success.main;
      case 'busy':
        return theme.palette.warning.main;
      case 'error':
        return theme.palette.error.main;
      case 'offline':
        return theme.palette.grey[500];
      default:
        return theme.palette.action.active;
    }
  }, [theme]);

  // Handle agent selection
  const handleAgentSelect = useCallback((agent: Agent, event?: React.MouseEvent) => {
    if (event?.ctrlKey || event?.metaKey) {
      // Multi-select
      setSelectedAgents(prev =>
        prev.includes(agent.id)
          ? prev.filter(id => id !== agent.id)
          : [...prev, agent.id]
      );
    } else {
      // Single select
      setSelectedAgents([agent.id]);
      onAgentSelect?.(agent);
    }
  }, [onAgentSelect]);

  // Handle agent management actions
  const handleAgentAction = useCallback(async (action: string, agentId: string) => {
    try {
      const response = await fetch(`/api/v1/agents/${agentId}/${action}`, {
        method: 'POST',
      });

      if (!response.ok) {
        throw new Error(`Failed to ${action} agent`);
      }

      // Refresh agents
      await loadAgents();

    } catch (err) {
      console.error(`Error ${action} agent:`, err);
      setError(err instanceof Error ? err.message : `Failed to ${action} agent`);
    }
  }, [loadAgents]);

  // Execute agent task
  const handleExecuteAgent = useCallback(async (agent: Agent) => {
    const task = {
      type: 'test',
      parameters: {},
    };

    try {
      onAgentExecute?.(agent.id, task);
    } catch (err) {
      console.error('Error executing agent:', err);
      setError(err instanceof Error ? err.message : 'Failed to execute agent');
    }
  }, [onAgentExecute]);

  // Get unique agent types
  const agentTypes = useMemo(() => {
    const types = new Set(agents.map(agent => agent.type));
    return Array.from(types).sort();
  }, [agents]);

  // Get performance metrics
  const performanceMetrics = useMemo(() => {
    const totalAgents = agents.length;
    const activeAgents = agents.filter(a => ['idle', 'running', 'busy'].includes(a.status)).length;
    const avgResponseTime = agents.reduce((sum, a) => sum + (a.performance?.avgResponseTime || 0), 0) / totalAgents || 0;
    const avgSuccessRate = agents.reduce((sum, a) => sum + (a.performance?.successRate || 0), 0) / totalAgents || 0;

    return {
      total: totalAgents,
      active: activeAgents,
      avgResponseTime,
      avgSuccessRate,
    };
  }, [agents]);

  if (compact) {
    return (
      <Card sx={{ p: 2 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Typography variant="subtitle2">
            Agent Registry ({filteredAgents.length})
          </Typography>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Badge
              color={error ? 'error' : 'default'}
              variant="dot"
            >
              <Typography variant="caption">
                {filteredAgents.filter(a => a.status === 'running').length} running
              </Typography>
            </Badge>
            <IconButton size="small" onClick={loadAgents}>
              <Refresh fontSize="small" />
            </IconButton>
          </Box>
        </Box>

        {error && (
          <Alert severity="error" sx={{ mt: 1 }} size="small">
            {error}
          </Alert>
        )}
      </Card>
    );
  }

  return (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <Paper sx={{ p: 2, borderBottom: 1, borderColor: 'divider' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
          <Typography variant="h6">
            Agent Registry
          </Typography>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <FormControlLabel
              control={
                <Switch
                  checked={autoRefresh}
                  onChange={(e) => setAutoRefresh(e.target.checked)}
                  size="small"
                />
              }
              label="Auto-refresh"
            />
            <IconButton onClick={loadAgents} disabled={loading}>
              <Refresh />
            </IconButton>
          </Box>
        </Box>

        {/* Performance Metrics */}
        <Grid container spacing={2} sx={{ mb: 2 }}>
          <Grid item xs={3}>
            <Card variant="outlined">
              <CardContent sx={{ p: 1, textAlign: 'center' }}>
                <Typography variant="h4" color="primary">
                  {performanceMetrics.total}
                </Typography>
                <Typography variant="caption">
                  Total Agents
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={3}>
            <Card variant="outlined">
              <CardContent sx={{ p: 1, textAlign: 'center' }}>
                <Typography variant="h4" color="success.main">
                  {performanceMetrics.active}
                </Typography>
                <Typography variant="caption">
                  Active
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={3}>
            <Card variant="outlined">
              <CardContent sx={{ p: 1, textAlign: 'center' }}>
                <Typography variant="h4" color="info.main">
                  {Math.round(performanceMetrics.avgResponseTime)}ms
                </Typography>
                <Typography variant="caption">
                  Avg Response
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={3}>
            <Card variant="outlined">
              <CardContent sx={{ p: 1, textAlign: 'center' }}>
                <Typography variant="h4" color="success.main">
                  {Math.round(performanceMetrics.avgSuccessRate)}%
                </Typography>
                <Typography variant="caption">
                  Success Rate
                </Typography>
              </CardContent>
            </Card>
          </Grid>
        </Grid>

        {/* Filters */}
        <Grid container spacing={1} alignItems="center">
          <Grid item xs={3}>
            <Button
              fullWidth
              variant={filterType === 'all' ? 'contained' : 'outlined'}
              onClick={() => setFilterType('all')}
              size="small"
            >
              All Types
            </Button>
          </Grid>
          <Grid item xs={3}>
            <Button
              fullWidth
              variant={filterStatus === 'all' ? 'contained' : 'outlined'}
              onClick={() => setFilterStatus('all')}
              size="small"
            >
              All Status
            </Button>
          </Grid>
          <Grid item xs={6}>
            <Button
              variant="outlined"
              onClick={() => setSortBy(sortBy === 'performance' ? 'name' : 'performance')}
              size="small"
              fullWidth
            >
              Sort by {sortBy}
            </Button>
          </Grid>
        </Grid>
      </Paper>

      {/* Error Display */}
      {error && (
        <Alert severity="error" sx={{ m: 2 }}>
          {error}
          <Button size="small" onClick={() => setError(null)} sx={{ ml: 1 }}>
            Dismiss
          </Button>
        </Alert>
      )}

      {/* Loading State */}
      {loading && (
        <Box sx={{ p: 2 }}>
          <LinearProgress />
          <Typography variant="body2" sx={{ mt: 1, textAlign: 'center' }}>
            Loading agents...
          </Typography>
        </Box>
      )}

      {/* Agents List */}
      {!loading && (
        <Box sx={{ flex: 1, overflow: 'auto', p: 2 }}>
          <Grid container spacing={2}>
            {filteredAgents.map((agent) => (
              <Grid item xs={12} md={6} lg={4} key={agent.id}>
                <Card
                  sx={{
                    cursor: 'pointer',
                    transition: 'all 0.2s ease-in-out',
                    border: selectedAgents.includes(agent.id) ? 2 : 1,
                    borderColor: selectedAgents.includes(agent.id) ? 'primary.main' : 'divider',
                    '&:hover': {
                      transform: 'translateY(-2px)',
                      boxShadow: theme.shadows[4],
                    },
                  }}
                  onClick={(e) => handleAgentSelect(agent, e)}
                >
                  <CardContent>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                      <Avatar sx={{ bgcolor: alpha(getStatusColor(agent.status), 0.1) }}>
                        {getStatusIcon(agent.status)}
                      </Avatar>
                      <Box sx={{ flex: 1, minWidth: 0 }}>
                        <Typography variant="subtitle2" noWrap>
                          {agent.name}
                        </Typography>
                        <Typography variant="caption" color="textSecondary">
                          {agent.type}
                        </Typography>
                      </Box>
                      <Chip
                        label={agent.status}
                        size="small"
                        sx={{
                          backgroundColor: alpha(getStatusColor(agent.status), 0.1),
                          color: getStatusColor(agent.status),
                        }}
                      />
                    </Box>

                    {/* Capabilities */}
                    <Box sx={{ mb: 1 }}>
                      {agent.capabilities.slice(0, 3).map((capability) => (
                        <Chip
                          key={capability}
                          label={capability}
                          size="small"
                          variant="outlined"
                          sx={{ fontSize: '10px', mr: 0.5, mb: 0.5 }}
                        />
                      ))}
                      {agent.capabilities.length > 3 && (
                        <Chip
                          label={`+${agent.capabilities.length - 3}`}
                          size="small"
                          variant="outlined"
                          sx={{ fontSize: '10px', mr: 0.5, mb: 0.5 }}
                        />
                      )}
                    </Box>

                    {/* Performance Metrics */}
                    {agent.performance && (
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                          <Speed sx={{ fontSize: 14, color: theme.palette.success.main }} />
                          <Typography variant="caption">
                            {agent.performance.successRate}% success
                          </Typography>
                        </Box>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                          <Timer sx={{ fontSize: 14, color: theme.palette.info.main }} />
                          <Typography variant="caption">
                            {agent.performance.avgResponseTime}ms
                          </Typography>
                        </Box>
                      </Box>
                    )}

                    {/* Resource Usage */}
                    {agent.resources && (
                      <Box sx={{ mb: 1 }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                          <Memory sx={{ fontSize: 14 }} />
                          <Typography variant="caption">
                            CPU: {agent.resources.cpu}%
                          </Typography>
                          <Typography variant="caption">
                            Memory: {agent.resources.memory}%
                          </Typography>
                        </Box>
                        <LinearProgress
                          variant="determinate"
                          value={agent.resources.cpu}
                          size="small"
                          sx={{ mb: 0.5 }}
                        />
                        <LinearProgress
                          variant="determinate"
                          value={agent.resources.memory}
                          color="secondary"
                          size="small"
                        />
                      </Box>
                    )}

                    {/* Actions */}
                    {enableManagement && (
                      <Box sx={{ display: 'flex', gap: 1, mt: 1 }}>
                        {agent.status === 'idle' && (
                          <Button
                            size="small"
                            startIcon={<PlayArrow />}
                            onClick={(e) => {
                              e.stopPropagation();
                              handleAgentAction('start', agent.id);
                            }}
                          >
                            Start
                          </Button>
                        )}
                        {(agent.status === 'running' || agent.status === 'busy') && (
                          <Button
                            size="small"
                            startIcon={<Pause />}
                            onClick={(e) => {
                              e.stopPropagation();
                              handleAgentAction('pause', agent.id);
                            }}
                          >
                            Pause
                          </Button>
                        )}
                        <Button
                          size="small"
                          startIcon={<PlayArrow />}
                          onClick={(e) => {
                            e.stopPropagation();
                            handleExecuteAgent(agent);
                          }}
                        >
                          Test
                        </Button>
                      </Box>
                    )}
                  </CardContent>
                </Card>
              </Grid>
            ))}
          </Grid>

          {filteredAgents.length === 0 && !loading && (
            <Box sx={{ textAlign: 'center', py: 8 }}>
              <Typography variant="h6" color="textSecondary">
                No agents found
              </Typography>
              <Typography variant="body2" color="textSecondary">
                Try adjusting your filters or add agents to the registry
              </Typography>
            </Box>
          )}
        </Box>
      )}
    </Box>
  );
};

// Mock data for development
function getMockAgents(): Agent[] {
  return [
    {
      id: 'agent-1',
      name: 'Browser Automation Agent',
      type: 'browser',
      status: 'idle',
      capabilities: ['web-scraping', 'form-filling', 'screenshot', 'navigation'],
      version: '1.2.0',
      resources: {
        cpu: 15,
        memory: 25,
        storage: 5,
        network: 10,
      },
      performance: {
        avgResponseTime: 150,
        successRate: 98.5,
        totalRequests: 1240,
        errorRate: 1.5,
      },
      metadata: {
        description: 'Specialized agent for browser automation and web scraping tasks',
        author: 'Automation Team',
        createdAt: '2024-01-15T10:30:00Z',
        lastUsed: '2024-01-20T14:22:00Z',
        tags: ['automation', 'browser', 'scraping'],
      },
    },
    {
      id: 'agent-2',
      name: 'Data Processing Agent',
      type: 'data',
      status: 'running',
      capabilities: ['data-transformation', 'csv-processing', 'json-manipulation', 'validation'],
      version: '2.1.0',
      resources: {
        cpu: 45,
        memory: 60,
        storage: 15,
        network: 5,
      },
      performance: {
        avgResponseTime: 280,
        successRate: 99.2,
        totalRequests: 890,
        errorRate: 0.8,
      },
      metadata: {
        description: 'Agent for data processing and transformation tasks',
        author: 'Data Team',
        createdAt: '2024-01-10T09:15:00Z',
        lastUsed: '2024-01-20T16:45:00Z',
        tags: ['data', 'processing', 'etl'],
      },
    },
    {
      id: 'agent-3',
      name: 'API Integration Agent',
      type: 'integration',
      status: 'busy',
      capabilities: ['rest-api', 'webhook', 'authentication', 'rate-limiting'],
      version: '1.8.0',
      resources: {
        cpu: 30,
        memory: 40,
        storage: 8,
        network: 25,
      },
      performance: {
        avgResponseTime: 95,
        successRate: 97.8,
        totalRequests: 2340,
        errorRate: 2.2,
      },
      metadata: {
        description: 'Agent for external API integrations and webhook handling',
        author: 'Integration Team',
        createdAt: '2024-01-08T11:00:00Z',
        lastUsed: '2024-01-20T18:30:00Z',
        tags: ['api', 'integration', 'webhook'],
      },
    },
  ];
}

export default AgentRegistryIntegration;