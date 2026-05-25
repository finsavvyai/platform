/**
 * Questro Business Intelligence Dashboard Worker
 *
 * Web interface for comprehensive BI analytics including:
 * - Real-time KPI dashboard
 * - Interactive data visualizations
 * - Predictive analytics interface
 * - Business impact analysis
 * - Custom report generation
 * - Data export capabilities
 */

import { BusinessIntelligenceService, createBusinessIntelligenceService } from '../services/business-intelligence';

// Mock D1 database for demonstration
const mockD1Database = {
  prepare: (query: string) => ({
    bind: (...params: any[]) => ({
      run: () => Promise.resolve({ success: true, changes: 1 }),
      first: () => Promise.resolve({
        id: 'project-001',
        name: 'Demo Project',
        description: 'BI Dashboard Demo'
      }),
      all: () => Promise.resolve({
        results: [
          {
            id: 'test-run-001',
            status: 'passed',
            createdAt: new Date().toISOString(),
            duration: 45000
          }
        ]
      })
    })
  })
};

// Initialize BI service
const biService = createBusinessIntelligenceService(mockD1Database as any, {
  enableRealTimeAnalytics: true,
  cacheDuration: 300000, // 5 minutes
  batchSize: 1000,
  enablePredictiveAnalytics: true,
  enableCostTracking: true,
  enableBusinessImpact: true,
  defaultTimeRange: '30d',
  maxHistoricalDays: 365
});

