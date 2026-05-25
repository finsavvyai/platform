import React from 'react';
import { useAppStore } from '../stores';

export const StoreDebug: React.FC = () => {
  const {
    // UI state
    isElectron,
    isLoading,
    sidebarCollapsed,
    theme,
    preferences,

    // Connection state
    connections,
    activeConnections,
    selectedConnectionId,

    // Query state
    currentQuery,
    queries,
    queryHistory,

    // AI state
    conversations,
    suggestions,

    // Monitoring state
    metrics,
    alerts,
    updateInfo,

    // Actions
    setLoading,
    setSidebarCollapsed,
    setTheme,
    addConnection,
    setCurrentQuery,
    addAlert,
  } = useAppStore();

  const handleAddTestConnection = () => {
    addConnection({
      id: `test-conn-${Date.now()}`,
      name: 'Test PostgreSQL Connection',
      type: 'postgresql',
      host: 'localhost',
      port: 5432,
      database: 'testdb',
      username: 'postgres',
      password: 'password',
      ssl: false,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      tags: ['test', 'development'],
      favorite: false,
    });
  };

  const handleAddTestAlert = () => {
    addAlert({
      id: `test-alert-${Date.now()}`,
      type: 'info',
      severity: 'low',
      title: 'Test Alert',
      message: 'This is a test alert from the Zustand store',
      createdAt: Date.now(),
      acknowledged: false,
    });
  };

  const handleToggleTheme = () => {
    setTheme(theme === 'dark' ? 'light' : 'dark');
  };

  return (
    <div style={{
      position: 'fixed',
      bottom: 20,
      right: 20,
      width: 300,
      maxHeight: 400,
      background: 'var(--bg-secondary)',
      border: '1px solid var(--border-color)',
      borderRadius: 'var(--radius-lg)',
      padding: 'var(--spacing-md)',
      overflowY: 'auto',
      zIndex: 1000,
      fontSize: '12px',
      fontFamily: 'monospace'
    }}>
      <h3 style={{ margin: '0 0 var(--spacing-sm) 0', fontSize: '14px' }}>Zustand Store Debug</h3>

      <div style={{ marginBottom: 'var(--spacing-sm)' }}>
        <strong>Platform:</strong> {isElectron ? 'Electron' : 'Web'}<br/>
        <strong>Loading:</strong> {isLoading ? 'Yes' : 'No'}<br/>
        <strong>Sidebar:</strong> {sidebarCollapsed ? 'Collapsed' : 'Expanded'}<br/>
        <strong>Theme:</strong> {theme}
      </div>

      <div style={{ marginBottom: 'var(--spacing-sm)' }}>
        <strong>Connections:</strong> {connections.length}<br/>
        <strong>Active:</strong> {activeConnections.length}<br/>
        <strong>Selected:</strong> {selectedConnectionId || 'None'}
      </div>

      <div style={{ marginBottom: 'var(--spacing-sm)' }}>
        <strong>Queries:</strong> {queries.length}<br/>
        <strong>History:</strong> {queryHistory.length}<br/>
        <strong>Current:</strong> {currentQuery.length > 0 ? `${currentQuery.length} chars` : 'Empty'}
      </div>

      <div style={{ marginBottom: 'var(--spacing-sm)' }}>
        <strong>Conversations:</strong> {conversations.length}<br/>
        <strong>Suggestions:</strong> {suggestions.length}<br/>
        <strong>Alerts:</strong> {alerts.length}
      </div>

      <div style={{ marginBottom: 'var(--spacing-sm)' }}>
        <strong>Metrics:</strong> {metrics.length}<br/>
        <strong>Update:</strong> {updateInfo?.available ? 'Available' : 'None'}<br/>
        <strong>Auto Save:</strong> {preferences.autoSave ? 'On' : 'Off'}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-xs)' }}>
        <button
          onClick={handleToggleTheme}
          style={{
            padding: '4px 8px',
            fontSize: '11px',
            border: '1px solid var(--border-color)',
            borderRadius: 'var(--radius-sm)',
            background: 'var(--accent-primary)',
            color: 'var(--text-primary)',
            cursor: 'pointer'
          }}
        >
          Toggle Theme
        </button>

        <button
          onClick={handleAddTestConnection}
          style={{
            padding: '4px 8px',
            fontSize: '11px',
            border: '1px solid var(--border-color)',
            borderRadius: 'var(--radius-sm)',
            background: 'var(--accent-primary)',
            color: 'var(--text-primary)',
            cursor: 'pointer'
          }}
        >
          Add Test Connection
        </button>

        <button
          onClick={handleAddTestAlert}
          style={{
            padding: '4px 8px',
            fontSize: '11px',
            border: '1px solid var(--border-color)',
            borderRadius: 'var(--radius-sm)',
            background: 'var(--accent-primary)',
            color: 'var(--text-primary)',
            cursor: 'pointer'
          }}
        >
          Add Test Alert
        </button>

        <button
          onClick={() => setLoading(!isLoading)}
          style={{
            padding: '4px 8px',
            fontSize: '11px',
            border: '1px solid var(--border-color)',
            borderRadius: 'var(--radius-sm)',
            background: 'var(--warning-color)',
            color: 'var(--text-primary)',
            cursor: 'pointer'
          }}
        >
          Toggle Loading
        </button>
      </div>
    </div>
  );
};