<script lang="ts">
	import PageHeader from '$components/ui/PageHeader.svelte';
	import MetricCard from '$components/MetricCard.svelte';
	import ScoreRing from '$components/ScoreRing.svelte';
	import { api } from '$api/client';
	import { tenant } from '$stores/tenant';
	import { AlertTriangle, ExternalLink } from 'lucide-svelte';

	type Status = 'covered' | 'partial' | 'missing' | 'not-applicable';
	type Category = 'office' | 'endpoint' | 'identity' | 'cloud-apps' | 'general';
	type Severity = 'critical' | 'high' | 'medium' | 'low' | 'info';

	interface Control {
		id: string; displayName: string; category: Category;
		currentScore: number; maxScore: number;
		implementationStatus: string; status: Status;
		actionUrl: string | null; remediation: string;
	}
	interface Finding {
		id: string; severity: Severity; category: Category;
		title: string; detail: string; remediation: string;
		controlId: string; currentScore: number; maxScore: number;
	}
	interface Summary {
		totalControls: number; covered: number; partial: number; missing: number; notApplicable: number;
		byCategory: Record<Category, { covered: number; total: number; scoreEarned: number; scoreMax: number }>;
		totalScoreEarned: number; totalScoreMax: number; coverageScore: number; postureScore: number;
	}
	interface ScanResp { scannedAt: string; summary: Summary; findings: Finding[]; controls: Control[] }
	interface ErrResp { error: string }

	let loading = $state(true);
	let data = $state<ScanResp | null>(null);
	let error = $state<string | null>(null);
	let categoryFilter = $state<Category | 'all'>('all');
	let statusFilter = $state<Status | 'all'>('all');

	$effect(() => { if ($tenant.currentTenantId) load(); });

	async function load() {
		loading = true; error = null;
		try {
			const res = await api.get<ScanResp | ErrResp>('/defender/scan');
			if ('error' in res) { error = res.error; data = null; }
			else { data = res; }
		} catch (e) {
			error = e instanceof Error ? e.message : 'Failed to load Defender audit';
		} finally { loading = false; }
	}

	const filtered = $derived(
		!data ? []
			: data.controls.filter((c) =>
				(categoryFilter === 'all' || c.category === categoryFilter)
				&& (statusFilter === 'all' || c.status === statusFilter)),
	);

	const sevColor: Record<Severity, string> = { critical: 'var(--color-danger)', high: 'var(--color-warning)', medium: 'var(--color-warning)', low: 'var(--color-info)', info: 'var(--color-text-secondary)' };
	const statusColor: Record<Status, string> = { covered: 'var(--color-success)', partial: 'var(--color-warning)', missing: 'var(--color-danger)', 'not-applicable': 'var(--color-text-secondary)' };
	const catLabel: Record<Category, string> = { office: 'Office 365', endpoint: 'Endpoint', identity: 'Identity', 'cloud-apps': 'Cloud Apps', general: 'General' };
</script>

<svelte:head><title>Defender Coverage | TenantIQ</title></svelte:head>

