// FinSavvyAI Desktop Application - Main App Controller

class FinSavvyAIApp {
  constructor() {
    this.apiClient = new APIClient();
    this.wsClient = new WebSocketClient();
    this.currentSection = 'dashboard';
    this.config = null;
    this.clusterStatus = null;
    this.nodes = [];
    this.refreshInterval = null;

    this.init();
  }

  async init() {
    try {
      this.showLoading(true);

      // Initialize event listeners
      this.initEventListeners();

      // Load configuration
      await this.loadConfig();

      // Connect WebSocket
      this.wsClient.connect();
      this.setupWebSocketEvents();

      // Load initial data
      await this.loadClusterData();

      // Setup auto-refresh
      this.startAutoRefresh();

      // Apply theme
      this.applyTheme();

      // Show dashboard
      this.showSection('dashboard');

    } catch (error) {
      console.error('Failed to initialize app:', error);
      this.showNotification('Failed to initialize application: ' + error.message, 'error');
    } finally {
      this.showLoading(false);
    }
  }

  initEventListeners() {
    // Navigation
    document.querySelectorAll('.nav-item').forEach(item => {
      item.addEventListener('click', (e) => {
        e.preventDefault();
        const section = item.dataset.section;
        this.showSection(section);
      });
    });

    // Header buttons
    document.getElementById('startClusterBtn').addEventListener('click', () => {
      this.startCluster();
    });

    document.getElementById('stopClusterBtn').addEventListener('click', () => {
      this.stopCluster();
    });

    document.getElementById('refreshBtn').addEventListener('click', () => {
      this.loadClusterData();
    });

    // Quick actions
    document.getElementById('addNodeBtn').addEventListener('click', () => {
      this.showAddNodeModal();
    });

    document.getElementById('viewLogsBtn').addEventListener('click', () => {
      this.viewLogs();
    });

    document.getElementById('configBtn').addEventListener('click', () => {
      this.showSection('settings');
    });

    document.getElementById('exportBtn').addEventListener('click', () => {
      this.exportData();
    });

    // Modal events
    document.getElementById('addNodeModalBtn').addEventListener('click', () => {
      this.showAddNodeModal();
    });

    document.getElementById('closeModalBtn').addEventListener('click', () => {
      this.hideModal('addNodeModal');
    });

    document.getElementById('cancelAddNodeBtn').addEventListener('click', () => {
      this.hideModal('addNodeModal');
    });

    document.getElementById('addNodeForm').addEventListener('submit', (e) => {
      e.preventDefault();
      this.addNode();
    });

    // Settings forms
    document.getElementById('clusterConfigForm').addEventListener('submit', (e) => {
      e.preventDefault();
      this.saveClusterConfig();
    });

    document.getElementById('appConfigForm').addEventListener('submit', (e) => {
      e.preventDefault();
      this.saveAppConfig();
    });

    // Keyboard shortcuts
    document.addEventListener('keydown', (e) => {
      if (e.ctrlKey || e.metaKey) {
        switch (e.key) {
          case 'r':
            e.preventDefault();
            this.loadClusterData();
            break;
          case 'n':
            e.preventDefault();
            this.showAddNodeModal();
            break;
        }
      }
    });
  }

  setupWebSocketEvents() {
    this.wsClient.on('connected', () => {
      this.updateConnectionStatus('Connected');
      this.showNotification('Connected to backend server', 'success');
    });

    this.wsClient.on('disconnected', () => {
      this.updateConnectionStatus('Disconnected');
      this.showNotification('Disconnected from backend server', 'warning');
    });

    this.wsClient.on('error', (error) => {
      console.error('WebSocket error:', error);
      this.updateConnectionStatus('Error');
    });

    this.wsClient.on('cluster_status_updated', (data) => {
      this.clusterStatus = data;
      this.updateClusterStatusDisplay();
    });

    this.wsClient.on('node_added', (nodeId) => {
      this.showNotification(`Node ${nodeId} added successfully`, 'success');
      this.loadClusterData();
    });

    this.wsClient.on('node_removed', (nodeId) => {
      this.showNotification(`Node ${nodeId} removed`, 'info');
      this.loadClusterData();
    });

    this.wsClient.on('cluster_started', () => {
      this.showNotification('Cluster started successfully', 'success');
      this.loadClusterData();
    });

    this.wsClient.on('cluster_stopped', () => {
      this.showNotification('Cluster stopped', 'info');
      this.loadClusterData();
    });
  }

