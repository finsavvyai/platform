import React, { useState, useEffect } from 'react';
import { useElectronDatabase, useElectronAI, useElectronUpdater, useElectronMetrics } from './hooks';
import ElectronMonitoringDashboard from './components/ElectronMonitoringDashboard';
import './styles/App.css';

// Import Electron types
declare global {
  interface Window {
    electronAPI?: {
      app: {
        version: () => Promise<string>;
        quit: () => Promise<void>;
        minimize: () => Promise<void>;
        maximize: () => Promise<void>;
      };
      on: (channel: string, callback: (...args: any[]) => void) => void;
    };
  }
}

function App() {
  const { isElectron, connect, disconnect, connections, activeConnections } = useElectronDatabase();
  const { convertNLToSQL, optimizeQuery, explainQuery } = useElectronAI();
  const { checkForUpdates, currentUpdate, installUpdate } = useElectronUpdater();
  const { clearError } = useElectronMetrics(); // For error handling

  const [appVersion, setAppVersion] = useState<string>('');
  const [connectionStatus, setConnectionStatus] = useState<'disconnected' | 'connecting' | 'connected'>('disconnected');
  const [activeTab, setActiveTab] = useState<'overview' | 'connections' | 'monitoring' | 'ai' | 'settings'>('overview');
  const [selectedConnectionId, setSelectedConnectionId] = useState<string>('');

  // Mock user ID for demo purposes
  const mockUserId = 'user-demo-123';

  useEffect(() => {
    // Get app version if in Electron
    if (window.electronAPI) {
      window.electronAPI.app.version().then(setAppVersion);
    }
  }, [isElectron]);

  const handleTestConnection = async () => {
    if (!isElectron) {
      alert('This feature is only available in the Electron app');
      return;
    }

    setConnectionStatus('connecting');

    try {
      const testConnection = {
        id: 'test-connection',
        name: 'Test Connection',
        type: 'postgresql' as const,
        host: 'localhost',
        port: 5432,
        database: 'test',
        username: 'postgres',
        password: 'password',
        ssl: false,
        createdAt: Date.now(),
        updatedAt: Date.now()
      };

      const result = await connect(testConnection);

      if (result.success) {
        setConnectionStatus('connected');
        console.log('Connected with ID:', result.connectionId);
      } else {
        throw new Error(result.error || 'Connection failed');
      }
    } catch (error) {
      console.error('Connection failed:', error);
      setConnectionStatus('disconnected');
      alert(`Connection failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  const handleTestQuery = async () => {
    if (!isElectron || activeConnections.length === 0) {
      alert('Please connect to a database first');
      return;
    }

    try {
      const connectionId = activeConnections[0].id;
      const result = await activeConnections[0].executeQuery(
        'SELECT 1 as test_col, CURRENT_TIMESTAMP as current_time',
        []
      );

      if (result.success && result.data) {
        console.log('Query result:', result.data);
        alert(`Query executed successfully. Rows returned: ${result.data.rowCount}`);
      } else {
        throw new Error(result.error || 'Query execution failed');
      }
    } catch (error) {
      console.error('Query failed:', error);
      alert(`Query execution failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  const handleAITest = async () => {
    if (!isElectron) {
      alert('AI features are only available in the Electron app');
      return;
    }

    try {
      const nlQuery = "Show me all users from the users table";
      const result = await convertNLToSQL(nlQuery);

      if (result.success && result.data) {
        alert(`AI Generated SQL:\n\n${result.data.sql}\n\nConfidence: ${result.data.confidence}%`);
      } else {
        throw new Error(result.error || 'AI conversion failed');
      }
    } catch (error) {
      console.error('AI conversion failed:', error);
      alert(`AI conversion failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  const handleCheckUpdates = async () => {
    if (!isElectron) {
      alert('Update checking is only available in the Electron app');
      return;
    }

    await checkForUpdates();
  };

  return (
    <div className="app">
      {/* Title Bar (Electron-specific) */}
      {isElectron && (
        <div className="title-bar electron-drag-region">
          <div className="title-bar-title">QueryFlux</div>
          <div className="title-bar-controls electron-no-drag">
            <button className="title-bar-button minimize" onClick={() => window.electronAPI?.app.minimize()}>
              −
            </button>
            <button className="title-bar-button maximize" onClick={() => window.electronAPI?.app.maximize()}>
              □
            </button>
            <button className="title-bar-button close" onClick={() => window.electronAPI?.app.quit()}>
              ×
            </button>
          </div>
        </div>
      )}

      {/* Main Content */}
      <div className="main-content">
        {/* Header */}
        <header className="app-header">
          <div className="app-logo">
            <h1>QueryFlux</h1>
            <span className="app-subtitle">AI-Powered Database Management</span>
          </div>
          <div className="app-info">
            {isElectron && (
              <span className="version-info">v{appVersion}</span>
            )}
            <span className="platform-badge">{isElectron ? 'Desktop' : 'Web'}</span>
          </div>
        </header>

        {/* Navigation Tabs */}
        {isElectron && (
          <div className="app-navigation">
            <button
              className={`nav-tab ${activeTab === 'overview' ? 'active' : ''}`}
              onClick={() => setActiveTab('overview')}
            >
              Overview
            </button>
            <button
              className={`nav-tab ${activeTab === 'connections' ? 'active' : ''}`}
              onClick={() => setActiveTab('connections')}
            >
              Connections
            </button>
            <button
              className={`nav-tab ${activeTab === 'monitoring' ? 'active' : ''}`}
              onClick={() => setActiveTab('monitoring')}
              disabled={activeConnections.length === 0}
            >
              Monitoring
            </button>
            <button
              className={`nav-tab ${activeTab === 'ai' ? 'active' : ''}`}
              onClick={() => setActiveTab('ai')}
            >
              AI Assistant
            </button>
            <button
              className={`nav-tab ${activeTab === 'settings' ? 'active' : ''}`}
              onClick={() => setActiveTab('settings')}
            >
              Settings
            </button>
          </div>
        )}

        {/* Tab Content */}
        <main className="app-main">
          {!isElectron && (
            <div className="web-features">
              <h3>Web Application</h3>
              <p>
                You're using the web version of QueryFlux. For the full experience with local database
                connections and offline capabilities, download our desktop application.
              </p>
              <div className="download-cta">
                <button className="download-button">
                  Download Desktop App
                </button>
              </div>
            </div>
          )}

          {isElectron && activeTab === 'overview' && (
            <div className="overview-section">
              <div className="welcome-section">
                <h2>Welcome to QueryFlux</h2>
                <p>
                  The future of database management is here. QueryFlux combines the power of AI with
                  comprehensive database support to deliver an unparalleled database management experience.
                </p>
              </div>

              <div className="overview-stats">
                <div className="stat-card">
                  <h3>{connections.length}</h3>
                  <p>Saved Connections</p>
                </div>
                <div className="stat-card">
                  <h3>{activeConnections.length}</h3>
                  <p>Active Connections</p>
                </div>
                <div className="stat-card">
                  <h3>{connectionStatus === 'connected' ? 'Connected' : 'Disconnected'}</h3>
                  <p>Connection Status</p>
                </div>
              </div>

              <div className="quick-actions">
                <h3>Quick Actions</h3>
                <div className="action-buttons">
                  <button onClick={() => setActiveTab('connections')}>
                    Manage Connections
                  </button>
                  {activeConnections.length > 0 && (
                    <button onClick={() => setActiveTab('monitoring')}>
                      View Monitoring
                    </button>
                  )}
                  <button onClick={() => setActiveTab('ai')}>
                    AI Assistant
                  </button>
                  <button onClick={handleCheckUpdates}>
                    Check for Updates
                  </button>
                </div>
              </div>
            </div>
          )}

          {isElectron && activeTab === 'connections' && (
            <div className="connections-section">
              <div className="section-header">
                <h2>Database Connections</h2>
                <button className="primary-button" onClick={handleTestConnection}>
                  Test Connection
                </button>
              </div>

              <div className="connection-status-demo">
                <h3>Current Test Connection</h3>
                <div className="status-indicator">
                  Status: <span className={`status ${connectionStatus}`}>{connectionStatus}</span>
                </div>
                {connectionStatus === 'connected' && (
                  <button onClick={handleTestQuery} className="secondary-button">
                    Test Query
                  </button>
                )}
              </div>

              <div className="feature-grid">
                <div className="feature-card">
                  <h4>Database Types</h4>
                  <p>Support for PostgreSQL, MySQL, MongoDB, Redis, SQLite, SQL Server, Oracle, and more</p>
                </div>
                <div className="feature-card">
                  <h4>Secure Storage</h4>
                  <p>Encrypted local storage for connection credentials and configurations</p>
                </div>
                <div className="feature-card">
                  <h4>Connection Pooling</h4>
                  <p>Efficient connection management with automatic cleanup</p>
                </div>
              </div>
            </div>
          )}

          {isElectron && activeTab === 'monitoring' && (
            <div className="monitoring-section">
              {selectedConnectionId ? (
                <ElectronMonitoringDashboard
                  connectionId={selectedConnectionId}
                  userId={mockUserId}
                />
              ) : (
                <div className="no-connection-selected">
                  <h3>No Connection Selected</h3>
                  <p>Please select a database connection to view monitoring metrics.</p>
                  <button onClick={() => setActiveTab('connections')}>
                    Go to Connections
                  </button>
                </div>
              )}
            </div>
          )}

          {isElectron && activeTab === 'ai' && (
            <div className="ai-section">
              <div className="section-header">
                <h2>AI-Powered Database Assistant</h2>
              </div>

              <div className="ai-features">
                <div className="feature-card">
                  <h4>Natural Language to SQL</h4>
                  <p>Convert plain English queries into SQL with context awareness</p>
                  <div className="feature-actions">
                    <button onClick={handleAITest}>Test NL to SQL</button>
                  </div>
                </div>

                <div className="feature-card">
                  <h4>Query Optimization</h4>
                  <p>Get AI-powered suggestions to improve query performance</p>
                </div>

                <div className="feature-card">
                  <h4>Query Explanation</h4>
                  <p>Understand complex queries with human-readable explanations</p>
                </div>
              </div>
            </div>
          )}

          {isElectron && activeTab === 'settings' && (
            <div className="settings-section">
              <div className="section-header">
                <h2>Settings</h2>
              </div>

              <div className="settings-groups">
                <div className="setting-group">
                  <h3>Application</h3>
                  <div className="setting-item">
                    <label>Version</label>
                    <span>v{appVersion}</span>
                  </div>
                  <div className="setting-item">
                    <label>Updates</label>
                    <button onClick={handleCheckUpdates}>Check for Updates</button>
                    {currentUpdate && currentUpdate.available && (
                      <button onClick={installUpdate} className="update-available">
                        Update Available
                      </button>
                    )}
                  </div>
                </div>

                <div className="setting-group">
                  <h3>Security</h3>
                  <div className="setting-item">
                    <label>Local Storage</label>
                    <span>Encrypted</span>
                  </div>
                  <div className="setting-item">
                    <label>Connection Security</label>
                    <span>SSL/TLS Enabled</span>
                  </div>
                </div>

                <div className="setting-group">
                  <h3>Monitoring</h3>
                  <div className="setting-item">
                    <label>Real-time Updates</label>
                    <span>WebSocket Connected</span>
                  </div>
                  <div className="setting-item">
                    <label>Data Collection</label>
                    <span>Active</span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}

export default App;