<div class="space-y-6">
	<PageHeader title="Defender XDR Coverage" description="Defender for Office, Endpoint, Identity, Cloud Apps — control-by-control coverage from Secure Score" iconPath="M12 2.25l-8.954 4.018a1 1 0 00-.546.894v6.838c0 4.943 3.847 9.06 8.5 10 4.653-.94 8.5-5.057 8.5-10V7.162a1 1 0 00-.546-.894L12 2.25z">
		<button class="btn-secondary" onclick={load} disabled={loading}>{loading ? 'Loading…' : 'Refresh'}</button>
	</PageHeader>

	{#if loading}
		<div class="grid grid-cols-1 gap-4 sm:grid-cols-4">
			{#each Array(4) as _}<div class="h-24 animate-pulse rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)]"></div>{/each}
		</div>
	{:else if error}
		<div class="empty-state"><AlertTriangle size={32} /><h3>Could not load Defender data</h3><p>{error}</p><p class="mt-4 text-xs">Required Graph permission: <code>SecurityEvents.Read.All</code></p></div>
	{:else if data}
		<div class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
			<div class="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5 flex items-center gap-4">
				<ScoreRing score={data.summary.postureScore} size={64} strokeWidth={5} label="/100" />
				<div>
					<p class="text-sm font-semibold">Defender posture</p>
					<p class="text-xs text-[var(--color-text-secondary)]">Coverage − critical/high penalties</p>
				</div>
			</div>
			<MetricCard title="Coverage" value={`${data.summary.coverageScore}%`} subtitle="{data.summary.totalScoreEarned}/{data.summary.totalScoreMax} Secure Score points" />
			<MetricCard title="Covered" value={`${data.summary.covered}/${data.summary.totalControls}`} subtitle="Controls fully implemented" />
			<MetricCard title="Missing" value={String(data.summary.missing)} subtitle="{data.summary.partial} partial" />
		</div>

		<div class="grid grid-cols-2 gap-3 sm:grid-cols-5">
			{#each Object.entries(data.summary.byCategory) as [cat, stats]}
				{#if stats.total > 0}
					<div class="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-3">
						<p class="text-xs text-[var(--color-text-secondary)]">{catLabel[cat as Category]}</p>
						<p class="text-base font-semibold tabular-nums">{stats.covered}/{stats.total}</p>
						<p class="text-[10px] text-[var(--color-text-tertiary)]">{stats.scoreEarned}/{stats.scoreMax} pts</p>
					</div>
				{/if}
			{/each}
		</div>

		{#if data.findings.length > 0}
			<section>
				<h2 class="section-title">Findings ({data.findings.length})</h2>
				<div class="space-y-3">
					{#each data.findings.slice(0, 30) as f}
						<div class="finding" style="border-left-color: {sevColor[f.severity]};">
							<div class="finding-head">
								<span class="sev-tag" style="background: color-mix(in srgb, {sevColor[f.severity]} 15%, transparent); color: {sevColor[f.severity]};">{f.severity}</span>
								<strong>{f.title}</strong>
								<span class="finding-id">{catLabel[f.category]} · {f.currentScore}/{f.maxScore} pts</span>
							</div>
							<p class="finding-detail">{f.detail}</p>
							<p class="finding-fix"><strong>Fix:</strong> {f.remediation}</p>
						</div>
					{/each}
				</div>
			</section>
		{/if}

		<section>
			<div class="filter-bar">
				<select bind:value={categoryFilter} class="filter-select">
					<option value="all">All categories</option>
					<option value="office">Office 365</option>
					<option value="endpoint">Endpoint</option>
					<option value="identity">Identity</option>
					<option value="cloud-apps">Cloud Apps</option>
					<option value="general">General</option>
				</select>
				<select bind:value={statusFilter} class="filter-select">
					<option value="all">All statuses</option>
					<option value="covered">Covered</option>
					<option value="partial">Partial</option>
					<option value="missing">Missing</option>
					<option value="not-applicable">N/A</option>
				</select>
				<span class="filter-count">{filtered.length} of {data.controls.length}</span>
			</div>

			<div class="overflow-x-auto rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)]">
				<table class="min-w-full">
					<thead class="bg-[var(--color-bg-tertiary)]">
						<tr><th>Control</th><th>Category</th><th class="text-center">Status</th><th class="text-right">Score</th><th></th></tr>
					</thead>
					<tbody class="divide-y divide-[var(--color-border)]">
						{#each filtered as c (c.id)}
							<tr>
								<td class="text-sm">{c.displayName}</td>
								<td class="text-xs text-[var(--color-text-secondary)]">{catLabel[c.category]}</td>
								<td class="text-center"><span class="pill" style="background: color-mix(in srgb, {statusColor[c.status]} 15%, transparent); color: {statusColor[c.status]};">{c.status}</span></td>
								<td class="text-right text-xs tabular-nums">{c.currentScore}/{c.maxScore}</td>
								<td class="text-right">
									{#if c.actionUrl}
										<a href={c.actionUrl} target="_blank" rel="noopener noreferrer" class="link">Fix <ExternalLink size={11} /></a>
									{/if}
								</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
		</section>
	{/if}
</div>

<style>
	th { padding: 0.75rem 1rem; text-align: left; font-size: 0.75rem; font-weight: 500; color: var(--color-text-secondary); }
	td { padding: 0.75rem 1rem; }
	.section-title { font-size: 0.9375rem; font-weight: 600; margin: 0 0 0.75rem 0; }
	.finding { background: var(--color-surface); border: 1px solid var(--color-border); border-left: 4px solid; border-radius: 0.5rem; padding: 1rem; }
	.finding-head { display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.5rem; flex-wrap: wrap; }
	.sev-tag { padding: 0.125rem 0.5rem; border-radius: 0.25rem; font-size: 0.6875rem; font-weight: 600; text-transform: uppercase; }
	.finding-id { font-family: 'SF Mono', Menlo, monospace; font-size: 0.6875rem; color: var(--color-text-tertiary); margin-left: auto; }
	.finding-detail, .finding-fix { margin: 0.25rem 0; font-size: 0.8125rem; line-height: 1.5; color: var(--color-text); }
	.finding-fix { color: var(--color-text-secondary); }
	.filter-bar { display: flex; gap: 0.5rem; align-items: center; margin-bottom: 0.75rem; flex-wrap: wrap; }
	.filter-select { background: var(--color-surface); border: 1px solid var(--color-border); border-radius: 0.5rem; padding: 0.375rem 0.75rem; font-size: 0.8125rem; color: var(--color-text); min-height: 36px; }
	.filter-count { font-size: 0.75rem; color: var(--color-text-tertiary); margin-left: auto; }
	.pill { font-size: 0.6875rem; padding: 0.125rem 0.5rem; border-radius: 0.25rem; font-weight: 500; text-transform: capitalize; }
	.link { display: inline-flex; align-items: center; gap: 0.25rem; color: var(--color-primary); font-size: 0.75rem; font-weight: 500; text-decoration: none; }
	.link:hover { text-decoration: underline; }
</style>
