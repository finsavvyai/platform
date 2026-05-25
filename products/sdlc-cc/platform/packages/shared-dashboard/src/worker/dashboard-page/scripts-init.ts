/**
 * Dashboard Page - Init scripts (load data, switch tabs)
 */

export const dashboardScriptsInit = `
    <script>
        // Load user data on page load
        window.addEventListener('DOMContentLoaded', async () => {
            await loadUserData();
            await loadStats();
        });

        async function loadUserData() {
            const token = localStorage.getItem('access_token');
            if (!token) {
                window.location.href = '/auth/login';
                return;
            }

            try {
                const response = await fetch('/api/v1/auth/me', {
                    headers: { 'Authorization': \`Bearer \${token}\` }
                });

                if (!response.ok) {
                    localStorage.removeItem('access_token');
                    window.location.href = '/auth/login';
                    return;
                }

                const user = await response.json();
                document.getElementById('user-avatar').textContent = user.name ? user.name[0].toUpperCase() : 'U';
                document.getElementById('settings-email').value = user.email;
                if (user.company) {
                    document.getElementById('settings-company').value = user.company;
                }
            } catch (error) {
                console.error('Failed to load user data:', error);
            }
        }

        async function loadStats() {
            const token = localStorage.getItem('access_token');
            try {
                const response = await fetch('/api/v1/dashboard/stats', {
                    headers: { 'Authorization': \`Bearer \${token}\` }
                });

                if (response.ok) {
                    const stats = await response.json();
                    document.getElementById('stat-maus').textContent = stats.maus?.toLocaleString() || '0';
                    document.getElementById('stat-requests').textContent = stats.requests?.toLocaleString() || '0';
                    document.getElementById('stat-keys').textContent = stats.apiKeys || '0';

                    // Update usage tab
                    document.getElementById('usage-maus').textContent = stats.maus?.toLocaleString() || '0';
                    document.getElementById('usage-requests').textContent = stats.requests?.toLocaleString() || '0';

                    const mauPercent = ((stats.maus || 0) / 50000) * 100;
                    document.getElementById('usage-maus-bar').style.width = \`\${Math.min(mauPercent, 100)}%\`;
                }
            } catch (error) {
                console.error('Failed to load stats:', error);
            }
        }

        function switchTab(tabName) {
            // Hide all tabs
            document.querySelectorAll('.tab-content').forEach(tab => {
                tab.style.display = 'none';
            });

            // Remove active class from all nav items
            document.querySelectorAll('.nav-item').forEach(item => {
                item.classList.remove('active');
            });

            // Show selected tab
            document.getElementById(\`tab-\${tabName}\`).style.display = 'block';

            // Add active class to clicked nav item
            event.target.closest('.nav-item').classList.add('active');

            // Update page title
            const titles = {
                'overview': 'Dashboard',
                'usage': 'Usage & Limits',
                'api-keys': 'API Keys',
                'billing': 'Billing',
                'settings': 'Settings'
            };
            document.getElementById('page-title').textContent = titles[tabName];
        }
`;
