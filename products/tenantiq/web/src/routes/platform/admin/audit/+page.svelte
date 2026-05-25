<script lang="ts">
	/**
	 * Admin Audit Log Page
	 *
	 * Filterable audit log of all admin actions.
	 */
	import Card from '$lib/components/ui/Card.svelte';
	import AuditLogEntry from '$lib/components/admin/AuditLogEntry.svelte';
	import { auth } from '$stores/auth';
	import { Search } from 'lucide-svelte';

	let loading = $state(true);
	let logs = $state<any[]>([]);
	let total = $state(0);
	let currentPage = $state(1);
	let actionFilter = $state('');
	let actions = $state<string[]>([]);

	$effect(() => {
		if ($auth.user) {
			loadLogs();
			loadActions();
		}
	});

	async function loadLogs() {
		loading = true;
		try {
			const params = new URLSearchParams({ page: String(currentPage), limit: '50' });
			if (actionFilter) params.set('action', actionFilter);
			const res = await fetch(
				`https://api.tenantiq.app/platform/admin/audit-logs?${params}`,
				{ credentials: 'include' }
			).then((r) => r.json());
			logs = res.logs ?? [];
			total = res.total ?? 0;
		} catch {
			/* keep defaults */
		} finally {
			loading = false;
		}
	}

	async function loadActions() {
		try {
			const res = await fetch('https://api.tenantiq.app/platform/admin/audit-logs/actions', {
				credentials: 'include',
			}).then((r) => r.json());
			actions = res.actions ?? [];
		} catch {
			/* keep defaults */
		}
	}

	function changeAction(action: string) {
		actionFilter = action;
		currentPage = 1;
		loadLogs();
	}
</script>

<svelte:head>
	<title>Audit Log - Admin - TenantIQ</title>
</svelte:head>

<div class="flex items-center justify-between mb-4">
	<h2 class="text-lg font-semibold text-[var(--color-text)]">Audit Log ({total})</h2>
	<div class="flex items-center gap-2">
		<select
			value={actionFilter}
			onchange={(e) => changeAction((e.target as HTMLSelectElement).value)}
			class="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm text-[var(--color-text)]"
		>
			<option value="">All actions</option>
			{#each actions as a}
				<option value={a}>{a}</option>
			{/each}
		</select>
	</div>
</div>

<Card variant="elevated" padding="none">
	{#if loading}
		<div class="p-8 text-center text-sm text-[var(--color-text-secondary)]">Loading audit logs...</div>
	{:else if logs.length === 0}
		<div class="p-8 text-center text-sm text-[var(--color-text-secondary)]">No audit logs found</div>
	{:else}
		{#each logs as log (log.id)}
			<AuditLogEntry {log} />
		{/each}
	{/if}
</Card>

{#if total > 50}
	<div class="flex items-center justify-center gap-4 mt-4">
		<button
			onclick={() => { currentPage = Math.max(1, currentPage - 1); loadLogs(); }}
			disabled={currentPage === 1}
			class="rounded-lg border border-[var(--color-border)] px-4 py-2 text-sm text-[var(--color-text)] disabled:opacity-50 cursor-pointer"
		>Previous</button>
		<span class="text-sm text-[var(--color-text-secondary)]">Page {currentPage}</span>
		<button
			onclick={() => { currentPage++; loadLogs(); }}
			disabled={currentPage * 50 >= total}
			class="rounded-lg border border-[var(--color-border)] px-4 py-2 text-sm text-[var(--color-text)] disabled:opacity-50 cursor-pointer"
		>Next</button>
	</div>
{/if}