  async loadConfig() {
    try {
      this.config = await this.apiClient.getConfig();
      console.log('Configuration loaded:', this.config);
    } catch (error) {
      console.error('Failed to load config:', error);
      // Use default configuration
      this.config = {
        server: { host: 'localhost', port: 8080 },
        cluster: { master_host: 'localhost', master_port: 8000 },
        ui: { theme: 'dark', language: 'en' }
      };
    }
  }

  async loadClusterData() {
    try {
      // Load cluster status
      this.clusterStatus = await this.apiClient.getClusterStatus();

      // Load nodes
      const nodesData = await this.apiClient.getClusterNodes();
      this.nodes = nodesData.nodes || [];

      // Update UI
      this.updateClusterStatusDisplay();
      this.updateNodesDisplay();
      this.updateMetricsDisplay();

    } catch (error) {
      console.error('Failed to load cluster data:', error);
      this.updateClusterStatusDisplay();
      this.updateNodesDisplay();
    }
  }

  updateClusterStatusDisplay() {
    const statusElement = document.getElementById('clusterStatus');
    const statusIndicator = statusElement.querySelector('.status-indicator');
    const statusText = statusElement.querySelector('.status-text');

    const startBtn = document.getElementById('startClusterBtn');
    const stopBtn = document.getElementById('stopClusterBtn');

    if (this.clusterStatus) {
      const onlineNodes = this.clusterStatus.online_nodes || 0;
      const totalNodes = this.clusterStatus.total_nodes || 0;

      if (onlineNodes > 0) {
        statusIndicator.className = 'status-indicator online';
        statusText.textContent = `${onlineNodes}/${totalNodes} nodes online`;
        startBtn.disabled = true;
        stopBtn.disabled = false;
      } else {
        statusIndicator.className = 'status-indicator offline';
        statusText.textContent = 'Cluster offline';
        startBtn.disabled = false;
        stopBtn.disabled = true;
      }
    } else {
      statusIndicator.className = 'status-indicator offline';
      statusText.textContent = 'Unable to connect';
      startBtn.disabled = false;
      stopBtn.disabled = true;
    }

    // Update dashboard metrics
    if (document.getElementById('totalNodes')) {
      document.getElementById('totalNodes').textContent = this.clusterStatus?.total_nodes || '0';
    }
    if (document.getElementById('onlineNodes')) {
      document.getElementById('onlineNodes').textContent = this.clusterStatus?.online_nodes || '0';
    }
    if (document.getElementById('totalModels')) {
      document.getElementById('totalModels').textContent = this.clusterStatus?.total_models || '0';
    }
  }

  updateNodesDisplay() {
    const nodesList = document.getElementById('nodesList');

    if (!nodesList) return;

    if (this.nodes.length === 0) {
      nodesList.innerHTML = `
        <div class="empty-state">
          <i class="icon-nodes-large">🖥️</i>
          <h3>No nodes configured</h3>
          <p>Add your first worker node to get started with the cluster.</p>
          <button class="btn btn-primary" onclick="app.showAddNodeModal()">Add Node</button>
        </div>
      `;
      return;
    }

    nodesList.innerHTML = this.nodes.map(node => `
      <div class="node-card">
        <div class="node-info">
          <div class="node-status ${node.status}"></div>
          <div class="node-details">
            <h4>${node.name}</h4>
            <p>${node.host}:${node.port} • ${node.models?.join(', ') || 'No models'}</p>
          </div>
        </div>
        <div class="node-actions">
          <button class="btn btn-outline btn-sm" onclick="app.viewNodeDetails('${node.id}')">
            Details
          </button>
          <button class="btn btn-danger btn-sm" onclick="app.removeNode('${node.id}')">
            Remove
          </button>
        </div>
      </div>
    `).join('');
  }

  updateMetricsDisplay() {
    // Update active requests (mock data for now)
    if (document.getElementById('activeRequests')) {
      document.getElementById('activeRequests').textContent =
        Math.floor(Math.random() * 10).toString();
    }

    // Update performance metrics (mock data)
    if (document.getElementById('avgResponseTime')) {
      document.getElementById('avgResponseTime').textContent =
        (Math.random() * 100 + 50).toFixed(0) + 'ms';
    }

    if (document.getElementById('successRate')) {
      document.getElementById('successRate').textContent =
        (Math.random() * 5 + 95).toFixed(1) + '%';
    }

    if (document.getElementById('totalRequests')) {
      document.getElementById('totalRequests').textContent =
        Math.floor(Math.random() * 1000).toString();
    }

    // Update uptime (mock data)
    if (document.getElementById('clusterUptime')) {
      const uptime = Math.floor(Math.random() * 86400); // Random uptime in seconds
      document.getElementById('clusterUptime').textContent = formatDuration(uptime);
    }
  }

