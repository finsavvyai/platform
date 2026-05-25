import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  Play,
  Save,
  Download,
  Database,
  Globe,
  Code,
  Settings,
  Clock,
  BarChart3,
  CheckCircle,
  XCircle,
  Loader2,
  Plus,
  Eye,
  Copy,
  Edit,
  Trash2,
  Filter,
  Search,
  FileText,
  Zap,
  AlertTriangle
} from 'lucide-react';

interface DataSource {
  id: string;
  name: string;
  type: string;
  status: string;
}

interface Query {
  id: string;
  name: string;
  query: string;
  parameters: Record<string, any>;
  lastExecuted?: string;
  avgExecutionTime?: number;
}

interface APIEndpoint {
  id: string;
  name: string;
  method: string;
  path: string;
  lastTested?: string;
  avgResponseTime?: number;
}

interface QueryResult {
  success: boolean;
  data?: any[];
  metadata?: {
    rowCount: number;
    executionTime: number;
    columns?: string[];
  };
  error?: string;
  validationErrors?: string[];
}

interface APIResult {
  success: boolean;
  response?: {
    status: number;
    headers: Record<string, string>;
    data: any;
    responseTime: number;
  };
  validationErrors?: string[];
  error?: string;
}

export default function DataTestingPage() {
  const [dataSources, setDataSources] = useState<DataSource[]>([]);
  const [selectedDataSource, setSelectedDataSource] = useState<string>('');
  const [queries, setQueries] = useState<Query[]>([]);
  const [endpoints, setEndpoints] = useState<APIEndpoint[]>([]);
  const [activeTab, setActiveTab] = useState<'query' | 'api'>('query');
  const [loading, setLoading] = useState(true);
  const [executing, setExecuting] = useState(false);
  
  // Query form state
  const [queryForm, setQueryForm] = useState({
    name: '',
    query: '',
    parameters: '{}',
    validation: '[]',
    caching: JSON.stringify({ enabled: false, ttl: 300 })
  });

  // API form state
  const [apiForm, setApiForm] = useState({
    name: '',
    method: 'GET',
    path: '',
    headers: '{}',
    body: '{}',
    queryParams: '{}',
    expectedResponse: '{}',
    validation: '[]'
  });

  const [results, setResults] = useState<QueryResult | APIResult | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    fetchDataSources();
  }, []);

  useEffect(() => {
    if (selectedDataSource) {
      fetchQueries();
      fetchEndpoints();
    }
  }, [selectedDataSource]);

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
        if (data.dataSources?.length > 0) {
          setSelectedDataSource(data.dataSources[0].id);
        }
      }
    } catch (error) {
      console.error('Failed to fetch data sources:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchQueries = async () => {
    if (!selectedDataSource) return;
    
    try {
      const response = await fetch(`/api/datasources/${selectedDataSource}/queries`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        setQueries(data.queries || []);
      }
    } catch (error) {
      console.error('Failed to fetch queries:', error);
    }
  };

  const fetchEndpoints = async () => {
    if (!selectedDataSource) return;
    
    try {
      const response = await fetch(`/api/datasources/${selectedDataSource}/endpoints`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        setEndpoints(data.endpoints || []);
      }
    } catch (error) {
      console.error('Failed to fetch endpoints:', error);
    }
  };

  const executeQuery = async () => {
    if (!selectedDataSource || !queryForm.query) return;
    
    try {
      setExecuting(true);
      setResults(null);
      
      let parameters = {};
      let validation = [];
      let caching = { enabled: false, ttl: 300 };
      
      try {
        parameters = JSON.parse(queryForm.parameters || '{}');
        validation = JSON.parse(queryForm.validation || '[]');
        caching = JSON.parse(queryForm.caching || '{"enabled":false,"ttl":300}');
      } catch (e) {
        alert('Invalid JSON in parameters, validation, or caching configuration');
        return;
      }
      
      const response = await fetch(`/api/datasources/${selectedDataSource}/query`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({
          name: queryForm.name || 'Untitled Query',
          query: queryForm.query,
          parameters,
          validation,
          caching
        })
      });
      
      const result = await response.json();
      setResults(result);
      
      // Refresh queries list
      fetchQueries();
    } catch (error) {
      console.error('Query execution failed:', error);
      setResults({
        success: false,
        error: 'Failed to execute query'
      });
    } finally {
      setExecuting(false);
    }
  };

  const testAPIEndpoint = async () => {
    if (!selectedDataSource || !apiForm.path) return;
    
    try {
      setExecuting(true);
      setResults(null);
      
      let headers = {};
      let body = null;
      let queryParams = {};
      let expectedResponse = {};
      let validation = [];
      
      try {
        headers = JSON.parse(apiForm.headers || '{}');
        if (apiForm.body) body = JSON.parse(apiForm.body);
        queryParams = JSON.parse(apiForm.queryParams || '{}');
        expectedResponse = JSON.parse(apiForm.expectedResponse || '{}');
        validation = JSON.parse(apiForm.validation || '[]');
      } catch (e) {
        alert('Invalid JSON in configuration');
        return;
      }
      
      const response = await fetch(`/api/datasources/${selectedDataSource}/test-endpoint`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({
          name: apiForm.name || 'Untitled Endpoint',
          method: apiForm.method,
          path: apiForm.path,
          headers,
          body,
          queryParams,
          expectedResponse,
          validation
        })
      });
      
      const result = await response.json();
      setResults(result);
      
      // Refresh endpoints list
      fetchEndpoints();
    } catch (error) {
      console.error('API test failed:', error);
      setResults({
        success: false,
        error: 'Failed to test API endpoint'
      });
    } finally {
      setExecuting(false);
    }
  };

  const generateTestData = async () => {
    if (!selectedDataSource) return;
    
    const schema = prompt('Enter JSON schema for test data generation:');
    if (!schema) return;
    
    try {
      let parsedSchema = JSON.parse(schema);
      
      const response = await fetch(`/api/datasources/${selectedDataSource}/generate-test-data`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({
          schema: parsedSchema,
          count: 100
        })
      });
      
      const result = await response.json();
      
      if (result.success) {
        setResults({
          success: true,
          data: result.data,
          metadata: {
            rowCount: result.count,
            executionTime: 0,
            columns: Object.keys(result.data[0] || {})
          }
        });
      } else {
        alert(`Test data generation failed: ${result.error}`);
      }
    } catch (error) {
      alert('Invalid JSON schema');
    }
  };

  const loadQuery = (query: Query) => {
    setQueryForm({
      name: query.name,
      query: query.query,
      parameters: JSON.stringify(query.parameters, null, 2),
      validation: '[]',
      caching: JSON.stringify({ enabled: false, ttl: 300 })
    });
    setActiveTab('query');
  };

  const loadEndpoint = (endpoint: APIEndpoint) => {
    setApiForm({
      name: endpoint.name,
      method: endpoint.method,
      path: endpoint.path,
      headers: '{}',
      body: '{}',
      queryParams: '{}',
      expectedResponse: '{}',
      validation: '[]'
    });
    setActiveTab('api');
  };

  const exportResults = () => {
    if (!results || !('data' in results) || !results.data) return;
    
    const csvContent = generateCSV(results.data);
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'query_results.csv';
    a.click();
    window.URL.revokeObjectURL(url);
  };

  const generateCSV = (data: any[]): string => {
    if (data.length === 0) return '';
    
    const headers = Object.keys(data[0]);
    const csvHeaders = headers.join(',');
    const csvRows = data.map(row =>
      headers.map(header => {
        const value = row[header];
        return typeof value === 'string' ? `"${value.replace(/"/g, '""')}"` : value;
      }).join(',')
    );
    
    return [csvHeaders, ...csvRows].join('\n');
  };

  const currentDataSource = dataSources.find(ds => ds.id === selectedDataSource);
  const isDatabase = currentDataSource?.type && ['postgresql', 'mysql', 'mongodb', 'redis'].includes(currentDataSource.type);
  const isAPI = currentDataSource?.type && ['api', 'rest', 'graphql'].includes(currentDataSource.type);

  const filteredQueries = queries.filter(q => 
    q.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    q.query.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const filteredEndpoints = endpoints.filter(e =>
    e.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    e.path.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
        <span className="ml-2 text-gray-600">Loading data testing...</span>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Data Testing</h1>
          <p className="text-gray-600">
            Execute queries and test APIs with real-time validation and performance monitoring
          </p>
        </div>

        {/* Data Source Selection */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <label className="text-sm font-medium text-gray-700">Data Source:</label>
              <select
                value={selectedDataSource}
                onChange={(e) => setSelectedDataSource(e.target.value)}
                className="border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Select a data source</option>
                {dataSources.map(ds => (
                  <option key={ds.id} value={ds.id}>
                    {ds.name} ({ds.type})
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-center space-x-2">
              {isDatabase && (
                <button
                  onClick={generateTestData}
                  className="inline-flex items-center px-3 py-2 text-sm font-medium text-purple-600 bg-purple-50 rounded-lg hover:bg-purple-100 transition-colors"
                >
                  <Zap className="w-4 h-4 mr-1" />
                  Generate Test Data
                </button>
              )}
            </div>
          </div>
        </div>

        {currentDataSource && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left Panel - Query/API Forms */}
            <div className="lg:col-span-2">
              <div className="bg-white rounded-lg shadow-sm border border-gray-200">
                {/* Tabs */}
                <div className="border-b border-gray-200">
                  <nav className="flex">
                    {isDatabase && (
                      <button
                        onClick={() => setActiveTab('query')}
                        className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors ${
                          activeTab === 'query'
                            ? 'border-blue-500 text-blue-600'
                            : 'border-transparent text-gray-500 hover:text-gray-700'
                        }`}
                      >
                        <Database className="w-4 h-4 inline mr-2" />
                        Database Query
                      </button>
                    )}
                    {isAPI && (
                      <button
                        onClick={() => setActiveTab('api')}
                        className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors ${
                          activeTab === 'api'
                            ? 'border-blue-500 text-blue-600'
                            : 'border-transparent text-gray-500 hover:text-gray-700'
                        }`}
                      >
                        <Globe className="w-4 h-4 inline mr-2" />
                        API Testing
                      </button>
                    )}
                  </nav>
                </div>

                <div className="p-6">
                  {/* Query Tab */}
                  {activeTab === 'query' && isDatabase && (
                    <div className="space-y-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Query Name
                        </label>
                        <input
                          type="text"
                          value={queryForm.name}
                          onChange={(e) => setQueryForm(prev => ({ ...prev, name: e.target.value }))}
                          placeholder="My Query"
                          className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Query
                        </label>
                        <textarea
                          value={queryForm.query}
                          onChange={(e) => setQueryForm(prev => ({ ...prev, query: e.target.value }))}
                          rows={8}
                          className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono text-sm"
                          placeholder={currentDataSource?.type === 'mongodb' ? 
                            '{"collection": "users", "filter": {"active": true}}' :
                            'SELECT * FROM users WHERE active = true'
                          }
                        />
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            Parameters (JSON)
                          </label>
                          <textarea
                            value={queryForm.parameters}
                            onChange={(e) => setQueryForm(prev => ({ ...prev, parameters: e.target.value }))}
                            rows={3}
                            className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono text-sm"
                            placeholder='{"userId": 123}'
                          />
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            Caching (JSON)
                          </label>
                          <textarea
                            value={queryForm.caching}
                            onChange={(e) => setQueryForm(prev => ({ ...prev, caching: e.target.value }))}
                            rows={3}
                            className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono text-sm"
                            placeholder='{"enabled": true, "ttl": 300}'
                          />
                        </div>
                      </div>

                      <div className="flex justify-end space-x-3">
                        <button
                          onClick={() => setQueryForm({
                            name: '',
                            query: '',
                            parameters: '{}',
                            validation: '[]',
                            caching: JSON.stringify({ enabled: false, ttl: 300 })
                          })}
                          className="px-4 py-2 text-gray-600 hover:text-gray-800 transition-colors"
                        >
                          Clear
                        </button>
                        <button
                          onClick={executeQuery}
                          disabled={executing || !queryForm.query}
                          className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
                        >
                          {executing ? (
                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          ) : (
                            <Play className="w-4 h-4 mr-2" />
                          )}
                          Execute Query
                        </button>
                      </div>
                    </div>
                  )}

                  {/* API Tab */}
                  {activeTab === 'api' && isAPI && (
                    <div className="space-y-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Endpoint Name
                        </label>
                        <input
                          type="text"
                          value={apiForm.name}
                          onChange={(e) => setApiForm(prev => ({ ...prev, name: e.target.value }))}
                          placeholder="My API Test"
                          className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            Method
                          </label>
                          <select
                            value={apiForm.method}
                            onChange={(e) => setApiForm(prev => ({ ...prev, method: e.target.value }))}
                            className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                          >
                            <option value="GET">GET</option>
                            <option value="POST">POST</option>
                            <option value="PUT">PUT</option>
                            <option value="DELETE">DELETE</option>
                            <option value="PATCH">PATCH</option>
                          </select>
                        </div>

                        <div className="md:col-span-3">
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            Path
                          </label>
                          <input
                            type="text"
                            value={apiForm.path}
                            onChange={(e) => setApiForm(prev => ({ ...prev, path: e.target.value }))}
                            placeholder="/api/users"
                            className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            Headers (JSON)
                          </label>
                          <textarea
                            value={apiForm.headers}
                            onChange={(e) => setApiForm(prev => ({ ...prev, headers: e.target.value }))}
                            rows={3}
                            className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono text-sm"
                            placeholder='{"Authorization": "Bearer token"}'
                          />
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            Query Parameters (JSON)
                          </label>
                          <textarea
                            value={apiForm.queryParams}
                            onChange={(e) => setApiForm(prev => ({ ...prev, queryParams: e.target.value }))}
                            rows={3}
                            className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono text-sm"
                            placeholder='{"page": 1, "limit": 10}'
                          />
                        </div>
                      </div>

                      {(apiForm.method === 'POST' || apiForm.method === 'PUT' || apiForm.method === 'PATCH') && (
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            Request Body (JSON)
                          </label>
                          <textarea
                            value={apiForm.body}
                            onChange={(e) => setApiForm(prev => ({ ...prev, body: e.target.value }))}
                            rows={4}
                            className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono text-sm"
                            placeholder='{"name": "John Doe", "email": "john@example.com"}'
                          />
                        </div>
                      )}

                      <div className="flex justify-end space-x-3">
                        <button
                          onClick={() => setApiForm({
                            name: '',
                            method: 'GET',
                            path: '',
                            headers: '{}',
                            body: '{}',
                            queryParams: '{}',
                            expectedResponse: '{}',
                            validation: '[]'
                          })}
                          className="px-4 py-2 text-gray-600 hover:text-gray-800 transition-colors"
                        >
                          Clear
                        </button>
                        <button
                          onClick={testAPIEndpoint}
                          disabled={executing || !apiForm.path}
                          className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
                        >
                          {executing ? (
                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          ) : (
                            <Play className="w-4 h-4 mr-2" />
                          )}
                          Test Endpoint
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Right Panel - Saved Items */}
            <div className="space-y-6">
              {/* Search */}
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
                <div className="relative">
                  <Search className="absolute left-3 top-3 w-4 h-4 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Search saved items..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              {/* Saved Queries */}
              {isDatabase && (
                <div className="bg-white rounded-lg shadow-sm border border-gray-200">
                  <div className="p-4 border-b border-gray-200">
                    <h3 className="font-semibold text-gray-900 flex items-center">
                      <Database className="w-5 h-5 mr-2" />
                      Saved Queries ({filteredQueries.length})
                    </h3>
                  </div>
                  <div className="max-h-64 overflow-y-auto">
                    {filteredQueries.length === 0 ? (
                      <div className="p-4 text-center text-gray-500">
                        No saved queries found
                      </div>
                    ) : (
                      filteredQueries.map((query) => (
                        <div
                          key={query.id}
                          className="p-3 border-b border-gray-100 hover:bg-gray-50 cursor-pointer"
                          onClick={() => loadQuery(query)}
                        >
                          <div className="flex items-start justify-between">
                            <div>
                              <h4 className="font-medium text-gray-900">{query.name}</h4>
                              <p className="text-sm text-gray-600 truncate mt-1">
                                {query.query.substring(0, 100)}...
                              </p>
                              {query.lastExecuted && (
                                <div className="flex items-center space-x-2 mt-2 text-xs text-gray-500">
                                  <Clock className="w-3 h-3" />
                                  <span>Last run: {new Date(query.lastExecuted).toLocaleDateString()}</span>
                                  {query.avgExecutionTime && (
                                    <span>• {query.avgExecutionTime}ms avg</span>
                                  )}
                                </div>
                              )}
                            </div>
                            <button className="text-gray-400 hover:text-gray-600">
                              <Eye className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}

              {/* Saved Endpoints */}
              {isAPI && (
                <div className="bg-white rounded-lg shadow-sm border border-gray-200">
                  <div className="p-4 border-b border-gray-200">
                    <h3 className="font-semibold text-gray-900 flex items-center">
                      <Globe className="w-5 h-5 mr-2" />
                      Saved Endpoints ({filteredEndpoints.length})
                    </h3>
                  </div>
                  <div className="max-h-64 overflow-y-auto">
                    {filteredEndpoints.length === 0 ? (
                      <div className="p-4 text-center text-gray-500">
                        No saved endpoints found
                      </div>
                    ) : (
                      filteredEndpoints.map((endpoint) => (
                        <div
                          key={endpoint.id}
                          className="p-3 border-b border-gray-100 hover:bg-gray-50 cursor-pointer"
                          onClick={() => loadEndpoint(endpoint)}
                        >
                          <div className="flex items-start justify-between">
                            <div>
                              <h4 className="font-medium text-gray-900">{endpoint.name}</h4>
                              <div className="flex items-center space-x-2 mt-1">
                                <span className={`px-2 py-1 text-xs font-medium rounded ${
                                  endpoint.method === 'GET' ? 'bg-green-100 text-green-800' :
                                  endpoint.method === 'POST' ? 'bg-blue-100 text-blue-800' :
                                  endpoint.method === 'PUT' ? 'bg-yellow-100 text-yellow-800' :
                                  endpoint.method === 'DELETE' ? 'bg-red-100 text-red-800' :
                                  'bg-gray-100 text-gray-800'
                                }`}>
                                  {endpoint.method}
                                </span>
                                <span className="text-sm text-gray-600">{endpoint.path}</span>
                              </div>
                              {endpoint.lastTested && (
                                <div className="flex items-center space-x-2 mt-2 text-xs text-gray-500">
                                  <Clock className="w-3 h-3" />
                                  <span>Last tested: {new Date(endpoint.lastTested).toLocaleDateString()}</span>
                                  {endpoint.avgResponseTime && (
                                    <span>• {endpoint.avgResponseTime}ms avg</span>
                                  )}
                                </div>
                              )}
                            </div>
                            <button className="text-gray-400 hover:text-gray-600">
                              <Eye className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Results Panel */}
        {results && (
          <div className="mt-6 bg-white rounded-lg shadow-sm border border-gray-200">
            <div className="p-4 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-gray-900 flex items-center">
                  {results.success ? (
                    <CheckCircle className="w-5 h-5 mr-2 text-green-600" />
                  ) : (
                    <XCircle className="w-5 h-5 mr-2 text-red-600" />
                  )}
                  Results
                </h3>
                <div className="flex items-center space-x-2">
                  {'data' in results && results.data && (
                    <button
                      onClick={exportResults}
                      className="inline-flex items-center px-3 py-1 text-sm font-medium text-gray-600 hover:text-gray-800 transition-colors"
                    >
                      <Download className="w-4 h-4 mr-1" />
                      Export CSV
                    </button>
                  )}
                </div>
              </div>
            </div>

            <div className="p-4">
              {results.success ? (
                <div>
                  {/* Metadata */}
                  {'metadata' in results && results.metadata && (
                    <div className="flex items-center space-x-6 mb-4 text-sm text-gray-600">
                      <span>Rows: {results.metadata.rowCount}</span>
                      <span>Time: {results.metadata.executionTime?.toFixed(2)}ms</span>
                      {results.metadata.columns && (
                        <span>Columns: {results.metadata.columns.length}</span>
                      )}
                    </div>
                  )}

                  {/* API Response Metadata */}
                  {'response' in results && results.response && (
                    <div className="flex items-center space-x-6 mb-4 text-sm text-gray-600">
                      <span>Status: {results.response.status}</span>
                      <span>Time: {results.response.responseTime.toFixed(2)}ms</span>
                      <span>Size: {JSON.stringify(results.response.data).length} bytes</span>
                    </div>
                  )}

                  {/* Data Table */}
                  {'data' in results && results.data && results.data.length > 0 && (
                    <div className="overflow-x-auto">
                      <table className="w-full border border-gray-200">
                        <thead className="bg-gray-50">
                          <tr>
                            {Object.keys(results.data[0]).map((key) => (
                              <th key={key} className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-b">
                                {key}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                          {results.data.slice(0, 100).map((row, index) => (
                            <tr key={index}>
                              {Object.values(row).map((value, i) => (
                                <td key={i} className="px-4 py-2 text-sm text-gray-900 border-b max-w-xs truncate">
                                  {typeof value === 'object' ? JSON.stringify(value) : String(value)}
                                </td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                      {results.data.length > 100 && (
                        <div className="p-2 text-center text-sm text-gray-500">
                          Showing first 100 rows of {results.data.length} total rows
                        </div>
                      )}
                    </div>
                  )}

                  {/* API Response Data */}
                  {'response' in results && results.response && (
                    <div>
                      <h4 className="font-medium text-gray-900 mb-2">Response Data:</h4>
                      <pre className="bg-gray-50 p-3 rounded-lg text-sm overflow-x-auto">
                        {JSON.stringify(results.response.data, null, 2)}
                      </pre>
                    </div>
                  )}

                  {/* Validation Errors */}
                  {results.validationErrors && results.validationErrors.length > 0 && (
                    <div className="mt-4">
                      <h4 className="font-medium text-red-900 mb-2 flex items-center">
                        <AlertTriangle className="w-4 h-4 mr-1" />
                        Validation Errors:
                      </h4>
                      <ul className="space-y-1">
                        {results.validationErrors.map((error, index) => (
                          <li key={index} className="text-sm text-red-600">
                            • {error}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-red-600">
                  <h4 className="font-medium mb-2">Error:</h4>
                  <p className="text-sm">{results.error}</p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}