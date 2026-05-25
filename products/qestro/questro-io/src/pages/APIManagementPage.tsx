import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  Globe,
  Plus,
  Settings,
  Play,
  TestTube,
  BarChart3,
  Search,
  Filter,
  MoreVertical,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Loader2,
  Edit,
  Trash2,
  Copy,
  Eye,
  Zap,
  Server,
  Code,
  CloudCog,
  Webhook,
  Activity,
  FileText,
  Link,
  Shield,
  Clock,
  TrendingUp
} from 'lucide-react';

interface APIEndpoint {
  id: string;
  name: string;
  baseUrl: string;
  version: string;
  authentication: {
    type: string;
    config: any;
  };
  healthStatus: 'healthy' | 'degraded' | 'down' | 'unknown';
  lastHealthCheck?: string;
  isActive: boolean;
  tags: string[];
  createdAt: string;
}

interface WebhookEndpoint {
  id: string;
  name: string;
  url: string;
  events: string[];
  isActive: boolean;
  successCount: number;
  failureCount: number;
  lastTriggered?: string;
  createdAt: string;
}

interface Integration {
  id: string;
  name: string;
  type: 'webhook' | 'polling' | 'streaming' | 'batch';
  provider: string;
  isActive: boolean;
  lastSync?: string;
  syncStats: {
    totalRecords: number;
    successfulRecords: number;
    failedRecords: number;
  };
  createdAt: string;
}

