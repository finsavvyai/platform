<script lang="ts">
	import { api } from '$api/client';
	import { toasts } from '$stores/toast';
	import { copyToClipboard } from '$utils/export';

	// ─── State ────────────────────────────────────────────────────────────────
	type Tab = 'simulator' | 'battle' | 'timeline' | 'autofix' | 'threads';
	let activeTab = $state<Tab>('simulator');

	// Simulator state
	let simDomain = $state('');
	let simPrompt = $state('');
	let simAgent = $state('chatgpt');
	let simulating = $state(false);
	let simResult = $state<{
		agent: string; prompt: string; response: string;
		mentioned: boolean; confidence: string;
		factors: { hasJsonLd: boolean; hasFaq: boolean; contentScore: number; structuredDataScore: number };
	} | null>(null);

	// Battle state
	let battleDomain = $state('');
	let battleCompetitor = $state('');
	let battling = $state(false);
	let battleResult = $state<{
		domain: string; competitor: string; yourTotal: number; theirTotal: number;
		winner: string; yourWins: number; theirWins: number; verdict: string;
		comparison: Array<{ category: string; yours: number; theirs: number; winner: string; diff: number }>;
	} | null>(null);

	// Timeline state
	let tlDomain = $state('');
	let tlLoading = $state(false);
	let tlData = $state<{
		domain: string; trend: string; totalAudits: number;
		points: Array<{ date: number; overall: number; aiVisibility: number; content: number; structuredData: number; citation: number }>;
	} | null>(null);

	// Autofix state
	let fixDomain = $state('');
	let fixBrand = $state('');
	let fixLoading = $state(false);
	type FixResult = { id: string; type: string; code: string; instructions: string };
	let fixResult = $state<FixResult | null>(null);
	let fixCopied = $state(false);

	// Thread generator state
	let threadDomain = $state('');
	let threadScore = $state(62);
	let threadCritical = $state(3);
	let threadPlatform = $state<'twitter' | 'linkedin'>('twitter');
	let threadGenerating = $state(false);
	let threadResult = $state<{ tweets?: string[]; post?: string } | null>(null);
	let threadCopied = $state(false);

	// ─── Actions ──────────────────────────────────────────────────────────────
	const agents = [
		{ id: 'chatgpt', name: 'ChatGPT', color: '#10a37f' },
		{ id: 'claude', name: 'Claude', color: '#d97706' },
		{ id: 'perplexity', name: 'Perplexity', color: '#2563eb' },
		{ id: 'gemini', name: 'Gemini', color: '#8b5cf6' },
	];

	const promptSuggestions = [
		'What is [brand] and what do they do?',
		'What are the best tools for [industry]?',
		'How does [brand] compare to competitors?',
		'What problems does [brand] solve?',
	];

	async function runSimulation() {
		if (!simDomain.trim() || !simPrompt.trim()) { toasts.error('Enter a domain and prompt'); return; }
		simulating = true;
		try {
			const res = await api.post<{ simulation: typeof simResult }>('/ai-seo/simulate', {
				domain: simDomain.trim(), prompt: simPrompt.trim(), agent: simAgent,
			});
			simResult = res.simulation;
		} catch (e) { toasts.error(e instanceof Error ? e.message : 'Simulation failed'); }
		finally { simulating = false; }
	}

	async function runBattle() {
		if (!battleDomain.trim() || !battleCompetitor.trim()) { toasts.error('Enter both domains'); return; }
		battling = true;
		try {
			const res = await api.post<{ battle: typeof battleResult }>('/ai-seo/competitor-battle', {
				domain: battleDomain.trim(), competitor: battleCompetitor.trim(),
			});
			battleResult = res.battle;
		} catch (e) { toasts.error(e instanceof Error ? e.message : 'Battle failed'); }
		finally { battling = false; }
	}

	async function loadTimeline() {
		if (!tlDomain.trim()) { toasts.error('Enter a domain'); return; }
		tlLoading = true;
		try {
			const res = await api.get<{ timeline: typeof tlData }>(`/ai-seo/timeline?domain=${encodeURIComponent(tlDomain.trim())}`);
			tlData = res.timeline;
			if (tlData && tlData.points.length === 0) toasts.info('No audit history yet — run your first audit');
		} catch (e) { toasts.error(e instanceof Error ? e.message : 'Failed to load timeline'); }
		finally { tlLoading = false; }
	}

	async function generateFix(fixType: string) {
		if (!fixDomain.trim()) { toasts.error('Enter a domain'); return; }
		fixLoading = true;
		fixResult = null;
		try {
			const res = await api.post<{ fix: FixResult | null }>('/ai-seo/autofix', {
				domain: fixDomain.trim(), fixType, brandName: fixBrand.trim() || undefined,
			});
			fixResult = res.fix;
			toasts.success(`${res.fix?.type} generated`);
		} catch (e) { toasts.error(e instanceof Error ? e.message : 'Fix generation failed'); }
		finally { fixLoading = false; }
	}

	async function copyFix() {
		if (!fixResult) return;
		const ok = await copyToClipboard(fixResult.code);
		if (ok) { fixCopied = true; toasts.success('Code copied'); setTimeout(() => fixCopied = false, 2000); }
	}

	async function generateThread() {
		if (!threadDomain.trim()) { toasts.error('Enter a domain'); return; }
		threadGenerating = true;
		threadResult = null;
		try {
			const res = await api.post<{ thread: typeof threadResult }>('/ai-seo/thread/generate', {
				domain: threadDomain.trim(), score: threadScore, criticalCount: threadCritical,
				platform: threadPlatform, tone: 'larry',
			});
			threadResult = res.thread;
			toasts.success(`${threadPlatform === 'twitter' ? 'Thread' : 'Post'} generated`);
		} catch (e) { toasts.error(e instanceof Error ? e.message : 'Generation failed'); }
		finally { threadGenerating = false; }
	}

	async function copyThread() {
		if (!threadResult) return;
		const text = threadResult.tweets ? threadResult.tweets.join('\n\n---\n\n') : (threadResult.post ?? '');
		const ok = await copyToClipboard(text);
		if (ok) { threadCopied = true; toasts.success('Thread copied'); setTimeout(() => threadCopied = false, 2000); }
	}

	function scoreColor(s: number): string {
		return s >= 80 ? 'var(--color-success)' : s >= 60 ? 'var(--color-warning)' : 'var(--color-danger)';
	}

	function fmtDate(ts: number): string {
		return new Date(ts * 1000).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
	}
