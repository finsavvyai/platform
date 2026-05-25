/**
 * Dashboard Page - Sidebar navigation HTML
 */

export const dashboardSidebarHTML = `
    <!-- Sidebar -->
    <div class="sidebar">
        <div class="logo">⚡ AutoBoot</div>

        <div class="nav-section">
            <div class="nav-title">Overview</div>
            <a href="#overview" class="nav-item active" onclick="switchTab('overview')">
                <span class="nav-icon">📊</span>
                <span>Dashboard</span>
            </a>
            <a href="#usage" class="nav-item" onclick="switchTab('usage')">
                <span class="nav-icon">📈</span>
                <span>Usage</span>
            </a>
        </div>

        <div class="nav-section">
            <div class="nav-title">Development</div>
            <a href="#api-keys" class="nav-item" onclick="switchTab('api-keys')">
                <span class="nav-icon">🔑</span>
                <span>API Keys</span>
            </a>
            <a href="/api/v1/docs" class="nav-item">
                <span class="nav-icon">📚</span>
                <span>Documentation</span>
            </a>
        </div>

        <div class="nav-section">
            <div class="nav-title">Account</div>
            <a href="#billing" class="nav-item" onclick="switchTab('billing')">
                <span class="nav-icon">💳</span>
                <span>Billing</span>
            </a>
            <a href="#settings" class="nav-item" onclick="switchTab('settings')">
                <span class="nav-icon">⚙️</span>
                <span>Settings</span>
            </a>
        </div>

        <div class="nav-section" style="margin-top: auto; padding-top: 24px; border-top: 1px solid var(--border);">
            <a href="#" class="nav-item" onclick="logout()">
                <span class="nav-icon">🚪</span>
                <span>Logout</span>
            </a>
        </div>
    </div>
`;