export default function APIManagementPage() {
  const [activeTab, setActiveTab] = useState<'endpoints' | 'webhooks' | 'integrations' | 'analytics'>('endpoints');
  const [endpoints, setEndpoints] = useState<APIEndpoint[]>([]);
  const [webhooks, setWebhooks] = useState<WebhookEndpoint[]>([]);
  const [integrations, setIntegrations] = useState<Integration[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedItem, setSelectedItem] = useState<any>(null);

  // Create form states
  const [endpointForm, setEndpointForm] = useState({
    name: '',
    description: '',
    baseUrl: '',
    version: '1.0',
    authentication: { type: 'none', config: {} },
    headers: '{}',
    rateLimit: '',
    timeout: 30000,
    tags: []
  });

  const [webhookForm, setWebhookForm] = useState({
    name: '',
    url: '',
    events: [],
    headers: '{}',
    retryPolicy: JSON.stringify({ attempts: 3, delay: 1000, exponentialBackoff: true })
  });

  const [integrationForm, setIntegrationForm] = useState({
    name: '',
    type: 'polling',
    provider: '',
    config: '{}',
    dataMappings: '[]'
  });

  useEffect(() => {
    fetchData();
  }, [activeTab]);

  const fetchData = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      
      switch (activeTab) {
        case 'endpoints':
          const endpointsResponse = await fetch('/api/api-management/endpoints', {
            headers: { 'Authorization': `Bearer ${token}` }
          });
          if (endpointsResponse.ok) {
            const data = await endpointsResponse.json();
            setEndpoints(data.endpoints || []);
          }
          break;

        case 'webhooks':
          const webhooksResponse = await fetch('/api/api-management/webhooks', {
            headers: { 'Authorization': `Bearer ${token}` }
          });
          if (webhooksResponse.ok) {
            const data = await webhooksResponse.json();
            setWebhooks(data.webhooks || []);
          }
          break;

        case 'integrations':
          const integrationsResponse = await fetch('/api/api-management/integrations', {
            headers: { 'Authorization': `Bearer ${token}` }
          });
          if (integrationsResponse.ok) {
            const data = await integrationsResponse.json();
            setIntegrations(data.integrations || []);
          }
          break;
      }
    } catch (error) {
      console.error('Failed to fetch data:', error);
    } finally {
      setLoading(false);
    }
  };

  const createEndpoint = async () => {
    try {
      const token = localStorage.getItem('token');
      let headers = {};
      let rateLimit = null;

      try {
        headers = JSON.parse(endpointForm.headers || '{}');
      } catch (e) {
        alert('Invalid JSON in headers');
        return;
      }

      if (endpointForm.rateLimit) {
        try {
          rateLimit = JSON.parse(endpointForm.rateLimit);
        } catch (e) {
          alert('Invalid JSON in rate limit configuration');
          return;
        }
      }

      const response = await fetch('/api/api-management/endpoints', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          ...endpointForm,
          headers,
          rateLimit
        })
      });

      if (response.ok) {
        const data = await response.json();
        setEndpoints(prev => [...prev, data.endpoint]);
        setShowCreateModal(false);
        resetForms();
        alert('API endpoint created successfully!');
      } else {
        const error = await response.json();
        alert(`Failed to create endpoint: ${error.error}`);
      }
    } catch (error) {
      console.error('Failed to create endpoint:', error);
      alert('Failed to create endpoint');
    }
  };

  const createWebhook = async () => {
    try {
      const token = localStorage.getItem('token');
      let headers = {};
      let retryPolicy = {};

      try {
        headers = JSON.parse(webhookForm.headers || '{}');
        retryPolicy = JSON.parse(webhookForm.retryPolicy);
      } catch (e) {
        alert('Invalid JSON in configuration');
        return;
      }

      const response = await fetch('/api/api-management/webhooks', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          ...webhookForm,
          headers,
          retryPolicy
        })
      });

      if (response.ok) {
        const data = await response.json();
        setWebhooks(prev => [...prev, data.webhook]);
        setShowCreateModal(false);
        resetForms();
        alert('Webhook created successfully!');
      } else {
        const error = await response.json();
        alert(`Failed to create webhook: ${error.error}`);
      }
    } catch (error) {
      console.error('Failed to create webhook:', error);
      alert('Failed to create webhook');
    }
  };

  const createIntegration = async () => {
    try {
      const token = localStorage.getItem('token');
      let config = {};
      let dataMappings = [];

      try {
        config = JSON.parse(integrationForm.config || '{}');
        dataMappings = JSON.parse(integrationForm.dataMappings || '[]');
      } catch (e) {
        alert('Invalid JSON in configuration');
        return;
      }

      const response = await fetch('/api/api-management/integrations', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          ...integrationForm,
          config,
          dataMappings
        })
      });

      if (response.ok) {
        const data = await response.json();
        setIntegrations(prev => [...prev, data.integration]);
        setShowCreateModal(false);
        resetForms();
        alert('Integration created successfully!');
      } else {
        const error = await response.json();
        alert(`Failed to create integration: ${error.error}`);
      }
    } catch (error) {
      console.error('Failed to create integration:', error);
      alert('Failed to create integration');
    }
  };

  const testConnection = async (endpointId: string) => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`/api/api-management/endpoints/${endpointId}/test`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (response.ok) {
        const data = await response.json();
        if (data.result.success) {
          alert(`Connection successful! Response time: ${data.result.responseTime.toFixed(2)}ms`);
        } else {
          alert(`Connection failed: ${data.result.error}`);
        }
      }
    } catch (error) {
      console.error('Failed to test connection:', error);
      alert('Failed to test connection');
    }
  };

  const testWebhook = async (webhookId: string) => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`/api/api-management/webhooks/${webhookId}/test`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          event: 'test',
          payload: { test: true, timestamp: new Date().toISOString() }
        })
      });

      if (response.ok) {
        const data = await response.json();
        if (data.result.success) {
          alert('Webhook test successful!');
        } else {
          alert(`Webhook test failed: ${data.result.error}`);
        }
      }
    } catch (error) {
      console.error('Failed to test webhook:', error);
      alert('Failed to test webhook');
    }
  };

  const syncIntegration = async (integrationId: string) => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`/api/api-management/integrations/${integrationId}/sync`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (response.ok) {
        const data = await response.json();
        alert(`Sync completed! Processed ${data.result.recordsProcessed} records. Errors: ${data.result.errors.length}`);
        fetchData(); // Refresh data
      }
    } catch (error) {
      console.error('Failed to sync integration:', error);
      alert('Failed to sync integration');
    }
  };

  const resetForms = () => {
    setEndpointForm({
      name: '',
      description: '',
      baseUrl: '',
      version: '1.0',
      authentication: { type: 'none', config: {} },
      headers: '{}',
      rateLimit: '',
      timeout: 30000,
      tags: []
    });

    setWebhookForm({
      name: '',
      url: '',
      events: [],
      headers: '{}',
      retryPolicy: JSON.stringify({ attempts: 3, delay: 1000, exponentialBackoff: true })
    });

    setIntegrationForm({
      name: '',
      type: 'polling',
      provider: '',
      config: '{}',
      dataMappings: '[]'
    });
  };

  const getHealthStatusIcon = (status: string) => {
    switch (status) {
      case 'healthy':
        return CheckCircle;
      case 'degraded':
        return AlertTriangle;
      case 'down':
        return XCircle;
      default:
        return Clock;
    }
  };

  const getHealthStatusColor = (status: string) => {
    switch (status) {
      case 'healthy':
        return 'text-green-600';
      case 'degraded':
        return 'text-yellow-600';
      case 'down':
        return 'text-red-600';
      default:
        return 'text-gray-600';
    }
  };

  const getProviderIcon = (provider: string) => {
    switch (provider.toLowerCase()) {
      case 'github':
        return Code;
      case 'slack':
        return Globe;
      case 'stripe':
        return CreditCard;
      default:
        return Server;
    }
  };

  const filteredEndpoints = endpoints.filter(endpoint => {
    const matchesSearch = endpoint.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         endpoint.baseUrl.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = filterStatus === 'all' || endpoint.healthStatus === filterStatus;
    return matchesSearch && matchesStatus;
  });

  const filteredWebhooks = webhooks.filter(webhook => {
    const matchesSearch = webhook.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         webhook.url.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = filterStatus === 'all' || 
                         (filterStatus === 'active' && webhook.isActive) ||
                         (filterStatus === 'inactive' && !webhook.isActive);
    return matchesSearch && matchesStatus;
  });

  const filteredIntegrations = integrations.filter(integration => {
    const matchesSearch = integration.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         integration.provider.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = filterStatus === 'all' || 
                         (filterStatus === 'active' && integration.isActive) ||
                         (filterStatus === 'inactive' && !integration.isActive);
    return matchesSearch && matchesStatus;
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
        <span className="ml-2 text-gray-600">Loading API management...</span>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 mb-2">API Management</h1>
              <p className="text-gray-600">
                Manage external APIs, webhooks, and integrations with comprehensive monitoring and testing
              </p>
            </div>
            <button
              onClick={() => setShowCreateModal(true)}
              className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              <Plus className="w-5 h-5 mr-2" />
              Add {activeTab.slice(0, -1)}
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 mb-6">
          <div className="border-b border-gray-200">
            <nav className="flex">
              {[
                { id: 'endpoints', label: 'API Endpoints', icon: Globe },
                { id: 'webhooks', label: 'Webhooks', icon: Webhook },
                { id: 'integrations', label: 'Integrations', icon: Link },
                { id: 'analytics', label: 'Analytics', icon: BarChart3 }
              ].map(tab => {
                const TabIcon = tab.icon;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id as any)}
                    className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors ${
                      activeTab === tab.id
                        ? 'border-blue-500 text-blue-600'
                        : 'border-transparent text-gray-500 hover:text-gray-700'
                    }`}
                  >
                    <TabIcon className="w-4 h-4 inline mr-2" />
                    {tab.label}
                  </button>
                );
              })}
            </nav>
          </div>

          {/* Filters */}
          <div className="p-6 border-b border-gray-200">
            <div className="flex flex-wrap gap-4 items-center">
              {/* Search */}
              <div className="relative flex-1 min-w-64">
                <Search className="absolute left-3 top-3 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  placeholder={`Search ${activeTab}...`}
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
                <option value="all">All Status</option>
                {activeTab === 'endpoints' && (
                  <>
                    <option value="healthy">Healthy</option>
                    <option value="degraded">Degraded</option>
                    <option value="down">Down</option>
                    <option value="unknown">Unknown</option>
                  </>
                )}
                {(activeTab === 'webhooks' || activeTab === 'integrations') && (
                  <>
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                  </>
                )}
              </select>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="space-y-6">
          {/* API Endpoints */}
          {activeTab === 'endpoints' && (
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {filteredEndpoints.length === 0 ? (
                <div className="col-span-full text-center py-12">
                  <Globe className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 mb-2">No API endpoints found</h3>
                  <p className="text-gray-600 mb-6">
                    {endpoints.length === 0 ? 
                      'Get started by connecting your first API endpoint' :
                      'No endpoints match your current filters'
                    }
                  </p>
                  {endpoints.length === 0 && (
                    <button
                      onClick={() => setShowCreateModal(true)}
                      className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                    >
                      <Plus className="w-5 h-5 mr-2" />
                      Add Your First API Endpoint
                    </button>
                  )}
                </div>
              ) : (
                filteredEndpoints.map((endpoint) => {
                  const HealthIcon = getHealthStatusIcon(endpoint.healthStatus);
                  
                  return (
                    <motion.div
                      key={endpoint.id}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 hover:shadow-md transition-shadow"
                    >
                      {/* Header */}
                      <div className="flex items-start justify-between mb-4">
                        <div className="flex items-center space-x-3">
                          <div className="p-2 rounded-lg bg-gradient-to-r from-blue-500 to-cyan-500">
                            <Globe className="w-5 h-5 text-white" />
                          </div>
                          <div>
                            <h3 className="font-semibold text-gray-900">{endpoint.name}</h3>
                            <p className="text-sm text-gray-600">{endpoint.baseUrl}</p>
                          </div>
                        </div>
                        
                        <div className="relative">
                          <button className="p-1 text-gray-400 hover:text-gray-600">
                            <MoreVertical className="w-4 h-4" />
                          </button>
                        </div>
                      </div>

                      {/* Health Status */}
                      <div className="flex items-center space-x-2 mb-4">
                        <HealthIcon className={`w-4 h-4 ${getHealthStatusColor(endpoint.healthStatus)}`} />
                        <span className={`text-sm font-medium ${getHealthStatusColor(endpoint.healthStatus)}`}>
                          {endpoint.healthStatus.charAt(0).toUpperCase() + endpoint.healthStatus.slice(1)}
                        </span>
                        {endpoint.lastHealthCheck && (
                          <>
                            <span className="text-gray-400">•</span>
                            <span className="text-sm text-gray-600">
                              Checked {new Date(endpoint.lastHealthCheck).toLocaleDateString()}
                            </span>
                          </>
                        )}
                      </div>

                      {/* Version & Auth */}
                      <div className="flex items-center space-x-4 mb-4 text-sm text-gray-600">
                        <span>v{endpoint.version}</span>
                        <span>•</span>
                        <span className="capitalize">{endpoint.authentication.type} auth</span>
                      </div>

                      {/* Tags */}
                      {endpoint.tags && endpoint.tags.length > 0 && (
                        <div className="flex flex-wrap gap-1 mb-4">
                          {endpoint.tags.map((tag, index) => (
                            <span
                              key={index}
                              className="px-2 py-1 bg-gray-100 text-gray-700 text-xs rounded-md"
                            >
                              {tag}
                            </span>
                          ))}
                        </div>
                      )}

                      {/* Actions */}
                      <div className="flex items-center space-x-2 pt-4 border-t border-gray-200">
                        <button
                          onClick={() => testConnection(endpoint.id)}
                          className="flex-1 inline-flex items-center justify-center px-3 py-2 text-sm font-medium text-blue-600 bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors"
                        >
                          <Play className="w-4 h-4 mr-1" />
                          Test
                        </button>
                        
                        <button className="inline-flex items-center px-3 py-2 text-sm font-medium text-gray-600 hover:text-gray-800 transition-colors">
                          <FileText className="w-4 h-4 mr-1" />
                          Docs
                        </button>
                        
                        <button className="inline-flex items-center px-3 py-2 text-sm font-medium text-gray-600 hover:text-gray-800 transition-colors">
                          <Settings className="w-4 h-4" />
                        </button>
                      </div>
                    </motion.div>
                  );
                })
              )}
            </div>
          )}

          {/* Webhooks */}
          {activeTab === 'webhooks' && (
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {filteredWebhooks.length === 0 ? (
                <div className="col-span-full text-center py-12">
                  <Webhook className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 mb-2">No webhooks found</h3>
                  <p className="text-gray-600 mb-6">
                    {webhooks.length === 0 ? 
                      'Create your first webhook to receive real-time notifications' :
                      'No webhooks match your current filters'
                    }
                  </p>
                  {webhooks.length === 0 && (
                    <button
                      onClick={() => setShowCreateModal(true)}
                      className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                    >
                      <Plus className="w-5 h-5 mr-2" />
                      Create Your First Webhook
                    </button>
                  )}
                </div>
              ) : (
                filteredWebhooks.map((webhook) => (
                  <motion.div
                    key={webhook.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 hover:shadow-md transition-shadow"
                  >
                    {/* Header */}
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex items-center space-x-3">
                        <div className="p-2 rounded-lg bg-gradient-to-r from-purple-500 to-pink-500">
                          <Webhook className="w-5 h-5 text-white" />
                        </div>
                        <div>
                          <h3 className="font-semibold text-gray-900">{webhook.name}</h3>
                          <p className="text-sm text-gray-600 truncate max-w-48">{webhook.url}</p>
                        </div>
                      </div>
                      
                      <div className="flex items-center space-x-2">
                        <div className={`w-3 h-3 rounded-full ${webhook.isActive ? 'bg-green-500' : 'bg-gray-400'}`} />
                      </div>
                    </div>

                    {/* Events */}
                    <div className="mb-4">
                      <p className="text-sm text-gray-600 mb-2">Events:</p>
                      <div className="flex flex-wrap gap-1">
                        {webhook.events.slice(0, 3).map((event, index) => (
                          <span
                            key={index}
                            className="px-2 py-1 bg-blue-100 text-blue-700 text-xs rounded-md"
                          >
                            {event}
                          </span>
                        ))}
                        {webhook.events.length > 3 && (
                          <span className="px-2 py-1 bg-gray-100 text-gray-700 text-xs rounded-md">
                            +{webhook.events.length - 3} more
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Stats */}
                    <div className="flex items-center space-x-4 mb-4 text-sm text-gray-600">
                      <span className="flex items-center">
                        <CheckCircle className="w-4 h-4 mr-1 text-green-600" />
                        {webhook.successCount} success
                      </span>
                      <span className="flex items-center">
                        <XCircle className="w-4 h-4 mr-1 text-red-600" />
                        {webhook.failureCount} failed
                      </span>
                    </div>

                    {/* Last Triggered */}
                    {webhook.lastTriggered && (
                      <div className="flex items-center space-x-2 mb-4 text-sm text-gray-600">
                        <Clock className="w-4 h-4" />
                        <span>Last triggered: {new Date(webhook.lastTriggered).toLocaleDateString()}</span>
                      </div>
                    )}

                    {/* Actions */}
                    <div className="flex items-center space-x-2 pt-4 border-t border-gray-200">
                      <button
                        onClick={() => testWebhook(webhook.id)}
                        className="flex-1 inline-flex items-center justify-center px-3 py-2 text-sm font-medium text-purple-600 bg-purple-50 rounded-lg hover:bg-purple-100 transition-colors"
                      >
                        <TestTube className="w-4 h-4 mr-1" />
                        Test
                      </button>
                      
                      <button className="inline-flex items-center px-3 py-2 text-sm font-medium text-gray-600 hover:text-gray-800 transition-colors">
                        <Activity className="w-4 h-4 mr-1" />
                        Logs
                      </button>
                      
                      <button className="inline-flex items-center px-3 py-2 text-sm font-medium text-gray-600 hover:text-gray-800 transition-colors">
                        <Settings className="w-4 h-4" />
                      </button>
                    </div>
                  </motion.div>
                ))
              )}
            </div>
          )}

          {/* Integrations */}
          {activeTab === 'integrations' && (
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {filteredIntegrations.length === 0 ? (
                <div className="col-span-full text-center py-12">
                  <Link className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 mb-2">No integrations found</h3>
                  <p className="text-gray-600 mb-6">
                    {integrations.length === 0 ? 
                      'Set up your first integration to sync data automatically' :
                      'No integrations match your current filters'
                    }
                  </p>
                  {integrations.length === 0 && (
                    <button
                      onClick={() => setShowCreateModal(true)}
                      className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                    >
                      <Plus className="w-5 h-5 mr-2" />
                      Create Your First Integration
                    </button>
                  )}
                </div>
              ) : (
                filteredIntegrations.map((integration) => {
                  const ProviderIcon = getProviderIcon(integration.provider);
                  const successRate = integration.syncStats.totalRecords > 0 
                    ? (integration.syncStats.successfulRecords / integration.syncStats.totalRecords) * 100 
                    : 0;
                  
                  return (
                    <motion.div
                      key={integration.id}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 hover:shadow-md transition-shadow"
                    >
                      {/* Header */}
                      <div className="flex items-start justify-between mb-4">
                        <div className="flex items-center space-x-3">
                          <div className="p-2 rounded-lg bg-gradient-to-r from-green-500 to-emerald-500">
                            <ProviderIcon className="w-5 h-5 text-white" />
                          </div>
                          <div>
                            <h3 className="font-semibold text-gray-900">{integration.name}</h3>
                            <p className="text-sm text-gray-600 capitalize">{integration.provider} • {integration.type}</p>
                          </div>
                        </div>
                        
                        <div className="flex items-center space-x-2">
                          <div className={`w-3 h-3 rounded-full ${integration.isActive ? 'bg-green-500' : 'bg-gray-400'}`} />
                        </div>
                      </div>

                      {/* Sync Stats */}
                      <div className="mb-4">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-sm text-gray-600">Success Rate</span>
                          <span className="text-sm font-medium">{successRate.toFixed(1)}%</span>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-2">
                          <div 
                            className="bg-green-500 h-2 rounded-full transition-all duration-300"
                            style={{ width: `${successRate}%` }}
                          />
                        </div>
                      </div>

                      {/* Record Stats */}
                      <div className="grid grid-cols-3 gap-2 mb-4 text-center">
                        <div>
                          <div className="text-lg font-semibold text-gray-900">{integration.syncStats.totalRecords}</div>
                          <div className="text-xs text-gray-600">Total</div>
                        </div>
                        <div>
                          <div className="text-lg font-semibold text-green-600">{integration.syncStats.successfulRecords}</div>
                          <div className="text-xs text-gray-600">Success</div>
                        </div>
                        <div>
                          <div className="text-lg font-semibold text-red-600">{integration.syncStats.failedRecords}</div>
                          <div className="text-xs text-gray-600">Failed</div>
                        </div>
                      </div>

                      {/* Last Sync */}
                      {integration.lastSync && (
                        <div className="flex items-center space-x-2 mb-4 text-sm text-gray-600">
                          <Clock className="w-4 h-4" />
                          <span>Last sync: {new Date(integration.lastSync).toLocaleDateString()}</span>
                        </div>
                      )}

                      {/* Actions */}
                      <div className="flex items-center space-x-2 pt-4 border-t border-gray-200">
                        <button
                          onClick={() => syncIntegration(integration.id)}
                          className="flex-1 inline-flex items-center justify-center px-3 py-2 text-sm font-medium text-green-600 bg-green-50 rounded-lg hover:bg-green-100 transition-colors"
                        >
                          <TrendingUp className="w-4 h-4 mr-1" />
                          Sync Now
                        </button>
                        
                        <button className="inline-flex items-center px-3 py-2 text-sm font-medium text-gray-600 hover:text-gray-800 transition-colors">
                          <Activity className="w-4 h-4 mr-1" />
                          History
                        </button>
                        
                        <button className="inline-flex items-center px-3 py-2 text-sm font-medium text-gray-600 hover:text-gray-800 transition-colors">
                          <Settings className="w-4 h-4" />
                        </button>
                      </div>
                    </motion.div>
                  );
                })
              )}
            </div>
          )}

          {/* Analytics Tab */}
          {activeTab === 'analytics' && (
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">API Analytics Dashboard</h3>
              <div className="text-center py-12">
                <BarChart3 className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-600">Analytics dashboard coming soon...</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Create Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-semibold">
                  Create {activeTab === 'endpoints' ? 'API Endpoint' : 
                          activeTab === 'webhooks' ? 'Webhook' : 'Integration'}
                </h2>
                <button
                  onClick={() => {
                    setShowCreateModal(false);
                    resetForms();
                  }}
                  className="text-gray-400 hover:text-gray-600"
                >
                  ×
                </button>
              </div>

              {/* Endpoint Form */}
              {activeTab === 'endpoints' && (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Name</label>
                      <input
                        type="text"
                        value={endpointForm.name}
                        onChange={(e) => setEndpointForm(prev => ({ ...prev, name: e.target.value }))}
                        placeholder="My API"
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Version</label>
                      <input
                        type="text"
                        value={endpointForm.version}
                        onChange={(e) => setEndpointForm(prev => ({ ...prev, version: e.target.value }))}
                        placeholder="1.0"
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Base URL</label>
                    <input
                      type="url"
                      value={endpointForm.baseUrl}
                      onChange={(e) => setEndpointForm(prev => ({ ...prev, baseUrl: e.target.value }))}
                      placeholder="https://api.example.com"
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Description</label>
                    <textarea
                      value={endpointForm.description}
                      onChange={(e) => setEndpointForm(prev => ({ ...prev, description: e.target.value }))}
                      rows={3}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="API description..."
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Authentication Type</label>
                      <select
                        value={endpointForm.authentication.type}
                        onChange={(e) => setEndpointForm(prev => ({ ...prev, authentication: { type: e.target.value, config: {} } }))}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="none">None</option>
                        <option value="basic">Basic Auth</option>
                        <option value="bearer">Bearer Token</option>
                        <option value="api_key">API Key</option>
                        <option value="oauth2">OAuth 2.0</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Timeout (ms)</label>
                      <input
                        type="number"
                        value={endpointForm.timeout}
                        onChange={(e) => setEndpointForm(prev => ({ ...prev, timeout: parseInt(e.target.value) }))}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Headers (JSON)</label>
                    <textarea
                      value={endpointForm.headers}
                      onChange={(e) => setEndpointForm(prev => ({ ...prev, headers: e.target.value }))}
                      rows={3}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono text-sm"
                      placeholder='{"Content-Type": "application/json"}'
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Rate Limit (JSON, optional)</label>
                    <textarea
                      value={endpointForm.rateLimit}
                      onChange={(e) => setEndpointForm(prev => ({ ...prev, rateLimit: e.target.value }))}
                      rows={2}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono text-sm"
                      placeholder='{"requests": 100, "window": 3600}'
                    />
                  </div>
                </div>
              )}

              {/* Webhook Form */}
              {activeTab === 'webhooks' && (
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Name</label>
                    <input
                      type="text"
                      value={webhookForm.name}
                      onChange={(e) => setWebhookForm(prev => ({ ...prev, name: e.target.value }))}
                      placeholder="My Webhook"
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">URL</label>
                    <input
                      type="url"
                      value={webhookForm.url}
                      onChange={(e) => setWebhookForm(prev => ({ ...prev, url: e.target.value }))}
                      placeholder="https://example.com/webhook"
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Events (comma-separated)</label>
                    <input
                      type="text"
                      value={webhookForm.events.join(', ')}
                      onChange={(e) => setWebhookForm(prev => ({ ...prev, events: e.target.value.split(',').map(s => s.trim()).filter(Boolean) }))}
                      placeholder="test.created, test.completed, test.failed"
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Headers (JSON)</label>
                    <textarea
                      value={webhookForm.headers}
                      onChange={(e) => setWebhookForm(prev => ({ ...prev, headers: e.target.value }))}
                      rows={3}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono text-sm"
                      placeholder='{"Content-Type": "application/json"}'
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Retry Policy (JSON)</label>
                    <textarea
                      value={webhookForm.retryPolicy}
                      onChange={(e) => setWebhookForm(prev => ({ ...prev, retryPolicy: e.target.value }))}
                      rows={3}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono text-sm"
                    />
                  </div>
                </div>
              )}

              {/* Integration Form */}
              {activeTab === 'integrations' && (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Name</label>
                      <input
                        type="text"
                        value={integrationForm.name}
                        onChange={(e) => setIntegrationForm(prev => ({ ...prev, name: e.target.value }))}
                        placeholder="My Integration"
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Provider</label>
                      <input
                        type="text"
                        value={integrationForm.provider}
                        onChange={(e) => setIntegrationForm(prev => ({ ...prev, provider: e.target.value }))}
                        placeholder="github, slack, etc."
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Type</label>
                    <select
                      value={integrationForm.type}
                      onChange={(e) => setIntegrationForm(prev => ({ ...prev, type: e.target.value }))}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="polling">Polling</option>
                      <option value="webhook">Webhook</option>
                      <option value="streaming">Streaming</option>
                      <option value="batch">Batch</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Configuration (JSON)</label>
                    <textarea
                      value={integrationForm.config}
                      onChange={(e) => setIntegrationForm(prev => ({ ...prev, config: e.target.value }))}
                      rows={5}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono text-sm"
                      placeholder='{"endpoints": ["https://api.example.com/data"], "schedule": "*/5 * * * *"}'
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Data Mappings (JSON)</label>
                    <textarea
                      value={integrationForm.dataMappings}
                      onChange={(e) => setIntegrationForm(prev => ({ ...prev, dataMappings: e.target.value }))}
                      rows={4}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono text-sm"
                      placeholder='[{"sourceField": "name", "targetField": "title", "required": true}]'
                    />
                  </div>
                </div>
              )}

              <div className="flex justify-end space-x-3 mt-6 pt-4 border-t border-gray-200">
                <button
                  onClick={() => {
                    setShowCreateModal(false);
                    resetForms();
                  }}
                  className="px-4 py-2 text-gray-600 hover:text-gray-800 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={() => {
                    if (activeTab === 'endpoints') createEndpoint();
                    else if (activeTab === 'webhooks') createWebhook();
                    else if (activeTab === 'integrations') createIntegration();
                  }}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  Create {activeTab === 'endpoints' ? 'Endpoint' : 
                          activeTab === 'webhooks' ? 'Webhook' : 'Integration'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}