</script>

<svelte:head><title>AI SEO Lab | TenantIQ</title></svelte:head>

<div class="lab-page">
	<!-- Header -->
	<div class="lab-header animate-fade-up">
		<div class="lab-icon">
			<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M9.75 3.104v5.714a2.25 2.25 0 01-.659 1.591L5 14.5M9.75 3.104c-.251.023-.501.05-.75.082m.75-.082a24.301 24.301 0 014.5 0m0 0v5.714c0 .597.237 1.17.659 1.591L19.8 15.3M14.25 3.104c.251.023.501.05.75.082M19.8 15.3l-1.57.393A9.065 9.065 0 0112 15a9.065 9.065 0 00-6.23.693L5 14.5m14.8.8l1.402 5.607a.75.75 0 01-.718.957H3.516a.75.75 0 01-.718-.957L4.2 15.3"/></svg>
		</div>
		<div>
			<h1 class="lab-title">AI SEO Lab</h1>
			<p class="lab-desc">Advanced tools that no other SEO platform offers</p>
		</div>
	</div>

	<!-- Tab navigation -->
	<div class="tab-nav animate-fade-up delay-1">
		{#each [
			{ id: 'simulator', label: 'AI Simulator', icon: '🤖', desc: 'Test how AI sees you' },
			{ id: 'battle', label: 'Battle Mode', icon: '⚔️', desc: 'vs Competitors' },
			{ id: 'timeline', label: 'Score Timeline', icon: '📈', desc: 'Track progress' },
			{ id: 'autofix', label: 'Auto-Fix', icon: '🔧', desc: 'One-click fixes' },
		{ id: 'threads', label: 'Thread Gen', icon: '🧵', desc: 'Viral threads' },
		] as tab}
			<button
				class="tab-card"
				class:active={activeTab === tab.id}
				onclick={() => activeTab = tab.id as Tab}
			>
				<span class="tab-icon">{tab.icon}</span>
				<span class="tab-label">{tab.label}</span>
				<span class="tab-desc">{tab.desc}</span>
			</button>
		{/each}
	</div>

	<!-- ═══ AI SIMULATOR ═══ -->
	{#if activeTab === 'simulator'}
		<div class="panel animate-fade-up delay-2">
			<div class="panel-header">
				<h2 class="panel-title">AI Agent Simulator</h2>
				<p class="panel-sub">See exactly how ChatGPT, Claude, Perplexity & Gemini would answer questions about your brand</p>
			</div>

			<!-- Agent selector -->
			<div class="agent-grid">
				{#each agents as a}
					<button class="agent-btn" class:active={simAgent === a.id} onclick={() => simAgent = a.id}
						style="--agent-color: {a.color};">
						<span class="agent-dot"></span>
						<span class="agent-name">{a.name}</span>
					</button>
				{/each}
			</div>

			<!-- Inputs -->
			<div class="sim-inputs">
				<div class="sim-field">
					<label for="sim-domain" class="field-label">Your domain</label>
					<input id="sim-domain" type="text" bind:value={simDomain} placeholder="yoursite.com" class="field-input" />
				</div>
				<div class="sim-field flex-1">
					<label for="sim-prompt" class="field-label">Ask the AI agent</label>
					<input id="sim-prompt" type="text" bind:value={simPrompt} placeholder="What is [your brand] and what do they do?"
						class="field-input" onkeydown={(e) => { if (e.key === 'Enter') runSimulation(); }} />
				</div>
				<div class="sim-field">
					<span class="field-label opacity-0" aria-hidden="true">Go</span>
					<button class="action-btn" onclick={runSimulation} disabled={simulating}>
						{simulating ? 'Simulating...' : 'Simulate'}
					</button>
				</div>
			</div>

			<!-- Prompt suggestions -->
			<div class="prompt-suggestions">
				{#each promptSuggestions as p}
					<button class="prompt-pill" onclick={() => { simPrompt = p; }}>{p}</button>
				{/each}
			</div>

			<!-- Result -->
			{#if simulating}
				<div class="sim-result-skeleton">
					<div class="skel-bar"></div>
					<div class="skel-bar w75"></div>
					<div class="skel-bar w50"></div>
				</div>
			{:else if simResult}
				<div class="sim-result" class:mentioned={simResult.mentioned} class:not-mentioned={!simResult.mentioned}>
					<div class="sim-result-header">
						<div class="sim-agent-badge" style="--agent-color: {agents.find(a => a.id === simResult?.agent)?.color ?? '#666'};">
							{simResult.agent === 'chatgpt' ? 'ChatGPT' : simResult.agent === 'claude' ? 'Claude' : simResult.agent === 'perplexity' ? 'Perplexity' : 'Gemini'}
						</div>
						<div class="sim-verdict" class:positive={simResult.mentioned} class:negative={!simResult.mentioned}>
							{simResult.mentioned ? '✓ Your brand would be mentioned' : '✗ Your brand would NOT be mentioned'}
						</div>
						<span class="confidence-badge conf-{simResult.confidence}">{simResult.confidence} confidence</span>
					</div>
					<div class="sim-response">{@html simResult.response.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>').replace(/\n/g, '<br/>')}</div>
					<div class="sim-factors">
						<span class="factor" class:pass={simResult.factors.hasJsonLd} class:fail={!simResult.factors.hasJsonLd}>
							{simResult.factors.hasJsonLd ? '✓' : '✗'} JSON-LD
						</span>
						<span class="factor" class:pass={simResult.factors.hasFaq} class:fail={!simResult.factors.hasFaq}>
							{simResult.factors.hasFaq ? '✓' : '✗'} FAQ Schema
						</span>
						<span class="factor" class:pass={simResult.factors.contentScore >= 60} class:fail={simResult.factors.contentScore < 60}>
							Content: {simResult.factors.contentScore}/100
						</span>
						<span class="factor" class:pass={simResult.factors.structuredDataScore >= 60} class:fail={simResult.factors.structuredDataScore < 60}>
							Schema: {simResult.factors.structuredDataScore}/100
						</span>
					</div>
				</div>
			{/if}
		</div>

	<!-- ═══ BATTLE MODE ═══ -->
	{:else if activeTab === 'battle'}
		<div class="panel animate-fade-up delay-2">
			<div class="panel-header">
				<h2 class="panel-title">Competitor Battle Mode</h2>
				<p class="panel-sub">Head-to-head AI readiness comparison — see who AI agents prefer</p>
			</div>

			<div class="battle-inputs">
				<div class="battle-field">
					<label for="battle-domain" class="field-label">Your domain</label>
					<input id="battle-domain" type="text" bind:value={battleDomain} placeholder="yoursite.com" class="field-input" />
				</div>
				<div class="battle-vs">VS</div>
				<div class="battle-field">
					<label for="battle-competitor" class="field-label">Competitor</label>
					<input id="battle-competitor" type="text" bind:value={battleCompetitor} placeholder="competitor.com" class="field-input"
						onkeydown={(e) => { if (e.key === 'Enter') runBattle(); }} />
				</div>
				<div class="battle-field">
					<span class="field-label opacity-0" aria-hidden="true">Go</span>
					<button class="action-btn battle-go" onclick={runBattle} disabled={battling}>
						{battling ? 'Analyzing...' : 'Battle!'}
					</button>
				</div>
			</div>

			{#if battling}
				<div class="battle-skeleton">
					{#each Array(5) as _, i}
						<div class="skel-row" style="animation-delay: {i * 100}ms;"><div class="skel-bar"></div></div>
					{/each}
				</div>
			{:else if battleResult}
				<!-- Winner banner -->
				<div class="battle-winner" class:you-win={battleResult.winner === battleResult.domain} class:they-win={battleResult.winner === battleResult.competitor}>
					<div class="winner-scores">
						<div class="winner-side you">
							<span class="winner-score" style="color: {scoreColor(battleResult.yourTotal)};">{battleResult.yourTotal}</span>
							<span class="winner-domain">{battleResult.domain}</span>
						</div>
						<div class="winner-badge">
							{battleResult.yourWins > battleResult.theirWins ? '🏆' : battleResult.yourWins < battleResult.theirWins ? '😤' : '🤝'}
						</div>
						<div class="winner-side them">
							<span class="winner-score" style="color: {scoreColor(battleResult.theirTotal)};">{battleResult.theirTotal}</span>
							<span class="winner-domain">{battleResult.competitor}</span>
						</div>
					</div>
					<p class="winner-verdict">{battleResult.verdict}</p>
				</div>

				<!-- Category breakdown -->
				<div class="battle-categories">
					{#each battleResult.comparison as cat, i}
						<div class="battle-row animate-fade-up" style="animation-delay: {i * 80}ms;">
							<span class="battle-cat">{cat.category}</span>
							<div class="battle-bars">
								<div class="bar-track yours">
									<div class="bar-fill" style="width: {cat.yours}%; background: {cat.winner === 'you' ? 'var(--color-primary)' : 'var(--color-text-tertiary)'};">{cat.yours}</div>
								</div>
								<span class="battle-winner-icon">{cat.winner === 'you' ? '◀' : cat.winner === 'them' ? '▶' : '='}</span>
								<div class="bar-track theirs">
									<div class="bar-fill right" style="width: {cat.theirs}%; background: {cat.winner === 'them' ? 'var(--color-danger)' : 'var(--color-text-tertiary)'};">{cat.theirs}</div>
								</div>
							</div>
						</div>
					{/each}
				</div>
			{/if}
		</div>

	<!-- ═══ TIMELINE ═══ -->
	{:else if activeTab === 'timeline'}
		<div class="panel animate-fade-up delay-2">
			<div class="panel-header">
				<h2 class="panel-title">Score Timeline</h2>
				<p class="panel-sub">Track your AI readiness improvement over time</p>
			</div>

			<div class="tl-input-row">
				<input type="text" bind:value={tlDomain} placeholder="yoursite.com" class="field-input"
					onkeydown={(e) => { if (e.key === 'Enter') loadTimeline(); }} />
				<button class="action-btn" onclick={loadTimeline} disabled={tlLoading}>
					{tlLoading ? 'Loading...' : 'Load History'}
				</button>
			</div>

			{#if tlData && tlData.points.length > 0}
				<div class="tl-header">
					<div class="tl-trend" class:up={tlData.trend === 'up'} class:down={tlData.trend === 'down'}>
						{tlData.trend === 'up' ? '↑ Improving' : tlData.trend === 'down' ? '↓ Declining' : '→ Stable'}
					</div>
					<span class="tl-count">{tlData.totalAudits} audits</span>
				</div>

				<!-- ASCII-style sparkline chart -->
				<div class="tl-chart">
					<div class="tl-y-axis">
						<span>100</span><span>75</span><span>50</span><span>25</span><span>0</span>
					</div>
					<div class="tl-bars">
						{#each tlData.points as pt, i}
							<div class="tl-bar-col" style="animation-delay: {i * 60}ms;">
								<div class="tl-bar animate-grow-up" style="height: {pt.overall}%; background: {scoreColor(pt.overall)};"></div>
								<span class="tl-bar-label">{fmtDate(pt.date as number)}</span>
								<span class="tl-bar-value" style="color: {scoreColor(pt.overall)};">{pt.overall}</span>
							</div>
						{/each}
					</div>
				</div>

				<!-- Breakdown table -->
				<div class="tl-table">
					<div class="tl-table-header">
						<span>Date</span><span>Overall</span><span>Visibility</span><span>Content</span><span>Schema</span><span>Citation</span>
					</div>
					{#each tlData.points as pt}
						<div class="tl-table-row">
							<span>{fmtDate(pt.date as number)}</span>
							<span style="color: {scoreColor(pt.overall)}; font-weight: 700;">{pt.overall}</span>
							<span style="color: {scoreColor(pt.aiVisibility)};">{pt.aiVisibility}</span>
							<span style="color: {scoreColor(pt.content)};">{pt.content}</span>
							<span style="color: {scoreColor(pt.structuredData)};">{pt.structuredData}</span>
							<span style="color: {scoreColor(pt.citation)};">{pt.citation}</span>
						</div>
					{/each}
				</div>
			{:else if tlData && tlData.points.length === 0}
				<div class="empty-state">
					<span class="empty-icon">📊</span>
					<p class="empty-msg">No audit history for this domain yet</p>
					<a href="/seo" class="empty-link">Run your first audit →</a>
				</div>
			{/if}
		</div>

	<!-- ═══ AUTO-FIX ═══ -->
	{:else if activeTab === 'autofix'}
		<div class="panel animate-fade-up delay-2">
			<div class="panel-header">
				<h2 class="panel-title">Auto-Fix Engine</h2>
				<p class="panel-sub">Generate production-ready code to fix your AI visibility issues in one click</p>
			</div>

			<div class="fix-inputs">
				<div class="fix-field">
					<label for="fix-domain" class="field-label">Domain</label>
					<input id="fix-domain" type="text" bind:value={fixDomain} placeholder="yoursite.com" class="field-input" />
				</div>
				<div class="fix-field">
					<label for="fix-brand" class="field-label">Brand name <span class="text-[var(--color-text-tertiary)]">(optional)</span></label>
					<input id="fix-brand" type="text" bind:value={fixBrand} placeholder="Your Brand" class="field-input" />
				</div>
			</div>

			<!-- Fix type cards -->
			<div class="fix-grid">
				{#each [
					{ type: 'json_ld', icon: '🏷', title: 'JSON-LD Schema', desc: 'Organization structured data — the #1 fix for AI visibility', impact: 'critical' },
					{ type: 'faq_schema', icon: '❓', title: 'FAQ Schema', desc: 'Structured Q&A that AI agents directly cite in answers', impact: 'critical' },
					{ type: 'meta_tags', icon: '📝', title: 'AI-Optimized Meta Tags', desc: 'OpenGraph, max-snippet, canonical — let AI extract your content', impact: 'high' },
					{ type: 'robots_ai', icon: '🤖', title: 'AI-Friendly robots.txt', desc: 'Unblock GPTBot, ClaudeBot, PerplexityBot from crawling your site', impact: 'high' },
				] as fix}
					<button class="fix-card" onclick={() => generateFix(fix.type)} disabled={fixLoading || !fixDomain.trim()}>
						<div class="fix-card-top">
							<span class="fix-icon">{fix.icon}</span>
							<span class="fix-impact" class:critical={fix.impact === 'critical'} class:high={fix.impact === 'high'}>{fix.impact}</span>
						</div>
						<p class="fix-title">{fix.title}</p>
						<p class="fix-desc">{fix.desc}</p>
						<span class="fix-generate">
							{fixLoading ? 'Generating...' : 'Generate →'}
						</span>
					</button>
				{/each}
			</div>

			<!-- Generated fix output -->
			{#if fixResult}
				<div class="fix-output animate-fade-up">
					<div class="fix-output-header">
						<h3 class="fix-output-title">{fixResult.type}</h3>
						<button class="copy-btn" class:copied={fixCopied} onclick={copyFix}>
							{fixCopied ? '✓ Copied' : 'Copy code'}
						</button>
					</div>
					<pre class="fix-code"><code>{fixResult.code}</code></pre>
					<div class="fix-instructions">
						<h4 class="fix-inst-title">How to deploy</h4>
						<p class="fix-inst-text">{@html fixResult.instructions.replace(/\n/g, '<br/>')}</p>
					</div>
				</div>
			{/if}
		</div>
	{:else if activeTab === 'threads'}
		<!-- ─── Thread Generator ─── -->
		<div class="panel animate-fade-up">
			<div class="panel-header">
				<h2 class="panel-title">Viral Thread Generator</h2>
				<p class="panel-sub">Generate ready-to-post Twitter threads and LinkedIn posts with Larry David energy</p>
			</div>

			<div style="display: flex; gap: 8px; margin-bottom: 16px;">
				<div style="flex: 1;">
					<span class="field-label">Domain</span>
					<input class="field-input" bind:value={threadDomain} placeholder="example.com" />
				</div>
				<div style="width: 100px;">
					<span class="field-label">Score</span>
					<input class="field-input" type="number" min="0" max="100" bind:value={threadScore} />
				</div>
				<div style="width: 100px;">
					<span class="field-label">Criticals</span>
					<input class="field-input" type="number" min="0" bind:value={threadCritical} />
				</div>
			</div>

			<div style="display: flex; gap: 8px; margin-bottom: 20px; align-items: end;">
				<div style="display: flex; gap: 6px;">
					{#each [
						{ id: 'twitter', label: 'X Thread', icon: '🧵' },
						{ id: 'linkedin', label: 'LinkedIn Post', icon: '💼' },
					] as p}
						<button
							class="agent-btn"
							class:active={threadPlatform === p.id}
							style="--agent-color: {p.id === 'twitter' ? '#000' : '#0A66C2'}"
							onclick={() => threadPlatform = p.id as 'twitter' | 'linkedin'}
						>
							<span>{p.icon}</span>
							<span>{p.label}</span>
						</button>
					{/each}
				</div>
				<button class="action-btn" onclick={generateThread} disabled={threadGenerating} style="margin-left: auto;">
					{threadGenerating ? 'Generating...' : 'Generate Thread'}
				</button>
			</div>

			{#if threadResult}
				<div class="thread-output">
					<div class="thread-header">
						<span class="thread-badge" class:twitter={threadPlatform === 'twitter'} class:linkedin={threadPlatform === 'linkedin'}>
							{threadPlatform === 'twitter' ? 'X Thread' : 'LinkedIn Post'}
						</span>
						<button class="copy-btn" class:copied={threadCopied} onclick={copyThread}>
							{threadCopied ? '✓ Copied' : 'Copy all'}
						</button>
					</div>
					{#if threadResult.tweets}
						{#each threadResult.tweets as tweet, i}
							<div class="thread-tweet">
								<span class="tweet-num">{i + 1}/{threadResult.tweets.length}</span>
								<p class="tweet-text">{tweet}</p>
							</div>
						{/each}
					{:else if threadResult.post}
						<div class="thread-tweet lp">
							<p class="tweet-text">{threadResult.post}</p>
						</div>
					{/if}
				</div>
			{/if}
		</div>
	{/if}
</div>

<style>
	.lab-page { max-width: 960px; }

	/* Header */
	.lab-header { display: flex; align-items: center; gap: 14px; margin-bottom: 24px; }
	.lab-icon {
		width: 44px; height: 44px; border-radius: 14px; display: flex; align-items: center; justify-content: center;
		background: linear-gradient(135deg, rgba(124,58,237,0.1), rgba(37,99,235,0.1)); color: var(--color-primary);
	}
	.lab-title { font-size: 22px; font-weight: 700; color: var(--color-text); letter-spacing: -0.02em; }
	.lab-desc { font-size: 13px; color: var(--color-text-secondary); margin-top: 1px; }

	/* Tab nav cards */
	.tab-nav { display: grid; grid-template-columns: repeat(5, 1fr); gap: 8px; margin-bottom: 20px; }
	@media (max-width: 640px) { .tab-nav { grid-template-columns: repeat(2, 1fr); } }
	.tab-card {
		padding: 14px 12px; border-radius: 14px; border: 1px solid var(--color-border); background: var(--color-surface);
		text-align: center; cursor: pointer; transition: all 0.2s ease; display: flex; flex-direction: column; align-items: center; gap: 3px;
	}
	.tab-card:hover { border-color: var(--color-border-strong); transform: translateY(-1px); }
	.tab-card.active { border-color: var(--color-primary); background: rgba(0,122,255,0.04); box-shadow: 0 0 0 1px var(--color-primary); }
	.tab-icon { font-size: 22px; }
	.tab-label { font-size: 13px; font-weight: 700; color: var(--color-text); }
	.tab-desc { font-size: 10px; color: var(--color-text-tertiary); }

	/* Panel (shared) */
	.panel { border-radius: 18px; border: 1px solid var(--color-border); background: var(--color-surface); padding: 24px; }
	.panel-header { margin-bottom: 20px; }
	.panel-title { font-size: 17px; font-weight: 700; color: var(--color-text); letter-spacing: -0.01em; }
	.panel-sub { font-size: 13px; color: var(--color-text-secondary); margin-top: 3px; }

	/* Form elements */
	.field-label { display: block; font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; color: var(--color-text-secondary); margin-bottom: 6px; }
	.field-input {
		width: 100%; height: 42px; border-radius: 10px; border: 1px solid var(--color-border); background: var(--color-bg);
		padding: 0 14px; font-size: 14px; color: var(--color-text); transition: border-color 0.15s, box-shadow 0.15s;
	}
	.field-input::placeholder { color: var(--color-text-tertiary); }
	.field-input:focus { outline: none; border-color: var(--color-primary); box-shadow: 0 0 0 3px rgba(0,122,255,0.1); }
	.action-btn {
		height: 42px; padding: 0 24px; border-radius: 10px; border: none; background: var(--color-primary); color: white;
		font-size: 14px; font-weight: 600; cursor: pointer; white-space: nowrap; transition: all 0.15s;
	}
	.action-btn:hover:not(:disabled) { filter: brightness(1.08); box-shadow: 0 4px 12px rgba(0,122,255,0.25); }
	.action-btn:disabled { opacity: 0.5; cursor: not-allowed; }

	/* ── Simulator ── */
	.agent-grid { display: flex; gap: 6px; margin-bottom: 16px; flex-wrap: wrap; }
	.agent-btn {
		display: flex; align-items: center; gap: 7px; padding: 8px 16px; border-radius: 100px;
		border: 1.5px solid var(--color-border); background: var(--color-bg); font-size: 13px; font-weight: 600;
		color: var(--color-text-secondary); cursor: pointer; transition: all 0.15s;
	}
	.agent-btn:hover { border-color: var(--agent-color); color: var(--color-text); }
	.agent-btn.active { border-color: var(--agent-color); background: var(--agent-color); color: white; }
	.agent-dot { width: 8px; height: 8px; border-radius: 50%; background: var(--agent-color); }
	.agent-btn.active .agent-dot { background: white; }
	.agent-name { line-height: 1; }

	.sim-inputs { display: flex; gap: 10px; margin-bottom: 10px; align-items: end; }
	@media (max-width: 768px) { .sim-inputs { flex-direction: column; } }
	.sim-field { min-width: 0; }
	.flex-1 { flex: 1; }

	.prompt-suggestions { display: flex; gap: 6px; flex-wrap: wrap; margin-bottom: 20px; }
	.prompt-pill {
		padding: 5px 12px; border-radius: 100px; border: 1px solid var(--color-border); background: var(--color-bg);
		font-size: 11px; color: var(--color-text-tertiary); cursor: pointer; transition: all 0.15s;
	}
	.prompt-pill:hover { border-color: var(--color-primary); color: var(--color-primary); }

	.sim-result {
		border-radius: 14px; border: 1px solid var(--color-border); padding: 20px;
		background: var(--color-bg); animation: fadeIn 0.3s ease;
	}
	.sim-result.mentioned { border-left: 3px solid var(--color-success); }
	.sim-result.not-mentioned { border-left: 3px solid var(--color-danger); }
	.sim-result-header { display: flex; align-items: center; gap: 10px; margin-bottom: 14px; flex-wrap: wrap; }
	.sim-agent-badge {
		padding: 4px 12px; border-radius: 100px; background: var(--agent-color); color: white;
		font-size: 12px; font-weight: 700;
	}
	.sim-verdict { font-size: 13px; font-weight: 700; }
	.sim-verdict.positive { color: var(--color-success); }
	.sim-verdict.negative { color: var(--color-danger); }
	.confidence-badge {
		font-size: 10px; font-weight: 600; padding: 3px 10px; border-radius: 100px; margin-left: auto;
	}
	.conf-high { background: rgba(34,197,94,0.1); color: var(--color-success); }
	.conf-medium { background: rgba(245,158,11,0.1); color: var(--color-warning); }
	.conf-low { background: rgba(239,68,68,0.1); color: var(--color-danger); }
	.sim-response { font-size: 14px; line-height: 1.7; color: var(--color-text); }
	.sim-factors {
		display: flex; gap: 8px; flex-wrap: wrap; margin-top: 14px; padding-top: 14px;
		border-top: 1px solid var(--color-border-subtle);
	}
	.factor {
		font-size: 11px; font-weight: 600; padding: 4px 10px; border-radius: 8px;
		background: var(--color-bg-tertiary); color: var(--color-text-tertiary);
	}
	.factor.pass { background: rgba(34,197,94,0.08); color: var(--color-success); }
	.factor.fail { background: rgba(239,68,68,0.08); color: var(--color-danger); }

	/* ── Battle ── */
	.battle-inputs { display: flex; gap: 10px; align-items: end; margin-bottom: 20px; }
	@media (max-width: 768px) { .battle-inputs { flex-direction: column; } }
	.battle-field { flex: 1; min-width: 0; }
	.battle-vs {
		font-size: 18px; font-weight: 900; color: var(--color-text-tertiary); padding: 0 6px;
		align-self: end; padding-bottom: 10px;
	}
	.battle-go { background: linear-gradient(135deg, #ef4444, #f97316); }
	.battle-go:hover:not(:disabled) { box-shadow: 0 4px 12px rgba(239,68,68,0.3); }

	.battle-winner {
		border-radius: 14px; padding: 24px; text-align: center; margin-bottom: 16px;
		background: linear-gradient(135deg, rgba(0,122,255,0.04), rgba(124,58,237,0.04));
		border: 1px solid var(--color-border);
	}
	.winner-scores { display: flex; align-items: center; justify-content: center; gap: 32px; margin-bottom: 12px; }
	.winner-side { text-align: center; }
	.winner-score { font-size: 40px; font-weight: 800; font-variant-numeric: tabular-nums; display: block; letter-spacing: -0.03em; }
	.winner-domain { font-size: 13px; font-weight: 600; color: var(--color-text-secondary); }
	.winner-badge { font-size: 40px; }
	.winner-verdict { font-size: 14px; font-weight: 600; color: var(--color-text-secondary); }

	.battle-categories { display: flex; flex-direction: column; gap: 8px; }
	.battle-row { display: flex; align-items: center; gap: 12px; padding: 10px 0; }
	.battle-cat { width: 100px; font-size: 12px; font-weight: 600; color: var(--color-text-secondary); flex-shrink: 0; }
	.battle-bars { flex: 1; display: flex; align-items: center; gap: 8px; }
	.bar-track { flex: 1; height: 28px; background: var(--color-bg-secondary); border-radius: 8px; overflow: hidden; position: relative; }
	.bar-fill {
		height: 100%; border-radius: 8px; display: flex; align-items: center; padding: 0 10px;
		font-size: 12px; font-weight: 700; color: white; min-width: 32px; transition: width 0.6s cubic-bezier(0.16,1,0.3,1);
	}
	.bar-fill.right { margin-left: auto; justify-content: flex-end; }
	.battle-winner-icon { font-size: 12px; color: var(--color-text-tertiary); flex-shrink: 0; width: 16px; text-align: center; }

	/* ── Timeline ── */
	.tl-input-row { display: flex; gap: 10px; margin-bottom: 20px; }
	.tl-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 16px; }
	.tl-trend { font-size: 14px; font-weight: 700; color: var(--color-text-secondary); }
	.tl-trend.up { color: var(--color-success); }
	.tl-trend.down { color: var(--color-danger); }
	.tl-count { font-size: 12px; color: var(--color-text-tertiary); }

	.tl-chart { display: flex; gap: 0; margin-bottom: 24px; }
	.tl-y-axis {
		display: flex; flex-direction: column; justify-content: space-between; padding-right: 8px;
		font-size: 10px; color: var(--color-text-tertiary); font-variant-numeric: tabular-nums;
		height: 160px; flex-shrink: 0;
	}
	.tl-bars { display: flex; gap: 4px; flex: 1; align-items: flex-end; height: 160px; overflow-x: auto; }
	.tl-bar-col { display: flex; flex-direction: column; align-items: center; flex: 1; min-width: 32px; height: 100%; justify-content: flex-end; }
	.tl-bar { border-radius: 4px 4px 0 0; min-height: 4px; width: 100%; max-width: 40px; }
	.animate-grow-up { animation: growUp 0.5s cubic-bezier(0.16,1,0.3,1) both; }
	@keyframes growUp { from { transform: scaleY(0); transform-origin: bottom; } to { transform: scaleY(1); transform-origin: bottom; } }
	.tl-bar-label { font-size: 9px; color: var(--color-text-tertiary); margin-top: 4px; white-space: nowrap; }
	.tl-bar-value { font-size: 11px; font-weight: 700; font-variant-numeric: tabular-nums; margin-bottom: 4px; }

	.tl-table { border: 1px solid var(--color-border); border-radius: 12px; overflow: hidden; }
	.tl-table-header, .tl-table-row { display: grid; grid-template-columns: 1fr repeat(5, 70px); padding: 10px 14px; gap: 8px; }
	.tl-table-header {
		background: var(--color-bg-secondary); font-size: 10px; font-weight: 700; text-transform: uppercase;
		letter-spacing: 0.06em; color: var(--color-text-tertiary); border-bottom: 1px solid var(--color-border);
	}
	.tl-table-row {
		font-size: 13px; font-variant-numeric: tabular-nums; border-bottom: 1px solid var(--color-border-subtle);
		color: var(--color-text-secondary);
	}
	.tl-table-row:last-child { border-bottom: none; }

	/* ── Auto-fix ── */
	.fix-inputs { display: flex; gap: 10px; margin-bottom: 20px; }
	@media (max-width: 640px) { .fix-inputs { flex-direction: column; } }
	.fix-field { flex: 1; }

	.fix-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 10px; margin-bottom: 20px; }
	@media (max-width: 640px) { .fix-grid { grid-template-columns: 1fr; } }
	.fix-card {
		padding: 18px; border-radius: 14px; border: 1px solid var(--color-border); background: var(--color-bg);
		text-align: left; cursor: pointer; transition: all 0.2s; display: flex; flex-direction: column; gap: 6px;
	}
	.fix-card:hover:not(:disabled) { border-color: var(--color-primary); transform: translateY(-2px); box-shadow: var(--shadow-md); }
	.fix-card:disabled { opacity: 0.5; cursor: not-allowed; }
	.fix-card-top { display: flex; align-items: center; justify-content: space-between; }
	.fix-icon { font-size: 24px; }
	.fix-impact {
		font-size: 10px; font-weight: 700; text-transform: uppercase; padding: 2px 8px; border-radius: 100px;
		background: var(--color-bg-tertiary); color: var(--color-text-tertiary);
	}
	.fix-impact.critical { background: rgba(239,68,68,0.08); color: var(--color-danger); }
	.fix-impact.high { background: rgba(245,158,11,0.08); color: var(--color-warning); }
	.fix-title { font-size: 14px; font-weight: 700; color: var(--color-text); }
	.fix-desc { font-size: 12px; color: var(--color-text-secondary); line-height: 1.5; flex: 1; }
	.fix-generate { font-size: 12px; font-weight: 600; color: var(--color-primary); margin-top: 4px; }

	.fix-output { border-radius: 14px; border: 1px solid var(--color-border); background: var(--color-bg); overflow: hidden; }
	.fix-output-header {
		display: flex; align-items: center; justify-content: space-between; padding: 14px 18px;
		border-bottom: 1px solid var(--color-border);
	}
	.fix-output-title { font-size: 14px; font-weight: 700; color: var(--color-text); }
	.copy-btn {
		padding: 6px 14px; border-radius: 8px; border: 1px solid var(--color-border); background: var(--color-surface);
		font-size: 12px; font-weight: 600; color: var(--color-text-secondary); cursor: pointer; transition: all 0.15s;
	}
	.copy-btn:hover { border-color: var(--color-primary); color: var(--color-primary); }
	.copy-btn.copied { background: var(--color-success); border-color: var(--color-success); color: white; }
	.fix-code {
		padding: 18px; font-size: 12px; line-height: 1.6; font-family: 'SF Mono','Fira Code',monospace;
		color: var(--color-text-secondary); overflow-x: auto; white-space: pre-wrap; word-break: break-all;
		max-height: 300px;
	}
	.fix-instructions { padding: 18px; border-top: 1px solid var(--color-border); background: rgba(0,122,255,0.02); }
	.fix-inst-title { font-size: 12px; font-weight: 700; color: var(--color-primary); margin-bottom: 6px; }
	.fix-inst-text { font-size: 13px; line-height: 1.6; color: var(--color-text-secondary); }

	/* ── Shared ── */
	.empty-state { text-align: center; padding: 40px 20px; }
	.empty-icon { font-size: 32px; display: block; margin-bottom: 12px; }
	.empty-msg { font-size: 14px; color: var(--color-text-secondary); }
	.empty-link { font-size: 13px; font-weight: 600; color: var(--color-primary); text-decoration: none; display: inline-block; margin-top: 8px; }

	.skel-bar { height: 16px; background: var(--color-border-subtle); border-radius: 8px; animation: pulse 1.5s ease-in-out infinite; }
	.w75 { width: 75%; }
	.w50 { width: 50%; }
	.skel-row { margin-bottom: 10px; }
	.sim-result-skeleton { display: flex; flex-direction: column; gap: 12px; padding: 20px; }
	.battle-skeleton { padding: 20px; display: flex; flex-direction: column; gap: 12px; }
	@keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
	@keyframes pulse { 0%,100% { opacity: 1; } 50% { opacity: 0.4; } }
	.opacity-0 { opacity: 0; pointer-events: none; }

	/* ── Thread Generator ── */
	.thread-output { border: 1px solid var(--color-border); border-radius: 14px; overflow: hidden; }
	.thread-header {
		display: flex; align-items: center; justify-content: space-between; padding: 12px 18px;
		border-bottom: 1px solid var(--color-border); background: var(--color-bg-secondary);
	}
	.thread-badge {
		font-size: 12px; font-weight: 700; padding: 4px 12px; border-radius: 100px;
	}
	.thread-badge.twitter { background: rgba(0,0,0,0.8); color: white; }
	.thread-badge.linkedin { background: rgba(10,102,194,0.12); color: #0A66C2; }
	.thread-tweet {
		padding: 18px; border-bottom: 1px solid var(--color-border-subtle);
		display: flex; gap: 12px; align-items: flex-start;
	}
	.thread-tweet:last-child { border-bottom: none; }
	.thread-tweet.lp { flex-direction: column; gap: 0; }
	.tweet-num {
		font-size: 11px; font-weight: 700; color: var(--color-text-tertiary);
		background: var(--color-bg-secondary); padding: 3px 8px; border-radius: 100px;
		white-space: nowrap; flex-shrink: 0;
	}
	.tweet-text { font-size: 14px; line-height: 1.6; color: var(--color-text); white-space: pre-line; }
</style>
