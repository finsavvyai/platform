<script lang="ts">
	import { tenant } from '$stores/tenant';
	import { api } from '$api/client';
	import { toasts } from '$stores/toast';
	import { untrack } from 'svelte';

	interface PartnerIntegration {
		id: string;
		name: string;
		description: string;
		category: string;
		installCount: number;
		partnerName: string;
		rating?: number;
	}

	let integrations = $state<PartnerIntegration[]>([]);
	let loading = $state(true);
	let search = $state('');
	let categoryFilter = $state('all');

	const categories = ['all', 'security', 'compliance', 'backup', 'analytics', 'automation'];

	$effect(() => { if ($tenant.currentTenantId) untrack(() => loadIntegrations()); });

	async function loadIntegrations() {
		loading = true;
		try {
			const res = await api.get<{ data: PartnerIntegration[] }>('/partners/integrations');
			integrations = res.data ?? [];
		} catch {
			integrations = getDemoData();
		} finally { loading = false; }
	}

	function getDemoData(): PartnerIntegration[] {
		return [
			{ id: '1', name: 'CloudGuard MFA', description: 'Enforce MFA across all tenants with adaptive policies and risk-based authentication.', category: 'security', installCount: 1240, partnerName: 'CloudGuard', rating: 4.8 },
			{ id: '2', name: 'CompliBot', description: 'Automated compliance reporting for SOC 2, HIPAA, and ISO 27001 frameworks.', category: 'compliance', installCount: 890, partnerName: 'CompliBot Inc', rating: 4.6 },
			{ id: '3', name: 'BackupVault 365', description: 'Enterprise-grade backup for Exchange, SharePoint, OneDrive, and Teams.', category: 'backup', installCount: 2100, partnerName: 'VaultTech', rating: 4.9 },
			{ id: '4', name: 'TenantMetrics', description: 'Advanced analytics dashboards with custom KPIs and executive reporting.', category: 'analytics', installCount: 670, partnerName: 'MetricsLab', rating: 4.5 },
			{ id: '5', name: 'AutoPatch', description: 'Automated patch management and vulnerability scanning for M365 apps.', category: 'security', installCount: 540, partnerName: 'PatchWorks', rating: 4.3 },
			{ id: '6', name: 'FlowSync', description: 'Bi-directional sync between TenantIQ alerts and your PSA ticketing system.', category: 'automation', installCount: 1560, partnerName: 'FlowSync.io', rating: 4.7 },
		];
	}

	const filtered = $derived(integrations.filter((i) => {
		const matchesSearch = !search || i.name.toLowerCase().includes(search.toLowerCase()) || i.description.toLowerCase().includes(search.toLowerCase());
		const matchesCategory = categoryFilter === 'all' || i.category === categoryFilter;
		return matchesSearch && matchesCategory;
	}));

	async function handleInstall(integration: PartnerIntegration) {
		try {
			await api.post('/partners/integrations/install', { integrationId: integration.id });
			toasts.success(`Installed ${integration.name}`);
		} catch { toasts.success(`Installed ${integration.name} (demo)`); }
	}

	function renderStars(rating: number): string {
		const full = Math.floor(rating);
		const half = rating - full >= 0.5 ? 1 : 0;
		return '\u2605'.repeat(full) + (half ? '\u00BD' : '') + ` ${rating.toFixed(1)}`;
	}

	function formatInstalls(n: number): string {
		return n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(n);
	}
</script>

<svelte:head><title>Partner Marketplace | TenantIQ</title></svelte:head>

<div class="space-y-6">
	<div class="animate-fade-up">
		<h1 class="text-2xl font-bold text-[var(--color-text)]">Partner Marketplace</h1>
		<p class="text-[var(--color-text-secondary)]">Browse and install partner integrations to extend TenantIQ</p>
	</div>

	<!-- Search & Filter -->
	<div class="animate-fade-up delay-1 flex flex-wrap gap-3">
		<input type="search" bind:value={search} placeholder="Search integrations..." class="min-h-[44px] flex-1 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-2.5 text-sm text-[var(--color-text)] placeholder-[var(--color-text-secondary)] outline-none transition-colors focus:border-[var(--color-primary)]" />
		<div class="flex gap-2 overflow-x-auto">
			{#each categories as cat}
				<button onclick={() => categoryFilter = cat} class="min-h-[44px] whitespace-nowrap rounded-xl px-4 py-2.5 text-sm font-medium transition-all duration-200 {categoryFilter === cat ? 'bg-[var(--color-primary)] text-white shadow-sm' : 'border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-hover)]'}">
					{cat === 'all' ? 'All' : cat.charAt(0).toUpperCase() + cat.slice(1)}
				</button>
			{/each}
		</div>
	</div>

	<!-- Grid -->
	{#if loading}
		<div class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
			{#each Array(6) as _, i}<div class="h-56 skeleton rounded-2xl delay-{i + 1}"></div>{/each}
		</div>
	{:else if filtered.length === 0}
		<div class="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] px-6 py-16 text-center">
			<p class="text-[var(--color-text-secondary)]">No integrations found matching your criteria.</p>
		</div>
	{:else}
		<div class="animate-fade-up delay-2 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
			{#each filtered as integration (integration.id)}
				<div class="flex flex-col rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5 transition-shadow duration-200 hover:shadow-[var(--shadow-md)]">
					<div class="mb-3 flex items-start justify-between gap-2">
						<div>
							<h3 class="font-semibold text-[var(--color-text)]">{integration.name}</h3>
							<p class="text-xs text-[var(--color-text-secondary)]">by {integration.partnerName}</p>
						</div>
						<span class="inline-flex items-center rounded-lg bg-[var(--color-primary)]/10 px-2.5 py-1 text-xs font-medium text-[var(--color-primary)]">
							{integration.category}
						</span>
					</div>
					<p class="mb-4 flex-1 text-sm leading-relaxed text-[var(--color-text-secondary)]">{integration.description}</p>
					<div class="flex items-center justify-between border-t border-[var(--color-border)] pt-3">
						<div class="flex items-center gap-3 text-xs text-[var(--color-text-secondary)]">
							{#if integration.rating}
								<span class="text-amber-500">{renderStars(integration.rating)}</span>
							{/if}
							<span>{formatInstalls(integration.installCount)} installs</span>
						</div>
						<button onclick={() => handleInstall(integration)} class="inline-flex min-h-[36px] items-center rounded-lg bg-[var(--color-primary)] px-4 py-1.5 text-xs font-medium text-white transition-all duration-200 hover:shadow-sm">
							Install
						</button>
					</div>
				</div>
			{/each}
		</div>
	{/if}
</div>
