<script lang="ts">
	import PageHeader from '$components/ui/PageHeader.svelte';
	import SnapshotCard from '$lib/components/snapshots/SnapshotCard.svelte';
	import SnapshotDiff from '$lib/components/snapshots/SnapshotDiff.svelte';
	import DriftSummary from '$lib/components/snapshots/DriftSummary.svelte';
	import DriftAlert from '$lib/components/snapshots/DriftAlert.svelte';
	import SuppressionRuleManager from '$lib/components/snapshots/SuppressionRuleManager.svelte';
	import SnapshotScheduleForm from '$lib/components/snapshots/SnapshotScheduleForm.svelte';
	import ExportMenu from '$components/ui/ExportMenu.svelte';
	import { tenant } from '$stores/tenant';
	import { api } from '$api/client';
	import { toasts } from '$stores/toast';
	import { exportJson, copyToClipboard } from '$utils/export';
	import { untrack } from 'svelte';

	interface Snapshot {
		id: string; label: string; snapshot_type: string;
		category_count: number; object_count: number; error_count: number;
		baseline: number; is_baseline?: number; baseline_label?: string | null; created_by: string; created_at: string;
	}

	interface Drift {
		id: string; category: string; path: string;
		old_value: string | null; new_value: string | null;
		severity: 'info' | 'warning' | 'critical';
		acknowledged: number; detected_at: string;
	}

	interface DriftSummaryData {
		total: number; critical: number; warning: number;
		info: number; unacknowledged: number;
	}

	let snapshots = $state<Snapshot[]>([]);
	let loading = $state(true);
	let capturing = $state(false);
	interface CategoryDiffData { categoryId: string; name: string; changes: { path: string; type: 'added' | 'removed' | 'changed'; oldValue?: unknown; newValue?: unknown }[]; changeCount: number }
	let diffData = $state<{ diffs: CategoryDiffData[]; totalChanges: number } | null>(null);
	let diffBaseId = $state<string | null>(null);
	let diffLabels = $state<{ a: string; b: string }>({ a: '', b: '' });
	let showDrifts = $state(false);
	let drifts = $state<Drift[]>([]);
	let driftSummary = $state<DriftSummaryData>({ total: 0, critical: 0, warning: 0, info: 0, unacknowledged: 0 });

	$effect(() => { if ($tenant.currentTenantId) untrack(() => { loadSnapshots(); loadDriftSummary(); }); });

	async function loadSnapshots() {
		loading = true;
		try {
			const res = await api.get<{ snapshots: Snapshot[] }>('/config-snapshots');
			snapshots = res.snapshots;
		} catch { snapshots = []; }
		finally { loading = false; }
	}

	async function loadDriftSummary() {
		try {
			driftSummary = await api.get<DriftSummaryData>('/config-drifts/summary');
		} catch { /* non-critical */ }
	}

	async function loadDrifts() {
		try {
			const res = await api.get<{ drifts: Drift[] }>('/config-drifts?acknowledged=0');
			drifts = res.drifts;
		} catch { drifts = []; }
	}

	async function captureSnapshot() {
		capturing = true;
		try {
			const res = await api.post<{ success: boolean; snapshot: any; error?: string }>('/config-snapshots/capture');
			if (res.error) { toasts.error(res.error); }
			else { toasts.success(`Captured ${res.snapshot.objectCount} config objects`); loadSnapshots(); loadDriftSummary(); }
		} catch (e) { toasts.error(e instanceof Error ? e.message : 'Capture failed'); }
		finally { capturing = false; }
	}

	async function startDiff(id: string) {
		if (!diffBaseId) { diffBaseId = id; toasts.info('Select another snapshot to compare'); return; }
		try {
			diffData = await api.get(`/config-snapshots/${diffBaseId}/diff/${id}`);
			const a = snapshots.find(s => s.id === diffBaseId)?.label ?? 'Snapshot A';
			const b = snapshots.find(s => s.id === id)?.label ?? 'Snapshot B';
			diffLabels = { a, b };
		} catch { toasts.error('Diff failed'); }
		diffBaseId = null;
	}

	async function setBaseline(id: string) {
		const label = window.prompt('Optional name for this baseline (e.g. "post-soc2-2026-q1"). Leave blank for unnamed.');
		if (label === null) return; // cancelled
		try {
			await api.post(`/config-snapshots/${id}/baseline`, label.trim() ? { label: label.trim() } : {});
			toasts.success(label.trim() ? `Baseline "${label.trim()}" set` : 'Baseline set');
			loadSnapshots();
		} catch { toasts.error('Failed to set baseline'); }
	}

	async function clearBaseline(id: string) {
		try {
			await api.request(`/config-snapshots/${id}/baseline`, { method: 'DELETE' });
			toasts.success('Baseline cleared');
			loadSnapshots();
		} catch { toasts.error('Failed to clear baseline'); }
	}

	async function revertDrift(id: string) {
		if (!confirm('Plan a revert of this drift? You will see the planned operations before applying.')) return;
		try {
			const plan = await api.get<{ plan: { supported: boolean; reason?: string; humanSummary?: string; ops?: any[] } }>(
				`/config-drifts/${id}/revert-plan`,
			);
			if (!plan.plan.supported) {
				toasts.error(plan.plan.reason ?? 'Drift cannot be reverted');
				return;
			}
			const opsCount = plan.plan.ops?.length ?? 0;
			if (!confirm(`Apply revert: ${plan.plan.humanSummary} (${opsCount} Graph operation(s))?`)) return;
			const result = await api.post<{ success: boolean; results: { ok: boolean; method: string; path: string; error?: string }[] }>(
				`/config-drifts/${id}/revert`,
				{ confirmed: true },
			);
			if (result.success) {
				toasts.success('Revert applied');
				loadDrifts(); loadDriftSummary();
			} else {
				const failed = result.results.filter(r => !r.ok).map(r => `${r.method} ${r.path}: ${r.error}`).join('; ');
				toasts.error(`Some operations failed: ${failed}`);
			}
		} catch { toasts.error('Revert request failed'); }
	}

	async function acknowledgeDrift(id: string) {
		try {
			await api.patch(`/config-drifts/${id}/acknowledge`);
			drifts = drifts.map(d => d.id === id ? { ...d, acknowledged: 1 } : d);
			loadDriftSummary();
		} catch { toasts.error('Failed to acknowledge'); }
	}

	async function acknowledgeAll() {
		try {
			await api.patch('/config-drifts/acknowledge-all');
			toasts.success('All drifts acknowledged');
			drifts = drifts.map(d => ({ ...d, acknowledged: 1 }));
			loadDriftSummary();
		} catch { toasts.error('Failed to acknowledge all'); }
	}

	function handleViewDrifts() { showDrifts = true; loadDrifts(); }
	function handleExportJson() { exportJson(snapshots, { type: 'config-snapshots' }, 'config-snapshots'); toasts.success('Exported'); }
	async function handleCopyLink() { if (await copyToClipboard(window.location.href)) toasts.success('Link copied'); }
