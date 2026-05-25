/**
 * Dashboard Page - Usage, API keys, and billing tab HTML
 */

export const dashboardTabsDataHTML = `
        <!-- Tab: Usage -->
        <div id="tab-usage" class="tab-content" style="display: none;">
            <div class="card">
                <div class="card-header">
                    <h2 class="card-title">Usage This Month</h2>
                </div>

                <div class="form-group">
                    <div class="form-label">Monthly Active Users</div>
                    <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
                        <span id="usage-maus">0</span>
                        <span id="usage-maus-limit">/ 50,000</span>
                    </div>
                    <div class="progress-bar">
                        <div class="progress-fill" id="usage-maus-bar" style="width: 0%"></div>
                    </div>
                </div>

                <div class="form-group">
                    <div class="form-label">API Requests</div>
                    <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
                        <span id="usage-requests">0</span>
                        <span>Unlimited</span>
                    </div>
                    <div class="progress-bar">
                        <div class="progress-fill" id="usage-requests-bar" style="width: 5%"></div>
                    </div>
                </div>

                <div class="form-group">
                    <div class="form-label">Storage Used</div>
                    <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
                        <span id="usage-storage">0 MB</span>
                        <span>/ 10 GB</span>
                    </div>
                    <div class="progress-bar">
                        <div class="progress-fill" id="usage-storage-bar" style="width: 0%"></div>
                    </div>
                </div>
            </div>
        </div>

        <!-- Tab: API Keys -->
        <div id="tab-api-keys" class="tab-content" style="display: none;">
            <div class="card">
                <div class="card-header">
                    <h2 class="card-title">API Keys</h2>
                    <button class="btn" onclick="openCreateKeyModal()">Create New Key</button>
                </div>

                <div id="api-keys-list">
                    <!-- API keys will be loaded here -->
                </div>

                <div id="no-keys" class="empty-state">
                    <div class="empty-icon">🔑</div>
                    <div class="empty-title">No API keys yet</div>
                    <div class="empty-text">Create your first API key to start integrating with AutoBoot</div>
                    <button class="btn" onclick="openCreateKeyModal()">Create Your First Key</button>
                </div>
            </div>
        </div>

        <!-- Tab: Billing -->
        <div id="tab-billing" class="tab-content" style="display: none;">
            <div class="card">
                <div class="card-header">
                    <h2 class="card-title">Current Plan</h2>
                    <a href="/pricing" class="btn">Upgrade Plan</a>
                </div>

                <div style="padding: 20px; background: rgba(67, 97, 238, 0.1); border-radius: 12px; margin-bottom: 24px;">
                    <div style="display: flex; justify-content: space-between; align-items: center;">
                        <div>
                            <div style="font-size: 24px; font-weight: 700; margin-bottom: 4px;" id="plan-name">Pro Plan</div>
                            <div style="color: var(--text-secondary);">$49/month • 50,000 MAUs</div>
                        </div>
                        <div style="text-align: right;">
                            <div style="font-size: 14px; color: var(--text-secondary); margin-bottom: 4px;">Next billing</div>
                            <div style="font-weight: 600;" id="next-billing">Feb 3, 2026</div>
                        </div>
                    </div>
                </div>

                <table class="table">
                    <thead>
                        <tr>
                            <th>Date</th>
                            <th>Description</th>
                            <th>Amount</th>
                            <th>Status</th>
                            <th>Invoice</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr>
                            <td>Jan 3, 2026</td>
                            <td>Pro Plan - Monthly</td>
                            <td>$49.00</td>
                            <td><span class="badge active">Paid</span></td>
                            <td><a href="#" style="color: var(--accent);">Download</a></td>
                        </tr>
                        <tr>
                            <td>Dec 3, 2025</td>
                            <td>Pro Plan - Monthly</td>
                            <td>$49.00</td>
                            <td><span class="badge active">Paid</span></td>
                            <td><a href="#" style="color: var(--accent);">Download</a></td>
                        </tr>
                    </tbody>
                </table>
            </div>
        </div>
`;
