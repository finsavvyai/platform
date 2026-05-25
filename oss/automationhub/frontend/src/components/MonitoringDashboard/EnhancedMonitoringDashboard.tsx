import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Grid,
  IconButton,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Chip,
  Paper,
  Divider,
  Alert,
  Tooltip,
  Menu,
  MenuList,
  ListItemIcon,
  ListItemText,
  ListItemButton,
  Switch,
  FormControlLabel,
  Slider,
  InputAdornment,
} from '@mui/material';
import {
  Add,
  Edit,
  Delete,
  Save,
  Cancel,
  Refresh,
  Download,
  Share,
  MoreVert,
  Dashboard,
  Assessment,
  Memory,
  Speed,
  Warning,
  CheckCircle,
  TrendingUp,
  TrendingDown,
  Timeline,
  BarChart,
  PieChart,
  Settings,
  Fullscreen,
  Close,
  DragIndicator,
} from '@mui/icons-material';
import { LineChart, Line, AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, PieChart as RePieChart, Pie, Cell, RadialBarChart, RadialBar, Legend } from 'recharts';
import { io, Socket } from 'socket.io-client';
import { format, subHours, subDays, subWeeks } from 'date-fns';

// Types
interface DashboardWidget {
  id: string;
  type: 'system_status' | 'task_status' | 'performance_metrics' | 'resource_usage' | 'alerts' | 'custom_chart';
  title: string;
  position: { x: number; y: number; w: number; h: number };
  config: Record<string, any>;
  data?: any;
  lastUpdated?: string;
}

interface Dashboard {
  id: string;
  name: string;
  description?: string;
  widgets: DashboardWidget[];
  isPublic: boolean;
  refreshInterval: number;
  createdAt: string;
  updatedAt: string;
}

interface SystemMetrics {
  cpu: number;
  memory: number;
  disk: number;
  network: { in: number; out: number };
  timestamp: string;
}

const WIDGET_TYPES = [
  { value: 'system_status', label: 'System Status', icon: <Dashboard />, description: 'Real-time system health metrics' },
  { value: 'task_status', label: 'Task Status', icon: <Assessment />, description: 'Task execution status and trends' },
  { value: 'performance_metrics', label: 'Performance Metrics', icon: <Speed />, description: 'Performance scores and analytics' },
  { value: 'resource_usage', label: 'Resource Usage', icon: <Memory />, description: 'CPU, memory, and disk utilization' },
  { value: 'alerts', label: 'Alerts', icon: <Warning />, description: 'System alerts and notifications' },
  { value: 'custom_chart', label: 'Custom Chart', icon: <BarChart />, description: 'Custom data visualization' },
];

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8', '#82CA9D', '#FFC658', '#FF7C7C'];

interface EnhancedMonitoringDashboardProps {
  apiUrl: string;
  initialDashboard?: Dashboard;
  onDashboardChange?: (dashboard: Dashboard) => void;
}

