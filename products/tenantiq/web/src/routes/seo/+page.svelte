<script lang="ts">
	import ScoreGauge from '$lib/components/seo/ScoreGauge.svelte';
	import FindingsTable from '$lib/components/seo/FindingsTable.svelte';
	import ShareModal from '$lib/components/seo/ShareModal.svelte';
	import EmbedBadge from '$lib/components/seo/EmbedBadge.svelte';
	import ExportMenu from '$components/ui/ExportMenu.svelte';
	import { api } from '$api/client';
	import { toasts } from '$stores/toast';
	import { exportJson, copyToClipboard } from '$utils/export';

	interface Finding {
		category: string; severity: string; title: string;
		description: string; recommendation: string;
	}

	interface Suggestion {
		type: string; title: string; description: string; priority: string;
	}

	interface AuditResult {
		auditId: string;
		analysis: {
			overallScore: number; aiVisibilityScore: number;
			contentScore: number; structuredDataScore: number;
			citationScore: number; findings: Finding[];
		};
		suggestions: Suggestion[];
	}

	interface AuditHistory {
		id: string; domain: string; overall_score: number;
		ai_visibility_score: number; content_score: number;
		structured_data_score: number; citation_score: number;
		status: string; created_at: number;
	}

	let domain = $state('');
	let competitors = $state('');
	let result = $state<AuditResult | null>(null);
	let audits = $state<AuditHistory[]>([]);
	let scanning = $state(false);
	let loading = $state(true);
	let activeTab = $state<'findings' | 'suggestions'>('findings');
	let shareOpen = $state(false);

	$effect(() => { loadAudits(); });

	async function loadAudits() {
		loading = true;
		try {
			const data = await api.get<{ audits: AuditHistory[] }>('/ai-seo/audits');
			audits = data.audits;
		} catch { audits = []; }
		finally { loading = false; }
	}

	async function runAudit() {
		if (!domain.trim()) { toasts.error('Enter a domain to audit'); return; }
		scanning = true;
		try {
			const competitorList = competitors.split(',').map(c => c.trim()).filter(Boolean);
			const res = await api.post<AuditResult & { error?: string }>(
				'/ai-seo/audit', { domain: domain.trim(), competitors: competitorList }
			);
			if (res.error) { toasts.error(res.error); }
			else {
				result = res;
				toasts.success(`Audit complete — ${res.analysis.overallScore}/100`);
				loadAudits();
			}
		} catch (e) {
			toasts.error(e instanceof Error ? e.message : 'Audit failed');
		} finally { scanning = false; }
	}

	function handleExportJson() {
		if (!result) return;
		exportJson(result, { type: 'ai-seo-audit' }, 'ai-seo-audit');
		toasts.success('Audit exported');
	}

	async function handleCopyLink() {
		const ok = await copyToClipboard(window.location.href);
		if (ok) toasts.success('Link copied');
	}

	function formatDate(ts: number): string {
		return new Date(ts * 1000).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
	}

	function scoreBar(score: number): string {
		if (score >= 80) return 'var(--color-success)';
		if (score >= 60) return 'var(--color-warning)';
		return 'var(--color-danger)';
	}

	const hasResult = $derived(result !== null);
	const criticalFindings = $derived(
		result?.analysis.findings.filter(f => f.severity === 'critical').length ?? 0
	);
</script>

<svelte:head><title>AI SEO Optimizer | TenantIQ</title></svelte:head>

