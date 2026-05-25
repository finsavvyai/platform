import React, { useState, useEffect } from 'react';
import {
  Database,
  Plus,
  Edit,
  Trash2,
  TestTube,
  CheckCircle,
  XCircle,
  AlertCircle,
  Copy,
  Eye,
  EyeOff,
  Wifi,
  WifiOff,
  MoreHorizontal
} from 'lucide-react';
import { useConnections, useConnection } from '../hooks/use-api';

interface ConnectionManagerProps {
  onConnectionSelect?: (connection: any) => void;
  selectedConnectionId?: string;
  className?: string;
}

export const ConnectionManager: React.FC<ConnectionManagerProps> = ({
  onConnectionSelect,
  selectedConnectionId,
  className = '',
}) => {
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [editingConnection, setEditingConnection] = useState<any>(null);
  const [testingConnection, setTestingConnection] = useState<string | null>(null);
  const [showPasswords, setShowPasswords] = useState<Record<string, boolean>>({});

  const {
    connections,
    loading,
    error,
    createConnection,
    updateConnection,
    deleteConnection,
    testConnection,
    refreshConnections,
  } = useConnections();

  const [formData, setFormData] = useState({
    name: '',
    type: 'postgresql',
    host: '',
    port: '',
    database: '',
    username: '',
    password: '',
    sslMode: 'prefer',
  });

  const resetForm = () => {
    setFormData({
      name: '',
      type: 'postgresql',
      host: '',
      port: '',
      database: '',
      username: '',
      password: '',
      sslMode: 'prefer',
    });
    setEditingConnection(null);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      const connectionData = {
        ...formData,
        port: parseInt(formData.port),
      };

      if (editingConnection) {
        await updateConnection.execute(editingConnection.id, connectionData);
      } else {
        await createConnection.execute(connectionData);
      }

      setIsCreateDialogOpen(false);
      resetForm();
    } catch (error) {
      console.error('Failed to save connection:', error);
    }
  };

  const handleEdit = (connection: any) => {
    setEditingConnection(connection);
    setFormData({
      name: connection.name,
      type: connection.type,
      host: connection.host,
      port: connection.port.toString(),
      database: connection.database || '',
      username: connection.username || '',
      password: '', // Don't populate password for security
      sslMode: connection.sslMode || 'prefer',
    });
    setIsCreateDialogOpen(true);
  };

  const handleDelete = async (connectionId: string) => {
    if (!window.confirm('Are you sure you want to delete this connection?')) {
      return;
    }

    try {
      await deleteConnection.execute(connectionId);
    } catch (error) {
      console.error('Failed to delete connection:', error);
    }
  };

  const handleTest = async (connection: any) => {
    setTestingConnection(connection.id);

    try {
      const result = await testConnection.execute(connection);

      if (result.success) {
        // Show success notification
        console.log('Connection test successful:', result.data);
      } else {
        // Show error notification
        console.error('Connection test failed:', result.error);
      }
    } catch (error) {
      console.error('Connection test error:', error);
    } finally {
      setTestingConnection(null);
    }
  };

  const togglePasswordVisibility = (connectionId: string) => {
    setShowPasswords(prev => ({
      ...prev,
      [connectionId]: !prev[connectionId],
    }));
  };

  const copyConnectionString = (connection: any) => {
    const connectionString = `${connection.type}://${connection.username}@${connection.host}:${connection.port}/${connection.database}`;

    navigator.clipboard.writeText(connectionString).then(() => {
      // Show success notification
      console.log('Connection string copied to clipboard');
    });
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'connected':
        return <CheckCircle className=\"w-4 h-4 text-green-500\" />;
      case 'disconnected':
        return <XCircle className=\"w-4 h-4 text-gray-400\" />;
      case 'connecting':
        return <AlertCircle className=\"w-4 h-4 text-yellow-500\" />;
      case 'error':
        return <XCircle className=\"w-4 h-4 text-red-500\" />;
      default:
        return <WifiOff className=\"w-4 h-4 text-gray-400\" />;
    }
  };

  const getDatabaseTypeColor = (type: string) => {
    const colors: Record<string, string> = {
      postgresql: 'bg-blue-100 text-blue-800',
      mysql: 'bg-orange-100 text-orange-800',
      mongodb: 'bg-green-100 text-green-800',
      redis: 'bg-red-100 text-red-800',
      sqlite: 'bg-purple-100 text-purple-800',
      cassandra: 'bg-indigo-100 text-indigo-800',
      neo4j: 'bg-pink-100 text-pink-800',
    };

    return colors[type] || 'bg-gray-100 text-gray-800';
  };

  useEffect(() => {
    refreshConnections();
  }, [refreshConnections]);

  return (
    <div className={`bg-white rounded-lg shadow-lg ${className}`}>
      {/* Header */}
      <div className=\"px-6 py-4 border-b border-gray-200\">
        <div className=\"flex items-center justify-between\">
          <div className=\"flex items-center space-x-3\">
            <Database className=\"w-6 h-6 text-blue-500\" />
            <h2 className=\"text-lg font-semibold text-gray-900\">Database Connections</h2>
            <span className=\"inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800\">
              {connections.length} connections
            </span>
          </div>
          <button
            onClick={() => setIsCreateDialogOpen(true)}
            className=\"flex items-center space-x-2 px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500\"
          >
            <Plus className=\"w-4 h-4\" />
            <span>New Connection</span>
          </button>
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div className=\"px-6 py-4 bg-red-50 border-b border-red-200\">
          <div className=\"flex items-center space-x-2 text-red-700\">
            <AlertCircle className=\"w-5 h-5\" />
            <span className=\"text-sm\">{error}</span>
          </div>
        </div>
      )}

      {/* Connections List */}
      <div className=\"divide-y divide-gray-200 max-h-96 overflow-y-auto\">
        {loading ? (
          <div className=\"px-6 py-8 text-center text-gray-500\">
            <div className=\"w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-2\"></div>
            <span>Loading connections...</span>
          </div>
        ) : connections.length === 0 ? (
          <div className=\"px-6 py-8 text-center text-gray-500\">
            <Database className=\"w-12 h-12 mx-auto mb-2 text-gray-300\" />
            <p className=\"text-sm\">No database connections found</p>
            <p className=\"text-xs mt-1\">Create your first connection to get started</p>
          </div>
        ) : (
          connections.map(connection => (
            <div
              key={connection.id}
              className={`px-6 py-4 hover:bg-gray-50 cursor-pointer transition-colors ${
                selectedConnectionId === connection.id ? 'bg-blue-50' : ''
              }`}
              onClick={() => onConnectionSelect?.(connection)}
            >
              <div className=\"flex items-center justify-between\">
                <div className=\"flex items-center space-x-3 flex-1 min-w-0\">
                  {/* Status Icon */}
                  {getStatusIcon(connection.status)}

                  {/* Connection Info */}
                  <div className=\"flex-1 min-w-0\">
                    <div className=\"flex items-center space-x-2 mb-1\">
                      <h3 className=\"text-sm font-medium text-gray-900 truncate\">
                        {connection.name}
                      </h3>
                      <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${getDatabaseTypeColor(connection.type)}`}>
                        {connection.type}
                      </span>
                    </div>
                    <p className=\"text-xs text-gray-500 truncate\">
                      {connection.username}@{connection.host}:{connection.port}/{connection.database}
                    </p>
                  </div>
                </div>

                {/* Actions */}
                <div className=\"flex items-center space-x-2 ml-4\">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleTest(connection);
                    }}
                    disabled={testingConnection === connection.id}
                    className=\"p-1 text-gray-400 hover:text-blue-500 disabled:opacity-50\"
                    title=\"Test Connection\"
                  >
                    {testingConnection === connection.id ? (
                      <div className=\"w-4 h-4 border border-blue-500 border-t-transparent rounded-full animate-spin\"></div>
                    ) : (
                      <TestTube className=\"w-4 h-4\" />
                    )}
                  </button>

                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      copyConnectionString(connection);
                    }}
                    className=\"p-1 text-gray-400 hover:text-blue-500\"
                    title=\"Copy Connection String\"
                  >
                    <Copy className=\"w-4 h-4\" />
                  </button>

                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleEdit(connection);
                    }}
                    className=\"p-1 text-gray-400 hover:text-blue-500\"
                    title=\"Edit Connection\"
                  >
                    <Edit className=\"w-4 h-4\" />
                  </button>

                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDelete(connection.id);
                    }}
                    className=\"p-1 text-gray-400 hover:text-red-500\"
                    title=\"Delete Connection\"
                  >
                    <Trash2 className=\"w-4 h-4\" />
                  </button>
                </div>
              </div>

              {/* Connection Details (Expandable) */}
              {showPasswords[connection.id] && (
                <div className=\"mt-3 pt-3 border-t border-gray-200 text-xs text-gray-600\">
                  <div className=\"grid grid-cols-2 gap-2\">
                    <div>
                      <span className=\"font-medium\">Host:</span> {connection.host}
                    </div>
                    <div>
                      <span className=\"font-medium\">Port:</span> {connection.port}
                    </div>
                    <div>
                      <span className=\"font-medium\">Database:</span> {connection.database || 'N/A'}
                    </div>
                    <div>
                      <span className=\"font-medium\">SSL Mode:</span> {connection.sslMode || 'prefer'}
                    </div>
                  </div>
                </div>
              )}
            </div>
          ))
        )}
      </div>

      {/* Create/Edit Dialog */}
      {isCreateDialogOpen && (
        <div className=\"fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50\">
          <div className=\"bg-white rounded-lg shadow-xl w-full max-w-md mx-4\">
            <div className=\"px-6 py-4 border-b border-gray-200\">
              <h3 className=\"text-lg font-semibold text-gray-900\">
                {editingConnection ? 'Edit Connection' : 'Create New Connection'}
              </h3>
            </div>

            <form onSubmit={handleSubmit} className=\"px-6 py-4\">
              <div className=\"space-y-4\">
                {/* Connection Name */}
                <div>
                  <label htmlFor=\"name\" className=\"block text-sm font-medium text-gray-700 mb-1\">
                    Connection Name
                  </label>
                  <input
                    type=\"text\"
                    id=\"name\"
                    name=\"name\"
                    value={formData.name}
                    onChange={handleInputChange}
                    placeholder=\"e.g., Production PostgreSQL\"
                    className=\"w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500\"
                    required
                  />
                </div>

                {/* Database Type */}
                <div>
                  <label htmlFor=\"type\" className=\"block text-sm font-medium text-gray-700 mb-1\">
                    Database Type
                  </label>
                  <select
                    id=\"type\"
                    name=\"type\"
                    value={formData.type}
                    onChange={handleInputChange}
                    className=\"w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500\"
                  >
                    <option value=\"postgresql\">PostgreSQL</option>
                    <option value=\"mysql\">MySQL</option>
                    <option value=\"mongodb\">MongoDB</option>
                    <option value=\"redis\">Redis</option>
                    <option value=\"sqlite\">SQLite</option>
                    <option value=\"cassandra\">Cassandra</option>
                    <option value=\"neo4j\">Neo4j</option>
                  </select>
                </div>

                {/* Host and Port */}
                <div className=\"grid grid-cols-2 gap-4\">
                  <div>
                    <label htmlFor=\"host\" className=\"block text-sm font-medium text-gray-700 mb-1\">
                      Host
                    </label>
                    <input
                      type=\"text\"
                      id=\"host\"
                      name=\"host\"
                      value={formData.host}
                      onChange={handleInputChange}
                      placeholder=\"localhost\"
                      className=\"w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500\"
                      required
                    />
                  </div>
                  <div>
                    <label htmlFor=\"port\" className=\"block text-sm font-medium text-gray-700 mb-1\">
                      Port
                    </label>
                    <input
                      type=\"number\"
                      id=\"port\"
                      name=\"port\"
                      value={formData.port}
                      onChange={handleInputChange}
                      placeholder=\"5432\"
                      className=\"w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500\"
                      required
                    />
                  </div>
                </div>

                {/* Database */}
                <div>
                  <label htmlFor=\"database\" className=\"block text-sm font-medium text-gray-700 mb-1\">
                    Database
                  </label>
                  <input
                    type=\"text\"
                    id=\"database\"
                    name=\"database\"
                    value={formData.database}
                    onChange={handleInputChange}
                    placeholder=\"database_name\"
                    className=\"w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500\"
                  />
                </div>

                {/* Username and Password */}
                <div className=\"space-y-4\">
                  <div>
                    <label htmlFor=\"username\" className=\"block text-sm font-medium text-gray-700 mb-1\">
                      Username
                    </label>
                    <input
                      type=\"text\"
                      id=\"username\"
                      name=\"username\"
                      value={formData.username}
                      onChange={handleInputChange}
                      placeholder=\"username\"
                      className=\"w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500\"
                    />
                  </div>

                  <div>
                    <label htmlFor=\"password\" className=\"block text-sm font-medium text-gray-700 mb-1\">
                      Password {editingConnection && <span className=\"text-gray-500\">(leave blank to keep current)</span>}
                    </label>
                    <input
                      type=\"password\"
                      id=\"password\"
                      name=\"password\"
                      value={formData.password}
                      onChange={handleInputChange}
                      placeholder=\"password\"
                      className=\"w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500\"
                    />
                  </div>
                </div>

                {/* SSL Mode */}
                <div>
                  <label htmlFor=\"sslMode\" className=\"block text-sm font-medium text-gray-700 mb-1\">
                    SSL Mode
                  </label>
                  <select
                    id=\"sslMode\"
                    name=\"sslMode\"
                    value={formData.sslMode}
                    onChange={handleInputChange}
                    className=\"w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500\"
                  >
                    <option value=\"disable\">Disable</option>
                    <option value=\"prefer\">Prefer</option>
                    <option value=\"require\">Require</option>
                  </select>
                </div>
              </div>

              {/* Form Actions */}
              <div className=\"flex space-x-3 mt-6\">
                <button
                  type=\"button\"
                  onClick={() => {
                    setIsCreateDialogOpen(false);
                    resetForm();
                  }}
                  className=\"flex-1 px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500\"
                >
                  Cancel
                </button>
                <button
                  type=\"submit\"
                  disabled={createConnection.loading || updateConnection.loading}
                  className=\"flex-1 px-4 py-2 bg-blue-500 text-white rounded-md text-sm font-medium hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50\"
                >
                  {createConnection.loading || updateConnection.loading ? (
                    <div className=\"flex items-center justify-center space-x-2\">
                      <div className=\"w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin\"></div>
                      <span>Saving...</span>
                    </div>
                  ) : (
                    <span>{editingConnection ? 'Update Connection' : 'Create Connection'}</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default ConnectionManager;