export const EnhancedMonitoringDashboard: React.FC<EnhancedMonitoringDashboardProps> = ({
  apiUrl,
  initialDashboard,
  onDashboardChange,
}) => {
  // State
  const [dashboard, setDashboard] = useState<Dashboard>(initialDashboard || {
    id: 'default',
    name: 'System Overview',
    description: 'Default monitoring dashboard',
    widgets: [
      {
        id: 'system-status',
        type: 'system_status',
        title: 'System Status',
        position: { x: 0, y: 0, w: 6, h: 4 },
        config: { refreshInterval: 30 }
      },
      {
        id: 'task-status',
        type: 'task_status',
        title: 'Task Status',
        position: { x: 6, y: 0, w: 6, h: 4 },
        config: { timeRange: 'hour' }
      },
      {
        id: 'performance',
        type: 'performance_metrics',
        title: 'Performance Metrics',
        position: { x: 0, y: 4, w: 12, h: 4 },
        config: { timeRange: 'day' }
      }
    ],
    isPublic: true,
    refreshInterval: 30,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });

  const [socket, setSocket] = useState<Socket | null>(null);
  const [connected, setConnected] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editingWidget, setEditingWidget] = useState<DashboardWidget | null>(null);
  const [widgetDialogOpen, setWidgetDialogOpen] = useState(false);
  const [dashboardDialogOpen, setDashboardDialogOpen] = useState(false);
  const [editingDashboard, setEditingDashboard] = useState<Dashboard | null>(null);
  const [systemMetrics, setSystemMetrics] = useState<SystemMetrics[]>([]);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [menuAnchor, setMenuAnchor] = useState<null | HTMLElement>(null);
  const [selectedWidget, setSelectedWidget] = useState<string | null>(null);

  // Initialize WebSocket connection
  useEffect(() => {
    const newSocket = io(apiUrl, {
      path: '/ws',
      transports: ['websocket'],
    });

    newSocket.on('connect', () => {
      setConnected(true);
      setError(null);
    });

    newSocket.on('disconnect', () => {
      setConnected(false);
    });

    newSocket.on('system_metrics', (metrics: SystemMetrics) => {
      setSystemMetrics((prev) => {
        const updated = [...prev, metrics];
        return updated.slice(-100); // Keep last 100 data points
      });
    });

    newSocket.on('widget_data', (data: { widgetId: string; data: any }) => {
      setDashboard((prev) => ({
        ...prev,
        widgets: prev.widgets.map((widget) =>
          widget.id === data.widgetId
            ? { ...widget, data: data.data, lastUpdated: new Date().toISOString() }
            : widget
        ),
      }));
    });

    newSocket.on('error', (errorMsg: string) => {
      setError(errorMsg);
    });

    setSocket(newSocket);

    return () => {
      newSocket.close();
    };
  }, [apiUrl]);

  // Auto-refresh data
  useEffect(() => {
    if (!autoRefresh || !socket || !connected) return;

    const interval = setInterval(() => {
      refreshDashboardData();
    }, dashboard.refreshInterval * 1000);

    return () => clearInterval(interval);
  }, [autoRefresh, dashboard.refreshInterval, socket, connected]);

  const refreshDashboardData = useCallback(async () => {
    if (!socket || !connected) return;

    try {
      // Request data for each widget
      dashboard.widgets.forEach((widget) => {
        socket.emit('get_widget_data', {
          widgetId: widget.id,
          type: widget.type,
          config: widget.config,
        });
      });
    } catch (err) {
      console.error('Failed to refresh dashboard data:', err);
    }
  }, [socket, connected, dashboard.widgets]);

  const handleAddWidget = () => {
    const newWidget: DashboardWidget = {
      id: `widget-${Date.now()}`,
      type: 'system_status',
      title: 'New Widget',
      position: { x: 0, y: 0, w: 6, h: 4 },
      config: { refreshInterval: 30 },
    };
    setEditingWidget(newWidget);
    setWidgetDialogOpen(true);
  };

  const handleEditWidget = (widget: DashboardWidget) => {
    setEditingWidget(widget);
    setWidgetDialogOpen(true);
  };

  const handleDeleteWidget = (widgetId: string) => {
    setDashboard((prev) => ({
      ...prev,
      widgets: prev.widgets.filter((w) => w.id !== widgetId),
    }));
  };

  const handleSaveWidget = (widget: DashboardWidget) => {
    setDashboard((prev) => ({
      ...prev,
      widgets: prev.widgets.some((w) => w.id === widget.id)
        ? prev.widgets.map((w) => (w.id === widget.id ? widget : w))
        : [...prev.widgets, widget],
    }));
    setWidgetDialogOpen(false);
    setEditingWidget(null);
    if (onDashboardChange) {
      onDashboardChange(dashboard);
    }
  };

  const handleSaveDashboard = (updatedDashboard: Dashboard) => {
    setDashboard(updatedDashboard);
    setDashboardDialogOpen(false);
    setEditingDashboard(null);
    if (onDashboardChange) {
      onDashboardChange(updatedDashboard);
    }
  };

  const handleExportDashboard = () => {
    const dataStr = JSON.stringify(dashboard, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${dashboard.name.replace(/\s+/g, '-').toLowerCase()}-dashboard.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleShareDashboard = () => {
    const shareUrl = `${window.location.origin}/dashboard/${dashboard.id}`;
    navigator.clipboard.writeText(shareUrl);
    // Show toast or notification
    alert('Dashboard link copied to clipboard!');
  };

  const renderWidgetContent = (widget: DashboardWidget) => {
    const { data } = widget;

    switch (widget.type) {
      case 'system_status':
        return <SystemStatusWidget data={data} />;
      case 'task_status':
        return <TaskStatusWidget data={data} />;
      case 'performance_metrics':
        return <PerformanceMetricsWidget data={data} />;
      case 'resource_usage':
        return <ResourceUsageWidget data={data} />;
      case 'alerts':
        return <AlertsWidget data={data} />;
      case 'custom_chart':
        return <CustomChartWidget data={data} config={widget.config} />;
      default:
        return <Alert severity="info">Unknown widget type: {widget.type}</Alert>;
    }
  };

  const handleWidgetMenuClick = (event: React.MouseEvent<HTMLElement>, widgetId: string) => {
    setMenuAnchor(event.currentTarget);
    setSelectedWidget(widgetId);
  };

  const handleWidgetMenuClose = () => {
    setMenuAnchor(null);
    setSelectedWidget(null);
  };

  const handleWidgetMenuAction = (action: string) => {
    if (!selectedWidget) return;

    const widget = dashboard.widgets.find((w) => w.id === selectedWidget);
    if (!widget) return;

    switch (action) {
      case 'edit':
        handleEditWidget(widget);
        break;
      case 'delete':
        handleDeleteWidget(selectedWidget);
        break;
      case 'refresh':
        if (socket) {
          socket.emit('get_widget_data', {
            widgetId: selectedWidget,
            type: widget.type,
            config: widget.config,
          });
        }
        break;
    }

    handleWidgetMenuClose();
  };

  return (
    <Box sx={{ p: 3 }}>
      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Box>
          <Typography variant="h4" component="h1" gutterBottom>
            {dashboard.name}
          </Typography>
          {dashboard.description && (
            <Typography variant="body2" color="text.secondary">
              {dashboard.description}
            </Typography>
          )}
        </Box>

        <Box sx={{ display: 'flex', gap: 1 }}>
          {/* Connection Status */}
          <Chip
            icon={connected ? <CheckCircle /> : <Warning />}
            label={connected ? 'Connected' : 'Disconnected'}
            color={connected ? 'success' : 'warning'}
            size="small"
          />

          {/* Auto Refresh Toggle */}
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

          {/* Action Buttons */}
          <Tooltip title="Refresh Data">
            <IconButton onClick={refreshDashboardData} disabled={!connected}>
              <Refresh />
            </IconButton>
          </Tooltip>

          <Tooltip title="Add Widget">
            <IconButton onClick={handleAddWidget}>
              <Add />
            </IconButton>
          </Tooltip>

          <Tooltip title="Dashboard Settings">
            <IconButton onClick={() => setEditingDashboard(dashboard)}>
              <Settings />
            </IconButton>
          </Tooltip>

          <Tooltip title="Export Dashboard">
            <IconButton onClick={handleExportDashboard}>
              <Download />
            </IconButton>
          </Tooltip>

          {dashboard.isPublic && (
            <Tooltip title="Share Dashboard">
              <IconButton onClick={handleShareDashboard}>
                <Share />
              </IconButton>
            </Tooltip>
          )}

          <Button
            variant="outlined"
            startIcon={<Fullscreen />}
            onClick={() => {/* Implement fullscreen mode */}}
          >
            Fullscreen
          </Button>
        </Box>
      </Box>

      {/* Error Alert */}
      {error && (
        <Alert severity="error" onClose={() => setError(null)} sx={{ mb: 3 }}>
          {error}
        </Alert>
      )}

      {/* Dashboard Grid */}
      <Grid container spacing={3}>
        {dashboard.widgets.map((widget) => (
          <Grid
            item
            xs={12}
            md={widget.position.w === 12 ? 12 : widget.position.w === 6 ? 6 : 4}
            lg={widget.position.w === 12 ? 12 : widget.position.w === 6 ? 6 : 4}
            key={widget.id}
          >
            <Card sx={{ height: widget.position.h * 80, position: 'relative' }}>
              {/* Widget Header */}
              <Box
                sx={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  p: 2,
                  borderBottom: 1,
                  borderColor: 'divider',
                }}
              >
                <Typography variant="h6" component="h2">
                  {widget.title}
                </Typography>

                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  {/* Last Updated */}
                  {widget.lastUpdated && (
                    <Typography variant="caption" color="text.secondary">
                      Updated {format(new Date(widget.lastUpdated), 'HH:mm:ss')}
                    </Typography>
                  )}

                  {/* Widget Menu */}
                  <IconButton
                    size="small"
                    onClick={(e) => handleWidgetMenuClick(e, widget.id)}
                  >
                    <MoreVert />
                  </IconButton>
                </Box>
              </Box>

              {/* Widget Content */}
              <CardContent sx={{ height: 'calc(100% - 80px)', overflow: 'auto' }}>
                {loading ? (
                  <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}>
                    <Refresh />
                  </Box>
                ) : (
                  renderWidgetContent(widget)
                )}
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>

      {/* Widget Menu */}
      <Menu
        anchorEl={menuAnchor}
        open={Boolean(menuAnchor)}
        onClose={handleWidgetMenuClose}
      >
        <MenuList>
          <ListItemButton onClick={() => handleWidgetMenuAction('refresh')}>
            <ListItemIcon><Refresh /></ListItemIcon>
            <ListItemText>Refresh</ListItemText>
          </ListItemButton>
          <ListItemButton onClick={() => handleWidgetMenuAction('edit')}>
            <ListItemIcon><Edit /></ListItemIcon>
            <ListItemText>Edit</ListItemText>
          </ListItemButton>
          <ListItemButton onClick={() => handleWidgetMenuAction('delete')} sx={{ color: 'error.main' }}>
            <ListItemIcon><Delete /></ListItemIcon>
            <ListItemText>Delete</ListItemText>
          </ListItemButton>
        </MenuList>
      </Menu>

      {/* Widget Edit Dialog */}
      <WidgetEditDialog
        open={widgetDialogOpen}
        widget={editingWidget}
        onClose={() => {
          setWidgetDialogOpen(false);
          setEditingWidget(null);
        }}
        onSave={handleSaveWidget}
      />

      {/* Dashboard Settings Dialog */}
      <DashboardSettingsDialog
        open={dashboardDialogOpen}
        dashboard={editingDashboard}
        onClose={() => {
          setDashboardDialogOpen(false);
          setEditingDashboard(null);
        }}
        onSave={handleSaveDashboard}
      />
    </Box>
  );
};

// Widget Components
const SystemStatusWidget: React.FC<{ data?: any }> = ({ data }) => {
  if (!data) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}>
        <Typography color="text.secondary">No data available</Typography>
      </Box>
    );
  }

  const { cpu, memory, disk, network } = data.current || data;

  return (
    <Grid container spacing={2}>
      <Grid item xs={6}>
        <Box textAlign="center">
          <Typography variant="h4" color="primary">
            {cpu?.toFixed(1) || 0}%
          </Typography>
          <Typography variant="body2" color="text.secondary">
            CPU Usage
          </Typography>
        </Box>
      </Grid>
      <Grid item xs={6}>
        <Box textAlign="center">
          <Typography variant="h4" color="secondary">
            {memory?.toFixed(1) || 0}%
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Memory Usage
          </Typography>
        </Box>
      </Grid>
      <Grid item xs={6}>
        <Box textAlign="center">
          <Typography variant="h4" color="warning.main">
            {disk?.toFixed(1) || 0}%
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Disk Usage
          </Typography>
        </Box>
      </Grid>
      <Grid item xs={6}>
        <Box textAlign="center">
          <Typography variant="h4" color="info.main">
            {network?.in?.toFixed(1) || 0} KB/s
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Network In
          </Typography>
        </Box>
      </Grid>
    </Grid>
  );
};

