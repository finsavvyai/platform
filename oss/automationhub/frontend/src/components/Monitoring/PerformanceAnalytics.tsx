/**
 * Performance Analytics Component
 *
 * Advanced analytics component for task performance with:
 * - Interactive charts and visualizations
 * - Performance trend analysis
 * - Resource optimization recommendations
 * - Export and reporting capabilities
 * - Custom time range selection
 */

import React, { useState, useEffect, useMemo } from 'react';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
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
  ScatterChart,
  Scatter,
} from 'recharts';
import {
  TrendingUp,
  TrendingDown,
  Activity,
  BarChart3,
  PieChart as PieChartIcon,
  Download,
  Calendar,
  Filter,
  Zap,
  Clock,
  CheckCircle,
  XCircle,
  AlertCircle,
  Info,
} from 'lucide-react';

interface PerformanceData {
  timestamp: string;
  taskType: string;
  executionTime: number;
  successRate: number;
  throughput: number;
  resourceUsage: {
    cpu: number;
    memory: number;
  };
  errorRate: number;
}

interface AnalyticsSummary {
  totalTasks: number;
  averageExecutionTime: number;
  successRate: number;
  throughput: number;
  peakPerformance: {
    timestamp: string;
    value: number;
  };
  bottlenecks: Array<{
    type: string;
    description: string;
    impact: 'high' | 'medium' | 'low';
  }>;
  recommendations: Array<{
    category: string;
    suggestion: string;
    priority: 'high' | 'medium' | 'low';
  }>;
}

interface TaskTypeDistribution {
  name: string;
  value: number;
  color: string;
}

interface TimeRangeOption {
  label: string;
  value: string;
  duration: number; // in hours
}

