<script lang="ts">
	import { page } from '$app/state';
	import LandingNav from '$lib/components/landing/LandingNav.svelte';
	import LandingFooter from '$lib/components/landing/LandingFooter.svelte';
	import { Shield, AlertTriangle, CheckCircle2, ExternalLink, Copy } from 'lucide-svelte';
	import { onMount } from 'svelte';

	type Severity = 'critical' | 'high' | 'medium' | 'low' | 'info';

	interface Finding {
		id: string;
		severity: Severity;
		title: string;
		detail: string;
		remediation: string;
	}

	interface DnsAuth {
		domain: string;
		spfRecords: string[];
		dmarcRecords: string[];
		spf: 'pass' | 'none';
		dmarc: 'pass' | 'none';
		dkim: 'pass' | 'none';
		dmarcPolicy: string;
		dkimSelectors: { selector: string; recordType: string; status: 'pass' | 'none' }[];
	}

	interface ScanResult {
		domain: string;
		scannedAt: string;
		mailProvider: { provider: string; mxRecords: string[] };
		tenant: { tenantId: string | null; federationType: string; federationBrandName?: string; tenantExists: boolean };
		dnsAuth: DnsAuth;
		findings: Finding[];
		score: number;
		estimatedRiskUsd: { low: number; high: number };
	}

	interface StageEvent {
		stage: 'dns' | 'tenant' | 'mail' | 'fed' | 'report';
		status: 'running' | 'done';
		message: string;
		payload?: unknown;
	}

	let result = $state<ScanResult | null>(null);
	let loading = $state(true);
	let error = $state<string | null>(null);
	let copied = $state(false);
	let narration = $state<StageEvent[]>([]);

	const domain = $derived(page.params.domain);

	onMount(async () => {
		const apiBase = window.location.hostname === 'localhost' ? 'http://localhost:8787' : 'https://api.tenantiq.app';
		try {
			const res = await fetch(`${apiBase}/api/prospect/scan/sse?domain=${encodeURIComponent(domain ?? '')}`);
			if (!res.ok || !res.body) throw new Error(`Scan stream failed: ${res.status}`);
			const reader = res.body.getReader();
			const dec = new TextDecoder();
			let buf = '';
			while (true) {
				const { value, done } = await reader.read();
				if (done) break;
				buf += dec.decode(value, { stream: true });
				let nl;
				while ((nl = buf.indexOf('\n\n')) !== -1) {
					const frame = buf.slice(0, nl); buf = buf.slice(nl + 2);
					if (!frame.startsWith('data: ')) continue;
					try {
						const ev = JSON.parse(frame.slice(6)) as StageEvent;
						narration = [...narration, ev];
						if (ev.stage === 'report' && ev.status === 'done' && ev.payload) {
							result = ev.payload as ScanResult;
						}
					} catch { /* ignore parse errors */ }
				}
			}
		} catch (e) {
			error = e instanceof Error ? e.message : 'Scan failed';
		} finally {
			loading = false;
		}
	});

	async function copyShareLink() {
		const url = `${window.location.origin}/scan/${domain}`;
		await navigator.clipboard.writeText(url);
		copied = true;
		setTimeout(() => copied = false, 2000);
	}

	const severityColor: Record<Severity, string> = {
		critical: 'var(--color-danger)', high: 'var(--color-warning)', medium: 'var(--color-warning)',
		low: 'var(--color-info)', info: 'var(--color-text-secondary)',
	};

	const grade = $derived.by(() => {
		if (!result) return '';
		const s = result.score;
		if (s >= 90) return 'A';
		if (s >= 75) return 'B';
		if (s >= 60) return 'C';
		if (s >= 45) return 'D';
		return 'F';
	});

	const ogTitle = $derived(result ? `${domain}: ${result.score}/100 (${grade}) — M365 security scan` : `${domain} — M365 security scan`);
	const ogDescription = $derived(
		result
			? `${result.findings.length} finding(s). Mail provider: ${result.mailProvider.provider}. Tenant ${result.tenant.tenantExists ? 'verified' : 'not found'}.`
			: 'Free Microsoft 365 security posture scan by TenantIQ — no signup, no credentials.',
	);
	const ogImage = $derived(`https://api.tenantiq.app/api/prospect/og.svg?domain=${encodeURIComponent(domain ?? '')}`);
</script>

