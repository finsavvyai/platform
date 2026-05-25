// AutoBoot Integration Hub - Email verification modal

export const emailModal = `
    <!-- Email Verification Modal -->
    <div id="email-modal" class="modal">
        <div class="modal-content">
            <div class="modal-header">
                <h2>📧 Email Verification Integration</h2>
                <button class="modal-close" onclick="closeModal('email')">✕</button>
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
                            <div class="step-label">3. Send Emails</div>
                            <div class="step-description">Verify users instantly</div>
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
                        <code id="email-key">sk_live_email_xyz456abc789_autoboot_verify_prod</code>
                        <button class="copy-btn" onclick="copyKey('email')">Copy</button>
                    </div>
                    <p style="font-size: 0.875rem; color: var(--text-secondary); margin-top: 0.75rem;">
                        ⚠️ Keep this secret! Store in environment variable: <code style="background: var(--bg-tertiary); padding: 0.25rem 0.5rem; border-radius: 0.25rem;">AUTOBOOT_EMAIL_API_KEY</code>
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
                        <button class="code-tab active" onclick="switchTab('email', 'typescript')">TypeScript</button>
                        <button class="code-tab" onclick="switchTab('email', 'python')">Python</button>
                        <button class="code-tab" onclick="switchTab('email', 'go')">Go</button>
                        <button class="code-tab" onclick="switchTab('email', 'kotlin')">Kotlin</button>
                    </div>
                    <div class="code-block">
                        <button class="copy-btn" style="position: absolute; top: 1rem; right: 1rem;" onclick="copyCode('email')">Copy Code</button>
                        <pre id="email-code-typescript"><span class="code-comment">// Install: npm install @autoboot/sdk</span>
<span class="code-keyword">import</span> { <span class="code-variable">AutoBootEmail</span> } <span class="code-keyword">from</span> <span class="code-string">'@autoboot/sdk'</span>;

<span class="code-comment">// Initialize with environment variable</span>
<span class="code-keyword">const</span> <span class="code-variable">email</span> = <span class="code-keyword">new</span> <span class="code-function">AutoBootEmail</span>({
  <span class="code-variable">apiKey</span>: <span class="code-variable">process</span>.<span class="code-variable">env</span>.<span class="code-variable">AUTOBOOT_EMAIL_API_KEY</span> <span class="code-comment">// Set in .env file</span>
});

<span class="code-comment">// Send verification email</span>
<span class="code-keyword">await</span> <span class="code-variable">email</span>.<span class="code-function">sendVerification</span>({
  <span class="code-variable">to</span>: <span class="code-string">'user@example.com'</span>,
  <span class="code-variable">template</span>: <span class="code-string">'verify-email'</span>, <span class="code-comment">// Auto-generated beautiful template</span>
  <span class="code-variable">data</span>: { <span class="code-variable">name</span>: <span class="code-string">'John Doe'</span> }
});

<span class="code-comment">// ✨ Email sent with magic link! User clicks to verify.</span></pre>
                        <pre id="email-code-python" style="display: none;"><span class="code-comment"># Install: pip install autoboot-sdk</span>
<span class="code-keyword">import</span> os
<span class="code-keyword">from</span> autoboot <span class="code-keyword">import</span> AutoBootEmail

<span class="code-comment"># Initialize with environment variable</span>
email = AutoBootEmail(
    api_key=os.environ[<span class="code-string">"AUTOBOOT_EMAIL_API_KEY"</span>]  <span class="code-comment"># Set in .env file</span>
)

<span class="code-comment"># Send verification email</span>
<span class="code-keyword">await</span> email.send_verification(
    to=<span class="code-string">"user@example.com"</span>,
    template=<span class="code-string">"verify-email"</span>,  <span class="code-comment"># Auto-generated beautiful template</span>
    data={<span class="code-string">"name"</span>: <span class="code-string">"John Doe"</span>}
)

<span class="code-comment"># ✨ Email sent with magic link! User clicks to verify.</span></pre>
                        <pre id="email-code-go" style="display: none;"><span class="code-comment">// Install: go get github.com/autoboot/sdk-go</span>
<span class="code-keyword">import</span> (
    <span class="code-string">"os"</span>
    <span class="code-string">"github.com/autoboot/sdk-go"</span>
)

<span class="code-comment">// Initialize with environment variable</span>
email := autoboot.<span class="code-function">NewEmail</span>(&autoboot.Config{
    APIKey: os.<span class="code-function">Getenv</span>(<span class="code-string">"AUTOBOOT_EMAIL_API_KEY"</span>), <span class="code-comment">// Set in .env file</span>
})

<span class="code-comment">// Send verification email</span>
err := email.<span class="code-function">SendVerification</span>(&autoboot.EmailRequest{
    To:       <span class="code-string">"user@example.com"</span>,
    Template: <span class="code-string">"verify-email"</span>, <span class="code-comment">// Auto-generated beautiful template</span>
    Data:     <span class="code-keyword">map</span>[<span class="code-keyword">string</span>]<span class="code-keyword">interface</span>{}{<span class="code-string">"name"</span>: <span class="code-string">"John Doe"</span>},
})

<span class="code-comment">// ✨ Email sent with magic link! User clicks to verify.</span></pre>
                        <pre id="email-code-kotlin" style="display: none;"><span class="code-comment">// Install: implementation("com.autoboot:sdk:1.0.0")</span>
<span class="code-keyword">import</span> com.autoboot.sdk.AutoBootEmail

<span class="code-comment">// Initialize with environment variable</span>
<span class="code-keyword">val</span> <span class="code-variable">email</span> = <span class="code-function">AutoBootEmail</span>(
    apiKey = System.<span class="code-function">getenv</span>(<span class="code-string">"AUTOBOOT_EMAIL_API_KEY"</span>) <span class="code-comment">// Set in .env file</span>
)

<span class="code-comment">// Send verification email</span>
email.<span class="code-function">sendVerification</span>(
    to = <span class="code-string">"user@example.com"</span>,
    template = <span class="code-string">"verify-email"</span>, <span class="code-comment">// Auto-generated beautiful template</span>
    data = <span class="code-function">mapOf</span>(<span class="code-string">"name"</span> to <span class="code-string">"John Doe"</span>)
)

<span class="code-comment">// ✨ Email sent with magic link! User clicks to verify.</span></pre>
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
                        <p style="color: var(--text-secondary); margin-bottom: 1rem;">Test your email integration:</p>
                        <button class="test-btn" onclick="testIntegration('email')">▶ Send Test Email</button>
                        <div id="email-test-result" style="margin-top: 1rem;"></div>
                    </div>
                </div>

                <!-- Success Message -->
                <div class="success-message" style="display: none;" id="email-success">
                    <div class="success-icon">✅</div>
                    <div class="success-text">
                        <h3>Integration Complete!</h3>
                        <p>Email verification is live. Users will receive beautiful verification emails powered by Resend.</p>
                    </div>
                </div>
            </div>
        </div>
    </div>`;
