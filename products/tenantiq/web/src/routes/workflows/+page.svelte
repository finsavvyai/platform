<script lang="ts">
	import PageHeader from '$components/ui/PageHeader.svelte';
	import ConfirmModal from '$components/ConfirmModal.svelte';
	import ExportMenu from '$components/ui/ExportMenu.svelte';
	import WorkflowRunPanel from '$components/WorkflowRunPanel.svelte';
	import { tenant } from '$stores/tenant';
	import { api } from '$api/client';
	import { formatRelativeTime } from '$utils/format';
	import { exportJson, copyToClipboard } from '$utils/export';
	import { toasts } from '$stores/toast';
	import type { Workflow, WorkflowRun } from '$lib/types/shared';

	let workflows = $state<Workflow[]>([]);
	let loading = $state(true);
	let showCreate = $state(false);
	let selectedWorkflow = $state<Workflow | null>(null);
	let runs = $state<WorkflowRun[]>([]);
	let runTarget = $state<Workflow | null>(null);
	let running = $state(false);

	let newName = $state('');
	let newType = $state('license_optimization');
	let newTrigger = $state<'cron' | 'manual'>('manual');
	let newCronInterval = $state('daily');
	let newCronTime = $state('03:00');
	let creating = $state(false);

	$effect(() => { if ($tenant.currentTenantId) loadWorkflows(); });

	async function loadWorkflows() {
		loading = true;
		try {
			const data = await api.get<{ workflows: Workflow[] }>(`/tenants/${$tenant.currentTenantId}/workflows`);
			workflows = data.workflows;
		} catch (err) { console.error('[Workflows]', err); } finally { loading = false; }
	}

	async function createWorkflow() {
		if (!newName.trim() || !$tenant.currentTenantId) return;
		creating = true;
		try {
			await api.post(`/tenants/${$tenant.currentTenantId}/workflows`, {
				name: newName, workflowType: newType, triggerType: newTrigger,
				triggerConfig: newTrigger === 'cron' ? { interval: newCronInterval, time: newCronTime } : {},
				steps: [{ action: newType, onFailure: 'abort' }], requiresApproval: true
			});
			showCreate = false;
			newName = '';
			toasts.success('Workflow created');
			loadWorkflows();
		} catch (err: any) { toasts.error(err.message || 'Failed to create workflow'); } finally { creating = false; }
	}

	async function viewRuns(wf: Workflow) {
		selectedWorkflow = wf;
		try {
			const data = await api.get<{ runs: WorkflowRun[] }>(`/tenants/${$tenant.currentTenantId}/workflows/${wf.id}/runs`);
			runs = data.runs;
		} catch (err) { console.error('[Workflows]', err); }
	}

	async function triggerRun() {
		if (!runTarget || !$tenant.currentTenantId) return;
		running = true;
		const wf = runTarget;
		try {
			const result = await api.post<{ results?: { summary?: string }; success?: boolean }>(`/tenants/${$tenant.currentTenantId}/workflows/${wf.id}/run`);
			toasts.success(result.results?.summary || 'Workflow completed');
			runTarget = null;
			selectedWorkflow = wf;
			await viewRuns(wf);
			loadWorkflows();
		} catch (err: any) { toasts.error(err.message || 'Workflow run failed'); } finally { running = false; }
	}

	async function toggleEnabled(wf: Workflow) {
		if (!$tenant.currentTenantId) return;
		try {
			await api.patch(`/tenants/${$tenant.currentTenantId}/workflows/${wf.id}`, { enabled: !wf.enabled });
			workflows = workflows.map(w => w.id === wf.id ? { ...w, enabled: !w.enabled } : w);
		} catch (err) { console.error('[Workflows]', err); }
	}

	function handleExportJson() { exportJson(workflows, { type: 'workflows' }, 'workflows'); toasts.success('Exported'); }
	async function handleCopyLink() { if (await copyToClipboard(window.location.href)) toasts.success('Copied'); }
</script>

<svelte:head><title>Workflows | TenantIQ</title></svelte:head>