</script>

<svelte:head><title>Config Snapshots | TenantIQ</title></svelte:head>

<div class="space-y-6">
	<PageHeader title="Config Snapshots" description="Capture and compare M365 configuration state" iconPath="M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75 7.5m8.25 3v6.75m0 0l-3-3m3 3l3-3M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z">
		{#if snapshots.length > 0}<ExportMenu onExportJson={handleExportJson} onCopyLink={handleCopyLink} />{/if}
		<button onclick={captureSnapshot} disabled={capturing} class="btn-primary">
			{#if capturing}<span class="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white"></span> Capturing...{:else}Capture Snapshot{/if}
		</button>
	</PageHeader>

	<DriftSummary summary={driftSummary} onViewDrifts={handleViewDrifts} onAcknowledgeAll={acknowledgeAll} />

	{#if diffBaseId}
		<div class="rounded-lg border border-[var(--color-warning)]/30 bg-[var(--color-warning)]/5 px-4 py-3 text-sm text-[var(--color-warning)]">
			Comparing from snapshot. Click another snapshot to see the diff.
			<button onclick={() => (diffBaseId = null)} class="ml-2 cursor-pointer underline">Cancel</button>
		</div>
	{/if}

	{#if loading}
		<div class="space-y-3">{#each Array(3) as _}<div class="h-24 skeleton rounded-2xl"></div>{/each}</div>
	{:else if snapshots.length === 0}
		<div class="empty-state">
			<div class="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-[var(--color-primary)]/10">
				<svg xmlns="http://www.w3.org/2000/svg" class="h-10 w-10 text-[var(--color-primary)]" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75 7.5m8.25 3v6.75m0 0l-3-3m3 3l3-3M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z"/></svg>
			</div>
			<h2 class="text-xl font-semibold text-[var(--color-text)]">No snapshots yet</h2>
			<p class="mx-auto mt-2 max-w-md text-sm text-[var(--color-text-secondary)]">Capture your first config snapshot to backup Conditional Access policies, admin roles, auth methods, and more.</p>
			<button onclick={captureSnapshot} disabled={capturing} class="btn-primary mt-8">
				{#if capturing}<span class="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white"></span> Capturing...{:else}Capture First Snapshot{/if}
			</button>
		</div>
	{:else}
		<div class="space-y-3">
			{#each snapshots as snap (snap.id)}
				<SnapshotCard snapshot={snap} isCompareSource={diffBaseId === snap.id} onView={(id) => window.location.href = `/backups/config/compare?a=${id}`} onDiff={startDiff} onSetBaseline={setBaseline} onClearBaseline={clearBaseline} />
			{/each}
		</div>
	{/if}

	{#if diffData}
		<SnapshotDiff diffs={diffData.diffs} totalChanges={diffData.totalChanges} snapshotALabel={diffLabels.a} snapshotBLabel={diffLabels.b} onClose={() => (diffData = null)} />
	{/if}

	{#if showDrifts}
		<div class="panel">
			<div class="panel-header">
				<h3 class="panel-title">Detected Drifts</h3>
				<button onclick={() => (showDrifts = false)} class="btn-secondary">Close</button>
			</div>
			<div class="panel-body">
				{#if drifts.length === 0}
					<p class="text-sm text-[var(--color-text-secondary)]">No unacknowledged drifts.</p>
				{:else}
					<div class="space-y-2">{#each drifts as drift (drift.id)}<DriftAlert {drift} onAcknowledge={acknowledgeDrift} onRevert={revertDrift} />{/each}</div>
				{/if}
			</div>
		</div>
		<SuppressionRuleManager />
	{/if}

	<SnapshotScheduleForm />
</div>