const TaskStatusWidget: React.FC<{ data?: any }> = ({ data }) => {
  if (!data) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}>
        <Typography color="text.secondary">No data available</Typography>
      </Box>
    );
  }

  const { summary } = data;

  return (
    <Grid container spacing={2}>
      <Grid item xs={3}>
        <Box textAlign="center">
          <Typography variant="h5" color="success.main">
            {summary?.running || 0}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Running
          </Typography>
        </Box>
      </Grid>
      <Grid item xs={3}>
        <Box textAlign="center">
          <Typography variant="h5" color="warning.main">
            {summary?.pending || 0}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Pending
          </Typography>
        </Box>
      </Grid>
      <Grid item xs={3}>
        <Box textAlign="center">
          <Typography variant="h5" color="primary.main">
            {summary?.completed_24h || 0}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Completed (24h)
          </Typography>
        </Box>
      </Grid>
      <Grid item xs={3}>
        <Box textAlign="center">
          <Typography variant="h5" color="error.main">
            {summary?.failed_24h || 0}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Failed (24h)
          </Typography>
        </Box>
      </Grid>
    </Grid>
  );
};

const PerformanceMetricsWidget: React.FC<{ data?: any }> = ({ data }) => {
  if (!data) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}>
        <Typography color="text.secondary">No data available</Typography>
      </Box>
    );
  }

  const { performance_score, execution_times, system_metrics } = data;

  return (
    <Grid container spacing={2}>
      <Grid item xs={4}>
        <Box textAlign="center">
          <Typography variant="h4" color={performance_score > 80 ? 'success.main' : performance_score > 60 ? 'warning.main' : 'error.main'}>
            {performance_score || 0}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Performance Score
          </Typography>
        </Box>
      </Grid>
      <Grid item xs={4}>
        <Box textAlign="center">
          <Typography variant="h5" color="primary.main">
            {execution_times?.average_ms ? (execution_times.average_ms / 1000).toFixed(1) : 0}s
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Avg Execution Time
          </Typography>
        </Box>
      </Grid>
      <Grid item xs={4}>
        <Box textAlign="center">
          <Typography variant="h5" color="info.main">
            {execution_times?.success_rate?.toFixed(1) || 0}%
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Success Rate
          </Typography>
        </Box>
      </Grid>
    </Grid>
  );
};

