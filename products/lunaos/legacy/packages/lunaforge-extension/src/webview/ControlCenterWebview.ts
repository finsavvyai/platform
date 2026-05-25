/**
 * Modern Control Center Webview with real-time updates and enhanced UI
 */

import * as vscode from 'vscode';
import type { ProjectGraph, ModeStatus } from 'lunaforge-core';

export interface LicenseInfo {
  valid: boolean;
  plan: string;
  features: string[];
}

export interface ControlCenterConfig {
  enableRealtimeUpdates: boolean;
  updateInterval: number;
  theme: 'dark' | 'light' | 'auto';
  compactMode: boolean;
}

export interface WebviewState {
  graphStatus: 'loading' | 'ready' | 'error' | 'building';
  lastUpdate: number;
  activeModes: string[];
  licenseInfo: LicenseInfo | null;
  graphMetrics: {
    nodeCount: number;
    edgeCount: number;
    buildTime: number;
    memoryUsage?: number;
  } | null;
  activePlan: any | null;
  notifications: NotificationMessage[];
}

export interface NotificationMessage {
  id: string;
  type: 'info' | 'warning' | 'error' | 'success';
  title: string;
  message: string;
  timestamp: number;
  autoHide?: boolean;
}

export class ControlCenterWebview {
  private panel: vscode.WebviewPanel | null = null;
  private config: ControlCenterConfig;
  private state: WebviewState;
  private updateTimer: NodeJS.Timer | null = null;
  private onMessageHandlers: Map<string, Function[]> = new Map();

  constructor(
    private extensionUri: vscode.Uri,
    private core: any,
    config: Partial<ControlCenterConfig> = {}
  ) {
    this.config = {
      enableRealtimeUpdates: true,
      updateInterval: 1000,
      theme: 'auto',
      compactMode: false,
      ...config
    };

    this.state = {
      graphStatus: 'loading',
      lastUpdate: Date.now(),
      activeModes: [],
      licenseInfo: null,
      graphMetrics: null,
      activePlan: null,
      notifications: []
    };
  }

  /**
   * Create and show the webview panel
   */
  show(): void {
    if (this.panel) {
      this.panel.reveal();
      return;
    }

    this.panel = vscode.window.createWebviewPanel(
      'lunaforgeControlCenter',
      'LunaForge Control Center',
      vscode.ViewColumn.One,
      {
        enableScripts: true,
        retainContextWhenHidden: true,
        localResourceRoots: [
          this.extensionUri,
          vscode.Uri.joinPath(this.extensionUri, 'webview', 'assets')
        ]
      }
    );

    this.setupWebview();
    this.startRealtimeUpdates();
  }

  /**
   * Setup webview HTML and event handlers
   */
  private setupWebview(): void {
    if (!this.panel) return;

    this.panel.webview.html = this.getHtml();

    // Handle messages from webview
    this.panel.webview.onDidReceiveMessage(
      async (message) => {
        await this.handleWebviewMessage(message);
      },
      undefined
    );

    // Handle panel disposal
    this.panel.onDidDispose(
      () => {
        this.dispose();
      },
      undefined
    );

    // Initial data sync
    this.sendInitialState();
  }

