<script lang="ts">
	import PageHeader from '$components/ui/PageHeader.svelte';
	import MetricCard from '$components/MetricCard.svelte';
	import BackupCard from '$lib/components/backup/BackupCard.svelte';
	import BackupHealthPanel from '$lib/components/backup/BackupHealthPanel.svelte';
	import BackupSchedulePanel from '$lib/components/backup/BackupSchedulePanel.svelte';
	import RestoreModal from '$lib/components/backup/RestoreModal.svelte';
	import ConfirmModal from '$components/ConfirmModal.svelte';
	import { tenant } from '$stores/tenant';
	import { api } from '$api/client';
	import { toasts } from '$stores/toast';
	import { safeErrorMessage } from '$lib/utils/safe-error';
	import { formatNumber } from '$utils/format';
	import { untrack } from 'svelte';

	interface Backup {
		backupId: string; type: string; timestamp: string; size: number;
		encryptionAlgorithm: string;
		items?: { users?: number; licenses?: number; conditionalAccessPolicies?: number };
	}
	interface Analysis {
		healthScore: number; criticalIssues: string[];
		recommendations: { priority: string; action: string; impact: string }[];
		complianceStatus: { gdpr: boolean; hipaa: boolean; soc2: boolean };
		estimatedDataAtRisk: string;
	}
	interface RestoreData {
		metadata: { displayName: string; domain: string; backupDate: string };
		stats: { users: number; licenses: number; groups: number };
	}
	interface Schedule {
		enabled: boolean; frequency: 'daily' | 'weekly' | 'monthly'; time: string;
		dayOfWeek?: number; dayOfMonth?: number; retentionDays: number;
		lastRun: string | null; nextRun: string | null;
	}

	let backups = $state<Backup[]>([]);
	let analysis = $state<Analysis | null>(null);
	let restoreData = $state<RestoreData | null>(null);
	let schedule = $state<Schedule>({
		enabled: false, frequency: 'daily', time: '03:00', retentionDays: 90,
		lastRun: null, nextRun: null
	});
	let loading = $state(true);
	let creating = $state(false);
	let showHealth = $state(false);
	let cleanupConfirm = $state(false);

	const tid = $derived($tenant.currentTenantId);
	const totalSize = $derived(backups.reduce((s, b) => s + b.size, 0));

	$effect(() => { if (tid) untrack(() => load()); else loading = false; });

	async function load() {
		loading = true;
		try {
			const [bData, aData, sData] = await Promise.allSettled([
				api.get<{ backups: Backup[] }>(`/tenants/${tid}/backups`),
				api.post<{ analysis: Analysis }>(`/tenants/${tid}/backup/analyze`, {}),
				api.get<Schedule>(`/tenants/${tid}/backup/schedule`)
			]);
			if (bData.status === 'fulfilled') backups = bData.value.backups || [];
			if (aData.status === 'fulfilled') analysis = aData.value.analysis;
			if (sData.status === 'fulfilled') schedule = sData.value;
		} catch (err) { console.error('[Backups]', err); }
		finally { loading = false; }
	}

	async function createBackup() {
		creating = true;
		try {
			await api.post(`/tenants/${tid}/backup/create`, {});
			toasts.success('Backup created successfully');
			await load();
		} catch (err) { toasts.error(safeErrorMessage(err, 'Backup failed')); }
		finally { creating = false; }
	}

	async function handleRestore(backupId: string) {
		try {
			restoreData = await api.post<RestoreData>(`/tenants/${tid}/backup/restore`, { backupId });
		} catch (err) { toasts.error(safeErrorMessage(err, 'Restore failed')); }
	}

	async function handleCleanup() {
		try {
			await api.delete(`/tenants/${tid}/backups/cleanup?retentionDays=90`);
			toasts.success('Old backups cleaned up');
			await load();
		} catch (err) { toasts.error(safeErrorMessage(err, 'Cleanup failed')); }
		cleanupConfirm = false;
	}

	async function handleSaveSchedule(s: typeof schedule) {
		try {
			schedule = await api.post<Schedule>(`/tenants/${tid}/backup/schedule`, s);
		} catch (err) { toasts.error(safeErrorMessage(err, 'Failed to save schedule')); }
	}

	function formatBytes(bytes: number): string {
		if (bytes === 0) return '0 B';
		const k = 1024;
		const sizes = ['B', 'KB', 'MB', 'GB'];
		const i = Math.floor(Math.log(bytes) / Math.log(k));
		return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
	}
