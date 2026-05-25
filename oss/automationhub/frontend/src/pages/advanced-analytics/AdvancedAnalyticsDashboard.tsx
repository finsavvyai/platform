import React, { useState, useEffect } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Grid,
  Button,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Chip,
  Alert,
  CircularProgress,
  Tabs,
  Tab,
  IconButton,
  Tooltip,
  Paper,
  LinearProgress,
  Badge,
  Avatar,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Switch,
  FormControlLabel,
  Divider,
  AppBar,
  Toolbar,
} from '@mui/material';
import {
  Timeline,
  TimelineItem,
  TimelineSeparator,
  TimelineConnector,
  TimelineContent,
  TimelineDot,
} from '@mui/lab';
import {
  Refresh as RefreshIcon,
  TrendingUp as TrendingUpIcon,
  Warning as WarningIcon,
  Assessment as AssessmentIcon,
  Speed as SpeedIcon,
  Timeline as TimelineIcon,
  Cloud as CloudIcon,
  Settings as SettingsIcon,
  Notifications as NotificationsIcon,
  Download as DownloadIcon,
  Visibility as VisibilityIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  FilterList as FilterListIcon,
  Schedule as ScheduleIcon,
  Lightbulb as LightbulbIcon,
  Security as SecurityIcon,
  CheckCircle as CheckCircleIcon,
  Error as ErrorIcon,
  Info as InfoIcon,
  AutoGraph as AutoGraphIcon,
  DataThresholding as DataThresholdingIcon,
  Leaderboard as LeaderboardIcon,
  Insights as InsightsIcon,
  SmartToy as SmartToyIcon,
  Computer as ComputerIcon,
  Storage as StorageIcon,
  Memory as MemoryIcon,
  NetworkCheck as NetworkCheckIcon,
  Cpu as CpuIcon,
  Analytics as AnalyticsIcon,
  PredictiveAnalytics as PredictiveAnalyticsIcon,
  ReportProblem as ReportProblemIcon,
  Suggested as SuggestedIcon,
} from '@mui/icons-material';
import { format, subDays, subHours, subMinutes } from 'date-fns';
import {
  LineChart,
  Line,
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart,
  Pie,
  ScatterChart,
  Scatter,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  Legend,
  ResponsiveContainer,
  Cell,
} from 'recharts';

// Types
interface AnalyticsMetric {
  id: string;
  metricName: string;
  metricType: string;
  value: number;
  unit: string;
  resourceType: string;
  timestamp: string;
  tags?: Record<string, string>;
}

interface AnomalyDetection {
  id: string;
  anomalyType: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  score: number;
  metricName: string;
  resourceType: string;
  description: string;
  firstDetectedAt: string;
  status: 'open' | 'acknowledged' | 'resolved';
}

interface IntelligenceReport {
  id: string;
  reportName: string;
  reportType: string;
  executiveSummary: string;
  totalMetricsAnalyzed: number;
  anomaliesDetected: number;
  keyInsights: Array<{
    title: string;
    description: string;
    significance: number;
  }>;
  recommendations: Array<{
    action: string;
    priority: string;
    impact: string;
  }>;
  generatedAt: string;
}

interface DashboardMetrics {
  totalMetrics: number;
  activeAnomalies: number;
  predictiveModels: number;
  intelligenceReports: number;
  insightsGenerated: number;
  systemHealth: number;
}

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

const TabPanel: React.FC<TabPanelProps> = ({ children, value, index }) => (
  <div hidden={value !== index}>
    {value === index && <Box sx={{ p: 3 }}>{children}</Box>}
  </div>
);

