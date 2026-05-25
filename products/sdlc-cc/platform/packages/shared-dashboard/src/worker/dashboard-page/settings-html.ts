/**
 * Dashboard Page - Settings tab and API key modal HTML
 */

export const dashboardSettingsHTML = `
        <!-- Tab: Settings -->
        <div id="tab-settings" class="tab-content" style="display: none;">
            <div class="card">
                <div class="card-header">
                    <h2 class="card-title">Account Settings</h2>
                </div>

                <div class="form-group">
                    <label class="form-label">Email Address</label>
                    <input type="email" class="form-input" id="settings-email" value="user@example.com">
                </div>

                <div class="form-group">
                    <label class="form-label">Company Name</label>
                    <input type="text" class="form-input" id="settings-company" placeholder="Your company">
                </div>

                <div class="form-group">
                    <label class="form-label">Timezone</label>
                    <select class="form-input" id="settings-timezone">
                        <option>UTC</option>
                        <option>America/New_York</option>
                        <option>America/Los_Angeles</option>
                        <option>Europe/London</option>
                    </select>
                </div>

                <div class="form-actions">
                    <button class="btn" onclick="saveSettings()">Save Changes</button>
                </div>
            </div>

            <div class="card" style="border-color: var(--error);">
                <div class="card-header">
                    <h2 class="card-title" style="color: var(--error);">Danger Zone</h2>
                </div>

                <p style="color: var(--text-secondary); margin-bottom: 16px;">
                    Once you delete your account, there is no going back. Please be certain.
                </p>

                <button class="btn btn-danger" onclick="confirmDelete()">Delete Account</button>
            </div>
        </div>
    </div>

    <!-- Create API Key Modal -->
    <div id="create-key-modal" class="modal">
        <div class="modal-content">
            <div class="modal-header">
                <h3 class="modal-title">Create API Key</h3>
                <p style="color: var(--text-secondary);">Generate a new API key for your application</p>
            </div>

            <div class="form-group">
                <label class="form-label">Key Name</label>
                <input type="text" class="form-input" id="key-name" placeholder="My App API Key">
            </div>

            <div class="form-group">
                <label class="form-label">Environment</label>
                <select class="form-input" id="key-environment">
                    <option>Production</option>
                    <option>Development</option>
                    <option>Staging</option>
                </select>
            </div>

            <div class="form-actions">
                <button class="btn btn-secondary" onclick="closeCreateKeyModal()">Cancel</button>
                <button class="btn" onclick="createAPIKey()">Create Key</button>
            </div>
        </div>
    </div>
`;
