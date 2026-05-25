<script lang="ts">
	import { page } from '$app/stores';
	import { toasts } from '$stores/toast';
	import { copyToClipboard } from '$utils/export';

	// Read score from URL params (shareable link)
	const score = $derived(Number($page.url.searchParams.get('s')) || 62);
	const domain = $derived($page.url.searchParams.get('d') || 'your-site.com');

	const grade = $derived(
		score >= 90 ? 'A+' : score >= 80 ? 'A' : score >= 70 ? 'B' : score >= 60 ? 'C' : score >= 50 ? 'D' : 'F'
	);

	const color = $derived(score >= 80 ? '#22c55e' : score >= 60 ? '#f59e0b' : '#ef4444');

	// Rotating Larry David one-liners
	const liners = [
		'"You think your tenant is secure? That\'s adorable."',
		'"Every admin thinks they\'re doing a great job… until TenantIQ shows up."',
		'"We didn\'t build this because everything was fine."',
		'"It\'s not broken. It\'s just aggressively misconfigured."',
		'"TenantIQ doesn\'t panic. It just quietly proves that you should."',
		'"Oh, you trust your configurations? TenantIQ doesn\'t trust you trusting them."',
		'"TenantIQ is basically a mirror—but for your worst configuration choices."',
		'"You didn\'t misconfigure anything? Wow. That\'s… statistically unlikely."',
		'"We don\'t create problems. We just reveal the ones you\'ve been ignoring."',
		'"We scan your site so thoroughly, even your bad decisions feel exposed."',
	];

	const verdict = $derived(
		score >= 90 ? 'Pretty… Pretty… Pretty Good.' :
		score >= 80 ? 'Not bad. TenantIQ is cautiously optimistic.' :
		score >= 70 ? 'Eh. Could be worse. Could also be a LOT better.' :
		score >= 60 ? 'You said: "Pretty good." TenantIQ says: "We need to talk."' :
		score >= 50 ? 'Pretty… Pretty… Pretty Insecure.' :
		'Your site is the digital equivalent of an unlocked front door with a "Welcome Hackers" mat.'
	);

	let currentLiner = $state(0);
	let copied = $state(false);

	$effect(() => {
		const interval = setInterval(() => {
			currentLiner = (currentLiner + 1) % liners.length;
		}, 3500);
		return () => clearInterval(interval);
	});

	const shareUrl = $derived(typeof window !== 'undefined' ? window.location.href : '');

	async function copyLink() {
		const ok = await copyToClipboard(shareUrl);
		if (ok) {
			copied = true;
			toasts.success('Link copied!');
			setTimeout(() => { copied = false; }, 2000);
		}
	}
</script>

<svelte:head>
	<title>{domain} scored {score}/100 — AI Readiness Report | TenantIQ</title>
	<meta name="description" content="{domain} scored {score}/100 on AI readiness. Pretty... Pretty... {score >= 70 ? 'Pretty Good.' : 'Insecure.'} Check your score at TenantIQ." />
	<meta property="og:title" content="{domain}: AI Readiness Score {score}/100 — Grade {grade}" />
	<meta property="og:description" content="{verdict} Scan your site for free with TenantIQ's AI SEO Optimizer." />
</svelte:head>

<div class="report-page">
	<div class="report-card">
		<!-- Header -->
		<div class="report-header">
			<div class="brand">
				<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z"/></svg>
				<span>TenantIQ AI Readiness Report</span>
			</div>
			<span class="report-date">Generated {new Date().toLocaleDateString()}</span>
		</div>

		<!-- Big score -->
		<div class="score-section">
			<div class="big-ring" style="--ring-color: {color};">
				<span class="big-grade" style="color: {color};">{grade}</span>
				<span class="big-score">{score}<span class="big-max">/100</span></span>
			</div>
			<div class="score-meta">
				<h1 class="domain-name">{domain}</h1>
				<p class="verdict">{verdict}</p>
			</div>
		</div>

		<!-- Rotating liner -->
		<div class="liner-bar" aria-live="polite">
			<p class="liner">{liners[currentLiner]}</p>
		</div>

		<!-- Score bars -->
		<div class="bars">
			{#each [
				{ label: 'AI Visibility', pct: Math.min(score + 5, 100) },
				{ label: 'Content Quality', pct: Math.max(score - 8, 0) },
				{ label: 'Structured Data', pct: Math.max(score - 15, 0) },
				{ label: 'Citation Readiness', pct: Math.max(score - 10, 0) },
			] as bar}
				<div class="bar-row">
					<div class="bar-label">
						<span>{bar.label}</span>
						<span class="bar-pct">{bar.pct}%</span>
					</div>
					<div class="bar-track">
						<div
							class="bar-fill"
							style="width: {bar.pct}%; background: {bar.pct >= 70 ? '#22c55e' : bar.pct >= 50 ? '#f59e0b' : '#ef4444'};"
						></div>
					</div>
				</div>
			{/each}
		</div>

		<!-- CTA -->
		<div class="cta-section">
			<h2 class="cta-title">Think you can do better?</h2>
			<p class="cta-desc">Scan your own site. It's free. It's brutally honest. It's pretty... pretty... humbling.</p>
			<div class="cta-actions">
				<a href="https://app.tenantiq.app/seo" class="cta-btn primary">
					Scan My Site (I Regret Nothing)
				</a>
				<button class="cta-btn secondary" class:copied onclick={copyLink}>
					{copied ? 'Copied!' : 'Copy Link'}
				</button>
			</div>
		</div>

		<!-- Footer -->
		<div class="report-footer">
			<span>Powered by <strong>TenantIQ</strong> — AI-Powered Security & SEO</span>
		</div>
	</div>
