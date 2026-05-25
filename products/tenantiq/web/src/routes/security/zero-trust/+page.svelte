<script lang="ts">
	import PurviewScoreRing from '$components/PurviewScoreRing.svelte';
	import { tenant } from '$stores/tenant';
	import { api } from '$api/client';
	import { toasts } from '$stores/toast';
	import { safeErrorMessage } from '$lib/utils/safe-error';
	import { untrack } from 'svelte';

	interface ZeroTrustCheck {
		name: string;
		status: 'pass' | 'fail' | 'partial' | 'error';
		evidence: string;
		errorMessage?: string;
	}
	interface ZeroTrustPillar {
		name: string;
		score: number;
		checks: ZeroTrustCheck[];
		recommendations: string[];
	}
	interface AssessmentData {
		overallScore: number;
		maturityLevel: 'initial' | 'advanced' | 'optimal';
		pillars: ZeroTrustPillar[];
		timestamp: string;
	}

	let data = $state<AssessmentData | null>(null);
	let loading = $state(true);
	let running = $state(false);
	let error = $state<string | null>(null);

	$effect(() => {
		if ($tenant.currentTenantId) untrack(() => loadAssessment());
	});

	async function loadAssessment() {
		loading = true;
		error = null;
		try {
			data = await api.get<AssessmentData>('/zero-trust/assessment');
		} catch (err) {
			error = safeErrorMessage(err, 'Failed to load assessment');
		} finally {
			loading = false;
		}
	}

	async function runAssessment() {
		running = true;
		try {
			data = await api.get<AssessmentData>('/zero-trust/assessment');
			toasts.success('Zero Trust assessment complete');
		} catch {
			toasts.error('Assessment failed');
		} finally {
			running = false;
		}
	}

	const pillarIcons: Record<string, string> = {
		Identity: 'M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z',
		Devices: 'M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z',
		Network: 'M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9',
		Applications: 'M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zm10 0a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2z',
		Data: 'M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4',
		Infrastructure: 'M5 12h14M5 12a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2M5 12a2 2 0 00-2 2v4a2 2 0 002 2h14a2 2 0 002-2v-4a2 2 0 00-2-2',
	};

	const maturityLabels: Record<string, string> = {
		initial: 'Initial', advanced: 'Advanced', optimal: 'Optimal',
	};

	const allRecs = $derived(
		data ? data.pillars.flatMap((p) => p.recommendations.map((r) => ({ pillar: p.name, text: r }))) : [],
	);
</script>

<svelte:head>
	<title>Zero Trust Assessment | TenantIQ</title>
</svelte:head>

<div class="space-y-6">
	<div class="flex items-start justify-between gap-4">
		<div>
			<h1 class="text-2xl font-bold text-[var(--color-text)]">Zero Trust Assessment</h1>
			<p class="text-[var(--color-text-secondary)]">Evaluate your tenant security across 6 Zero Trust pillars</p>
		</div>
		<button onclick={runAssessment} disabled={running}
			class="inline-flex min-h-[44px] items-center gap-2 rounded-xl bg-[var(--color-primary)] px-6 py-2.5 text-sm font-medium text-white transition-all duration-200 hover:shadow-[var(--shadow-md)] disabled:opacity-50">
			{#if running}<span class="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white"></span> Running...{:else}{data ? 'Re-Run Assessment' : 'Run Assessment'}{/if}
		</button>
	</div>

	{#if loading}
		<div class="grid grid-cols-1 gap-4 sm:grid-cols-3">
			{#each Array(3) as _}
				<div class="h-32 animate-pulse rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)]"></div>
			{/each}
		</div>
	{:else if error}
		<div class="rounded-xl border border-[var(--color-danger)]/30 bg-[var(--color-danger)]/5 p-4">
			<p class="text-sm text-[var(--color-danger)]">{error}</p>
		</div>
	{:else if data}
		<!-- Overall Score -->
		<div class="flex items-center gap-6 rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-6">
			<PurviewScoreRing score={data.overallScore} />
			<div>
				<p class="text-lg font-semibold text-[var(--color-text)]">Overall Zero Trust Score</p>
				<p class="text-sm text-[var(--color-text-secondary)]">
					Maturity Level: <span class="font-medium text-[var(--color-text)]">{maturityLabels[data.maturityLevel]}</span>
				</p>
				<p class="mt-1 text-xs text-[var(--color-text-secondary)]">Last assessed: {new Date(data.timestamp).toLocaleString()}</p>
			</div>
		</div>

		<!-- Pillar Cards -->
		<div class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
			{#each data.pillars as pillar}
				{@const color = pillar.score >= 70 ? 'var(--color-success)' : pillar.score >= 40 ? 'var(--color-warning)' : 'var(--color-danger)'}
				<div class="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5">
					<div class="flex items-center justify-between">
						<div class="flex items-center gap-2">
							<svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 text-[var(--color-text-secondary)]" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
								<path stroke-linecap="round" stroke-linejoin="round" d={pillarIcons[pillar.name] || pillarIcons.Identity} />
							</svg>
							<h3 class="text-sm font-semibold text-[var(--color-text)]">{pillar.name}</h3>
						</div>
						<span class="text-lg font-bold" style="color: {color}">{pillar.score}%</span>
					</div>
					<div class="mt-3 space-y-1.5">
						{#each pillar.checks as check}
							<div class="flex items-center justify-between text-xs">
								<span class="text-[var(--color-text-secondary)]">{check.name}</span>
								<span title={check.status === 'error' ? (check.errorMessage ?? 'Unable to assess — check Graph API permissions') : check.evidence}
									class="rounded-full px-1.5 py-0.5 font-medium {check.status === 'pass' ? 'bg-[var(--color-success)]/15 text-[var(--color-success)]' : check.status === 'partial' ? 'bg-[var(--color-warning)]/15 text-[var(--color-warning)]' : check.status === 'error' ? 'bg-[var(--color-text-secondary)]/15 text-[var(--color-text-secondary)]' : 'bg-[var(--color-danger)]/15 text-[var(--color-danger)]'}">
									{check.status === 'pass' ? 'Pass' : check.status === 'partial' ? 'Partial' : check.status === 'error' ? 'N/A' : 'Fail'}
								</span>
							</div>
						{/each}
					</div>
					<p class="mt-2 text-[11px] text-[var(--color-text-secondary)]">{pillar.checks.length} checks evaluated</p>
				</div>
			{/each}
		</div>

		<!-- Recommendations -->
		{#if allRecs.length > 0}
			<section class="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5">
				<h2 class="mb-3 text-sm font-semibold text-[var(--color-text)]">Recommendations</h2>
				<div class="space-y-2">
					{#each allRecs as rec, i}
						<div class="flex items-start gap-3 rounded-lg bg-[var(--color-bg)] p-3">
							<span class="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[var(--color-primary)]/15 text-[10px] font-bold text-[var(--color-primary)]">{i + 1}</span>
							<div>
								<p class="text-xs font-medium text-[var(--color-text)]">{rec.text}</p>
								<p class="text-[11px] text-[var(--color-text-secondary)]">{rec.pillar}</p>
							</div>
						</div>
					{/each}
				</div>
			</section>
		{/if}
	{/if}
</div>