const ResourceUsageWidget: React.FC<{ data?: any }> = ({ data }) => {
  if (!data?.history) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}>
        <Typography color="text.secondary">No data available</Typography>
      </Box>
    );
  }

  const chartData = data.history.map((point: any, index: number) => ({
    time: index,
    cpu: point.cpu || 0,
    memory: point.memory || 0,
    disk: point.disk || 0,
  }));

  return (
    <ResponsiveContainer width="100%" height="100%">
      <AreaChart data={chartData}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="time" />
        <YAxis />
        <RechartsTooltip />
        <Legend />
        <Area type="monotone" dataKey="cpu" stackId="1" stroke="#8884d8" fill="#8884d8" />
        <Area type="monotone" dataKey="memory" stackId="1" stroke="#82ca9d" fill="#82ca9d" />
        <Area type="monotone" dataKey="disk" stackId="1" stroke="#ffc658" fill="#ffc658" />
      </AreaChart>
    </ResponsiveContainer>
  );
};

const AlertsWidget: React.FC<{ data?: any }> = ({ data }) => {
  if (!data) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}>
        <Typography color="text.secondary">No data available</Typography>
      </Box>
    );
  }

  const { summary, recent_alerts } = data;

  return (
    <Box>
      <Grid container spacing={2} sx={{ mb: 2 }}>
        <Grid item xs={3}>
          <Box textAlign="center">
            <Typography variant="h5" color="error.main">
              {summary?.unresolved || 0}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Unresolved
            </Typography>
          </Box>
        </Grid>
        <Grid item xs={3}>
          <Box textAlign="center">
            <Typography variant="h5" color="warning.main">
              {summary?.by_severity?.warning || 0}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Warnings
            </Typography>
          </Box>
        </Grid>
        <Grid item xs={3}>
          <Box textAlign="center">
            <Typography variant="h5" color="info.main">
              {summary?.by_severity?.medium || 0}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Medium
            </Typography>
          </Box>
        </Grid>
        <Grid item xs={3}>
          <Box textAlign="center">
            <Typography variant="h5" color="success.main">
              {summary?.resolved || 0}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Resolved
            </Typography>
          </Box>
        </Grid>
      </Grid>

      {/* Recent Alerts List */}
      <Box>
        <Typography variant="subtitle2" gutterBottom>
          Recent Alerts
        </Typography>
        {recent_alerts?.slice(0, 5).map((alert: any, index: number) => (
          <Box key={index} sx={{ mb: 1 }}>
            <Typography variant="body2" color={alert.severity === 'critical' ? 'error.main' : 'text.primary'}>
              {alert.title}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {alert.description}
            </Typography>
          </Box>
        ))}
      </Box>
    </Box>
  );
};

