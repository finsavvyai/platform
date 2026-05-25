/**
 * Comprehensive Task Monitoring Dashboard
 *
 * This component provides real-time monitoring of task execution with:
 * - Live task status updates via WebSocket
 * - Performance metrics visualization
 * - Resource usage monitoring
 * - Alert management
 * - Interactive charts and analytics
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  LineChart,
  Line,
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import {
  Activity,
  Cpu,
  HardDrive,
  Network,
  AlertTriangle,
  CheckCircle,
  Clock,
  Users,
  TrendingUp,
  TrendingDown,
  Pause,
  Play,
  Square,
  RefreshCw,
  Download,
  Settings,
  Bell,
  BellOff,
} from 'lucide-react';

interface TaskMetrics {
  total: number;
  running: number;
  completed: number;
  failed: number;
  pending: number;
  successRate: number;
  averageExecutionTime: number;
}

interface ResourceMetrics {
  cpuPercent: number;
  memoryPercent: number;
  memoryUsedGB: number;
  diskPercent: number;
  networkIO: {
    sent: number;
    received: number;
  };
}

interface Alert {
  id: string;
  type: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  title: string;
  description: string;
  timestamp: string;
  resolved: boolean;
}

interface PerformanceData {
  timestamp: string;
  cpu: number;
  memory: number;
  tasks: number;
  responseTime: number;
}

interface TaskExecutionEvent {
  taskId: string;
  eventType: string;
  timestamp: string;
  data: any;
}

const TaskMonitoringDashboard: React.FC = () => {
  const [isConnected, setIsConnected] = useState(false);
  const [isSubscribed, setIsSubscribed] = useState(true);
  const [taskMetrics, setTaskMetrics] = useState<TaskMetrics>({
    total: 0,
    running: 0,
    completed: 0,
    failed: 0,
    pending: 0,
    successRate: 0,
    averageExecutionTime: 0,
  });
  const [resourceMetrics, setResourceMetrics] = useState<ResourceMetrics>({
    cpuPercent: 0,
    memoryPercent: 0,
    memoryUsedGB: 0,
    diskPercent: 0,
    networkIO: { sent: 0, received: 0 },
  });
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [performanceData, setPerformanceData] = useState<PerformanceData[]>([]);
  const [recentEvents, setRecentEvents] = useState<TaskExecutionEvent[]>([]);
  const [selectedTimeRange, setSelectedTimeRange] = useState('1h');
  const [autoRefresh, setAutoRefresh] = useState(true);

  const websocketRef = useRef<WebSocket | null>(null);
  const refreshIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // WebSocket connection
  const connectWebSocket = useCallback(() => {
    const wsUrl = `${process.env.REACT_APP_WS_URL || 'ws://localhost:8000'}/api/v1/monitoring/ws/user-id`;

    try {
      websocketRef.current = new WebSocket(wsUrl);

      websocketRef.current.onopen = () => {
        setIsConnected(true);
        console.log('WebSocket connected');

        // Subscribe to updates
        if (websocketRef.current) {
          websocketRef.current.send(JSON.stringify({
            type: 'subscribe_alerts',
            subscribe: true
          }));
        }
      };

      websocketRef.current.onmessage = (event) => {
        const message = JSON.parse(event.data);
        handleWebSocketMessage(message);
      };

      websocketRef.current.onclose = () => {
        setIsConnected(false);
        console.log('WebSocket disconnected');

        // Attempt to reconnect after 3 seconds
        setTimeout(connectWebSocket, 3000);
      };

      websocketRef.current.onerror = (error) => {
        console.error('WebSocket error:', error);
        setIsConnected(false);
      };

    } catch (error) {
      console.error('Failed to connect WebSocket:', error);
      setIsConnected(false);
    }
  }, []);

  const handleWebSocketMessage = (message: any) => {
    switch (message.type) {
      case 'task_event':
        handleTaskEvent(message.data);
        break;
      case 'alert':
        handleNewAlert(message.data);
        break;
      case 'system_status':
        handleSystemStatus(message.data);
        break;
      case 'performance_update':
        handlePerformanceUpdate(message.data);
        break;
      default:
        console.log('Unknown message type:', message.type);
    }
  };

  const handleTaskEvent = (event: TaskExecutionEvent) => {
    setRecentEvents(prev => [event, ...prev.slice(0, 49)]); // Keep last 50 events

    // Update task metrics based on event type
    if (event.eventType === 'task_completed') {
      setTaskMetrics(prev => ({
        ...prev,
        running: Math.max(0, prev.running - 1),
        completed: prev.completed + 1,
        successRate: ((prev.completed + 1) / (prev.total)) * 100
      }));
    } else if (event.eventType === 'task_failed') {
      setTaskMetrics(prev => ({
        ...prev,
        running: Math.max(0, prev.running - 1),
        failed: prev.failed + 1,
        successRate: (prev.completed / (prev.total)) * 100
      }));
    } else if (event.eventType === 'task_started') {
      setTaskMetrics(prev => ({
        ...prev,
        pending: Math.max(0, prev.pending - 1),
        running: prev.running + 1
      }));
    }
  };

  const handleNewAlert = (alert: Alert) => {
    setAlerts(prev => [alert, ...prev.slice(0, 99)]); // Keep last 100 alerts
  };

  const handleSystemStatus = (status: any) => {
    if (status.system_metrics) {
      setResourceMetrics({
        cpuPercent: status.system_metrics.cpu_percent || 0,
        memoryPercent: status.system_metrics.memory_percent || 0,
        memoryUsedGB: status.system_metrics.memory_used_gb || 0,
        diskPercent: status.system_metrics.disk_percent || 0,
        networkIO: {
          sent: status.system_metrics.network_sent_mb || 0,
          received: status.system_metrics.network_received_mb || 0,
        },
      });
    }

    if (status.task_executor) {
      setTaskMetrics(prev => ({
        ...prev,
        running: status.task_executor.running_tasks || prev.running,
        total: (status.task_executor.running_tasks || 0) +
               (status.task_executor.pending_tasks || 0) +
               prev.completed + prev.failed + prev.running
      }));
    }
  };

  const handlePerformanceUpdate = (data: any) => {
    const newPerformanceData: PerformanceData = {
      timestamp: data.timestamp || new Date().toISOString(),
      cpu: data.cpu_percent || 0,
      memory: data.memory_percent || 0,
      tasks: data.running_tasks || 0,
      responseTime: data.response_time_ms || 0,
    };

    setPerformanceData(prev => [...prev.slice(-29), newPerformanceData]); // Keep last 30 data points
  };

  const fetchMonitoringData = async () => {
    try {
      const response = await fetch('/api/v1/monitoring/analytics?time_range=' + selectedTimeRange);
      const data = await response.json();

      if (data.performance) {
        handleSystemStatus(data);
      }
    } catch (error) {
      console.error('Failed to fetch monitoring data:', error);
    }
  };

  const toggleSubscription = () => {
    if (websocketRef.current && websocketRef.current.readyState === WebSocket.OPEN) {
      const newSubscriptionState = !isSubscribed;
      setIsSubscribed(newSubscriptionState);

      websocketRef.current.send(JSON.stringify({
        type: 'subscribe_alerts',
        subscribe: newSubscriptionState
      }));
    }
  };

  const resolveAlert = async (alertId: string) => {
    try {
      await fetch(`/api/v1/monitoring/alerts/${alertId}/resolve`, {
        method: 'PUT',
      });

      setAlerts(prev => prev.map(alert =>
        alert.id === alertId ? { ...alert, resolved: true } : alert
      ));
    } catch (error) {
      console.error('Failed to resolve alert:', error);
    }
  };

  const exportData = async () => {
    try {
      const response = await fetch(`/api/v1/monitoring/analytics/export?time_range=${selectedTimeRange}`);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `monitoring-data-${selectedTimeRange}.json`;
      a.click();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Failed to export data:', error);
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical': return 'bg-red-500';
      case 'high': return 'bg-orange-500';
      case 'medium': return 'bg-yellow-500';
      case 'low': return 'bg-blue-500';
      default: return 'bg-gray-500';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'running': return 'bg-blue-500';
      case 'completed': return 'bg-green-500';
      case 'failed': return 'bg-red-500';
      case 'pending': return 'bg-yellow-500';
      default: return 'bg-gray-500';
    }
  };

  useEffect(() => {
    connectWebSocket();
    fetchMonitoringData();

    return () => {
      if (websocketRef.current) {
        websocketRef.current.close();
      }
      if (refreshIntervalRef.current) {
        clearInterval(refreshIntervalRef.current);
      }
    };
  }, [connectWebSocket]);

  useEffect(() => {
    if (autoRefresh) {
      refreshIntervalRef.current = setInterval(fetchMonitoringData, 30000); // Refresh every 30 seconds
    } else {
      if (refreshIntervalRef.current) {
        clearInterval(refreshIntervalRef.current);
      }
    }

    return () => {
      if (refreshIntervalRef.current) {
        clearInterval(refreshIntervalRef.current);
      }
    };
  }, [autoRefresh, selectedTimeRange]);

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Task Monitoring Dashboard</h1>
          <p className="text-muted-foreground">
            Real-time monitoring and analytics for task execution
          </p>
        </div>

        <div className="flex gap-2">
          <div className="flex items-center gap-2 px-3 py-1 border rounded">
            <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'}`} />
            <span className="text-sm">{isConnected ? 'Connected' : 'Disconnected'}</span>
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={() => setAutoRefresh(!autoRefresh)}
          >
            {autoRefresh ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
            Auto Refresh
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={toggleSubscription}
          >
            {isSubscribed ? <Bell className="h-4 w-4" /> : <BellOff className="h-4 w-4" />}
            Alerts
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={fetchMonitoringData}
          >
            <RefreshCw className="h-4 w-4" />
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={exportData}
          >
            <Download className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Task Metrics Overview */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Running Tasks</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{taskMetrics.running}</div>
            <p className="text-xs text-muted-foreground">
              {taskMetrics.total} total tasks
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Success Rate</CardTitle>
            <CheckCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{taskMetrics.successRate.toFixed(1)}%</div>
            <p className="text-xs text-muted-foreground">
              {taskMetrics.completed} completed, {taskMetrics.failed} failed
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg Execution Time</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {(taskMetrics.averageExecutionTime / 1000).toFixed(1)}s
            </div>
            <p className="text-xs text-muted-foreground">Last 24 hours</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Agents</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">0</div>
            <p className="text-xs text-muted-foreground">Available for tasks</p>
          </CardContent>
        </Card>
      </div>

      {/* Resource Usage and Performance Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Resource Usage */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Cpu className="h-5 w-5" />
              Resource Usage
            </CardTitle>
            <CardDescription>Real-time system resource monitoring</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div>
                <div className="flex justify-between mb-1">
                  <span className="text-sm font-medium">CPU Usage</span>
                  <span className="text-sm">{resourceMetrics.cpuPercent.toFixed(1)}%</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className="bg-blue-600 h-2 rounded-full"
                    style={{ width: `${resourceMetrics.cpuPercent}%` }}
                  />
                </div>
              </div>

              <div>
                <div className="flex justify-between mb-1">
                  <span className="text-sm font-medium">Memory Usage</span>
                  <span className="text-sm">{resourceMetrics.memoryPercent.toFixed(1)}%</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className="bg-green-600 h-2 rounded-full"
                    style={{ width: `${resourceMetrics.memoryPercent}%` }}
                  />
                </div>
              </div>

              <div>
                <div className="flex justify-between mb-1">
                  <span className="text-sm font-medium">Disk Usage</span>
                  <span className="text-sm">{resourceMetrics.diskPercent.toFixed(1)}%</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className="bg-yellow-600 h-2 rounded-full"
                    style={{ width: `${resourceMetrics.diskPercent}%` }}
                  />
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Performance Chart */}
        <Card>
          <CardHeader>
            <CardTitle>Performance Trends</CardTitle>
            <CardDescription>Task execution performance over time</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={performanceData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis
                  dataKey="timestamp"
                  tickFormatter={(value) => new Date(value).toLocaleTimeString()}
                />
                <YAxis />
                <Tooltip />
                <Legend />
                <Line
                  type="monotone"
                  dataKey="cpu"
                  stroke="#2563eb"
                  strokeWidth={2}
                  name="CPU %"
                />
                <Line
                  type="monotone"
                  dataKey="memory"
                  stroke="#16a34a"
                  strokeWidth={2}
                  name="Memory %"
                />
                <Line
                  type="monotone"
                  dataKey="responseTime"
                  stroke="#dc2626"
                  strokeWidth={2}
                  name="Response Time"
                />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Alerts and Recent Events */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Active Alerts */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5" />
              Active Alerts
              <Badge variant="secondary">{alerts.filter(a => !a.resolved).length}</Badge>
            </CardTitle>
            <CardDescription>Recent monitoring alerts and notifications</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3 max-h-96 overflow-y-auto">
              {alerts.slice(0, 10).map((alert) => (
                <Alert
                  key={alert.id}
                  className={`border-l-4 ${
                    alert.severity === 'critical' ? 'border-red-500' :
                    alert.severity === 'high' ? 'border-orange-500' :
                    alert.severity === 'medium' ? 'border-yellow-500' :
                    'border-blue-500'
                  }`}
                >
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <Badge
                          variant="secondary"
                          className={getSeverityColor(alert.severity)}
                        >
                          {alert.severity}
                        </Badge>
                        <span className="text-sm font-medium">{alert.title}</span>
                      </div>
                      <AlertDescription className="text-sm">
                        {alert.description}
                      </AlertDescription>
                      <p className="text-xs text-muted-foreground mt-1">
                        {new Date(alert.timestamp).toLocaleString()}
                      </p>
                    </div>
                    {!alert.resolved && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => resolveAlert(alert.id)}
                      >
                        Resolve
                      </Button>
                    )}
                  </div>
                </Alert>
              ))}

              {alerts.length === 0 && (
                <p className="text-center text-muted-foreground py-4">
                  No active alerts
                </p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Recent Events */}
        <Card>
          <CardHeader>
            <CardTitle>Recent Events</CardTitle>
            <CardDescription>Latest task execution events</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {recentEvents.map((event, index) => (
                <div
                  key={`${event.taskId}-${index}`}
                  className="flex items-center justify-between py-2 border-b last:border-b-0"
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-2 h-2 rounded-full ${
                      event.eventType === 'task_completed' ? 'bg-green-500' :
                      event.eventType === 'task_failed' ? 'bg-red-500' :
                      event.eventType === 'task_started' ? 'bg-blue-500' :
                      'bg-gray-500'
                    }`} />
                    <div>
                      <p className="text-sm font-medium">{event.eventType}</p>
                      <p className="text-xs text-muted-foreground">
                        Task: {event.taskId.slice(0, 8)}...
                      </p>
                    </div>
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {new Date(event.timestamp).toLocaleTimeString()}
                  </span>
                </div>
              ))}

              {recentEvents.length === 0 && (
                <p className="text-center text-muted-foreground py-4">
                  No recent events
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default TaskMonitoringDashboard;