import React, { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Grid,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  Button,
  IconButton,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  LinearProgress,
  Alert,
  Tooltip,
  Avatar,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Divider,
} from '@mui/material';
import {
  Timeline,
  TrendingUp,
  TrendingDown,
  People,
  AccessTime,
  Speed,
  CheckCircle,
  Error,
  Warning,
  Info,
  Refresh,
  Download,
  FilterList,
  CalendarToday,
  Assessment,
  Psychology,
  WorkOutline,
  Storage,
  SmartToy,
} from '@mui/icons-material';
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
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import { format, subDays, startOfDay, endOfDay } from 'date-fns';

// Types
interface AnalyticsData {
  overview: {
    totalUsers: number;
    activeUsers: number;
    totalWorkflows: number;
    activeWorkflows: number;
    totalDocuments: number;
    successfulExecutions: number;
    failedExecutions: number;
    averageResponseTime: number;
  };
  userActivity: Array<{
    date: string;
    activeUsers: number;
    newUsers: number;
    sessions: number;
    avgSessionDuration: number;
  }>;
  workflowUsage: Array<{
    name: string;
    executions: number;
    successRate: number;
    avgDuration: number;
    category: string;
  }>;
  documentStats: Array<{
    type: string;
    count: number;
    totalSize: number;
    avgProcessingTime: number;
  }>;
  agentPerformance: Array<{
    name: string;
    type: string;
    tasksCompleted: number;
    successRate: number;
    avgDuration: number;
    errors: number;
  }>;
  errorAnalysis: Array<{
    type: string;
    count: number;
    percentage: number;
    trend: 'up' | 'down' | 'stable';
  }>;
  featureUsage: Array<{
    feature: string;
    usage: number;
    users: number;
    satisfaction: number;
  }>;
}

interface AnalyticsDashboardProps {
  apiUrl?: string;
  userId?: string;
  isAdmin?: boolean;
}

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8', '#82ca9d'];