const CustomChartWidget: React.FC<{ data?: any; config?: any }> = ({ data, config }) => {
  const chartType = config?.chartType || 'line';

  if (!data) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}>
        <Typography color="text.secondary">No data available</Typography>
      </Box>
    );
  }

  switch (chartType) {
    case 'line':
      return (
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="name" />
            <YAxis />
            <RechartsTooltip />
            <Legend />
            <Line type="monotone" dataKey="value" stroke="#8884d8" />
          </LineChart>
        </ResponsiveContainer>
      );
    case 'bar':
      return (
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="name" />
            <YAxis />
            <RechartsTooltip />
            <Legend />
            <Bar dataKey="value" fill="#8884d8" />
          </BarChart>
        </ResponsiveContainer>
      );
    case 'pie':
      return (
        <ResponsiveContainer width="100%" height="100%">
          <RePieChart>
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              labelLine={false}
              label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
              outerRadius={80}
              fill="#8884d8"
              dataKey="value"
            >
              {data.map((entry: any, index: number) => (
                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
              ))}
            </Pie>
            <RechartsTooltip />
          </RePieChart>
        </ResponsiveContainer>
      );
    default:
      return (
        <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}>
          <Typography color="text.secondary">Unsupported chart type: {chartType}</Typography>
        </Box>
      );
  }
};

