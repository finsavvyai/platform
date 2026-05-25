<script lang="ts">
	const stats = [
		{ value: '40s', label: 'Prospect Scan' },
		{ value: '100+', label: 'CIS Controls' },
		{ value: '13+', label: 'AI Tools' },
		{ value: '1-Click', label: 'Remediation' }
	];

	const agentActions = [
		'Scanning 4 tenants for CIS violations...',
		'Found 23 inactive users — revoking E5 licenses...',
		'MFA disabled for 3 admins — enabling now...',
		'DMARC missing on contoso.com — deploying fix...',
		'$2,520/mo license waste detected — downgrading...',
		'Secure Score improved: 34 → 67 across 6 tenants...',
	];

	let currentAction = $state(0);

	$effect(() => {
		const interval = setInterval(() => {
			currentAction = (currentAction + 1) % agentActions.length;
		}, 3000);
		return () => clearInterval(interval);
	});
</script>

<section class="hero" id="hero">
	<div class="grid-overlay"></div>
	<div class="hero-inner">
		<div class="hero-badge">
			<span class="pulse"></span>
			<span>The MSP Control Plane for Microsoft 365</span>
		</div>
		<h1 class="hero-title">
			Other Tools Report.
			<span class="gradient-text">TenantIQ Acts.</span>
		</h1>
		<p class="hero-desc">
			Built for managing <em>other people's</em> M365 tenants — the part Claude in Excel can't do. CIS scans, drift attribution, license gating, and one-click remediation across every customer in your book.
		</p>

		<!-- Live agent ticker -->
		<div class="agent-ticker" aria-live="polite">
			<span class="ticker-icon">
				<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 00-2.455 2.456z"/></svg>
			</span>
			<span class="ticker-text">{agentActions[currentAction]}</span>
		</div>

		<div class="hero-actions">
			<a href="/prospect" class="btn-cta">
				Scan a Prospect Free <span>&#8594;</span>
			</a>
			<a href="https://app.tenantiq.app" class="btn-secondary">
				Start Free Trial
			</a>
			<a href="/demo" class="btn-ghost">
				Watch Demo <span>&#9654;</span>
			</a>
		</div>

		<div class="hero-stats">
			{#each stats as stat}
				<div class="stat">
					<div class="stat-value">{stat.value}</div>
					<div class="stat-label">{stat.label}</div>
				</div>
			{/each}
		</div>

		<div class="trust-badges">
			<span class="trust-badge">SOC 2</span>
			<span class="trust-badge">HIPAA</span>
			<span class="trust-badge">GDPR</span>
			<span class="trust-badge">Zero Trust</span>
			<span class="trust-badge accent">GDAP Native</span>
			<span class="trust-badge accent">Partner Center</span>
		</div>

		<div class="stack-row" aria-label="Integrated MSP stack">
			<span class="stack-label">Built on the stack MSP work runs on</span>
			<div class="stack-badges">
				<span class="stack-badge">Microsoft Graph</span>
				<span class="stack-badge">Defender XDR</span>
				<span class="stack-badge">Intune</span>
				<span class="stack-badge">Entra ID PIM</span>
				<span class="stack-badge">CIS v3.1</span>
				<span class="stack-badge">ConnectWise</span>
				<span class="stack-badge">Datto</span>
				<span class="stack-badge">Kaseya</span>
				<span class="stack-badge">OpenClaw</span>
				<span class="stack-badge">M365 Marketplace</span>
				<span class="stack-badge">LemonSqueezy</span>
				<span class="stack-badge">Anthropic Claude</span>
			</div>
		</div>
	</div>
</section>

<style>
	.hero { position: relative; min-height: 100vh; display: flex; align-items: center; justify-content: center; padding: 8rem 5% 6rem; overflow: hidden; }
	.grid-overlay { position: absolute; inset: 0; background-image: linear-gradient(rgba(16,185,129,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(16,185,129,0.04) 1px, transparent 1px); background-size: 60px 60px; pointer-events: none; }
	.hero-inner { position: relative; max-width: 820px; text-align: center; z-index: 1; }
	.hero-badge { display: inline-flex; align-items: center; gap: 0.5rem; padding: 0.5rem 1.25rem; background: rgba(16,185,129,0.08); border: 1px solid rgba(16,185,129,0.25); border-radius: 999px; font-size: 0.875rem; color: #10b981; margin-bottom: 2rem; }
	.pulse { width: 8px; height: 8px; border-radius: 50%; background: #10b981; animation: pulse 2s infinite; }
	@keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.4; } }
	.hero-title { font-size: 4.2rem; font-weight: 800; line-height: 1.08; margin-bottom: 1.5rem; letter-spacing: -0.03em; }
	.gradient-text { background: linear-gradient(135deg, #10b981, #059669); -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text; }
	.hero-desc { font-size: 1.25rem; color: #94a3b8; line-height: 1.7; margin-bottom: 1.5rem; max-width: 620px; margin-inline: auto; }

	/* Agent ticker */
	.agent-ticker { display: inline-flex; align-items: center; gap: 0.6rem; padding: 0.6rem 1.25rem; background: rgba(16,185,129,0.06); border: 1px solid rgba(16,185,129,0.15); border-radius: 10px; margin-bottom: 2rem; }
	.ticker-icon { color: #10b981; display: flex; animation: sparkle 2s ease-in-out infinite; }
	@keyframes sparkle { 0%, 100% { opacity: 1; } 50% { opacity: 0.5; transform: scale(1.1); } }
	.ticker-text { font-size: 0.9rem; color: #10b981; font-weight: 500; font-family: 'SF Mono', 'Fira Code', monospace; animation: fadeInOut 3s ease-in-out infinite; }
	@keyframes fadeInOut { 0% { opacity: 0; } 10% { opacity: 1; } 90% { opacity: 1; } 100% { opacity: 0; } }

	.hero-actions { display: flex; gap: 0.75rem; justify-content: center; margin-bottom: 3rem; flex-wrap: wrap; }
	.btn-cta, .btn-secondary, .btn-ghost { display: inline-flex; align-items: center; gap: 0.5rem; min-height: 48px; padding: 0.9rem 1.75rem; font-size: 1rem; font-weight: 600; border-radius: 12px; border: none; cursor: pointer; text-decoration: none; transition: all 0.3s ease; }
	.btn-cta { background: linear-gradient(135deg, #10b981, #059669); color: white; }
	.btn-cta:hover { transform: translateY(-2px); box-shadow: 0 20px 40px rgba(16,185,129,0.35); }
	.btn-secondary { background: linear-gradient(135deg, #ef4444, #dc2626); color: white; }
	.btn-secondary:hover { transform: translateY(-2px); box-shadow: 0 20px 40px rgba(239,68,68,0.3); }
	.btn-ghost { background: rgba(255,255,255,0.05); color: white; border: 1px solid rgba(255,255,255,0.15); }
	.btn-ghost:hover { background: rgba(255,255,255,0.1); }
	.hero-stats { display: grid; grid-template-columns: repeat(4, 1fr); gap: 2rem; padding: 2rem 0; border-top: 1px solid rgba(255,255,255,0.08); margin-bottom: 2rem; }
	.stat-value { font-size: 2rem; font-weight: 700; color: #10b981; }
	.stat-label { font-size: 0.85rem; color: #64748b; margin-top: 0.25rem; }
	.trust-badges { display: flex; gap: 0.75rem; justify-content: center; flex-wrap: wrap; }
	.trust-badge { padding: 0.4rem 1rem; background: rgba(16,185,129,0.06); border: 1px solid rgba(16,185,129,0.15); border-radius: 8px; font-size: 0.8rem; color: #94a3b8; font-weight: 500; letter-spacing: 0.05em; }
	.trust-badge.accent { background: rgba(59,130,246,0.08); border-color: rgba(59,130,246,0.2); color: #60a5fa; }

	.stack-row { margin-top: 2rem; padding-top: 1.5rem; border-top: 1px dashed rgba(255,255,255,0.08); }
	.stack-label { display: block; font-size: 0.75rem; color: #64748b; letter-spacing: 0.04em; text-transform: uppercase; margin-bottom: 0.875rem; }
	.stack-badges { display: flex; gap: 0.5rem; justify-content: center; flex-wrap: wrap; }
	.stack-badge { padding: 0.3rem 0.75rem; background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.08); border-radius: 6px; font-size: 0.75rem; color: #94a3b8; font-weight: 500; }
	@media (max-width: 768px) { .hero-title { font-size: 2.5rem; } .hero-stats { grid-template-columns: repeat(2, 1fr); } .hero-actions { flex-direction: column; align-items: center; } }
</style>
