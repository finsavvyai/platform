import React, { useState, useEffect } from 'react';
import { useElectronDatabase, useElectronMetrics } from '../hooks';
import './ElectronMonitoringDashboard.css';

interface ElectronMonitoringDashboardProps {
  connectionId: string;
  userId: string;
}

const ElectronMonitoringDashboard: React.FC<ElectronMonitoringDashboardProps> = ({
  connectionId,
  userId,
}) => {
  const { getConnectionInfo } = useElectronDatabase();
  const {
    metrics,
    metricsHistory,
    activeAlerts,
    alertStats,
    monitoringStatus,
    isLoading,
    error,
    startMonitoring,
    stopMonitoring,
    getLatestMetrics,
    getMetricsHistory,
    getActiveAlerts,
    resolveAlert,
    muteAlert,
    batchResolveAlerts,
    clearError,
  } = useElectronMetrics(userId);

  const [selectedTimeRange, setSelectedTimeRange] = useState('1h'); // 1h, 6h, 24h, 7d
  const [showAlertDetails, setShowAlertDetails] = useState(false);

  // Get connection info
  const [connectionInfo, setConnectionInfo] = useState<any>(null);

  useEffect(() => {
    const loadConnectionInfo = async () => {
      const info = await getConnectionInfo(connectionId);
      setConnectionInfo(info);
    };
    loadConnectionInfo();
  }, [connectionId, getConnectionInfo]);

  // Load initial data
  useEffect(() => {
    const loadData = async () => {
      await getLatestMetrics(connectionId);
      await getActiveAlerts();
    };
    loadData();
  }, [connectionId, getLatestMetrics, getActiveAlerts]);

  // Handle monitoring toggle
  const handleToggleMonitoring = async () => {
    if (monitoringStatus?.isMonitoring) {
      await stopMonitoring(connectionId);
    } else {
      await startMonitoring(connectionId, 30); // 30 seconds interval
    }
  };

  // Handle time range change
  const handleTimeRangeChange = async (range: string) => {
    setSelectedTimeRange(range);

    // Calculate start and end times
    const endTime = new Date().toISOString();
    let startTime: string;

    switch (range) {
      case '1h':
        startTime = new Date(Date.now() - 60 * 60 * 1000).toISOString();
        break;
      case '6h':
        startTime = new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString();
        break;
      case '24h':
        startTime = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
        break;
      case '7d':
        startTime = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
        break;
      default:
        startTime = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    }

    await getMetricsHistory(connectionId, startTime, endTime);
  };

  // Get severity color
  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical': return '#dc3545';
      case 'high': return '#fd7e14';
      case 'medium': return '#ffc107';
      case 'low': return '#28a745';
      default: return '#6c757d';
    }
  };

  // Get metric status color
  const getMetricStatusColor = (value: number, threshold: number) => {
    if (value >= threshold * 1.5) return '#dc3545'; // Critical
    if (value >= threshold * 1.2) return '#fd7e14'; // High
    if (value >= threshold) return '#ffc107'; // Medium
    return '#28a745'; // Good
  };

  if (!connectionInfo) {
    return <div className="monitoring-dashboard loading">Loading connection information...</div>;
  }

  return (
    <div className="monitoring-dashboard">
      {/* Header */}
      <div className="dashboard-header">
        <div className="connection-info">
          <h3>{connectionInfo.name || connectionInfo.database}</h3>
          <span className="connection-type">{connectionInfo.type.toUpperCase()}</span>
          <span className={`connection-status ${connectionInfo.connected ? 'connected' : 'disconnected'}`}>
            {connectionInfo.connected ? 'Connected' : 'Disconnected'}
          </span>
        </div>

        <div className="dashboard-controls">
          <div className="time-range-selector">
            <label>Time Range:</label>
            <select value={selectedTimeRange} onChange={(e) => handleTimeRangeChange(e.target.value)}>
              <option value="1h">Last Hour</option>
              <option value="6h">Last 6 Hours</option>
              <option value="24h">Last 24 Hours</option>
              <option value="7d">Last 7 Days</option>
            </select>
          </div>

          <button
            className={`monitoring-toggle ${monitoringStatus?.isMonitoring ? 'active' : ''}`}
            onClick={handleToggleMonitoring}
            disabled={isLoading}
          >
            {monitoringStatus?.isMonitoring ? 'Stop Monitoring' : 'Start Monitoring'}
          </button>
        </div>
      </div>

      {/* Metrics Grid */}
      <div className="metrics-grid">
        <div className="metric-card cpu">
          <div className="metric-header">
            <span className="metric-title">CPU Usage</span>
            <span className="metric-value" style={{ color: getMetricStatusColor(metrics?.cpu_usage || 0, 80) }}>
              {metrics?.cpu_usage?.toFixed(1) || 0}%
            </span>
          </div>
          <div className="metric-progress">
            <div
              className="progress-bar"
              style={{
                width: `${metrics?.cpu_usage || 0}%`,
                backgroundColor: getMetricStatusColor(metrics?.cpu_usage || 0, 80)
              }}
            />
          </div>
        </div>

        <div className="metric-card memory">
          <div className="metric-header">
            <span className="metric-title">Memory Usage</span>
            <span className="metric-value" style={{ color: getMetricStatusColor(metrics?.memory_usage || 0, 85) }}>
              {metrics?.memory_usage?.toFixed(1) || 0}%
            </span>
          </div>
          <div className="metric-progress">
            <div
              className="progress-bar"
              style={{
                width: `${metrics?.memory_usage || 0}%`,
                backgroundColor: getMetricStatusColor(metrics?.memory_usage || 0, 85)
              }}
            />
          </div>
        </div>

        <div className="metric-card disk">
          <div className="metric-header">
            <span className="metric-title">Disk Usage</span>
            <span className="metric-value" style={{ color: getMetricStatusColor(metrics?.disk_usage || 0, 90) }}>
              {metrics?.disk_usage?.toFixed(1) || 0}%
            </span>
          </div>
          <div className="metric-progress">
            <div
              className="progress-bar"
              style={{
                width: `${metrics?.disk_usage || 0}%`,
                backgroundColor: getMetricStatusColor(metrics?.disk_usage || 0, 90)
              }}
            />
          </div>
        </div>

        <div className="metric-card connections">
          <div className="metric-header">
            <span className="metric-title">Active Connections</span>
            <span className="metric-value" style={{ color: getMetricStatusColor(metrics?.active_connections || 0, 100) }}>
              {metrics?.active_connections || 0}
            </span>
          </div>
          <div className="metric-info">
            <small>Threshold: 100</small>
          </div>
        </div>

        <div className="metric-card queries">
          <div className="metric-header">
            <span className="metric-title">Queries/Second</span>
            <span className="metric-value">
              {metrics?.queries_per_second?.toFixed(1) || 0}
            </span>
          </div>
          <div className="metric-info">
            <small>Current rate</small>
          </div>
        </div>

        <div className="metric-card query-time">
          <div className="metric-header">
            <span className="metric-title">Avg Query Time</span>
            <span className="metric-value" style={{ color: getMetricStatusColor(metrics?.avg_query_time || 0, 5000) }}>
              {(metrics?.avg_query_time || 0).toFixed(0)}ms
            </span>
          </div>
          <div className="metric-info">
            <small>Threshold: 5000ms</small>
          </div>
        </div>
      </div>

      {/* Alerts Section */}
      <div className="alerts-section">
        <div className="alerts-header">
          <h4>Active Alerts ({activeAlerts.length})</h4>
          <div className="alerts-actions">
            {activeAlerts.length > 0 && (
              <>
                <button
                  className="batch-resolve-btn"
                  onClick={() => batchResolveAlerts(activeAlerts.map(a => a.id))}
                >
                  Resolve All
                </button>
                <button
                  className="toggle-details-btn"
                  onClick={() => setShowAlertDetails(!showAlertDetails)}
                >
                  {showAlertDetails ? 'Hide' : 'Show'} Details
                </button>
              </>
            )}
          </div>
        </div>

        {activeAlerts.length === 0 ? (
          <div className="no-alerts">
            <span className="success-icon">✓</span>
            <p>No active alerts. All systems operating normally.</p>
          </div>
        ) : (
          <div className="alerts-list">
            {activeAlerts.map((alert) => (
              <div key={alert.id} className="alert-item" style={{ borderLeftColor: getSeverityColor(alert.severity) }}>
                <div className="alert-header">
                  <span className="alert-type">{alert.type.replace('_', ' ').toUpperCase()}</span>
                  <span className="alert-severity" style={{ color: getSeverityColor(alert.severity) }}>
                    {alert.severity.toUpperCase()}
                  </span>
                  <span className="alert-time">
                    {new Date(alert.created_at).toLocaleTimeString()}
                  </span>
                </div>

                <div className="alert-message">{alert.message}</div>

                {showAlertDetails && (
                  <div className="alert-details">
                    <div className="alert-detail-row">
                      <span>Threshold:</span>
                      <span>{alert.threshold}</span>
                    </div>
                    <div className="alert-detail-row">
                      <span>Current Value:</span>
                      <span>{alert.current_value}</span>
                    </div>
                    <div className="alert-detail-row">
                      <span>Connection ID:</span>
                      <span>{alert.connection_id}</span>
                    </div>
                  </div>
                )}

                <div className="alert-actions">
                  <button
                    className="resolve-btn"
                    onClick={() => resolveAlert(alert.id)}
                  >
                    Resolve
                  </button>
                  <button
                    className="mute-btn"
                    onClick={() => muteAlert(alert.id)}
                  >
                    Mute
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Status Footer */}
      <div className="dashboard-footer">
        <div className="status-info">
          {monitoringStatus?.isMonitoring ? (
            <span className="monitoring-active">
              ● Monitoring active (updating every {monitoringStatus.interval}s)
            </span>
          ) : (
            <span className="monitoring-inactive">
              ○ Monitoring inactive
            </span>
          )}
        </div>

        <div className="last-update">
          {metrics && (
            <span>Last updated: {new Date(metrics.timestamp).toLocaleString()}</span>
          )}
        </div>
      </div>

      {/* Error Display */}
      {error && (
        <div className="error-banner">
          <span className="error-message">{error}</span>
          <button className="dismiss-error" onClick={clearError}>×</button>
        </div>
      )}
    </div>
  );
};

export default ElectronMonitoringDashboard;