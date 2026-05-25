<script lang="ts">
	import PurviewScoreRing from '$components/PurviewScoreRing.svelte';

	interface Feature {
		name: string;
		status: 'configured' | 'partial' | 'not_configured' | 'disabled';
		severity: 'critical' | 'high' | 'medium' | 'low';
		remediationSteps: string[];
	}

	let { features, overallScore, dlpCount, labelCount }: {
		features: Feature[];
		overallScore: number;
		dlpCount: number;
		labelCount: number;
	} = $props();

	const totalGaps = $derived(features.reduce((sum, f) => sum + f.remediationSteps.length, 0));
	const passedChecks = $derived(features.filter(f => f.status === 'configured').length);
	const partialChecks = $derived(features.filter(f => f.status === 'partial').length);
	const failedChecks = $derived(features.filter(f => f.status === 'not_configured' || f.status === 'disabled').length);

	const gapFeatures = $derived(features.filter(f => f.remediationSteps.length > 0));

	const statusStyle = (s: string) =>
		s === 'configured' ? 'bg-[var(--color-success)]/15 text-[var(--color-success)]'
		: s === 'partial' ? 'bg-[var(--color-warning)]/15 text-[var(--color-warning)]'
		: 'bg-[var(--color-danger)]/15 text-[var(--color-danger)]';

	const statusLabel = (s: string) =>
		s === 'configured' ? 'Pass' : s === 'partial' ? 'Partial' : 'Missing';

	const severityColors: Record<string, string> = {
		critical: 'text-[var(--color-danger)]',
		high: 'text-[var(--color-warning)]',
		medium: 'text-[var(--color-primary)]',
		low: 'text-[var(--color-text-secondary)]',
	};
</script>

<!-- Top metrics row -->
<div class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
	<!-- Compliance Score -->
	<div class="flex items-center gap-4 rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-6">
		<PurviewScoreRing score={overallScore} />
		<div>
			<p class="text-base font-semibold text-[var(--color-text)]">Compliance Score</p>
			<p class="mt-1 text-sm text-[var(--color-text-secondary)]">{passedChecks} of {features.length} areas configured</p>
		</div>
	</div>

	<!-- Status Breakdown -->
	<div class="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-6">
		<p class="text-sm font-medium text-[var(--color-text-secondary)]">Status Breakdown</p>
		<div class="mt-3 flex items-end gap-4">
			<div class="text-center">
				<p class="text-2xl font-bold text-[var(--color-success)]">{passedChecks}</p>
				<p class="text-xs text-[var(--color-text-secondary)]">Configured</p>
			</div>
			<div class="text-center">
				<p class="text-2xl font-bold text-[var(--color-warning)]">{partialChecks}</p>
				<p class="text-xs text-[var(--color-text-secondary)]">Partial</p>
			</div>
			<div class="text-center">
				<p class="text-2xl font-bold text-[var(--color-danger)]">{failedChecks}</p>
				<p class="text-xs text-[var(--color-text-secondary)]">Missing</p>
			</div>
		</div>
	</div>

	<!-- Security Gaps Count -->
	<div class="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-6">
		<div class="flex items-center justify-between">
			<p class="text-sm font-medium text-[var(--color-text-secondary)]">Security Gaps</p>
			{#if totalGaps > 0}
				<span class="rounded-full bg-[var(--color-danger)]/15 px-2.5 py-1 text-xs font-semibold text-[var(--color-danger)]">{totalGaps} found</span>
			{:else}
				<span class="rounded-full bg-[var(--color-success)]/15 px-2.5 py-1 text-xs font-semibold text-[var(--color-success)]">None</span>
			{/if}
		</div>
		<p class="mt-2 text-3xl font-bold text-[var(--color-text)]">{totalGaps}</p>
		<p class="mt-1 text-sm text-[var(--color-text-secondary)]">{totalGaps > 0 ? 'Issues requiring attention' : 'All controls in place'}</p>
	</div>

	<!-- Protection Assets -->
	<div class="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-6">
		<p class="text-sm font-medium text-[var(--color-text-secondary)]">Protection Assets</p>
		<div class="mt-3 space-y-2">
			<div class="flex items-center justify-between">
				<span class="text-sm text-[var(--color-text)]">DLP Policies</span>
				<span class="text-sm font-semibold text-[var(--color-text)]">{dlpCount}</span>
			</div>
			<div class="flex items-center justify-between">
				<span class="text-sm text-[var(--color-text)]">Sensitivity Labels</span>
				<span class="text-sm font-semibold text-[var(--color-text)]">{labelCount}</span>
			</div>
			<div class="flex items-center justify-between">
				<span class="text-sm text-[var(--color-text)]">Features Scanned</span>
				<span class="text-sm font-semibold text-[var(--color-text)]">{features.length}</span>
			</div>
		</div>
	</div>
</div>

<!-- Areas Scanned -->
<div class="mt-4 rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-6">
	<h3 class="text-sm font-semibold text-[var(--color-text)] mb-3">Areas Scanned</h3>
	<div class="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
		{#each features as feat}
			<div class="flex items-center justify-between rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] px-4 py-3">
				<div class="flex items-center gap-2">
					<span class="text-sm font-medium text-[var(--color-text)]">{feat.name}</span>
					<span class="text-xs font-semibold uppercase {severityColors[feat.severity]}">{feat.severity}</span>
				</div>
				<span class="rounded-full px-2.5 py-1 text-xs font-medium {statusStyle(feat.status)}">{statusLabel(feat.status)}</span>
			</div>
		{/each}
	</div>
</div>

<!-- Individual Security Gaps -->
{#if gapFeatures.length > 0}
	<div class="mt-4 rounded-2xl border border-[var(--color-danger)]/20 bg-[var(--color-danger)]/5 p-6">
		<h3 class="text-sm font-semibold text-[var(--color-danger)] mb-3">Security Gaps ({totalGaps})</h3>
		<div class="space-y-3">
			{#each gapFeatures as feat, fi}
				<div>
					<p class="text-sm font-medium text-[var(--color-text)] mb-1.5">{feat.name}</p>
					<div class="space-y-1.5 pl-4">
						{#each feat.remediationSteps as step, i}
							<div class="flex items-start gap-2">
								<div class="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[var(--color-danger)]/15 text-[10px] font-bold text-[var(--color-danger)]">{i + 1}</div>
								<p class="text-sm text-[var(--color-text-secondary)]">{step}</p>
							</div>
						{/each}
					</div>
				</div>
				{#if fi < gapFeatures.length - 1}
					<div class="border-t border-[var(--color-danger)]/10"></div>
				{/if}
			{/each}
		</div>
	</div>
{/if}
