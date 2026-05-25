<script lang="ts">
	/**
	 * InactivityThreshold — per-tenant inactivity days selector.
	 * Fetches/saves settings via /api/tenants/:id/settings.
	 */
	import { api } from '$api/client';
	import { tenant } from '$stores/tenant';
	import { toasts } from '$stores/toast';

	type Preset = 30 | 60 | 90 | 'custom';
	interface Settings { inactivityDays: Preset; customDays?: number }

	let loading = $state(true);
	let saving = $state(false);
	let inactivityDays = $state<Preset>(90);
	let customDays = $state(120);

	const tenantId = $derived($tenant.currentTenantId);

	async function load() {
		if (!tenantId) return;
		loading = true;
		try {
			const data = await api.get<{ settings: Settings }>(`/tenants/${tenantId}/settings`);
			inactivityDays = data.settings.inactivityDays;
			if (data.settings.customDays) customDays = data.settings.customDays;
		} catch { /* use defaults */ }
		loading = false;
	}

	async function save() {
		if (!tenantId) return;
		saving = true;
		try {
			const body: Settings = { inactivityDays };
			if (inactivityDays === 'custom') body.customDays = customDays;
			await api.patch(`/tenants/${tenantId}/settings`, body);
			toasts.success('Inactivity threshold updated');
		} catch (err) {
			toasts.error('Failed to update threshold');
		}
		saving = false;
	}

	$effect(() => { if (tenantId) load(); });
</script>

<div class="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
	<h2 class="mb-1 text-sm font-semibold text-[var(--color-text)]">Inactivity Threshold</h2>
	<p class="mb-3 text-xs text-[var(--color-text-secondary)]">
		Users inactive beyond this threshold will be flagged as risky on the dashboard.
	</p>

	{#if loading}
		<div class="h-10 animate-pulse rounded bg-[var(--color-bg-secondary)]"></div>
	{:else}
		<div class="flex flex-wrap items-end gap-3">
			<fieldset class="flex gap-2" aria-label="Inactivity days">
				{#each [30, 60, 90] as days}
					<label
						class="cursor-pointer rounded-md border px-3 py-1.5 text-sm transition-colors
						{inactivityDays === days
							? 'border-[var(--color-primary)] bg-[var(--color-primary)]/10 text-[var(--color-primary)] font-medium'
							: 'border-[var(--color-border)] text-[var(--color-text-secondary)] hover:border-[var(--color-primary)]'}"
					>
						<input type="radio" class="sr-only" bind:group={inactivityDays} value={days} />
						{days} days
					</label>
				{/each}
				<label
					class="cursor-pointer rounded-md border px-3 py-1.5 text-sm transition-colors
					{inactivityDays === 'custom'
						? 'border-[var(--color-primary)] bg-[var(--color-primary)]/10 text-[var(--color-primary)] font-medium'
						: 'border-[var(--color-border)] text-[var(--color-text-secondary)] hover:border-[var(--color-primary)]'}"
				>
					<input type="radio" class="sr-only" bind:group={inactivityDays} value="custom" />
					Custom
				</label>
			</fieldset>

			{#if inactivityDays === 'custom'}
				<input
					type="number"
					min="1"
					max="365"
					bind:value={customDays}
					class="w-20 rounded-md border border-[var(--color-border)] bg-[var(--color-bg)] px-2 py-1.5 text-sm text-[var(--color-text)]"
					aria-label="Custom days"
				/>
				<span class="text-xs text-[var(--color-text-secondary)]">days</span>
			{/if}

			<button
				onclick={save}
				disabled={saving}
				class="rounded-md bg-[var(--color-primary)] px-3 py-1.5 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
			>
				{saving ? 'Saving...' : 'Save'}
			</button>
		</div>
	{/if}
</div>
