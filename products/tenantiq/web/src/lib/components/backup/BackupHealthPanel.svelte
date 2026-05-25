<script lang="ts">
	import ScoreRing from '$components/ScoreRing.svelte';

	interface Analysis {
		healthScore: number;
		criticalIssues: string[];
		recommendations: { priority: string; action: string; impact: string }[];
		complianceStatus: { gdpr: boolean; hipaa: boolean; soc2: boolean };
		estimatedDataAtRisk: string;
	}

	interface Props { analysis: Analysis }

	let { analysis }: Props = $props();

	function priorityBadge(p: string): string {
		if (p === 'critical') return 'bg-[var(--color-danger)]/15 text-[var(--color-danger)]';
		if (p === 'high') return 'bg-[var(--color-warning)]/15 text-[var(--color-warning)]';
		return 'bg-[var(--color-primary)]/15 text-[var(--color-primary)]';
	}
</script>

<section class="space-y-5 rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-6">
	<div class="flex items-center justify-between">
		<h2 class="text-lg font-semibold text-[var(--color-text)]">Backup Health</h2>
		<ScoreRing score={analysis.healthScore} size={64} strokeWidth={5} label="/100" />
	</div>

	{#if analysis.criticalIssues.length > 0}
		<div class="rounded-lg border border-[var(--color-danger)]/20 bg-[var(--color-danger)]/5 p-4">
			<p class="mb-2 text-xs font-semibold text-[var(--color-danger)]">Critical Issues</p>
			<ul class="space-y-1">
				{#each analysis.criticalIssues as issue}
					<li class="text-sm text-[var(--color-text)]">{issue}</li>
				{/each}
			</ul>
		</div>
	{/if}

	<div class="space-y-2">
		<p class="text-xs font-semibold text-[var(--color-text-secondary)]">Recommendations</p>
		{#each analysis.recommendations as rec}
			<div class="flex items-start gap-3 rounded-lg bg-[var(--color-bg-tertiary)] p-3">
				<span class="shrink-0 rounded px-1.5 py-0.5 text-[10px] font-bold uppercase {priorityBadge(rec.priority)}">{rec.priority}</span>
				<div>
					<p class="text-sm font-medium text-[var(--color-text)]">{rec.action}</p>
					<p class="mt-0.5 text-xs text-[var(--color-text-secondary)]">{rec.impact}</p>
				</div>
			</div>
		{/each}
	</div>

	<div class="flex gap-3">
		{#each [
			{ label: 'GDPR', pass: analysis.complianceStatus.gdpr },
			{ label: 'HIPAA', pass: analysis.complianceStatus.hipaa },
			{ label: 'SOC 2', pass: analysis.complianceStatus.soc2 }
		] as badge}
			<div class="flex-1 rounded-lg p-3 text-center text-xs font-semibold {badge.pass ? 'bg-[var(--color-success)]/10 text-[var(--color-success)]' : 'bg-[var(--color-danger)]/10 text-[var(--color-danger)]'}">
				{badge.pass ? '✓' : '✗'} {badge.label}
			</div>
		{/each}
	</div>

	<div class="rounded-lg bg-[var(--color-bg-tertiary)] p-3 text-sm text-[var(--color-text)]">
		Data at risk: <span class="font-semibold">{analysis.estimatedDataAtRisk}</span>
	</div>
</section>
