<div class="card">
	<h3>Use your key</h3>
	<p>Add to Claude Desktop config (<code>~/Library/Application Support/Claude/claude_desktop_config.json</code>):</p>
	<pre><code>&#123;
  "mcpServers": &#123;
    "tenantiq": &#123;
      "transport": &#123;
        "type": "http",
        "url": "https://api.tenantiq.app/api/mcp",
        "headers": &#123; "Authorization": "Bearer tiq_..." &#125;
      &#125;
    &#125;
  &#125;
&#125;</code></pre>
	<p class="hint">Restart Claude Desktop after saving. TenantIQ tools (CIS posture, drift, alerts, …) appear in the tool picker.</p>
</div>

<style>
	.card { padding: 1.25rem 1.5rem; background: var(--color-surface); border: 1px solid var(--color-border); border-radius: 0.75rem; }
	.card h3 { font-size: 0.9375rem; font-weight: 600; margin: 0 0 0.5rem 0; }
	.card p { font-size: 0.8125rem; color: var(--color-text-secondary); margin: 0 0 0.5rem 0; }
	.card pre { font-family: 'SF Mono', Menlo, monospace; font-size: 0.75rem; padding: 0.875rem; background: var(--color-bg-tertiary); border: 1px solid var(--color-border); border-radius: 0.5rem; overflow-x: auto; line-height: 1.5; }
	.card code { font-family: 'SF Mono', Menlo, monospace; }
	.hint { font-size: 0.75rem; color: var(--color-text-tertiary); margin-top: 0.5rem; }
</style>
