<script lang="ts">
	import PageHeader from '$components/ui/PageHeader.svelte';
	import { tenant } from '$stores/tenant';
	import { api } from '$api/client';
	import { toasts } from '$stores/toast';
	import { formatRelativeTime } from '$utils/format';

	const AVAILABLE_STEPS = [
		{ action: 'disable_account', label: 'Disable Account', type: 'offboard' },
		{ action: 'revoke_sessions', label: 'Revoke All Sessions', type: 'offboard' },
		{ action: 'force_password_change', label: 'Force Password Change', type: 'both' },
		{ action: 'remove_license', label: 'Remove License', type: 'offboard', needsParam: true },
		{ action: 'assign_license', label: 'Assign License', type: 'onboard', needsParam: true },
		{ action: 'add_to_group', label: 'Add to Group', type: 'onboard', needsParam: true },
		{ action: 'remove_from_group', label: 'Remove from Group', type: 'offboard', needsParam: true },
	];

	interface Template { id: string; name: string; type: string; steps: string; enabled: number; created_by: string; created_at: string }
	interface Execution { id: string; template_id: string; target_user_email: string; status: string; steps_completed: number; steps_total: number; started_at: string }

	let templates = $state<Template[]>([]);
	let executions = $state<Execution[]>([]);
	let loading = $state(true);
	let showCreate = $state(false);
	let newName = $state('');
	let newType = $state<'onboard' | 'offboard'>('offboard');
	let selectedSteps = $state<string[]>(['disable_account', 'revoke_sessions']);

	$effect(() => { if ($tenant.currentTenantId) loadData(); });

	async function loadData() {
		loading = true;
		try {
			const [tRes, eRes] = await Promise.all([
				api.get<{ templates: Template[] }>('/lifecycle/templates'),
				api.get<{ executions: Execution[] }>('/lifecycle/executions'),
			]);
			templates = tRes.templates;
			executions = eRes.executions;
		} catch { templates = []; executions = []; }
		finally { loading = false; }
	}

	async function createTemplate() {
		if (!newName.trim()) return;
		try {
			await api.post('/lifecycle/templates', { name: newName, type: newType, steps: selectedSteps.map(s => ({ action: s })), requiresApproval: true });
			toasts.success('Template created');
			showCreate = false; newName = '';
			loadData();
		} catch { toasts.error('Failed to create template'); }
	}

	async function deleteTemplate(id: string) {
		await api.delete(`/lifecycle/templates/${id}`).catch(() => {});
		toasts.success('Deleted');
		loadData();
	}

	function toggleStep(action: string) {
		selectedSteps = selectedSteps.includes(action) ? selectedSteps.filter(s => s !== action) : [...selectedSteps, action];
	}

	const filteredSteps = $derived(AVAILABLE_STEPS.filter(s => s.type === 'both' || s.type === newType));
	const statusColors: Record<string, string> = { completed: 'text-[var(--color-success)]', failed: 'text-[var(--color-danger)]', pending: 'text-[var(--color-warning)]' };
</script>

<svelte:head><title>User Lifecycle | TenantIQ</title></svelte:head>

<div class="space-y-6">
	<PageHeader title="User Lifecycle" description="Automated onboarding and offboarding workflows" iconPath="M18 18.72a9.094 9.094 0 003.741-.479 3 3 0 00-4.682-2.72m.94 3.198l.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0112 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 016 18.719m12 0a5.971 5.971 0 00-.941-3.197m0 0A5.995 5.995 0 0012 12.75a5.995 5.995 0 00-5.058 2.772m0 0a3 3 0 00-4.681 2.72 8.986 8.986 0 003.74.477m.94-3.197a5.971 5.971 0 00-.94 3.197M15 6.75a3 3 0 11-6 0 3 3 0 016 0zm6 3a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0zm-13.5 0a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0z">
		<button onclick={() => (showCreate = !showCreate)} class="btn-primary">
			{showCreate ? 'Cancel' : 'New Template'}
		</button>
	</PageHeader>

	{#if showCreate}
		<div class="panel animate-fade-up">
			<div class="panel-header">
				<h3 class="panel-title">Create Lifecycle Template</h3>
			</div>
			<div class="panel-body">
				<div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
					<input bind:value={newName} placeholder="Template name..." class="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 text-sm text-[var(--color-text)]" />
					<select bind:value={newType} class="select-premium">
						<option value="offboard">Offboarding</option>
						<option value="onboard">Onboarding</option>
					</select>
				</div>
				<p class="micro-label mt-4 mb-2">Steps (in order)</p>
				<div class="flex flex-wrap gap-2">
					{#each filteredSteps as step}
						<button onclick={() => toggleStep(step.action)} class="rounded-lg border px-3 py-1.5 text-xs font-medium transition-all {selectedSteps.includes(step.action) ? 'border-[var(--color-primary)] bg-[var(--color-primary)]/10 text-[var(--color-primary)]' : 'border-[var(--color-border)] text-[var(--color-text-secondary)]'}">
							{step.label}
						</button>
					{/each}
				</div>
				<button onclick={createTemplate} disabled={!newName.trim() || selectedSteps.length === 0} class="btn-primary mt-4">Create Template</button>
			</div>
		</div>
	{/if}

	{#if loading}
		<div class="space-y-3">{#each Array(2) as _}<div class="h-20 skeleton rounded-2xl"></div>{/each}</div>
	{:else}
		<!-- Templates -->
		<div>
			<h2 class="section-title">Templates ({templates.length})</h2>
			{#if templates.length === 0}
				<div class="empty-state">
					<p class="text-sm text-[var(--color-text-secondary)]">No templates yet. Create one to automate onboarding/offboarding.</p>
				</div>
			{:else}
				<div class="space-y-2">
					{#each templates as t (t.id)}
						<div class="flex items-center justify-between rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
							<div>
								<p class="text-sm font-semibold text-[var(--color-text)]">{t.name}</p>
								<p class="mt-0.5 text-xs text-[var(--color-text-secondary)]">{t.type} — {JSON.parse(t.steps || '[]').length} steps — by {t.created_by}</p>
							</div>
							<button onclick={() => deleteTemplate(t.id)} class="text-xs text-[var(--color-danger)] hover:underline">Delete</button>
						</div>
					{/each}
				</div>
			{/if}
		</div>

		<!-- Executions -->
		{#if executions.length > 0}
			<div>
				<h2 class="section-title">Recent Executions</h2>
				<div class="space-y-2">
					{#each executions as exec (exec.id)}
						<div class="flex items-center justify-between rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-3">
							<div>
								<span class="text-sm font-medium {statusColors[exec.status] || ''} capitalize">{exec.status}</span>
								<span class="ml-2 text-xs text-[var(--color-text-secondary)]">{exec.target_user_email} — <span class="tabular-nums">{exec.steps_completed}/{exec.steps_total}</span> steps</span>
							</div>
							<span class="text-xs text-[var(--color-text-tertiary)]">{formatRelativeTime(exec.started_at)}</span>
						</div>
					{/each}
				</div>
			</div>
		{/if}
	{/if}
</div>