</script>

<svelte:head><title>Cloud Backups | TenantIQ</title></svelte:head>

<div class="space-y-6">
	<PageHeader title="Cloud Backups" description="Exchange, SharePoint, and Teams backup management" iconPath="M20.25 6.375c0 2.278-3.694 4.125-8.25 4.125S3.75 8.653 3.75 6.375m16.5 0c0-2.278-3.694-4.125-8.25-4.125S3.75 4.097 3.75 6.375m16.5 0v11.25c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125V6.375m16.5 0v3.75m-16.5-3.75v3.75m16.5 0v3.75C20.25 16.153 16.556 18 12 18s-8.25-1.847-8.25-4.125v-3.75m16.5 0c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125">
		<button onclick={() => (showHealth = !showHealth)} class="btn-secondary">{showHealth ? 'Hide Health' : 'Health Check'}</button>
		<button onclick={() => (cleanupConfirm = true)} disabled={backups.length === 0} class="btn-secondary">Cleanup</button>
		<button onclick={createBackup} disabled={creating} class="btn-primary">{creating ? 'Creating...' : 'Create Backup'}</button>
	</PageHeader>

	{#if loading}
		<div class="grid grid-cols-1 gap-4 sm:grid-cols-4">
			{#each Array(4) as _}<div class="h-24 animate-pulse rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)]"></div>{/each}
		</div>
	{:else}
		<div class="grid grid-cols-1 gap-4 sm:grid-cols-4">
			<MetricCard title="Total Backups" value={formatNumber(backups.length)} subtitle="In retention window" />
			<MetricCard title="Total Size" value={formatBytes(totalSize)} subtitle="Encrypted storage" />
			<MetricCard title="Health Score" value={analysis ? `${analysis.healthScore}%` : '--'} subtitle="Backup health" />
			<MetricCard title="Schedule" value={schedule.enabled ? 'Active' : 'Off'} subtitle={schedule.enabled ? `${schedule.frequency} at ${schedule.time} UTC` : 'Not configured'} />
		</div>

		<BackupSchedulePanel {schedule} onSave={handleSaveSchedule} />

		{#if showHealth && analysis}
			<BackupHealthPanel {analysis} />
		{/if}

		{#if backups.length > 0}
			<div>
				<h2 class="section-title">Backup History</h2>
				<div class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
					{#each backups as backup (backup.backupId)}
						<BackupCard {backup} onRestore={handleRestore} />
					{/each}
				</div>
			</div>
		{:else}
			<div class="empty-state">
				<svg xmlns="http://www.w3.org/2000/svg" class="empty-state-icon" fill="none" viewBox="0 0 24 24" stroke-width="1" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75 7.5m8.25 3v6.75m0 0l-3-3m3 3l3-3M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z" /></svg>
				<h3 class="mt-4 text-base font-semibold text-[var(--color-text)]">No backups yet</h3>
				<p class="mt-2 text-sm text-[var(--color-text-secondary)]">Create your first encrypted backup or enable scheduled backups above.</p>
				<button onclick={createBackup} class="btn-primary mt-4">Create First Backup</button>
			</div>
		{/if}
	{/if}
</div>

{#if restoreData}
	<RestoreModal data={restoreData} onConfirm={() => { toasts.success('Restore applied'); restoreData = null; }} onCancel={() => (restoreData = null)} />
{/if}

<ConfirmModal open={cleanupConfirm} title="Cleanup Old Backups" description="Delete all backups older than 90 days? This cannot be undone." confirmLabel="Delete" destructive onConfirm={handleCleanup} onCancel={() => (cleanupConfirm = false)} />