const AdvancedAnalyticsDashboard: React.FC = () => {
  const [tabValue, setTabValue] = useState(0);
  const [loading, setLoading] = useState(false);
  const [metrics, setMetrics] = useState<AnalyticsMetric[]>([]);
  const [anomalies, setAnomalies] = useState<AnomalyDetection[]>([]);
  const [intelligenceReports, setIntelligenceReports] = useState<IntelligenceReport[]>([]);
  const [dashboardMetrics, setDashboardMetrics] = useState<DashboardMetrics | null>(null);
  const [selectedTimeRange, setSelectedTimeRange] = useState('24h');
  const [selectedProvider, setSelectedProvider] = useState('all');
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [lastRefresh, setLastRefresh] = useState(new Date());

  useEffect(() => {
    loadDashboardData();
    if (autoRefresh) {
      const interval = setInterval(loadDashboardData, 30000); // Refresh every 30 seconds
      return () => clearInterval(interval);
    }
  }, [selectedTimeRange, selectedProvider, autoRefresh]);

  const loadDashboardData = async () => {
    setLoading(true);
    try {
      // Load dashboard metrics
      const metricsResponse = await fetch('/api/v1/analytics/dashboard/metrics');
      if (metricsResponse.ok) {
        const metricsData = await metricsResponse.json();
        setDashboardMetrics(metricsData);
      }

      // Load recent metrics
      const recentMetricsResponse = await fetch(
        `/api/v1/analytics/metrics/recent?timeRange=${selectedTimeRange}&provider=${selectedProvider}`
      );
      if (recentMetricsResponse.ok) {
        const metricsData = await recentMetricsResponse.json();
        setMetrics(metricsData);
      }

      // Load active anomalies
      const anomaliesResponse = await fetch('/api/v1/analytics/anomalies/active');
      if (anomaliesResponse.ok) {
        const anomaliesData = await anomaliesResponse.json();
        setAnomalies(anomaliesData);
      }

      // Load intelligence reports
      const reportsResponse = await fetch('/api/v1/analytics/reports/recent');
      if (reportsResponse.ok) {
        const reportsData = await reportsResponse.json();
        setIntelligenceReports(reportsData);
      }

      setLastRefresh(new Date());
    } catch (error) {
      console.error('Failed to load dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleTabChange = (event: React.SyntheticEvent, newValue: number) => {
    setTabValue(newValue);
  };

  const collectMetrics = async () => {
    try {
      const response = await fetch('/api/v1/analytics/metrics/collect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          providers: selectedProvider === 'all' ? [] : [selectedProvider],
          metrics: ['cpu', 'memory', 'disk', 'network', 'response_time'],
        }),
      });
      if (response.ok) {
        loadDashboardData();
      }
    } catch (error) {
      console.error('Failed to collect metrics:', error);
    }
  };

  const detectAnomalies = async () => {
    try {
      const response = await fetch('/api/v1/analytics/anomalies/detect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          analysisType: 'comprehensive',
          sensitivity: 'medium',
        }),
      });
      if (response.ok) {
        loadDashboardData();
      }
    } catch (error) {
      console.error('Failed to detect anomalies:', error);
    }
  };

  const generateReport = async (reportType: string) => {
    try {
      const response = await fetch('/api/v1/analytics/reports/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reportType,
          analysisPeriod: '7d',
          includeCharts: true,
          includeRecommendations: true,
        }),
      });
      if (response.ok) {
        loadDashboardData();
      }
    } catch (error) {
      console.error('Failed to generate report:', error);
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical': return 'error';
      case 'high': return 'warning';
      case 'medium': return 'info';
      case 'low': return 'success';
      default: return 'default';
    }
  };

  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case 'critical': return <ErrorIcon />;
      case 'high': return <WarningIcon />;
      case 'medium': return <InfoIcon />;
      case 'low': return <CheckCircleIcon />;
      default: return <InfoIcon />;
    }
  };

  const formatMetricValue = (value: number, unit: string) => {
    if (unit === 'percentage') return `${value.toFixed(1)}%`;
    if (unit === 'bytes') return `${(value / 1024 / 1024).toFixed(1)} MB`;
    if (unit === 'milliseconds') return `${value.toFixed(0)} ms`;
    return value.toFixed(2);
  };

  const getProviderIcon = (provider: string) => {
    switch (provider?.toLowerCase()) {
      case 'aws': return <CloudIcon sx={{ color: '#FF9900' }} />;
      case 'azure': return <CloudIcon sx={{ color: '#0078D4' }} />;
      case 'gcp': return <CloudIcon sx={{ color: '#4285F4' }} />;
      case 'cloudflare': return <CloudIcon sx={{ color: '#F48120' }} />;
      default: return <CloudIcon />;
    }
  };

  const metricsTimeSeriesData = metrics.slice(0, 50).map((metric, index) => ({
    time: format(new Date(metric.timestamp), 'HH:mm'),
    value: metric.value,
    name: metric.metricName,
  }));

  const anomalyDistribution = anomalies.reduce((acc, anomaly) => {
    const existing = acc.find(item => item.type === anomaly.anomalyType);
    if (existing) {
      existing.count += 1;
    } else {
      acc.push({ type: anomaly.anomalyType, count: 1 });
    }
    return acc;
  }, [] as Array<{ type: string; count: number }>);

  const COLORS = ['#8884d8', '#82ca9d', '#ffc658', '#ff7300', '#0088FE'];

  return (
    <Box sx={{ flexGrow: 1, bgcolor: 'background.default', minHeight: '100vh' }}>
      {/* Header */}
      <AppBar position="static" color="default" elevation={1}>
        <Toolbar>
          <Box sx={{ display: 'flex', alignItems: 'center', flexGrow: 1 }}>
            <AnalyticsIcon sx={{ mr: 2, color: 'primary.main' }} />
            <Typography variant="h6" component="div" sx={{ flexGrow: 1 }}>
              Advanced Analytics & Intelligence
            </Typography>
          </Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <FormControl size="small" sx={{ minWidth: 120 }}>
              <InputLabel>Time Range</InputLabel>
              <Select
                value={selectedTimeRange}
                label="Time Range"
                onChange={(e) => setSelectedTimeRange(e.target.value)}
              >
                <MenuItem value="1h">Last Hour</MenuItem>
                <MenuItem value="24h">Last 24 Hours</MenuItem>
                <MenuItem value="7d">Last 7 Days</MenuItem>
                <MenuItem value="30d">Last 30 Days</MenuItem>
              </Select>
            </FormControl>
            <FormControl size="small" sx={{ minWidth: 120 }}>
              <InputLabel>Provider</InputLabel>
              <Select
                value={selectedProvider}
                label="Provider"
                onChange={(e) => setSelectedProvider(e.target.value)}
              >
                <MenuItem value="all">All Providers</MenuItem>
                <MenuItem value="aws">AWS</MenuItem>
                <MenuItem value="azure">Azure</MenuItem>
                <MenuItem value="gcp">Google Cloud</MenuItem>
                <MenuItem value="cloudflare">Cloudflare</MenuItem>
              </Select>
            </FormControl>
            <FormControlLabel
              control={
                <Switch
                  checked={autoRefresh}
                  onChange={(e) => setAutoRefresh(e.target.checked)}
                />
              }
              label="Auto Refresh"
            />
            <Tooltip title="Refresh Data">
              <IconButton onClick={loadDashboardData} disabled={loading}>
                <RefreshIcon />
              </IconButton>
            </Tooltip>
          </Box>
        </Toolbar>
      </AppBar>

      {/* Metrics Overview Cards */}
      {dashboardMetrics && (
        <Box sx={{ p: 3 }}>
          <Grid container spacing={3}>
            <Grid item xs={12} sm={6} md={3}>
              <Card>
                <CardContent>
                  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <Box>
                      <Typography color="textSecondary" gutterBottom>
                        Total Metrics
                      </Typography>
                      <Typography variant="h4">
                        {dashboardMetrics.totalMetrics.toLocaleString()}
                      </Typography>
                    </Box>
                    <Avatar sx={{ bgcolor: 'primary.main' }}>
                      <DataThresholdingIcon />
                    </Avatar>
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
                        Active Anomalies
                      </Typography>
                      <Typography variant="h4" color="warning.main">
                        {dashboardMetrics.activeAnomalies}
                      </Typography>
                    </Box>
                    <Avatar sx={{ bgcolor: 'warning.main' }}>
                      <ReportProblemIcon />
                    </Avatar>
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
                        Predictive Models
                      </Typography>
                      <Typography variant="h4" color="success.main">
                        {dashboardMetrics.predictiveModels}
                      </Typography>
                    </Box>
                    <Avatar sx={{ bgcolor: 'success.main' }}>
                      <PredictiveAnalyticsIcon />
                    </Avatar>
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
                        Intelligence Reports
                      </Typography>
                      <Typography variant="h4" color="info.main">
                        {dashboardMetrics.intelligenceReports}
                      </Typography>
                    </Box>
                    <Avatar sx={{ bgcolor: 'info.main' }}>
                      <InsightsIcon />
                    </Avatar>
                  </Box>
                </CardContent>
              </Card>
            </Grid>
          </Grid>

          {/* Quick Actions */}
          <Box sx={{ mt: 3, display: 'flex', gap: 2, flexWrap: 'wrap' }}>
            <Button
              variant="contained"
              startIcon={<DataThresholdingIcon />}
              onClick={collectMetrics}
              disabled={loading}
            >
              Collect Metrics
            </Button>
            <Button
              variant="contained"
              startIcon={<SecurityIcon />}
              onClick={detectAnomalies}
              disabled={loading}
            >
              Detect Anomalies
            </Button>
            <Button
              variant="contained"
              startIcon={<AssessmentIcon />}
              onClick={() => generateReport('performance')}
              disabled={loading}
            >
              Generate Performance Report
            </Button>
            <Button
              variant="contained"
              startIcon={<SmartToyIcon />}
              onClick={() => generateReport('predictive')}
              disabled={loading}
            >
              Generate Predictive Analysis
            </Button>
          </Box>

          {/* Main Content Tabs */}
          <Box sx={{ mt: 3 }}>
            <Paper>
              <Tabs
                value={tabValue}
                onChange={handleTabChange}
                variant="scrollable"
                scrollButtons="auto"
              >
                <Tab label="Metrics Overview" icon={<DataThresholdingIcon />} />
                <Tab label="Anomalies" icon={<SecurityIcon />} />
                <Tab label="Predictions" icon={<TrendingUpIcon />} />
                <Tab label="Intelligence Reports" icon={<AssessmentIcon />} />
                <Tab label="Insights" icon={<LightbulbIcon />} />
              </Tabs>
            </Paper>

            <TabPanel value={tabValue} index={0}>
              <Grid container spacing={3}>
                {/* Metrics Time Series */}
                <Grid item xs={12} md={8}>
                  <Card>
                    <CardContent>
                      <Typography variant="h6" gutterBottom>
                        Metrics Time Series
                      </Typography>
                      <ResponsiveContainer width="100%" height={300}>
                        <LineChart data={metricsTimeSeriesData}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis dataKey="time" />
                          <YAxis />
                          <RechartsTooltip />
                          <Legend />
                          <Line type="monotone" dataKey="value" stroke="#8884d8" />
                        </LineChart>
                      </ResponsiveContainer>
                    </CardContent>
                  </Card>
                </Grid>

                {/* Metric Types Distribution */}
                <Grid item xs={12} md={4}>
                  <Card>
                    <CardContent>
                      <Typography variant="h6" gutterBottom>
                        Metric Types
                      </Typography>
                      <ResponsiveContainer width="100%" height={300}>
                        <PieChart>
                          <Pie
                            data={anomalyDistribution}
                            cx="50%"
                            cy="50%"
                            labelLine={false}
                            label={({ type, count }) => `${type}: ${count}`}
                            outerRadius={80}
                            fill="#8884d8"
                            dataKey="count"
                          >
                            {anomalyDistribution.map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                            ))}
                          </Pie>
                          <RechartsTooltip />
                        </PieChart>
                      </ResponsiveContainer>
                    </CardContent>
                  </Card>
                </Grid>

                {/* Recent Metrics Table */}
                <Grid item xs={12}>
                  <Card>
                    <CardContent>
                      <Typography variant="h6" gutterBottom>
                        Recent Metrics
                      </Typography>
                      <List>
                        {metrics.slice(0, 10).map((metric, index) => (
                          <ListItem key={metric.id} divider={index < 9}>
                            <ListItemIcon>
                              {getProviderIcon(metric.tags?.provider || 'unknown')}
                            </ListItemIcon>
                            <ListItemText
                              primary={`${metric.metricName} - ${metric.resourceType}`}
                              secondary={
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                  <Typography variant="body2" color="textPrimary">
                                    {formatMetricValue(metric.value, metric.unit)}
                                  </Typography>
                                  <Chip size="small" label={metric.metricType} />
                                  <Typography variant="caption" color="textSecondary">
                                    {format(new Date(metric.timestamp), 'MMM d, HH:mm:ss')}
                                  </Typography>
                                </Box>
                              }
                            />
                          </ListItem>
                        ))}
                      </List>
                    </CardContent>
                  </Card>
                </Grid>
              </Grid>
            </TabPanel>

            <TabPanel value={tabValue} index={1}>
              <Grid container spacing={3}>
                {/* Anomaly Timeline */}
                <Grid item xs={12} md={6}>
                  <Card>
                    <CardContent>
                      <Typography variant="h6" gutterBottom>
                        Anomaly Timeline
                      </Typography>
                      <Timeline>
                        {anomalies.slice(0, 8).map((anomaly) => (
                          <TimelineItem key={anomaly.id}>
                            <TimelineSeparator>
                              <TimelineDot color={getSeverityColor(anomaly.severity) as any}>
                                {getSeverityIcon(anomaly.severity)}
                              </TimelineDot>
                              <TimelineConnector />
                            </TimelineSeparator>
                            <TimelineContent>
                              <Typography variant="body1" fontWeight="bold">
                                {anomaly.anomalyType}
                              </Typography>
                              <Typography variant="body2" color="textSecondary">
                                {anomaly.resourceType} - Score: {anomaly.score.toFixed(2)}
                              </Typography>
                              <Typography variant="caption" color="textSecondary">
                                {format(new Date(anomaly.firstDetectedAt), 'MMM d, HH:mm')}
                              </Typography>
                            </TimelineContent>
                          </TimelineItem>
                        ))}
                      </Timeline>
                    </CardContent>
                  </Card>
                </Grid>

                {/* Anomaly Statistics */}
                <Grid item xs={12} md={6}>
                  <Card>
                    <CardContent>
                      <Typography variant="h6" gutterBottom>
                        Anomaly Statistics
                      </Typography>
                      <ResponsiveContainer width="100%" height={400}>
                        <BarChart data={anomalyDistribution}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis dataKey="type" />
                          <YAxis />
                          <RechartsTooltip />
                          <Bar dataKey="count" fill="#8884d8" />
                        </BarChart>
                      </ResponsiveContainer>
                    </CardContent>
                  </Card>
                </Grid>

                {/* Active Anomalies List */}
                <Grid item xs={12}>
                  <Card>
                    <CardContent>
                      <Typography variant="h6" gutterBottom>
                        Active Anomalies
                      </Typography>
                      <List>
                        {anomalies.map((anomaly) => (
                          <ListItem key={anomaly.id} divider>
                            <ListItemIcon>
                              <Badge color={getSeverityColor(anomaly.severity) as any} variant="dot">
                                {getSeverityIcon(anomaly.severity)}
                              </Badge>
                            </ListItemIcon>
                            <ListItemText
                              primary={
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                  <Typography variant="body1" fontWeight="bold">
                                    {anomaly.anomalyType}
                                  </Typography>
                                  <Chip
                                    size="small"
                                    label={anomaly.severity}
                                    color={getSeverityColor(anomaly.severity) as any}
                                  />
                                  <Chip
                                    size="small"
                                    label={anomaly.status}
                                    variant="outlined"
                                  />
                                </Box>
                              }
                              secondary={
                                <Box>
                                  <Typography variant="body2">
                                    {anomaly.description}
                                  </Typography>
                                  <Typography variant="caption" color="textSecondary">
                                    {anomaly.resourceType} • First detected: {format(new Date(anomaly.firstDetectedAt), 'MMM d, HH:mm:ss')}
                                  </Typography>
                                </Box>
                              }
                            />
                            <Box>
                              <Tooltip title="View Details">
                                <IconButton size="small">
                                  <VisibilityIcon />
                                </IconButton>
                              </Tooltip>
                            </Box>
                          </ListItem>
                        ))}
                      </List>
                    </CardContent>
                  </Card>
                </Grid>
              </Grid>
            </TabPanel>

            <TabPanel value={tabValue} index={2}>
              <Grid container spacing={3}>
                <Grid item xs={12}>
                  <Card>
                    <CardContent>
                      <Typography variant="h6" gutterBottom>
                        Predictive Analytics
                      </Typography>
                      <Alert severity="info" sx={{ mb: 3 }}>
                        Predictive models are running in the background to forecast performance metrics and detect potential issues before they occur.
                      </Alert>
                      <Typography variant="body1">
                        Forecasting and prediction capabilities are being developed. This tab will display:
                      </Typography>
                      <List>
                        <ListItem>
                          <ListItemIcon>
                            <TrendingUpIcon />
                          </ListItemIcon>
                          <ListItemText
                            primary="Performance Forecasts"
                            secondary="Predict future resource utilization and performance bottlenecks"
                          />
                        </ListItem>
                        <ListItem>
                          <ListItemIcon>
                            <ScheduleIcon />
                          </ListItemIcon>
                          <ListItemText
                            primary="Capacity Planning"
                            secondary="Optimize resource allocation based on predicted growth"
                          />
                        </ListItem>
                        <ListItem>
                          <ListItemIcon>
                            <AutoGraphIcon />
                          </ListItemIcon>
                          <ListItemText
                            primary="Trend Analysis"
                            secondary="Identify long-term patterns and seasonal variations"
                          />
                        </ListItem>
                      </List>
                    </CardContent>
                  </Card>
                </Grid>
              </Grid>
            </TabPanel>

            <TabPanel value={tabValue} index={3}>
              <Grid container spacing={3}>
                {intelligenceReports.map((report) => (
                  <Grid item xs={12} md={6} key={report.id}>
                    <Card>
                      <CardContent>
                        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
                          <Typography variant="h6">
                            {report.reportName}
                          </Typography>
                          <Chip
                            label={report.reportType}
                            color="primary"
                            variant="outlined"
                          />
                        </Box>
                        <Typography variant="body2" color="textSecondary" paragraph>
                          {report.executiveSummary}
                        </Typography>
                        <Box sx={{ display: 'flex', gap: 2, mb: 2 }}>
                          <Box sx={{ textAlign: 'center' }}>
                            <Typography variant="h4" color="primary.main">
                              {report.totalMetricsAnalyzed.toLocaleString()}
                            </Typography>
                            <Typography variant="caption" color="textSecondary">
                              Metrics Analyzed
                            </Typography>
                          </Box>
                          <Box sx={{ textAlign: 'center' }}>
                            <Typography variant="h4" color="warning.main">
                              {report.anomaliesDetected}
                            </Typography>
                            <Typography variant="caption" color="textSecondary">
                              Anomalies Detected
                            </Typography>
                          </Box>
                        </Box>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <Typography variant="caption" color="textSecondary">
                            Generated {format(new Date(report.generatedAt), 'MMM d, HH:mm')}
                          </Typography>
                          <Box>
                            <Tooltip title="Download Report">
                              <IconButton size="small">
                                <DownloadIcon />
                              </IconButton>
                            </Tooltip>
                            <Tooltip title="View Details">
                              <IconButton size="small">
                                <VisibilityIcon />
                              </IconButton>
                            </Tooltip>
                          </Box>
                        </Box>
                      </CardContent>
                    </Card>
                  </Grid>
                ))}
              </Grid>
            </TabPanel>

            <TabPanel value={tabValue} index={4}>
              <Grid container spacing={3}>
                <Grid item xs={12}>
                  <Card>
                    <CardContent>
                      <Typography variant="h6" gutterBottom>
                        AI-Generated Insights
                      </Typography>
                      <Alert severity="success" sx={{ mb: 3 }}>
                        Our AI system continuously analyzes your infrastructure data to generate actionable insights and recommendations.
                      </Alert>
                      <Typography variant="body1">
                        AI-powered insights are being continuously generated. This section will display:
                      </Typography>
                      <List>
                        <ListItem>
                          <ListItemIcon>
                            <LightbulbIcon />
                          </ListItemIcon>
                          <ListItemText
                            primary="Performance Optimization"
                            secondary="AI-generated recommendations to improve system performance"
                          />
                        </ListItem>
                        <ListItem>
                          <ListItemIcon>
                            <SuggestedIcon />
                          </ListItemIcon>
                          <ListItemText
                            primary="Cost Optimization"
                            secondary="Intelligent suggestions to reduce cloud spending"
                          />
                        </ListItem>
                        <ListItem>
                          <ListItemIcon>
                            <SecurityIcon />
                          </ListItemIcon>
                          <ListItemText
                            primary="Security Insights"
                            secondary="Proactive security recommendations based on pattern analysis"
                          />
                        </ListItem>
                      </List>
                    </CardContent>
                  </Card>
                </Grid>
              </Grid>
            </TabPanel>
          </Box>

          {/* Status Bar */}
          <Box sx={{ mt: 3, p: 2, bgcolor: 'background.paper', borderRadius: 1 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Typography variant="caption" color="textSecondary">
                Last updated: {format(lastRefresh, 'MMM d, HH:mm:ss')}
              </Typography>
              <Typography variant="caption" color="textSecondary">
                {autoRefresh ? 'Auto-refresh enabled (30s)' : 'Auto-refresh disabled'}
              </Typography>
            </Box>
          </Box>
        </Box>
      )}
    </Box>
  );
};

export default AdvancedAnalyticsDashboard;