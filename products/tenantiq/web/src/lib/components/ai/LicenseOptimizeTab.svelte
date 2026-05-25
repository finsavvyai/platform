<script lang="ts">
	import { tenant } from '$stores/tenant';
	import { api } from '$api/client';

	interface LicenseAnalysis {
		wastedLicenses: number;
		estimatedMonthlySavings: number;
		recommendations: Array<{ action: string; priority: string }>;
	}

	let optimizeResult = $state<{ source: string; analysis: LicenseAnalysis } | null>(null);
	let optimizing = $state(false);

	async function runLicenseOptimize() {
		if (!$tenant.currentTenantId || optimizing) return;
		optimizing = true;
		optimizeResult = null;
		try {
			optimizeResult = await api.post(`/ai/license-optimize/${$tenant.currentTenantId}`, {});
		} catch (e: unknown) {
			const msg = e instanceof Error ? e.message : 'Optimization failed';
			optimizeResult = {
				source: 'error',
				analysis: { wastedLicenses: 0, estimatedMonthlySavings: 0, recommendations: [{ action: msg, priority: 'high' }] }
			};
		} finally {
			optimizing = false;
		}
	}

	function priorityClass(priority: string) {
		if (priority === 'high') return 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400';
		if (priority === 'medium') return 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400';
		return 'bg-gray-100 text-gray-700 dark:bg-gray-900/30 dark:text-gray-400';
	}

	export function getResult() {
		return optimizeResult;
	}
</script>

<div class="h-full overflow-auto rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-6">
	<div class="mb-6 flex items-start justify-between">
		<div>
			<h2 class="text-base font-semibold text-[var(--color-text)]">AI License Optimization</h2>
			<p class="mt-1 text-sm text-[var(--color-text-secondary)]">
				Uses the license-optimizer Luna agent to identify wasted licenses, inactive users, and cost savings opportunities.
			</p>
		</div>
		<button
			onclick={runLicenseOptimize}
			disabled={optimizing || !$tenant.currentTenantId}
			class="flex items-center gap-2 rounded-md bg-[var(--color-primary)] px-4 py-2 text-sm font-medium text-white hover:bg-[var(--color-primary-dark)] disabled:opacity-50"
		>
			{#if optimizing}
				<span class="inline-block h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white"></span>
				Analyzing...
			{:else}
				Optimize
			{/if}
		</button>
	</div>

	{#if optimizeResult}
		{@const a = optimizeResult.analysis}
		<div class="space-y-4">
			<div class="grid grid-cols-2 gap-4">
				<div class="rounded-lg border border-[var(--color-border)] p-4 text-center">
					<div class="text-3xl font-bold text-orange-500">{a.wastedLicenses}</div>
					<div class="mt-1 text-xs text-[var(--color-text-secondary)]">Wasted Licenses</div>
				</div>
				<div class="rounded-lg border border-green-200 bg-green-50 p-4 text-center dark:border-green-900 dark:bg-green-900/10">
					<div class="text-3xl font-bold text-green-600">${(a.estimatedMonthlySavings ?? 0).toFixed(0)}</div>
					<div class="mt-1 text-xs text-[var(--color-text-secondary)]">Est. Monthly Savings</div>
				</div>
			</div>

			{#if a.recommendations.length > 0}
				<div class="rounded-lg border border-[var(--color-border)] p-4">
					<h3 class="mb-3 text-sm font-semibold text-[var(--color-text)]">Optimization Actions</h3>
					<div class="space-y-2">
						{#each a.recommendations as rec}
							<div class="flex items-start gap-3 rounded-md border border-[var(--color-border)] bg-[var(--color-bg)] p-3">
								<span class="rounded px-1.5 py-0.5 text-xs font-medium {priorityClass(rec.priority)}">
									{rec.priority.toUpperCase()}
								</span>
								<span class="text-sm text-[var(--color-text)]">{rec.action}</span>
							</div>
						{/each}
					</div>
				</div>
			{/if}

			<p class="text-xs text-[var(--color-text-secondary)]">Powered by {optimizeResult.source}</p>
		</div>
	{:else if !optimizing}
		<div class="flex h-48 items-center justify-center text-center text-[var(--color-text-secondary)]">
			<div>
				<div class="mb-2 text-4xl">&#128176;</div>
				<p class="text-sm">Click "Optimize" to find license savings opportunities</p>
			</div>
		</div>
	{/if}
</div>
