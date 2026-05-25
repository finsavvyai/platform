<script lang="ts">
	import Button from '$components/ui/Button.svelte';
	import Skeleton from '$components/ui/Skeleton.svelte';
	import ScoreRing from '$components/ScoreRing.svelte';
	import type { DashboardMetrics } from '@tenantiq/shared';

	interface Props {
		metrics: DashboardMetrics | null;
		loading?: boolean;
		error?: string | null;
		onGoToDashboard: () => void;
	}

	let { metrics, loading = false, error = null, onGoToDashboard }: Props = $props();

	const userCount = $derived(metrics?.userBreakdown?.total ?? 0);
	const licenseCount = $derived(metrics?.licenseBreakdown?.length ?? 0);
	const alertCount = $derived(
		(metrics?.activeAlerts?.critical ?? 0) +
		(metrics?.activeAlerts?.high ?? 0) +
		(metrics?.activeAlerts?.medium ?? 0) +
		(metrics?.activeAlerts?.low ?? 0)
	);
	const secureScore = $derived(metrics?.secureScore ?? null);
</script>

<div class="flex flex-col items-center animate-fade-up">
	{#if loading}
		<Skeleton height="h-16" count={1} rounded="rounded-2xl" class="mb-6 w-16" />
		<Skeleton height="h-8" count={1} rounded="rounded-lg" class="mb-2 w-48" />
		<Skeleton height="h-6" count={1} rounded="rounded-lg" class="mb-8 w-64" />
		<Skeleton height="h-24" count={1} rounded="rounded-2xl" class="mb-6 w-32" />
		<div class="mb-8 grid w-full max-w-sm grid-cols-3 gap-3">
			{#each Array(3) as _}
				<Skeleton height="h-20" count={1} rounded="rounded-xl" />
			{/each}
		</div>
		<Skeleton height="h-11" count={1} rounded="rounded-xl" class="w-32" />
	{:else if error}
		<div class="mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-[var(--color-warning)]/10">
			<svg xmlns="http://www.w3.org/2000/svg" class="h-8 w-8 text-[var(--color-warning)]" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
				<path stroke-linecap="round" stroke-linejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126z" />
			</svg>
		</div>

		<h2 class="mb-2 text-2xl font-bold tracking-tight text-[var(--color-text)]">
			Setup complete
		</h2>
		<p class="mb-8 max-w-md text-[15px] leading-relaxed text-[var(--color-text-secondary)]">
			Your dashboard is ready. Some metrics may take a moment to populate. You can view detailed insights now.
		</p>

		<Button variant="primary" size="lg" onclick={onGoToDashboard}>Go to Dashboard</Button>
		<p class="mt-3 text-[13px] text-[var(--color-text-tertiary)]">
			You can always re-sync from Settings.
		</p>
	{:else}
		<div class="mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-[var(--color-success)]/10">
			<svg xmlns="http://www.w3.org/2000/svg" class="h-8 w-8 text-[var(--color-success)]" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
				<path stroke-linecap="round" stroke-linejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
			</svg>
		</div>

		<h2 class="mb-2 text-2xl font-bold tracking-tight text-[var(--color-text)]">
			Your tenant at a glance
		</h2>
		<p class="mb-8 max-w-md text-[15px] leading-relaxed text-[var(--color-text-secondary)]">
			Here's a quick snapshot of what we found. Your dashboard is ready with detailed insights.
		</p>

		{#if secureScore !== null}
			<div class="mb-6">
				<ScoreRing score={secureScore} size={96} label="Security Score" />
			</div>
		{/if}

		<div class="mb-8 grid w-full max-w-sm grid-cols-2 gap-3 sm:grid-cols-3">
			<div class="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] p-4 text-center">
				<p class="text-2xl font-bold text-[var(--color-text)]">{userCount}</p>
				<p class="mt-1 text-[13px] text-[var(--color-text-secondary)]">Users</p>
			</div>
			<div class="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] p-4 text-center">
				<p class="text-2xl font-bold text-[var(--color-text)]">{licenseCount}</p>
				<p class="mt-1 text-[13px] text-[var(--color-text-secondary)]">License SKUs</p>
			</div>
			<div class="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] p-4 text-center">
				<p class="text-2xl font-bold text-[var(--color-text)]">{alertCount}</p>
				<p class="mt-1 text-[13px] text-[var(--color-text-secondary)]">Alerts</p>
			</div>
		</div>

		<Button variant="primary" size="lg" onclick={onGoToDashboard}>Go to Dashboard</Button>
		<p class="mt-3 text-[13px] text-[var(--color-text-tertiary)]">
			You can always re-sync from Settings.
		</p>
	{/if}
</div>
