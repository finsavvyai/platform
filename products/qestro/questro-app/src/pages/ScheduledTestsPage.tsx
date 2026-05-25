import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  Calendar,
  Clock,
  Play,
  Pause,
  Plus,
  Settings,
  Bell,
  Mail,
  MessageSquare,
  Phone,
  Smartphone,
  Globe,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Loader2,
  BarChart3,
  Eye,
  Edit,
  Trash2,
  Copy,
  Search,
  Filter,
  Download,
  Zap,
  Shield,
  Database,
  TrendingUp,
  TrendingDown,
  Minus,
  Users,
  Target
} from 'lucide-react';

interface ScheduledTest {
  id: string;
  name: string;
  description?: string;
  dataSourceId: string;
  dataSourceName: string;
  testType: 'query' | 'api' | 'performance' | 'security';
  status: 'active' | 'paused' | 'stopped' | 'error';
  schedule: {
    type: 'cron' | 'interval' | 'once';
    expression: string;
    timezone?: string;
  };
  alerts: {
    enabled: boolean;
    conditions: AlertCondition[];
    channels: AlertChannel[];
  };
  lastRun?: string;
  nextRun?: string;
  runCount: number;
  successRate: number;
  avgResponseTime?: number;
  createdAt: string;
}

interface AlertCondition {
  id: string;
  name: string;
  metric: string;
  operator: 'gt' | 'lt' | 'eq' | 'gte' | 'lte' | 'ne';
  value: number;
  severity: 'low' | 'medium' | 'high' | 'critical';
}

interface AlertChannel {
  id: string;
  type: 'email' | 'sms' | 'slack' | 'webhook' | 'voice';
  config: any;
  severity: string[];
  enabled: boolean;
}

interface TestResult {
  id: string;
  testId: string;
  runId: string;
  startTime: string;
  duration: number;
  success: boolean;
  metrics: Record<string, number>;
  alertsTriggered: any[];
}

