<script lang="ts">
	/**
	 * PlatformOverview — key platform metrics in a grid layout.
	 */
	import Card from '$lib/components/ui/Card.svelte';
	import {
		Server, Users, Building2, AlertTriangle,
		CheckCircle, XCircle, Clock, Loader2
	} from 'lucide-svelte';

	interface OverviewData {
		totalTenants: number;
		totalUsers: number;
		totalOrgs: number;
		activeAlerts: number;
		syncJobs24h: {
			pending: number;
			running: number;
			completed: number;
			failed: number;
		};
	}

	let { data, loading = false }: { data: OverviewData | null; loading?: boolean } = $props();

	const syncTotal = $derived(
		data ? data.syncJobs24h.pending + data.syncJobs24h.running + data.syncJobs24h.completed + data.syncJobs24h.failed : 0
	);
</script>

{#if loading}
	<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
		{#each Array(4) as _}
			<Card variant="elevated" padding="md">
				<div class="animate-pulse space-y-3">
					<div class="h-4 w-24 rounded bg-[var(--color-bg-secondary)]"></div>
					<div class="h-8 w-16 rounded bg-[var(--color-bg-secondary)]"></div>
				</div>
			</Card>
		{/each}
	</div>
{:else if data}
	<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
		<Card variant="elevated" padding="md">
			<div class="flex items-start justify-between">
				<div>
					<p class="text-sm font-medium text-[var(--color-text-secondary)]">Tenants</p>
					<p class="text-3xl font-semibold text-[var(--color-text)] mt-2">{data.totalTenants}</p>
				</div>
				<div class="p-3 rounded-lg bg-[var(--color-primary)] bg-opacity-10">
					<Server class="w-6 h-6 text-[var(--color-primary)]" />
				</div>
			</div>
		</Card>
		<Card variant="elevated" padding="md">
			<div class="flex items-start justify-between">
				<div>
					<p class="text-sm font-medium text-[var(--color-text-secondary)]">Users</p>
					<p class="text-3xl font-semibold text-[var(--color-text)] mt-2">{data.totalUsers}</p>
				</div>
				<div class="p-3 rounded-lg bg-[var(--color-green)] bg-opacity-10">
					<Users class="w-6 h-6 text-[var(--color-green)]" />
				</div>
			</div>
		</Card>
		<Card variant="elevated" padding="md">
			<div class="flex items-start justify-between">
				<div>
					<p class="text-sm font-medium text-[var(--color-text-secondary)]">Organizations</p>
					<p class="text-3xl font-semibold text-[var(--color-text)] mt-2">{data.totalOrgs}</p>
				</div>
				<div class="p-3 rounded-lg bg-[var(--color-success)] bg-opacity-10">
					<Building2 class="w-6 h-6 text-[var(--color-success)]" />
				</div>
			</div>
		</Card>
		<Card variant="elevated" padding="md">
			<div class="flex items-start justify-between">
				<div>
					<p class="text-sm font-medium text-[var(--color-text-secondary)]">Active Alerts</p>
					<p class="text-3xl font-semibold text-[var(--color-text)] mt-2">{data.activeAlerts}</p>
				</div>
				<div class="p-3 rounded-lg bg-[var(--color-danger)] bg-opacity-10">
					<AlertTriangle class="w-6 h-6 text-[var(--color-danger)]" />
				</div>
			</div>
		</Card>
	</div>

	<!-- Sync Job Summary -->
	<Card variant="elevated" padding="md" class="mt-4">
		<h3 class="text-sm font-semibold text-[var(--color-text)] mb-3">Sync Jobs (24h)</h3>
		<div class="flex gap-6 text-sm">
			<div class="flex items-center gap-2">
				<Clock size={14} class="text-[var(--color-text-secondary)]" />
				<span class="text-[var(--color-text-secondary)]">Pending:</span>
				<span class="font-medium text-[var(--color-text)]">{data.syncJobs24h.pending}</span>
			</div>
			<div class="flex items-center gap-2">
				<Loader2 size={14} class="text-[var(--color-primary)]" />
				<span class="text-[var(--color-text-secondary)]">Running:</span>
				<span class="font-medium text-[var(--color-text)]">{data.syncJobs24h.running}</span>
			</div>
			<div class="flex items-center gap-2">
				<CheckCircle size={14} class="text-[var(--color-success)]" />
				<span class="text-[var(--color-text-secondary)]">Completed:</span>
				<span class="font-medium text-[var(--color-text)]">{data.syncJobs24h.completed}</span>
			</div>
			<div class="flex items-center gap-2">
				<XCircle size={14} class="text-[var(--color-danger)]" />
				<span class="text-[var(--color-text-secondary)]">Failed:</span>
				<span class="font-medium text-[var(--color-text)]">{data.syncJobs24h.failed}</span>
			</div>
		</div>
		{#if syncTotal > 0}
			<div class="mt-3 flex h-2 overflow-hidden rounded-full bg-[var(--color-bg-secondary)]">
				{#if data.syncJobs24h.completed > 0}
					<div class="bg-[var(--color-success)]" style="width: {(data.syncJobs24h.completed / syncTotal) * 100}%"></div>
				{/if}
				{#if data.syncJobs24h.running > 0}
					<div class="bg-[var(--color-primary)]" style="width: {(data.syncJobs24h.running / syncTotal) * 100}%"></div>
				{/if}
				{#if data.syncJobs24h.pending > 0}
					<div class="bg-[var(--color-text-tertiary)]" style="width: {(data.syncJobs24h.pending / syncTotal) * 100}%"></div>
				{/if}
				{#if data.syncJobs24h.failed > 0}
					<div class="bg-[var(--color-danger)]" style="width: {(data.syncJobs24h.failed / syncTotal) * 100}%"></div>
				{/if}
			</div>
		{/if}
	</Card>
{/if}
