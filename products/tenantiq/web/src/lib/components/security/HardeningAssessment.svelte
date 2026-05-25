<script lang="ts">
	interface AssessmentData {
		total: number;
		critical: number;
		high: number;
		medium: number;
		currentScore: number;
	}

	interface Props {
		assessment: AssessmentData | null;
		assessmentLoading: boolean;
		goToReview: () => void;
	}

	let { assessment, assessmentLoading, goToReview }: Props = $props();

	const statusIcon = (count: number) => count > 0 ? '⚠️' : '✓';
</script>

<div class="animate-fade-up rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-8">
	<div class="mb-8">
		<h2 class="text-lg font-semibold text-[var(--color-text)]">Security Assessment</h2>
		<p class="text-sm text-[var(--color-text-secondary)]">Analyzing your Microsoft 365 security posture...</p>
	</div>

	{#if assessmentLoading}
		<div class="space-y-4">
			{#each Array(4) as _}
				<div class="h-16 skeleton rounded-lg"></div>
			{/each}
		</div>
	{:else if assessment}
		<div class="mb-8 grid grid-cols-2 gap-4 sm:grid-cols-4">
			<div class="flex flex-col items-center justify-center rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] p-4">
				<span class="text-3xl font-bold text-[var(--color-primary)]">{assessment.total}</span>
				<p class="text-xs text-[var(--color-text-secondary)]">Total Findings</p>
			</div>

			<div class="flex flex-col items-center justify-center rounded-lg border border-[#dc2626]/30 bg-[#dc2626]/5 p-4">
				<span class="text-3xl font-bold text-[#dc2626]">{assessment.critical}</span>
				<p class="text-xs text-[var(--color-text-secondary)]">Critical</p>
			</div>

			<div class="flex flex-col items-center justify-center rounded-lg border border-[#f97316]/30 bg-[#f97316]/5 p-4">
				<span class="text-3xl font-bold text-[#f97316]">{assessment.high}</span>
				<p class="text-xs text-[var(--color-text-secondary)]">High</p>
			</div>

			<div class="flex flex-col items-center justify-center rounded-lg border border-[#eab308]/30 bg-[#eab308]/5 p-4">
				<span class="text-3xl font-bold text-[#eab308]">{assessment.medium}</span>
				<p class="text-xs text-[var(--color-text-secondary)]">Medium</p>
			</div>
		</div>

		<div class="mb-8 flex items-center gap-4 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] p-4">
			<div class="flex-1">
				<p class="text-sm font-medium text-[var(--color-text)]">Current Security Score</p>
				<p class="text-xs text-[var(--color-text-secondary)]">Based on CIS Benchmark assessment</p>
			</div>
			<div class="flex items-baseline gap-1">
				<span class="text-3xl font-bold text-[var(--color-primary)]">{assessment.currentScore}</span>
				<span class="text-sm text-[var(--color-text-secondary)]">/100</span>
			</div>
		</div>

		<div class="mb-6 flex items-center justify-center gap-2 rounded-lg border border-[var(--color-primary)]/30 bg-[var(--color-primary)]/5 p-3">
			<svg class="h-5 w-5 text-[var(--color-primary)]" fill="currentColor" viewBox="0 0 20 20">
				<path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clip-rule="evenodd" />
			</svg>
			<p class="text-sm text-[var(--color-primary)]">
				<strong>Estimated time:</strong> ~3 minutes to harden all findings
			</p>
		</div>

		<button
			onclick={goToReview}
			class="w-full inline-flex min-h-[44px] items-center justify-center gap-2 rounded-xl bg-[var(--color-primary)] px-6 py-3 text-sm font-medium text-white transition-all duration-200 hover:shadow-[var(--shadow-md)] active:scale-[0.98]"
		>
			Start Hardening
			<svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
				<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 7l5 5m0 0l-5 5m5-5H6" />
			</svg>
		</button>
	{/if}
</div>
