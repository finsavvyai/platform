<script lang="ts">
	import { toasts } from '$stores/toast';
	import { copyToClipboard } from '$utils/export';

	interface Finding {
		severity: string; title: string; description: string; impact: string;
	}

	interface ScanResult {
		id: string; domain: string; score: number; grade: string;
		emailSecurity: { spf: boolean; dkim: boolean; dmarc: boolean; score: number };
		identitySecurity: { federationDetected: boolean; autodiscoverFound: boolean; score: number };
		m365Signals: { exchangeOnline: boolean; teamsPresence: boolean; sharepointDetected: boolean };
		findings: Finding[]; recommendations: string[];
		scanDuration: number; scannedAt: string; verdict: string;
	}

	let domain = $state('');
	let scanning = $state(false);
	let progress = $state(0);
	let result = $state<ScanResult | null>(null);
	let copied = $state(false);

	const color = $derived(
		result ? (result.score >= 80 ? '#22c55e' : result.score >= 60 ? '#f59e0b' : '#ef4444') : '#ef4444'
	);

	const sevColor: Record<string, string> = {
		critical: '#ef4444', high: '#f97316', medium: '#f59e0b', info: '#3b82f6'
	};

	async function scan() {
		if (!domain.trim()) { toasts.error('Enter a domain'); return; }
		scanning = true; progress = 0; result = null;
		const timer = setInterval(() => { progress = Math.min(progress + Math.random() * 15, 95); }, 400);
		try {
			const apiBase = typeof window !== 'undefined' && window.location.hostname === 'localhost'
				? 'http://localhost:8787' : '';
			const res = await fetch(`${apiBase}/api/prospect-scan/scan`, {
				method: 'POST', headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ domain: domain.trim() }),
			});
			const data = await res.json();
			if (data.error) { toasts.error(data.error); return; }
			result = data.scan;
			progress = 100;
		} catch { toasts.error('Scan failed — try again'); }
		finally { clearInterval(timer); scanning = false; }
	}

	async function shareReport() {
		if (!result) return;
		const url = `${window.location.origin}/prospect?d=${encodeURIComponent(result.domain)}&s=${result.id}`;
		const ok = await copyToClipboard(url);
		if (ok) { copied = true; toasts.success('Report link copied!'); setTimeout(() => copied = false, 2000); }
	}
</script>

<svelte:head>
	<title>Free M365 Security Scan | TenantIQ</title>
	<meta name="description" content="Scan any Microsoft 365 tenant in 40 seconds. Free posture report for MSPs. No signup required." />
</svelte:head>

