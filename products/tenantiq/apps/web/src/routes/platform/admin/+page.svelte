<script lang="ts">
	/**
	 * Platform Admin Overview Page
	 *
	 * Dashboard with key metrics, navigation, and broadcast composer.
	 */
	import PlatformOverview from '$lib/components/admin/PlatformOverview.svelte';
	import BroadcastComposer from '$lib/components/admin/BroadcastComposer.svelte';
	import Card from '$lib/components/ui/Card.svelte';
	import { auth } from '$stores/auth';
	import { api } from '$api/client';
	import { formatRelativeTime } from '$utils/format';

	let loading = $state(true);
	let overviewData = $state<any>(null);
	let recentSignups = $state<any[]>([]);

	$effect(() => {
		if ($auth.user) loadData();
	});

	async function loadData() {
		loading = true;
		try {
			const [overview, stats] = await Promise.all([
				fetch('https://api.tenantiq.app/platform/admin/overview', {
					credentials: 'include',
				}).then((r) => r.json()),
				fetch('https://api.tenantiq.app/platform/admin/stats', {
					credentials: 'include',
				}).then((r) => r.json()),
			]);
			overviewData = overview;
			recentSignups = stats.recentSignups ?? [];
		} catch {
			/* keep defaults */
		} finally {
			loading = false;
		}
	}
</script>

<svelte:head><title>Platform Admin | TenantIQ</title></svelte:head>

<PlatformOverview data={overviewData} {loading} />

<div class="mt-6">
	<BroadcastComposer />
</div>

<!-- Recent Signups -->
<Card variant="elevated" padding="none" class="mt-6">
	<div class="p-6 border-b border-[var(--color-border)]">
		<h2 class="text-lg font-semibold text-[var(--color-text)]">Recent Signups</h2>
	</div>
	<div class="divide-y divide-[var(--color-border)]">
		{#each recentSignups.slice(0, 5) as user}
			<div class="px-6 py-3 flex items-center justify-between hover:bg-[var(--color-bg-secondary)] transition-colors">
				<div>
					<p class="text-sm font-medium text-[var(--color-text)]">{user.name}</p>
					<p class="text-xs text-[var(--color-text-secondary)]">{user.email}</p>
				</div>
				<span class="text-xs text-[var(--color-text-secondary)]">{formatRelativeTime(user.date)}</span>
			</div>
		{/each}
		{#if recentSignups.length === 0 && !loading}
			<div class="px-6 py-8 text-center text-sm text-[var(--color-text-secondary)]">No recent signups</div>
		{/if}
	</div>
</Card>
