<script lang="ts">
	import PageHeader from '$components/ui/PageHeader.svelte';
	import SdlcSetupForm from '$lib/components/sdlc/SdlcSetupForm.svelte';
	import MetricCard from '$components/MetricCard.svelte';
	import ScoreRing from '$components/ScoreRing.svelte';
	import { tenant } from '$stores/tenant';
	import { api } from '$api/client';
	import { toasts } from '$stores/toast';
	import { formatNumber } from '$utils/format';

	interface SdlcConfig { enabled: boolean; proxyUrl: string; piiClasses: string[]; policies: string[] }
	interface SdlcStats {
		totalRequests: number; redactedRequests: number; piiDetected: number;
		avgLatencyMs: number; complianceScore: number;
		topPiiTypes: Array<{ type: string; count: number }>;
	}

	let config = $state<SdlcConfig>({ enabled: false, proxyUrl: '', piiClasses: [], policies: [] });
	let stats = $state<SdlcStats | null>(null);
	let loading = $state(true);
	let configuring = $state(false);

	$effect(() => { if ($tenant.currentTenantId) loadSdlc(); });

	async function loadSdlc() {
		loading = true;
		try {
			const data = await api.get<{ config: SdlcConfig; stats: SdlcStats | null }>(`/tenants/${$tenant.currentTenantId}/sdlc`).catch(() => null);
			if (data) { config = data.config; stats = data.stats; }
		} catch { /* first time */ }
		finally { loading = false; }
	}

	async function handleEnable(piiClasses: string[], policies: string[], apiKey: string) {
		if (!$tenant.currentTenantId) return;
		configuring = true;
		try {
			await api.post(`/tenants/${$tenant.currentTenantId}/sdlc/configure`, { apiKey: apiKey || undefined, piiClasses, policies });
			config = { enabled: true, proxyUrl: 'https://proxy.sdlc.cc/v1', piiClasses, policies };
			toasts.success('SDLC.cc AI Compliance enabled');
			loadSdlc();
		} catch { toasts.error('Failed to configure SDLC.cc'); }
		finally { configuring = false; }
	}
</script>

<svelte:head><title>AI Compliance | TenantIQ</title></svelte:head>

<div class="space-y-6">
	<PageHeader title="AI Compliance" description="SDLC.cc PII redaction and compliance" iconPath="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z">
		{#if config.enabled}
			<div class="pill-success">
				<span class="h-2 w-2 rounded-full bg-[var(--color-success)]"></span> Active
			</div>
		{/if}
	</PageHeader>

	{#if loading}
		<div class="grid grid-cols-1 gap-4 sm:grid-cols-4">
			{#each Array(4) as _, i}<div class="h-28 skeleton rounded-2xl delay-{i + 1}"></div>{/each}
		</div>
	{:else if !config.enabled}
		<SdlcSetupForm onEnable={handleEnable} {configuring} />
	{:else}
		<!-- Metrics -->
		<div class="grid grid-cols-1 gap-4 sm:grid-cols-4">
			<div class="animate-fade-up delay-1 flex flex-col items-center justify-center rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5">
				<ScoreRing score={stats?.complianceScore ?? 0} size={96} strokeWidth={7} label="/100" />
				<p class="mt-2 text-xs font-medium text-[var(--color-text-secondary)]">Compliance</p>
			</div>
			<div class="animate-fade-up delay-2"><MetricCard title="AI Requests" value={formatNumber(stats?.totalRequests)} subtitle="Scanned through proxy" /></div>
			<div class="animate-fade-up delay-3"><MetricCard title="PII Redacted" value={formatNumber(stats?.piiDetected)} subtitle="{formatNumber(stats?.redactedRequests)} requests cleaned" /></div>
			<div class="animate-fade-up delay-4"><MetricCard title="Avg Latency" value="{stats?.avgLatencyMs ?? 0}ms" subtitle="< 50ms target" /></div>
		</div>

		<!-- Active config -->
		<div class="animate-fade-up delay-2 grid grid-cols-1 gap-6 lg:grid-cols-2">
			<div class="panel">
				<div class="panel-header">
					<h3 class="panel-title">Active PII Detection</h3>
				</div>
				<div class="panel-body">
					<div class="flex flex-wrap gap-2">
						{#each config.piiClasses as cls}<span class="pill-info">{cls}</span>{/each}
					</div>
				</div>
			</div>
			<div class="panel">
				<div class="panel-header">
					<h3 class="panel-title">Compliance Policies</h3>
				</div>
				<div class="panel-body">
					<div class="flex flex-wrap gap-2">
						{#each config.policies as p}<span class="pill-success">{p}</span>{/each}
					</div>
				</div>
			</div>
		</div>

		<!-- PII breakdown -->
		{#if stats?.topPiiTypes?.length}
			<div class="panel animate-fade-up delay-3">
				<div class="panel-header">
					<h3 class="panel-title">PII Detection Breakdown</h3>
				</div>
				<div class="panel-body">
					<div class="space-y-3">
						{#each stats.topPiiTypes as pii}
							{@const maxCount = Math.max(...stats.topPiiTypes.map(p => p.count))}
							<div class="flex items-center gap-3">
								<span class="w-24 text-xs font-medium text-[var(--color-text)]">{pii.type}</span>
								<div class="h-2 flex-1 overflow-hidden rounded-full bg-[var(--color-border)]"><div class="h-full rounded-full bg-[var(--color-primary)] animate-fill-bar" style="width: {(pii.count / maxCount) * 100}%"></div></div>
								<span class="w-10 text-right text-xs tabular-nums text-[var(--color-text-secondary)]">{pii.count}</span>
							</div>
						{/each}
					</div>
				</div>
			</div>
		{/if}

		<!-- Integration -->
		<div class="panel animate-fade-up delay-4">
			<div class="panel-header">
				<h3 class="panel-title">Integration</h3>
			</div>
			<div class="panel-body">
				<p class="mb-3 text-xs text-[var(--color-text-secondary)]">Replace your AI provider base URL — no code changes required.</p>
				<div class="rounded-lg bg-[var(--color-bg)] p-3 font-mono text-xs text-[var(--color-text)]">
					<span class="text-[var(--color-text-secondary)]">// Before:</span> https://api.openai.com/v1<br>
					<span class="text-[var(--color-text-secondary)]">// After:</span>&nbsp; <span class="text-[var(--color-success)]">{config.proxyUrl}</span>
				</div>
			</div>
		</div>
	{/if}
</div>
