<script lang="ts">
	/**
	 * OnboardingWizard — 3-step first-time user experience.
	 * Step 1: Welcome + confirm connection
	 * Step 2: Sync data with real-time progress
	 * Step 3: Results summary + go to dashboard
	 */
	import WelcomeStep from './WelcomeStep.svelte';
	import SyncStep from './SyncStep.svelte';
	import ResultsStep from './ResultsStep.svelte';
	import { api } from '$api/client';
	import { triggerSync, startSyncPoller } from './sync-poller';
	import { tenant } from '$stores/tenant';
	import type { DashboardMetrics } from '$lib/types/shared';

	interface Props {
		tenantId: string;
		tenantName?: string;
		onComplete?: () => void;
	}

	let { tenantId, tenantName = 'Your Tenant', onComplete }: Props = $props();

	type Step = 'welcome' | 'sync' | 'results';
	let step = $state<Step>('welcome');
	let syncStarted = $state(false);
	let syncProgress = $state(0);
	let syncStatus = $state('Preparing...');
	let syncError = $state<string | null>(null);
	let resultMetrics = $state<DashboardMetrics | null>(null);
	let stopPoller: (() => void) | undefined;

	const stepLabels = ['Welcome', 'Sync', 'Ready'] as const;

	const currentIdx = $derived(
		step === 'welcome' ? 0 : step === 'sync' ? 1 : 2
	);

	function goToSync() {
		step = 'sync';
	}

	async function handleStartSync() {
		syncStarted = true;
		syncProgress = 0;
		syncStatus = 'Starting sync...';
		syncError = null;
		try {
			await triggerSync(tenantId);
			stopPoller = startSyncPoller(tenantId, {
				onProgress(p, msg) {
					syncProgress = p;
					syncStatus = msg;
				},
				async onComplete() {
					syncProgress = 100;
					syncStatus = 'All set!';
					tenant.markSynced(tenantId);
					try {
						resultMetrics = await api.get<DashboardMetrics>(
							`/tenants/${tenantId}/dashboard`
						);
					} catch { /* proceed without metrics */ }
					step = 'results';
				},
				onError(msg) {
					syncError = msg;
					syncStarted = false;
				}
			});
		} catch {
			syncError = 'Could not start sync. Please try again.';
			syncStarted = false;
		}
	}

	function handleGoToDashboard() {
		onComplete?.();
	}

	$effect(() => () => { stopPoller?.(); });
</script>

<section
	class="relative mx-auto mt-8 max-w-2xl rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-8 shadow-[var(--shadow-md)] sm:p-10"
	aria-label="Setup wizard"
>
	<!-- Step indicator dots -->
	<nav class="mb-10 flex items-center justify-center gap-1" aria-label="Setup progress">
		{#each stepLabels as label, i}
			<div class="flex flex-col items-center gap-1.5">
				<span
					class="flex h-8 w-8 items-center justify-center rounded-full border-2 text-xs font-semibold transition-all duration-300
						{i === currentIdx
							? 'border-[var(--color-primary)] bg-[var(--color-primary)] text-white'
							: i < currentIdx
								? 'border-[var(--color-success)] bg-[var(--color-success)] text-white'
								: 'border-[var(--color-border-strong)] text-[var(--color-text-tertiary)]'}"
					aria-current={i === currentIdx ? 'step' : undefined}
				>
					{#if i < currentIdx}
						<svg width="14" height="14" viewBox="0 0 14 14" fill="none">
							<path d="M3 7.5L5.5 10L11 4" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
						</svg>
					{:else}
						{i + 1}
					{/if}
				</span>
				<span class="text-[11px] font-medium
					{i === currentIdx
						? 'text-[var(--color-primary)]'
						: i < currentIdx
							? 'text-[var(--color-success)]'
							: 'text-[var(--color-text-tertiary)]'}"
				>{label}</span>
			</div>
			{#if i < stepLabels.length - 1}
				<div
					class="mx-2 mb-5 h-0.5 w-10 rounded-full transition-colors duration-300
						{i < currentIdx ? 'bg-[var(--color-success)]' : 'bg-[var(--color-border)]'}"
				></div>
			{/if}
		{/each}
	</nav>

	<!-- Step content -->
	<div class="flex flex-col items-center text-center">
		{#if step === 'welcome'}
			<WelcomeStep {tenantName} onContinue={goToSync} />
		{:else if step === 'sync'}
			<SyncStep
				{syncStarted}
				{syncProgress}
				{syncStatus}
				{syncError}
				onStartSync={handleStartSync}
			/>
		{:else if step === 'results'}
			<ResultsStep metrics={resultMetrics} onGoToDashboard={handleGoToDashboard} />
		{/if}
	</div>
</section>