<div class="prospect-page">
	<!-- Hero -->
	<div class="scan-hero">
		<div class="hero-badge">
			<span class="pulse"></span>
			<span>Free — No signup required</span>
		</div>
		<h1>Scan Any M365 Tenant in <span class="accent">40 Seconds</span></h1>
		<p class="hero-sub">Walk into your next MSP sales call with a full posture report. Your prospect won't know what hit them.</p>

		<div class="scan-bar">
			<input
				type="text" bind:value={domain} placeholder="prospect-company.com"
				class="scan-input" onkeydown={(e) => { if (e.key === 'Enter') scan(); }}
				disabled={scanning}
			/>
			<button class="scan-btn" onclick={scan} disabled={scanning}>
				{scanning ? 'Scanning...' : 'Scan Tenant'}
			</button>
		</div>

		{#if scanning}
			<div class="progress-bar">
				<div class="progress-fill" style="width: {progress}%;"></div>
			</div>
			<p class="progress-label">Checking DNS, email security, identity config...</p>
		{/if}
	</div>

	<!-- Results -->
	{#if result}
		<div class="results animate-fade-up">
			<!-- Score card -->
			<div class="score-card">
				<div class="score-ring" style="--ring-color: {color};">
					<span class="grade" style="color: {color};">{result.grade}</span>
					<span class="score-num">{result.score}<span class="max">/100</span></span>
				</div>
				<div class="score-meta">
					<h2>{result.domain}</h2>
					<p class="verdict">{result.verdict}</p>
					<p class="scan-time">Scanned in {(result.scanDuration / 1000).toFixed(1)}s</p>
				</div>
				<div class="score-actions">
					<button class="share-btn" class:copied onclick={shareReport}>
						{copied ? 'Copied!' : 'Share Report'}
					</button>
					<a href="https://app.tenantiq.app" class="fix-btn">Fix These Issues</a>
				</div>
			</div>

			<!-- Breakdown -->
			<div class="breakdown-grid">
				<div class="breakdown-card">
					<h3>Email Security</h3>
					<div class="check-list">
						<div class="check-item" class:pass={result.emailSecurity.spf}>
							<span class="check-icon">{result.emailSecurity.spf ? '✓' : '✗'}</span> SPF Record
						</div>
						<div class="check-item" class:pass={result.emailSecurity.dkim}>
							<span class="check-icon">{result.emailSecurity.dkim ? '✓' : '✗'}</span> DKIM
						</div>
						<div class="check-item" class:pass={result.emailSecurity.dmarc}>
							<span class="check-icon">{result.emailSecurity.dmarc ? '✓' : '✗'}</span> DMARC
						</div>
					</div>
					<div class="sub-score" style="color: {result.emailSecurity.score >= 70 ? '#22c55e' : '#ef4444'};">
						{result.emailSecurity.score}/100
					</div>
				</div>

				<div class="breakdown-card">
					<h3>Identity & Access</h3>
					<div class="check-list">
						<div class="check-item" class:pass={result.identitySecurity.autodiscoverFound}>
							<span class="check-icon">{result.identitySecurity.autodiscoverFound ? '✓' : '—'}</span> Autodiscover
						</div>
						<div class="check-item" class:pass={result.identitySecurity.federationDetected}>
							<span class="check-icon">{result.identitySecurity.federationDetected ? '✓' : '—'}</span> Federation
						</div>
					</div>
					<div class="sub-score" style="color: {result.identitySecurity.score >= 70 ? '#22c55e' : '#f59e0b'};">
						{result.identitySecurity.score}/100
					</div>
				</div>

				<div class="breakdown-card">
					<h3>M365 Signals</h3>
					<div class="check-list">
						<div class="check-item" class:pass={result.m365Signals.exchangeOnline}>
							<span class="check-icon">{result.m365Signals.exchangeOnline ? '✓' : '—'}</span> Exchange Online
						</div>
						<div class="check-item" class:pass={result.m365Signals.teamsPresence}>
							<span class="check-icon">{result.m365Signals.teamsPresence ? '✓' : '—'}</span> Teams
						</div>
						<div class="check-item" class:pass={result.m365Signals.sharepointDetected}>
							<span class="check-icon">{result.m365Signals.sharepointDetected ? '✓' : '—'}</span> SharePoint
						</div>
					</div>
				</div>
			</div>

			<!-- Findings -->
			{#if result.findings.length > 0}
				<div class="findings-section">
					<h3>Findings ({result.findings.length})</h3>
					<div class="findings-list">
						{#each result.findings as f}
							<div class="finding-row">
								<span class="finding-sev" style="background: {sevColor[f.severity]}20; color: {sevColor[f.severity]};">{f.severity}</span>
								<div class="finding-text">
									<strong>{f.title}</strong>
									<p>{f.description}</p>
									<p class="finding-impact">{f.impact}</p>
								</div>
							</div>
						{/each}
					</div>
				</div>
			{/if}

			<!-- CTA -->
			<div class="cta-card">
				<h3>Ready to fix this?</h3>
				<p>TenantIQ doesn't just report — it acts. One click to remediate every finding above.</p>
				<p class="cta-liner">"Optimize365 reports. TenantIQ acts."</p>
				<div class="cta-actions">
					<a href="https://app.tenantiq.app" class="cta-btn">Start Free Trial — Fix Everything</a>
					<a href="/compare" class="cta-secondary">See full comparison vs Optimize365 →</a>
				</div>
			</div>
		</div>
	{/if}
</div>

<style>
	.prospect-page { min-height: 100vh; background: #060b0f; color: #f1f5f9; }

	.scan-hero { text-align: center; padding: 8rem 5% 3rem; max-width: 700px; margin: 0 auto; }
	.hero-badge { display: inline-flex; align-items: center; gap: 0.5rem; padding: 0.4rem 1rem; background: rgba(16,185,129,0.08); border: 1px solid rgba(16,185,129,0.25); border-radius: 999px; font-size: 0.85rem; color: #10b981; margin-bottom: 1.5rem; }
	.pulse { width: 8px; height: 8px; border-radius: 50%; background: #10b981; animation: pulse 2s infinite; }
	@keyframes pulse { 0%,100% { opacity: 1; } 50% { opacity: 0.4; } }
	.scan-hero h1 { font-size: 3rem; font-weight: 800; line-height: 1.1; margin-bottom: 1rem; letter-spacing: -0.03em; }
	.accent { color: #ef4444; }
	.hero-sub { font-size: 1.15rem; color: #94a3b8; margin-bottom: 2.5rem; line-height: 1.6; }

	.scan-bar { display: flex; gap: 0; max-width: 520px; margin: 0 auto 1.5rem; border-radius: 14px; overflow: hidden; border: 1px solid rgba(239,68,68,0.2); }
	.scan-input { flex: 1; padding: 1rem 1.25rem; background: rgba(255,255,255,0.04); border: none; color: #f1f5f9; font-size: 1.05rem; outline: none; }
	.scan-input::placeholder { color: #64748b; }
	.scan-btn { padding: 1rem 2rem; background: linear-gradient(135deg, #ef4444, #dc2626); color: white; border: none; font-size: 1rem; font-weight: 700; cursor: pointer; transition: all 0.2s; white-space: nowrap; }
	.scan-btn:hover:not(:disabled) { filter: brightness(1.1); }
	.scan-btn:disabled { opacity: 0.6; cursor: not-allowed; }

	.progress-bar { max-width: 520px; margin: 0 auto 0.75rem; height: 4px; background: rgba(255,255,255,0.06); border-radius: 2px; overflow: hidden; }
	.progress-fill { height: 100%; background: linear-gradient(90deg, #ef4444, #f97316); border-radius: 2px; transition: width 0.3s ease; }
	.progress-label { font-size: 0.85rem; color: #64748b; }

	/* Results */
	.results { max-width: 800px; margin: 0 auto; padding: 0 5% 4rem; }
	.animate-fade-up { animation: fadeUp 0.4s cubic-bezier(0.16,1,0.3,1); }
	@keyframes fadeUp { from { opacity: 0; transform: translateY(16px); } to { opacity: 1; transform: translateY(0); } }

	.score-card { display: flex; align-items: center; gap: 20px; padding: 24px; background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.08); border-radius: 20px; margin-bottom: 1.5rem; flex-wrap: wrap; }
	.score-ring { width: 80px; height: 80px; border-radius: 50%; border: 3px solid var(--ring-color); display: flex; flex-direction: column; align-items: center; justify-content: center; flex-shrink: 0; }
	.grade { font-size: 24px; font-weight: 800; line-height: 1; }
	.score-num { font-size: 12px; color: #94a3b8; font-weight: 600; }
	.max { font-size: 10px; color: #64748b; }
	.score-meta { flex: 1; min-width: 200px; }
	.score-meta h2 { font-size: 1.25rem; font-weight: 700; margin-bottom: 4px; }
	.verdict { font-size: 0.9rem; color: #f59e0b; font-style: italic; }
	.scan-time { font-size: 0.8rem; color: #64748b; margin-top: 4px; }
	.score-actions { display: flex; gap: 8px; flex-wrap: wrap; }
	.share-btn, .fix-btn { padding: 10px 20px; border-radius: 10px; font-size: 13px; font-weight: 600; cursor: pointer; transition: all 0.2s; text-decoration: none; border: none; }
	.share-btn { background: rgba(255,255,255,0.06); color: #94a3b8; border: 1px solid rgba(255,255,255,0.1); }
	.share-btn:hover { background: rgba(255,255,255,0.1); color: white; }
	.share-btn.copied { background: #22c55e; color: white; }
	.fix-btn { background: linear-gradient(135deg, #ef4444, #dc2626); color: white; }
	.fix-btn:hover { transform: translateY(-1px); }

	.breakdown-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 1rem; margin-bottom: 1.5rem; }
	.breakdown-card { background: rgba(255,255,255,0.02); border: 1px solid rgba(255,255,255,0.08); border-radius: 16px; padding: 20px; }
	.breakdown-card h3 { font-size: 0.9rem; font-weight: 700; margin-bottom: 12px; color: #94a3b8; }
	.check-list { display: flex; flex-direction: column; gap: 8px; margin-bottom: 12px; }
	.check-item { font-size: 0.9rem; color: #64748b; display: flex; align-items: center; gap: 8px; }
	.check-item.pass { color: #22c55e; }
	.check-icon { font-weight: 700; width: 16px; text-align: center; }
	.sub-score { font-size: 1.5rem; font-weight: 800; }

	.findings-section { margin-bottom: 1.5rem; }
	.findings-section h3 { font-size: 1rem; font-weight: 700; margin-bottom: 12px; }
	.findings-list { display: flex; flex-direction: column; gap: 8px; }
	.finding-row { display: flex; gap: 12px; padding: 14px; background: rgba(255,255,255,0.02); border: 1px solid rgba(255,255,255,0.06); border-radius: 12px; }
	.finding-sev { font-size: 0.7rem; font-weight: 700; text-transform: uppercase; padding: 3px 8px; border-radius: 6px; white-space: nowrap; height: fit-content; letter-spacing: 0.03em; }
	.finding-text { flex: 1; }
	.finding-text strong { font-size: 0.9rem; }
	.finding-text p { font-size: 0.85rem; color: #94a3b8; margin-top: 4px; line-height: 1.5; }
	.finding-impact { color: #f59e0b !important; font-style: italic; font-size: 0.8rem !important; }

	.cta-card { text-align: center; padding: 32px; background: rgba(239,68,68,0.04); border: 1px solid rgba(239,68,68,0.15); border-radius: 20px; }
	.cta-card h3 { font-size: 1.25rem; font-weight: 700; margin-bottom: 8px; }
	.cta-card p { font-size: 0.95rem; color: #94a3b8; margin-bottom: 8px; }
	.cta-liner { color: #f59e0b; font-style: italic; font-size: 0.9rem; margin-bottom: 20px; }
	.cta-btn { display: inline-block; padding: 14px 32px; background: linear-gradient(135deg, #ef4444, #dc2626); color: white; border-radius: 12px; font-size: 1.05rem; font-weight: 700; text-decoration: none; transition: all 0.2s; }
	.cta-btn:hover { transform: translateY(-2px); box-shadow: 0 12px 32px rgba(239,68,68,0.3); }
	.cta-actions { display: flex; gap: 1rem; align-items: center; justify-content: center; flex-wrap: wrap; margin-top: 0.5rem; }
	.cta-secondary { color: #94a3b8; text-decoration: none; font-size: 0.9rem; padding: 0.75rem 0; border-bottom: 1px solid transparent; transition: border-color 0.2s, color 0.2s; }
	.cta-secondary:hover { color: #f1f5f9; border-bottom-color: #f1f5f9; }

	@media (max-width: 768px) {
		.scan-hero h1 { font-size: 2rem; }
		.breakdown-grid { grid-template-columns: 1fr; }
		.score-card { flex-direction: column; text-align: center; }
		.scan-bar { flex-direction: column; }
	}
</style>