<svelte:head>
	<title>{ogTitle}</title>
	<meta name="description" content={ogDescription} />
	<link rel="canonical" href="https://app.tenantiq.app/scan/{domain}" />
	<meta property="og:title" content={ogTitle} />
	<meta property="og:description" content={ogDescription} />
	<meta property="og:type" content="website" />
	<meta property="og:url" content="https://app.tenantiq.app/scan/{domain}" />
	<meta property="og:image" content={ogImage} />
	<meta property="og:image:type" content="image/svg+xml" />
	<meta property="og:image:width" content="1200" />
	<meta property="og:image:height" content="630" />
	<meta name="twitter:card" content="summary_large_image" />
	<meta name="twitter:title" content={ogTitle} />
	<meta name="twitter:description" content={ogDescription} />
	<meta name="twitter:image" content={ogImage} />
</svelte:head>

<div class="landing">
	<LandingNav />
	<main id="main-content">
		<section class="hero">
			<div class="container">
				<div class="breadcrumb">
					<a href="/prospect">← Run another scan</a>
					<span>·</span>
					<a href="/compare">vs Optimize365</a>
				</div>
				<h1>{domain}</h1>
				<p class="lede">M365 security posture scan · Free · No signup required</p>
			</div>
		</section>

		<div class="container">
			{#if loading || narration.length > 0 && !result}
				<div class="card narration-card">
					<div class="narration-head">
						<div class="spinner"></div>
						<span>Agent scanning <strong>{domain}</strong>…</span>
					</div>
					<ul class="narration-list">
						{#each narration as ev}
							<li class:done={ev.status === 'done'}>
								<span class="dot dot-{ev.status}"></span>
								<span class="stage-name">{ev.stage}</span>
								<span class="stage-msg">{ev.message}</span>
							</li>
						{/each}
					</ul>
					{#if narration.length === 0}<p class="hint">Connecting to TenantIQ agent…</p>{/if}
				</div>
			{:else if error}
				<div class="card error-card">
					<AlertTriangle size={32} />
					<h2>Scan failed</h2>
					<p>{error}</p>
					<a href="/prospect" class="btn">Try a different domain</a>
				</div>
			{:else if result}
				<!-- Score Card -->
				<div class="card score-card" style="--score-color: {result.score >= 75 ? 'var(--color-success)' : result.score >= 50 ? 'var(--color-warning)' : 'var(--color-danger)'};">
					<div class="score-ring">
						<div class="score-grade">{grade}</div>
						<div class="score-num">{result.score}<span>/100</span></div>
					</div>
					<div class="score-body">
						<h2>Posture score</h2>
						<p>{result.findings.length} finding{result.findings.length === 1 ? '' : 's'} · Estimated annual risk: ${result.estimatedRiskUsd.low.toLocaleString()}–${result.estimatedRiskUsd.high.toLocaleString()}</p>
						<div class="actions">
							<button onclick={copyShareLink} class="btn-share">
								<Copy size={14} />
								{copied ? 'Copied!' : 'Copy share link'}
							</button>
							<a href="https://app.tenantiq.app" class="btn-primary">
								Fix this in TenantIQ →
							</a>
						</div>
					</div>
				</div>

				<!-- Tenant identity -->
				<div class="card">
					<h3><Shield size={16} /> Tenant identity</h3>
					<dl class="kv">
						<dt>Microsoft tenant</dt>
						<dd>{result.tenant.tenantExists ? `Yes${result.tenant.federationBrandName ? ` (${result.tenant.federationBrandName})` : ''}` : 'Not found'}</dd>
						{#if result.tenant.tenantId}
							<dt>Tenant ID</dt><dd><code>{result.tenant.tenantId}</code></dd>
						{/if}
						<dt>Federation type</dt><dd>{result.tenant.federationType}</dd>
						<dt>Mail provider</dt><dd>{result.mailProvider.provider}</dd>
					</dl>
				</div>

				<!-- DNS auth -->
				<div class="card">
					<h3><Shield size={16} /> Email authentication (DNS)</h3>
					<div class="dns-row">
						<div class="dns-item" class:pass={result.dnsAuth.spf === 'pass'}>
							<span class="dns-label">SPF</span>
							<span class="dns-status">{result.dnsAuth.spf}</span>
						</div>
						<div class="dns-item" class:pass={result.dnsAuth.dmarc === 'pass'}>
							<span class="dns-label">DMARC</span>
							<span class="dns-status">{result.dnsAuth.dmarc}{result.dnsAuth.dmarc === 'pass' ? ` (p=${result.dnsAuth.dmarcPolicy})` : ''}</span>
						</div>
						<div class="dns-item" class:pass={result.dnsAuth.dkim === 'pass'}>
							<span class="dns-label">DKIM</span>
							<span class="dns-status">{result.dnsAuth.dkimSelectors.filter(s => s.status === 'pass').length}/{result.dnsAuth.dkimSelectors.length} selectors</span>
						</div>
					</div>
				</div>

				<!-- Findings -->
				{#if result.findings.length === 0}
					<div class="card empty-card">
						<CheckCircle2 size={32} />
						<h3>No findings — clean scan</h3>
						<p>The public-facing posture for {domain} looks healthy.</p>
					</div>
				{:else}
					<div class="findings-list">
						<h3>Findings</h3>
						{#each result.findings as f}
							<div class="finding" style="border-left-color: {severityColor[f.severity]};">
								<div class="finding-head">
									<span class="sev-tag" style="background: color-mix(in srgb, {severityColor[f.severity]} 15%, transparent); color: {severityColor[f.severity]};">{f.severity}</span>
									<strong>{f.title}</strong>
								</div>
								<p class="finding-detail">{f.detail}</p>
								<p class="finding-fix"><strong>Fix:</strong> {f.remediation}</p>
							</div>
						{/each}
					</div>
				{/if}

				<!-- Closing CTA -->
				<div class="card cta-card">
					<h3>This scan checks 4 public sources. TenantIQ checks 121.</h3>
					<p>The free public scan covers SPF/DMARC/DKIM, tenant discovery, federation type, and mail-provider classification — all from public DNS + Microsoft endpoints.</p>
					<p>The paid product runs 121 CIS controls (31 fully automated), audits mailbox rules for BEC, evaluates ISO 27001 / SOC 2 / HIPAA / GDPR posture, monitors drift with Graph attribution, and applies one-click remediation with rollback.</p>
					<div class="actions">
						<a href="/compare" class="btn-secondary">Compare vs Optimize365</a>
						<a href="https://app.tenantiq.app" class="btn-primary">Start 14-day free trial →</a>
					</div>
				</div>
			{/if}
		</div>
	</main>
	<LandingFooter />
</div>

<style>
	.landing { min-height: 100vh; background: var(--color-bg); padding-top: 5rem; }
	.container { max-width: 880px; margin: 0 auto; padding: 0 1.5rem; }

	.hero { padding: 2.5rem 0 1.5rem 0; }
	.breadcrumb { font-size: 0.8125rem; color: var(--color-text-secondary); display: flex; gap: 0.5rem; margin-bottom: 0.75rem; }
	.breadcrumb a { color: var(--color-text-secondary); text-decoration: none; }
	.breadcrumb a:hover { color: var(--color-text); }
	.hero h1 { font-size: 2.25rem; font-weight: 700; margin: 0; letter-spacing: -0.02em; word-break: break-word; }
	.lede { color: var(--color-text-secondary); margin: 0.5rem 0 0 0; font-size: 0.9375rem; }

	.card { background: var(--color-surface); border: 1px solid var(--color-border); border-radius: 0.75rem; padding: 1.5rem; margin-bottom: 1.25rem; }
	.card h2 { font-size: 1.125rem; font-weight: 600; margin: 0 0 0.5rem 0; }
	.card h3 { display: flex; align-items: center; gap: 0.5rem; font-size: 0.9375rem; font-weight: 600; margin: 0 0 0.875rem 0; }
	.card p { margin: 0 0 0.75rem 0; color: var(--color-text-secondary); font-size: 0.875rem; line-height: 1.5; }

	.loading-card, .error-card, .empty-card { text-align: center; padding: 3rem 1.5rem; }
	.spinner { width: 40px; height: 40px; border: 3px solid var(--color-border); border-top-color: var(--color-primary); border-radius: 50%; margin: 0 auto 1rem; animation: spin 1s linear infinite; }
	@keyframes spin { to { transform: rotate(360deg); } }
	.hint { font-size: 0.75rem; color: var(--color-text-tertiary); }

	.narration-card { padding: 1.5rem; }
	.narration-head { display: flex; align-items: center; gap: 0.875rem; margin-bottom: 1rem; padding-bottom: 0.875rem; border-bottom: 1px solid var(--color-border); }
	.narration-head .spinner { width: 24px; height: 24px; margin: 0; border-width: 2px; }
	.narration-head span { font-size: 0.9375rem; color: var(--color-text); }
	.narration-list { list-style: none; padding: 0; margin: 0; display: flex; flex-direction: column; gap: 0.625rem; }
	.narration-list li { display: grid; grid-template-columns: 14px 60px 1fr; gap: 0.625rem; align-items: start; font-size: 0.8125rem; color: var(--color-text-secondary); line-height: 1.5; }
	.narration-list li.done { color: var(--color-text); }
	.dot { width: 8px; height: 8px; border-radius: 50%; margin-top: 0.5rem; }
	.dot-running { background: var(--color-warning); animation: pulse-dot 1s infinite; }
	.dot-done { background: var(--color-success); }
	@keyframes pulse-dot { 50% { opacity: 0.4; } }
	.stage-name { font-family: 'SF Mono', Menlo, monospace; font-size: 0.75rem; text-transform: uppercase; color: var(--color-primary); padding-top: 1px; }
	.stage-msg { color: inherit; }

	.score-card { display: flex; align-items: center; gap: 2rem; flex-wrap: wrap; }
	.score-ring { width: 140px; height: 140px; border-radius: 50%; border: 8px solid var(--score-color); display: flex; flex-direction: column; align-items: center; justify-content: center; flex-shrink: 0; }
	.score-grade { font-size: 1.5rem; font-weight: 700; color: var(--score-color); margin-bottom: -0.25rem; }
	.score-num { font-size: 2rem; font-weight: 800; color: var(--color-text); }
	.score-num span { font-size: 1rem; font-weight: 500; color: var(--color-text-secondary); }
	.score-body { flex: 1; min-width: 0; }

	.actions { display: flex; gap: 0.75rem; flex-wrap: wrap; margin-top: 1rem; }
	.btn-share, .btn, .btn-primary, .btn-secondary { display: inline-flex; align-items: center; gap: 0.375rem; padding: 0.625rem 1.25rem; border-radius: 0.5rem; font-weight: 500; text-decoration: none; border: none; cursor: pointer; font-size: 0.875rem; }
	.btn-share, .btn-secondary, .btn { background: var(--color-bg-tertiary); color: var(--color-text); border: 1px solid var(--color-border); }
	.btn-primary { background: var(--color-primary); color: white; }

	.kv { display: grid; grid-template-columns: 9rem 1fr; gap: 0.5rem 1rem; margin: 0; }
	.kv dt { color: var(--color-text-secondary); font-size: 0.8125rem; }
	.kv dd { margin: 0; font-weight: 500; font-size: 0.875rem; }
	.kv code { font-family: 'SF Mono', Menlo, monospace; font-size: 0.75rem; background: var(--color-bg-tertiary); padding: 0.125rem 0.375rem; border-radius: 0.25rem; }

	.dns-row { display: grid; gap: 0.75rem; grid-template-columns: repeat(3, 1fr); }
	.dns-item { padding: 0.875rem; border: 1px solid var(--color-border); border-radius: 0.5rem; }
	.dns-item.pass { background: color-mix(in srgb, var(--color-success) 8%, transparent); border-color: color-mix(in srgb, var(--color-success) 25%, transparent); }
	.dns-label { display: block; font-size: 0.6875rem; text-transform: uppercase; letter-spacing: 0.05em; color: var(--color-text-secondary); margin-bottom: 0.25rem; }
	.dns-status { font-weight: 500; font-size: 0.875rem; text-transform: capitalize; }

	.findings-list h3 { padding: 0 0.5rem; margin: 1.5rem 0 0.75rem 0; }
	.finding { background: var(--color-surface); border: 1px solid var(--color-border); border-left: 4px solid; border-radius: 0.5rem; padding: 1rem; margin-bottom: 0.5rem; }
	.finding-head { display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.5rem; }
	.sev-tag { padding: 0.125rem 0.5rem; border-radius: 0.25rem; font-size: 0.6875rem; font-weight: 600; text-transform: uppercase; }
	.finding-detail, .finding-fix { margin: 0.25rem 0; font-size: 0.8125rem; line-height: 1.5; color: var(--color-text); }
	.finding-fix { color: var(--color-text-secondary); }

	.cta-card { background: linear-gradient(135deg, color-mix(in srgb, var(--color-primary) 8%, var(--color-surface)), color-mix(in srgb, var(--color-primary) 4%, var(--color-surface))); border-color: color-mix(in srgb, var(--color-primary) 25%, transparent); }
	.cta-card h3 { font-size: 1.125rem; }

	@media (max-width: 600px) {
		.dns-row { grid-template-columns: 1fr; }
		.kv { grid-template-columns: 1fr; }
		.kv dt { font-weight: 600; margin-top: 0.5rem; }
	}
</style>
