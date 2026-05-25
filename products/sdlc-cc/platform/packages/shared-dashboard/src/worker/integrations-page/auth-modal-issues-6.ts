// AutoBoot Integration Hub - Auth modal: issues 11-12 (OAuth, mobile auth)

export const authModalIssues6 = `
                        <!-- Issue 11: Social Login (OAuth) -->
                        <details style="margin-bottom: 1.5rem; cursor: pointer;">
                            <summary style="font-weight: 600; color: var(--text-primary); padding: 0.75rem; background: var(--bg-primary); border-radius: 0.5rem; margin-bottom: 0.5rem;">
                                <span style="color: #3b82f6; margin-right: 0.5rem;">🔵</span>
                                How to add "Login with Google/GitHub" (OAuth)?
                            </summary>
                            <div style="padding: 1rem; background: var(--bg-primary); border-radius: 0.5rem; margin-top: 0.5rem;">
                                <p style="margin-bottom: 1rem;"><strong style="color: var(--text-primary);">OAuth 2.0 Flow (Google Example):</strong></p>

                                <p style="margin-bottom: 0.5rem; color: var(--text-primary); font-weight: 600;">Step 1: Redirect to Google</p>
                                <pre style="background: var(--bg-secondary); padding: 1rem; border-radius: 0.5rem; overflow-x: auto; font-size: 0.875rem; margin-bottom: 1.5rem;"><span class="code-comment">// Frontend - "Login with Google" button</span>
<span class="code-keyword">const</span> <span class="code-function">loginWithGoogle</span> = () => {
  <span class="code-keyword">const</span> params = <span class="code-keyword">new</span> <span class="code-function">URLSearchParams</span>({
    <span class="code-variable">client_id</span>: <span class="code-string">'YOUR_GOOGLE_CLIENT_ID'</span>,
    <span class="code-variable">redirect_uri</span>: <span class="code-string">'https://myapp.com/auth/google/callback'</span>,
    <span class="code-variable">response_type</span>: <span class="code-string">'code'</span>,
    <span class="code-variable">scope</span>: <span class="code-string">'openid email profile'</span>,
    <span class="code-variable">state</span>: crypto.<span class="code-function">randomUUID</span>() <span class="code-comment">// CSRF protection</span>
  });

  window.location.href = <span class="code-string">\`https://accounts.google.com/o/oauth2/v2/auth?\${params}\`</span>;
};</pre>

                                <p style="margin-bottom: 0.5rem; color: var(--text-primary); font-weight: 600;">Step 2: Handle Callback</p>
                                <pre style="background: var(--bg-secondary); padding: 1rem; border-radius: 0.5rem; overflow-x: auto; font-size: 0.875rem; margin-bottom: 1.5rem;"><span class="code-comment">// Backend - /auth/google/callback</span>
<span class="code-variable">app</span>.<span class="code-function">get</span>(<span class="code-string">'/auth/google/callback'</span>, <span class="code-keyword">async</span> (<span class="code-variable">req</span>, <span class="code-variable">res</span>) => {
  <span class="code-keyword">const</span> { code, state } = req.query;

  <span class="code-comment">// 1. Exchange code for access token</span>
  <span class="code-keyword">const</span> tokenResponse = <span class="code-keyword">await</span> <span class="code-function">fetch</span>(<span class="code-string">'https://oauth2.googleapis.com/token'</span>, {
    <span class="code-variable">method</span>: <span class="code-string">'POST'</span>,
    <span class="code-variable">body</span>: <span class="code-function">JSON.stringify</span>({
      <span class="code-variable">code</span>,
      <span class="code-variable">client_id</span>: process.env.GOOGLE_CLIENT_ID,
      <span class="code-variable">client_secret</span>: process.env.GOOGLE_CLIENT_SECRET,
      <span class="code-variable">redirect_uri</span>: <span class="code-string">'https://myapp.com/auth/google/callback'</span>,
      <span class="code-variable">grant_type</span>: <span class="code-string">'authorization_code'</span>
    })
  });
  <span class="code-keyword">const</span> { access_token } = <span class="code-keyword">await</span> tokenResponse.<span class="code-function">json</span>();

  <span class="code-comment">// 2. Get user info from Google</span>
  <span class="code-keyword">const</span> userResponse = <span class="code-keyword">await</span> <span class="code-function">fetch</span>(<span class="code-string">'https://www.googleapis.com/oauth2/v2/userinfo'</span>, {
    <span class="code-variable">headers</span>: { <span class="code-string">'Authorization'</span>: <span class="code-string">\`Bearer \${access_token}\`</span> }
  });
  <span class="code-keyword">const</span> googleUser = <span class="code-keyword">await</span> userResponse.<span class="code-function">json</span>();

  <span class="code-comment">// 3. Find or create user in your DB</span>
  <span class="code-keyword">let</span> user = <span class="code-keyword">await</span> db.users.<span class="code-function">findOne</span>({ <span class="code-variable">email</span>: googleUser.email });
  <span class="code-keyword">if</span> (!user) {
    user = <span class="code-keyword">await</span> db.users.<span class="code-function">create</span>({
      <span class="code-variable">email</span>: googleUser.email,
      <span class="code-variable">name</span>: googleUser.name,
      <span class="code-variable">avatar</span>: googleUser.picture,
      <span class="code-variable">googleId</span>: googleUser.id
    });
  }

  <span class="code-comment">// 4. Generate your JWT</span>
  <span class="code-keyword">const</span> token = auth.<span class="code-function">generateToken</span>({ <span class="code-variable">id</span>: user.id, <span class="code-variable">email</span>: user.email });

  <span class="code-comment">// 5. Redirect to frontend with token</span>
  res.<span class="code-function">redirect</span>(<span class="code-string">\`https://myapp.com/auth/success?token=\${token}\`</span>);
});</pre>

                                <div style="background: rgba(59, 130, 246, 0.1); border: 1px solid rgba(59, 130, 246, 0.3); border-radius: 0.5rem; padding: 1rem; margin-top: 1rem;">
                                    <p style="margin: 0 0 0.5rem 0; color: var(--text-primary); font-weight: 600;">🎯 Quick Setup:</p>
                                    <ul style="margin-left: 1.5rem; line-height: 2; margin-bottom: 0;">
                                        <li><strong>Google:</strong> console.cloud.google.com → Create OAuth Client</li>
                                        <li><strong>GitHub:</strong> github.com/settings/developers → New OAuth App</li>
                                        <li><strong>Callback URL:</strong> https://yourapp.com/auth/PROVIDER/callback</li>
                                        <li><strong>Store secrets:</strong> GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET</li>
                                    </ul>
                                </div>
                            </div>
                        </details>

                        <!-- Issue 12: Mobile App Auth -->
                        <details style="margin-bottom: 1.5rem; cursor: pointer;">
                            <summary style="font-weight: 600; color: var(--text-primary); padding: 0.75rem; background: var(--bg-primary); border-radius: 0.5rem; margin-bottom: 0.5rem;">
                                <span style="color: #ec4899; margin-right: 0.5rem;">📱</span>
                                Authentication for Mobile Apps (React Native, Flutter)
                            </summary>
                            <div style="padding: 1rem; background: var(--bg-primary); border-radius: 0.5rem; margin-top: 0.5rem;">
                                <p style="margin-bottom: 1rem;"><strong style="color: var(--text-primary);">Mobile apps have different security requirements than web!</strong></p>

                                <p style="margin-bottom: 0.5rem; color: var(--text-primary); font-weight: 600;">Use Secure Storage (NOT AsyncStorage or SharedPreferences!)</p>
                                <pre style="background: var(--bg-secondary); padding: 1rem; border-radius: 0.5rem; overflow-x: auto; font-size: 0.875rem; margin-bottom: 1.5rem;"><span class="code-comment">// React Native - Use expo-secure-store or react-native-keychain</span>
<span class="code-keyword">import</span> * <span class="code-keyword">as</span> SecureStore <span class="code-keyword">from</span> <span class="code-string">'expo-secure-store'</span>;

<span class="code-comment">// Store token securely (encrypted on device)</span>
<span class="code-keyword">await</span> SecureStore.<span class="code-function">setItemAsync</span>(<span class="code-string">'access_token'</span>, token);

<span class="code-comment">// Retrieve token</span>
<span class="code-keyword">const</span> token = <span class="code-keyword">await</span> SecureStore.<span class="code-function">getItemAsync</span>(<span class="code-string">'access_token'</span>);

<span class="code-comment">// Delete on logout</span>
<span class="code-keyword">await</span> SecureStore.<span class="code-function">deleteItemAsync</span>(<span class="code-string">'access_token'</span>);

<span class="code-comment">// Flutter - Use flutter_secure_storage</span>
<span class="code-comment">// final storage = FlutterSecureStorage();</span>
<span class="code-comment">// await storage.write(key: 'access_token', value: token);</span></pre>

                                <p style="margin-bottom: 0.5rem; color: var(--text-primary); font-weight: 600;">Biometric Authentication (Face ID, Fingerprint)</p>
                                <pre style="background: var(--bg-secondary); padding: 1rem; border-radius: 0.5rem; overflow-x: auto; font-size: 0.875rem; margin-bottom: 1.5rem;"><span class="code-comment">// React Native - Use expo-local-authentication</span>
<span class="code-keyword">import</span> * <span class="code-keyword">as</span> LocalAuthentication <span class="code-keyword">from</span> <span class="code-string">'expo-local-authentication'</span>;

<span class="code-keyword">async function</span> <span class="code-function">loginWithBiometrics</span>() {
  <span class="code-comment">// 1. Check if biometrics available</span>
  <span class="code-keyword">const</span> hasHardware = <span class="code-keyword">await</span> LocalAuthentication.<span class="code-function">hasHardwareAsync</span>();
  <span class="code-keyword">const</span> isEnrolled = <span class="code-keyword">await</span> LocalAuthentication.<span class="code-function">isEnrolledAsync</span>();

  <span class="code-keyword">if</span> (!hasHardware || !isEnrolled) {
    <span class="code-keyword">return</span> <span class="code-function">alert</span>(<span class="code-string">'Biometrics not available'</span>);
  }

  <span class="code-comment">// 2. Authenticate</span>
  <span class="code-keyword">const</span> result = <span class="code-keyword">await</span> LocalAuthentication.<span class="code-function">authenticateAsync</span>({
    <span class="code-variable">promptMessage</span>: <span class="code-string">'Login with Face ID'</span>,
    <span class="code-variable">fallbackLabel</span>: <span class="code-string">'Use Passcode'</span>
  });

  <span class="code-keyword">if</span> (result.success) {
    <span class="code-comment">// 3. Get stored token and login</span>
    <span class="code-keyword">const</span> token = <span class="code-keyword">await</span> SecureStore.<span class="code-function">getItemAsync</span>(<span class="code-string">'access_token'</span>);
    <span class="code-comment">// User is logged in!</span>
  }
}</pre>

                                <div style="background: rgba(236, 72, 153, 0.1); border: 1px solid rgba(236, 72, 153, 0.3); border-radius: 0.5rem; padding: 1rem; margin-top: 1rem;">
                                    <p style="margin: 0 0 0.5rem 0; color: var(--text-primary); font-weight: 600;">⚠️ Mobile Security Checklist:</p>
                                    <ul style="margin-left: 1.5rem; line-height: 2; margin-bottom: 0;">
                                        <li>✅ Use SecureStore (iOS Keychain/Android Keystore)</li>
                                        <li>✅ Enable SSL pinning to prevent MITM attacks</li>
                                        <li>✅ Implement jailbreak/root detection</li>
                                        <li>✅ Use refresh tokens (don't store long-lived tokens)</li>
                                        <li>❌ NEVER use AsyncStorage for tokens (unencrypted!)</li>
                                        <li>❌ NEVER log tokens in production</li>
                                    </ul>
                                </div>
                            </div>
                        </details>

                        <div style="background: rgba(67, 97, 238, 0.1); border: 1px solid rgba(67, 97, 238, 0.3); border-radius: 0.5rem; padding: 1.5rem; margin-top: 2rem; text-align: center;">
                            <p style="margin: 0; font-size: 1rem; color: var(--text-primary);"><strong>💬 Still stuck?</strong> Join our Discord community or email <a href="mailto:support@sdlc.cc" style="color: var(--accent); text-decoration: none;">support@sdlc.cc</a> - we respond in &lt;2 hours!</p>
                        </div>
                    </div>
                </div>`;
