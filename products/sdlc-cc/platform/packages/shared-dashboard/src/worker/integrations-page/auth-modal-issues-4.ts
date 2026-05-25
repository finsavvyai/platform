// AutoBoot Integration Hub - Auth modal: issues 9-12 (frameworks, password, OAuth, mobile)

export const authModalIssues4 = `
                        <!-- Issue 9: Framework-Specific -->
                        <details style="margin-bottom: 1.5rem; cursor: pointer;">
                            <summary style="font-weight: 600; color: var(--text-primary); padding: 0.75rem; background: var(--bg-primary); border-radius: 0.5rem; margin-bottom: 0.5rem;">
                                <span style="color: #f59e0b; margin-right: 0.5rem;">⚡</span>
                                Framework-Specific Tips (Next.js, React, Vue, etc.)
                            </summary>
                            <div style="padding: 1rem; background: var(--bg-primary); border-radius: 0.5rem; margin-top: 0.5rem;">
                                <p style="margin-bottom: 1rem;"><strong style="color: var(--text-primary);">Next.js (App Router):</strong></p>
                                <pre style="background: var(--bg-secondary); padding: 1rem; border-radius: 0.5rem; overflow-x: auto; font-size: 0.875rem; margin-bottom: 1.5rem;"><span class="code-comment">// app/api/protected/route.ts</span>
<span class="code-keyword">import</span> { auth } <span class="code-keyword">from</span> <span class="code-string">'@autoboot/sdk'</span>;
<span class="code-keyword">import</span> { NextRequest } <span class="code-keyword">from</span> <span class="code-string">'next/server'</span>;

<span class="code-keyword">export async function</span> <span class="code-function">GET</span>(request: NextRequest) {
  <span class="code-keyword">const</span> user = <span class="code-keyword">await</span> auth.<span class="code-function">validateToken</span>(request);
  <span class="code-keyword">if</span> (!user) <span class="code-keyword">return</span> Response.<span class="code-function">json</span>({ <span class="code-variable">error</span>: <span class="code-string">'Unauthorized'</span> }, { <span class="code-variable">status</span>: <span class="code-number">401</span> });

  <span class="code-keyword">return</span> Response.<span class="code-function">json</span>({ user });
}</pre>

                                <p style="margin-bottom: 1rem;"><strong style="color: var(--text-primary);">React (with Context):</strong></p>
                                <pre style="background: var(--bg-secondary); padding: 1rem; border-radius: 0.5rem; overflow-x: auto; font-size: 0.875rem; margin-bottom: 1.5rem;"><span class="code-comment">// AuthContext.tsx</span>
<span class="code-keyword">const</span> AuthContext = <span class="code-function">createContext</span>(<span class="code-keyword">null</span>);

<span class="code-keyword">export function</span> <span class="code-function">AuthProvider</span>({ children }) {
  <span class="code-keyword">const</span> [user, setUser] = <span class="code-function">useState</span>(<span class="code-keyword">null</span>);

  <span class="code-keyword">useEffect</span>(() => {
    <span class="code-keyword">const</span> token = localStorage.<span class="code-function">getItem</span>(<span class="code-string">'access_token'</span>);
    <span class="code-keyword">if</span> (token) <span class="code-function">loadUser</span>(token);
  }, []);

  <span class="code-keyword">return</span> &lt;AuthContext.Provider value={{ user, setUser }}&gt;{children}&lt;/AuthContext.Provider&gt;;
}</pre>

                                <p style="margin-bottom: 1rem;"><strong style="color: var(--text-primary);">Vue 3 (with Pinia):</strong></p>
                                <pre style="background: var(--bg-secondary); padding: 1rem; border-radius: 0.5rem; overflow-x: auto; font-size: 0.875rem;"><span class="code-comment">// stores/auth.ts</span>
<span class="code-keyword">import</span> { defineStore } <span class="code-keyword">from</span> <span class="code-string">'pinia'</span>;

<span class="code-keyword">export const</span> useAuthStore = <span class="code-function">defineStore</span>(<span class="code-string">'auth'</span>, {
  <span class="code-function">state</span>: () => ({ user: <span class="code-keyword">null</span>, token: localStorage.<span class="code-function">getItem</span>(<span class="code-string">'access_token'</span>) }),
  <span class="code-variable">actions</span>: {
    <span class="code-keyword">async</span> <span class="code-function">login</span>(email, password) {
      <span class="code-keyword">const</span> res = <span class="code-keyword">await</span> <span class="code-function">fetch</span>(<span class="code-string">'https://api.sdlc.cc/auth/login'</span>, {
        <span class="code-variable">method</span>: <span class="code-string">'POST'</span>, <span class="code-variable">body</span>: <span class="code-function">JSON.stringify</span>({ email, password })
      });
      <span class="code-keyword">const</span> { token } = <span class="code-keyword">await</span> res.<span class="code-function">json</span>();
      <span class="code-keyword">this</span>.token = token;
      localStorage.<span class="code-function">setItem</span>(<span class="code-string">'access_token'</span>, token);
    }
  }
});</pre>
                            </div>
                        </details>`;
