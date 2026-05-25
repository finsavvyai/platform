<script lang="ts">
	import SecurityStackCard from '$components/security/SecurityStackCard.svelte';
	import SecurityTemplateSelector from '$components/security/SecurityTemplateSelector.svelte';
	import CostComparisonBanner from '$components/security/CostComparisonBanner.svelte';
	import { tenant } from '$stores/tenant';
	import { api } from '$api/client';
	import { toasts } from '$stores/toast';
	import { safeErrorMessage } from '$lib/utils/safe-error';
	import { untrack } from 'svelte';

	interface StackProduct {
		id: string;
		title: string;
		replaces: string;
		status: 'active' | 'partial' | 'not_configured';
		score: number;
		features: Array<{ name: string; active: boolean }>;
		requiresLicense?: boolean;
		configUrl?: string;
		productId?: string;
		configurable?: boolean;
	}

	interface SecurityData {
		products: StackProduct[];
		totalValue: number;
		thirdPartyEquivalent: number;
	}

	let data = $state<SecurityData | null>(null);
	let loading = $state(true);
	let error = $state<string | null>(null);
	let isBulkConfiguring = $state(false);

	$effect(() => {
		if ($tenant.currentTenantId) untrack(() => loadStackData());
	});

	async function loadStackData() {
		loading = true;
		error = null;
		try {
			data = await api.get<SecurityData>(
				`/tenants/${$tenant.currentTenantId}/security/stack`,
			);
		} catch (err) {
			error = safeErrorMessage(err, 'Failed to load security stack data');
		} finally {
			loading = false;
		}
	}

	async function triggerSync() {
		if (!$tenant.currentTenantId) return;
		try {
			await api.post(`/tenants/${$tenant.currentTenantId}/sync`);
			toasts.success('Sync started — security data will appear shortly');
			setTimeout(() => loadStackData(), 3000);
		} catch {
			toasts.error('Failed to start sync');
		}
	}

	async function configureProduct(productId: string) {
		if (!$tenant.currentTenantId) return;
		try {
			await api.post(`/tenants/${$tenant.currentTenantId}/security/stack/configure`, { productId });
			toasts.success('Configuration applied successfully');
			setTimeout(() => loadStackData(), 1000);
		} catch (err) {
			throw new Error(safeErrorMessage(err, 'Failed to configure'));
		}
	}

	async function autoConfigureAll() {
		if (!$tenant.currentTenantId || !data) return;
		isBulkConfiguring = true;
		const configurableProducts = data.products.filter(p => p.configurable !== false && p.status !== 'active');
		let successCount = 0;
		let failCount = 0;

		for (const product of configurableProducts) {
			try {
				await configureProduct(product.id);
				successCount++;
			} catch {
				failCount++;
			}
		}

		isBulkConfiguring = false;
		toasts.success(`Configured ${successCount} feature${successCount !== 1 ? 's' : ''}${failCount > 0 ? ` (${failCount} failed)` : ''}`);
	}

	const products = $derived(data?.products ?? []);
	const totalValue = $derived(data?.totalValue ?? 0);
	const thirdPartyEquivalent = $derived(data?.thirdPartyEquivalent ?? 0);
	const hasData = $derived(products.length > 0);
	const configurableCount = $derived(products.filter(p => p.configurable !== false && p.status !== 'active').length);
</script>

<svelte:head>
	<title>Microsoft Security Stack | TenantIQ</title>
</svelte:head>

