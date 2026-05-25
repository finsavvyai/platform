// AutoBoot Integration Hub - Page header and integration card grid

export const headerAndCards = `
<body>
    <div class="container">
        <header>
            <h1>AutoBoot <span class="gradient-text">Integrations</span></h1>
            <p class="subtitle">Visual setup flows powered by AI. Get your API key, copy the code, and you're live in 60 seconds.</p>
        </header>

        <div class="integrations-grid">
            <!-- Authentication Integration -->
            <div class="integration-card" onclick="openIntegration('auth')">
                <div class="integration-icon">🔐</div>
                <h3 class="integration-title">Authentication</h3>
                <p class="integration-description">Add secure login, sessions, and SSO to your app in minutes. JWT-based auth that just works.</p>
                <div class="integration-stats">
                    <div class="stat">
                        <span class="stat-icon">⚡</span>
                        <span>60s setup</span>
                    </div>
                    <div class="stat">
                        <span class="stat-icon">✓</span>
                        <span>Zero config</span>
                    </div>
                </div>
                <button class="setup-btn">Start Integration →</button>
            </div>

            <!-- Billing Integration -->
            <div class="integration-card" onclick="openIntegration('billing')">
                <div class="integration-icon">💳</div>
                <h3 class="integration-title">Billing & Payments</h3>
                <p class="integration-description">Accept payments, manage subscriptions, and track revenue. Powered by LemonSqueezy.</p>
                <div class="integration-stats">
                    <div class="stat">
                        <span class="stat-icon">⚡</span>
                        <span>90s setup</span>
                    </div>
                    <div class="stat">
                        <span class="stat-icon">✓</span>
                        <span>Auto webhooks</span>
                    </div>
                </div>
                <button class="setup-btn">Start Integration →</button>
            </div>

            <!-- Analytics Integration -->
            <div class="integration-card" onclick="openIntegration('analytics')">
                <div class="integration-icon">📊</div>
                <h3 class="integration-title">Analytics & Logging</h3>
                <p class="integration-description">Track events, monitor errors, and analyze user behavior across all your products.</p>
                <div class="integration-stats">
                    <div class="stat">
                        <span class="stat-icon">⚡</span>
                        <span>45s setup</span>
                    </div>
                    <div class="stat">
                        <span class="stat-icon">✓</span>
                        <span>Real-time</span>
                    </div>
                </div>
                <button class="setup-btn">Start Integration →</button>
            </div>

            <!-- Email Verification -->
            <div class="integration-card" onclick="openIntegration('email')">
                <div class="integration-icon">📧</div>
                <h3 class="integration-title">Email Verification</h3>
                <p class="integration-description">Send verification emails, magic links, and transactional messages. Powered by Resend.</p>
                <div class="integration-stats">
                    <div class="stat">
                        <span class="stat-icon">⚡</span>
                        <span>30s setup</span>
                    </div>
                    <div class="stat">
                        <span class="stat-icon">✓</span>
                        <span>Auto templates</span>
                    </div>
                </div>
                <button class="setup-btn">Start Integration →</button>
            </div>

            <!-- SMS Verification -->
            <div class="integration-card" onclick="openIntegration('sms')">
                <div class="integration-icon">📱</div>
                <h3 class="integration-title">SMS Verification</h3>
                <p class="integration-description">Send OTP codes, 2FA verification, and SMS notifications. Powered by Twilio.</p>
                <div class="integration-stats">
                    <div class="stat">
                        <span class="stat-icon">⚡</span>
                        <span>40s setup</span>
                    </div>
                    <div class="stat">
                        <span class="stat-icon">✓</span>
                        <span>Global reach</span>
                    </div>
                </div>
                <button class="setup-btn">Start Integration →</button>
            </div>
        </div>
    </div>`;
