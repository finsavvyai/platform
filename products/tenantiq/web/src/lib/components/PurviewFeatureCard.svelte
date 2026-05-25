<script lang="ts">
	interface Policy {
		name: string; state: string; target: string; controls: string[];
		conditions?: Record<string, string>;
		sessionControls?: string[];
		createdAt?: string; modifiedAt?: string;
	}
	interface Feature {
		category: string; name: string; description: string;
		status: 'configured' | 'partial' | 'not_configured' | 'disabled';
		severity: 'critical' | 'high' | 'medium' | 'low';
		details: { current: string; recommended: string; gap: string };
		regulations: string[]; remediationSteps: string[];
		policies?: Policy[];
	}

	interface Props { feature: Feature }
	let { feature: f }: Props = $props();

	let expanded = $state(false);
	let expandedPolicy = $state<string | null>(null);

	function togglePolicy(name: string) { expandedPolicy = expandedPolicy === name ? null : name; }

	const conditionLabels: Record<string, string> = {
		includedUsers: 'Users', excludedUsers: 'Excluded users', includedGroups: 'Groups',
		includedRoles: 'Roles', applications: 'Apps', excludedApps: 'Excluded apps',
		platforms: 'Platforms', locations: 'Locations', signInRisk: 'Sign-in risk',
		userRisk: 'User risk', clientApps: 'Client apps',
	};

	const statusStyles: Record<string, string> = {
		configured: 'bg-[var(--color-success)]/15 text-[var(--color-success)]',
		partial: 'bg-[var(--color-warning)]/15 text-[var(--color-warning)]',
		not_configured: 'bg-[var(--color-danger)]/15 text-[var(--color-danger)]',
		disabled: 'bg-[var(--color-text-secondary)]/15 text-[var(--color-text-secondary)]',
	};
	const statusLabel: Record<string, string> = { configured: 'Configured', partial: 'Partial', not_configured: 'Not Configured', disabled: 'Disabled' };
	const severityColors: Record<string, string> = { critical: 'text-[var(--color-danger)]', high: 'text-[var(--color-warning)]', medium: 'text-[var(--color-primary)]', low: 'text-[var(--color-text-secondary)]' };
	const stateStyle = (s: string) => s === 'Enabled' ? 'bg-[var(--color-success)]/15 text-[var(--color-success)]' : s === 'Report-only' ? 'bg-[var(--color-warning)]/15 text-[var(--color-warning)]' : 'bg-[var(--color-text-secondary)]/15 text-[var(--color-text-secondary)]';
</script>

