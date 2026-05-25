<script lang="ts">
	import PageHeader from '$components/ui/PageHeader.svelte';
	import MetricCard from '$components/MetricCard.svelte';
	import { api } from '$api/client';
	import { onMount } from 'svelte';
	import { CheckCircle2, AlertTriangle, XCircle, MinusCircle, ExternalLink } from 'lucide-svelte';

	type Health = 'ok' | 'warning' | 'error' | 'off';

	interface TenantRow {
		tenantId: string;
		displayName: string;
		domain: string | null;
		status: string;
		lastBackupAt: string | null;
		lastBackupSizeBytes: number;
		last30dRunCount: number;
		last30dFailCount: number;
		scheduleEnabled: boolean;
		scheduleFrequency: 'daily' | 'weekly' | 'monthly';
		scheduleNextRun: string | null;
		health: Health;
		healthReason: string;
	}
	interface Summary {
		totalTenants: number; ok: number; warning: number; error: number; off: number;
		totalSizeBytes: number; totalBackupsLast30d: number; totalFailuresLast30d: number;
	}
	interface Resp { summary: Summary; tenants: TenantRow[]; generatedAt: string }

	let loading = $state(true);
	let data = $state<Resp | null>(null);
	let filter = $state<Health | 'all'>('all');

	onMount(load);

	async function load() {
		loading = true;
		try {
			data = await api.get<Resp>('/msp/backups');
		} catch { data = null; }
		finally { loading = false; }
	}

	function fmtBytes(n: number): string {
		if (!n) return '0 B';
		const u = ['B', 'KB', 'MB', 'GB', 'TB'];
		const i = Math.min(u.length - 1, Math.floor(Math.log(n) / Math.log(1024)));
		return `${(n / Math.pow(1024, i)).toFixed(i === 0 ? 0 : 1)} ${u[i]}`;
	}

	function fmtAge(iso: string | null): string {
		if (!iso) return '—';
		const ms = Date.now() - Date.parse(iso);
		const h = ms / 3600_000;
		if (h < 1) return `${Math.round(ms / 60_000)}m ago`;
		if (h < 48) return `${Math.round(h)}h ago`;
		return `${Math.round(h / 24)}d ago`;
	}

	const filtered = $derived(
		!data ? []
			: filter === 'all' ? data.tenants
			: data.tenants.filter((t) => t.health === filter),
	);

	const healthIcon: Record<Health, typeof CheckCircle2> = {
		ok: CheckCircle2, warning: AlertTriangle, error: XCircle, off: MinusCircle,
	};
	const healthColor: Record<Health, string> = {
		ok: 'var(--color-success)', warning: 'var(--color-warning)',
		error: 'var(--color-danger)', off: 'var(--color-text-secondary)',
	};
</script>

<svelte:head><title>All-Tenant Backups | TenantIQ</title></svelte:head>