<div class="space-y-6">
	<div class="animate-fade-up flex items-start justify-between gap-4">
		<div>
			<h1 class="text-2xl font-bold text-[var(--color-text)]">Microsoft Security Stack</h1>
			<p class="text-[var(--color-text-secondary)]">
				Your Microsoft 365 license includes built-in security — see what's active and configured
			</p>
		</div>
	</div>

	{#if loading}
		<div class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
			{#each Array(6) as _}
				<div class="h-48 animate-pulse rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)]"></div>
			{/each}
		</div>

	{:else if error}
		<div class="rounded-xl border border-[var(--color-danger)]/30 bg-[var(--color-danger)]/5 p-4">
			<p class="text-sm text-[var(--color-danger)]">{error}</p>
		</div>

	{:else if !hasData}
		<div class="animate-fade-up rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] px-6 py-16 text-center">
			<div class="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-[var(--color-primary)]/10">
				<svg xmlns="http://www.w3.org/2000/svg" class="h-10 w-10 text-[var(--color-primary)]" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z"/></svg>
			</div>
			<h2 class="text-xl font-semibold text-[var(--color-text)]">Security stack data awaiting sync</h2>
			<p class="mx-auto mt-2 max-w-md text-sm text-[var(--color-text-secondary)]">
				Run a sync to scan your Microsoft 365 configuration and see your built-in security features.
			</p>
			<div class="mt-8 flex items-center justify-center gap-3">
				<button onclick={triggerSync} class="inline-flex min-h-[44px] items-center gap-2 rounded-xl bg-[var(--color-primary)] px-6 py-2.5 text-sm font-medium text-white transition-all hover:shadow-[var(--shadow-md)]">
					<svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182"/></svg>
					Sync Security Configuration
				</button>
				<a href="/security" class="inline-flex min-h-[44px] items-center rounded-xl border border-[var(--color-border)] px-5 py-2.5 text-sm font-medium text-[var(--color-text-secondary)] transition-all hover:bg-[var(--color-bg-secondary)]">Back</a>
			</div>
		</div>

	{:else}
		<CostComparisonBanner {totalValue} {thirdPartyEquivalent} />

		<div class="animate-fade-up flex items-center justify-between gap-4">
			<h2 class="text-lg font-semibold text-[var(--color-text)]">Configuration Templates</h2>
		</div>
		<SecurityTemplateSelector {configureProduct} tenantId={$tenant.currentTenantId ?? ''} />

		<div class="animate-fade-up delay-1 flex items-center justify-between gap-4 rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-6">
			<div>
				<h3 class="font-semibold text-[var(--color-text)]">Auto-Configure All Features</h3>
				<p class="text-sm text-[var(--color-text-secondary)]">Configure {configurableCount} inactive features at once</p>
			</div>
			<button
				onclick={autoConfigureAll}
				disabled={isBulkConfiguring || configurableCount === 0}
				class="inline-flex min-h-[44px] items-center gap-2 rounded-xl bg-[var(--color-primary)] px-6 py-2.5 text-sm font-medium text-white transition-all hover:shadow-[var(--shadow-md)] disabled:opacity-50 disabled:cursor-not-allowed"
			>
				{#if isBulkConfiguring}
					<svg class="h-4 w-4 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="2"></circle>
						<path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
					</svg>
					Configuring...
				{:else}
					Configure All
				{/if}
			</button>
		</div>

		<div class="animate-fade-up delay-2">
			<h2 class="mb-4 text-lg font-semibold text-[var(--color-text)]">Security Features</h2>
			<div class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
				{#each products as product}
					<SecurityStackCard
						title={product.title}
						replaces={product.replaces}
						status={product.status}
						score={product.score}
						features={product.features}
						requiresLicense={product.requiresLicense}
						configUrl={product.configUrl}
						productId={product.productId || product.id}
						configurable={product.configurable !== false}
						onConfigure={configureProduct}
					/>
				{/each}
			</div>
		</div>

		<div class="animate-fade-up delay-2 rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-6">
			<h2 class="mb-4 text-lg font-semibold text-[var(--color-text)]">Why This Matters</h2>
			<div class="space-y-3 text-sm text-[var(--color-text-secondary)]">
				<p>
					Microsoft 365 includes enterprise-grade security features that can replace or supplement expensive third-party tools. This stack shows you what's included in your license and how well it's configured.
				</p>
				<p>
					<strong class="text-[var(--color-text)]">Configuration Score:</strong> Percentage of recommended security settings that are enabled. Higher scores mean you're getting more value from your investment.
				</p>
				<p>
					<strong class="text-[var(--color-text)]">Status:</strong> Active (fully configured), Partial (needs setup), or Not Configured (unavailable or disabled).
				</p>
			</div>
		</div>
	{/if}
</div>