<div class="w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4 transition-colors hover:bg-[var(--color-bg)]">
	<button type="button" class="flex w-full items-start justify-between gap-3 text-left" onclick={() => expanded = !expanded} aria-expanded={expanded}>
		<div class="min-w-0 flex-1">
			<p class="text-sm font-semibold text-[var(--color-text)]">{f.name}</p>
			<p class="mt-0.5 text-xs text-[var(--color-text-secondary)]">{f.description}</p>
		</div>
		<div class="flex shrink-0 items-center gap-2">
			<span class="text-[10px] font-semibold uppercase {severityColors[f.severity]}">{f.severity}</span>
			<span class="inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium {statusStyles[f.status]}">{statusLabel[f.status]}</span>
		</div>
	</button>

	{#if expanded}
		<div class="mt-3 space-y-4 border-t border-[var(--color-border)] pt-3">
			<!-- Status summary -->
			<div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
				<div class="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] p-3">
					<p class="text-[10px] font-medium uppercase tracking-wide text-[var(--color-text-secondary)]">Current State</p>
					<p class="mt-1 text-sm font-medium text-[var(--color-text)]">{f.details.current}</p>
				</div>
				<div class="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] p-3">
					<p class="text-[10px] font-medium uppercase tracking-wide text-[var(--color-text-secondary)]">Recommended</p>
					<p class="mt-1 text-xs text-[var(--color-text)]">{f.details.recommended}</p>
				</div>
			</div>

			{#if f.policies && f.policies.length > 0}
				<div>
					<p class="text-[10px] font-medium uppercase tracking-wide text-[var(--color-text-secondary)]">Policies ({f.policies.length})</p>
					<div class="mt-1.5 space-y-1">
						{#each f.policies as policy}
							<div class="rounded-lg border border-[var(--color-border)] overflow-hidden">
								<button type="button" class="flex w-full items-center justify-between px-3 py-2 text-left hover:bg-[var(--color-bg-secondary)] transition-colors" onclick={() => togglePolicy(policy.name)}>
									<div class="flex items-center gap-2 min-w-0">
										<span class="text-xs font-medium text-[var(--color-text)] truncate">{policy.name}</span>
										<span class="shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-medium {stateStyle(policy.state)}">{policy.state}</span>
									</div>
									<div class="flex items-center gap-2 shrink-0">
										<span class="text-[10px] text-[var(--color-text-secondary)]">{policy.target}</span>
										<svg xmlns="http://www.w3.org/2000/svg" class="h-3 w-3 text-[var(--color-text-secondary)] transition-transform {expandedPolicy === policy.name ? 'rotate-180' : ''}" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" /></svg>
									</div>
								</button>

								{#if expandedPolicy === policy.name}
									<div class="border-t border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2.5 space-y-2.5">
										<!-- Grant Controls -->
										<div>
											<p class="text-[10px] font-medium uppercase tracking-wide text-[var(--color-text-secondary)]">Grant Controls</p>
											<div class="mt-1 flex flex-wrap gap-1">
												{#each policy.controls as ctrl}
													<span class="rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-2 py-0.5 text-[11px] text-[var(--color-text)]">{ctrl}</span>
												{/each}
											</div>
										</div>

										<!-- Conditions -->
										{#if policy.conditions && Object.keys(policy.conditions).length > 0}
											<div>
												<p class="text-[10px] font-medium uppercase tracking-wide text-[var(--color-text-secondary)]">Conditions</p>
												<div class="mt-1 grid grid-cols-2 gap-x-4 gap-y-1">
													{#each Object.entries(policy.conditions) as [key, value]}
														<div class="flex items-baseline gap-1.5">
															<span class="text-[10px] text-[var(--color-text-secondary)] shrink-0">{conditionLabels[key] || key}:</span>
															<span class="text-[11px] text-[var(--color-text)]">{value}</span>
														</div>
													{/each}
												</div>
											</div>
										{/if}

										<!-- Session Controls -->
										{#if policy.sessionControls && policy.sessionControls.length > 0}
											<div>
												<p class="text-[10px] font-medium uppercase tracking-wide text-[var(--color-text-secondary)]">Session Controls</p>
												<div class="mt-1 flex flex-wrap gap-1">
													{#each policy.sessionControls as sc}
														<span class="rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-2 py-0.5 text-[11px] text-[var(--color-text)]">{sc}</span>
													{/each}
												</div>
											</div>
										{/if}

										<!-- Timestamps -->
										{#if policy.createdAt || policy.modifiedAt}
											<div class="flex gap-4 text-[10px] text-[var(--color-text-secondary)] pt-1 border-t border-[var(--color-border)]">
												{#if policy.createdAt}<span>Created: {new Date(policy.createdAt).toLocaleDateString()}</span>{/if}
												{#if policy.modifiedAt}<span>Modified: {new Date(policy.modifiedAt).toLocaleDateString()}</span>{/if}
											</div>
										{/if}
									</div>
								{/if}
							</div>
						{/each}
					</div>
				</div>
			{/if}

			<!-- Gaps & Remediation -->
			{#if f.remediationSteps.length > 0}
				<div>
					<p class="text-[10px] font-medium uppercase tracking-wide text-[var(--color-text-secondary)] mb-2">Security Gaps ({f.remediationSteps.length})</p>
					<div class="space-y-2">
						{#each f.remediationSteps as step, i}
							<div class="flex items-start gap-3 rounded-lg border border-[var(--color-danger)]/20 bg-[var(--color-danger)]/5 p-3">
								<div class="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[var(--color-danger)]/15 text-[10px] font-bold text-[var(--color-danger)]">{i + 1}</div>
								<div class="min-w-0">
									<p class="text-xs font-medium text-[var(--color-text)]">{step.split(' — ')[0]}</p>
									{#if step.includes(' — ')}
										<p class="mt-0.5 text-[11px] text-[var(--color-text-secondary)]">{step.split(' — ').slice(1).join(' — ')}</p>
									{/if}
								</div>
							</div>
						{/each}
					</div>
				</div>
			{:else}
				<div class="flex items-center gap-2 rounded-lg border border-[var(--color-success)]/20 bg-[var(--color-success)]/5 p-3">
					<svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 text-[var(--color-success)]" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
					<p class="text-xs font-medium text-[var(--color-success)]">All recommended policies are in place</p>
				</div>
			{/if}

			<!-- Regulation tags -->
			<div class="flex items-center gap-2">
				<span class="text-[10px] text-[var(--color-text-secondary)]">Frameworks:</span>
				<div class="flex flex-wrap gap-1">
					{#each f.regulations as reg}
						<span class="rounded bg-[var(--color-primary)]/10 px-1.5 py-0.5 text-[10px] font-medium text-[var(--color-primary)]">{reg}</span>
					{/each}
				</div>
			</div>
		</div>
	{/if}
</div>