export default function ScheduledTestsPage() {
  const [scheduledTests, setScheduledTests] = useState<ScheduledTest[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showAlertsModal, setShowAlertsModal] = useState(false);
  const [selectedTest, setSelectedTest] = useState<ScheduledTest | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterType, setFilterType] = useState('all');
  const [recentResults, setRecentResults] = useState<TestResult[]>([]);
  const [summary, setSummary] = useState<any>(null);

  // Create form state
  const [createForm, setCreateForm] = useState({
    name: '',
    description: '',
    dataSourceId: '',
    testType: 'api',
    scheduleType: 'interval',
    scheduleExpression: '5m',
    timezone: 'UTC',
    config: '{}',
    alertsEnabled: true,
    conditions: [] as AlertCondition[],
    channels: [] as AlertChannel[]
  });

  useEffect(() => {
    fetchScheduledTests();
    fetchSummary();
    fetchRecentResults();
  }, []);

  const fetchScheduledTests = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/scheduled-tests', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        setScheduledTests(data.tests || []);
      }
    } catch (error) {
      console.error('Failed to fetch scheduled tests:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchSummary = async () => {
    try {
      const response = await fetch('/api/scheduled-tests/summary', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        setSummary(data);
      }
    } catch (error) {
      console.error('Failed to fetch summary:', error);
    }
  };

  const fetchRecentResults = async () => {
    try {
      const response = await fetch('/api/scheduled-tests/recent-results?limit=10', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        setRecentResults(data.results || []);
      }
    } catch (error) {
      console.error('Failed to fetch recent results:', error);
    }
  };

  const createScheduledTest = async () => {
    try {
      let config = {};
      try {
        config = JSON.parse(createForm.config);
      } catch {
        alert('Invalid JSON configuration');
        return;
      }

      const response = await fetch('/api/scheduled-tests', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({
          name: createForm.name,
          description: createForm.description,
          dataSourceId: createForm.dataSourceId,
          testType: createForm.testType,
          config,
          schedule: {
            type: createForm.scheduleType,
            expression: createForm.scheduleExpression,
            timezone: createForm.timezone
          },
          alerts: {
            enabled: createForm.alertsEnabled,
            conditions: createForm.conditions,
            channels: createForm.channels
          },
          status: 'active'
        })
      });
      
      if (response.ok) {
        const data = await response.json();
        setScheduledTests(prev => [...prev, data.test]);
        setShowCreateModal(false);
        resetCreateForm();
        alert('Scheduled test created successfully!');
      } else {
        const error = await response.json();
        alert(`Failed to create scheduled test: ${error.error}`);
      }
    } catch (error) {
      console.error('Test creation failed:', error);
      alert('Failed to create scheduled test');
    }
  };

  const toggleTestStatus = async (test: ScheduledTest) => {
    try {
      const newStatus = test.status === 'active' ? 'paused' : 'active';
      
      const response = await fetch(`/api/scheduled-tests/${test.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({ status: newStatus })
      });
      
      if (response.ok) {
        setScheduledTests(prev => prev.map(t => 
          t.id === test.id ? { ...t, status: newStatus } : t
        ));
      }
    } catch (error) {
      console.error('Failed to toggle test status:', error);
    }
  };

  const runTestNow = async (test: ScheduledTest) => {
    try {
      const response = await fetch(`/api/scheduled-tests/${test.id}/run`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      
      if (response.ok) {
        alert('Test started successfully!');
        fetchRecentResults();
      } else {
        const error = await response.json();
        alert(`Failed to run test: ${error.error}`);
      }
    } catch (error) {
      console.error('Failed to run test:', error);
      alert('Failed to run test');
    }
  };

  const deleteTest = async (test: ScheduledTest) => {
    if (!confirm(`Are you sure you want to delete "${test.name}"?`)) {
      return;
    }
    
    try {
      const response = await fetch(`/api/scheduled-tests/${test.id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      
      if (response.ok) {
        setScheduledTests(prev => prev.filter(t => t.id !== test.id));
        alert('Test deleted successfully!');
      }
    } catch (error) {
      console.error('Failed to delete test:', error);
      alert('Failed to delete test');
    }
  };

  const openAlertsModal = (test: ScheduledTest) => {
    setSelectedTest(test);
    setShowAlertsModal(true);
  };

  const addAlertCondition = () => {
    const newCondition: AlertCondition = {
      id: Date.now().toString(),
      name: 'New Condition',
      metric: 'responseTime',
      operator: 'gt',
      value: 1000,
      severity: 'medium'
    };
    
    setCreateForm(prev => ({
      ...prev,
      conditions: [...prev.conditions, newCondition]
    }));
  };

  const addAlertChannel = () => {
    const newChannel: AlertChannel = {
      id: Date.now().toString(),
      type: 'email',
      config: { recipients: [''] },
      severity: ['medium', 'high', 'critical'],
      enabled: true
    };
    
    setCreateForm(prev => ({
      ...prev,
      channels: [...prev.channels, newChannel]
    }));
  };

  const removeAlertCondition = (id: string) => {
    setCreateForm(prev => ({
      ...prev,
      conditions: prev.conditions.filter(c => c.id !== id)
    }));
  };

  const removeAlertChannel = (id: string) => {
    setCreateForm(prev => ({
      ...prev,
      channels: prev.channels.filter(c => c.id !== id)
    }));
  };

  const updateAlertCondition = (id: string, updates: Partial<AlertCondition>) => {
    setCreateForm(prev => ({
      ...prev,
      conditions: prev.conditions.map(c => 
        c.id === id ? { ...c, ...updates } : c
      )
    }));
  };

  const updateAlertChannel = (id: string, updates: Partial<AlertChannel>) => {
    setCreateForm(prev => ({
      ...prev,
      channels: prev.channels.map(c => 
        c.id === id ? { ...c, ...updates } : c
      )
    }));
  };

  const resetCreateForm = () => {
    setCreateForm({
      name: '',
      description: '',
      dataSourceId: '',
      testType: 'api',
      scheduleType: 'interval',
      scheduleExpression: '5m',
      timezone: 'UTC',
      config: '{}',
      alertsEnabled: true,
      conditions: [],
      channels: []
    });
  };

  const getTestTypeIcon = (type: string) => {
    switch (type) {
      case 'query': return Database;
      case 'api': return Globe;
      case 'performance': return Zap;
      case 'security': return Shield;
      default: return Target;
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'active': return CheckCircle;
      case 'paused': return Pause;
      case 'stopped': return Minus;
      case 'error': return XCircle;
      default: return AlertTriangle;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'text-green-600';
      case 'paused': return 'text-yellow-600';
      case 'stopped': return 'text-gray-600';
      case 'error': return 'text-red-600';
      default: return 'text-gray-600';
    }
  };

  const getAlertChannelIcon = (type: string) => {
    switch (type) {
      case 'email': return Mail;
      case 'sms': return Smartphone;
      case 'slack': return MessageSquare;
      case 'webhook': return Globe;
      case 'voice': return Phone;
      default: return Bell;
    }
  };

  const filteredTests = scheduledTests.filter(test => {
    const matchesSearch = test.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         test.description?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = filterStatus === 'all' || test.status === filterStatus;
    const matchesType = filterType === 'all' || test.testType === filterType;
    
    return matchesSearch && matchesStatus && matchesType;
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
        <span className="ml-2 text-gray-600">Loading scheduled tests...</span>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 mb-2">Scheduled Tests</h1>
              <p className="text-gray-600">
                Automate your testing with scheduled runs and comprehensive alerting
              </p>
            </div>
            <button
              onClick={() => setShowCreateModal(true)}
              className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              <Plus className="w-5 h-5 mr-2" />
              Schedule Test
            </button>
          </div>
        </div>

        {/* Summary Cards */}
        {summary && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <div className="flex items-center">
                <div className="p-2 bg-blue-100 rounded-lg">
                  <Calendar className="w-6 h-6 text-blue-600" />
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">Total Tests</p>
                  <p className="text-2xl font-bold text-gray-900">{summary.total}</p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <div className="flex items-center">
                <div className="p-2 bg-green-100 rounded-lg">
                  <CheckCircle className="w-6 h-6 text-green-600" />
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">Active</p>
                  <p className="text-2xl font-bold text-gray-900">{summary.active}</p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <div className="flex items-center">
                <div className="p-2 bg-yellow-100 rounded-lg">
                  <Pause className="w-6 h-6 text-yellow-600" />
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">Paused</p>
                  <p className="text-2xl font-bold text-gray-900">{summary.paused}</p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <div className="flex items-center">
                <div className="p-2 bg-red-100 rounded-lg">
                  <XCircle className="w-6 h-6 text-red-600" />
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">Failed</p>
                  <p className="text-2xl font-bold text-gray-900">{summary.failed}</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Filters */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
          <div className="flex flex-wrap gap-4 items-center">
            {/* Search */}
            <div className="relative flex-1 min-w-64">
              <Search className="absolute left-3 top-3 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search scheduled tests..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {/* Status Filter */}
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">All Statuses</option>
              <option value="active">Active</option>
              <option value="paused">Paused</option>
              <option value="stopped">Stopped</option>
              <option value="error">Error</option>
            </select>

            {/* Type Filter */}
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              className="border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">All Types</option>
              <option value="query">Database Query</option>
              <option value="api">API Testing</option>
              <option value="performance">Performance</option>
              <option value="security">Security</option>
            </select>
          </div>
        </div>

        {/* Tests Grid */}
        {filteredTests.length === 0 ? (
          <div className="text-center py-12">
            <Calendar className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No scheduled tests found</h3>
            <p className="text-gray-600 mb-6">
              {scheduledTests.length === 0 ? 
                'Get started by scheduling your first automated test' :
                'No tests match your current filters'
              }
            </p>
            {scheduledTests.length === 0 && (
              <button
                onClick={() => setShowCreateModal(true)}
                className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                <Plus className="w-5 h-5 mr-2" />
                Schedule Your First Test
              </button>
            )}
          </div>
        ) : (
          <div className="grid gap-6">
            {filteredTests.map((test) => {
              const TestTypeIcon = getTestTypeIcon(test.testType);
              const StatusIcon = getStatusIcon(test.status);
              
              return (
                <motion.div
                  key={test.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="bg-white rounded-lg shadow-sm border border-gray-200 p-6"
                >
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-start space-x-4">
                      <div className={`p-3 rounded-lg bg-gradient-to-r ${
                        test.testType === 'query' ? 'from-blue-500 to-cyan-500' :
                        test.testType === 'api' ? 'from-green-500 to-emerald-500' :
                        test.testType === 'performance' ? 'from-yellow-500 to-orange-500' :
                        'from-red-500 to-pink-500'
                      }`}>
                        <TestTypeIcon className="w-6 h-6 text-white" />
                      </div>
                      
                      <div>
                        <h3 className="text-lg font-semibold text-gray-900 mb-1">
                          {test.name}
                        </h3>
                        {test.description && (
                          <p className="text-gray-600 mb-2">{test.description}</p>
                        )}
                        <div className="flex items-center space-x-4 text-sm text-gray-600">
                          <span className="capitalize">{test.testType} Test</span>
                          <span>•</span>
                          <span>{test.dataSourceName}</span>
                          <span>•</span>
                          <span className={`inline-flex items-center ${getStatusColor(test.status)}`}>
                            <StatusIcon className="w-4 h-4 mr-1" />
                            {test.status.charAt(0).toUpperCase() + test.status.slice(1)}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Metrics */}
                    <div className="text-right">
                      <div className="text-2xl font-bold text-gray-900 mb-1">
                        {test.successRate.toFixed(1)}%
                      </div>
                      <div className="text-sm text-gray-600">Success Rate</div>
                      {test.avgResponseTime && (
                        <div className="text-sm text-gray-500 mt-1">
                          {test.avgResponseTime}ms avg
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Schedule Info */}
                  <div className="flex items-center space-x-6 mb-4 text-sm text-gray-600">
                    <div className="flex items-center">
                      <Clock className="w-4 h-4 mr-1" />
                      <span>Every {test.schedule.expression}</span>
                    </div>
                    {test.lastRun && (
                      <div className="flex items-center">
                        <span>Last run: {new Date(test.lastRun).toLocaleDateString()}</span>
                      </div>
                    )}
                    {test.nextRun && (
                      <div className="flex items-center">
                        <span>Next run: {new Date(test.nextRun).toLocaleDateString()}</span>
                      </div>
                    )}
                    <div className="flex items-center">
                      <span>{test.runCount} runs</span>
                    </div>
                  </div>

                  {/* Alert Channels */}
                  {test.alerts.enabled && test.alerts.channels.length > 0 && (
                    <div className="flex items-center space-x-2 mb-4">
                      <Bell className="w-4 h-4 text-gray-400" />
                      <span className="text-sm text-gray-600">Alerts:</span>
                      {test.alerts.channels.map((channel, index) => {
                        const ChannelIcon = getAlertChannelIcon(channel.type);
                        return (
                          <ChannelIcon
                            key={index}
                            className={`w-4 h-4 ${channel.enabled ? 'text-blue-600' : 'text-gray-400'}`}
                            title={`${channel.type} alerts ${channel.enabled ? 'enabled' : 'disabled'}`}
                          />
                        );
                      })}
                    </div>
                  )}

                  {/* Actions */}
                  <div className="flex items-center justify-between pt-4 border-t border-gray-200">
                    <div className="flex items-center space-x-2">
                      <button
                        onClick={() => toggleTestStatus(test)}
                        className={`inline-flex items-center px-3 py-1 text-sm font-medium rounded-lg transition-colors ${
                          test.status === 'active' 
                            ? 'text-yellow-600 bg-yellow-50 hover:bg-yellow-100'
                            : 'text-green-600 bg-green-50 hover:bg-green-100'
                        }`}
                      >
                        {test.status === 'active' ? (
                          <>
                            <Pause className="w-4 h-4 mr-1" />
                            Pause
                          </>
                        ) : (
                          <>
                            <Play className="w-4 h-4 mr-1" />
                            Resume
                          </>
                        )}
                      </button>
                      
                      <button
                        onClick={() => runTestNow(test)}
                        className="inline-flex items-center px-3 py-1 text-sm font-medium text-blue-600 bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors"
                      >
                        <Play className="w-4 h-4 mr-1" />
                        Run Now
                      </button>
                    </div>

                    <div className="flex items-center space-x-2">
                      <button
                        onClick={() => window.open(`/tests/scheduled/${test.id}/results`, '_blank')}
                        className="inline-flex items-center px-3 py-1 text-sm font-medium text-gray-600 hover:text-gray-800 transition-colors"
                      >
                        <BarChart3 className="w-4 h-4 mr-1" />
                        Results
                      </button>
                      
                      <button
                        onClick={() => openAlertsModal(test)}
                        className="inline-flex items-center px-3 py-1 text-sm font-medium text-purple-600 hover:text-purple-800 transition-colors"
                      >
                        <Bell className="w-4 h-4 mr-1" />
                        Alerts
                      </button>
                      
                      <button
                        onClick={() => {
                          // Open edit modal
                        }}
                        className="inline-flex items-center px-3 py-1 text-sm font-medium text-gray-600 hover:text-gray-800 transition-colors"
                      >
                        <Edit className="w-4 h-4" />
                      </button>
                      
                      <button
                        onClick={() => deleteTest(test)}
                        className="inline-flex items-center px-3 py-1 text-sm font-medium text-red-600 hover:text-red-800 transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}

        {/* Recent Results */}
        {recentResults.length > 0 && (
          <div className="mt-8 bg-white rounded-lg shadow-sm border border-gray-200">
            <div className="p-4 border-b border-gray-200">
              <h3 className="font-semibold text-gray-900">Recent Test Results</h3>
            </div>
            <div className="divide-y divide-gray-200">
              {recentResults.slice(0, 5).map((result) => (
                <div key={result.id} className="p-4 hover:bg-gray-50">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      {result.success ? (
                        <CheckCircle className="w-5 h-5 text-green-600" />
                      ) : (
                        <XCircle className="w-5 h-5 text-red-600" />
                      )}
                      <div>
                        <p className="font-medium text-gray-900">
                          {scheduledTests.find(t => t.id === result.testId)?.name || 'Unknown Test'}
                        </p>
                        <p className="text-sm text-gray-600">
                          {new Date(result.startTime).toLocaleString()} • {result.duration}ms
                        </p>
                      </div>
                    </div>
                    
                    <div className="flex items-center space-x-4 text-sm text-gray-600">
                      {Object.entries(result.metrics).map(([key, value]) => (
                        <span key={key}>{key}: {typeof value === 'number' ? value.toFixed(1) : value}</span>
                      ))}
                      {result.alertsTriggered.length > 0 && (
                        <span className="inline-flex items-center px-2 py-1 bg-red-100 text-red-800 text-xs rounded-full">
                          <AlertTriangle className="w-3 h-3 mr-1" />
                          {result.alertsTriggered.length} alerts
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Create Test Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-semibold">Schedule New Test</h2>
                <button
                  onClick={() => setShowCreateModal(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  ×
                </button>
              </div>

              <div className="space-y-6">
                {/* Basic Info */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Test Name
                    </label>
                    <input
                      type="text"
                      value={createForm.name}
                      onChange={(e) => setCreateForm(prev => ({ ...prev, name: e.target.value }))}
                      placeholder="My Scheduled Test"
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Test Type
                    </label>
                    <select
                      value={createForm.testType}
                      onChange={(e) => setCreateForm(prev => ({ ...prev, testType: e.target.value }))}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="api">API Testing</option>
                      <option value="query">Database Query</option>
                      <option value="performance">Performance Test</option>
                      <option value="security">Security Scan</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Description (Optional)
                  </label>
                  <textarea
                    value={createForm.description}
                    onChange={(e) => setCreateForm(prev => ({ ...prev, description: e.target.value }))}
                    rows={2}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Brief description of what this test does..."
                  />
                </div>

                {/* Schedule Configuration */}
                <div>
                  <h3 className="text-lg font-medium text-gray-900 mb-4">Schedule Configuration</h3>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Schedule Type
                      </label>
                      <select
                        value={createForm.scheduleType}
                        onChange={(e) => setCreateForm(prev => ({ ...prev, scheduleType: e.target.value }))}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="interval">Interval</option>
                        <option value="cron">Cron Expression</option>
                        <option value="once">Run Once</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        {createForm.scheduleType === 'interval' ? 'Interval' :
                         createForm.scheduleType === 'cron' ? 'Cron Expression' : 'Date/Time'}
                      </label>
                      <input
                        type="text"
                        value={createForm.scheduleExpression}
                        onChange={(e) => setCreateForm(prev => ({ ...prev, scheduleExpression: e.target.value }))}
                        placeholder={
                          createForm.scheduleType === 'interval' ? '5m, 1h, 30s' :
                          createForm.scheduleType === 'cron' ? '0 */5 * * *' : '2024-01-01T12:00:00Z'
                        }
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Timezone
                      </label>
                      <select
                        value={createForm.timezone}
                        onChange={(e) => setCreateForm(prev => ({ ...prev, timezone: e.target.value }))}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="UTC">UTC</option>
                        <option value="America/New_York">Eastern Time</option>
                        <option value="America/Los_Angeles">Pacific Time</option>
                        <option value="Europe/London">London</option>
                        <option value="Asia/Tokyo">Tokyo</option>
                      </select>
                    </div>
                  </div>
                </div>

                {/* Alert Configuration */}
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-medium text-gray-900">Alert Configuration</h3>
                    <label className="flex items-center">
                      <input
                        type="checkbox"
                        checked={createForm.alertsEnabled}
                        onChange={(e) => setCreateForm(prev => ({ ...prev, alertsEnabled: e.target.checked }))}
                        className="mr-2"
                      />
                      Enable Alerts
                    </label>
                  </div>

                  {createForm.alertsEnabled && (
                    <div className="space-y-4">
                      {/* Alert Conditions */}
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <h4 className="font-medium text-gray-900">Alert Conditions</h4>
                          <button
                            onClick={addAlertCondition}
                            className="text-blue-600 hover:text-blue-800 text-sm"
                          >
                            + Add Condition
                          </button>
                        </div>
                        
                        {createForm.conditions.map((condition) => (
                          <div key={condition.id} className="flex items-center space-x-2 p-3 bg-gray-50 rounded-lg mb-2">
                            <input
                              type="text"
                              value={condition.name}
                              onChange={(e) => updateAlertCondition(condition.id, { name: e.target.value })}
                              placeholder="Condition name"
                              className="flex-1 border border-gray-300 rounded px-2 py-1 text-sm"
                            />
                            
                            <select
                              value={condition.metric}
                              onChange={(e) => updateAlertCondition(condition.id, { metric: e.target.value })}
                              className="border border-gray-300 rounded px-2 py-1 text-sm"
                            >
                              <option value="responseTime">Response Time</option>
                              <option value="errorRate">Error Rate</option>
                              <option value="availability">Availability</option>
                              <option value="throughput">Throughput</option>
                            </select>
                            
                            <select
                              value={condition.operator}
                              onChange={(e) => updateAlertCondition(condition.id, { operator: e.target.value as any })}
                              className="border border-gray-300 rounded px-2 py-1 text-sm"
                            >
                              <option value="gt">Greater than</option>
                              <option value="lt">Less than</option>
                              <option value="gte">Greater than or equal</option>
                              <option value="lte">Less than or equal</option>
                              <option value="eq">Equal to</option>
                              <option value="ne">Not equal to</option>
                            </select>
                            
                            <input
                              type="number"
                              value={condition.value}
                              onChange={(e) => updateAlertCondition(condition.id, { value: parseFloat(e.target.value) })}
                              className="w-20 border border-gray-300 rounded px-2 py-1 text-sm"
                            />
                            
                            <select
                              value={condition.severity}
                              onChange={(e) => updateAlertCondition(condition.id, { severity: e.target.value as any })}
                              className="border border-gray-300 rounded px-2 py-1 text-sm"
                            >
                              <option value="low">Low</option>
                              <option value="medium">Medium</option>
                              <option value="high">High</option>
                              <option value="critical">Critical</option>
                            </select>
                            
                            <button
                              onClick={() => removeAlertCondition(condition.id)}
                              className="text-red-600 hover:text-red-800"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        ))}
                      </div>

                      {/* Alert Channels */}
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <h4 className="font-medium text-gray-900">Alert Channels</h4>
                          <button
                            onClick={addAlertChannel}
                            className="text-blue-600 hover:text-blue-800 text-sm"
                          >
                            + Add Channel
                          </button>
                        </div>
                        
                        {createForm.channels.map((channel) => (
                          <div key={channel.id} className="p-3 bg-gray-50 rounded-lg mb-2">
                            <div className="flex items-center space-x-2 mb-2">
                              <select
                                value={channel.type}
                                onChange={(e) => updateAlertChannel(channel.id, { type: e.target.value as any })}
                                className="border border-gray-300 rounded px-2 py-1 text-sm"
                              >
                                <option value="email">Email</option>
                                <option value="sms">SMS</option>
                                <option value="slack">Slack</option>
                                <option value="webhook">Webhook</option>
                                <option value="voice">Voice Call</option>
                              </select>
                              
                              <label className="flex items-center">
                                <input
                                  type="checkbox"
                                  checked={channel.enabled}
                                  onChange={(e) => updateAlertChannel(channel.id, { enabled: e.target.checked })}
                                  className="mr-1"
                                />
                                Enabled
                              </label>
                              
                              <button
                                onClick={() => removeAlertChannel(channel.id)}
                                className="text-red-600 hover:text-red-800 ml-auto"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                            
                            {/* Channel-specific configuration */}
                            {channel.type === 'email' && (
                              <input
                                type="email"
                                placeholder="email@example.com"
                                value={channel.config.recipients?.[0] || ''}
                                onChange={(e) => updateAlertChannel(channel.id, { 
                                  config: { ...channel.config, recipients: [e.target.value] }
                                })}
                                className="w-full border border-gray-300 rounded px-2 py-1 text-sm"
                              />
                            )}
                            
                            {channel.type === 'sms' && (
                              <input
                                type="tel"
                                placeholder="+1234567890"
                                value={channel.config.phoneNumbers?.[0] || ''}
                                onChange={(e) => updateAlertChannel(channel.id, { 
                                  config: { ...channel.config, phoneNumbers: [e.target.value] }
                                })}
                                className="w-full border border-gray-300 rounded px-2 py-1 text-sm"
                              />
                            )}
                            
                            {channel.type === 'slack' && (
                              <input
                                type="text"
                                placeholder="#alerts"
                                value={channel.config.channel || ''}
                                onChange={(e) => updateAlertChannel(channel.id, { 
                                  config: { ...channel.config, channel: e.target.value }
                                })}
                                className="w-full border border-gray-300 rounded px-2 py-1 text-sm"
                              />
                            )}
                            
                            {channel.type === 'webhook' && (
                              <input
                                type="url"
                                placeholder="https://example.com/webhook"
                                value={channel.config.url || ''}
                                onChange={(e) => updateAlertChannel(channel.id, { 
                                  config: { ...channel.config, url: e.target.value }
                                })}
                                className="w-full border border-gray-300 rounded px-2 py-1 text-sm"
                              />
                            )}
                            
                            {channel.type === 'voice' && (
                              <input
                                type="tel"
                                placeholder="+1234567890"
                                value={channel.config.phoneNumber || ''}
                                onChange={(e) => updateAlertChannel(channel.id, { 
                                  config: { ...channel.config, phoneNumber: e.target.value }
                                })}
                                className="w-full border border-gray-300 rounded px-2 py-1 text-sm"
                              />
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <div className="flex justify-end space-x-3 mt-6 pt-4 border-t border-gray-200">
                <button
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 text-gray-600 hover:text-gray-800 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={createScheduledTest}
                  disabled={!createForm.name || !createForm.dataSourceId}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
                >
                  Schedule Test
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}