<script lang="ts">
	import type { Severity } from '$lib/types/shared';

	interface RemediationStep { title: string; description: string; effect: string }
	interface AffectedUser { name: string; email: string; role: string }
	interface RemediationPlan {
		impactLevel: Severity; impactExplanation: string; riskScore: number;
		affectedUsers: AffectedUser[]; affectedResources: { name: string; type: string }[];
		steps: RemediationStep[]; estimatedMinutes: number; reversible: boolean;
		positiveOutcomes: string[]; negativeOutcomes: string[]; userEffects: string[];
	}

	interface Props { plan: RemediationPlan }
	let { plan }: Props = $props();

	const impactColor: Record<Severity, string> = {
		critical: 'text-[var(--color-danger)]', high: 'text-[var(--color-warning)]',
		medium: 'text-[var(--color-warning)]', low: 'text-[var(--color-success)]'
	};
</script>

<div class="flex-1 space-y-6 px-6 py-5">
	<section aria-label="Impact analysis">
		<h3 class="text-xs font-semibold text-[var(--color-text-secondary)]">Impact Analysis</h3>
		<div class="mt-3 grid grid-cols-2 gap-4">
			<div class="rounded-lg bg-[var(--color-surface)] p-3">
				<p class="text-xs text-[var(--color-text-secondary)]">Business Impact</p>
				<p class="mt-1 text-sm font-semibold {impactColor[plan.impactLevel]}">{plan.impactLevel}</p>
			</div>
			<div class="rounded-lg bg-[var(--color-surface)] p-3">
				<p class="text-xs text-[var(--color-text-secondary)]">Risk Score</p>
				<div class="mt-1 flex items-center gap-2">
					<div class="h-1.5 flex-1 rounded-full bg-[var(--color-border)]">
						<div class="h-1.5 rounded-full bg-[var(--color-danger)]" style="width:{plan.riskScore}%"></div>
					</div>
					<span class="text-xs font-semibold text-[var(--color-text)]">{plan.riskScore}</span>
				</div>
			</div>
		</div>
		<p class="mt-3 text-sm text-[var(--color-text)]">{plan.impactExplanation}</p>
	</section>

	{#if plan.affectedUsers.length > 0}
		<section aria-label="Affected users">
			<h3 class="text-xs font-semibold text-[var(--color-text-secondary)]">Affected Users ({plan.affectedUsers.length})</h3>
			<ul class="mt-2 divide-y divide-[var(--color-border)] rounded-lg border border-[var(--color-border)]">
				{#each plan.affectedUsers.slice(0, 5) as user}
					<li class="flex items-center justify-between px-3 py-2">
						<div>
							<p class="text-sm font-medium text-[var(--color-text)]">{user.name}</p>
							<p class="text-xs text-[var(--color-text-secondary)]">{user.email}</p>
						</div>
						<span class="text-xs text-[var(--color-text-secondary)]">{user.role}</span>
					</li>
				{/each}
				{#if plan.affectedUsers.length > 5}
					<li class="px-3 py-2 text-xs text-[var(--color-text-secondary)]">+{plan.affectedUsers.length - 5} more</li>
				{/if}
			</ul>
		</section>
	{/if}

	<section aria-label="Remediation plan">
		<h3 class="text-xs font-semibold text-[var(--color-text-secondary)]">Remediation Plan</h3>
		<div class="mt-2 flex items-center gap-4 text-xs text-[var(--color-text-secondary)]">
			<span>~{plan.estimatedMinutes} min</span>
			<span>{plan.reversible ? 'Reversible' : 'Not reversible'}</span>
		</div>
		<ol class="mt-3 space-y-3">
			{#each plan.steps as step, i}
				<li class="rounded-lg bg-[var(--color-surface)] p-3">
					<p class="text-sm font-medium text-[var(--color-text)]">{i + 1}. {step.title}</p>
					<p class="mt-1 text-xs text-[var(--color-text-secondary)]">{step.description}</p>
					<p class="mt-1 text-xs italic text-[var(--color-text-secondary)]">Effect: {step.effect}</p>
				</li>
			{/each}
		</ol>
	</section>

	<section aria-label="Outcome summary" class="grid gap-4 sm:grid-cols-2">
		<div class="rounded-lg border border-[var(--color-success)]/20 bg-[var(--color-success)]/5 p-3">
			<p class="text-xs font-semibold text-[var(--color-success)]">If you remediate</p>
			<ul class="mt-2 space-y-1">
				{#each plan.positiveOutcomes as outcome}
					<li class="text-xs text-[var(--color-text)]">{outcome}</li>
				{/each}
			</ul>
		</div>
		<div class="rounded-lg border border-[var(--color-danger)]/20 bg-[var(--color-danger)]/5 p-3">
			<p class="text-xs font-semibold text-[var(--color-danger)]">If you don't</p>
			<ul class="mt-2 space-y-1">
				{#each plan.negativeOutcomes as outcome}
					<li class="text-xs text-[var(--color-text)]">{outcome}</li>
				{/each}
			</ul>
		</div>
	</section>

	{#if plan.userEffects.length > 0}
		<section aria-label="User effects">
			<h3 class="text-xs font-semibold text-[var(--color-text-secondary)]">How Users Are Affected</h3>
			<ul class="mt-2 space-y-1">
				{#each plan.userEffects as effect}
					<li class="text-sm text-[var(--color-text)]">{effect}</li>
				{/each}
			</ul>
		</section>
	{/if}
</div>