</div>

<style>
	.report-page {
		min-height: 100vh;
		background: #060b0f;
		display: flex;
		align-items: center;
		justify-content: center;
		padding: 2rem 1rem;
		font-family: system-ui, -apple-system, sans-serif;
		color: #f1f5f9;
	}

	.report-card {
		width: 100%;
		max-width: 560px;
		background: rgba(255,255,255,0.03);
		border: 1px solid rgba(255,255,255,0.08);
		border-radius: 24px;
		padding: 32px;
		animation: cardIn 0.5s cubic-bezier(0.16, 1, 0.3, 1);
	}
	@keyframes cardIn {
		from { opacity: 0; transform: translateY(20px) scale(0.97); }
		to { opacity: 1; transform: translateY(0) scale(1); }
	}

	.report-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: 32px;
		padding-bottom: 16px;
		border-bottom: 1px solid rgba(255,255,255,0.06);
	}
	.brand {
		display: flex;
		align-items: center;
		gap: 8px;
		font-size: 13px;
		font-weight: 600;
		color: #94a3b8;
	}
	.brand svg { color: #ef4444; }
	.report-date { font-size: 12px; color: #64748b; }

	/* Score */
	.score-section {
		display: flex;
		align-items: center;
		gap: 24px;
		margin-bottom: 24px;
	}
	.big-ring {
		width: 100px;
		height: 100px;
		border-radius: 50%;
		border: 4px solid var(--ring-color);
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		flex-shrink: 0;
		background: rgba(255,255,255,0.02);
	}
	.big-grade { font-size: 28px; font-weight: 800; line-height: 1; }
	.big-score { font-size: 14px; color: #94a3b8; font-weight: 600; }
	.big-max { font-size: 11px; color: #64748b; }
	.domain-name { font-size: 1.5rem; font-weight: 700; margin-bottom: 6px; }
	.verdict { font-size: 1rem; color: #f59e0b; font-style: italic; line-height: 1.5; }

	/* Liner */
	.liner-bar {
		text-align: center;
		padding: 16px;
		background: rgba(239,68,68,0.06);
		border: 1px solid rgba(239,68,68,0.12);
		border-radius: 14px;
		margin-bottom: 28px;
		min-height: 56px;
		display: flex;
		align-items: center;
		justify-content: center;
	}
	.liner {
		font-size: 0.9rem;
		color: #f59e0b;
		font-style: italic;
		animation: fadeSwap 3.5s ease-in-out infinite;
	}
	@keyframes fadeSwap {
		0% { opacity: 0; transform: translateY(4px); }
		10% { opacity: 1; transform: translateY(0); }
		90% { opacity: 1; transform: translateY(0); }
		100% { opacity: 0; transform: translateY(-4px); }
	}

	/* Bars */
	.bars {
		display: flex;
		flex-direction: column;
		gap: 14px;
		margin-bottom: 32px;
	}
	.bar-label {
		display: flex;
		justify-content: space-between;
		font-size: 13px;
		color: #94a3b8;
		margin-bottom: 6px;
	}
	.bar-pct { font-weight: 700; color: #f1f5f9; }
	.bar-track {
		height: 8px;
		background: rgba(255,255,255,0.06);
		border-radius: 4px;
		overflow: hidden;
	}
	.bar-fill {
		height: 100%;
		border-radius: 4px;
		transition: width 1s cubic-bezier(0.16, 1, 0.3, 1);
	}

	/* CTA */
	.cta-section {
		text-align: center;
		padding: 24px;
		background: rgba(239,68,68,0.04);
		border: 1px solid rgba(239,68,68,0.1);
		border-radius: 16px;
		margin-bottom: 24px;
	}
	.cta-title { font-size: 1.25rem; font-weight: 700; margin-bottom: 8px; }
	.cta-desc { font-size: 0.9rem; color: #94a3b8; margin-bottom: 20px; line-height: 1.5; }
	.cta-actions { display: flex; gap: 10px; justify-content: center; flex-wrap: wrap; }
	.cta-btn {
		padding: 12px 24px;
		border-radius: 12px;
		font-size: 14px;
		font-weight: 600;
		cursor: pointer;
		border: none;
		text-decoration: none;
		transition: all 0.2s ease;
	}
	.cta-btn.primary {
		background: linear-gradient(135deg, #ef4444, #dc2626);
		color: white;
	}
	.cta-btn.primary:hover { transform: translateY(-2px); box-shadow: 0 8px 24px rgba(239,68,68,0.35); }
	.cta-btn.secondary {
		background: rgba(255,255,255,0.06);
		color: #94a3b8;
		border: 1px solid rgba(255,255,255,0.1);
	}
	.cta-btn.secondary:hover { background: rgba(255,255,255,0.1); color: white; }
	.cta-btn.secondary.copied { background: #22c55e; color: white; border-color: #22c55e; }

	.report-footer {
		text-align: center;
		font-size: 12px;
		color: #64748b;
	}
	.report-footer strong { color: #94a3b8; }

	@media (max-width: 480px) {
		.report-card { padding: 20px; }
		.score-section { flex-direction: column; text-align: center; }
		.domain-name { font-size: 1.25rem; }
	}
</style>