  /**
   * Generate HTML for the webview
   */
  private getHtml(): string {
    const isDark = vscode.workspace.getConfiguration('workbench').get<string>('colorTheme')?.includes('Dark') ?? true;
    const theme = this.config.theme === 'auto' ? (isDark ? 'dark' : 'light') : this.config.theme;

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline';">
  <title>LunaForge Control Center</title>
  <style>
    ${this.getCSS(theme)}
  </style>
</head>
<body data-theme="${theme}" data-compact="${this.config.compactMode}">
  <div class="container">
    <!-- Header -->
    <header class="header">
      <div class="header-content">
        <div class="title-section">
          <h1 class="title">
            <span class="logo">🌙</span>
            LunaForge Control Center
          </h1>
          <p class="subtitle">Advanced project analysis and code intelligence</p>
        </div>
        <div class="header-actions">
          <button id="themeToggle" class="icon-btn" title="Toggle theme" aria-label="Toggle theme">
            ${theme === 'dark' ? '☀️' : '🌙'}
          </button>
          <button id="compactToggle" class="icon-btn" title="Toggle compact mode" aria-label="Toggle compact mode">
            ${this.config.compactMode ? '📖' : '📗'}
          </button>
        </div>
      </div>
    </header>

    <!-- Main Content -->
    <main class="main-content">
      <!-- Status Bar -->
      <section class="status-bar">
        <div class="status-indicators">
          <div class="status-item" id="graphStatus" data-help="graph-status">
            <div class="status-dot"></div>
            <span class="status-text">Graph: <span id="graphStatusText">Loading...</span></span>
          </div>
          <div class="status-item" id="licenseStatus">
            <div class="status-dot"></div>
            <span class="status-text">License: <span id="licenseStatusText">Checking...</span></span>
          </div>
          <div class="status-item" id="connectionStatus">
            <div class="status-dot"></div>
            <span class="status-text">Real-time: <span id="connectionStatusText">Connected</span></span>
          </div>
        </div>
        <div class="last-update">
          Last update: <span id="lastUpdateTime">Never</span>
        </div>
      </section>

      <!-- Grid Layout -->
      <div class="dashboard-grid">
        <!-- Graph Metrics Card -->
              <span class="card-icon">🚀</span>
              Active Modes
            </h2>
            <div class="card-actions">
              <button id="openModeManager" class="btn btn-secondary" title="Manage modes">
                ⚙️ Manage
              </button>
            </div>
          </div>
          <div class="card-content">
            <div class="modes-grid" id="modesGrid">
              <!-- Modes will be dynamically added here -->
            </div>
          </div>
        </section>

        <!-- License Card -->
        <section class="card license-card" id="licenseCard" data-help="license-info">
          <div class="card-header">
            <h2 class="card-title">
              <span class="card-icon">🔑</span>
              License
            </h2>
          </div>
          <div class="card-content">
            <div class="license-info" id="licenseInfo">
              <div class="license-status" id="licenseStatusDisplay">
                <div class="license-plan">Free Plan</div>
                <div class="license-features">Basic features only</div>
              </div>
              <div class="license-actions">
                <input
                  type="text"
                  id="licenseKeyInput"
                  placeholder="Enter license key"
                  class="license-input"
                  aria-label="License key"
                >
                <button id="saveLicense" class="btn btn-primary">Save License</button>
                <button id="upgradeLicense" class="btn btn-secondary">Get Premium</button>
              </div>
            </div>
          </div>
        </section>

        <!-- Plan Card -->
        <section class="card plan-card" id="planCard">
          <div class="card-header">
            <h2 class="card-title">
              <span class="card-icon">📋</span>
              Analysis Plan
            </h2>
            <div class="card-actions">
              <button id="requestPlan" class="btn btn-primary" title="Request new analysis plan">
                🎯 Request Plan
              </button>
            </div>
          </div>
          <div class="card-content">
            <div class="plan-input-section">
              <textarea
                id="planSummaryInput"
                placeholder="Describe what you want to analyze or improve..."
                class="plan-input"
                rows="3"
                aria-label="Plan description"
              ></textarea>
            </div>
            <div class="plan-output" id="planOutput">
              <div class="plan-placeholder">
                <span class="placeholder-icon">📊</span>
                <span class="placeholder-text">No plan available. Request a new analysis to get started.</span>
              </div>
            </div>
          </div>
        </section>

        <!-- Notifications Card -->
        <section class="card notifications-card" id="notificationsCard" data-help="notifications-panel">
          <div class="card-header">
            <h2 class="card-title">
              <span class="card-icon">🔔</span>
              Notifications
            </h2>
            <div class="card-actions">
              <button id="clearNotifications" class="btn btn-secondary" title="Clear all notifications">
                🗑️ Clear
              </button>
            </div>
          </div>
          <div class="card-content">
            <div class="notifications-list" id="notificationsList">
              <div class="no-notifications">No new notifications</div>
            </div>
          </div>
        </section>
      </div>
    </main>

    <!-- Footer -->
    <footer class="footer">
      <div class="footer-content">
        <div class="footer-links">
          <a href="#" class="footer-link" data-action="docs">📚 Documentation</a>
          <a href="#" class="footer-link" data-action="support">💬 Support</a>
          <a href="#" class="footer-link" data-action="about">ℹ️ About</a>
        </div>
        <div class="footer-info">
          <span class="version">LunaForge v2.2.3</span>
        </div>
      </div>
    </footer>
  </div>

  <script>
    ${this.getJavaScript()}
  </script>
</body>
</html>`;
  }

  /**
   * Get CSS styles for the webview
   */
  private getCSS(theme: string): string {
    const colors = {
      dark: {
        bg: '#020617',
        bgSecondary: '#1e293b',
        bgTertiary: '#334155',
        text: '#e5e7eb',
        textSecondary: '#9ca3af',
        border: '#475569',
        primary: '#0369a1',
        success: '#10b981',
        warning: '#f59e0b',
        error: '#ef4444'
      },
      light: {
        bg: '#ffffff',
        bgSecondary: '#f3f4f6',
        bgTertiary: '#e5e7eb',
        text: '#111827',
        textSecondary: '#6b7280',
        border: '#d1d5db',
        primary: '#0ea5e9',
        success: '#22c55e',
        warning: '#f59e0b',
        error: '#ef4444'
      }
    };

    const c = colors[theme as keyof typeof colors];

    return `
      :root {
        --bg: ${c.bg};
        --bg-secondary: ${c.bgSecondary};
        --bg-tertiary: ${c.bgTertiary};
        --text: ${c.text};
        --text-secondary: ${c.textSecondary};
        --border: ${c.border};
        --primary: ${c.primary};
        --success: ${c.success};
        --warning: ${c.warning};
        --error: ${c.error};
      }

      * {
        box-sizing: border-box;
        margin: 0;
        padding: 0;
      }

      body {
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        background: var(--bg);
        color: var(--text);
        line-height: 1.5;
        font-size: 14px;
      }

      body[data-compact="true"] {
        font-size: 12px;
      }

      .container {
        min-height: 100vh;
        display: flex;
        flex-direction: column;
      }

      /* Header Styles */
      .header {
        background: var(--bg-secondary);
        border-bottom: 1px solid var(--border);
        padding: 16px 24px;
      }

      .header-content {
        display: flex;
        justify-content: space-between;
        align-items: center;
        max-width: 1400px;
        margin: 0 auto;
      }

      .title-section {
        display: flex;
        flex-direction: column;
        gap: 4px;
      }

      .title {
        font-size: 24px;
        font-weight: 600;
        display: flex;
        align-items: center;
        gap: 8px;
      }

      .logo {
        font-size: 28px;
      }

      .subtitle {
        color: var(--text-secondary);
        font-size: 14px;
      }

      .header-actions {
        display: flex;
        gap: 8px;
      }

      .icon-btn {
        background: var(--bg-tertiary);
        border: 1px solid var(--border);
        border-radius: 6px;
        padding: 8px;
        cursor: pointer;
        font-size: 14px;
        transition: all 0.2s ease;
      }

      .icon-btn:hover {
        background: var(--primary);
        color: white;
      }

      /* Status Bar */
      .status-bar {
        background: var(--bg);
        border-bottom: 1px solid var(--border);
        padding: 12px 24px;
      }

      .status-indicators {
        display: flex;
        gap: 24px;
        align-items: center;
        flex-wrap: wrap;
      }

      .status-item {
        display: flex;
        align-items: center;
        gap: 6px;
        font-size: 13px;
      }

      .status-dot {
        width: 8px;
        height: 8px;
        border-radius: 50%;
        background: var(--text-secondary);
        animation: pulse 2s infinite;
      }

      .status-dot.active {
        background: var(--success);
      }

      .status-dot.warning {
        background: var(--warning);
      }

      .status-dot.error {
        background: var(--error);
      }

      @keyframes pulse {
        0%, 100% { opacity: 1; }
        50% { opacity: 0.5; }
      }

      .last-update {
        color: var(--text-secondary);
        font-size: 12px;
        margin-top: 8px;
      }

      /* Main Content */
      .main-content {
        flex: 1;
        padding: 24px;
        max-width: 1400px;
        margin: 0 auto;
        width: 100%;
      }

      body[data-compact="true"] .main-content {
        padding: 16px;
      }

      .dashboard-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(350px, 1fr));
        gap: 20px;
      }

      body[data-compact="true"] .dashboard-grid {
        grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
        gap: 16px;
      }

      /* Card Styles */
      .card {
        background: var(--bg-secondary);
        border: 1px solid var(--border);
        border-radius: 8px;
        overflow: hidden;
        display: flex;
        flex-direction: column;
      }

      .card-header {
        padding: 16px 20px;
        border-bottom: 1px solid var(--border);
        display: flex;
        justify-content: space-between;
        align-items: center;
        background: var(--bg-tertiary);
      }

      body[data-compact="true"] .card-header {
        padding: 12px 16px;
      }

      .card-title {
        font-size: 16px;
        font-weight: 600;
        display: flex;
        align-items: center;
        gap: 8px;
      }

      body[data-compact="true"] .card-title {
        font-size: 14px;
      }

      .card-icon {
        font-size: 18px;
      }

      .card-actions {
        display: flex;
        gap: 8px;
      }

      .card-content {
        padding: 20px;
        flex: 1;
      }

      body[data-compact="true"] .card-content {
        padding: 16px;
      }

      /* Button Styles */
      .btn {
        border: none;
        border-radius: 6px;
        padding: 8px 12px;
        font-size: 12px;
        font-weight: 500;
        cursor: pointer;
        transition: all 0.2s ease;
        display: inline-flex;
        align-items: center;
        gap: 4px;
      }

      .btn-primary {
        background: var(--primary);
        color: white;
      }

      .btn-primary:hover {
        opacity: 0.9;
      }

      .btn-secondary {
        background: var(--bg-tertiary);
        color: var(--text);
        border: 1px solid var(--border);
      }

      .btn-secondary:hover {
        background: var(--border);
      }

      /* Metrics Grid */
      .metrics-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(80px, 1fr));
        gap: 16px;
      }

      .metric-item {
        text-align: center;
      }

      .metric-value {
        font-size: 24px;
        font-weight: 700;
        color: var(--primary);
        margin-bottom: 4px;
      }

      body[data-compact="true"] .metric-value {
        font-size: 20px;
      }

      .metric-label {
        font-size: 12px;
        color: var(--text-secondary);
        text-transform: uppercase;
        letter-spacing: 0.5px;
      }

      /* Graph Progress */
      .graph-progress {
        margin-top: 16px;
      }

      .progress-bar {
        height: 4px;
        background: var(--bg-tertiary);
        border-radius: 2px;
        overflow: hidden;
        margin-bottom: 8px;
      }

      .progress-fill {
        height: 100%;
        background: var(--primary);
        width: 0%;
        animation: progress 2s ease-in-out infinite;
      }

      @keyframes progress {
        0% { width: 0%; }
        50% { width: 60%; }
        100% { width: 0%; }
      }

      .progress-text {
        font-size: 12px;
        color: var(--text-secondary);
        text-align: center;
      }

      /* Modes Grid */
      .modes-grid {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
        gap: 12px;
      }

      .mode-item {
        background: var(--bg);
        border: 1px solid var(--border);
        border-radius: 6px;
        padding: 12px;
        text-align: center;
        cursor: pointer;
        transition: all 0.2s ease;
      }

      .mode-item:hover {
        border-color: var(--primary);
        transform: translateY(-1px);
      }

      .mode-item.active {
        background: var(--primary);
        color: white;
        border-color: var(--primary);
      }

      .mode-icon {
        font-size: 24px;
        margin-bottom: 4px;
        display: block;
      }

      .mode-name {
        font-size: 11px;
        font-weight: 500;
      }

      .mode-status {
        font-size: 10px;
        color: var(--text-secondary);
        margin-top: 2px;
      }

      .mode-item.active .mode-status {
        color: rgba(255, 255, 255, 0.8);
      }

      /* License Card */
      .license-info {
        display: flex;
        flex-direction: column;
        gap: 16px;
      }

      .license-status {
        padding: 12px;
        background: var(--bg);
        border-radius: 6px;
        border: 1px solid var(--border);
      }

      .license-plan {
        font-weight: 600;
        margin-bottom: 4px;
      }

      .license-features {
        font-size: 12px;
        color: var(--text-secondary);
      }

      .license-actions {
        display: flex;
        flex-direction: column;
        gap: 12px;
      }

      .license-input {
        padding: 8px 12px;
        border: 1px solid var(--border);
        border-radius: 6px;
        background: var(--bg);
        color: var(--text);
        font-size: 13px;
      }

      .license-input:focus {
        outline: none;
        border-color: var(--primary);
      }

      /* Plan Card */
      .plan-input-section {
        margin-bottom: 16px;
      }

      .plan-input {
        width: 100%;
        padding: 12px;
        border: 1px solid var(--border);
        border-radius: 6px;
        background: var(--bg);
        color: var(--text);
        resize: vertical;
        font-family: inherit;
      }

      .plan-input:focus {
        outline: none;
        border-color: var(--primary);
      }

      .plan-output {
        background: var(--bg);
        border: 1px solid var(--border);
        border-radius: 6px;
        min-height: 120px;
        max-height: 300px;
        overflow-y: auto;
      }

      .plan-placeholder {
        padding: 20px;
        text-align: center;
        color: var(--text-secondary);
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 8px;
      }

      .placeholder-icon {
        font-size: 32px;
        opacity: 0.5;
      }

      /* Notifications */
      .notifications-list {
        max-height: 200px;
        overflow-y: auto;
      }

      .notification-item {
        padding: 12px;
        border-radius: 6px;
        margin-bottom: 8px;
        border-left: 4px solid;
        background: var(--bg);
      }

      .notification-item.info {
        border-left-color: var(--primary);
      }

      .notification-item.success {
        border-left-color: var(--success);
      }

      .notification-item.warning {
        border-left-color: var(--warning);
      }

      .notification-item.error {
        border-left-color: var(--error);
      }

      .notification-title {
        font-weight: 600;
        margin-bottom: 4px;
        font-size: 13px;
      }

      .notification-message {
        font-size: 12px;
        color: var(--text-secondary);
        margin-bottom: 4px;
      }

      .notification-time {
        font-size: 11px;
        color: var(--text-secondary);
        opacity: 0.7;
      }

      .no-notifications {
        text-align: center;
        color: var(--text-secondary);
        padding: 20px;
        font-style: italic;
      }

      /* Tooltips */
      [data-help] {
        position: relative;
        cursor: help;
      }

      .tooltip {
        position: absolute;
        background: var(--bg-tertiary);
        color: var(--text);
        padding: 8px 12px;
        border-radius: 4px;
        font-size: 12px;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
        border: 1px solid var(--border);
        z-index: 1000;
        max-width: 250px;
        pointer-events: none;
        opacity: 0;
        transition: opacity 0.2s ease;
        bottom: 100%;
        left: 50%;
        transform: translateX(-50%);
        margin-bottom: 8px;
        white-space: normal;
        text-align: center;
        line-height: 1.4;
      }

      .tooltip.visible {
        opacity: 1;
      }

      .tooltip::after {
        content: '';
        position: absolute;
        top: 100%;
        left: 50%;
        margin-left: -5px;
        border-width: 5px;
        border-style: solid;
        border-color: var(--border) transparent transparent transparent;
      }

      /* Footer */
      .footer {
        background: var(--bg-secondary);
        border-top: 1px solid var(--border);
        padding: 16px 24px;
        margin-top: auto;
      }

      .footer-content {
        display: flex;
        justify-content: space-between;
        align-items: center;
        max-width: 1400px;
        margin: 0 auto;
      }

      .footer-links {
        display: flex;
        gap: 16px;
      }

      .footer-link {
        color: var(--text-secondary);
        text-decoration: none;
        font-size: 12px;
        transition: color 0.2s ease;
      }

      .footer-link:hover {
        color: var(--primary);
      }

      .footer-info {
        font-size: 12px;
        color: var(--text-secondary);
      }

      /* Responsive Design */
      @media (max-width: 768px) {
        .header-content {
          flex-direction: column;
          align-items: flex-start;
          gap: 12px;
        }

        .dashboard-grid {
          grid-template-columns: 1fr;
        }

        .footer-content {
          flex-direction: column;
          gap: 12px;
          text-align: center;
        }

        .metrics-grid {
          grid-template-columns: repeat(2, 1fr);
        }

        .modes-grid {
          grid-template-columns: repeat(2, 1fr);
        }
      }

      /* Accessibility */
      @media (prefers-reduced-motion: reduce) {
        * {
          animation-duration: 0.01ms !important;
          animation-iteration-count: 1 !important;
          transition-duration: 0.01ms !important;
        }
      }

      /* Focus styles for better accessibility */
      button:focus,
      input:focus,
      textarea:focus,
      a:focus {
        outline: 2px solid var(--primary);
        outline-offset: 2px;
      }

      /* High contrast mode support */
      @media (prefers-contrast: high) {
        :root {
          --border: #000000;
          --text: #000000;
          --bg: #ffffff;
        }

        body[data-theme="dark"] {
          --border: #ffffff;
          --text: #ffffff;
          --bg: #000000;
        }
      }
    `;
  }

  /**
   * Get JavaScript for the webview
   */
  private getJavaScript(): string {
    return `
    // VS Code API
    const vscode = acquireVsCodeApi();

    // State management
    let state = {
      graphStatus: 'loading',
      lastUpdate: Date.now(),
      activeModes: [],
      licenseInfo: null,
      graphMetrics: null,
      activePlan: null,
      notifications: []
    };

    // Initialize
    document.addEventListener('DOMContentLoaded', () => {
      initializeEventListeners();
      initializeTooltips();
      requestInitialState();
      startStatusPolling();
    });

    // Event Listeners
    function initializeEventListeners() {
      // Theme toggle
      document.getElementById('themeToggle').addEventListener('click', () => {
        const currentTheme = document.body.getAttribute('data-theme');
        const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
        document.body.setAttribute('data-theme', newTheme);
        vscode.postMessage({ type: 'toggleTheme', theme: newTheme });
      });

      // Compact mode toggle
      document.getElementById('compactToggle').addEventListener('click', () => {
        const isCompact = document.body.getAttribute('data-compact') === 'true';
        const newCompact = !isCompact;
        document.body.setAttribute('data-compact', newCompact);
        vscode.postMessage({ type: 'toggleCompactMode', compact: newCompact });
      });

      // Graph operations
      document.getElementById('refreshGraph').addEventListener('click', () => {
        updateGraphStatus('building');
        showProgress(true);
        vscode.postMessage({ type: 'refreshGraph' });
      });

      // License operations
      document.getElementById('saveLicense').addEventListener('click', () => {
        const key = document.getElementById('licenseKeyInput').value.trim();
        if (key) {
          vscode.postMessage({ type: 'enterLicense', key });
          document.getElementById('licenseKeyInput').value = '';
          showNotification('info', 'License Saved', 'License key has been saved. Reload to apply changes.');
        }
      });

      document.getElementById('upgradeLicense').addEventListener('click', () => {
        vscode.postMessage({ type: 'requestUpgrade' });
      });

      // Plan operations
      document.getElementById('requestPlan').addEventListener('click', () => {
        const summary = document.getElementById('planSummaryInput').value.trim();
        if (summary) {
          updatePlanOutput('loading');
          vscode.postMessage({ type: 'requestPlan', summary });
        } else {
          showNotification('warning', 'Missing Summary', 'Please provide a summary for the analysis plan.');
        }
      });
      });

      // Mode management
      document.getElementById('openModeManager').addEventListener('click', () => {
        vscode.postMessage({ type: 'openModeManager' });
      });

      // Notifications
      document.getElementById('clearNotifications').addEventListener('click', () => {
        state.notifications = [];
        updateNotificationsList();
        vscode.postMessage({ type: 'clearNotifications' });
      });

      // Footer links
      document.querySelectorAll('.footer-link').forEach(link => {
        link.addEventListener('click', (e) => {
          e.preventDefault();
          const action = link.getAttribute('data-action');
          vscode.postMessage({ type: 'footerAction', action });
        });
      });

      // Keyboard shortcuts
      document.addEventListener('keydown', (e) => {
        if (e.ctrlKey || e.metaKey) {
          switch (e.key) {
            case 'r':
              e.preventDefault();
              document.getElementById('refreshGraph').click();
              break;
            case 'k':
              e.preventDefault();
              document.getElementById('licenseKeyInput').focus();
              break;
            case 'p':
              e.preventDefault();
              document.getElementById('requestPlan').click();
              break;
          }
        }
      });
    }

    function initializeTooltips() {
      const helpTooltips = {
        'status-section': 'Monitor extension health and performance',
        'graph-metrics': 'View real-time codebase analytics',
        'mode-selector': 'Choose analysis modes for different insights',
        'license-info': 'Manage your subscription and features',
        'notifications-panel': 'View important alerts and messages',
        'graph-status': 'Current state of the dependency graph',
        'build-time': 'Time taken to analyze the project',
        'node-count': 'Total number of files in the graph',
        'edge-count': 'Total number of dependencies found'
      };

      document.querySelectorAll('[data-help]').forEach(el => {
        const helpId = el.getAttribute('data-help');
        const text = helpTooltips[helpId];
        
        if (text) {
          const tooltip = document.createElement('div');
          tooltip.className = 'tooltip';
          tooltip.textContent = text;
          el.appendChild(tooltip);

          el.addEventListener('mouseenter', () => {
            tooltip.classList.add('visible');
          });

          el.addEventListener('mouseleave', () => {
            tooltip.classList.remove('visible');
          });
        }
      });
    }

    // Message handling from extension
    window.addEventListener('message', (event) => {
      const message = event.data;

      switch (message.type) {
        case 'updateState':
          Object.assign(state, message.state);
          updateUI();
          break;

        case 'graphReady':
          updateGraphStatus('ready');
          updateGraphMetrics(message.metrics);
          showProgress(false);
          break;

        case 'graphError':
          updateGraphStatus('error');
          showProgress(false);
          showNotification('error', 'Graph Error', message.error || 'Failed to build graph');
          break;

        case 'licenseUpdated':
          updateLicenseDisplay(message.license);
          showNotification('success', 'License Updated', 'Your license has been successfully updated.');
          break;

        case 'planReceived':
          updatePlanOutput('ready', message.plan);
          showNotification('success', 'Plan Generated', 'Analysis plan has been generated successfully.');
          break;

        case 'modeStatusChanged':
          updateModeStatus(message.modeId, message.status);
          break;

        case 'notification':
        showNotification(message.notification.type, message.notification.title, message.notification.message);
        break;
        
      case 'galaxyUpdate':
        updateGalaxySection(message.data);
        break;
        
      case 'guardianUpdate':
        updateGuardianSection(message.violations);
        break;
      }
    });

    // Galaxy & Guardian Renderers
    function updateGalaxySection(data) {
      const container = document.getElementById('galaxyContainer');
      if (!container) return; // Should exist in HTML part
      
      if (data.nodes && data.nodes.length > 0) {
          container.innerHTML = \`
              <div style="padding: 10px; background: var(--bg-secondary); border-radius: 6px;">
                  <div style="display:flex; justify-content:space-between; margin-bottom:8px;">
                      <strong>🌌 Galaxy Snapshot</strong>
                      <span style="font-size:11px; color:var(--text-secondary);">\${data.nodes.length} Nodes</span>
                  </div>
                  <div style="font-size:12px; max-height:100px; overflow-y:auto;">
                      \${data.nodes.slice(0, 5).map(n => \`<div>• \${n.label}</div>\`).join('')}
                      \${data.nodes.length > 5 ? \`<div style="color:var(--text-secondary);">...and \${data.nodes.length - 5} more</div>\` : ''}
                  </div>
              </div>
          \`;
      }
    }

    function updateGuardianSection(violations) {
      const container = document.getElementById('guardianContainer');
      if (!container) return;

      if (!violations || violations.length === 0) {
          container.innerHTML = \`
              <div style="padding: 12px; border: 1px solid var(--success); background: rgba(0,255,0,0.05); border-radius: 6px; color: var(--success);">
                 🛡️ Guardian Active: System Secure
              </div>
          \`;
      } else {
          container.innerHTML = \`
               <div style="padding: 0px;">
                  <div style="margin-bottom:8px; color:var(--error); font-weight:bold;">🛡️ Guardian Violations (\${violations.length})</div>
                  \${violations.map(v => \`
                      <div style="padding:8px; border-left:3px solid var(--error); background:var(--bg-secondary); margin-bottom:4px; font-size:12px;">
                          <strong>\${v.message}</strong>
                          <div style="color:var(--text-secondary); margin-top:2px;">\${v.ruleId}</div>
                      </div>
                  \`).join('')}
               </div>
          \`;
      }
    }

    // UI Update Functions
    function updateUI() {
      updateGraphMetrics(state.graphMetrics);
      updateLicenseDisplay(state.licenseInfo);
      updateActiveModes(state.activeModes);
      updateLastUpdateTime(state.lastUpdate);
      updateNotificationsList();
    }

    function updateGraphStatus(status) {
      state.graphStatus = status;
      const statusText = document.getElementById('graphStatusText');
      const statusDot = document.querySelector('#graphStatus .status-dot');

      switch (status) {
        case 'loading':
          statusText.textContent = 'Loading...';
          statusDot.className = 'status-dot';
          break;
        case 'building':
          statusText.textContent = 'Building...';
          statusDot.className = 'status-dot active';
          break;
        case 'ready':
          statusText.textContent = 'Ready';
          statusDot.className = 'status-dot active';
          break;
        case 'error':
          statusText.textContent = 'Error';
          statusDot.className = 'status-dot error';
          break;
      }
    }

    function updateGraphMetrics(metrics) {
      if (!metrics) return;

      state.graphMetrics = metrics;
      document.getElementById('nodeCount').textContent = metrics.nodeCount.toLocaleString();
      document.getElementById('edgeCount').textContent = metrics.edgeCount.toLocaleString();
      document.getElementById('buildTime').textContent = formatDuration(metrics.buildTime);
      document.getElementById('memoryUsage').textContent = formatBytes(metrics.memoryUsage || 0);

      state.lastUpdate = Date.now();
      updateLastUpdateTime(state.lastUpdate);
    }

    function updateLicenseDisplay(license) {
      if (!license) return;

      state.licenseInfo = license;
      const licenseStatusDisplay = document.getElementById('licenseStatusDisplay');
      const licenseStatusText = document.getElementById('licenseStatusText');
      const licenseDot = document.querySelector('#licenseStatus .status-dot');

      const planName = license.plan.charAt(0).toUpperCase() + license.plan.slice(1);
      const features = license.features.length > 0 ? license.features.join(', ') : 'Basic features only';

      licenseStatusDisplay.innerHTML = \`
        <div class="license-plan">\${planName} Plan</div>
        <div class="license-features">\${features}</div>
      \`;

      licenseStatusText.textContent = planName;

      if (license.valid) {
        licenseDot.className = 'status-dot active';
      } else {
        licenseDot.className = 'status-dot warning';
      }
    }

    function updateActiveModes(modes) {
      state.activeModes = modes;
      const modesGrid = document.getElementById('modesGrid');

      if (modes.length === 0) {
        modesGrid.innerHTML = '<div style="grid-column: 1/-1; text-align: center; color: var(--text-secondary); padding: 20px;">No active modes</div>';
        return;
      }

      modesGrid.innerHTML = modes.map(mode => \`
        <div class="mode-item \${mode.active ? 'active' : ''}" data-mode="\${mode.id}">
          <span class="mode-icon">\${mode.icon || '🚀'}</span>
          <div class="mode-name">\${mode.title}</div>
          <div class="mode-status">\${mode.status}</div>
        </div>
      \`).join('');

      // Add click handlers for mode items
      document.querySelectorAll('.mode-item').forEach(item => {
        item.addEventListener('click', () => {
          const modeId = item.getAttribute('data-mode');
          vscode.postMessage({ type: 'toggleMode', modeId });
        });
      });
    }

    function updatePlanOutput(status, plan = null) {
      const planOutput = document.getElementById('planOutput');

      switch (status) {
        case 'loading':
          planOutput.innerHTML = \`
            <div class="plan-placeholder">
              <div class="progress-bar" style="width: 100%; height: 4px; margin-bottom: 12px;">
                <div class="progress-fill"></div>
              </div>
              <span class="placeholder-text">Generating analysis plan...</span>
            </div>
          \`;
          break;

        case 'ready':
          if (plan && plan.steps) {
            const stepsHtml = plan.steps.map(step => \`
              <div class="plan-step" style="padding: 12px; border-left: 3px solid var(--primary); margin-bottom: 8px; background: var(--bg);">
                <div style="font-weight: 600; margin-bottom: 4px;">\${step.title}</div>
                <div style="font-size: 12px; color: var(--text-secondary);">\${step.description}</div>
                <div style="font-size: 11px; margin-top: 4px; padding: 2px 6px; background: var(--bg-tertiary); border-radius: 3px; display: inline-block;">
                  Status: \${step.status}
                </div>
              </div>
            \`).join('');

            planOutput.innerHTML = \`
              <div style="padding: 16px;">
                <h3 style="margin-bottom: 16px; color: var(--primary);">\${plan.summary || 'Analysis Plan'}</h3>
                \${stepsHtml}
              </div>
            \`;
          } else {
            planOutput.innerHTML = \`
              <div class="plan-placeholder">
                <span class="placeholder-text">No plan data available</span>
              </div>
            \`;
          }
          break;

        default:
          planOutput.innerHTML = \`
            <div class="plan-placeholder">
              <span class="placeholder-icon">📊</span>
              <span class="placeholder-text">No plan available. Request a new analysis to get started.</span>
            </div>
          \`;
      }
    }

    function updateNotificationsList() {
      const notificationsList = document.getElementById('notificationsList');

      if (state.notifications.length === 0) {
        notificationsList.innerHTML = '<div class="no-notifications">No new notifications</div>';
        return;
      }

      notificationsList.innerHTML = state.notifications.map(notification => \`
        <div class="notification-item \${notification.type}" data-id="\${notification.id}">
          <div class="notification-title">\${notification.title}</div>
          <div class="notification-message">\${notification.message}</div>
          <div class="notification-time">\${formatTime(notification.timestamp)}</div>
        </div>
      \`).join('');
    }

    function updateLastUpdateTime(timestamp) {
      const lastUpdateTime = document.getElementById('lastUpdateTime');
      lastUpdateTime.textContent = formatTime(timestamp);
    }

    function showProgress(show) {
      const graphProgress = document.getElementById('graphProgress');
      graphProgress.style.display = show ? 'block' : 'none';
    }

    function showNotification(type, title, message, autoHide = true) {
      const notification = {
        id: Date.now().toString(),
        type,
        title,
        message,
        timestamp: Date.now(),
        autoHide
      };

      state.notifications.unshift(notification);

      // Keep only last 50 notifications
      if (state.notifications.length > 50) {
        state.notifications = state.notifications.slice(0, 50);
      }

      updateNotificationsList();

      if (autoHide) {
        setTimeout(() => {
          const index = state.notifications.findIndex(n => n.id === notification.id);
          if (index !== -1) {
            state.notifications.splice(index, 1);
            updateNotificationsList();
          }
        }, 5000);
      }
    }

    // Utility Functions
    function formatBytes(bytes) {
      if (bytes === 0) return '0 B';
      const k = 1024;
      const sizes = ['B', 'KB', 'MB', 'GB'];
      const i = Math.floor(Math.log(bytes) / Math.log(k));
      return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
    }

    function formatDuration(ms) {
      if (ms < 1000) return ms + 'ms';
      if (ms < 60000) return (ms / 1000).toFixed(1) + 's';
      return (ms / 60000).toFixed(1) + 'm';
    }

    function formatTime(timestamp) {
      const date = new Date(timestamp);
      const now = new Date();
      const diff = now - date;

      if (diff < 60000) return 'Just now';
      if (diff < 3600000) return Math.floor(diff / 60000) + 'm ago';
      if (diff < 86400000) return Math.floor(diff / 3600000) + 'h ago';
      return date.toLocaleDateString();
    }

    // Communication with extension
    function requestInitialState() {
      vscode.postMessage({ type: 'requestInitialState' });
    }

    function startStatusPolling() {
      setInterval(() => {
        vscode.postMessage({ type: 'statusPing' });
      }, 30000); // Ping every 30 seconds
    }

    // Mode status updates
    function updateModeStatus(modeId, status) {
      const modeIndex = state.activeModes.findIndex(mode => mode.id === modeId);
      if (modeIndex !== -1) {
        state.activeModes[modeIndex].status = status;
        updateActiveModes(state.activeModes);
      }
    }
    `;
  }

  /**
   * Handle messages from webview
   */
  private async handleWebviewMessage(message: any): Promise<void> {
    const { type, ...data } = message;

    try {
      switch (type) {
        case 'requestInitialState':
          await this.sendInitialState();
          break;

        case 'refreshGraph':
          await this.refreshGraph();
          break;

        case 'enterLicense':
          await this.handleLicenseEntry(data.key);
          break;

        case 'requestPlan':
          await this.handlePlanRequest(data.summary);
          break;

        case 'toggleMode':
          await this.toggleMode(data.modeId);
          break;

        case 'requestUpgrade':
          await this.requestLicenseUpgrade();
          break;

        case 'openModeManager':
          await this.openModeManager();
          break;

        case 'clearNotifications':
          this.clearNotifications();
          break;

        case 'toggleTheme':
          this.config.theme = data.theme;
          break;

        case 'toggleCompactMode':
          this.config.compactMode = data.compact;
          break;

        case 'footerAction':
          await this.handleFooterAction(data.action);
          break;

        case 'statusPing':
          // Handle status ping - just update last seen time
          break;

        default:
          console.warn('Unknown message type:', type);
      }
    } catch (error) {
      console.error('Error handling webview message:', error);
      this.showNotification('error', 'Error', `Failed to handle ${type}: ${(error as Error).message}`);
    }
  }

  /**
   * Send initial state to webview
   */
  private async sendInitialState(): Promise<void> {
    try {
      const licenseInfo = await this.getLicenseInfo();
      const graphMetrics = await this.getGraphMetrics();
      const activeModes = await this.getActiveModes();

      this.updateState({
        licenseInfo,
        graphMetrics,
        activeModes
      });

      this.sendMessage({
        type: 'updateState',
        state: this.state
      });
    } catch (error) {
      console.error('Error sending initial state:', error);
    }
  }

  /**
   * Refresh graph
   */
  private async refreshGraph(): Promise<void> {
    try {
      this.updateState({ graphStatus: 'building' });
      this.sendMessage({ type: 'graphStatusChanged', status: 'building' });

      await this.core.refresh();

      // The graph:ready event will handle the rest
    } catch (error) {
      this.updateState({ graphStatus: 'error' });
      this.sendMessage({
        type: 'graphError',
        error: (error as Error).message
      });
    }
  }

  /**
   * Handle license key entry
   */
  private async handleLicenseEntry(key: string): Promise<void> {
    try {
      // This will be handled by the main extension
      this.sendMessage({ type: 'licenseProcessing', status: 'processing' });
    } catch (error) {
      this.showNotification('error', 'License Error', (error as Error).message);
    }
  }

  /**
   * Handle analysis plan request
   */
  private async handlePlanRequest(summary: string): Promise<void> {
    try {
      await this.core.ensureGraph();
      await this.core.requestPlan('workspace', summary);
    } catch (error) {
      this.sendMessage({
        type: 'planError',
        error: (error as Error).message
      });
    }
  }

  /**
   * Toggle mode activation
   */
  private async toggleMode(modeId: string): Promise<void> {
    try {
      // This would integrate with the mode management system
      console.log('Toggle mode:', modeId);
    } catch (error) {
      this.showNotification('error', 'Mode Error', (error as Error).message);
    }
  }

  /**
   * Request license upgrade
   */
  private async requestLicenseUpgrade(): Promise<void> {
    const action = await vscode.window.showInformationMessage(
      'Upgrade to LunaForge Premium for advanced features.',
      'Get Premium',
      'Learn More'
    );

    if (action === 'Get Premium') {
      vscode.env.openExternal(vscode.Uri.parse('https://lunaforge.io/pricing'));
    } else if (action === 'Learn More') {
      vscode.env.openExternal(vscode.Uri.parse('https://lunaforge.io/features'));
    }
  }

  /**
   * Open mode manager
   */
  private async openModeManager(): Promise<void> {
    // This would open a more detailed mode management interface
    vscode.window.showInformationMessage('Mode manager will be available in the next update.');
  }

  /**
   * Handle footer actions
   */
  private async handleFooterAction(action: string): Promise<void> {
    switch (action) {
      case 'docs':
        vscode.env.openExternal(vscode.Uri.parse('https://docs.lunaforge.io'));
        break;
      case 'support':
        vscode.env.openExternal(vscode.Uri.parse('https://github.com/lunaforge/lunaforge/issues'));
        break;
      case 'about':
        vscode.window.showInformationMessage(
          'LunaForge v2.2.3 - Advanced Project Analysis & Code Intelligence',
          'OK'
        );
        break;
    }
  }

  /**
   * Get license information
   */
  private async getLicenseInfo(): Promise<LicenseInfo | null> {
    try {
      // This would get license info from the core
      return this.core?.license || null;
    } catch (error) {
      return null;
    }
  }

  /**
   * Get current graph metrics
   */
  private async getGraphMetrics(): Promise<any> {
    try {
      const graph = await this.core?.getGraph();
      if (!graph) return null;

      return {
        nodeCount: graph.files.length,
        edgeCount: graph.dependencies.length,
        buildTime: graph.metadata.buildTime,
        memoryUsage: (graph.metadata as any).memoryUsage
      };
    } catch (error) {
      return null;
    }
  }

  /**
   * Get active modes
   */
  private async getActiveModes(): Promise<any[]> {
    try {
      // This would get active modes from the core
      return this.core?.getActiveModes?.() || [];
    } catch (error) {
      return [];
    }
  }

  /**
   * Show notification in webview
   */
  private showNotification(type: string, title: string, message: string): void {
    const notification: NotificationMessage = {
      id: Date.now().toString(),
      type: type as any,
      title,
      message,
      timestamp: Date.now(),
      autoHide: type !== 'error'
    };

    this.state.notifications.unshift(notification);

    // Keep only last 50 notifications
    if (this.state.notifications.length > 50) {
      this.state.notifications = this.state.notifications.slice(0, 50);
    }

    this.sendMessage({
      type: 'notification',
      notification
    });
  }

  /**
   * Clear all notifications
   */
  private clearNotifications(): void {
    this.state.notifications = [];
    this.sendMessage({
      type: 'notificationsCleared'
    });
  }

  /**
   * Start real-time updates
   */
  private startRealtimeUpdates(): void {
    if (!this.config.enableRealtimeUpdates || this.updateTimer) return;

    this.updateTimer = setInterval(async () => {
      try {
        const graphMetrics = await this.getGraphMetrics();
        if (graphMetrics) {
          this.updateState({ graphMetrics });
          this.sendMessage({
            type: 'metricsUpdated',
            metrics: graphMetrics
          });
        }
      } catch (error) {
        console.error('Error in real-time update:', error);
      }
    }, this.config.updateInterval);
  }

  /**
   * Update internal state
   */
  private updateState(updates: Partial<WebviewState>): void {
    this.state = { ...this.state, ...updates, lastUpdate: Date.now() };
  }

  /**
   * Send message to webview
   */
  private sendMessage(message: any): void {
    if (this.panel) {
      this.panel.webview.postMessage(message);
    }
  }

  /**
   * Setup event listeners from core
   */
  public setupCoreEventListeners(): void {
    if (!this.core) return;

    // Graph events
    this.core.bus?.on('graph:ready', (graph: ProjectGraph) => {
      const metrics = {
        nodeCount: graph.files.length,
        edgeCount: graph.dependencies.length,
        buildTime: graph.metadata.buildTime,
        memoryUsage: (graph.metadata as any).memoryUsage
      };

      this.updateState({ graphStatus: 'ready', graphMetrics: metrics });
      this.sendMessage({
        type: 'graphReady',
        metrics
      });
    });

    // Plan events
    this.core.bus?.on('plan:received', (plan: any) => {
      this.updateState({ activePlan: plan });
      this.sendMessage({
        type: 'planReceived',
        plan
      });
    });

    // License events
    this.core.bus?.on('license:validated', (license: LicenseInfo) => {
      this.updateState({ licenseInfo: license });
      this.sendMessage({
        type: 'licenseUpdated',
        license
      });
    });

    // Error events
    this.core.bus?.on('lunaforge:error', (error: any) => {
      this.showNotification('error', 'System Error', error.message || 'An unknown error occurred');
    });

    // --- Galaxy Events ---
    this.core.bus?.on('galaxy:data', (data: any) => {
      this.sendMessage({ type: 'galaxyUpdate', data });
      this.showNotification('info', 'Galaxy Updated', `Received ${data.nodes.length} nodes from Galaxy.`);
    });

    // --- Guardian Events ---
    this.core.bus?.on('guardian:violations', (data: any) => {
      const count = data.violations.length;
      if (count > 0) {
        this.showNotification('warning', 'Guardian Alert', `Detected ${count} architectural violations.`);
        this.sendMessage({ type: 'guardianUpdate', violations: data.violations });
      }
    });

    this.core.bus?.on('guardian:summary', (data: any) => {
      if (data.violationCount === 0) {
        this.sendMessage({ type: 'guardianUpdate', violations: [] });
      }
    });

    // Performance events
    this.core.bus?.on('performance:metric', (metric: any) => {
      // Handle performance metrics if needed
      console.log('Performance metric:', metric);
    });
  }

  /**
   * Dispose of the webview
   */
  public dispose(): void {
    if (this.updateTimer) {
      clearInterval(this.updateTimer as any);
      this.updateTimer = null;
    }

    if (this.panel) {
      this.panel.dispose();
      this.panel = null;
    }

    this.onMessageHandlers.clear();
  }
}