// Dialog Components (placeholder implementations)
const WidgetEditDialog: React.FC<{
  open: boolean;
  widget: DashboardWidget | null;
  onClose: () => void;
  onSave: (widget: DashboardWidget) => void;
}> = ({ open, widget, onClose, onSave }) => {
  const [title, setTitle] = useState(widget?.title || '');
  const [type, setType] = useState(widget?.type || 'system_status');
  const [refreshInterval, setRefreshInterval] = useState(widget?.config?.refreshInterval || 30);

  useEffect(() => {
    if (widget) {
      setTitle(widget.title);
      setType(widget.type);
      setRefreshInterval(widget.config?.refreshInterval || 30);
    }
  }, [widget]);

  const handleSave = () => {
    if (!widget) return;

    const updatedWidget: DashboardWidget = {
      ...widget,
      title,
      type,
      config: { ...widget.config, refreshInterval },
    };

    onSave(updatedWidget);
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>Edit Widget</DialogTitle>
      <DialogContent>
        <TextField
          autoFocus
          margin="dense"
          label="Widget Title"
          fullWidth
          variant="outlined"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          sx={{ mb: 2 }}
        />

        <FormControl fullWidth margin="dense" sx={{ mb: 2 }}>
          <InputLabel>Widget Type</InputLabel>
          <Select
            value={type}
            label="Widget Type"
            onChange={(e) => setType(e.target.value as any)}
          >
            {WIDGET_TYPES.map((widgetType) => (
              <MenuItem key={widgetType.value} value={widgetType.value}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  {widgetType.icon}
                  <Box>
                    <Typography variant="body2">{widgetType.label}</Typography>
                    <Typography variant="caption" color="text.secondary">
                      {widgetType.description}
                    </Typography>
                  </Box>
                </Box>
              </MenuItem>
            ))}
          </Select>
        </FormControl>

        <TextField
          margin="dense"
          label="Refresh Interval (seconds)"
          type="number"
          fullWidth
          variant="outlined"
          value={refreshInterval}
          onChange={(e) => setRefreshInterval(Number(e.target.value))}
        />
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button onClick={handleSave} variant="contained">Save</Button>
      </DialogActions>
    </Dialog>
  );
};

