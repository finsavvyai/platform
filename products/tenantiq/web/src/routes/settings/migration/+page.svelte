<script lang="ts">
	import { tenant } from '$stores/tenant';
	import { api } from '$api/client';
	import { toasts } from '$stores/toast';
	import { safeErrorMessage } from '$lib/utils/safe-error';

	interface PlanItem { type: string; name: string; action: string }
	interface Plan {
		planId: string; sourceTenantId: string; targetTenantId: string;
		scope: string[]; items: PlanItem[]; estimatedDuration: string;
		createdAt: string; createdBy: string;
	}
	interface MigrationStatus {
		status: string; progress: number; itemsProcessed: number; errors: string[];
	}

	let sourceTenantId = $state('');
	let targetTenantId = $state('');
	let scopeUsers = $state(true);
	let scopeGroups = $state(true);
	let scopePolicies = $state(false);
	let plan = $state<Plan | null>(null);
	let migrationId = $state<string | null>(null);
	let migrationStatus = $state<MigrationStatus | null>(null);
	let planning = $state(false);
	let executing = $state(false);
	let polling = $state(false);

	const tenantList = $derived($tenant.tenants ?? []);
	const scope = $derived([
		...(scopeUsers ? ['users'] : []),
		...(scopeGroups ? ['groups'] : []),
		...(scopePolicies ? ['policies'] : []),
	] as const);

	async function createPlan() {
		if (!sourceTenantId || !targetTenantId || scope.length === 0) return;
		planning = true;
		try {
			const data = await api.post<{ plan: Plan }>('/migration/plan', { sourceTenantId, targetTenantId, scope });
			plan = data.plan;
			toasts.success('Migration plan created');
		} catch (err) { toasts.error(safeErrorMessage(err, 'Planning failed')); }
		finally { planning = false; }
	}

	async function executeMigration() {
		if (!plan) return;
		executing = true;
		try {
			const data = await api.post<{ migrationId: string }>('/migration/execute', { planId: plan.planId });
			migrationId = data.migrationId;
			toasts.success('Migration started');
			pollStatus();
		} catch (err) { toasts.error(safeErrorMessage(err, 'Execution failed')); }
		finally { executing = false; }
	}

	async function pollStatus() {
		if (!migrationId) return;
		polling = true;
		try {
			const data = await api.get<MigrationStatus>(`/migration/${migrationId}/status`);
			migrationStatus = data;
			if (data.status === 'queued' || data.status === 'in_progress') {
				setTimeout(pollStatus, 5000);
			} else { polling = false; }
		} catch { polling = false; }
	}

	const actionColors: Record<string, string> = {
		create: 'bg-[var(--color-success)]/15 text-[var(--color-success)]',
		update: 'bg-[var(--color-warning)]/15 text-[var(--color-warning)]',
		skip: 'bg-[var(--color-bg-tertiary)] text-[var(--color-text-secondary)]',
	};
</script>

<svelte:head><title>Tenant Migration | TenantIQ</title></svelte:head>

