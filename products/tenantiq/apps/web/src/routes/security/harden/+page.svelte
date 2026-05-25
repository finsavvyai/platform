<script lang="ts">
	import { api } from '$api/client';
	import { tenant } from '$stores/tenant';
	import { toasts } from '$stores/toast';
	import HardeningAssessment from '$lib/components/security/HardeningAssessment.svelte';
	import HardeningReview from '$lib/components/security/HardeningReview.svelte';
	import HardeningDryRun from '$lib/components/security/HardeningDryRun.svelte';
	import HardeningExecution from '$lib/components/security/HardeningExecution.svelte';
	import HardeningResults from '$lib/components/security/HardeningResults.svelte';
	import { DEFAULT_ACTIONS, type HardeningAction } from '$lib/components/security/hardening-actions';
	import { untrack } from 'svelte';

	interface AssessmentData {
		total: number;
		critical: number;
		high: number;
		medium: number;
		currentScore: number;
	}

	interface DryRunResult {
		actionId: string;
		willChange: boolean;
		description: string;
	}

	type Step = 'assessment' | 'review' | 'dryrun' | 'execution' | 'results';

	let step = $state<Step>('assessment');
	let assessment = $state<AssessmentData | null>(null);
	let assessmentLoading = $state(false);
	let actions = $state<HardeningAction[]>([]);
	let actionsFailed = $state(0);
	let scoreIncrease = $state(0);
	let preventNavigation = $state(false);
	let dryRunResults = $state<DryRunResult[]>([]);
	let dryRunLoading = $state(false);

	$effect(() => {
		if ($tenant.currentTenantId) {
			untrack(() => loadAssessment());
		}
	});

	async function loadAssessment() {
		assessmentLoading = true;
		try {
			const data = await api.get<AssessmentData>(
				`/tenants/${$tenant.currentTenantId}/security/hardening-assessment`
			);
			assessment = data;
			actions = structuredClone(DEFAULT_ACTIONS);
		} catch (e) {
			toasts.error(e instanceof Error ? e.message : 'Failed to load assessment');
		} finally {
			assessmentLoading = false;
		}
	}

	function goToReview() {
		step = 'review';
	}

	async function goToDryRun() {
		if (!$tenant.currentTenantId) return;
		step = 'dryrun';
		dryRunLoading = true;
		const enabledActions = actions.filter((a) => a.enabled);

		try {
			const results = await api.post<DryRunResult[]>(
				`/tenants/${$tenant.currentTenantId}/security/hardening/dryrun`,
				{ actions: enabledActions.map((a) => ({ id: a.id, apiAction: a.apiAction, product: a.product })) }
			);
			dryRunResults = results;
		} catch (e) {
			toasts.error(e instanceof Error ? e.message : 'Dry-run failed');
			step = 'review';
		} finally {
			dryRunLoading = false;
		}
	}

	async function executeActions() {
		step = 'execution';
		preventNavigation = true;

		const enabledActions = actions.filter((a) => a.enabled);
		let successCount = 0;
		actionsFailed = 0;

		for (const action of enabledActions) {
			const idx = actions.findIndex((a) => a.id === action.id);
			if (idx >= 0) {
				actions[idx].status = 'running';
				actions = actions;
			}

			try {
				if (!$tenant.currentTenantId) throw new Error('Tenant not found');
				await api.post(
					`/tenants/${$tenant.currentTenantId}/security/hardening/execute`,
					{
						actionId: action.id,
						apiAction: action.apiAction,
						product: action.product,
						options: action.options
					}
				);

				const idx = actions.findIndex((a) => a.id === action.id);
				if (idx >= 0) {
					actions[idx].status = 'success';
					actions = actions;
					successCount++;
				}
			} catch (e) {
				const idx = actions.findIndex((a) => a.id === action.id);
				if (idx >= 0) {
					actions[idx].status = 'failed';
					actions[idx].error = e instanceof Error ? e.message : 'Unknown error';
					actions = actions;
					actionsFailed++;
				}
			}
		}

		// Re-run assessment to calculate actual score improvement
		try {
			const newAssessment = await api.get<AssessmentData>(
				`/tenants/${$tenant.currentTenantId}/security/hardening-assessment`
			);
			if (assessment && newAssessment) {
				scoreIncrease = Math.max(0, newAssessment.currentScore - assessment.currentScore);
			}
		} catch {
			// Assessment failed, estimate based on successful actions
			scoreIncrease = Math.floor(successCount * 3);
		}

		preventNavigation = false;
		step = 'results';
	}

	function handleBeforeUnload(e: BeforeUnloadEvent) {
		if (preventNavigation) {
			e.preventDefault();
			e.returnValue = '';
		}
	}

	function handleGoToResults() {
		// step transitions automatically when execution completes
	}
</script>

<svelte:window on:beforeunload={handleBeforeUnload} />
<svelte:head><title>Security Hardening Wizard | TenantIQ</title></svelte:head>

<div class="space-y-6">
	<div class="animate-fade-up">
		<h1 class="text-2xl font-bold text-[var(--color-text)]">Security Hardening Wizard</h1>
		<p class="text-[var(--color-text-secondary)]">
			Automatically harden your Microsoft 365 environment in minutes
		</p>
	</div>

	{#if step === 'assessment'}
		<HardeningAssessment {assessment} {assessmentLoading} {goToReview} />
	{:else if step === 'review'}
		<HardeningReview bind:actions executeActions={goToDryRun} />
	{:else if step === 'dryrun'}
		<HardeningDryRun {dryRunLoading} {dryRunResults} {executeActions} onBack={() => step = 'review'} />
	{:else if step === 'execution'}
		<HardeningExecution {actions} />
	{:else if step === 'results'}
		<HardeningResults {actions} {scoreIncrease} />
	{/if}
</div>