<div class="page-container" style="display:flex;flex-direction:column;gap:24px;">
	<PageHeader title="Workflows" description="Automation workflows and scheduled tasks" iconPath="M3.75 12h16.5m-16.5 3.75h16.5M3.75 19.5h16.5M5.625 4.5h12.75a1.875 1.875 0 010 3.75H5.625a1.875 1.875 0 010-3.75z">
		<div style="display:flex;align-items:center;gap:8px;">
			<ExportMenu onExportJson={handleExportJson} onCopyLink={handleCopyLink} disabled={workflows.length === 0} />
			<button onclick={() => (showCreate = true)} class="btn-primary">Create Workflow</button>
		</div>
	</PageHeader>

	{#if loading}
		<div style="display:flex;flex-direction:column;gap:12px;">
			{#each Array(3) as _}
				<div class="skeleton" style="height:80px;border-radius:var(--radius-lg);"></div>
			{/each}
		</div>
	{:else if workflows.length === 0}
		<div class="panel">
			<div class="panel-body">
				<div class="empty-state">
					<div class="empty-state-icon">
						<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M3.75 12h16.5m-16.5 3.75h16.5M3.75 19.5h16.5M5.625 4.5h12.75a1.875 1.875 0 010 3.75H5.625a1.875 1.875 0 010-3.75z"/></svg>
					</div>
					<h3>No workflows yet</h3>
					<p>Create one to automate remediation and optimization tasks.</p>
				</div>
			</div>
		</div>
	{:else}
		<div style="display:flex;flex-direction:column;gap:12px;">
			{#each workflows as wf}
				<div class="panel animate-fade-up">
					<div class="panel-body" style="display:flex;align-items:center;justify-content:space-between;gap:16px;">
						<div>
							<div style="display:flex;align-items:center;gap:8px;">
								<span class="section-title">{wf.name}</span>
								<span class="pill-{wf.enabled ? 'success' : 'muted'}">
									{wf.enabled ? 'Active' : 'Disabled'}
								</span>
							</div>
							<p class="micro-label" style="margin-top:4px;">
								{wf.workflowType} &middot; {wf.triggerType} trigger
								{#if wf.lastRunAt}&middot; Last run: {formatRelativeTime(wf.lastRunAt)}{/if}
							</p>
						</div>
						<div style="display:flex;gap:8px;flex-shrink:0;">
							<button onclick={() => viewRuns(wf)} class="btn-secondary">Runs</button>
							<button onclick={() => (runTarget = wf)} class="btn-secondary">Run Now</button>
							<button onclick={() => toggleEnabled(wf)} class="btn-secondary">{wf.enabled ? 'Disable' : 'Enable'}</button>
						</div>
					</div>
				</div>
			{/each}
		</div>
	{/if}

	{#if selectedWorkflow}
		<WorkflowRunPanel runs={runs} workflowName={selectedWorkflow.name} onClose={() => (selectedWorkflow = null)} />
	{/if}
</div>

{#if showCreate}
	<div class="fixed inset-0 z-50 flex items-center justify-center bg-black/50" role="dialog">
		<div class="panel" style="width:400px;max-width:90vw;">
			<div class="panel-header">
				<h2 class="panel-title">Create Workflow</h2>
			</div>
			<div class="panel-body" style="display:flex;flex-direction:column;gap:12px;">
				<div>
					<label for="wf-name" class="micro-label" style="display:block;margin-bottom:6px;">Workflow name</label>
					<input id="wf-name" bind:value={newName} placeholder="Workflow name" class="select-premium" style="width:100%;" />
				</div>
				<div>
					<label for="wf-type" class="micro-label" style="display:block;margin-bottom:6px;">Type</label>
					<select id="wf-type" bind:value={newType} class="select-premium" style="width:100%;">
						<option value="license_optimization">License Optimization</option>
						<option value="security_remediation">Security Remediation</option>
						<option value="user_cleanup">User Cleanup</option>
						<option value="compliance_check">Compliance Check</option>
					</select>
				</div>
				<div>
					<label for="wf-trigger" class="micro-label" style="display:block;margin-bottom:6px;">Trigger</label>
					<select id="wf-trigger" bind:value={newTrigger} class="select-premium" style="width:100%;">
						<option value="manual">Manual</option>
						<option value="cron">Scheduled (Cron)</option>
					</select>
				</div>
				{#if newTrigger === 'cron'}
					<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">
						<div>
							<label for="wf-freq" class="micro-label" style="display:block;margin-bottom:6px;">Frequency</label>
							<select id="wf-freq" bind:value={newCronInterval} class="select-premium" style="width:100%;">
								<option value="hourly">Hourly</option>
								<option value="daily">Daily</option>
								<option value="weekly">Weekly</option>
								<option value="monthly">Monthly</option>
							</select>
						</div>
						<div>
							<label for="wf-time" class="micro-label" style="display:block;margin-bottom:6px;">Time (UTC)</label>
							<input id="wf-time" type="time" bind:value={newCronTime} class="select-premium" style="width:100%;" />
						</div>
					</div>
				{/if}
				<div style="display:flex;justify-content:flex-end;gap:8px;margin-top:8px;">
					<button onclick={() => (showCreate = false)} class="btn-secondary">Cancel</button>
					<button onclick={createWorkflow} disabled={creating || !newName.trim()} class="btn-primary">{creating ? 'Creating...' : 'Create'}</button>
				</div>
			</div>
		</div>
	</div>
{/if}

<ConfirmModal
	open={runTarget !== null}
	title="Run Workflow"
	description={running ? 'Executing workflow...' : 'This will trigger the workflow immediately. Continue?'}
	confirmLabel={running ? 'Running...' : 'Run'}
	onConfirm={triggerRun}
	onCancel={() => { if (!running) runTarget = null; }}
/>