const DashboardSettingsDialog: React.FC<{
  open: boolean;
  dashboard: Dashboard | null;
  onClose: () => void;
  onSave: (dashboard: Dashboard) => void;
}> = ({ open, dashboard, onClose, onSave }) => {
  const [name, setName] = useState(dashboard?.name || '');
  const [description, setDescription] = useState(dashboard?.description || '');
  const [refreshInterval, setRefreshInterval] = useState(dashboard?.refreshInterval || 30);
  const [isPublic, setIsPublic] = useState(dashboard?.isPublic || false);

  useEffect(() => {
    if (dashboard) {
      setName(dashboard.name);
      setDescription(dashboard.description || '');
      setRefreshInterval(dashboard.refreshInterval);
      setIsPublic(dashboard.isPublic);
    }
  }, [dashboard]);

  const handleSave = () => {
    if (!dashboard) return;

    const updatedDashboard: Dashboard = {
      ...dashboard,
      name,
      description,
      refreshInterval,
      isPublic,
      updatedAt: new Date().toISOString(),
    };

    onSave(updatedDashboard);
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>Dashboard Settings</DialogTitle>
      <DialogContent>
        <TextField
          autoFocus
          margin="dense"
          label="Dashboard Name"
          fullWidth
          variant="outlined"
          value={name}
          onChange={(e) => setName(e.target.value)}
          sx={{ mb: 2 }}
        />

        <TextField
          margin="dense"
          label="Description"
          fullWidth
          multiline
          rows={3}
          variant="outlined"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          sx={{ mb: 2 }}
        />

        <TextField
          margin="dense"
          label="Refresh Interval (seconds)"
          type="number"
          fullWidth
          variant="outlined"
          value={refreshInterval}
          onChange={(e) => setRefreshInterval(Number(e.target.value))}
          sx={{ mb: 2 }}
        />

        <FormControlLabel
          control={
            <Switch
              checked={isPublic}
              onChange={(e) => setIsPublic(e.target.checked)}
            />
          }
          label="Public Dashboard"
        />
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button onClick={handleSave} variant="contained">Save</Button>
      </DialogActions>
    </Dialog>
  );
};

export default EnhancedMonitoringDashboard;