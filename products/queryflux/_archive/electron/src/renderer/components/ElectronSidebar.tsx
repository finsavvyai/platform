import React, { useState, useEffect } from 'react';
import {
  Database,
  Plus,
  Settings,
  History,
  FolderOpen,
  Trash2,
  Edit,
  PlayCircle,
  BarChart3,
  Sparkles,
  Download,
  Clock,
  CheckCircle,
  XCircle,
  AlertCircle
} from 'lucide-react';
import { useElectronDatabase, useElectronStorage } from '../hooks';
import { DatabaseConnection } from '../hooks';
import './ElectronSidebar.css';

interface ElectronSidebarProps {
  connectionId: string | null;
  onConnectionSelect: (connectionId: string) => void;
  onNewConnection: () => void;
  onSettings: () => void;
}

export const ElectronSidebar: React.FC<ElectronSidebarProps> = ({
  connectionId,
  onConnectionSelect,
  onNewConnection,
  onSettings
}) => {
  const {
    connections,
    activeConnections,
    disconnect,
    deleteStoredConnection,
    isElectron,
    loadStoredConnections,
    loadActiveConnections
  } = useElectronDatabase();

  const { useStoredState } = useElectronStorage();
  const [expandedSections, setExpandedSections] = useStoredState('sidebar-expanded', {
    connections: true,
    queries: true,
    tools: false
  });

  const [recentQueries, setRecentQueries] = useStoredState('recent-queries', []);

  // Refresh connections
  useEffect(() => {
    if (isElectron) {
      const interval = setInterval(() => {
        loadStoredConnections();
        loadActiveConnections();
      }, 5000);

      return () => clearInterval(interval);
    }
  }, [isElectron, loadStoredConnections, loadActiveConnections]);

  // Toggle section expansion
  const toggleSection = (section: string) => {
    setExpandedSections(prev => ({
      ...prev,
      [section]: !prev[section as keyof typeof prev]
    }));
  };

  // Handle connection actions
  const handleDisconnect = async (connId: string) => {
    await disconnect(connId);
  };

  const handleDeleteConnection = async (connId: string) => {
    if (confirm('Are you sure you want to delete this connection?')) {
      await deleteStoredConnection(connId);
    }
  };

  const handleSelectConnection = (connId: string) => {
    onConnectionSelect(connId);
  };

  // Add query to recent
  const addRecentQuery = (query: string) => {
    const newQuery = {
      id: Date.now().toString(),
      query: query.substring(0, 100) + (query.length > 100 ? '...' : ''),
      timestamp: Date.now(),
      connectionId
    };

    setRecentQueries(prev => [newQuery, ...prev.slice(0, 9)]); // Keep last 10
  };

  // Get connection status icon
  const getConnectionIcon = (connId: string) => {
    const isActive = activeConnections.some(conn => conn.id === connId);
    if (isActive) {
      return <CheckCircle size={16} className="status-connected" />;
    }
    return <XCircle size={16} className="status-disconnected" />;
  };

  // Format time
  const formatTime = (timestamp: number) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now.getTime() - date.getTime();

    if (diff < 60000) return 'Just now';
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
    return date.toLocaleDateString();
  };

  if (!isElectron) {
    return (
      <div className="electron-sidebar electron-only-notice">
        <Database size={48} />
        <h3>Desktop Only</h3>
        <p>Database connections are only available in the QueryFlux desktop app.</p>
        <button className="btn btn-primary">
          Download Desktop App
        </button>
      </div>
    );
  }

  return (
    <div className="electron-sidebar">
      {/* Header */}
      <div className="sidebar-header">
        <div className="logo">
          <Database size={24} />
          <span>QueryFlux</span>
        </div>
        <button className="settings-btn" onClick={onSettings}>
          <Settings size={18} />
        </button>
      </div>

      {/* New Connection Button */}
      <div className="new-connection-section">
        <button className="new-connection-btn" onClick={onNewConnection}>
          <Plus size={20} />
          <span>New Connection</span>
        </button>
      </div>

      {/* Connections Section */}
      <div className="sidebar-section">
        <button
          className="section-header"
          onClick={() => toggleSection('connections')}
        >
          <Database size={16} />
          <span>Connections</span>
          <div className={`chevron ${expandedSections.connections ? 'expanded' : ''}`}>
            ▼
          </div>
        </button>

        {expandedSections.connections && (
          <div className="section-content">
            {connections.length === 0 ? (
              <div className="empty-state">
                <Database size={32} />
                <p>No connections yet</p>
                <button className="btn btn-outline btn-sm" onClick={onNewConnection}>
                  Create your first connection
                </button>
              </div>
            ) : (
              <div className="connections-list">
                {connections.map((conn) => (
                  <div
                    key={conn.id}
                    className={`connection-item ${connectionId === conn.id ? 'active' : ''}`}
                  >
                    <div
                      className="connection-main"
                      onClick={() => handleSelectConnection(conn.id)}
                    >
                      {getConnectionIcon(conn.id)}
                      <div className="connection-info">
                        <div className="connection-name">{conn.name}</div>
                        <div className="connection-details">
                          {conn.type}://{conn.host}:{conn.port}/{conn.database}
                        </div>
                      </div>
                    </div>
                    <div className="connection-actions">
                      {activeConnections.some(c => c.id === conn.id) && (
                        <button
                          className="action-btn disconnect"
                          onClick={() => handleDisconnect(conn.id)}
                          title="Disconnect"
                        >
                          <XCircle size={14} />
                        </button>
                      )}
                      <button
                        className="action-btn delete"
                        onClick={() => handleDeleteConnection(conn.id)}
                        title="Delete connection"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Recent Queries Section */}
      <div className="sidebar-section">
        <button
          className="section-header"
          onClick={() => toggleSection('queries')}
        >
          <History size={16} />
          <span>Recent Queries</span>
          <div className={`chevron ${expandedSections.queries ? 'expanded' : ''}`}>
            ▼
          </div>
        </button>

        {expandedSections.queries && (
          <div className="section-content">
            {recentQueries.length === 0 ? (
              <div className="empty-state">
                <Clock size={32} />
                <p>No recent queries</p>
                <span className="empty-subtext">Execute a query to see it here</span>
              </div>
            ) : (
              <div className="recent-queries-list">
                {recentQueries.map((query) => (
                  <div key={query.id} className="recent-query-item">
                    <div className="query-text">{query.query}</div>
                    <div className="query-time">{formatTime(query.timestamp)}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Tools Section */}
      <div className="sidebar-section">
        <button
          className="section-header"
          onClick={() => toggleSection('tools')}
        >
          <BarChart3 size={16} />
          <span>Tools</span>
          <div className={`chevron ${expandedSections.tools ? 'expanded' : ''}`}>
            ▼
          </div>
        </button>

        {expandedSections.tools && (
          <div className="section-content">
            <div className="tools-list">
              <button className="tool-item">
                <PlayCircle size={16} />
                <span>Query Runner</span>
              </button>
              <button className="tool-item">
                <Sparkles size={16} />
                <span>AI Assistant</span>
              </button>
              <button className="tool-item">
                <Download size={16} />
                <span>Export Data</span>
              </button>
              <button className="tool-item">
                <FolderOpen size={16} />
                <span>Import Data</span>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Status Bar */}
      <div className="sidebar-status">
        <div className="status-item">
          <div className={`status-indicator ${activeConnections.length > 0 ? 'connected' : 'disconnected'}`} />
          <span>{activeConnections.length} Active</span>
        </div>
        <div className="status-item">
          <span>{connections.length} Saved</span>
        </div>
      </div>
    </div>
  );
};