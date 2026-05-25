/**
 * Landing Page - Architecture section HTML
 */

export const landingArchitectureHTML = `
        <section id="architecture">
            <h2>Built on Cloudflare Workers</h2>
            <p class="section-subtitle">
                Globally distributed, infinitely scalable, zero cold starts
            </p>

            <div class="architecture-visual">
                <div class="arch-layer">
                    <div class="layer-title">Your Products</div>
                    <div class="product-nodes">
                        <div class="product-node">
                            <div class="node-icon">🛡️</div>
                            <div class="node-label">Gateway</div>
                        </div>
                        <div class="product-node">
                            <div class="node-icon">🧪</div>
                            <div class="node-label">RAG</div>
                        </div>
                        <div class="product-node">
                            <div class="node-icon">⚡</div>
                            <div class="node-label">Vector Core</div>
                        </div>
                        <div class="product-node">
                            <div class="node-icon">🔌</div>
                            <div class="node-label">DLP</div>
                        </div>
                        <div class="product-node">
                            <div class="node-icon">🤖</div>
                            <div class="node-label">SDLC.ai</div>
                        </div>
                        <div class="product-node">
                            <div class="node-icon">📊</div>
                            <div class="node-label">Compliance</div>
                        </div>
                        <div class="product-node">
                            <div class="node-icon">📦</div>
                            <div class="node-label">UPM</div>
                        </div>
                        <div class="product-node">
                            <div class="node-icon">✈️</div>
                            <div class="node-label">Streaming</div>
                        </div>
                    </div>
                    <div class="connection-label">Service Bindings • 0ms latency</div>
                </div>

                <div class="arch-connector"></div>

                <div class="arch-layer core-layer">
                    <div class="layer-title">AutoBoot Framework</div>
                    <div class="core-grid">
                        <div class="core-module">
                            <div class="module-header">
                                <div class="module-icon">🔐</div>
                                <div class="module-name">Authentication</div>
                            </div>
                            <div class="module-features">
                                <span class="feature-tag">JWT</span>
                                <span class="feature-tag">Sessions</span>
                                <span class="feature-tag">SSO</span>
                            </div>
                        </div>

                        <div class="core-module">
                            <div class="module-header">
                                <div class="module-icon">💳</div>
                                <div class="module-name">Billing</div>
                            </div>
                            <div class="module-features">
                                <span class="feature-tag">Subscriptions</span>
                                <span class="feature-tag">Payments</span>
                                <span class="feature-tag">Invoices</span>
                            </div>
                        </div>

                        <div class="core-module">
                            <div class="module-header">
                                <div class="module-icon">👤</div>
                                <div class="module-name">Customers</div>
                            </div>
                            <div class="module-features">
                                <span class="feature-tag">Profiles</span>
                                <span class="feature-tag">Permissions</span>
                                <span class="feature-tag">Activity</span>
                            </div>
                        </div>

                        <div class="core-module">
                            <div class="module-header">
                                <div class="module-icon">📊</div>
                                <div class="module-name">Analytics</div>
                            </div>
                            <div class="module-features">
                                <span class="feature-tag">Logging</span>
                                <span class="feature-tag">Metrics</span>
                                <span class="feature-tag">Events</span>
                            </div>
                        </div>
                    </div>
                    <div class="dashboard-banner">
                        <span>📊</span>
                        <span>Unified Management Dashboard</span>
                    </div>
                </div>

                <div class="arch-connector"></div>

                <div class="arch-layer">
                    <div class="layer-title">Global Infrastructure</div>
                    <div class="infra-nodes">
                        <div class="infra-node">
                            <div class="infra-icon">☁️</div>
                            <div class="infra-label">Cloudflare Workers</div>
                            <div class="infra-stat">300+ locations</div>
                        </div>
                        <div class="infra-node">
                            <div class="infra-icon">💾</div>
                            <div class="infra-label">D1 Database</div>
                            <div class="infra-stat">Global replication</div>
                        </div>
                        <div class="infra-node">
                            <div class="infra-icon">🔄</div>
                            <div class="infra-label">Durable Objects</div>
                            <div class="infra-stat">Stateful compute</div>
                        </div>
                    </div>
                </div>
            </div>

            <div class="code-block">
                <pre><span class="code-comment">// Integrate in seconds with service bindings</span>
<span class="code-keyword">const</span> auth = <span class="code-keyword">await</span> env.AUTOBOOT_AUTH.fetch(<span class="code-string">'/validate'</span>, {
  headers: { <span class="code-string">'Authorization'</span>: token }
});

<span class="code-keyword">const</span> user = <span class="code-keyword">await</span> auth.json();
<span class="code-comment">// ✨ User is authenticated across all products</span></pre>
            </div>
        </section>
`;
