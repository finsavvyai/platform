<script lang="ts">
	import { formatRelativeTime } from '$utils/format';
	import type { WorkflowRun } from '@tenantiq/shared';

	interface Props {
		runs: WorkflowRun[];
		workflowName: string;
		onClose: () => void;
	}

	let { runs, workflowName, onClose }: Props = $props();
	let expandedRunId = $state<string | null>(null);

	const statusColors: Record<string, string> = {
		completed: 'text-[var(--color-success)]',
		running: 'text-[var(--color-primary)]',
		pending_approval: 'text-[var(--color-warning)]',
		failed: 'text-[var(--color-danger)]',
		cancelled: 'text-[var(--color-text-secondary)]'
	};

	interface StepItem {
		name?: string;
		email?: string;
		detail?: string;
	}

	interface StepResult {
		name: string;
		status: string;
		result: string;
		duration: number;
		items?: StepItem[];
	}

	interface RunResults {
		steps?: StepResult[];
		summary?: string;
	}
</script>

<div class="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
	<div class="mb-3 flex items-center justify-between">
		<h2 class="text-sm font-semibold text-[var(--color-text)]">Runs: {workflowName}</h2>
		<button onclick={onClose} class="text-xs text-[var(--color-text-secondary)] hover:text-[var(--color-text)]">Close</button>
	</div>
	{#if runs.length === 0}
		<p class="text-xs text-[var(--color-text-secondary)]">No runs yet. Click "Run Now" to execute this workflow.</p>
	{:else}
		<div class="space-y-2">
			{#each runs as run}
				{@const results = run.results as RunResults | null}
				<div class="rounded-md bg-[var(--color-bg)] p-2">
					<button class="flex w-full items-center justify-between" onclick={() => (expandedRunId = expandedRunId === run.id ? null : run.id)}>
						<div class="flex items-center gap-2">
							<span class="text-xs font-medium {statusColors[run.status] ?? 'text-[var(--color-text)]'}">{run.status}</span>
							<span class="text-xs text-[var(--color-text-secondary)]">{run.stepsCompleted}/{run.stepsTotal} steps</span>
						</div>
						<span class="text-xs text-[var(--color-text-secondary)]">{formatRelativeTime(run.startedAt)}</span>
					</button>
					{#if expandedRunId === run.id && results}
						<div class="mt-2 space-y-1 border-t border-[var(--color-border)] pt-2">
							{#if results.summary}
								<p class="text-xs font-medium text-[var(--color-text)]">{results.summary}</p>
							{/if}
							{#if results.steps}
								{#each results.steps as step}
									{@const stepColor = step.status === 'success' ? 'text-[var(--color-success)]' : step.status === 'warning' ? 'text-[var(--color-warning)]' : 'text-[var(--color-danger)]'}
									<div class="rounded bg-[var(--color-surface)] px-2 py-1">
										<div class="flex items-start gap-2">
											<span class="text-xs font-medium {stepColor}">{step.status === 'success' ? 'OK' : step.status === 'warning' ? '!!' : 'ERR'}</span>
											<div class="min-w-0 flex-1">
												<span class="text-xs font-medium text-[var(--color-text)]">{step.name}</span>
												<p class="text-xs text-[var(--color-text-secondary)] whitespace-pre-wrap break-words">{step.result}</p>
											</div>
											<span class="shrink-0 text-xs text-[var(--color-text-secondary)]">{step.duration}ms</span>
										</div>
										{#if step.items && step.items.length > 0}
											<details class="mt-1.5 ml-6">
												<summary class="cursor-pointer text-[11px] font-medium text-[var(--color-primary)] hover:underline">Show {step.items.length} affected {step.items.length === 1 ? 'account' : 'accounts'}</summary>
												<div class="mt-1 max-h-64 overflow-y-auto divide-y divide-[var(--color-border)]/60 rounded border border-[var(--color-border)] bg-[var(--color-bg)]">
													{#each step.items as item}
														<div class="flex flex-col gap-0.5 px-2 py-1.5 text-[11px] text-[var(--color-text)]">
															{#if item.name}<span class="font-medium">{item.name}</span>{/if}
															{#if item.email}<span class="text-[var(--color-text-secondary)] font-mono">{item.email}</span>{/if}
															{#if item.detail}<span class="text-[var(--color-text-tertiary)]">{item.detail}</span>{/if}
														</div>
													{/each}
												</div>
											</details>
										{/if}
									</div>
								{/each}
							{/if}
						</div>
					{/if}
				</div>
			{/each}
		</div>
	{/if}
</div>
