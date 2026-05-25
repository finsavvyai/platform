/**
 * Dashboard Page - Header and overview tab HTML
 */

export const dashboardTabsOverviewHTML = `
    <!-- Main Content -->
    <div class="main-content">
        <!-- Header -->
        <div class="header">
            <div class="header-top">
                <div>
                    <h1 id="page-title">Dashboard</h1>
                    <p class="subtitle" id="page-subtitle">Welcome back! Here's what's happening with your account.</p>
                </div>
                <div class="user-menu">
                    <div class="user-avatar" id="user-avatar">U</div>
                </div>
            </div>
        </div>

        <!-- Tab: Overview -->
        <div id="tab-overview" class="tab-content">
            <!-- Stats Grid -->
            <div class="stats-grid">
                <div class="stat-card">
                    <div class="stat-header">
                        <div class="stat-icon blue">👥</div>
                    </div>
                    <div class="stat-value" id="stat-maus">0</div>
                    <div class="stat-label">Monthly Active Users</div>
                    <div class="stat-change positive">↑ 12% from last month</div>
                </div>

                <div class="stat-card">
                    <div class="stat-header">
                        <div class="stat-icon green">📞</div>
                    </div>
                    <div class="stat-value" id="stat-requests">0</div>
                    <div class="stat-label">API Requests (30d)</div>
                    <div class="stat-change positive">↑ 23% from last month</div>
                </div>

                <div class="stat-card">
                    <div class="stat-header">
                        <div class="stat-icon yellow">⚡</div>
                    </div>
                    <div class="stat-value" id="stat-uptime">99.9%</div>
                    <div class="stat-label">Uptime</div>
                    <div class="stat-change positive">Target: 99.9%</div>
                </div>

                <div class="stat-card">
                    <div class="stat-header">
                        <div class="stat-icon purple">🔐</div>
                    </div>
                    <div class="stat-value" id="stat-keys">0</div>
                    <div class="stat-label">Active API Keys</div>
                    <div class="stat-change">Last created 2d ago</div>
                </div>
            </div>

            <!-- Recent Activity -->
            <div class="card">
                <div class="card-header">
                    <h2 class="card-title">Recent Activity</h2>
                    <button class="btn btn-secondary">View All</button>
                </div>

                <table class="table">
                    <thead>
                        <tr>
                            <th>Event</th>
                            <th>User</th>
                            <th>Time</th>
                            <th>Status</th>
                        </tr>
                    </thead>
                    <tbody id="activity-table">
                        <tr>
                            <td>User login</td>
                            <td>john@example.com</td>
                            <td>2 minutes ago</td>
                            <td><span class="badge active">Success</span></td>
                        </tr>
                        <tr>
                            <td>API key created</td>
                            <td>System</td>
                            <td>1 hour ago</td>
                            <td><span class="badge active">Success</span></td>
                        </tr>
                        <tr>
                            <td>Payment received</td>
                            <td>Billing</td>
                            <td>2 days ago</td>
                            <td><span class="badge active">Success</span></td>
                        </tr>
                    </tbody>
                </table>
            </div>
        </div>
`;
