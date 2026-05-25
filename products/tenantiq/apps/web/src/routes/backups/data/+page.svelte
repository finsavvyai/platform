<script lang="ts">
	import MetricCard from '$components/MetricCard.svelte';
	import { tenant } from '$stores/tenant';
	import { api } from '$api/client';
	import { toasts } from '$stores/toast';
	import { safeErrorMessage } from '$lib/utils/safe-error';
	import { untrack } from 'svelte';

	type BackupType = 'exchange' | 'sharepoint' | 'teams';
	type BackupStatus = 'pending' | 'running' | 'completed' | 'failed';

	interface BackupJob {
		id: string;
		type: BackupType;
		status: BackupStatus;
		itemsCount: number;
		sizeBytes: number;
		startedAt: string | null;
		completedAt: string | null;
		error: string | null;
		createdAt: string;
	}

	interface StorageUsage {
		totalJobs: number;
		totalSizeBytes: number;
		byType: Record<string, number>;
	}

	let jobs = $state<BackupJob[]>([]);
	let usage = $state<StorageUsage>({ totalJobs: 0, totalSizeBytes: 0, byType: {} });
	let loading = $state(true);
	let starting = $state<BackupType | null>(null);

	const tid = $derived($tenant.currentTenantId);

	$effect(() => { if (tid) untrack(() => loadData()); else loading = false; });

	async function loadData() {
		loading = true;
		try {
			const [jobsRes, storageRes] = await Promise.allSettled([
				api.get<{ jobs: BackupJob[] }>('/backups/jobs'),
				api.get<{ usage: StorageUsage }>('/backups/storage'),
			]);
			if (jobsRes.status === 'fulfilled') jobs = jobsRes.value.jobs ?? [];
			if (storageRes.status === 'fulfilled') usage = storageRes.value.usage;
		} catch (err) { console.error('[BackupData]', err); }
		finally { loading = false; }
	}

	async function startBackup(type: BackupType) {
		starting = type;
		try {
			await api.post('/backups/start', { type });
			toasts.success(`${typeLabel(type)} backup started`);
			await loadData();
		} catch (err) { toasts.error(safeErrorMessage(err, 'Failed to start backup')); }
		finally { starting = null; }
	}

	function typeLabel(type: BackupType): string {
		const labels: Record<BackupType, string> = { exchange: 'Exchange', sharepoint: 'SharePoint', teams: 'Teams' };
		return labels[type];
	}

	function statusColor(status: BackupStatus): string {
		const colors: Record<BackupStatus, string> = {
			pending: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300',
			running: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
			completed: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
			failed: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300',
		};
		return colors[status];
	}

	function formatBytes(bytes: number): string {
		if (bytes === 0) return '0 B';
		const k = 1024;
		const sizes = ['B', 'KB', 'MB', 'GB'];
		const i = Math.floor(Math.log(bytes) / Math.log(k));
		return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
	}

	function formatDate(iso: string | null): string {
		if (!iso) return '--';
		return new Date(iso).toLocaleString();
	}
</script>

<svelte:head><title>Data Backup | TenantIQ</title></svelte:head>

<div class="space-y-6">
	<div class="flex items-start justify-between gap-4">
		<div>
			<h1 class="text-2xl font-bold text-[var(--color-text)]">Data Backup</h1>
			<p class="text-[var(--color-text-secondary)]">Back up Exchange, SharePoint, and Teams data</p>
		</div>
	</div>

	{#if loading}
		<div class="grid grid-cols-1 gap-4 sm:grid-cols-4">
			{#each Array(4) as _}<div class="h-24 animate-pulse rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)]"></div>{/each}
		</div>
	{:else}
		<div class="grid grid-cols-1 gap-4 sm:grid-cols-4">
			<MetricCard title="Total Backups" value={String(usage.totalJobs)} subtitle="Completed jobs" />
			<MetricCard title="Storage Used" value={formatBytes(usage.totalSizeBytes)} subtitle="Across all types" />
			<MetricCard title="Exchange" value={formatBytes(usage.byType['exchange'] ?? 0)} subtitle="Mailbox data" />
			<MetricCard title="SharePoint" value={formatBytes(usage.byType['sharepoint'] ?? 0)} subtitle="Document libraries" />
		</div>

		<div class="grid grid-cols-1 gap-4 sm:grid-cols-3">
			{#each ['exchange', 'sharepoint', 'teams'] as type}
				{@const t = type as BackupType}
				<button
					onclick={() => startBackup(t)}
					disabled={starting !== null}
					class="flex min-h-[80px] flex-col items-center justify-center rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4 text-center transition-colors hover:border-[var(--color-primary)] disabled:opacity-50"
				>
					<span class="text-sm font-medium text-[var(--color-text)]">
						{starting === t ? 'Starting...' : `Backup ${typeLabel(t)}`}
					</span>
					<span class="mt-1 text-xs text-[var(--color-text-secondary)]">
						{type === 'exchange' ? 'Mailboxes & messages' : type === 'sharepoint' ? 'Sites & documents' : 'Channels & messages'}
					</span>
				</button>
			{/each}
		</div>

		{#if jobs.length > 0}
			<div>
				<h2 class="mb-3 text-lg font-semibold text-[var(--color-text)]">Job History</h2>
				<div class="overflow-x-auto rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)]">
					<table class="w-full text-left text-sm">
						<thead>
							<tr class="border-b border-[var(--color-border)]">
								<th class="px-4 py-3 font-medium text-[var(--color-text-secondary)]">Type</th>
								<th class="px-4 py-3 font-medium text-[var(--color-text-secondary)]">Status</th>
								<th class="px-4 py-3 font-medium text-[var(--color-text-secondary)]">Items</th>
								<th class="px-4 py-3 font-medium text-[var(--color-text-secondary)]">Size</th>
								<th class="px-4 py-3 font-medium text-[var(--color-text-secondary)]">Started</th>
								<th class="px-4 py-3 font-medium text-[var(--color-text-secondary)]">Completed</th>
							</tr>
						</thead>
						<tbody>
							{#each jobs as job (job.id)}
								<tr class="border-b border-[var(--color-border)] last:border-0">
									<td class="px-4 py-3 font-medium text-[var(--color-text)]">{typeLabel(job.type)}</td>
									<td class="px-4 py-3">
										<span class="inline-block rounded-full px-2 py-0.5 text-xs font-medium {statusColor(job.status)}">{job.status}</span>
									</td>
									<td class="px-4 py-3 text-[var(--color-text-secondary)]">{job.itemsCount}</td>
									<td class="px-4 py-3 text-[var(--color-text-secondary)]">{formatBytes(job.sizeBytes)}</td>
									<td class="px-4 py-3 text-[var(--color-text-secondary)]">{formatDate(job.startedAt)}</td>
									<td class="px-4 py-3 text-[var(--color-text-secondary)]">{formatDate(job.completedAt)}</td>
								</tr>
							{/each}
						</tbody>
					</table>
				</div>
			</div>
		{:else}
			<div class="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-12 text-center">
				<svg xmlns="http://www.w3.org/2000/svg" class="mx-auto h-12 w-12 text-[var(--color-text-tertiary)]" fill="none" viewBox="0 0 24 24" stroke-width="1" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75 7.5m8.25 3v6.75m0 0l-3-3m3 3l3-3M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z" /></svg>
				<h3 class="mt-4 text-base font-semibold text-[var(--color-text)]">No backup jobs yet</h3>
				<p class="mt-2 text-sm text-[var(--color-text-secondary)]">Start your first data backup using the buttons above.</p>
			</div>
		{/if}
	{/if}
</div>
