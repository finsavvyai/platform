/**
 * Cluster Panel Component
 *
 * Displays cluster status, nodes, and metrics in LM Studio UI
 */

import React, { useEffect, useState } from 'react';

interface ClusterNode {
  node_id: string;
  name: string;
  host: string;
  port: number;
  status: 'online' | 'offline' | 'error';
  models: string[];
  request_count: number;
  error_count: number;
  last_heartbeat: string;
}

interface ClusterStats {
  total_nodes: number;
  online_nodes: number;
  offline_nodes: number;
  total_models: number;
  total_requests: number;
  total_errors: number;
}

interface ClusterStatus {
  cluster_name: string;
  status: 'healthy' | 'degraded';
  stats: ClusterStats;
  nodes: ClusterNode[];
}

export const ClusterPanel: React.FC = () => {
  const [clusterStatus, setClusterStatus] = useState<ClusterStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedNode, setSelectedNode] = useState<ClusterNode | null>(null);

  useEffect(() => {
    // Subscribe to cluster state from extension
    const unsubscribe = window.lmStudio?.ui?.subscribeState?.(
      'clusterStatus',
      (status: ClusterStatus) => {
        setClusterStatus(status);
        setLoading(false);
      }
    );

    return () => {
      unsubscribe?.();
    };
  }, []);

  const getStatusColor = (status: string): string => {
    const colors = {
      online: 'green',
      offline: 'red',
      error: 'orange',
      healthy: 'green',
      degraded: 'orange',
    };
    return colors[status as keyof typeof colors] || 'gray';
  };

  if (loading) {
    return (
      <div className="cluster-panel">
        <div className="loading">Loading cluster status...</div>
      </div>
    );
  }

  if (!clusterStatus) {
    return (
      <div className="cluster-panel">
        <div className="no-cluster">
          <p>No cluster connected.</p>
          <button onClick={() => window.lmStudio?.ui?.executeCommand?.('finSavvy.joinCluster')}>
            Join Cluster
          </button>
        </div>
      </div>
    );
  }

  const { stats, nodes } = clusterStatus;

  return (
    <div className="cluster-panel">
      {/* Cluster Header */}
      <div className="cluster-header">
        <div className="cluster-name">
          <h2>{clusterStatus.cluster_name}</h2>
          <span className={`status-indicator ${clusterStatus.status}`}>
            {clusterStatus.status}
          </span>
        </div>
        <div className="cluster-stats">
          <div className="stat">
            <span className="stat-label">Nodes</span>
            <span className="stat-value">{stats.online_nodes}/{stats.total_nodes}</span>
          </div>
          <div className="stat">
            <span className="stat-label">Models</span>
            <span className="stat-value">{stats.total_models}</span>
          </div>
          <div className="stat">
            <span className="stat-label">Requests</span>
            <span className="stat-value">{stats.total_requests}</span>
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="cluster-actions">
        <button onClick={() => window.lmStudio?.ui?.executeCommand?.('finSavvy.discoverNodes')}>
          Discover Nodes
        </button>
        <button onClick={() => window.lmStudio?.ui?.executeCommand?.('finSavvy.openDashboard')}>
          Open Dashboard
        </button>
      </div>

      {/* Nodes List */}
      <div className="nodes-section">
        <h3>Nodes ({nodes.length})</h3>
        <div className="nodes-list">
          {nodes.map((node) => (
            <div
              key={node.node_id}
              className={`node-card ${selectedNode?.node_id === node.node_id ? 'selected' : ''}`}
              onClick={() => setSelectedNode(node)}
            >
              <div className="node-header">
                <span className="node-name">{node.name}</span>
                <span
                  className="node-status"
                  style={{ color: getStatusColor(node.status) }}
                >
                  {node.status}
                </span>
              </div>

              <div className="node-details">
                <div className="detail-row">
                  <span className="detail-label">Host:</span>
                  <span className="detail-value">{node.host}:{node.port}</span>
                </div>
                <div className="detail-row">
                  <span className="detail-label">Models:</span>
                  <span className="detail-value">
                    {node.models.length > 0
                      ? `${node.models.length} loaded`
                      : 'None'}
                  </span>
                </div>
                <div className="detail-row">
                  <span className="detail-label">Requests:</span>
                  <span className="detail-value">{node.request_count}</span>
                </div>
                {node.error_count > 0 && (
                  <div className="detail-row">
                    <span className="detail-label">Errors:</span>
                    <span className="detail-value error">{node.error_count}</span>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Selected Node Details */}
      {selectedNode && (
        <div className="node-details-panel">
          <h3>Node Details</h3>
          <div className="detail-item">
            <span className="detail-label">Node ID:</span>
            <span className="detail-value">{selectedNode.node_id}</span>
          </div>
          <div className="detail-item">
            <span className="detail-label">Status:</span>
            <span
              className="detail-value"
              style={{ color: getStatusColor(selectedNode.status) }}
            >
              {selectedNode.status}
            </span>
          </div>

          {selectedNode.models.length > 0 && (
            <div className="models-list">
              <h4>Loaded Models ({selectedNode.models.length})</h4>
              {selectedNode.models.map((model) => (
                <div key={model} className="model-item">
                  {model}
                </div>
              ))}
            </div>
          )}

          <div className="node-actions">
            <button
              onClick={() => window.lmStudio?.ui?.openExternal?.(
                `http://${selectedNode.host}:${selectedNode.port}`
              )}
            >
              Open LM Studio
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