  showSection(sectionId) {
    // Update navigation
    document.querySelectorAll('.nav-item').forEach(item => {
      item.classList.remove('active');
      if (item.dataset.section === sectionId) {
        item.classList.add('active');
      }
    });

    // Update sections
    document.querySelectorAll('.section').forEach(section => {
      section.classList.remove('active');
    });

    const targetSection = document.getElementById(sectionId);
    if (targetSection) {
      targetSection.classList.add('active');
    }

    this.currentSection = sectionId;

    // Load section-specific data
    switch (sectionId) {
      case 'nodes':
        this.updateNodesDisplay();
        break;
      case 'models':
        this.updateModelsDisplay();
        break;
      case 'monitoring':
        this.updateMonitoringCharts();
        break;
      case 'settings':
        this.updateSettingsDisplay();
        break;
    }
  }

  updateModelsDisplay() {
    const modelsList = document.getElementById('modelsList');
    if (!modelsList) return;

    // Collect all models from all nodes
    const allModels = new Set();
    this.nodes.forEach(node => {
      (node.models || []).forEach(model => allModels.add(model));
    });

    if (allModels.size === 0) {
      modelsList.innerHTML = `
        <div class="empty-state">
          <i class="icon-models-large">🤖</i>
          <h3>No models available</h3>
          <p>Connect nodes to see available AI models.</p>
        </div>
      `;
      return;
    }

    modelsList.innerHTML = Array.from(allModels).map(model => `
      <div class="model-card">
        <div class="model-info">
          <h4>${model}</h4>
          <p>Available on ${this.nodes.filter(n => n.models?.includes(model)).length} node(s)</p>
        </div>
      </div>
    `).join('');
  }

  updateMonitoringCharts() {
    // Placeholder for chart updates
    console.log('Updating monitoring charts...');
  }

  updateSettingsDisplay() {
    if (!this.config) return;

    // Update cluster config form
    document.getElementById('masterHost').value = this.config.cluster?.master_host || 'localhost';
    document.getElementById('masterPort').value = this.config.cluster?.master_port || 8000;
    document.getElementById('apiKey').value = this.config.cluster?.api_key || '';
    document.getElementById('timeout').value = this.config.cluster?.timeout || 30;

    // Update app config form
    document.getElementById('theme').value = this.config.ui?.theme || 'dark';
    document.getElementById('language').value = this.config.ui?.language || 'en';
    document.getElementById('autoStart').checked = this.config.ui?.auto_start || false;
    document.getElementById('minimizeToTray').checked = this.config.ui?.minimize_to_tray !== false;
    document.getElementById('showNotifications').checked = this.config.ui?.show_notifications !== false;
  }

  async startCluster() {
    try {
      this.showLoading(true);
      await this.apiClient.startCluster();
      this.showNotification('Cluster started successfully', 'success');
      await this.loadClusterData();
    } catch (error) {
      this.showNotification('Failed to start cluster: ' + error.message, 'error');
    } finally {
      this.showLoading(false);
    }
  }

  async stopCluster() {
    try {
      this.showLoading(true);
      await this.apiClient.stopCluster();
      this.showNotification('Cluster stopped', 'info');
      await this.loadClusterData();
    } catch (error) {
      this.showNotification('Failed to stop cluster: ' + error.message, 'error');
    } finally {
      this.showLoading(false);
    }
  }

  showAddNodeModal() {
    document.getElementById('addNodeModal').classList.remove('hidden');
    document.getElementById('nodeName').focus();
  }

  hideModal(modalId) {
    document.getElementById(modalId).classList.add('hidden');
  }

  async addNode() {
    const form = document.getElementById('addNodeForm');
    const formData = new FormData(form);

    const nodeConfig = {
      name: document.getElementById('nodeName').value,
      host: document.getElementById('nodeHost').value,
      port: parseInt(document.getElementById('nodePort').value),
      models: document.getElementById('nodeModels').value.split(',').map(m => m.trim()),
    };

    try {
      this.showLoading(true);
      await this.apiClient.addNode(nodeConfig);
      this.showNotification('Node added successfully', 'success');
      this.hideModal('addNodeModal');
      form.reset();
      await this.loadClusterData();
    } catch (error) {
      this.showNotification('Failed to add node: ' + error.message, 'error');
    } finally {
      this.showLoading(false);
    }
  }