<div class="space-y-6">
	<div>
		<h1 class="text-2xl font-bold text-[var(--color-text)]">Tenant Migration</h1>
		<p class="text-[var(--color-text-secondary)]">Migrate users, groups, and policies between tenants</p>
	</div>

	<!-- Step 1: Select tenants -->
	<div class="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5">
		<h2 class="mb-4 text-sm font-semibold text-[var(--color-text)]">Step 1: Select Tenants</h2>
		<div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
			<div>
				<label for="mig-source" class="mb-1 block text-xs text-[var(--color-text-secondary)]">Source Tenant</label>
				<select id="mig-source" bind:value={sourceTenantId} class="w-full min-h-[44px] rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 text-sm text-[var(--color-text)]">
					<option value="">Select source...</option>
					{#each tenantList as t (t.id)}<option value={t.id}>{t.displayName}</option>{/each}
				</select>
			</div>
			<div>
				<label for="mig-target" class="mb-1 block text-xs text-[var(--color-text-secondary)]">Target Tenant</label>
				<select id="mig-target" bind:value={targetTenantId} class="w-full min-h-[44px] rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 text-sm text-[var(--color-text)]">
					<option value="">Select target...</option>
					{#each tenantList.filter(t => t.id !== sourceTenantId) as t (t.id)}<option value={t.id}>{t.displayName}</option>{/each}
				</select>
			</div>
		</div>
	</div>

	<!-- Step 2: Choose scope -->
	<div class="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5">
		<h2 class="mb-4 text-sm font-semibold text-[var(--color-text)]">Step 2: Choose Scope</h2>
		<div class="flex flex-wrap gap-4">
			<label class="flex items-center gap-2 cursor-pointer"><input type="checkbox" bind:checked={scopeUsers} class="rounded" /><span class="text-sm text-[var(--color-text)]">Users</span></label>
			<label class="flex items-center gap-2 cursor-pointer"><input type="checkbox" bind:checked={scopeGroups} class="rounded" /><span class="text-sm text-[var(--color-text)]">Groups</span></label>
			<label class="flex items-center gap-2 cursor-pointer"><input type="checkbox" bind:checked={scopePolicies} class="rounded" /><span class="text-sm text-[var(--color-text)]">Policies</span></label>
		</div>
		<button onclick={createPlan} disabled={planning || !sourceTenantId || !targetTenantId || scope.length === 0} class="mt-4 rounded-lg bg-[var(--color-primary)] px-4 py-2 text-sm font-medium text-white disabled:opacity-50">
			{planning ? 'Creating Plan...' : 'Create Plan'}
		</button>
	</div>

	<!-- Plan Preview -->
	{#if plan}
		<div class="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5">
			<div class="flex items-center justify-between mb-4">
				<h2 class="text-sm font-semibold text-[var(--color-text)]">Migration Plan</h2>
				<span class="text-xs text-[var(--color-text-secondary)]">Est. {plan.estimatedDuration}</span>
			</div>
			<div class="space-y-2 mb-4">
				{#each plan.items as item}
					<div class="flex items-center justify-between rounded-lg border border-[var(--color-border)] p-3">
						<div>
							<p class="text-sm font-medium text-[var(--color-text)]">{item.name}</p>
							<p class="text-xs text-[var(--color-text-secondary)]">{item.type}</p>
						</div>
						<span class="rounded-full px-2.5 py-0.5 text-xs font-medium {actionColors[item.action] ?? ''}">{item.action}</span>
					</div>
				{/each}
			</div>
			<button onclick={executeMigration} disabled={executing} class="rounded-lg bg-[var(--color-warning)] px-4 py-2 text-sm font-medium text-white disabled:opacity-50">
				{executing ? 'Starting...' : 'Execute Migration'}
			</button>
		</div>
	{/if}

	<!-- Status Tracking -->
	{#if migrationStatus}
		<div class="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5">
			<h2 class="mb-4 text-sm font-semibold text-[var(--color-text)]">Migration Status</h2>
			<div class="mb-3 flex items-center gap-3">
				<span class="text-sm font-medium capitalize text-[var(--color-text)]">{migrationStatus.status}</span>
				{#if polling}<span class="h-2 w-2 animate-pulse rounded-full bg-[var(--color-primary)]"></span>{/if}
			</div>
			<div class="mb-2 h-2 overflow-hidden rounded-full bg-[var(--color-bg-tertiary)]">
				<div class="h-full rounded-full bg-[var(--color-primary)] transition-all" style="width: {migrationStatus.progress}%"></div>
			</div>
			<p class="text-xs text-[var(--color-text-secondary)]">{migrationStatus.itemsProcessed} items processed ({migrationStatus.progress}%)</p>
			{#if migrationStatus.errors.length > 0}
				<div class="mt-3 rounded-lg bg-[var(--color-danger)]/10 p-3">
					<p class="text-xs font-medium text-[var(--color-danger)]">{migrationStatus.errors.length} error(s):</p>
					{#each migrationStatus.errors as err}<p class="text-xs text-[var(--color-danger)]">{err}</p>{/each}
				</div>
			{/if}
		</div>
	{/if}
</div>
