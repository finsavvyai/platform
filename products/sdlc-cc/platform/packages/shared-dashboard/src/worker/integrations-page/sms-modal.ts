// AutoBoot Integration Hub - SMS verification modal

export const smsModal = `
    <!-- SMS Verification Modal -->
    <div id="sms-modal" class="modal">
        <div class="modal-content">
            <div class="modal-header">
                <h2>📱 SMS Verification Integration</h2>
                <button class="modal-close" onclick="closeModal('sms')">✕</button>
            </div>
            <div class="modal-body">
                <!-- Visual Flow -->
                <div class="visual-flow">
                    <h3 class="flow-title">Integration Flow</h3>
                    <div class="flow-steps">
                        <div class="flow-step">
                            <div class="step-circle completed">🔑</div>
                            <div class="step-label">1. Get API Key</div>
                            <div class="step-description">Copy your unique key</div>
                        </div>
                        <div class="flow-arrow">→</div>
                        <div class="flow-step">
                            <div class="step-circle">📝</div>
                            <div class="step-label">2. Add Code</div>
                            <div class="step-description">Paste into your app</div>
                        </div>
                        <div class="flow-arrow">→</div>
                        <div class="flow-step">
                            <div class="step-circle">✨</div>
                            <div class="step-label">3. Send SMS</div>
                            <div class="step-description">2FA codes delivered</div>
                        </div>
                    </div>
                </div>

                <!-- API Key Section -->
                <div class="api-key-section">
                    <div class="section-title">
                        <span>🔑</span>
                        <span>Your API Key</span>
                    </div>
                    <div class="key-display">
                        <code id="sms-key">sk_live_sms_def789ghi012_autoboot_twilio_prod</code>
                        <button class="copy-btn" onclick="copyKey('sms')">Copy</button>
                    </div>
                    <p style="font-size: 0.875rem; color: var(--text-secondary); margin-top: 0.75rem;">
                        ⚠️ Keep this secret! Store in environment variable: <code style="background: var(--bg-tertiary); padding: 0.25rem 0.5rem; border-radius: 0.25rem;">AUTOBOOT_SMS_API_KEY</code>
                    </p>
                    <p style="font-size: 0.875rem; color: var(--text-secondary); margin-top: 0.5rem;">
                        💡 Never commit to version control. Add to <code style="background: var(--bg-tertiary); padding: 0.25rem 0.5rem; border-radius: 0.25rem;">.env</code> file and <code style="background: var(--bg-tertiary); padding: 0.25rem 0.5rem; border-radius: 0.25rem;">.gitignore</code>
                    </p>
                </div>

                <!-- Code Section -->
                <div class="code-section">
                    <div class="section-title">
                        <span>💻</span>
                        <span>Integration Code</span>
                    </div>
                    <div class="code-tabs">
                        <button class="code-tab active" onclick="switchTab('sms', 'typescript')">TypeScript</button>
                        <button class="code-tab" onclick="switchTab('sms', 'python')">Python</button>
                        <button class="code-tab" onclick="switchTab('sms', 'go')">Go</button>
                        <button class="code-tab" onclick="switchTab('sms', 'kotlin')">Kotlin</button>
                    </div>
                    <div class="code-block">
                        <button class="copy-btn" style="position: absolute; top: 1rem; right: 1rem;" onclick="copyCode('sms')">Copy Code</button>
                        <pre id="sms-code-typescript"><span class="code-comment">// Install: npm install @autoboot/sdk</span>
<span class="code-keyword">import</span> { <span class="code-variable">AutoBootSMS</span> } <span class="code-keyword">from</span> <span class="code-string">'@autoboot/sdk'</span>;

<span class="code-comment">// Initialize with environment variable</span>
<span class="code-keyword">const</span> <span class="code-variable">sms</span> = <span class="code-keyword">new</span> <span class="code-function">AutoBootSMS</span>({
  <span class="code-variable">apiKey</span>: <span class="code-variable">process</span>.<span class="code-variable">env</span>.<span class="code-variable">AUTOBOOT_SMS_API_KEY</span> <span class="code-comment">// Set in .env file</span>
});

<span class="code-comment">// Send OTP code</span>
<span class="code-keyword">const</span> <span class="code-variable">result</span> = <span class="code-keyword">await</span> <span class="code-variable">sms</span>.<span class="code-function">sendOTP</span>({
  <span class="code-variable">to</span>: <span class="code-string">'+1234567890'</span>,
  <span class="code-variable">length</span>: <span class="code-number">6</span>, <span class="code-comment">// 6-digit code</span>
  <span class="code-variable">expiresIn</span>: <span class="code-number">300</span> <span class="code-comment">// 5 minutes</span>
});

<span class="code-comment">// ✨ User receives: "Your verification code is: 123456"</span></pre>
                        <pre id="sms-code-python" style="display: none;"><span class="code-comment"># Install: pip install autoboot-sdk</span>
<span class="code-keyword">import</span> os
<span class="code-keyword">from</span> autoboot <span class="code-keyword">import</span> AutoBootSMS

<span class="code-comment"># Initialize with environment variable</span>
sms = AutoBootSMS(
    api_key=os.environ[<span class="code-string">"AUTOBOOT_SMS_API_KEY"</span>]  <span class="code-comment"># Set in .env file</span>
)

<span class="code-comment"># Send OTP code</span>
result = <span class="code-keyword">await</span> sms.send_otp(
    to=<span class="code-string">"+1234567890"</span>,
    length=<span class="code-number">6</span>,  <span class="code-comment"># 6-digit code</span>
    expires_in=<span class="code-number">300</span>  <span class="code-comment"># 5 minutes</span>
)

<span class="code-comment"># ✨ User receives: "Your verification code is: 123456"</span></pre>
                        <pre id="sms-code-go" style="display: none;"><span class="code-comment">// Install: go get github.com/autoboot/sdk-go</span>
<span class="code-keyword">import</span> (
    <span class="code-string">"os"</span>
    <span class="code-string">"github.com/autoboot/sdk-go"</span>
)

<span class="code-comment">// Initialize with environment variable</span>
sms := autoboot.<span class="code-function">NewSMS</span>(&autoboot.Config{
    APIKey: os.<span class="code-function">Getenv</span>(<span class="code-string">"AUTOBOOT_SMS_API_KEY"</span>), <span class="code-comment">// Set in .env file</span>
})

<span class="code-comment">// Send OTP code</span>
result, err := sms.<span class="code-function">SendOTP</span>(&autoboot.OTPRequest{
    To:        <span class="code-string">"+1234567890"</span>,
    Length:    <span class="code-number">6</span>, <span class="code-comment">// 6-digit code</span>
    ExpiresIn: <span class="code-number">300</span>, <span class="code-comment">// 5 minutes</span>
})

<span class="code-comment">// ✨ User receives: "Your verification code is: 123456"</span></pre>
                        <pre id="sms-code-kotlin" style="display: none;"><span class="code-comment">// Install: implementation("com.autoboot:sdk:1.0.0")</span>
<span class="code-keyword">import</span> com.autoboot.sdk.AutoBootSMS

<span class="code-comment">// Initialize with environment variable</span>
<span class="code-keyword">val</span> <span class="code-variable">sms</span> = <span class="code-function">AutoBootSMS</span>(
    apiKey = System.<span class="code-function">getenv</span>(<span class="code-string">"AUTOBOOT_SMS_API_KEY"</span>) <span class="code-comment">// Set in .env file</span>
)

<span class="code-comment">// Send OTP code</span>
<span class="code-keyword">val</span> <span class="code-variable">result</span> = sms.<span class="code-function">sendOTP</span>(
    to = <span class="code-string">"+1234567890"</span>,
    length = <span class="code-number">6</span>, <span class="code-comment">// 6-digit code</span>
    expiresIn = <span class="code-number">300</span> <span class="code-comment">// 5 minutes</span>
)

<span class="code-comment">// ✨ User receives: "Your verification code is: 123456"</span></pre>
                    </div>
                </div>

                <!-- Live Preview -->
                <div class="live-preview">
                    <div class="preview-header">
                        <div class="section-title">
                            <span>🎬</span>
                            <span>Live Test</span>
                        </div>
                        <div class="preview-status">
                            <span class="status-dot"></span>
                            <span>Connected</span>
                        </div>
                    </div>
                    <div class="preview-content">
                        <p style="color: var(--text-secondary); margin-bottom: 1rem;">Test your SMS integration:</p>
                        <button class="test-btn" onclick="testIntegration('sms')">▶ Send Test SMS</button>
                        <div id="sms-test-result" style="margin-top: 1rem;"></div>
                    </div>
                </div>

                <!-- Success Message -->
                <div class="success-message" style="display: none;" id="sms-success">
                    <div class="success-icon">✅</div>
                    <div class="success-text">
                        <h3>Integration Complete!</h3>
                        <p>SMS verification is live. Users will receive instant OTP codes via Twilio globally.</p>
                    </div>
                </div>
            </div>
        </div>
    </div>`;
