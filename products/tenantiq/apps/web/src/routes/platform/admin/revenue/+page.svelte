<script lang="ts">
	/**
	 * Admin Revenue Analytics Page — MRR, churn, ARPU, plan distribution.
	 */
	import Card from '$lib/components/ui/Card.svelte';
	import { auth } from '$stores/auth';
	import { formatRelativeTime } from '$utils/format';
	import { DollarSign, TrendingUp, Users, AlertTriangle } from 'lucide-svelte';

	let loading = $state(true);
	let data = $state<any>(null);
	let error = $state('');

	$effect(() => {
		if ($auth.user) loadRevenue();
	});

	async function loadRevenue() {
		loading = true;
		error = '';
		try {
			const res = await fetch('https://api.tenantiq.app/platform/admin/revenue', {
				credentials: 'include',
			});
			if (!res.ok) throw new Error('Failed to load');
			data = await res.json();
		} catch {
			error = 'Failed to load revenue data';
		} finally {
			loading = false;
		}
	}

	const metrics = $derived(data ? [
		{ label: 'MRR', value: `$${data.mrr?.toLocaleString() ?? '0'}`, icon: DollarSign, color: 'text-green-600' },
		{ label: 'ARR', value: `$${data.arr?.toLocaleString() ?? '0'}`, icon: TrendingUp, color: 'text-blue-600' },
		{ label: 'ARPU', value: `$${data.arpu?.toLocaleString() ?? '0'}`, icon: Users, color: 'text-purple-600' },
		{ label: 'Churn Rate', value: `${data.churnRate ?? 0}%`, icon: AlertTriangle, color: 'text-amber-600' },
	] : []);
</script>

<svelte:head><title>Revenue - Admin - TenantIQ</title></svelte:head>

<h2 class="text-xl font-semibold text-[var(--color-text)] mb-6">Revenue Analytics</h2>

{#if loading}
	<div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
		{#each Array(4) as _}
			<Card variant="elevated" padding="md">
				<div class="h-20 animate-pulse bg-[var(--color-bg-secondary)] rounded"></div>
			</Card>
		{/each}
	</div>
{:else if error}
	<Card variant="elevated" padding="lg">
		<p class="text-sm text-[var(--color-danger)] text-center">{error}</p>
	</Card>
{:else if data}
	<div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
		{#each metrics as m}
			<Card variant="elevated" padding="md">
				<div class="flex items-center gap-3">
					<div class="p-2 rounded-lg bg-[var(--color-bg-secondary)]">
						<m.icon size={20} class={m.color} />
					</div>
					<div>
						<p class="text-xs text-[var(--color-text-secondary)]">{m.label}</p>
						<p class="text-lg font-semibold text-[var(--color-text)]">{m.value}</p>
					</div>
				</div>
			</Card>
		{/each}
	</div>

	<div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
		<!-- Plan Distribution -->
		<Card variant="elevated" padding="none">
			<div class="p-4 border-b border-[var(--color-border)]">
				<h3 class="text-sm font-semibold text-[var(--color-text)]">Plan Distribution</h3>
			</div>
			<div class="p-4 space-y-3">
				{#each data.planDistribution ?? [] as plan}
					<div class="flex items-center justify-between">
						<span class="text-sm text-[var(--color-text)]">{plan.plan}</span>
						<span class="text-sm font-medium text-[var(--color-text-secondary)]">{plan.count} subs</span>
					</div>
				{/each}
				{#if !data.planDistribution?.length}
					<p class="text-sm text-[var(--color-text-secondary)] text-center py-4">No active subscriptions</p>
				{/if}
			</div>
		</Card>

		<!-- Recent Subscriptions -->
		<Card variant="elevated" padding="none">
			<div class="p-4 border-b border-[var(--color-border)]">
				<h3 class="text-sm font-semibold text-[var(--color-text)]">Recent Subscriptions</h3>
			</div>
			<div class="divide-y divide-[var(--color-border)]">
				{#each data.recentSubscriptions ?? [] as sub}
					<div class="px-4 py-3 flex items-center justify-between">
						<div>
							<p class="text-sm font-medium text-[var(--color-text)]">{sub.plan_id}</p>
							<p class="text-xs text-[var(--color-text-secondary)]">{sub.status}</p>
						</div>
						<span class="text-xs text-[var(--color-text-secondary)]">{formatRelativeTime(sub.created_at)}</span>
					</div>
				{/each}
				{#if !data.recentSubscriptions?.length}
					<p class="text-sm text-[var(--color-text-secondary)] text-center py-4">No subscriptions yet</p>
				{/if}
			</div>
		</Card>
	</div>
{/if}