<div class="space-y-6">
	<PageHeader title="All-Tenant Backups" description="Backup health across every customer tenant in your MSP book" iconPath="M20.25 6.375c0 2.278-3.694 4.125-8.25 4.125S3.75 8.653 3.75 6.375m16.5 0c0-2.278-3.694-4.125-8.25-4.125S3.75 4.097 3.75 6.375m16.5 0v11.25c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125V6.375">
		<button class="btn-secondary" onclick={load} disabled={loading}>
			{loading ? 'Loading…' : 'Refresh'}
		</button>
	</PageHeader>

	{#if loading}
		<div class="grid grid-cols-1 gap-4 sm:grid-cols-4">
			{#each Array(4) as _}<div class="h-24 animate-pulse rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)]"></div>{/each}
		</div>
	{:else if !data}
		<div class="empty-state"><p>Could not load MSP backup overview.</p></div>
	{:else}
		<div class="grid grid-cols-2 gap-4 sm:grid-cols-4">
			<MetricCard title="Tenants" value={String(data.summary.totalTenants)} subtitle="All customers" />
			<MetricCard title="Healthy" value={String(data.summary.ok)} subtitle="Recent + scheduled" />
			<MetricCard title="At risk" value={String(data.summary.warning + data.summary.error)} subtitle="Need attention" />
			<MetricCard title="Storage" value={fmtBytes(data.summary.totalSizeBytes)} subtitle="Latest backup sum" />
		</div>

		<div class="filter-bar">
			{#each ['all', 'error', 'warning', 'ok', 'off'] as const as f}
				<button
					class="filter-pill"
					class:active={filter === f}
					onclick={() => (filter = f)}
				>
					{f === 'all' ? 'All' : f}
					<span class="count">{
						f === 'all' ? data.summary.totalTenants
							: f === 'error' ? data.summary.error
							: f === 'warning' ? data.summary.warning
							: f === 'ok' ? data.summary.ok
							: data.summary.off
					}</span>
				</button>
			{/each}
		</div>

		<div class="overflow-x-auto rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)]">
			<table class="min-w-full">
				<thead class="bg-[var(--color-bg-tertiary)]">
					<tr>
						<th class="px-4 py-3 text-left text-xs font-medium text-[var(--color-text-secondary)]">Tenant</th>
						<th class="px-4 py-3 text-left text-xs font-medium text-[var(--color-text-secondary)]">Health</th>
						<th class="px-4 py-3 text-left text-xs font-medium text-[var(--color-text-secondary)]">Last backup</th>
						<th class="px-4 py-3 text-right text-xs font-medium text-[var(--color-text-secondary)]">Size</th>
						<th class="px-4 py-3 text-right text-xs font-medium text-[var(--color-text-secondary)]">30d runs</th>
						<th class="px-4 py-3 text-left text-xs font-medium text-[var(--color-text-secondary)]">Schedule</th>
						<th class="px-4 py-3"></th>
					</tr>
				</thead>
				<tbody class="divide-y divide-[var(--color-border)]">
					{#each filtered as t (t.tenantId)}
						{@const Icon = healthIcon[t.health]}
						<tr class="hover:bg-[var(--color-bg-secondary)]">
							<td class="px-4 py-3">
								<p class="text-sm font-medium text-[var(--color-text)]">{t.displayName}</p>
								{#if t.domain}<p class="text-xs text-[var(--color-text-tertiary)]">{t.domain}</p>{/if}
							</td>
							<td class="px-4 py-3">
								<div class="flex items-center gap-1.5" style="color: {healthColor[t.health]};">
									<Icon size={14} />
									<span class="text-xs font-medium capitalize">{t.health}</span>
								</div>
								<p class="text-[11px] text-[var(--color-text-tertiary)] mt-0.5">{t.healthReason}</p>
							</td>
							<td class="px-4 py-3 text-xs text-[var(--color-text-secondary)] tabular-nums">{fmtAge(t.lastBackupAt)}</td>
							<td class="px-4 py-3 text-right text-xs text-[var(--color-text-secondary)] tabular-nums">{fmtBytes(t.lastBackupSizeBytes)}</td>
							<td class="px-4 py-3 text-right text-xs tabular-nums">
								<span class="text-[var(--color-text)]">{t.last30dRunCount}</span>
								{#if t.last30dFailCount > 0}
									<span class="text-[var(--color-danger)]"> · {t.last30dFailCount} failed</span>
								{/if}
							</td>
							<td class="px-4 py-3 text-xs text-[var(--color-text-secondary)]">
								{#if t.scheduleEnabled}
									{t.scheduleFrequency}{t.scheduleNextRun ? ` · next ${fmtAge(t.scheduleNextRun).replace(' ago', '')}` : ''}
								{:else}
									<span class="text-[var(--color-text-tertiary)]">disabled</span>
								{/if}
							</td>
							<td class="px-4 py-3 text-right">
								<a class="link" href="/backups?tenant={t.tenantId}">
									Open <ExternalLink size={11} />
								</a>
							</td>
						</tr>
					{/each}
					{#if filtered.length === 0}
						<tr><td colspan="7" class="px-4 py-8 text-center text-sm text-[var(--color-text-tertiary)]">No tenants match this filter.</td></tr>
					{/if}
				</tbody>
			</table>
		</div>
	{/if}
</div>

<style>
	.filter-bar { display: flex; gap: 0.5rem; flex-wrap: wrap; }
	.filter-pill {
		display: inline-flex; align-items: center; gap: 0.375rem;
		padding: 0.375rem 0.75rem; border-radius: 0.5rem;
		border: 1px solid var(--color-border); background: var(--color-surface);
		color: var(--color-text-secondary); font-size: 0.8125rem; font-weight: 500;
		cursor: pointer; text-transform: capitalize;
		transition: all 0.15s;
	}
	.filter-pill:hover { color: var(--color-text); }
	.filter-pill.active { background: color-mix(in srgb, var(--color-primary) 12%, transparent); color: var(--color-primary); border-color: color-mix(in srgb, var(--color-primary) 40%, transparent); }
	.filter-pill .count { background: color-mix(in srgb, currentColor 15%, transparent); padding: 0.125rem 0.375rem; border-radius: 0.25rem; font-size: 0.6875rem; }
	.link { display: inline-flex; align-items: center; gap: 0.25rem; color: var(--color-primary); font-size: 0.75rem; font-weight: 500; text-decoration: none; }
	.link:hover { text-decoration: underline; }
</style>
