import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  Database,
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
  AlertCircle,
  Loader2,
  Edit,
  Trash2,
  Copy,
  Eye,
  Zap,
  Globe,
  Server,
  Code,
  CloudCog
} from 'lucide-react';

interface DataSource {
  id: string;
  name: string;
  type: 'postgresql' | 'mysql' | 'mongodb' | 'redis' | 'api' | 'graphql' | 'rest';
  status: 'active' | 'inactive' | 'error';
  lastTestedAt?: string;
  config: any;
  tags?: string[];
  createdAt: string;
  queries?: number;
  endpoints?: number;
}

interface DataSourceTemplate {
  type: string;
  name: string;
  description: string;
  config: any;
}

export default function DataSourcesPage() {
  const [dataSources, setDataSources] = useState<DataSource[]>([]);
  const [templates, setTemplates] = useState<DataSourceTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showConfigModal, setShowConfigModal] = useState(false);
  const [selectedDataSource, setSelectedDataSource] = useState<DataSource | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');
  const [testingConnection, setTestingConnection] = useState<string | null>(null);

  // Create form state
  const [createForm, setCreateForm] = useState({
    name: '',
    type: 'postgresql',
    config: {},
    tags: []
  });

  useEffect(() => {
    fetchDataSources();
    fetchTemplates();
  }, []);

  const fetchDataSources = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/datasources', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        setDataSources(data.dataSources || []);
      }
    } catch (error) {
      console.error('Failed to fetch data sources:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchTemplates = async () => {
    try {
      const response = await fetch('/api/datasources/templates', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        setTemplates(data.templates || []);
      }
    } catch (error) {
      console.error('Failed to fetch templates:', error);
    }
  };

  const testConnection = async (dataSource: DataSource) => {
    try {
      setTestingConnection(dataSource.id);
      
      const response = await fetch(`/api/datasources/${dataSource.id}/test`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      
      const result = await response.json();
      
      if (result.success) {
        alert('Connection successful!');
        // Update status in local state
        setDataSources(prev => prev.map(ds => 
          ds.id === dataSource.id ? { ...ds, status: 'active', lastTestedAt: new Date().toISOString() } : ds
        ));
      } else {
        alert(`Connection failed: ${result.error}`);
        setDataSources(prev => prev.map(ds => 
          ds.id === dataSource.id ? { ...ds, status: 'error' } : ds
        ));
      }
    } catch (error) {
      console.error('Connection test failed:', error);
      alert('Connection test failed');
    } finally {
      setTestingConnection(null);
    }
  };

  const createDataSource = async () => {
    try {
      const response = await fetch('/api/datasources', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify(createForm)
      });
      
      if (response.ok) {
        const data = await response.json();
        setDataSources(prev => [...prev, data.dataSource]);
        setShowCreateModal(false);
        setCreateForm({
          name: '',
          type: 'postgresql',
          config: {},
          tags: []
        });
        alert('Data source created successfully!');
      } else {
        const error = await response.json();
        alert(`Failed to create data source: ${error.error}`);
      }
    } catch (error) {
      console.error('Data source creation failed:', error);
      alert('Failed to create data source');
    }
  };

  const deleteDataSource = async (id: string) => {
    if (!confirm('Are you sure you want to delete this data source?')) {
      return;
    }
    
    try {
      const response = await fetch(`/api/datasources/${id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      
      if (response.ok) {
        setDataSources(prev => prev.filter(ds => ds.id !== id));
        alert('Data source deleted successfully!');
      } else {
        const error = await response.json();
        alert(`Failed to delete data source: ${error.error}`);
      }
    } catch (error) {
      console.error('Data source deletion failed:', error);
      alert('Failed to delete data source');
    }
  };

  const discoverSchema = async (dataSource: DataSource) => {
    try {
      const response = await fetch(`/api/datasources/${dataSource.id}/discover-schema`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      
      const result = await response.json();
      
      if (result.success) {
        console.log('Schema discovered:', result.schema);
        // You would show this in a modal or navigate to a schema view
        alert('Schema discovered successfully! Check console for details.');
      } else {
        alert(`Schema discovery failed: ${result.error}`);
      }
    } catch (error) {
      console.error('Schema discovery failed:', error);
      alert('Schema discovery failed');
    }
  };

  const getDataSourceIcon = (type: string) => {
    switch (type) {
      case 'postgresql':
      case 'mysql':
        return Database;
      case 'mongodb':
        return Server;
      case 'redis':
        return Zap;
      case 'api':
      case 'rest':
        return Globe;
      case 'graphql':
        return Code;
      default:
        return CloudCog;
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'active':
        return CheckCircle;
      case 'error':
        return XCircle;
      case 'inactive':
        return AlertCircle;
      default:
        return AlertCircle;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
        return 'text-green-600';
      case 'error':
        return 'text-red-600';
      case 'inactive':
        return 'text-yellow-600';
      default:
        return 'text-gray-600';
    }
  };

  const filteredDataSources = dataSources.filter(ds => {
    const matchesSearch = ds.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         ds.type.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesType = filterType === 'all' || ds.type === filterType;
    const matchesStatus = filterStatus === 'all' || ds.status === filterStatus;
    
    return matchesSearch && matchesType && matchesStatus;
  });

  const openCreateModal = (template?: DataSourceTemplate) => {
    if (template) {
      setCreateForm({
        name: '',
        type: template.type as any,
        config: template.config,
        tags: []
      });
    }
    setShowCreateModal(true);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
        <span className="ml-2 text-gray-600">Loading data sources...</span>
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
              <h1 className="text-3xl font-bold text-gray-900 mb-2">Data Sources</h1>
              <p className="text-gray-600">
                Connect to databases and APIs to power your tests with real data
              </p>
            </div>
            <button
              onClick={() => openCreateModal()}
              className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              <Plus className="w-5 h-5 mr-2" />
              Add Data Source
            </button>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
          <div className="flex flex-wrap gap-4 items-center">
            {/* Search */}
            <div className="relative flex-1 min-w-64">
              <Search className="absolute left-3 top-3 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search data sources..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {/* Type Filter */}
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              className="border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">All Types</option>
              <option value="postgresql">PostgreSQL</option>
              <option value="mysql">MySQL</option>
              <option value="mongodb">MongoDB</option>
              <option value="redis">Redis</option>
              <option value="api">REST API</option>
              <option value="graphql">GraphQL</option>
            </select>

            {/* Status Filter */}
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">All Statuses</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
              <option value="error">Error</option>
            </select>
          </div>
        </div>

        {/* Data Sources Grid */}
        {filteredDataSources.length === 0 ? (
          <div className="text-center py-12">
            <Database className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No data sources found</h3>
            <p className="text-gray-600 mb-6">
              {dataSources.length === 0 ? 
                'Get started by connecting your first data source' :
                'No data sources match your current filters'
              }
            </p>
            {dataSources.length === 0 && (
              <button
                onClick={() => openCreateModal()}
                className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                <Plus className="w-5 h-5 mr-2" />
                Add Your First Data Source
              </button>
            )}
          </div>
        ) : (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {filteredDataSources.map((dataSource) => {
              const DataSourceIcon = getDataSourceIcon(dataSource.type);
              const StatusIcon = getStatusIcon(dataSource.status);
              
              return (
                <motion.div
                  key={dataSource.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 hover:shadow-md transition-shadow"
                >
                  {/* Header */}
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center space-x-3">
                      <div className={`p-2 rounded-lg bg-gradient-to-r ${
                        dataSource.type === 'postgresql' || dataSource.type === 'mysql' ? 'from-blue-500 to-cyan-500' :
                        dataSource.type === 'mongodb' ? 'from-green-500 to-emerald-500' :
                        dataSource.type === 'redis' ? 'from-red-500 to-orange-500' :
                        'from-purple-500 to-pink-500'
                      }`}>
                        <DataSourceIcon className="w-5 h-5 text-white" />
                      </div>
                      <div>
                        <h3 className="font-semibold text-gray-900">{dataSource.name}</h3>
                        <p className="text-sm text-gray-600 capitalize">{dataSource.type}</p>
                      </div>
                    </div>
                    
                    <div className="relative">
                      <button className="p-1 text-gray-400 hover:text-gray-600">
                        <MoreVertical className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {/* Status */}
                  <div className="flex items-center space-x-2 mb-4">
                    <StatusIcon className={`w-4 h-4 ${getStatusColor(dataSource.status)}`} />
                    <span className={`text-sm font-medium ${getStatusColor(dataSource.status)}`}>
                      {dataSource.status.charAt(0).toUpperCase() + dataSource.status.slice(1)}
                    </span>
                    {dataSource.lastTestedAt && (
                      <>
                        <span className="text-gray-400">•</span>
                        <span className="text-sm text-gray-600">
                          Tested {new Date(dataSource.lastTestedAt).toLocaleDateString()}
                        </span>
                      </>
                    )}
                  </div>

                  {/* Tags */}
                  {dataSource.tags && dataSource.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1 mb-4">
                      {dataSource.tags.map((tag, index) => (
                        <span
                          key={index}
                          className="px-2 py-1 bg-gray-100 text-gray-700 text-xs rounded-md"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  )}

                  {/* Stats */}
                  <div className="flex items-center space-x-4 mb-4 text-sm text-gray-600">
                    {dataSource.queries !== undefined && (
                      <span>{dataSource.queries} queries</span>
                    )}
                    {dataSource.endpoints !== undefined && (
                      <span>{dataSource.endpoints} endpoints</span>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex items-center space-x-2 pt-4 border-t border-gray-200">
                    <button
                      onClick={() => testConnection(dataSource)}
                      disabled={testingConnection === dataSource.id}
                      className="flex-1 inline-flex items-center justify-center px-3 py-2 text-sm font-medium text-blue-600 bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors disabled:opacity-50"
                    >
                      {testingConnection === dataSource.id ? (
                        <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                      ) : (
                        <Play className="w-4 h-4 mr-1" />
                      )}
                      Test
                    </button>
                    
                    <button
                      onClick={() => discoverSchema(dataSource)}
                      className="inline-flex items-center px-3 py-2 text-sm font-medium text-gray-600 hover:text-gray-800 transition-colors"
                    >
                      <Search className="w-4 h-4 mr-1" />
                      Schema
                    </button>
                    
                    <button
                      onClick={() => {
                        setSelectedDataSource(dataSource);
                        setShowConfigModal(true);
                      }}
                      className="inline-flex items-center px-3 py-2 text-sm font-medium text-gray-600 hover:text-gray-800 transition-colors"
                    >
                      <Settings className="w-4 h-4" />
                    </button>
                    
                    <button
                      onClick={() => deleteDataSource(dataSource.id)}
                      className="inline-flex items-center px-3 py-2 text-sm font-medium text-red-600 hover:text-red-800 transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}

        {/* Quick Start Templates */}
        {dataSources.length === 0 && (
          <div className="mt-12">
            <h2 className="text-xl font-semibold text-gray-900 mb-6">Quick Start Templates</h2>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {templates.map((template, index) => {
                const TemplateIcon = getDataSourceIcon(template.type);
                
                return (
                  <motion.div
                    key={template.type}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.1 }}
                    className="bg-white rounded-lg border border-gray-200 p-4 hover:border-blue-300 cursor-pointer transition-colors"
                    onClick={() => openCreateModal(template)}
                  >
                    <div className="flex items-center space-x-3 mb-2">
                      <div className="p-2 bg-gray-100 rounded-lg">
                        <TemplateIcon className="w-5 h-5 text-gray-600" />
                      </div>
                      <div>
                        <h3 className="font-medium text-gray-900">{template.name}</h3>
                        <p className="text-sm text-gray-600">{template.description}</p>
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Create Data Source Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-semibold">Add Data Source</h2>
                <button
                  onClick={() => setShowCreateModal(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  ×
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Name
                  </label>
                  <input
                    type="text"
                    value={createForm.name}
                    onChange={(e) => setCreateForm(prev => ({ ...prev, name: e.target.value }))}
                    placeholder="My Database"
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Type
                  </label>
                  <select
                    value={createForm.type}
                    onChange={(e) => {
                      const selectedTemplate = templates.find(t => t.type === e.target.value);
                      setCreateForm(prev => ({ 
                        ...prev, 
                        type: e.target.value,
                        config: selectedTemplate?.config || {}
                      }));
                    }}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    {templates.map(template => (
                      <option key={template.type} value={template.type}>
                        {template.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Configuration
                  </label>
                  <textarea
                    value={JSON.stringify(createForm.config, null, 2)}
                    onChange={(e) => {
                      try {
                        const config = JSON.parse(e.target.value);
                        setCreateForm(prev => ({ ...prev, config }));
                      } catch {
                        // Invalid JSON, ignore
                      }
                    }}
                    rows={10}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono text-sm"
                    placeholder="Configuration JSON..."
                  />
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
                  onClick={createDataSource}
                  disabled={!createForm.name}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
                >
                  Create Data Source
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}