const PerformanceAnalytics: React.FC = () => {
  const [timeRange, setTimeRange] = useState('24h');
  const [selectedMetric, setSelectedMetric] = useState('executionTime');
  const [selectedTaskTypes, setSelectedTaskTypes] = useState<string[]>([]);
  const [performanceData, setPerformanceData] = useState<PerformanceData[]>([]);
  const [analyticsSummary, setAnalyticsSummary] = useState<AnalyticsSummary | null>(null);
  const [taskTypeDistribution, setTaskTypeDistribution] = useState<TaskTypeDistribution[]>([]);
  const [loading, setLoading] = useState(false);

  const timeRangeOptions: TimeRangeOption[] = [
    { label: 'Last Hour', value: '1h', duration: 1 },
    { label: 'Last 6 Hours', value: '6h', duration: 6 },
    { label: 'Last 24 Hours', value: '24h', duration: 24 },
    { label: 'Last Week', value: '7d', duration: 168 },
    { label: 'Last Month', value: '30d', duration: 720 },
  ];

  const metrics = [
    { value: 'executionTime', label: 'Execution Time', icon: Clock },
    { value: 'successRate', label: 'Success Rate', icon: CheckCircle },
    { value: 'throughput', label: 'Throughput', icon: Activity },
    { value: 'errorRate', label: 'Error Rate', icon: XCircle },
    { value: 'cpu', label: 'CPU Usage', icon: Zap },
    { value: 'memory', label: 'Memory Usage', icon: Activity },
  ];

  const taskTypes = [
    'browser_automation',
    'infrastructure',
    'conversation',
    'data_processing',
    'workflow',
    'custom',
  ];

  const COLORS = [
    '#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8',
    '#82CA9D', '#FFC658', '#FF7C7C', '#8DD1E1', '#D084D0'
  ];

  // Mock data generator (in real app, this would come from API)
  const generateMockData = (hours: number): PerformanceData[] => {
    const data: PerformanceData[] = [];
    const now = Date.now();
    const interval = hours > 24 ? 3600000 : 300000; // 1 hour or 5 minutes

    for (let i = 0; i < (hours * 3600000) / interval; i++) {
      const timestamp = new Date(now - (i * interval));
      const taskType = taskTypes[Math.floor(Math.random() * taskTypes.length)];

      data.push({
        timestamp: timestamp.toISOString(),
        taskType,
        executionTime: 500 + Math.random() * 2000,
        successRate: 85 + Math.random() * 15,
        throughput: 10 + Math.random() * 50,
        resourceUsage: {
          cpu: 20 + Math.random() * 60,
          memory: 30 + Math.random() * 50,
        },
        errorRate: Math.random() * 10,
      });
    }

    return data.reverse();
  };

  const fetchAnalyticsData = async () => {
    setLoading(true);
    try {
      // In real app: const response = await fetch(`/api/v1/monitoring/analytics?time_range=${timeRange}`);

      // Generate mock data for demonstration
      const duration = timeRangeOptions.find(opt => opt.value === timeRange)?.duration || 24;
      const mockData = generateMockData(duration);
      setPerformanceData(mockData);

      // Calculate analytics summary
      const totalTasks = mockData.length;
      const avgExecutionTime = mockData.reduce((sum, d) => sum + d.executionTime, 0) / totalTasks;
      const avgSuccessRate = mockData.reduce((sum, d) => sum + d.successRate, 0) / totalTasks;
      const avgThroughput = mockData.reduce((sum, d) => sum + d.throughput, 0) / totalTasks;

      const summary: AnalyticsSummary = {
        totalTasks,
        averageExecutionTime: avgExecutionTime,
        successRate: avgSuccessRate,
        throughput: avgThroughput,
        peakPerformance: {
          timestamp: mockData.reduce((best, d) => d.throughput > best.throughput ? d : best).timestamp,
          value: Math.max(...mockData.map(d => d.throughput)),
        },
        bottlenecks: [
          {
            type: 'High Memory Usage',
            description: 'Memory usage spikes during peak hours',
            impact: 'medium',
          },
          {
            type: 'Task Queue Backlog',
            description: 'Tasks waiting in queue during high load',
            impact: 'high',
          },
        ],
        recommendations: [
          {
            category: 'Performance',
            suggestion: 'Consider implementing task prioritization during peak hours',
            priority: 'high',
          },
          {
            category: 'Resources',
            suggestion: 'Scale up resources during predictable peak times',
            priority: 'medium',
          },
          {
            category: 'Optimization',
            suggestion: 'Optimize memory-intensive tasks to reduce resource usage',
            priority: 'low',
          },
        ],
      };

      setAnalyticsSummary(summary);

      // Calculate task type distribution
      const distribution: { [key: string]: number } = {};
      mockData.forEach(d => {
        distribution[d.taskType] = (distribution[d.taskType] || 0) + 1;
      });

      const typeDistribution: TaskTypeDistribution[] = Object.entries(distribution).map(([name, value], index) => ({
        name: name.replace('_', ' '),
        value,
        color: COLORS[index % COLORS.length],
      }));

      setTaskTypeDistribution(typeDistribution);

    } catch (error) {
      console.error('Failed to fetch analytics data:', error);
    } finally {
      setLoading(false);
    }
  };

  const getTrendIcon = (trend: 'up' | 'down' | 'stable') => {
    switch (trend) {
      case 'up':
        return <TrendingUp className="h-4 w-4 text-green-500" />;
      case 'down':
        return <TrendingDown className="h-4 w-4 text-red-500" />;
      default:
        return <Activity className="h-4 w-4 text-blue-500" />;
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high': return 'bg-red-100 text-red-800 border-red-200';
      case 'medium': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'low': return 'bg-green-100 text-green-800 border-green-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const exportAnalytics = async () => {
    try {
      const exportData = {
        timeRange,
        analyticsSummary,
        performanceData,
        taskTypeDistribution,
        exportedAt: new Date().toISOString(),
      };

      const blob = new Blob([JSON.stringify(exportData, null, 2)], {
        type: 'application/json',
      });

      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `performance-analytics-${timeRange}-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Failed to export analytics:', error);
    }
  };

  const filteredData = useMemo(() => {
    if (selectedTaskTypes.length === 0) return performanceData;
    return performanceData.filter(d => selectedTaskTypes.includes(d.taskType));
  }, [performanceData, selectedTaskTypes]);

  useEffect(() => {
    fetchAnalyticsData();
  }, [timeRange]);

  const selectedMetricInfo = metrics.find(m => m.value === selectedMetric);
  const MetricIcon = selectedMetricInfo?.icon || Activity;

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Performance Analytics</h1>
          <p className="text-muted-foreground">
            Advanced insights and trends for task performance
          </p>
        </div>

        <div className="flex gap-2">
          <Select value={timeRange} onValueChange={setTimeRange}>
            <SelectTrigger className="w-40">
              <Calendar className="h-4 w-4 mr-2" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {timeRangeOptions.map(option => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Button variant="outline" onClick={exportAnalytics}>
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>

          <Button onClick={fetchAnalyticsData} disabled={loading}>
            <Activity className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      {analyticsSummary && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Tasks</CardTitle>
              <BarChart3 className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{analyticsSummary.totalTasks.toLocaleString()}</div>
              <p className="text-xs text-muted-foreground">
                In selected time range
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
                {(analyticsSummary.averageExecutionTime / 1000).toFixed(2)}s
              </div>
              <p className="text-xs text-muted-foreground">Per task</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Success Rate</CardTitle>
              <CheckCircle className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{analyticsSummary.successRate.toFixed(1)}%</div>
              <p className="text-xs text-muted-foreground">Tasks completed successfully</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Throughput</CardTitle>
              <Activity className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{analyticsSummary.throughput.toFixed(1)}</div>
              <p className="text-xs text-muted-foreground">Tasks per hour</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Filters and Controls */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Filter className="h-5 w-5" />
            Filters and Configuration
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-4">
            <div className="flex-1 min-w-64">
              <label className="text-sm font-medium mb-2 block">Metric to Analyze</label>
              <Select value={selectedMetric} onValueChange={setSelectedMetric}>
                <SelectTrigger>
                  <div className="flex items-center gap-2">
                    <MetricIcon className="h-4 w-4" />
                    <SelectValue />
                  </div>
                </SelectTrigger>
                <SelectContent>
                  {metrics.map(metric => {
                    const Icon = metric.icon;
                    return (
                      <SelectItem key={metric.value} value={metric.value}>
                        <div className="flex items-center gap-2">
                          <Icon className="h-4 w-4" />
                          {metric.label}
                        </div>
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>

            <div className="flex-1 min-w-64">
              <label className="text-sm font-medium mb-2 block">Task Types</label>
              <div className="flex flex-wrap gap-2">
                {taskTypes.map(type => (
                  <Badge
                    key={type}
                    variant={selectedTaskTypes.includes(type) ? "default" : "outline"}
                    className="cursor-pointer"
                    onClick={() => {
                      setSelectedTaskTypes(prev =>
                        prev.includes(type)
                          ? prev.filter(t => t !== type)
                          : [...prev, type]
                      );
                    }}
                  >
                    {type.replace('_', ' ')}
                  </Badge>
                ))}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Main Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Performance Trend Chart */}
        <Card>
          <CardHeader>
            <CardTitle>Performance Trends</CardTitle>
            <CardDescription>
              {selectedMetricInfo?.label} over time
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={filteredData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis
                  dataKey="timestamp"
                  tickFormatter={(value) => new Date(value).toLocaleTimeString()}
                />
                <YAxis />
                <Tooltip
                  labelFormatter={(value) => new Date(value).toLocaleString()}
                />
                <Legend />
                <Line
                  type="monotone"
                  dataKey={selectedMetric}
                  stroke="#2563eb"
                  strokeWidth={2}
                  dot={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Task Type Distribution */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <PieChartIcon className="h-5 w-5" />
              Task Type Distribution
            </CardTitle>
            <CardDescription>Distribution of tasks by type</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={taskTypeDistribution}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {taskTypeDistribution.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Resource Usage Analysis */}
      <Card>
        <CardHeader>
          <CardTitle>Resource Usage Analysis</CardTitle>
          <CardDescription>CPU and Memory usage correlation with performance</CardDescription>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={400}>
            <AreaChart data={filteredData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis
                dataKey="timestamp"
                tickFormatter={(value) => new Date(value).toLocaleTimeString()}
              />
              <YAxis />
              <Tooltip
                labelFormatter={(value) => new Date(value).toLocaleString()}
              />
              <Legend />
              <Area
                type="monotone"
                dataKey="resourceUsage.cpu"
                stackId="1"
                stroke="#2563eb"
                fill="#2563eb"
                fillOpacity={0.6}
                name="CPU %"
              />
              <Area
                type="monotone"
                dataKey="resourceUsage.memory"
                stackId="2"
                stroke="#16a34a"
                fill="#16a34a"
                fillOpacity={0.6}
                name="Memory %"
              />
            </AreaChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Insights and Recommendations */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Performance Bottlenecks */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5" />
              Performance Bottlenecks
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {analyticsSummary?.bottlenecks.map((bottleneck, index) => (
                <div key={index} className="flex items-start gap-3 p-3 border rounded">
                  <div className="mt-1">
                    <div className={`w-2 h-2 rounded-full ${
                      bottleneck.impact === 'high' ? 'bg-red-500' :
                      bottleneck.impact === 'medium' ? 'bg-yellow-500' :
                      'bg-blue-500'
                    }`} />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <p className="font-medium text-sm">{bottleneck.type}</p>
                      <Badge
                        variant="outline"
                        className={getPriorityColor(bottleneck.impact)}
                      >
                        {bottleneck.impact}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">{bottleneck.description}</p>
                  </div>
                </div>
              ))}

              {(!analyticsSummary?.bottlenecks || analyticsSummary.bottlenecks.length === 0) && (
                <p className="text-center text-muted-foreground py-4">
                  No performance bottlenecks detected
                </p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Recommendations */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Info className="h-5 w-5" />
              Optimization Recommendations
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {analyticsSummary?.recommendations.map((recommendation, index) => (
                <div key={index} className="p-3 border rounded">
                  <div className="flex items-center gap-2 mb-2">
                    <Badge
                      variant="outline"
                      className={getPriorityColor(recommendation.priority)}
                    >
                      {recommendation.priority}
                    </Badge>
                    <span className="font-medium text-sm">{recommendation.category}</span>
                  </div>
                  <p className="text-sm text-muted-foreground">{recommendation.suggestion}</p>
                </div>
              ))}

              {(!analyticsSummary?.recommendations || analyticsSummary.recommendations.length === 0) && (
                <p className="text-center text-muted-foreground py-4">
                  No recommendations available at this time
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default PerformanceAnalytics;