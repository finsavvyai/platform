// AutoBoot Integration Hub - Auth modal: CORS setup section

export const authModalCors = `
                <!-- CORS Setup -->
                <div class="api-key-section" style="background: rgba(245, 158, 11, 0.05); border: 1px solid rgba(245, 158, 11, 0.2);">
                    <div class="section-title">
                        <span>⚠️</span>
                        <span>Important: CORS Setup (Avoid "blocked by CORS policy" errors)</span>
                    </div>
                    <div style="color: var(--text-secondary); line-height: 1.8; font-size: 0.9375rem;">
                        <p style="margin-bottom: 1rem; color: var(--text-primary);"><strong>If your frontend is on a different domain than your backend, you MUST configure CORS:</strong></p>

                        <p style="margin-bottom: 0.5rem;"><strong style="color: var(--text-primary);">Example:</strong></p>
                        <ul style="margin-left: 1.5rem; margin-bottom: 1rem; line-height: 2;">
                            <li>Frontend: <code style="background: var(--bg-tertiary); padding: 0.125rem 0.375rem; border-radius: 0.25rem;">https://myapp.com</code></li>
                            <li>Backend: <code style="background: var(--bg-tertiary); padding: 0.125rem 0.375rem; border-radius: 0.25rem;">https://api.myapp.com</code></li>
                            <li>→ You need CORS! ✅</li>
                        </ul>

                        <p style="margin-bottom: 1rem;"><strong style="color: var(--text-primary);">Add this to your backend BEFORE your routes:</strong></p>
                        <pre style="background: var(--bg-primary); padding: 1rem; border-radius: 0.5rem; overflow-x: auto; font-size: 0.875rem;"><span class="code-comment">// TypeScript/JavaScript (Express, Fastify, Hono)</span>
<span class="code-keyword">import</span> cors <span class="code-keyword">from</span> <span class="code-string">'cors'</span>;

app.<span class="code-function">use</span>(<span class="code-function">cors</span>({
  <span class="code-variable">origin</span>: <span class="code-string">'https://myapp.com'</span>, <span class="code-comment">// Your frontend URL</span>
  <span class="code-variable">credentials</span>: <span class="code-keyword">true</span>, <span class="code-comment">// Allow cookies/auth headers</span>
  <span class="code-variable">methods</span>: [<span class="code-string">'GET'</span>, <span class="code-string">'POST'</span>, <span class="code-string">'PUT'</span>, <span class="code-string">'DELETE'</span>],
  <span class="code-variable">allowedHeaders</span>: [<span class="code-string">'Content-Type'</span>, <span class="code-string">'Authorization'</span>]
}));

<span class="code-comment">// Python (FastAPI)</span>
<span class="code-keyword">from</span> fastapi.middleware.cors <span class="code-keyword">import</span> CORSMiddleware

app.add_middleware(
    CORSMiddleware,
    allow_origins=[<span class="code-string">"https://myapp.com"</span>],  <span class="code-comment"># Your frontend URL</span>
    allow_credentials=<span class="code-keyword">True</span>,
    allow_methods=[<span class="code-string">"*"</span>],
    allow_headers=[<span class="code-string">"*"</span>],
)

<span class="code-comment">// Go (with gorilla/handlers)</span>
<span class="code-keyword">import</span> <span class="code-string">"github.com/gorilla/handlers"</span>

corsHandler := handlers.<span class="code-function">CORS</span>(
    handlers.<span class="code-function">AllowedOrigins</span>([]<span class="code-keyword">string</span>{<span class="code-string">"https://myapp.com"</span>}),
    handlers.<span class="code-function">AllowedMethods</span>([]<span class="code-keyword">string</span>{<span class="code-string">"GET"</span>, <span class="code-string">"POST"</span>, <span class="code-string">"PUT"</span>, <span class="code-string">"DELETE"</span>}),
    handlers.<span class="code-function">AllowedHeaders</span>([]<span class="code-keyword">string</span>{<span class="code-string">"Content-Type"</span>, <span class="code-string">"Authorization"</span>}),
    handlers.<span class="code-function">AllowCredentials</span>(),
)
http.<span class="code-function">ListenAndServe</span>(<span class="code-string">":8080"</span>, <span class="code-function">corsHandler</span>(router))</pre>

                        <div style="background: rgba(16, 185, 129, 0.1); border: 1px solid rgba(16, 185, 129, 0.3); border-radius: 0.5rem; padding: 1rem; margin-top: 1rem;">
                            <p style="margin: 0; color: var(--text-primary);"><strong>💡 Pro Tip:</strong> During development, use <code style="background: var(--bg-tertiary); padding: 0.125rem 0.375rem; border-radius: 0.25rem;">origin: '*'</code> to allow all domains. In production, <strong>always</strong> specify your exact frontend domain for security!</p>
                        </div>
                    </div>
                </div>`;
