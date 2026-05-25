<script lang="ts">
	import PageHeader from '$components/ui/PageHeader.svelte';
	import MetricCard from '$components/MetricCard.svelte';
	import ExportMenu from '$components/ui/ExportMenu.svelte';
	import { tenant } from '$stores/tenant';
	import { api } from '$api/client';
	import { exportCsv, exportJson, copyToClipboard } from '$utils/export';
	import { toasts } from '$stores/toast';

	interface ProviderRow { key: string; count: number; cost_usd_micros: number }
	interface StatusRow { key: string; count: number }
	interface AuditRow {
		ID?: number; TenantID?: string; Provider?: string; Model?: string;
		Status?: string; CostUSDMicros?: number | null;
		LatencyMs?: number; CreatedAt?: string;
	}
	interface Usage {
		total_requests: number;
		total_cost_usd_micros: number;
		by_provider: ProviderRow[];
		by_status: StatusRow[];
		rows: AuditRow[];
	}

	let usage = $state<Usage>({ total_requests: 0, total_cost_usd_micros: 0, by_provider: [], by_status: [], rows: [] });
	let loading = $state(true);

	$effect(() => { if ($tenant.currentTenantId) load(); });

	async function load() {
		loading = true;
		try {
			const res = await api.get<Usage>(`/governance/ai-usage?tenant_id=${encodeURIComponent($tenant.currentTenantId ?? '')}`);
			usage = res;
		} catch (err) {
			console.error('[governance/ai] load', err);
		} finally { loading = false; }
	}

	const dollarsTotal = $derived((usage.total_cost_usd_micros / 1_000_000).toFixed(2));
	const blockedCount = $derived(usage.by_status.find((s) => s.key === 'blocked')?.count ?? 0);
	const dlpHitRate = $derived(usage.total_requests > 0 ? ((blockedCount / usage.total_requests) * 100).toFixed(1) : '0.0');
	const topProvider = $derived(usage.by_provider[0]?.key ?? '—');

	function handleExportCsv() {
		exportCsv(usage.rows.map((r) => ({
			id: r.ID ?? '', tenant: r.TenantID ?? '', provider: r.Provider ?? '',
			model: r.Model ?? '', status: r.Status ?? '',
			cost_usd: r.CostUSDMicros ? (r.CostUSDMicros / 1_000_000).toFixed(4) : '',
			latency_ms: r.LatencyMs ?? '', created_at: r.CreatedAt ?? '',
		})), [
			{ key: 'id', label: 'ID' }, { key: 'tenant', label: 'Tenant' },
			{ key: 'provider', label: 'Provider' }, { key: 'model', label: 'Model' },
			{ key: 'status', label: 'Status' }, { key: 'cost_usd', label: 'Cost (USD)' },
			{ key: 'latency_ms', label: 'Latency (ms)' }, { key: 'created_at', label: 'When' },
		], 'ai-usage');
		toasts.success('AI usage exported as CSV');
	}

	function handleExportJson() {
		exportJson(usage, { type: 'ai-usage', tenant: $tenant.currentTenantId ?? undefined }, 'ai-usage');
		toasts.success('AI usage exported as JSON');
	}

	async function handleCopyLink() {
		const ok = await copyToClipboard(window.location.href);
		if (ok) toasts.success('Link copied');
	}
</script>

<svelte:head><title>AI Governance | TenantIQ</title></svelte:head>

<div class="page-container space-y-6">
	<PageHeader title="AI Governance" description="Per-tenant AI usage, cost, and DLP enforcement (sdlc.cc)" iconPath="M12 2.25c-5.385 0-9.75 4.365-9.75 9.75s4.365 9.75 9.75 9.75 9.75-4.365 9.75-9.75S17.385 2.25 12 2.25zm0 0V12m0 0l4.5 4.5">
		<ExportMenu onExportCsv={handleExportCsv} onExportJson={handleExportJson} onCopyLink={handleCopyLink} disabled={usage.rows.length === 0} />
	</PageHeader>

	<div class="grid grid-cols-2 gap-4 sm:grid-cols-4">
		<MetricCard title="Requests" value={String(usage.total_requests)} subtitle="last 7 days" />
		<MetricCard title="Spend" value={`$${dollarsTotal}`} subtitle="USD, gateway-attributed" />
		<MetricCard title="DLP block rate" value={`${dlpHitRate}%`} subtitle={`${blockedCount} blocked`} progressColor="var(--color-danger)" progress={Number(dlpHitRate)} />
		<MetricCard title="Top provider" value={topProvider} subtitle={usage.by_provider[0] ? `${usage.by_provider[0].count} calls` : ''} />
	</div>

	{#if loading}
		<div class="space-y-3">
			{#each Array(3) as _}<div class="h-20 skeleton rounded-2xl"></div>{/each}
		</div>
	{:else if usage.total_requests === 0}
		<div class="empty-state animate-fade-up">
			<div class="empty-state-icon">
				<svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M9.879 7.519c1.171-1.025 3.071-1.025 4.242 0 1.172 1.025 1.172 2.687 0 3.712-.203.179-.43.326-.67.442-.745.361-1.45.999-1.45 1.827v.75M12 18a.375.375 0 100-.75.375.375 0 000 .75z"/></svg>
			</div>
			<h2>No AI usage yet</h2>
			<p>Once your tenants route Claude/Anthropic calls through sdlc.cc, spend, DLP hits, and provider mix surface here.</p>
		</div>
	{:else}
		<div class="grid gap-4 md:grid-cols-2">
			<div class="panel">
				<div class="panel-header"><h3 class="panel-title">By provider</h3></div>
				<div class="panel-body">
					<table class="w-full text-sm">
						<thead><tr class="text-left text-[var(--color-text-secondary)]"><th class="py-2">Provider</th><th class="py-2">Calls</th><th class="py-2 text-right">Cost</th></tr></thead>
						<tbody>
							{#each usage.by_provider as row}
								<tr class="border-t border-[var(--color-border)]"><td class="py-2">{row.key}</td><td class="py-2">{row.count}</td><td class="py-2 text-right">${(row.cost_usd_micros / 1_000_000).toFixed(2)}</td></tr>
							{/each}
						</tbody>
					</table>
				</div>
			</div>
			<div class="panel">
				<div class="panel-header"><h3 class="panel-title">By status</h3></div>
				<div class="panel-body">
					<table class="w-full text-sm">
						<thead><tr class="text-left text-[var(--color-text-secondary)]"><th class="py-2">Status</th><th class="py-2 text-right">Calls</th></tr></thead>
						<tbody>
							{#each usage.by_status as row}
								<tr class="border-t border-[var(--color-border)]"><td class="py-2">{row.key}</td><td class="py-2 text-right">{row.count}</td></tr>
							{/each}
						</tbody>
					</table>
				</div>
			</div>
		</div>
	{/if}
</div>
