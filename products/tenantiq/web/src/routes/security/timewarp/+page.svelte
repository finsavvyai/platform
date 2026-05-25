<script lang="ts">
	import PageHeader from '$components/ui/PageHeader.svelte';
	import { api } from '$api/client';
	import { tenant } from '$stores/tenant';
	import { Clock, Rewind } from 'lucide-svelte';

	interface Result {
		at: string; tenantId: string;
		baselineSnapshotId: string | null; baselineCapturedAt: string | null;
		driftsApplied: number; auditEvents: number;
		state: Record<string, unknown> | null;
		narrative: string[];
		sources: { snapshots: number; drifts: number; audits: number };
	}

	let at = $state(new Date().toISOString().slice(0, 16));
	let loading = $state(false);
	let result = $state<Result | null>(null);
	let error = $state<string | null>(null);

	const PRESETS = [
		{ label: '1 hour ago', ms: 3600_000 },
		{ label: '24 hours ago', ms: 86_400_000 },
		{ label: '7 days ago', ms: 7 * 86_400_000 },
		{ label: '30 days ago', ms: 30 * 86_400_000 },
		{ label: '90 days ago', ms: 90 * 86_400_000 },
	];

	function preset(msAgo: number) {
		at = new Date(Date.now() - msAgo).toISOString().slice(0, 16);
	}

	async function go() {
		const tid = $tenant.currentTenantId;
		if (!tid) { error = 'Select a tenant first'; return; }
		const iso = new Date(at).toISOString();
		loading = true; error = null; result = null;
		try {
			result = await api.post<Result>(`/timewarp/${tid}`, { at: iso });
		} catch (e) {
			error = e instanceof Error ? e.message : 'Reconstruct failed';
		} finally { loading = false; }
	}
</script>

<svelte:head><title>Timewarp | TenantIQ</title></svelte:head>

<div class="space-y-6">
	<PageHeader title="Tenant Timewarp" description="Reconstruct any tenant's configuration as it was at any moment in the past — built from snapshots, drift events, and audit logs." iconPath="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z">
		<a href="/security" class="btn-secondary">Security home</a>
	</PageHeader>

	<div class="panel">
		<div class="panel-header">
			<div>
				<h2 class="panel-title">Pick a moment</h2>
				<p class="panel-sub">Anywhere from "now" back to your earliest snapshot.</p>
			</div>
		</div>
		<div class="form">
			<input type="datetime-local" bind:value={at} class="input" />
			<button class="btn-primary" onclick={go} disabled={loading}>
				<Rewind size={14} />
				{loading ? 'Reconstructing…' : 'Travel'}
			</button>
		</div>
		<div class="presets">
			{#each PRESETS as p}
				<button class="preset" onclick={() => preset(p.ms)}>{p.label}</button>
			{/each}
		</div>
	</div>

	{#if error}
		<div class="panel error">{error}</div>
	{/if}

	{#if result}
		<div class="result-grid">
			<div class="panel meta">
				<div class="panel-header"><div><h3 class="panel-title"><Clock size={14} /> Reconstruction</h3></div></div>
				<dl class="kv">
					<dt>At</dt><dd><code>{result.at}</code></dd>
					<dt>Baseline snapshot</dt><dd><code>{result.baselineSnapshotId ?? '—'}</code></dd>
					<dt>Snapshot captured</dt><dd><code>{result.baselineCapturedAt ?? '—'}</code></dd>
					<dt>Drifts applied</dt><dd>{result.driftsApplied}</dd>
					<dt>Audit events in window</dt><dd>{result.auditEvents}</dd>
				</dl>
			</div>
			<div class="panel narrative">
				<div class="panel-header"><div><h3 class="panel-title">Narrative</h3></div></div>
				<ul>
					{#each result.narrative as n}<li>{n}</li>{/each}
				</ul>
			</div>
		</div>

		{#if result.state}
			<div class="panel state">
				<div class="panel-header"><div><h3 class="panel-title">Reconstructed state</h3><p class="panel-sub">JSON tree per category. Each bucket carries lastChange / lastChangeAt from the most recent drift before the target moment.</p></div></div>
				<pre><code>{JSON.stringify(result.state, null, 2)}</code></pre>
			</div>
		{/if}
	{/if}
</div>

<style>
	.form { display: flex; gap: 0.5rem; align-items: center; padding: 0 1rem 0.75rem; }
	.input { min-height: 38px; padding: 0.5rem 0.75rem; background: var(--color-surface); border: 1px solid var(--color-border); border-radius: 0.5rem; color: var(--color-text); font-size: 0.875rem; flex: 1; }
	.presets { display: flex; gap: 0.375rem; padding: 0 1rem 1rem; flex-wrap: wrap; }
	.preset { padding: 0.375rem 0.625rem; background: transparent; border: 1px solid var(--color-border); border-radius: 999px; color: var(--color-text-secondary); font-size: 0.75rem; cursor: pointer; min-height: 30px; }
	.preset:hover { color: var(--color-text); border-color: var(--color-primary); }
	.error { padding: 1rem; background: color-mix(in srgb, var(--color-danger) 8%, var(--color-surface)); border-color: color-mix(in srgb, var(--color-danger) 30%, transparent); color: var(--color-danger); font-size: 0.875rem; }
	.result-grid { display: grid; gap: 1rem; grid-template-columns: 1fr 1fr; }
	@media (max-width: 720px) { .result-grid { grid-template-columns: 1fr; } }
	.meta dl { padding: 0 1rem 1rem; display: grid; grid-template-columns: 160px 1fr; gap: 0.375rem 1rem; margin: 0; font-size: 0.8125rem; }
	.meta dt { color: var(--color-text-secondary); }
	.meta dd { margin: 0; color: var(--color-text); }
	.meta code { font-family: 'SF Mono', Menlo, monospace; font-size: 0.75rem; color: var(--color-text); }
	.narrative ul { padding: 0 1.5rem 1rem 2rem; margin: 0; font-size: 0.8125rem; color: var(--color-text); display: flex; flex-direction: column; gap: 0.375rem; }
	.state pre { padding: 1rem; margin: 0; overflow-x: auto; font-family: 'SF Mono', Menlo, monospace; font-size: 0.75rem; color: var(--color-text); background: var(--color-bg-tertiary); }
</style>
