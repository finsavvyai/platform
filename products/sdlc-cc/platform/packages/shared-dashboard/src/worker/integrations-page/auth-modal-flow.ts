// AutoBoot Integration Hub - Auth modal: flow, API key, and how-it-works

export const authModalFlow = `
    <!-- Auth Integration Modal -->
    <div id="auth-modal" class="modal">
        <div class="modal-content">
            <div class="modal-header">
                <h2>🔐 Authentication Integration</h2>
                <button class="close-btn" onclick="closeModal('auth')">&times;</button>
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
                            <div class="step-label">3. Go Live</div>
                            <div class="step-description">Users can login</div>
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
                        <code id="auth-key">sk_live_abc123xyz789_autoboot_auth_key_prod</code>
                        <button class="copy-btn" onclick="copyKey('auth')">Copy</button>
                    </div>
                    <p style="font-size: 0.875rem; color: var(--text-secondary); margin-top: 0.75rem;">
                        ⚠️ Keep this secret! Store in environment variable: <code style="background: var(--bg-tertiary); padding: 0.25rem 0.5rem; border-radius: 0.25rem;">AUTOBOOT_API_KEY</code>
                    </p>
                    <p style="font-size: 0.875rem; color: var(--text-secondary); margin-top: 0.5rem;">
                        💡 Never commit to version control. Add to <code style="background: var(--bg-tertiary); padding: 0.25rem 0.5rem; border-radius: 0.25rem;">.env</code> file and <code style="background: var(--bg-tertiary); padding: 0.25rem 0.5rem; border-radius: 0.25rem;">.gitignore</code>
                    </p>
                </div>

                <!-- How It Works -->
                <div class="api-key-section" style="background: rgba(67, 97, 238, 0.05); border: 1px solid rgba(67, 97, 238, 0.2);">
                    <div class="section-title">
                        <span>📖</span>
                        <span>How It Works</span>
                    </div>
                    <div style="color: var(--text-secondary); line-height: 1.8; font-size: 0.9375rem;">
                        <p style="margin-bottom: 1rem;"><strong style="color: var(--text-primary);">Frontend (Your Login Page):</strong></p>
                        <pre style="background: var(--bg-primary); padding: 1rem; border-radius: 0.5rem; margin-bottom: 1rem; overflow-x: auto; font-size: 0.875rem;"><span class="code-comment">// User clicks "Login" button</span>
<span class="code-keyword">const</span> response = <span class="code-keyword">await</span> <span class="code-function">fetch</span>(<span class="code-string">'https://api.sdlc.cc/auth/login'</span>, {
  <span class="code-variable">method</span>: <span class="code-string">'POST'</span>,
  <span class="code-variable">body</span>: <span class="code-function">JSON.stringify</span>({ <span class="code-variable">email</span>, <span class="code-variable">password</span> })
});
<span class="code-keyword">const</span> { <span class="code-variable">token</span> } = <span class="code-keyword">await</span> response.<span class="code-function">json</span>(); <span class="code-comment">// You get a JWT token</span>

<span class="code-comment">// Store token (localStorage, cookie, etc.)</span>
localStorage.<span class="code-function">setItem</span>(<span class="code-string">'auth_token'</span>, token);

<span class="code-comment">// Use token in subsequent requests to YOUR backend</span>
<span class="code-keyword">const</span> data = <span class="code-keyword">await</span> <span class="code-function">fetch</span>(<span class="code-string">'/api/protected'</span>, {
  <span class="code-variable">headers</span>: {
    <span class="code-string">'Authorization'</span>: <span class="code-string">\`Bearer \${token}\`</span> <span class="code-comment">// This is what SDK validates!</span>
  }
});</pre>
                        <p style="margin-bottom: 0.5rem;"><strong style="color: var(--text-primary);">Backend (Your API - Code Below):</strong></p>
                        <p style="margin: 0;">SDK receives request → Reads "Authorization" header → Validates token → Returns user data</p>
                    </div>
                </div>`;
