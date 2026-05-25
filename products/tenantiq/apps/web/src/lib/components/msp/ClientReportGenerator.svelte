<script lang="ts">
	import { api } from '$api/client';
	import { toasts } from '$stores/toast';

	interface TenantOption {
		id: string;
		displayName: string;
	}

	interface Props {
		tenants: TenantOption[];
	}

	let { tenants }: Props = $props();

	let selectedTenantId = $state('');
	let selectedPeriod = $state<'30d' | '90d' | '1y'>('30d');
	let generating = $state(false);

	const periods = [
		{ value: '30d', label: 'Last 30 Days' },
		{ value: '90d', label: 'Last 90 Days' },
		{ value: '1y', label: 'Last 12 Months' },
	] as const;

	async function generateReport() {
		if (!selectedTenantId) {
			toasts.error('Select a tenant first');
			return;
		}

		generating = true;
		try {
			const res = await fetch(
				`${import.meta.env.PUBLIC_API_URL || 'https://api.tenantiq.app'}/api/savings-report/generate`,
				{
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({
						tenantId: selectedTenantId,
						period: selectedPeriod,
						includeSecurityImprovements: true,
					}),
				},
			);

			if (!res.ok) throw new Error('Failed to generate report');

			const html = await res.text();
			const win = window.open('', '_blank');
			if (win) {
				win.document.write(html);
				win.document.close();
			}
			toasts.success('Savings report generated');
		} catch (err: any) {
			toasts.error(err?.message ?? 'Failed to generate report');
		} finally {
			generating = false;
		}
	}
</script>

<div class="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5">
	<h3 class="text-base font-semibold text-[var(--color-text)]">Client Savings Report</h3>
	<p class="mt-1 text-sm text-[var(--color-text-secondary)]">
		Generate a branded PDF report showing the value you deliver to each client.
	</p>

	<div class="mt-4 flex flex-wrap items-end gap-3">
		<div class="flex-1 min-w-[180px]">
			<label for="report-tenant" class="block text-xs font-medium text-[var(--color-text-secondary)] mb-1">
				Tenant
			</label>
			<select
				id="report-tenant"
				bind:value={selectedTenantId}
				class="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 text-sm text-[var(--color-text)] focus:border-[var(--color-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--color-primary)]"
			>
				<option value="">Select tenant...</option>
				{#each tenants as t}
					<option value={t.id}>{t.displayName}</option>
				{/each}
			</select>
		</div>

		<div class="min-w-[140px]">
			<label for="report-period" class="block text-xs font-medium text-[var(--color-text-secondary)] mb-1">
				Period
			</label>
			<select
				id="report-period"
				bind:value={selectedPeriod}
				class="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 text-sm text-[var(--color-text)] focus:border-[var(--color-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--color-primary)]"
			>
				{#each periods as p}
					<option value={p.value}>{p.label}</option>
				{/each}
			</select>
		</div>

		<button
			onclick={generateReport}
			disabled={!selectedTenantId || generating}
			class="rounded-lg bg-[var(--color-primary)] px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-[var(--color-primary-hover)] disabled:opacity-50 disabled:cursor-not-allowed"
		>
			{generating ? 'Generating...' : 'Generate Report'}
		</button>
	</div>
</div>
