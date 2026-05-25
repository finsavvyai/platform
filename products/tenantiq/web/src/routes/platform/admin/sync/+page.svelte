<script lang="ts">
	/**
	 * Admin Sync Job Management Page
	 *
	 * View running/failed syncs, retry failed jobs, filter by status.
	 */
	import Card from '$lib/components/ui/Card.svelte';
	import SyncJobRow from '$lib/components/admin/SyncJobRow.svelte';
	import { auth } from '$stores/auth';

	let loading = $state(true);
	let jobs = $state<any[]>([]);
	let total = $state(0);
	let currentPage = $state(1);
	let statusFilter = $state('');
	let retrying = $state<string | null>(null);

	const statuses = ['', 'pending', 'running', 'completed', 'failed'];

	$effect(() => {
		if ($auth.user) loadJobs();
	});

	async function loadJobs() {
		loading = true;
		try {
			const params = new URLSearchParams({ page: String(currentPage), limit: '50' });
			if (statusFilter) params.set('status', statusFilter);
			const res = await fetch(
				`https://api.tenantiq.app/platform/admin/sync-jobs?${params}`,
				{ credentials: 'include' }
			).then((r) => r.json());
			jobs = res.jobs ?? [];
			total = res.total ?? 0;
		} catch {
			/* keep defaults */
		} finally {
			loading = false;
		}
	}

	async function retryJob(id: string) {
		retrying = id;
		try {
			await fetch(`https://api.tenantiq.app/platform/admin/sync-jobs/${id}/retry`, {
				method: 'POST',
				credentials: 'include',
			});
			await loadJobs();
		} catch {
			/* keep state */
		} finally {
			retrying = null;
		}
	}

	function changeFilter(status: string) {
		statusFilter = status;
		currentPage = 1;
		loadJobs();
	}
</script>

<svelte:head>
	<title>Sync Jobs - Admin - TenantIQ</title>
</svelte:head>

<div class="flex items-center justify-between mb-4">
	<h2 class="text-lg font-semibold text-[var(--color-text)]">Sync Jobs ({total})</h2>
	<div class="flex gap-1">
		{#each statuses as s}
			<button
				onclick={() => changeFilter(s)}
				class="rounded-lg px-3 py-1.5 text-xs font-medium transition-colors cursor-pointer
					{statusFilter === s
						? 'bg-[var(--color-primary)] text-white'
						: 'bg-[var(--color-surface)] text-[var(--color-text-secondary)] border border-[var(--color-border)] hover:bg-[var(--color-bg-secondary)]'}"
			>
				{s || 'All'}
			</button>
		{/each}
	</div>
</div>

<Card variant="elevated" padding="none">
	{#if loading}
		<div class="p-8 text-center text-sm text-[var(--color-text-secondary)]">Loading sync jobs...</div>
	{:else if jobs.length === 0}
		<div class="p-8 text-center text-sm text-[var(--color-text-secondary)]">No sync jobs found</div>
	{:else}
		{#each jobs as job (job.id)}
			<SyncJobRow {job} onretry={retryJob} />
		{/each}
	{/if}
</Card>

{#if total > 50}
	<div class="flex items-center justify-center gap-4 mt-4">
		<button
			onclick={() => { currentPage = Math.max(1, currentPage - 1); loadJobs(); }}
			disabled={currentPage === 1}
			class="rounded-lg border border-[var(--color-border)] px-4 py-2 text-sm text-[var(--color-text)] disabled:opacity-50 cursor-pointer"
		>Previous</button>
		<span class="text-sm text-[var(--color-text-secondary)]">Page {currentPage}</span>
		<button
			onclick={() => { currentPage++; loadJobs(); }}
			disabled={currentPage * 50 >= total}
			class="rounded-lg border border-[var(--color-border)] px-4 py-2 text-sm text-[var(--color-text)] disabled:opacity-50 cursor-pointer"
		>Next</button>
	</div>
{/if}