export default {
  async fetch(request: Request, env: any, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;
    const method = request.method;

    console.log(`📊 Questro BI Dashboard: ${method} ${path}`);

    try {
      // Serve static dashboard files
      if (path === '/' || path.startsWith('/dashboard')) {
        return this.serveDashboard(path);
      }

      // API endpoints for BI functionality
      if (path.startsWith('/api/bi')) {
        return await this.handleBIRequest(path, method, url, request);
      }

      // Static assets (CSS, JS, images)
      if (path.startsWith('/assets')) {
        return this.serveStaticAsset(path);
      }

      // Default 404 response
      return new Response('Not Found', { status: 404 });

    } catch (error) {
      console.error('❌ BI Dashboard Error:', error);
      return new Response('Internal Server Error', { status: 500 });
    }
  },

  /**
   * Serve the main dashboard HTML
   */
  serveDashboard(path: string): Response {
    const isDashboard = path === '/' || path === '/dashboard';
    const isOverview = path === '/dashboard/overview';
    const isAnalytics = path === '/dashboard/analytics';
    const isReports = path === '/dashboard/reports';
    const isPredictions = path === '/dashboard/predictions';

    const html = this.generateDashboardHTML(isOverview || isDashboard, isAnalytics, isReports, isPredictions);
    return new Response(html, {
      headers: {
        'Content-Type': 'text/html',
        'Cache-Control': 'no-cache'
      }
    });
  },

  /**
   * Generate dashboard HTML based on current view
   */
  generateDashboardHTML(showOverview: boolean, showAnalytics: boolean, showReports: boolean, showPredictions: boolean): string {
    return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Questro Business Intelligence</title>
    <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
    <script src="https://cdn.tailwindcss.com"></script>
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0/css/all.min.css">
    <style>
        .metric-card {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        }
        .metric-value {
            font-size: 2rem;
            font-weight: bold;
        }
        .metric-label {
            font-size: 0.875rem;
            opacity: 0.9;
        }
        .chart-container {
            position: relative;
            height: 300px;
        }
        .trend-up { color: #10b981; }
        .trend-down { color: #ef4444; }
        .trend-stable { color: #6b7280; }
        .alert-critical { background-color: #dc2626; }
        .alert-warning { background-color: #f59e0b; }
        .alert-info { background-color: #2563eb; }
    </style>
</head>
<body class="bg-gray-50">
    <!-- Navigation Header -->
    <nav class="bg-white shadow-sm border-b">
        <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div class="flex justify-between h-16">
                <div class="flex items-center">
                    <div class="flex-shrink-0">
                        <h1 class="text-2xl font-bold text-indigo-600">
                            <i class="fas fa-chart-line mr-2"></i>Questro BI
                        </h1>
                    </div>
                    <div class="hidden md:block">
                        <div class="ml-10 flex items-baseline space-x-4">
                            <a href="/dashboard" class="text-gray-700 hover:text-indigo-600 px-3 py-2 text-sm font-medium ${showOverview ? 'border-b-2 border-indigo-500' : ''}">
                                Overview
                            </a>
                            <a href="/dashboard/analytics" class="text-gray-700 hover:text-indigo-600 px-3 py-2 text-sm font-medium ${showAnalytics ? 'border-b-2 border-indigo-500' : ''}">
                                Analytics
                            </a>
                            <a href="/dashboard/reports" class="text-gray-700 hover:text-indigo-600 px-3 py-2 text-sm font-medium ${showReports ? 'border-b-2 border-indigo-500' : ''}">
                                Reports
                            </a>
                            <a href="/dashboard/predictions" class="text-gray-700 hover:text-indigo-600 px-3 py-2 text-sm font-medium ${showPredictions ? 'border-b-2 border-indigo-500' : ''}">
                                Predictions
                            </a>
                        </div>
                    </div>
                </div>
                <div class="flex items-center">
                    <div class="flex-shrink-0">
                        <button type="button" class="relative p-2 text-gray-400 hover:text-gray-500">
                            <i class="fas fa-bell"></i>
                            <span class="absolute top-0 right-0 block h-2 w-2 rounded-full bg-red-500"></span>
                        </button>
                        <div class="ml-3 relative">
                            <button type="button" class="flex items-center text-sm rounded-full focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500" id="user-menu-button">
                                <img class="h-8 w-8 rounded-full" src="https://api.dicebear.com/7.x/avataaars/svg?seed=admin" alt="User">
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </nav>

    <!-- Main Content -->
    <main class="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        ${showOverview ? this.generateOverviewSection() : ''}
        ${showAnalytics ? this.generateAnalyticsSection() : ''}
        ${showReports ? this.generateReportsSection() : ''}
        ${showPredictions ? this.generatePredictionsSection() : ''}
    </main>

    <!-- Footer -->
    <footer class="bg-white border-t mt-auto">
        <div class="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
            <div class="md:flex md:items-center md:justify-between">
                <div class="text-center md:text-left">
                    <p class="text-sm text-gray-500">
                        &copy; 2024 Questro. All rights reserved.
                    </p>
                </div>
                <div class="mt-4 flex justify-center space-x-6 md:mt-0">
                    <a href="#" class="text-gray-400 hover:text-gray-500">
                        <span class="sr-only">Documentation</span>
                        <i class="fas fa-book"></i>
                    </a>
                    <a href="#" class="text-gray-400 hover:text-gray-500">
                        <span class="sr-only">API</span>
                        <i class="fas fa-code"></i>
                    </a>
                    <a href="#" class="text-gray-400 hover:text-gray-500">
                        <span class="sr-only">Support</span>
                        <i class="fas fa-life-ring"></i>
                    </a>
                </div>
            </div>
        </div>
    </footer>

    <script>
        // Dashboard JavaScript for real-time updates and interactivity
        let updateInterval;

        // Initialize dashboard
        document.addEventListener('DOMContentLoaded', function() {
            loadDashboardData();
            startRealTimeUpdates();
            setupChartInteractions();
        });

        // Load dashboard data
        async function loadDashboardData() {
            try {
                // Load KPIs
                const kpiResponse = await fetch('/api/bi/kpi-dashboard');
                const kpiData = await kpiResponse.json();
                updateKPIMetrics(kpiData.data);

                // Load alerts
                updateAlerts(kpiData.data.alerts);

                // Load insights
                updateInsights(kpiData.data.insights);

                console.log('Dashboard data loaded successfully');
            } catch (error) {
                console.error('Failed to load dashboard data:', error);
                showError('Failed to load dashboard data');
            }
        }

        // Start real-time updates
        function startRealTimeUpdates() {
            updateInterval = setInterval(async () => {
                try {
                    const response = await fetch('/api/bi/real-time-metrics');
                    const data = await response.json();
                    updateRealTimeMetrics(data.data);
                } catch (error) {
                    console.warn('Real-time update failed:', error);
                }
            }, 30000); // Update every 30 seconds
        }

        // Update KPI metrics
        function updateKPIMetrics(kpis) {
            // Update metric cards
            document.querySelectorAll('[data-metric]').forEach(element => {
                const metric = element.getAttribute('data-metric');
                if (kpis.summary[metric]) {
                    const value = kpis.summary[metric];
                    const formattedValue = formatMetricValue(metric, value);
                    element.querySelector('.metric-value').textContent = formattedValue;

                    // Update trend indicator
                    const trend = kpis.trends.find(t => t.metric === metric);
                    if (trend) {
                        updateTrendIndicator(element, trend);
                    }
                }
            });

            // Render charts
            renderKPICharts(kpis);
        }

        // Update real-time metrics
        function updateRealTimeMetrics(metrics) {
            // Update real-time counters
            updateCounter('active-tests', metrics.activeTests);
            updateCounter('execution-rate', metrics.testExecutionRate);
            updateCounter('success-rate', metrics.successRate);
            updateCounter('avg-duration', metrics.averageDuration);

            // Update resource usage
            updateResourceUsage(metrics.resourceUsage);

            // Update recent activity
            updateRecentActivity(metrics.recentActivity);
        }

        // Update alerts
        function updateAlerts(alerts) {
            const alertsContainer = document.getElementById('alerts-container');
            alertsContainer.innerHTML = '';

            alerts.forEach(alert => {
                const alertHtml = \`
                    <div class="alert-\${alert.severity} text-white p-3 rounded-lg mb-2">
                        <div class="flex items-center">
                            <i class="fas fa-exclamation-triangle mr-2"></i>
                            <span class="font-medium">\${alert.message}</span>
                        </div>
                    </div>
                \`;
                alertsContainer.innerHTML += alertHtml;
            });

            if (alerts.length === 0) {
                alertsContainer.innerHTML = '<div class="text-gray-500 text-center py-4">No alerts at this time</div>';
            }
        }

        // Update insights
        function updateInsights(insights) {
            const insightsContainer = document.getElementById('insights-container');
            insightsContainer.innerHTML = '';

            insights.forEach(insight => {
                const insightHtml = \`
                    <div class="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-3">
                        <div class="flex">
                            <i class="fas fa-lightbulb text-blue-600 mr-3 mt-1"></i>
                            <p class="text-blue-800">\${insight}</p>
                        </div>
                    </div>
                \`;
                insightsContainer.innerHTML += insightHtml;
            });
        }

        // Format metric values
        function formatMetricValue(metric, value) {
            switch(metric) {
                case 'testExecutionRate':
                case 'testSuccessRate':
                case 'testCoverage':
                case 'defectDetectionRate':
                case 'testAutomationRate':
                case 'resourceUtilization':
                case 'teamProductivity':
                case 'testEnvironmentUptime':
                case 'userSatisfaction':
                case 'budgetUtilization':
                    return value.toFixed(1) + '%';
                case 'testingROI':
                    return value.toFixed(0) + '%';
                case 'costPerTest':
                    return '$' + value.toFixed(2);
                case 'timeToMarket':
                    return value.toFixed(1) + ' days';
                case 'totalTestingCost':
                case 'costSavings':
                case 'valueGenerated':
                    return '$' + value.toLocaleString();
                default:
                    return value.toString();
            }
        }

        // Update trend indicators
        function updateTrendIndicator(element, trend) {
            let indicator = element.querySelector('.trend-indicator');
            if (!indicator) {
                indicator = document.createElement('span');
                indicator.className = 'trend-indicator ml-2';
                element.appendChild(indicator);
            }

            const icon = trend.trend === 'up' ? 'fa-arrow-up' :
                         trend.trend === 'down' ? 'fa-arrow-down' : 'fa-minus';
            const colorClass = 'trend-' + trend.trend;

            indicator.innerHTML = \`<i class="fas \${icon} \${colorClass}"></i> \${trend.change > 0 ? '+' : ''}\${trend.change.toFixed(1)}%\`;
        }

        // Render KPI charts
        function renderKPICharts(kpis) {
            // This would initialize Chart.js charts with KPI data
            console.log('Rendering KPI charts with data:', kpis);
        }

        // Update counter elements
        function updateCounter(id, value) {
            const element = document.getElementById(id);
            if (element) {
                element.textContent = value.toLocaleString();
            }
        }

        // Update resource usage
        function updateResourceUsage(usage) {
            Object.keys(usage).forEach(resource => {
                const element = document.getElementById(\`resource-\${resource}\`);
                if (element) {
                    element.style.width = usage[resource] + '%';
                    const valueElement = element.parentElement.querySelector('.resource-value');
                    if (valueElement) {
                        valueElement.textContent = usage[resource] + '%';
                    }
                }
            });
        }

        // Update recent activity
        function updateRecentActivity(activity) {
            const container = document.getElementById('recent-activity');
            if (container) {
                container.innerHTML = '';
                activity.forEach(item => {
                    const timeAgo = getTimeAgo(new Date(item.timestamp));
                    const activityHtml = \`
                        <div class="flex items-center justify-between py-2 border-b">
                            <div>
                                <span class="font-medium text-gray-900">\${item.project}</span>
                                <span class="text-sm text-gray-500 ml-2">\${item.type}</span>
                            </div>
                            <div class="text-right">
                                <span class="text-sm text-gray-500">\${timeAgo}</span>
                                <span class="text-xs text-gray-400 ml-2">\${item.duration}s</span>
                            </div>
                        </div>
                    \`;
                    container.innerHTML += activityHtml;
                });
            }
        }

        // Get time ago string
        function getTimeAgo(date) {
            const seconds = Math.floor((new Date() - date) / 1000);

            if (seconds < 60) return seconds + 's ago';
            if (seconds < 3600) return Math.floor(seconds / 60) + 'm ago';
            if (seconds < 86400) return Math.floor(seconds / 3600) + 'h ago';
            return Math.floor(seconds / 86400) + 'd ago';
        }

        // Setup chart interactions
        function setupChartInteractions() {
            // Add event listeners for chart interactions
            console.log('Chart interactions setup');
        }

        // Show error message
        function showError(message) {
            const alertContainer = document.getElementById('alerts-container');
            if (alertContainer) {
                alertContainer.innerHTML = \`
                    <div class="alert-critical text-white p-4 rounded-lg">
                        <div class="flex items-center">
                            <i class="fas fa-exclamation-circle mr-2"></i>
                            <span class="font-medium">\${message}</span>
                        </div>
                    </div>
                \`;
            }
        }

        // Cleanup on page unload
        window.addEventListener('beforeunload', () => {
            if (updateInterval) {
                clearInterval(updateInterval);
            }
        });
    </script>
</body>
</html>
    `;
  },

  /**
   * Generate Overview section HTML
   */
  generateOverviewSection(): string {
    return `
        <!-- Page Header -->
        <div class="mb-8">
            <h1 class="text-3xl font-bold text-gray-900">Business Intelligence Overview</h1>
            <p class="mt-2 text-gray-600">Comprehensive analytics and insights for your testing operations</p>
        </div>

        <!-- KPI Metrics Grid -->
        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            <!-- Testing Performance KPIs -->
            <div class="metric-card text-white p-6 rounded-xl shadow-lg">
                <div class="metric-label">Test Success Rate</div>
                <div class="metric-value mt-2" data-metric="testSuccessRate">
                    <i class="fas fa-spinner fa-spin"></i>
                </div>
                <div class="trend-indicator mt-2"></div>
            </div>

            <div class="metric-card text-white p-6 rounded-xl shadow-lg">
                <div class="metric-label">Test Coverage</div>
                <div class="metric-value mt-2" data-metric="testCoverage">
                    <i class="fas fa-spinner fa-spin"></i>
                </div>
                <div class="trend-indicator mt-2"></div>
            </div>

            <!-- Business Impact KPIs -->
            <div class="bg-gradient-to-r from-green-500 to-blue-600 text-white p-6 rounded-xl shadow-lg">
                <div class="metric-label">Testing ROI</div>
                <div class="metric-value mt-2" data-metric="testingROI">
                    <i class="fas fa-spinner fa-spin"></i>
                </div>
                <div class="trend-indicator mt-2"></div>
            </div>

            <div class="bg-gradient-to-r from-purple-500 to-pink-600 text-white p-6 rounded-xl shadow-lg">
                <div class="metric-label">Cost Savings</div>
                <div class="metric-value mt-2" data-metric="costSavings">
                    <i class="fas fa-spinner fa-spin"></i>
                </div>
                <div class="trend-indicator mt-2"></div>
            </div>
        </div>

        <!-- Real-time Metrics -->
        <div class="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
            <!-- Real-time Activity -->
            <div class="bg-white rounded-lg shadow-sm border p-6">
                <h2 class="text-lg font-semibold text-gray-900 mb-4">
                    <i class="fas fa-broadcast-tower text-indigo-600 mr-2"></i>
                    Real-time Activity
                </h2>
                <div class="space-y-4">
                    <div class="flex justify-between items-center">
                        <span class="text-gray-600">Active Tests</span>
                        <span class="font-semibold text-gray-900" id="active-tests">
                            <i class="fas fa-spinner fa-spin"></i>
                        </span>
                    </div>
                    <div class="flex justify-between items-center">
                        <span class="text-gray-600">Execution Rate</span>
                        <span class="font-semibold text-gray-900" id="execution-rate">
                            <i class="fas fa-spinner fa-spin"></i>
                        </span>
                    </div>
                    <div class="flex justify-between items-center">
                        <span class="text-gray-600">Success Rate</span>
                        <span class="font-semibold text-gray-900" id="success-rate">
                            <i class="fas fa-spinner fa-spin"></i>
                        </span>
                    </div>
                    <div class="flex justify-between items-center">
                        <span class="text-gray-600">Avg Duration</span>
                        <span class="font-semibold text-gray-900" id="avg-duration">
                            <i class="fas fa-spinner fa-spin"></i>
                        </span>
                    </div>
                </div>
            </div>

            <!-- Resource Usage -->
            <div class="bg-white rounded-lg shadow-sm border p-6">
                <h2 class="text-lg font-semibold text-gray-900 mb-4">
                    <i class="fas fa-server text-indigo-600 mr-2"></i>
                    Resource Usage
                </h2>
                <div class="space-y-3">
                    <div>
                        <div class="flex justify-between mb-1">
                            <span class="text-gray-600">CPU</span>
                            <span class="text-sm font-medium resource-value" id="resource-cpu">--</span>
                        </div>
                        <div class="w-full bg-gray-200 rounded-full h-2">
                            <div class="bg-blue-600 h-2 rounded-full transition-all duration-300" id="resource-cpu-bar" style="width: 0%"></div>
                        </div>
                    </div>
                    <div>
                        <div class="flex justify-between mb-1">
                            <span class="text-gray-600">Memory</span>
                            <span class="text-sm font-medium resource-value" id="resource-memory">--</span>
                        </div>
                        <div class="w-full bg-gray-200 rounded-full h-2">
                            <div class="bg-green-600 h-2 rounded-full transition-all duration-300" id="resource-memory-bar" style="width: 0%"></div>
                        </div>
                    </div>
                    <div>
                        <div class="flex justify-between mb-1">
                            <span class="text-gray-600">Disk</span>
                            <span class="text-sm font-medium resource-value" id="resource-disk">--</span>
                        </div>
                        <div class="w-full bg-gray-200 rounded-full h-2">
                            <div class="bg-yellow-600 h-2 rounded-full transition-all duration-300" id="resource-disk-bar" style="width: 0%"></div>
                        </div>
                    </div>
                    <div>
                        <div class="flex justify-between mb-1">
                            <span class="text-gray-600">Network</span>
                            <span class="text-sm font-medium resource-value" id="resource-network">--</span>
                        </div>
                        <div class="w-full bg-gray-200 rounded-full h-2">
                            <div class="bg-purple-600 h-2 rounded-full transition-all duration-300" id="resource-network-bar" style="width: 0%"></div>
                        </div>
                    </div>
                </div>
            </div>
        </div>

        <!-- Alerts and Insights -->
        <div class="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
            <!-- Active Alerts -->
            <div class="bg-white rounded-lg shadow-sm border p-6">
                <h2 class="text-lg font-semibold text-gray-900 mb-4">
                    <i class="fas fa-exclamation-triangle text-yellow-500 mr-2"></i>
                    Active Alerts
                </h2>
                <div id="alerts-container">
                    <div class="text-gray-500 text-center py-4">
                        <i class="fas fa-spinner fa-spin mr-2"></i>
                        Loading alerts...
                    </div>
                </div>
            </div>

            <!-- Key Insights -->
            <div class="bg-white rounded-lg shadow-sm border p-6">
                <h2 class="text-lg font-semibold text-gray-900 mb-4">
                    <i class="fas fa-lightbulb text-yellow-500 mr-2"></i>
                    Key Insights
                </h2>
                <div id="insights-container">
                    <div class="text-gray-500 text-center py-4">
                        <i class="fas fa-spinner fa-spin mr-2"></i>
                        Analyzing data...
                    </div>
                </div>
            </div>
        </div>

        <!-- Recent Activity -->
        <div class="bg-white rounded-lg shadow-sm border p-6">
            <h2 class="text-lg font-semibold text-gray-900 mb-4">
                <i class="fas fa-clock text-indigo-600 mr-2"></i>
                Recent Activity
            </h2>
            <div id="recent-activity" class="space-y-0">
                <div class="text-gray-500 text-center py-4">
                    <i class="fas fa-spinner fa-spin mr-2"></i>
                    Loading activity...
                </div>
            </div>
        </div>
    `;
  },

  /**
   * Generate Analytics section HTML
   */
  generateAnalyticsSection(): string {
    return `
        <!-- Page Header -->
        <div class="mb-8">
            <h1 class="text-3xl font-bold text-gray-900">Analytics & Reporting</h1>
            <p class="mt-2 text-gray-600">Deep dive into your testing data with interactive analytics and custom reports</p>
        </div>

        <!-- Analytics Content -->
        <div class="bg-white rounded-lg shadow-sm border p-6">
            <div class="text-center py-12">
                <i class="fas fa-chart-bar text-6xl text-gray-300 mb-4"></i>
                <h3 class="text-lg font-medium text-gray-900 mb-2">Advanced Analytics</h3>
                <p class="text-gray-600 mb-6">Interactive charts and detailed analytics coming soon...</p>
                <button class="bg-indigo-600 text-white px-6 py-2 rounded-lg hover:bg-indigo-700 transition-colors">
                    <i class="fas fa-chart-line mr-2"></i>
                    Generate Analytics Report
                </button>
            </div>
        </div>
    `;
  },

  /**
   * Generate Reports section HTML
   */
  generateReportsSection(): string {
    return `
        <!-- Page Header -->
        <div class="mb-8">
            <h1 class="text-3xl font-bold text-gray-900">Custom Reports</h1>
            <p class="mt-2 text-gray-600">Create and manage custom reports tailored to your specific needs</p>
        </div>

        <!-- Reports Content -->
        <div class="bg-white rounded-lg shadow-sm border p-6">
            <div class="text-center py-12">
                <i class="fas fa-file-alt text-6xl text-gray-300 mb-4"></i>
                <h3 class="text-lg font-medium text-gray-900 mb-2">Report Builder</h3>
                <p class="text-gray-600 mb-6">Custom report generation tools coming soon...</p>
                <div class="flex flex-wrap justify-center gap-4">
                    <button class="bg-indigo-600 text-white px-6 py-2 rounded-lg hover:bg-indigo-700 transition-colors">
                        <i class="fas fa-file-export mr-2"></i>
                        Export Data
                    </button>
                    <button class="bg-green-600 text-white px-6 py-2 rounded-lg hover:bg-green-700 transition-colors">
                        <i class="fas fa-calendar mr-2"></i>
                        Schedule Report
                    </button>
                </div>
            </div>
        </div>
    `;
  },

  /**
   * Generate Predictions section HTML
   */
  generatePredictionsSection(): string {
    return `
        <!-- Page Header -->
        <div class="mb-8">
            <h1 class="text-3xl font-bold text-gray-900">Predictive Analytics</h1>
            <p class="mt-2 text-gray-600">AI-powered predictions and insights for future testing needs</p>
        </div>

        <!-- Predictions Content -->
        <div class="bg-white rounded-lg shadow-sm border p-6">
            <div class="text-center py-12">
                <i class="fas fa-brain text-6xl text-gray-300 mb-4"></i>
                <h3 class="text-lg font-medium text-gray-900 mb-2">AI Predictions</h3>
                <p class="text-gray-600 mb-6">Machine learning predictions and forecasting capabilities coming soon...</p>
                <button class="bg-purple-600 text-white px-6 py-2 rounded-lg hover:bg-purple-700 transition-colors">
                    <i class="fas fa-crystal-ball mr-2"></i>
                    Generate Predictions
                </button>
            </div>
        </div>
    `;
  },

  /**
   * Serve static assets (CSS, JS, images)
   */
  serveStaticAsset(path: string): Response {
    // This would serve actual static files in a real implementation
    return new Response('Static asset not implemented: ' + path, { status: 404 });
  },

  /**
   * Handle BI API requests
   */
  async handleBIRequest(path: string, method: string, url: URL, request: Request): Promise<Response> {
    try {
      // KPI Dashboard
      if (path === '/api/bi/kpi-dashboard' && method === 'GET') {
        const kpiData = await biService.getKPIDashboard();
        return Response.json({
          success: true,
          data: kpiData
        });
      }

      // Real-time metrics
      if (path === '/api/bi/real-time-metrics' && method === 'GET') {
        const metrics = await biService.getRealTimeMetrics();
        return Response.json({
          success: true,
          data: metrics
        });
      }

      // Business impact analysis
      if (path === '/api/bi/business-impact' && method === 'POST') {
        const body = await request.json();
        const analysis = await biService.getBusinessImpactAnalysis(body);
        return Response.json({
          success: true,
          data: analysis
        });
      }

      // Predictive analytics
      if (path === '/api/bi/predictive-analytics' && method === 'POST') {
        const body = await request.json();
        const predictions = await biService.getPredictiveAnalytics(body);
        return Response.json({
          success: true,
          data: predictions
        });
      }

      // Custom report generation
      if (path === '/api/bi/generate-report' && method === 'POST') {
        const body = await request.json();
        const report = await biService.generateCustomReport(body);
        return Response.json({
          success: true,
          data: report
        });
      }

      // Data export
      if (path === '/api/bi/export-data' && method === 'POST') {
        const body = await request.json();
        const exportData = await biService.exportData(body);
        return Response.json({
          success: true,
          data: exportData
        });
      }

      // Health check
      if (path === '/api/bi/health' && method === 'GET') {
        return Response.json({
          status: 'healthy',
          service: 'Business Intelligence Dashboard',
          version: '1.0.0',
          capabilities: {
            realTimeAnalytics: true,
            predictiveAnalytics: true,
            customReports: true,
            dataExport: true,
            businessImpact: true
          },
          timestamp: new Date().toISOString()
        });
      }

      // Default 404
      return Response.json({
        error: 'BI API endpoint not found',
        availableEndpoints: [
          'GET /api/bi/health',
          'GET /api/bi/kpi-dashboard',
          'GET /api/bi/real-time-metrics',
          'POST /api/bi/business-impact',
          'POST /api/bi/predictive-analytics',
          'POST /api/bi/generate-report',
          'POST /api/bi/export-data'
        ]
      }, { status: 404 });

    } catch (error) {
      console.error('BI API Error:', error);
      return Response.json({
        error: 'BI API request failed',
        details: error instanceof Error ? error.message : 'Unknown error'
      }, { status: 500 });
    }
  }
};
