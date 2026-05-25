// AutoBoot Integration Hub - Auth modal: code samples and live test

export const authModalCode = `
                <!-- Code Section -->
                <div class="code-section">
                    <div class="section-title">
                        <span>💻</span>
                        <span>Backend Integration Code</span>
                    </div>
                    <div class="code-tabs">
                        <button class="code-tab active" onclick="switchTab('auth', 'typescript')">TypeScript</button>
                        <button class="code-tab" onclick="switchTab('auth', 'python')">Python</button>
                        <button class="code-tab" onclick="switchTab('auth', 'go')">Go</button>
                        <button class="code-tab" onclick="switchTab('auth', 'kotlin')">Kotlin</button>
                    </div>
                    <div class="code-block">
                        <button class="copy-btn" style="position: absolute; top: 1rem; right: 1rem;" onclick="copyCode('auth')">Copy Code</button>
                        <pre id="auth-code-typescript"><span class="code-comment">// Install: npm install @autoboot/sdk</span>
<span class="code-keyword">import</span> { <span class="code-variable">AutoBootAuth</span> } <span class="code-keyword">from</span> <span class="code-string">'@autoboot/sdk'</span>;

<span class="code-comment">// 1. Initialize once at app startup</span>
<span class="code-keyword">const</span> <span class="code-variable">auth</span> = <span class="code-keyword">new</span> <span class="code-function">AutoBootAuth</span>({
  <span class="code-variable">apiKey</span>: <span class="code-variable">process</span>.<span class="code-variable">env</span>.<span class="code-variable">AUTOBOOT_API_KEY</span> <span class="code-comment">// Set in .env file</span>
});

<span class="code-comment">// 2. In your API route/endpoint (e.g., Express, Next.js API route)</span>
<span class="code-variable">app</span>.<span class="code-function">get</span>(<span class="code-string">'/api/protected'</span>, <span class="code-keyword">async</span> (<span class="code-variable">req</span>, <span class="code-variable">res</span>) => {
  <span class="code-comment">// 3. SDK automatically reads Authorization header from request</span>
  <span class="code-comment">//    Expected header: "Authorization: Bearer &lt;token&gt;"</span>
  <span class="code-keyword">const</span> <span class="code-variable">user</span> = <span class="code-keyword">await</span> <span class="code-variable">auth</span>.<span class="code-function">validateToken</span>(<span class="code-variable">req</span>);

  <span class="code-comment">// 4. Check if user is authenticated</span>
  <span class="code-keyword">if</span> (!<span class="code-variable">user</span>) {
    <span class="code-keyword">return</span> <span class="code-variable">res</span>.<span class="code-function">status</span>(<span class="code-number">401</span>).<span class="code-function">json</span>({ <span class="code-variable">error</span>: <span class="code-string">'Unauthorized'</span> });
  }

  <span class="code-comment">// ✨ User is authenticated! Access user data:</span>
  <span class="code-variable">res</span>.<span class="code-function">json</span>({
    <span class="code-variable">message</span>: <span class="code-string">\`Welcome, \${user.email}!\`</span>,
    <span class="code-variable">userId</span>: <span class="code-variable">user</span>.<span class="code-variable">id</span>,
    <span class="code-variable">permissions</span>: <span class="code-variable">user</span>.<span class="code-variable">permissions</span>
  });
});</pre>
                        <pre id="auth-code-python" style="display: none;"><span class="code-comment"># Install: pip install autoboot-sdk</span>
<span class="code-keyword">import</span> os
<span class="code-keyword">from</span> autoboot <span class="code-keyword">import</span> AutoBootAuth
<span class="code-keyword">from</span> fastapi <span class="code-keyword">import</span> FastAPI, Request, HTTPException

<span class="code-comment"># 1. Initialize once at app startup</span>
auth = AutoBootAuth(
    api_key=os.environ[<span class="code-string">"AUTOBOOT_API_KEY"</span>]  <span class="code-comment"># Set in .env file</span>
)

app = FastAPI()

<span class="code-comment"># 2. In your API endpoint (FastAPI, Flask, Django, etc.)</span>
<span class="code-variable">@app</span>.get(<span class="code-string">"/api/protected"</span>)
<span class="code-keyword">async def</span> <span class="code-function">protected_route</span>(request: Request):
    <span class="code-comment"># 3. SDK automatically reads Authorization header from request</span>
    <span class="code-comment">#    Expected header: "Authorization: Bearer &lt;token&gt;"</span>
    user = <span class="code-keyword">await</span> auth.validate_token(request)

    <span class="code-comment"># 4. Check if user is authenticated</span>
    <span class="code-keyword">if not</span> user:
        <span class="code-keyword">raise</span> HTTPException(status_code=<span class="code-number">401</span>, detail=<span class="code-string">"Unauthorized"</span>)

    <span class="code-comment"># ✨ User is authenticated! Access user data:</span>
    <span class="code-keyword">return</span> {
        <span class="code-string">"message"</span>: <span class="code-string">f"Welcome, {user.email}!"</span>,
        <span class="code-string">"user_id"</span>: user.id,
        <span class="code-string">"permissions"</span>: user.permissions
    }</pre>
                        <pre id="auth-code-go" style="display: none;"><span class="code-comment">// Install: go get github.com/autoboot/sdk-go</span>
<span class="code-keyword">import</span> (
    <span class="code-string">"encoding/json"</span>
    <span class="code-string">"net/http"</span>
    <span class="code-string">"os"</span>
    <span class="code-string">"github.com/autoboot/sdk-go"</span>
)

<span class="code-comment">// 1. Initialize once at app startup</span>
<span class="code-keyword">var</span> auth = autoboot.<span class="code-function">NewAuth</span>(&autoboot.Config{
    APIKey: os.<span class="code-function">Getenv</span>(<span class="code-string">"AUTOBOOT_API_KEY"</span>), <span class="code-comment">// Set in .env file</span>
})

<span class="code-comment">// 2. In your HTTP handler (Gin, Echo, net/http, etc.)</span>
<span class="code-keyword">func</span> <span class="code-function">protectedHandler</span>(w http.ResponseWriter, r *http.Request) {
    <span class="code-comment">// 3. SDK automatically reads Authorization header from request</span>
    <span class="code-comment">//    Expected header: "Authorization: Bearer &lt;token&gt;"</span>
    user, err := auth.<span class="code-function">ValidateToken</span>(r)

    <span class="code-comment">// 4. Check if user is authenticated</span>
    <span class="code-keyword">if</span> err != <span class="code-keyword">nil</span> || user == <span class="code-keyword">nil</span> {
        http.<span class="code-function">Error</span>(w, <span class="code-string">"Unauthorized"</span>, http.StatusUnauthorized)
        <span class="code-keyword">return</span>
    }

    <span class="code-comment">// ✨ User is authenticated! Access user data:</span>
    json.<span class="code-function">NewEncoder</span>(w).<span class="code-function">Encode</span>(<span class="code-keyword">map</span>[<span class="code-keyword">string</span>]<span class="code-keyword">interface</span>{}{
        <span class="code-string">"message"</span>:     fmt.<span class="code-function">Sprintf</span>(<span class="code-string">"Welcome, %s!"</span>, user.Email),
        <span class="code-string">"user_id"</span>:     user.ID,
        <span class="code-string">"permissions"</span>: user.Permissions,
    })
}</pre>
                        <pre id="auth-code-kotlin" style="display: none;"><span class="code-comment">// Install: implementation("com.autoboot:sdk:1.0.0")</span>
<span class="code-keyword">import</span> com.autoboot.sdk.AutoBootAuth
<span class="code-keyword">import</span> org.springframework.web.bind.annotation.*
<span class="code-keyword">import</span> javax.servlet.http.HttpServletRequest

<span class="code-comment">// 1. Initialize once at app startup (e.g., in @Configuration)</span>
<span class="code-keyword">val</span> <span class="code-variable">auth</span> = <span class="code-function">AutoBootAuth</span>(
    apiKey = System.<span class="code-function">getenv</span>(<span class="code-string">"AUTOBOOT_API_KEY"</span>) <span class="code-comment">// Set in .env file</span>
)

<span class="code-comment">// 2. In your API controller (Spring Boot, Ktor, etc.)</span>
<span class="code-variable">@RestController</span>
<span class="code-keyword">class</span> <span class="code-variable">ProtectedController</span> {
    <span class="code-variable">@GetMapping</span>(<span class="code-string">"/api/protected"</span>)
    <span class="code-keyword">suspend fun</span> <span class="code-function">protectedRoute</span>(request: HttpServletRequest): Any {
        <span class="code-comment">// 3. SDK automatically reads Authorization header from request</span>
        <span class="code-comment">//    Expected header: "Authorization: Bearer &lt;token&gt;"</span>
        <span class="code-keyword">val</span> <span class="code-variable">user</span> = auth.<span class="code-function">validateToken</span>(request)

        <span class="code-comment">// 4. Check if user is authenticated</span>
        <span class="code-keyword">if</span> (user == <span class="code-keyword">null</span>) {
            <span class="code-keyword">throw</span> <span class="code-function">UnauthorizedException</span>(<span class="code-string">"Unauthorized"</span>)
        }

        <span class="code-comment">// ✨ User is authenticated! Access user data:</span>
        <span class="code-keyword">return</span> <span class="code-function">mapOf</span>(
            <span class="code-string">"message"</span> to <span class="code-string">"Welcome, \${user.email}!"</span>,
            <span class="code-string">"userId"</span> to user.id,
            <span class="code-string">"permissions"</span> to user.permissions
        )
    }
}</pre>
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
                        <p style="color: var(--text-secondary); margin-bottom: 1rem;">Test your integration in real-time:</p>
                        <button class="test-btn" onclick="testIntegration('auth')">▶ Test Authentication</button>
                        <div id="auth-test-result" style="margin-top: 1rem;"></div>
                    </div>
                </div>

                <!-- Success Message -->
                <div class="success-message" style="display: none;" id="auth-success">
                    <div class="success-icon">✅</div>
                    <div class="success-text">
                        <h3>Integration Complete!</h3>
                        <p>Your app is now authenticated. Users can login across all your products with a single account.</p>
                    </div>
                </div>
            </div>
        </div>
    </div>`;
