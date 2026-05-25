<script lang="ts">
	import IntegrationStatus from '$lib/components/integrations/IntegrationStatus.svelte';
	import DattoForm from '$lib/components/integrations/DattoForm.svelte';
	import ConfirmModal from '$components/ConfirmModal.svelte';
	import { api } from '$api/client';
	import { toasts } from '$stores/toast';
	import { formatRelativeTime } from '$utils/format';
	import { onMount } from 'svelte';

	interface SyncStatus {
		status: 'connected' | 'disconnected' | 'error' | 'syncing';
		lastSyncAt: string | null;
		errorCount: number;
		companiesSynced: number;
		ticketsSynced: number;
	}
	interface Mapping {
		tenantId: string; tenantName: string;
		dattoCompanyId: string | null; dattoCompanyName: string | null;
		autoMatched: boolean;
	}
	interface HistoryEntry { id: string; startedAt: string; status: string; companiesSynced: number; errors: number }

	let syncStatus = $state<SyncStatus | null>(null);
	let mappings = $state<Mapping[]>([]);
	let history = $state<HistoryEntry[]>([]);
	let loading = $state(true);
	let syncing = $state(false);
	let showDisconnect = $state(false);
	let disconnecting = $state(false);

	let isConnected = $derived(syncStatus?.status === 'connected' || syncStatus?.status === 'syncing');

	onMount(() => { loadData(); });

	async function loadData() {
		loading = true;
		try {
			const status = await api.get<SyncStatus>('/integrations/datto/status').catch(() => null);
			syncStatus = status;
			if (status && status.status !== 'disconnected') {
				const [m, h] = await Promise.all([
					api.get<{ mappings: Mapping[] }>('/integrations/datto/mappings').catch(() => ({ mappings: [] })),
					api.get<{ history: HistoryEntry[] }>('/integrations/datto/status').catch(() => ({ history: [] }))
				]);
				mappings = m.mappings;
				history = (h as any).history ?? [];
			}
		} finally { loading = false; }
	}

	async function triggerSync() {
		syncing = true;
		try {
			await api.post('/integrations/datto/sync');
			toasts.success('Sync triggered');
			await loadData();
		} catch (e) {
			toasts.error(e instanceof Error ? e.message : 'Sync failed');
		} finally { syncing = false; }
	}

	async function disconnect() {
		disconnecting = true;
		try {
			await api.delete('/integrations/datto/disconnect');
			toasts.success('Datto Autotask disconnected');
			syncStatus = null;
			mappings = [];
			history = [];
		} catch (e) {
			toasts.error(e instanceof Error ? e.message : 'Disconnect failed');
		} finally {
			disconnecting = false;
			showDisconnect = false;
		}
	}
</script>

<svelte:head>
	<title>Datto Autotask | TenantIQ</title>
</svelte:head>

<div class="space-y-6">
	<div class="flex items-center gap-3">
		<a href="/settings/integrations" class="text-sm text-[var(--color-text-secondary)] hover:text-[var(--color-text)]">&larr; Integrations</a>
	</div>

	<div class="flex items-start justify-between">
		<div>
			<h1 class="text-2xl font-bold text-[var(--color-text)]">Datto Autotask</h1>
			<p class="text-[var(--color-text-secondary)]">Sync companies, tickets, and service desk workflows.</p>
		</div>
		{#if isConnected}
			<button
				onclick={() => (showDisconnect = true)}
				class="rounded-md border border-[var(--color-danger)] px-3 py-1.5 text-sm text-[var(--color-danger)] hover:bg-[var(--color-danger)]/5"
			>
				Disconnect
			</button>
		{/if}
	</div>

	{#if loading}
		<div class="space-y-4">
			{#each Array(3) as _}
				<div class="h-32 animate-pulse rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)]"></div>
			{/each}
		</div>
	{:else if !isConnected}
		<DattoForm onConnected={loadData} />
	{:else if syncStatus}
		<div class="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
			<h2 class="mb-3 text-sm font-semibold text-[var(--color-text)]">Sync Status</h2>
			<IntegrationStatus
				provider="datto"
				status={syncing ? 'syncing' : syncStatus.status}
				lastSyncAt={syncStatus.lastSyncAt}
				errorCount={syncStatus.errorCount}
				onResync={triggerSync}
			/>
			<div class="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-4">
				<div>
					<p class="text-xs text-[var(--color-text-secondary)]">Companies Synced</p>
					<p class="text-lg font-semibold text-[var(--color-text)]">{syncStatus.companiesSynced}</p>
				</div>
				<div>
					<p class="text-xs text-[var(--color-text-secondary)]">Tickets Synced</p>
					<p class="text-lg font-semibold text-[var(--color-text)]">{syncStatus.ticketsSynced}</p>
				</div>
				<div>
					<p class="text-xs text-[var(--color-text-secondary)]">Errors</p>
					<p class="text-lg font-semibold" class:text-[var(--color-danger)]={syncStatus.errorCount > 0} class:text-[var(--color-text)]={syncStatus.errorCount === 0}>
						{syncStatus.errorCount}
					</p>
				</div>
				<div>
					<p class="text-xs text-[var(--color-text-secondary)]">Last Sync</p>
					<p class="text-sm font-medium text-[var(--color-text)]">{syncStatus.lastSyncAt ? formatRelativeTime(syncStatus.lastSyncAt) : 'Never'}</p>
				</div>
			</div>
		</div>

		{#if history.length > 0}
			<div class="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
				<h2 class="mb-3 text-sm font-semibold text-[var(--color-text)]">Sync History</h2>
				<div class="space-y-2">
					{#each history.slice(0, 10) as entry}
						<div class="flex items-center justify-between rounded-md bg-[var(--color-bg-secondary)] px-3 py-2 text-xs">
							<span class="text-[var(--color-text-secondary)]">{formatRelativeTime(entry.startedAt)}</span>
							<span class:text-[var(--color-success)]={entry.status === 'completed'} class:text-[var(--color-danger)]={entry.status === 'failed'} class:text-[var(--color-text-secondary)]={entry.status !== 'completed' && entry.status !== 'failed'}>
								{entry.status}
							</span>
							<span class="text-[var(--color-text-secondary)]">{entry.companiesSynced} companies</span>
							{#if entry.errors > 0}
								<span class="text-[var(--color-danger)]">{entry.errors} errors</span>
							{/if}
						</div>
					{/each}
				</div>
			</div>
		{/if}
	{/if}
</div>

<ConfirmModal
	open={showDisconnect}
	title="Disconnect Datto Autotask"
	description="This will remove the Datto Autotask integration and stop all syncing. Company mappings will be preserved for reconnection."
	confirmLabel="Disconnect"
	destructive={true}
	onConfirm={disconnect}
	onCancel={() => (showDisconnect = false)}
/>