  async removeNode(nodeId) {
    if (!confirm('Are you sure you want to remove this node from the cluster?')) {
      return;
    }

    try {
      this.showLoading(true);
      await this.apiClient.removeNode(nodeId);
      this.showNotification('Node removed successfully', 'info');
      await this.loadClusterData();
    } catch (error) {
      this.showNotification('Failed to remove node: ' + error.message, 'error');
    } finally {
      this.showLoading(false);
    }
  }

  async saveClusterConfig() {
    const config = {
      ...this.config,
      cluster: {
        master_host: document.getElementById('masterHost').value,
        master_port: parseInt(document.getElementById('masterPort').value),
        api_key: document.getElementById('apiKey').value,
        timeout: parseInt(document.getElementById('timeout').value),
      }
    };

    try {
      await this.apiClient.updateConfig(config);
      this.config = config;
      this.showNotification('Cluster configuration saved', 'success');
    } catch (error) {
      this.showNotification('Failed to save configuration: ' + error.message, 'error');
    }
  }

  async saveAppConfig() {
    const config = {
      ...this.config,
      ui: {
        theme: document.getElementById('theme').value,
        language: document.getElementById('language').value,
        auto_start: document.getElementById('autoStart').checked,
        minimize_to_tray: document.getElementById('minimizeToTray').checked,
        show_notifications: document.getElementById('showNotifications').checked,
      }
    };

    try {
      await this.apiClient.updateConfig(config);
      this.config = config;
      this.applyTheme();
      this.showNotification('Application settings saved', 'success');
    } catch (error) {
      this.showNotification('Failed to save settings: ' + error.message, 'error');
    }
  }

  applyTheme() {
    const theme = this.config?.ui?.theme || 'dark';
    document.body.setAttribute('data-theme', theme);
  }

  updateConnectionStatus(status) {
    const statusElement = document.getElementById('connectionStatus');
    if (statusElement) {
      statusElement.textContent = status;
    }
  }

  showLoading(show) {
    const overlay = document.getElementById('loadingOverlay');
    if (overlay) {
      if (show) {
        overlay.classList.remove('hidden');
      } else {
        overlay.classList.add('hidden');
      }
    }
  }

  showNotification(message, type = 'info') {
    const notification = document.getElementById('notification');
    const messageElement = notification.querySelector('.notification-message');

    messageElement.textContent = message;
    notification.className = `notification ${type}`;
    notification.classList.remove('hidden');

    // Auto-hide after 5 seconds
    setTimeout(() => {
      notification.classList.add('hidden');
    }, 5000);

    // Close button
    notification.querySelector('.notification-close').onclick = () => {
      notification.classList.add('hidden');
    };
  }

  viewNodeDetails(nodeId) {
    const node = this.nodes.find(n => n.id === nodeId);
    if (node) {
      alert(`Node Details:\n\nName: ${node.name}\nHost: ${node.host}:${node.port}\nStatus: ${node.status}\nModels: ${node.models?.join(', ') || 'None'}`);
    }
  }

  viewLogs() {
    alert('Log viewer will be implemented in a future version.');
  }

  exportData() {
    const data = {
      clusterStatus: this.clusterStatus,
      nodes: this.nodes,
      timestamp: new Date().toISOString(),
    };

    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `finsavvyai-cluster-export-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);

    this.showNotification('Cluster data exported successfully', 'success');
  }

  startAutoRefresh() {
    if (this.refreshInterval) {
      clearInterval(this.refreshInterval);
    }

    const refreshIntervalMs = (this.config?.ui?.refresh_interval || 5) * 1000;

    this.refreshInterval = setInterval(() => {
      this.loadClusterData();
    }, refreshIntervalMs);
  }

  destroy() {
    if (this.refreshInterval) {
      clearInterval(this.refreshInterval);
    }

    if (this.wsClient) {
      this.wsClient.disconnect();
    }
  }
}

// Initialize app when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  window.app = new FinSavvyAIApp();
});

// Clean up on page unload
window.addEventListener('beforeunload', () => {
  if (window.app) {
    window.app.destroy();
  }
});