<div class="seo-page space-y-8">
	<!-- Header -->
	<div class="animate-fade-up flex items-start justify-between gap-4">
		<div>
			<div class="flex items-center gap-3">
				<div class="header-icon">
					<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z"/></svg>
				</div>
				<div>
					<h1 class="text-xl font-semibold tracking-tight text-[var(--color-text)]">AI SEO Optimizer</h1>
					<p class="text-[13px] text-[var(--color-text-secondary)]">Analyze AI agent discoverability across ChatGPT, Claude, Perplexity & Gemini</p>
				</div>
			</div>
		</div>
		{#if hasResult}
			<div class="header-actions">
				<a class="report-link" href="/seo/report?d={encodeURIComponent(domain)}&s={result?.analysis.overallScore ?? 0}" target="_blank">
					<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25"/></svg>
					Viral Report
				</a>
				<button class="share-trigger" onclick={() => shareOpen = true}>
					<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M7.217 10.907a2.25 2.25 0 100 2.186m0-2.186c.18.324.283.696.283 1.093s-.103.77-.283 1.093m0-2.186l9.566-5.314m-9.566 7.5l9.566 5.314m0 0a2.25 2.25 0 103.935 2.186 2.25 2.25 0 00-3.935-2.186zm0-12.814a2.25 2.25 0 103.933-2.185 2.25 2.25 0 00-3.933 2.185z"/></svg>
					Share Score
				</button>
				<ExportMenu onExportJson={handleExportJson} onCopyLink={handleCopyLink} />
			</div>
		{/if}
	</div>

	<!-- Search bar — the signature element -->
	<div class="animate-fade-up delay-1 audit-input-panel">
		<div class="input-grid">
			<div class="input-group domain-input">
				<label for="domain" class="input-label">Domain to analyze</label>
				<div class="input-with-icon">
					<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="input-icon"><path stroke-linecap="round" stroke-linejoin="round" d="M12 21a9.004 9.004 0 008.716-6.747M12 21a9.004 9.004 0 01-8.716-6.747M12 21c2.485 0 4.5-4.03 4.5-9S14.485 3 12 3m0 18c-2.485 0-4.5-4.03-4.5-9S9.515 3 12 3m0 0a8.997 8.997 0 017.843 4.582M12 3a8.997 8.997 0 00-7.843 4.582m15.686 0A11.953 11.953 0 0112 10.5c-2.998 0-5.74-1.1-7.843-2.918m15.686 0A8.959 8.959 0 0121 12c0 .778-.099 1.533-.284 2.253m0 0A17.919 17.919 0 0112 16.5c-3.162 0-6.133-.815-8.716-2.247m0 0A9.015 9.015 0 013 12c0-1.605.42-3.113 1.157-4.418"/></svg>
					<input id="domain" type="text" bind:value={domain} placeholder="example.com"
						class="audit-input"
						onkeydown={(e) => { if (e.key === 'Enter') runAudit(); }}
					/>
				</div>
			</div>
			<div class="input-group competitor-input">
				<label for="competitors" class="input-label">Competitors <span class="text-[var(--color-text-tertiary)]">(optional)</span></label>
				<input id="competitors" type="text" bind:value={competitors} placeholder="competitor1.com, competitor2.com"
					class="audit-input"
				/>
			</div>
			<div class="input-group btn-group">
				<span class="input-label opacity-0" aria-hidden="true">Analyze</span>
				<button onclick={runAudit} disabled={scanning} class="audit-btn">
					{#if scanning}
						<span class="btn-spinner"></span>
						Analyzing
					{:else}
						<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z"/></svg>
						Analyze
					{/if}
				</button>
			</div>
		</div>
	</div>

	{#if scanning}
		<!-- Skeleton loader -->
		<div class="score-grid animate-fade-up">
			<div class="hero-score-card skeleton" style="height: 200px;"></div>
			<div class="sub-scores-grid">
				{#each Array(4) as _, i}
					<div class="skeleton" style="height: 88px; border-radius: var(--radius-lg); animation-delay: {(i + 1) * 75}ms;"></div>
				{/each}
			</div>
		</div>
	{:else if result}
		<!-- Score dashboard -->
		<div class="score-grid animate-fade-up delay-1">
			<!-- Hero score -->
			<div class="hero-score-card">
				<div class="hero-score-inner">
					<ScoreGauge score={result.analysis.overallScore} label="AI Readiness" size={140} hero={true} />
					<div class="hero-meta">
						<p class="hero-domain">{domain}</p>
						<div class="hero-stats">
							<span class="hero-stat">
								<span class="stat-dot" style="background: var(--color-danger);"></span>
								{criticalFindings} critical
							</span>
							<span class="hero-stat">
								<span class="stat-dot" style="background: var(--color-warning);"></span>
								{result.analysis.findings.filter(f => f.severity === 'warning').length} warnings
							</span>
							<span class="hero-stat">
								<span class="stat-dot" style="background: var(--color-success);"></span>
								{result.analysis.findings.filter(f => f.severity === 'info').length} passed
							</span>
						</div>
					</div>
				</div>
			</div>

			<!-- Sub-scores -->
			<div class="sub-scores-grid">
				{#each [
					{ score: result.analysis.aiVisibilityScore, label: 'AI Visibility', desc: 'How well AI crawlers can access your content' },
					{ score: result.analysis.contentScore, label: 'Content Quality', desc: 'Depth, structure, and factual richness' },
					{ score: result.analysis.structuredDataScore, label: 'Structured Data', desc: 'JSON-LD, OpenGraph, and schema markup' },
					{ score: result.analysis.citationScore, label: 'Citation Ready', desc: 'Likelihood of being cited by AI agents' },
				] as metric, i}
					<div class="sub-score-card animate-fade-up" style="animation-delay: {(i + 2) * 75}ms;">
						<div class="sub-score-top">
							<span class="sub-score-label">{metric.label}</span>
							<span class="sub-score-value" style="color: {scoreBar(metric.score)};">{metric.score}</span>
						</div>
						<div class="sub-score-bar-track">
							<div class="sub-score-bar animate-fill-bar" style="width: {metric.score}%; background: {scoreBar(metric.score)};"></div>
						</div>
						<p class="sub-score-desc">{metric.desc}</p>
					</div>
				{/each}
			</div>
		</div>

		<!-- Viral share CTA -->
		<div class="share-cta animate-fade-up delay-2">
			<div class="share-cta-left">
				<div class="share-cta-badge" style="--badge-color: {scoreBar(result.analysis.overallScore)};">
					{result.analysis.overallScore >= 90 ? 'A+' : result.analysis.overallScore >= 80 ? 'A' : result.analysis.overallScore >= 70 ? 'B' : result.analysis.overallScore >= 60 ? 'C' : result.analysis.overallScore >= 50 ? 'D' : 'F'}
				</div>
				<div>
					<p class="share-cta-title">
						{result.analysis.overallScore >= 80
							? 'Flex on your competitors'
							: result.analysis.overallScore >= 50
								? 'Challenge your network'
								: 'Dare your friends to try'}
					</p>
					<p class="share-cta-desc">Generate a funny AI-powered message and share your score</p>
				</div>
			</div>
			<button class="share-cta-btn" onclick={() => shareOpen = true}>
				<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 00-2.455 2.456z"/></svg>
				Generate & Share
			</button>
		</div>

		<!-- Tabs: Findings / Suggestions -->
		<div class="animate-fade-up delay-2">
			<div class="tab-bar">
				<button class="tab-btn" class:active={activeTab === 'findings'} onclick={() => activeTab = 'findings'}>
					Issues & Recommendations
					{#if result.analysis.findings.length > 0}
						<span class="tab-count">{result.analysis.findings.length}</span>
					{/if}
				</button>
				<button class="tab-btn" class:active={activeTab === 'suggestions'} onclick={() => activeTab = 'suggestions'}>
					Content Opportunities
					{#if result.suggestions.length > 0}
						<span class="tab-count">{result.suggestions.length}</span>
					{/if}
				</button>
			</div>

			{#if activeTab === 'findings'}
				<div class="tab-content">
					<FindingsTable findings={result.analysis.findings} />
				</div>
			{:else}
				<div class="tab-content">
					<div class="suggestions-grid">
						{#each result.suggestions as suggestion, i}
							<a href="/seo/publish?type={suggestion.type}&domain={domain}"
								class="suggestion-card animate-fade-up" style="animation-delay: {i * 60}ms;">
								<div class="suggestion-top">
									<span class="suggestion-type">{suggestion.type.replace(/_/g, ' ')}</span>
									<span class="suggestion-priority" class:high={suggestion.priority === 'high'} class:medium={suggestion.priority === 'medium'}>{suggestion.priority}</span>
								</div>
								<p class="suggestion-title">{suggestion.title}</p>
								<p class="suggestion-desc">{suggestion.description}</p>
								<div class="suggestion-cta">
									<span>Generate content</span>
									<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>
								</div>
							</a>
						{/each}
					</div>
				</div>
			{/if}
		</div>

		<!-- Embeddable badge -->
		<div class="animate-fade-up delay-3">
			<EmbedBadge
				score={result.analysis.overallScore}
				{domain}
				grade={result.analysis.overallScore >= 90 ? 'A+' : result.analysis.overallScore >= 80 ? 'A' : result.analysis.overallScore >= 70 ? 'B' : result.analysis.overallScore >= 60 ? 'C' : result.analysis.overallScore >= 50 ? 'D' : 'F'}
			/>
		</div>

	{:else if !loading}
		<!-- Empty state — signature hero -->
		<div class="animate-fade-up empty-hero">
			<div class="empty-visual">
				<div class="empty-rings">
					<div class="empty-ring ring-1"></div>
					<div class="empty-ring ring-2"></div>
					<div class="empty-ring ring-3"></div>
					<div class="empty-center-icon">
						<svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z"/></svg>
					</div>
				</div>
			</div>
			<h2 class="empty-title">How do AI agents see your brand?</h2>
			<p class="empty-desc">
				Audit your website's visibility across ChatGPT, Claude, Perplexity, and Gemini.<br/>
				Get actionable insights to improve your AI discoverability score.
			</p>
			<div class="empty-dimensions">
				{#each [
					{ icon: '👁', name: 'AI Visibility', desc: 'Crawlability & access' },
					{ icon: '📝', name: 'Content Quality', desc: 'Depth & structure' },
					{ icon: '🏷', name: 'Structured Data', desc: 'Schema & markup' },
					{ icon: '💬', name: 'Citation Ready', desc: 'Reference potential' },
				] as dim}
					<div class="empty-dim-card">
						<span class="dim-icon">{dim.icon}</span>
						<span class="dim-name">{dim.name}</span>
						<span class="dim-desc">{dim.desc}</span>
					</div>
				{/each}
			</div>
		</div>
	{/if}

	<!-- Audit history -->
	{#if audits.length > 0}
		<div class="animate-fade-up delay-3 history-panel">
			<div class="history-header">
				<h3 class="history-title">Recent Audits</h3>
				<span class="history-count">{audits.length}</span>
			</div>
			<div class="history-list">
				{#each audits as audit}
					<div class="history-row">
						<div class="history-domain">
							<span class="domain-dot" style="background: {scoreBar(audit.overall_score)};"></span>
							<span class="domain-name">{audit.domain}</span>
						</div>
						<div class="history-scores">
							<div class="history-score-bar">
								<div class="score-fill animate-fill-bar" style="width: {audit.overall_score}%; background: {scoreBar(audit.overall_score)};"></div>
							</div>
							<span class="history-score-value" style="color: {scoreBar(audit.overall_score)};">{audit.overall_score}</span>
						</div>
						<span class="history-date">{formatDate(audit.created_at)}</span>
					</div>
				{/each}
			</div>
		</div>
	{/if}

	<!-- Share modal -->
	{#if result}
		<ShareModal
			open={shareOpen}
			{domain}
			score={result.analysis.overallScore}
			aiVisibility={result.analysis.aiVisibilityScore}
			contentScore={result.analysis.contentScore}
			structuredData={result.analysis.structuredDataScore}
			citationScore={result.analysis.citationScore}
			criticalCount={criticalFindings}
			onclose={() => shareOpen = false}
		/>
	{/if}
</div>

<style>
	.seo-page { max-width: 960px; }

	/* Header actions */
	.header-actions {
		display: flex;
		align-items: center;
		gap: 8px;
	}
	.share-trigger {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		padding: 8px 16px;
		border-radius: var(--radius-lg);
		border: none;
		background: linear-gradient(135deg, #7C3AED, #2563EB);
		color: white;
		font-size: 13px;
		font-weight: 600;
		cursor: pointer;
		transition: all 0.2s ease;
		white-space: nowrap;
	}
	.share-trigger:hover {
		transform: translateY(-1px);
		box-shadow: 0 4px 16px rgba(124, 58, 237, 0.4);
	}
	.report-link {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		padding: 8px 16px;
		border-radius: var(--radius-lg);
		border: 1px solid rgba(239, 68, 68, 0.3);
		background: rgba(239, 68, 68, 0.08);
		color: #ef4444;
		font-size: 13px;
		font-weight: 600;
		cursor: pointer;
		transition: all 0.2s ease;
		white-space: nowrap;
		text-decoration: none;
	}
	.report-link:hover {
		background: rgba(239, 68, 68, 0.15);
		transform: translateY(-1px);
	}

	/* Header icon */
	.header-icon {
		width: 40px;
		height: 40px;
		border-radius: var(--radius-lg);
		background: linear-gradient(135deg, rgba(0, 122, 255, 0.1), rgba(88, 86, 214, 0.1));
		display: flex;
		align-items: center;
		justify-content: center;
		color: var(--color-primary);
	}

	/* Audit input panel */
	.audit-input-panel {
		border-radius: var(--radius-xl);
		border: 1px solid var(--color-border);
		background: var(--color-surface);
		padding: 20px;
	}
	.input-grid {
		display: grid;
		grid-template-columns: 1.2fr 1fr auto;
		gap: 12px;
		align-items: end;
	}
	@media (max-width: 768px) {
		.input-grid {
			grid-template-columns: 1fr;
		}
	}
	.input-label {
		display: block;
		font-size: 11px;
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.05em;
		color: var(--color-text-secondary);
		margin-bottom: 6px;
	}
	.input-with-icon {
		position: relative;
	}
	.input-icon {
		position: absolute;
		left: 14px;
		top: 50%;
		transform: translateY(-50%);
		color: var(--color-text-tertiary);
		pointer-events: none;
	}
	.audit-input {
		width: 100%;
		height: 44px;
		border-radius: var(--radius-lg);
		border: 1px solid var(--color-border);
		background: var(--color-bg);
		padding: 0 14px;
		font-size: 14px;
		color: var(--color-text);
		transition: border-color var(--duration-fast) var(--easing), box-shadow var(--duration-fast) var(--easing);
	}
	.input-with-icon .audit-input {
		padding-left: 40px;
	}
	.audit-input::placeholder { color: var(--color-text-tertiary); }
	.audit-input:focus {
		outline: none;
		border-color: var(--color-primary);
		box-shadow: 0 0 0 3px rgba(0, 122, 255, 0.12);
	}
	.audit-btn {
		height: 44px;
		border-radius: var(--radius-lg);
		background: var(--color-primary);
		color: white;
		border: none;
		padding: 0 24px;
		font-size: 14px;
		font-weight: 600;
		cursor: pointer;
		display: inline-flex;
		align-items: center;
		gap: 8px;
		white-space: nowrap;
		transition: all var(--duration-fast) var(--easing);
	}
	.audit-btn:hover:not(:disabled) {
		filter: brightness(1.08);
		box-shadow: 0 4px 12px rgba(0, 122, 255, 0.3);
	}
	.audit-btn:disabled { opacity: 0.6; cursor: not-allowed; }
	.btn-spinner {
		width: 16px;
		height: 16px;
		border-radius: 50%;
		border: 2px solid rgba(255,255,255,0.3);
		border-top-color: white;
		animation: spin 0.6s linear infinite;
	}
	@keyframes spin { to { transform: rotate(360deg); } }

	/* Score grid */
	.score-grid {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 16px;
	}
	@media (max-width: 768px) {
		.score-grid { grid-template-columns: 1fr; }
	}

	/* Hero score card */
	.hero-score-card {
		border-radius: var(--radius-xl);
		border: 1px solid var(--color-border);
		background: var(--color-surface);
		padding: 32px;
		display: flex;
		align-items: center;
		justify-content: center;
	}
	.hero-score-inner {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 20px;
	}
	.hero-meta { text-align: center; }
	.hero-domain {
		font-size: 14px;
		font-weight: 600;
		color: var(--color-text);
		letter-spacing: -0.01em;
	}
	.hero-stats {
		display: flex;
		gap: 16px;
		margin-top: 8px;
	}
	.hero-stat {
		font-size: 12px;
		font-weight: 500;
		color: var(--color-text-secondary);
		display: flex;
		align-items: center;
		gap: 5px;
	}
	.stat-dot {
		width: 6px;
		height: 6px;
		border-radius: 50%;
		flex-shrink: 0;
	}

	/* Sub-scores */
	.sub-scores-grid {
		display: grid;
		grid-template-rows: repeat(4, 1fr);
		gap: 8px;
	}
	.sub-score-card {
		border-radius: var(--radius-lg);
		border: 1px solid var(--color-border);
		background: var(--color-surface);
		padding: 14px 16px;
		transition: border-color var(--duration-fast) var(--easing);
	}
	.sub-score-card:hover { border-color: var(--color-border-strong); }
	.sub-score-top {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: 8px;
	}
	.sub-score-label {
		font-size: 13px;
		font-weight: 600;
		color: var(--color-text);
	}
	.sub-score-value {
		font-size: 18px;
		font-weight: 700;
		font-variant-numeric: tabular-nums;
		letter-spacing: -0.02em;
	}
	.sub-score-bar-track {
		height: 4px;
		border-radius: 2px;
		background: var(--color-border-subtle);
		overflow: hidden;
	}
	.sub-score-bar {
		height: 100%;
		border-radius: 2px;
	}
	.sub-score-desc {
		font-size: 11px;
		color: var(--color-text-tertiary);
		margin-top: 6px;
	}

	/* Share CTA */
	.share-cta {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 16px;
		padding: 16px 20px;
		border-radius: var(--radius-xl);
		border: 1px solid rgba(124, 58, 237, 0.2);
		background: linear-gradient(135deg, rgba(124, 58, 237, 0.04), rgba(37, 99, 235, 0.04));
	}
	.share-cta-left {
		display: flex;
		align-items: center;
		gap: 14px;
	}
	.share-cta-badge {
		width: 44px;
		height: 44px;
		border-radius: 12px;
		background: linear-gradient(135deg, rgba(124, 58, 237, 0.12), rgba(37, 99, 235, 0.12));
		display: flex;
		align-items: center;
		justify-content: center;
		font-size: 18px;
		font-weight: 800;
		color: var(--badge-color);
		flex-shrink: 0;
	}
	.share-cta-title {
		font-size: 14px;
		font-weight: 700;
		color: var(--color-text);
		letter-spacing: -0.01em;
	}
	.share-cta-desc {
		font-size: 12px;
		color: var(--color-text-secondary);
		margin-top: 1px;
	}
	.share-cta-btn {
		display: inline-flex;
		align-items: center;
		gap: 7px;
		padding: 10px 20px;
		border-radius: 12px;
		border: none;
		background: linear-gradient(135deg, #7C3AED, #2563EB);
		color: white;
		font-size: 13px;
		font-weight: 600;
		cursor: pointer;
		transition: all 0.2s ease;
		white-space: nowrap;
	}
	.share-cta-btn:hover {
		transform: translateY(-1px);
		box-shadow: 0 4px 20px rgba(124, 58, 237, 0.4);
	}
	@media (max-width: 640px) {
		.share-cta { flex-direction: column; text-align: center; }
		.share-cta-left { flex-direction: column; }
	}

	/* Tab bar */
	.tab-bar {
		display: flex;
		gap: 0;
		border-bottom: 1px solid var(--color-border);
		margin-bottom: 0;
	}
	.tab-btn {
		padding: 12px 20px;
		font-size: 13px;
		font-weight: 600;
		color: var(--color-text-secondary);
		background: none;
		border: none;
		cursor: pointer;
		position: relative;
		display: flex;
		align-items: center;
		gap: 8px;
		transition: color var(--duration-fast) var(--easing);
	}
	.tab-btn:hover { color: var(--color-text); }
	.tab-btn.active {
		color: var(--color-text);
	}
	.tab-btn.active::after {
		content: '';
		position: absolute;
		bottom: -1px;
		left: 20px;
		right: 20px;
		height: 2px;
		background: var(--color-primary);
		border-radius: 1px;
	}
	.tab-count {
		font-size: 11px;
		font-weight: 600;
		padding: 1px 7px;
		border-radius: 100px;
		background: var(--color-bg-tertiary);
		color: var(--color-text-secondary);
	}
	.tab-content { margin-top: 16px; }

	/* Suggestions grid */
	.suggestions-grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
		gap: 12px;
	}
	.suggestion-card {
		border-radius: var(--radius-lg);
		border: 1px solid var(--color-border);
		background: var(--color-surface);
		padding: 18px;
		text-decoration: none;
		transition: all var(--duration-fast) var(--easing);
		display: flex;
		flex-direction: column;
		gap: 8px;
	}
	.suggestion-card:hover {
		border-color: var(--color-primary);
		transform: translateY(-2px);
		box-shadow: var(--shadow-md);
	}
	.suggestion-top {
		display: flex;
		justify-content: space-between;
		align-items: center;
	}
	.suggestion-type {
		font-size: 10px;
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: 0.06em;
		color: var(--color-primary);
	}
	.suggestion-priority {
		font-size: 10px;
		font-weight: 600;
		padding: 2px 7px;
		border-radius: 100px;
		background: var(--color-bg-tertiary);
		color: var(--color-text-tertiary);
	}
	.suggestion-priority.high { background: rgba(255, 59, 48, 0.08); color: var(--color-danger); }
	.suggestion-priority.medium { background: rgba(255, 149, 0, 0.08); color: var(--color-warning); }
	.suggestion-title {
		font-size: 14px;
		font-weight: 600;
		color: var(--color-text);
		line-height: 1.3;
	}
	.suggestion-desc {
		font-size: 12px;
		color: var(--color-text-secondary);
		line-height: 1.5;
		flex: 1;
	}
	.suggestion-cta {
		display: flex;
		align-items: center;
		gap: 6px;
		font-size: 12px;
		font-weight: 600;
		color: var(--color-primary);
		margin-top: 4px;
	}

	/* Empty state */
	.empty-hero {
		text-align: center;
		padding: 60px 20px;
		border-radius: var(--radius-xl);
		border: 1px solid var(--color-border);
		background: var(--color-surface);
	}
	.empty-visual {
		margin-bottom: 28px;
	}
	.empty-rings {
		position: relative;
		width: 120px;
		height: 120px;
		margin: 0 auto;
	}
	.empty-ring {
		position: absolute;
		border-radius: 50%;
		border: 1.5px solid var(--color-border);
	}
	.ring-1 { inset: 0; }
	.ring-2 { inset: 16px; border-color: var(--color-border-strong); }
	.ring-3 { inset: 32px; border-color: var(--color-primary); opacity: 0.3; }
	.empty-center-icon {
		position: absolute;
		inset: 0;
		display: flex;
		align-items: center;
		justify-content: center;
		color: var(--color-primary);
	}
	.empty-title {
		font-size: 20px;
		font-weight: 700;
		color: var(--color-text);
		letter-spacing: -0.02em;
	}
	.empty-desc {
		font-size: 14px;
		color: var(--color-text-secondary);
		margin-top: 8px;
		line-height: 1.6;
	}
	.empty-dimensions {
		display: grid;
		grid-template-columns: repeat(4, 1fr);
		gap: 12px;
		max-width: 600px;
		margin: 36px auto 0;
	}
	@media (max-width: 640px) {
		.empty-dimensions { grid-template-columns: repeat(2, 1fr); }
	}
	.empty-dim-card {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 4px;
		padding: 16px 8px;
		border-radius: var(--radius-lg);
		background: var(--color-bg-secondary);
		border: 1px solid var(--color-border-subtle);
	}
	.dim-icon { font-size: 20px; }
	.dim-name {
		font-size: 12px;
		font-weight: 600;
		color: var(--color-text);
	}
	.dim-desc {
		font-size: 10px;
		color: var(--color-text-tertiary);
	}

	/* History panel */
	.history-panel {
		border-radius: var(--radius-xl);
		border: 1px solid var(--color-border);
		background: var(--color-surface);
		overflow: hidden;
	}
	.history-header {
		padding: 14px 20px;
		border-bottom: 1px solid var(--color-border);
		display: flex;
		align-items: center;
		justify-content: space-between;
	}
	.history-title {
		font-size: 13px;
		font-weight: 600;
		color: var(--color-text);
	}
	.history-count {
		font-size: 11px;
		font-weight: 600;
		padding: 2px 8px;
		border-radius: 100px;
		background: var(--color-bg-tertiary);
		color: var(--color-text-secondary);
	}
	.history-list { display: flex; flex-direction: column; }
	.history-row {
		display: grid;
		grid-template-columns: 1fr 1fr auto;
		gap: 16px;
		align-items: center;
		padding: 12px 20px;
		border-bottom: 1px solid var(--color-border-subtle);
		transition: background var(--duration-fast) var(--easing);
	}
	.history-row:last-child { border-bottom: none; }
	.history-row:hover { background: var(--color-bg-secondary); }
	.history-domain {
		display: flex;
		align-items: center;
		gap: 10px;
	}
	.domain-dot {
		width: 8px;
		height: 8px;
		border-radius: 50%;
		flex-shrink: 0;
	}
	.domain-name {
		font-size: 13px;
		font-weight: 600;
		color: var(--color-text);
	}
	.history-scores {
		display: flex;
		align-items: center;
		gap: 10px;
	}
	.history-score-bar {
		flex: 1;
		height: 4px;
		border-radius: 2px;
		background: var(--color-border-subtle);
		overflow: hidden;
	}
	.score-fill {
		height: 100%;
		border-radius: 2px;
	}
	.history-score-value {
		font-size: 14px;
		font-weight: 700;
		font-variant-numeric: tabular-nums;
		min-width: 28px;
		text-align: right;
	}
	.history-date {
		font-size: 12px;
		color: var(--color-text-tertiary);
		white-space: nowrap;
	}
</style>
