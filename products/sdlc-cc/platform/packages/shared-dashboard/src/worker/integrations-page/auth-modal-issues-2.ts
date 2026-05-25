// AutoBoot Integration Hub - Auth modal: issues 5-7 (network, rate limit, deploy)

export const authModalIssues2 = `
                        <!-- Issue 5: Network Failures -->
                        <details style="margin-bottom: 1.5rem; cursor: pointer;">
                            <summary style="font-weight: 600; color: var(--text-primary); padding: 0.75rem; background: var(--bg-primary); border-radius: 0.5rem; margin-bottom: 0.5rem;">
                                <span style="color: #ef4444; margin-right: 0.5rem;">❌</span>
                                "Network request failed" or timeout errors
                            </summary>
                            <div style="padding: 1rem; background: var(--bg-primary); border-radius: 0.5rem; margin-top: 0.5rem;">
                                <p style="margin-bottom: 1rem;"><strong style="color: var(--text-primary);">Problem:</strong> User's internet is slow or drops during login request.</p>

                                <p style="margin-bottom: 0.5rem;"><strong style="color: var(--text-primary);">Solution: Add retry logic with exponential backoff</strong></p>
                                <pre style="background: var(--bg-secondary); padding: 1rem; border-radius: 0.5rem; overflow-x: auto; font-size: 0.875rem;"><span class="code-keyword">async function</span> <span class="code-function">fetchWithRetry</span>(url, options, maxRetries = <span class="code-number">3</span>) {
  <span class="code-keyword">for</span> (<span class="code-keyword">let</span> i = <span class="code-number">0</span>; i < maxRetries; i++) {
    <span class="code-keyword">try</span> {
      <span class="code-keyword">const</span> response = <span class="code-keyword">await</span> <span class="code-function">fetch</span>(url, {
        ...options,
        <span class="code-variable">signal</span>: AbortSignal.<span class="code-function">timeout</span>(<span class="code-number">10000</span>) <span class="code-comment">// 10s timeout</span>
      });
      <span class="code-keyword">return</span> response;
    } <span class="code-keyword">catch</span> (error) {
      <span class="code-keyword">if</span> (i === maxRetries - <span class="code-number">1</span>) <span class="code-keyword">throw</span> error; <span class="code-comment">// Last attempt failed</span>

      <span class="code-comment">// Wait before retrying (1s, 2s, 4s...)</span>
      <span class="code-keyword">await new</span> <span class="code-function">Promise</span>(resolve => <span class="code-function">setTimeout</span>(resolve, <span class="code-number">1000</span> * Math.<span class="code-function">pow</span>(<span class="code-number">2</span>, i)));
    }
  }
}

<span class="code-comment">// Usage</span>
<span class="code-keyword">try</span> {
  <span class="code-keyword">const</span> response = <span class="code-keyword">await</span> <span class="code-function">fetchWithRetry</span>(<span class="code-string">'https://api.sdlc.cc/auth/login'</span>, {
    <span class="code-variable">method</span>: <span class="code-string">'POST'</span>,
    <span class="code-variable">body</span>: <span class="code-function">JSON.stringify</span>({ email, password })
  });
} <span class="code-keyword">catch</span> (error) {
  <span class="code-comment">// Show user-friendly error</span>
  <span class="code-function">alert</span>(<span class="code-string">'Network error. Please check your connection and try again.'</span>);
}</pre>
                            </div>
                        </details>

                        <!-- Issue 6: Rate Limiting -->
                        <details style="margin-bottom: 1.5rem; cursor: pointer;">
                            <summary style="font-weight: 600; color: var(--text-primary); padding: 0.75rem; background: var(--bg-primary); border-radius: 0.5rem; margin-bottom: 0.5rem;">
                                <span style="color: #ef4444; margin-right: 0.5rem;">❌</span>
                                "Too many requests" or 429 errors
                            </summary>
                            <div style="padding: 1rem; background: var(--bg-primary); border-radius: 0.5rem; margin-top: 0.5rem;">
                                <p style="margin-bottom: 1rem;"><strong style="color: var(--text-primary);">Problem:</strong> User clicks login button multiple times rapidly.</p>

                                <p style="margin-bottom: 0.5rem;"><strong style="color: var(--text-primary);">Solution: Debounce button clicks + handle 429 response</strong></p>
                                <pre style="background: var(--bg-secondary); padding: 1rem; border-radius: 0.5rem; overflow-x: auto; font-size: 0.875rem;"><span class="code-comment">// Frontend: Disable button during request</span>
<span class="code-keyword">const</span> [isLoading, setIsLoading] = <span class="code-function">useState</span>(<span class="code-keyword">false</span>);

<span class="code-keyword">async function</span> <span class="code-function">handleLogin</span>() {
  <span class="code-keyword">if</span> (isLoading) <span class="code-keyword">return</span>; <span class="code-comment">// Prevent double-clicks</span>

  <span class="code-function">setIsLoading</span>(<span class="code-keyword">true</span>);
  <span class="code-keyword">try</span> {
    <span class="code-keyword">const</span> response = <span class="code-keyword">await</span> <span class="code-function">fetch</span>(<span class="code-string">'https://api.sdlc.cc/auth/login'</span>, {
      <span class="code-variable">method</span>: <span class="code-string">'POST'</span>,
      <span class="code-variable">body</span>: <span class="code-function">JSON.stringify</span>({ email, password })
    });

    <span class="code-keyword">if</span> (response.status === <span class="code-number">429</span>) {
      <span class="code-keyword">const</span> retryAfter = response.headers.<span class="code-function">get</span>(<span class="code-string">'Retry-After'</span>) || <span class="code-number">60</span>;
      <span class="code-function">alert</span>(<span class="code-string">\`Too many attempts. Please wait \${retryAfter} seconds.\`</span>);
      <span class="code-keyword">return</span>;
    }

    <span class="code-keyword">const</span> { token } = <span class="code-keyword">await</span> response.<span class="code-function">json</span>();
    localStorage.<span class="code-function">setItem</span>(<span class="code-string">'access_token'</span>, token);
  } <span class="code-keyword">finally</span> {
    <span class="code-function">setIsLoading</span>(<span class="code-keyword">false</span>);
  }
}

<span class="code-comment">// JSX</span>
&lt;button onClick={handleLogin} disabled={isLoading}&gt;
  {isLoading ? <span class="code-string">'Logging in...'</span> : <span class="code-string">'Login'</span>}
&lt;/button&gt;</pre>
                            </div>
                        </details>

                        <!-- Issue 7: Production Deployment -->
                        <details style="margin-bottom: 1.5rem; cursor: pointer;">
                            <summary style="font-weight: 600; color: var(--text-primary); padding: 0.75rem; background: var(--bg-primary); border-radius: 0.5rem; margin-bottom: 0.5rem;">
                                <span style="color: #10b981; margin-right: 0.5rem;">✅</span>
                                Production Deployment Checklist
                            </summary>
                            <div style="padding: 1rem; background: var(--bg-primary); border-radius: 0.5rem; margin-top: 0.5rem;">
                                <p style="margin-bottom: 1rem;"><strong style="color: var(--text-primary);">Before deploying to production:</strong></p>
                                <ul style="margin-left: 1.5rem; line-height: 2.2;">
                                    <li>✅ API keys in environment variables (NOT hardcoded)</li>
                                    <li>✅ <code style="background: var(--bg-tertiary); padding: 0.125rem 0.375rem; border-radius: 0.25rem;">.env</code> added to <code style="background: var(--bg-tertiary); padding: 0.125rem 0.375rem; border-radius: 0.25rem;">.gitignore</code></li>
                                    <li>✅ CORS configured with specific domain (not '*')</li>
                                    <li>✅ HTTPS enabled (not HTTP)</li>
                                    <li>✅ Cookies set with <code style="background: var(--bg-tertiary); padding: 0.125rem 0.375rem; border-radius: 0.25rem;">secure: true</code> and <code style="background: var(--bg-tertiary); padding: 0.125rem 0.375rem; border-radius: 0.25rem;">sameSite: 'strict'</code></li>
                                    <li>✅ Refresh token flow implemented</li>
                                    <li>✅ Error handling for all API calls</li>
                                    <li>✅ Rate limiting on login endpoint</li>
                                    <li>✅ Test authentication in production-like environment (staging)</li>
                                    <li>✅ Remove all dev-only endpoints (<code style="background: var(--bg-tertiary); padding: 0.125rem 0.375rem; border-radius: 0.25rem;">/dev-login</code>, etc.)</li>
                                </ul>
                            </div>
                        </details>`;
