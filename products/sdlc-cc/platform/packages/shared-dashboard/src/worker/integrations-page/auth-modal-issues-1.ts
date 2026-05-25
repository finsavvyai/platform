// AutoBoot Integration Hub - Auth modal: common issues 1-6

export const authModalIssues1 = `
                <!-- Common Issues & Solutions -->
                <div class="api-key-section" style="background: rgba(139, 92, 246, 0.05); border: 1px solid rgba(139, 92, 246, 0.2);">
                    <div class="section-title">
                        <span>🛠️</span>
                        <span>Common Issues & Solutions (Like Clerk, but Better)</span>
                    </div>
                    <div style="color: var(--text-secondary); line-height: 1.8; font-size: 0.9375rem;">

                        <!-- Issue 1: Token Expiration -->
                        <details style="margin-bottom: 1.5rem; cursor: pointer;">
                            <summary style="font-weight: 600; color: var(--text-primary); padding: 0.75rem; background: var(--bg-primary); border-radius: 0.5rem; margin-bottom: 0.5rem;">
                                <span style="color: #ef4444; margin-right: 0.5rem;">❌</span>
                                "Token expired" or "Invalid token" errors
                            </summary>
                            <div style="padding: 1rem; background: var(--bg-primary); border-radius: 0.5rem; margin-top: 0.5rem;">
                                <p style="margin-bottom: 1rem;"><strong style="color: var(--text-primary);">Problem:</strong> JWT tokens expire after a set time (default: 24 hours). Users get logged out unexpectedly.</p>

                                <p style="margin-bottom: 0.5rem;"><strong style="color: var(--text-primary);">Solution: Implement Refresh Tokens</strong></p>
                                <pre style="background: var(--bg-secondary); padding: 1rem; border-radius: 0.5rem; overflow-x: auto; font-size: 0.875rem;"><span class="code-comment">// Frontend: Store both access + refresh tokens</span>
<span class="code-keyword">const</span> { accessToken, refreshToken } = <span class="code-keyword">await</span> response.<span class="code-function">json</span>();
localStorage.<span class="code-function">setItem</span>(<span class="code-string">'access_token'</span>, accessToken);
localStorage.<span class="code-function">setItem</span>(<span class="code-string">'refresh_token'</span>, refreshToken); <span class="code-comment">// Lasts 30 days</span>

<span class="code-comment">// When access token expires, refresh it automatically:</span>
<span class="code-keyword">async function</span> <span class="code-function">fetchWithAuth</span>(url, options = {}) {
  <span class="code-keyword">let</span> token = localStorage.<span class="code-function">getItem</span>(<span class="code-string">'access_token'</span>);

  <span class="code-keyword">let</span> response = <span class="code-keyword">await</span> <span class="code-function">fetch</span>(url, {
    ...options,
    <span class="code-variable">headers</span>: { <span class="code-string">'Authorization'</span>: <span class="code-string">\`Bearer \${token}\`</span> }
  });

  <span class="code-comment">// If token expired, refresh and retry</span>
  <span class="code-keyword">if</span> (response.status === <span class="code-number">401</span>) {
    <span class="code-keyword">const</span> refreshToken = localStorage.<span class="code-function">getItem</span>(<span class="code-string">'refresh_token'</span>);
    <span class="code-keyword">const</span> refreshRes = <span class="code-keyword">await</span> <span class="code-function">fetch</span>(<span class="code-string">'https://api.sdlc.cc/auth/refresh'</span>, {
      <span class="code-variable">method</span>: <span class="code-string">'POST'</span>,
      <span class="code-variable">body</span>: <span class="code-function">JSON.stringify</span>({ refreshToken })
    });

    <span class="code-keyword">const</span> { accessToken: newToken } = <span class="code-keyword">await</span> refreshRes.<span class="code-function">json</span>();
    localStorage.<span class="code-function">setItem</span>(<span class="code-string">'access_token'</span>, newToken);

    <span class="code-comment">// Retry original request with new token</span>
    response = <span class="code-keyword">await</span> <span class="code-function">fetch</span>(url, {
      ...options,
      <span class="code-variable">headers</span>: { <span class="code-string">'Authorization'</span>: <span class="code-string">\`Bearer \${newToken}\`</span> }
    });
  }

  <span class="code-keyword">return</span> response;
}</pre>
                            </div>
                        </details>

                        <!-- Issue 2: Session Persistence -->
                        <details style="margin-bottom: 1.5rem; cursor: pointer;">
                            <summary style="font-weight: 600; color: var(--text-primary); padding: 0.75rem; background: var(--bg-primary); border-radius: 0.5rem; margin-bottom: 0.5rem;">
                                <span style="color: #ef4444; margin-right: 0.5rem;">❌</span>
                                Users get logged out when refreshing the page
                            </summary>
                            <div style="padding: 1rem; background: var(--bg-primary); border-radius: 0.5rem; margin-top: 0.5rem;">
                                <p style="margin-bottom: 1rem;"><strong style="color: var(--text-primary);">Problem:</strong> Token stored in memory (React state) disappears on page reload.</p>

                                <p style="margin-bottom: 0.5rem;"><strong style="color: var(--text-primary);">Solution: Use localStorage or secure cookies</strong></p>
                                <pre style="background: var(--bg-secondary); padding: 1rem; border-radius: 0.5rem; overflow-x: auto; font-size: 0.875rem;"><span class="code-comment">// Option 1: localStorage (easy, works for most apps)</span>
<span class="code-keyword">const</span> token = localStorage.<span class="code-function">getItem</span>(<span class="code-string">'access_token'</span>);

<span class="code-comment">// Option 2: Cookies (more secure, prevents XSS attacks)</span>
<span class="code-keyword">import</span> Cookies <span class="code-keyword">from</span> <span class="code-string">'js-cookie'</span>;
Cookies.<span class="code-function">set</span>(<span class="code-string">'access_token'</span>, token, {
  <span class="code-variable">secure</span>: <span class="code-keyword">true</span>, <span class="code-comment">// HTTPS only</span>
  <span class="code-variable">sameSite</span>: <span class="code-string">'strict'</span>, <span class="code-comment">// Prevent CSRF</span>
  <span class="code-variable">expires</span>: <span class="code-number">7</span> <span class="code-comment">// 7 days</span>
});

<span class="code-comment">// On app load, check if user is logged in</span>
<span class="code-keyword">useEffect</span>(() => {
  <span class="code-keyword">const</span> token = Cookies.<span class="code-function">get</span>(<span class="code-string">'access_token'</span>);
  <span class="code-keyword">if</span> (token) {
    <span class="code-function">setIsAuthenticated</span>(<span class="code-keyword">true</span>);
    <span class="code-function">loadUserProfile</span>(); <span class="code-comment">// Fetch user data</span>
  }
}, []);</pre>
                            </div>
                        </details>

                        <!-- Issue 3: Multiple Tabs -->
                        <details style="margin-bottom: 1.5rem; cursor: pointer;">
                            <summary style="font-weight: 600; color: var(--text-primary); padding: 0.75rem; background: var(--bg-primary); border-radius: 0.5rem; margin-bottom: 0.5rem;">
                                <span style="color: #ef4444; margin-right: 0.5rem;">❌</span>
                                Logout in one tab doesn't logout other tabs
                            </summary>
                            <div style="padding: 1rem; background: var(--bg-primary); border-radius: 0.5rem; margin-top: 0.5rem;">
                                <p style="margin-bottom: 1rem;"><strong style="color: var(--text-primary);">Problem:</strong> User logs out in Tab A, but Tab B still shows them as logged in.</p>

                                <p style="margin-bottom: 0.5rem;"><strong style="color: var(--text-primary);">Solution: Sync state across tabs with localStorage events</strong></p>
                                <pre style="background: var(--bg-secondary); padding: 1rem; border-radius: 0.5rem; overflow-x: auto; font-size: 0.875rem;"><span class="code-comment">// Listen for storage changes (works across tabs!)</span>
<span class="code-keyword">useEffect</span>(() => {
  <span class="code-keyword">function</span> <span class="code-function">syncLogout</span>(event) {
    <span class="code-keyword">if</span> (event.key === <span class="code-string">'access_token'</span> && !event.newValue) {
      <span class="code-comment">// Token was removed (user logged out)</span>
      <span class="code-function">setIsAuthenticated</span>(<span class="code-keyword">false</span>);
      window.location.href = <span class="code-string">'/login'</span>;
    }
  }

  window.<span class="code-function">addEventListener</span>(<span class="code-string">'storage'</span>, syncLogout);
  <span class="code-keyword">return</span> () => window.<span class="code-function">removeEventListener</span>(<span class="code-string">'storage'</span>, syncLogout);
}, []);

<span class="code-comment">// When user clicks logout</span>
<span class="code-keyword">function</span> <span class="code-function">logout</span>() {
  localStorage.<span class="code-function">removeItem</span>(<span class="code-string">'access_token'</span>); <span class="code-comment">// Triggers 'storage' event!</span>
  localStorage.<span class="code-function">removeItem</span>(<span class="code-string">'refresh_token'</span>);
  window.location.href = <span class="code-string">'/login'</span>;
}</pre>
                            </div>
                        </details>

                        <!-- Issue 4: Testing -->
                        <details style="margin-bottom: 1.5rem; cursor: pointer;">
                            <summary style="font-weight: 600; color: var(--text-primary); padding: 0.75rem; background: var(--bg-primary); border-radius: 0.5rem; margin-bottom: 0.5rem;">
                                <span style="color: #ef4444; margin-right: 0.5rem;">❌</span>
                                How to test authentication in development?
                            </summary>
                            <div style="padding: 1rem; background: var(--bg-primary); border-radius: 0.5rem; margin-top: 0.5rem;">
                                <p style="margin-bottom: 1rem;"><strong style="color: var(--text-primary);">Problem:</strong> Don't want to login manually every time during development.</p>

                                <p style="margin-bottom: 0.5rem;"><strong style="color: var(--text-primary);">Solution: Use mock tokens in development mode</strong></p>
                                <pre style="background: var(--bg-secondary); padding: 1rem; border-radius: 0.5rem; overflow-x: auto; font-size: 0.875rem;"><span class="code-comment">// Backend: Create test endpoint (DEV ONLY!)</span>
<span class="code-keyword">if</span> (process.env.NODE_ENV === <span class="code-string">'development'</span>) {
  app.<span class="code-function">post</span>(<span class="code-string">'/auth/dev-login'</span>, (<span class="code-variable">req</span>, <span class="code-variable">res</span>) => {
    <span class="code-keyword">const</span> mockToken = auth.<span class="code-function">generateToken</span>({
      <span class="code-variable">id</span>: <span class="code-string">'dev_user_123'</span>,
      <span class="code-variable">email</span>: <span class="code-string">'dev@example.com'</span>,
      <span class="code-variable">name</span>: <span class="code-string">'Dev User'</span>
    });
    res.<span class="code-function">json</span>({ <span class="code-variable">token</span>: mockToken });
  });
}

<span class="code-comment">// Frontend: Auto-login in development</span>
<span class="code-keyword">useEffect</span>(() => {
  <span class="code-keyword">if</span> (process.env.NODE_ENV === <span class="code-string">'development'</span> && !localStorage.<span class="code-function">getItem</span>(<span class="code-string">'access_token'</span>)) {
    <span class="code-function">fetch</span>(<span class="code-string">'/auth/dev-login'</span>, { <span class="code-variable">method</span>: <span class="code-string">'POST'</span> })
      .<span class="code-function">then</span>(r => r.<span class="code-function">json</span>())
      .<span class="code-function">then</span>(({ token }) => localStorage.<span class="code-function">setItem</span>(<span class="code-string">'access_token'</span>, token));
  }
}, []);</pre>
                                <div style="background: rgba(239, 68, 68, 0.1); border: 1px solid rgba(239, 68, 68, 0.3); border-radius: 0.5rem; padding: 0.75rem; margin-top: 1rem;">
                                    <p style="margin: 0; color: var(--text-primary);"><strong>⚠️ Security Warning:</strong> NEVER deploy dev-login endpoint to production! Use environment checks!</p>
                                </div>
                            </div>
                        </details>`;