const AnalyticsDashboard: React.FC<AnalyticsDashboardProps> = ({
  apiUrl = 'http://localhost:8000',
  userId,
  isAdmin = false,
}) => {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [timeRange, setTimeRange] = useState('7d');
  const [refreshing, setRefreshing] = useState(false);

  const fetchAnalytics = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const params = new URLSearchParams({
        timeRange,
        ...(userId && !isAdmin && { userId }),
      });

      const endpoint = isAdmin ? '/api/v1/analytics/admin' : '/api/v1/analytics/user';
      const response = await fetch(`${apiUrl}${endpoint}?${params}`);

      if (!response.ok) throw new Error('Failed to fetch analytics data');

      const analyticsData = await response.json();
      setData(analyticsData);
    } catch (err) {
      console.error('Failed to fetch analytics:', err);
      setError('Failed to load analytics data');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [apiUrl, timeRange, userId, isAdmin]);

  useEffect(() => {
    fetchAnalytics();
  }, [fetchAnalytics]);

  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    fetchAnalytics();
  }, [fetchAnalytics]);

  const handleExport = useCallback(async () => {
    try {
      const params = new URLSearchParams({
        timeRange,
        format: 'csv',
        ...(userId && !isAdmin && { userId }),
      });

      const endpoint = isAdmin ? '/api/v1/analytics/admin/export' : '/api/v1/analytics/user/export';
      const response = await fetch(`${apiUrl}${endpoint}?${params}`);

      if (!response.ok) throw new Error('Failed to export data');

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `analytics-${timeRange}-${format(new Date(), 'yyyy-MM-dd')}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Failed to export analytics:', err);
      setError('Failed to export data');
    }
  }, [apiUrl, timeRange, userId, isAdmin]);

  if (loading) {
    return (
      <Box sx={{ p: 3 }}>
        <LinearProgress />
        <Typography variant="body2" sx={{ mt: 2, textAlign: 'center' }}>
          Loading analytics data...
        </Typography>
      </Box>
    );
  }

  if (error || !data) {
    return (
      <Box sx={{ p: 3 }}>
        <Alert severity="error" action={
          <IconButton onClick={handleRefresh}>
            <Refresh />
          </IconButton>
        }>
          {error || 'No analytics data available'}
        </Alert>
      </Box>
    );
  }

  const successRate = data.overview.totalExecutions > 0
    ? (data.overview.successfulExecutions / data.overview.totalExecutions * 100).toFixed(1)
    : '0';

  return (
    <Box sx={{ p: 3 }}>
      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4">
          {isAdmin ? 'System Analytics' : 'Your Analytics'}
        </Typography>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <FormControl size="small" sx={{ minWidth: 120 }}>
            <InputLabel>Time Range</InputLabel>
            <Select
              value={timeRange}
              onChange={(e) => setTimeRange(e.target.value)}
              label="Time Range"
            >
              <MenuItem value="1d">Last 24 hours</MenuItem>
              <MenuItem value="7d">Last 7 days</MenuItem>
              <MenuItem value="30d">Last 30 days</MenuItem>
              <MenuItem value="90d">Last 90 days</MenuItem>
            </Select>
          </FormControl>
          <Tooltip title="Refresh">
            <IconButton onClick={handleRefresh} disabled={refreshing}>
              <Refresh />
            </IconButton>
          </Tooltip>
          <Tooltip title="Export Data">
            <IconButton onClick={handleExport}>
              <Download />
            </IconButton>
          </Tooltip>
        </Box>
      </Box>

      {/* Overview Cards */}
      <Grid container spacing={3} sx={{ mb: 3 }}>
        {isAdmin ? (
          <>
            <Grid item xs={12} sm={6} md={3}>
              <Card>
                <CardContent>
                  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <Box>
                      <Typography color="textSecondary" gutterBottom>
                        Total Users
                      </Typography>
                      <Typography variant="h4">
                        {data.overview.totalUsers.toLocaleString()}
                      </Typography>
                    </Box>
                    <Avatar sx={{ bgcolor: 'primary.main' }}>
                      <People />
                    </Avatar>
                  </Box>
                  <Box sx={{ mt: 2, display: 'flex', alignItems: 'center' }}>
                    <TrendingUp color="success" />
                    <Typography variant="body2" color="success.main" sx={{ ml: 1 }}>
                      Active: {data.overview.activeUsers.toLocaleString()}
                    </Typography>
                  </Box>
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <Card>
                <CardContent>
                  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <Box>
                      <Typography color="textSecondary" gutterBottom>
                        Total Workflows
                      </Typography>
                      <Typography variant="h4">
                        {data.overview.totalWorkflows.toLocaleString()}
                      </Typography>
                    </Box>
                    <Avatar sx={{ bgcolor: 'secondary.main' }}>
                      <WorkOutline />
                    </Avatar>
                  </Box>
                  <Box sx={{ mt: 2, display: 'flex', alignItems: 'center' }}>
                    <CheckCircle color="success" />
                    <Typography variant="body2" color="success.main" sx={{ ml: 1 }}>
                      Active: {data.overview.activeWorkflows.toLocaleString()}
                    </Typography>
                  </Box>
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <Card>
                <CardContent>
                  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <Box>
                      <Typography color="textSecondary" gutterBottom>
                        Success Rate
                      </Typography>
                      <Typography variant="h4">
                        {successRate}%
                      </Typography>
                    </Box>
                    <Avatar sx={{ bgcolor: 'success.main' }}>
                      <Assessment />
                    </Avatar>
                  </Box>
                  <Box sx={{ mt: 2, display: 'flex', alignItems: 'center' }}>
                    <CheckCircle color="success" />
                    <Typography variant="body2" color="success.main" sx={{ ml: 1 }}>
                      {data.overview.successfulExecutions.toLocaleString()} successful
                    </Typography>
                  </Box>
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <Card>
                <CardContent>
                  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <Box>
                      <Typography color="textSecondary" gutterBottom>
                        Avg Response Time
                      </Typography>
                      <Typography variant="h4">
                        {data.overview.averageResponseTime}ms
                      </Typography>
                    </Box>
                    <Avatar sx={{ bgcolor: 'warning.main' }}>
                      <Speed />
                    </Avatar>
                  </Box>
                  <Box sx={{ mt: 2, display: 'flex', alignItems: 'center' }}>
                    <AccessTime color="warning" />
                    <Typography variant="body2" color="warning.main" sx={{ ml: 1 }}>
                      System performance
                    </Typography>
                  </Box>
                </CardContent>
              </Card>
            </Grid>
          </>
        ) : (
          <>
            <Grid item xs={12} sm={6} md={3}>
              <Card>
                <CardContent>
                  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <Box>
                      <Typography color="textSecondary" gutterBottom>
                        Your Workflows
                      </Typography>
                      <Typography variant="h4">
                        {data.overview.totalWorkflows}
                      </Typography>
                    </Box>
                    <Avatar sx={{ bgcolor: 'primary.main' }}>
                      <WorkOutline />
                    </Avatar>
                  </Box>
                  <Box sx={{ mt: 2, display: 'flex', alignItems: 'center' }}>
                    <CheckCircle color="success" />
                    <Typography variant="body2" color="success.main" sx={{ ml: 1 }}>
                      Active: {data.overview.activeWorkflows}
                    </Typography>
                  </Box>
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <Card>
                <CardContent>
                  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <Box>
                      <Typography color="textSecondary" gutterBottom>
                        Documents
                      </Typography>
                      <Typography variant="h4">
                        {data.overview.totalDocuments}
                      </Typography>
                    </Box>
                    <Avatar sx={{ bgcolor: 'secondary.main' }}>
                      <Storage />
                    </Avatar>
                  </Box>
                  <Box sx={{ mt: 2, display: 'flex', alignItems: 'center' }}>
                    <TrendingUp color="success" />
                    <Typography variant="body2" color="success.main" sx={{ ml: 1 }}>
                      Knowledge base
                    </Typography>
                  </Box>
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <Card>
                <CardContent>
                  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <Box>
                      <Typography color="textSecondary" gutterBottom>
                        Executions
                      </Typography>
                      <Typography variant="h4">
                        {data.overview.totalExecutions}
                      </Typography>
                    </Box>
                    <Avatar sx={{ bgcolor: 'success.main' }}>
                      <PlayArrow />
                    </Avatar>
                  </Box>
                  <Box sx={{ mt: 2, display: 'flex', alignItems: 'center' }}>
                    <CheckCircle color="success" />
                    <Typography variant="body2" color="success.main" sx={{ ml: 1 }}>
                      {successRate}% success rate
                    </Typography>
                  </Box>
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <Card>
                <CardContent>
                  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <Box>
                      <Typography color="textSecondary" gutterBottom>
                        Agent Tasks
                      </Typography>
                      <Typography variant="h4">
                        {data.agentPerformance.reduce((sum, agent) => sum + agent.tasksCompleted, 0)}
                      </Typography>
                    </Box>
                    <Avatar sx={{ bgcolor: 'info.main' }}>
                      <SmartToy />
                    </Avatar>
                  </Box>
                  <Box sx={{ mt: 2, display: 'flex', alignItems: 'center' }}>
                    <Psychology color="info" />
                    <Typography variant="body2" color="info.main" sx={{ ml: 1 }}>
                      AI assistance
                    </Typography>
                  </Box>
                </CardContent>
              </Card>
            </Grid>
          </>
        )}
      </Grid>

      {/* Charts Row 1 */}
      <Grid container spacing={3} sx={{ mb: 3 }}>
        {isAdmin && (
          <Grid item xs={12} md={8}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  User Activity Trends
                </Typography>
                <ResponsiveContainer width="100%" height={300}>
                  <AreaChart data={data.userActivity}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" />
                    <YAxis />
                    <RechartsTooltip />
                    <Legend />
                    <Area
                      type="monotone"
                      dataKey="activeUsers"
                      stackId="1"
                      stroke="#8884d8"
                      fill="#8884d8"
                      name="Active Users"
                    />
                    <Area
                      type="monotone"
                      dataKey="newUsers"
                      stackId="1"
                      stroke="#82ca9d"
                      fill="#82ca9d"
                      name="New Users"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </Grid>
        )}

        <Grid item xs={12} md={isAdmin ? 4 : 6}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Workflow Performance
              </Typography>
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={data.workflowUsage.slice(0, 5)}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, executions }) => `${name}: ${executions}`}
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="executions"
                  >
                    {data.workflowUsage.slice(0, 5).map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <RechartsTooltip />
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={isAdmin ? 12 : 6}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Top Workflows by Usage
              </Typography>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={data.workflowUsage.slice(0, 10)}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" angle={-45} textAnchor="end" height={100} />
                  <YAxis />
                  <RechartsTooltip />
                  <Bar dataKey="executions" fill="#8884d8" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Detailed Tables */}
      <Grid container spacing={3}>
        <Grid item xs={12} md={isAdmin ? 6 : 12}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Agent Performance
              </Typography>
              <TableContainer>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Agent</TableCell>
                      <TableCell>Type</TableCell>
                      <TableCell align="right">Tasks</TableCell>
                      <TableCell align="right">Success Rate</TableCell>
                      <TableCell align="right">Avg Duration</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {data.agentPerformance.map((agent) => (
                      <TableRow key={agent.name}>
                        <TableCell>{agent.name}</TableCell>
                        <TableCell>
                          <Chip label={agent.type} size="small" variant="outlined" />
                        </TableCell>
                        <TableCell align="right">{agent.tasksCompleted}</TableCell>
                        <TableCell align="right">
                          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end' }}>
                            {agent.successRate >= 90 ? (
                              <TrendingUp color="success" />
                            ) : agent.successRate >= 70 ? (
                              <Warning color="warning" />
                            ) : (
                              <TrendingDown color="error" />
                            )}
                            <Typography variant="body2" sx={{ ml: 1 }}>
                              {agent.successRate}%
                            </Typography>
                          </Box>
                        </TableCell>
                        <TableCell align="right">{agent.avgDuration}ms</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </CardContent>
          </Card>
        </Grid>

        {isAdmin && (
          <Grid item xs={12} md={6}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  Error Analysis
                </Typography>
                <List>
                  {data.errorAnalysis.map((error) => (
                    <ListItem key={error.type}>
                      <ListItemIcon>
                        {error.trend === 'up' ? (
                          <TrendingUp color="error" />
                        ) : error.trend === 'down' ? (
                          <TrendingDown color="success" />
                        ) : (
                          <Info color="info" />
                        )}
                      </ListItemIcon>
                      <ListItemText
                        primary={error.type}
                        secondary={`${error.count} occurrences (${error.percentage}%)`}
                      />
                      <Chip
                        label={error.trend}
                        color={error.trend === 'up' ? 'error' : error.trend === 'down' ? 'success' : 'default'}
                        size="small"
                      />
                    </ListItem>
                  ))}
                </List>
              </CardContent>
            </Card>
          </Grid>
        )}
      </Grid>
    </Box>
  );
};

export default AnalyticsDashboard;