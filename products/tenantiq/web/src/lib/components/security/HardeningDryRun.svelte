<script lang="ts">
	interface DryRunResult {
		actionId: string;
		willChange: boolean;
		description: string;
	}

	interface Props {
		dryRunLoading: boolean;
		dryRunResults: DryRunResult[];
		executeActions: () => Promise<void>;
		onBack: () => void;
	}

	let { dryRunLoading, dryRunResults, executeActions, onBack }: Props = $props();

	let isExecuting = $state(false);

	async function handleExecute() {
		isExecuting = true;
		try {
			await executeActions();
		} finally {
			isExecuting = false;
		}
	}

	const willChange = $derived(dryRunResults.filter((r) => r.willChange).length);
</script>

<div class="space-y-6">
	<div class="animate-fade-up rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-6">
		<div class="mb-6 flex items-center gap-3">
			<div class="flex h-10 w-10 items-center justify-center rounded-full bg-[var(--color-primary)]/10">
				<svg class="h-6 w-6 text-[var(--color-primary)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
				</svg>
			</div>
			<div>
				<h2 class="text-lg font-semibold text-[var(--color-text)]">Preview Changes</h2>
				<p class="text-sm text-[var(--color-text-secondary)]">Review what will be changed before applying</p>
			</div>
		</div>

		{#if dryRunLoading}
			<div class="flex items-center justify-center gap-3 py-8">
				<svg class="h-5 w-5 animate-spin text-[var(--color-primary)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
					<circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="2"></circle>
					<path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
				</svg>
				<span class="text-sm text-[var(--color-text-secondary)]">Analyzing changes...</span>
			</div>
		{:else}
			<div class="mb-6 grid grid-cols-2 gap-4">
				<div class="flex flex-col gap-1 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] p-3">
					<span class="text-2xl font-bold text-[var(--color-primary)]">{dryRunResults.length}</span>
					<p class="text-xs text-[var(--color-text-secondary)]">Total actions</p>
				</div>
				<div class="flex flex-col gap-1 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] p-3">
					<span class="text-2xl font-bold text-[var(--color-warning)]">{willChange}</span>
					<p class="text-xs text-[var(--color-text-secondary)]">Will make changes</p>
				</div>
			</div>

			<div class="max-h-96 space-y-2 overflow-y-auto">
				{#each dryRunResults as result (result.actionId)}
					<div class="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] p-3">
						<div class="flex items-start gap-3">
							{#if result.willChange}
								<svg class="h-5 w-5 flex-shrink-0 text-[var(--color-warning)]" fill="currentColor" viewBox="0 0 20 20">
									<path fill-rule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clip-rule="evenodd" />
								</svg>
							{:else}
								<svg class="h-5 w-5 flex-shrink-0 text-[var(--color-success)]" fill="currentColor" viewBox="0 0 20 20">
									<path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd" />
								</svg>
							{/if}
							<div class="flex-1">
								<p class="text-sm font-medium text-[var(--color-text)]">{result.actionId}</p>
								<p class="mt-0.5 text-xs text-[var(--color-text-secondary)]">{result.description}</p>
							</div>
						</div>
					</div>
				{/each}
			</div>
		{/if}
	</div>

	<!-- Action buttons -->
	<div class="animate-fade-up delay-2 flex gap-3 rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-6">
		<button
			onclick={onBack}
			disabled={dryRunLoading || isExecuting}
			class="flex-1 inline-flex min-h-[44px] items-center justify-center gap-2 rounded-xl border border-[var(--color-border)] px-6 py-3 text-sm font-medium text-[var(--color-text-secondary)] transition-all hover:bg-[var(--color-bg-secondary)] disabled:opacity-50 disabled:cursor-not-allowed"
		>
			Back to Review
		</button>
		<button
			onclick={handleExecute}
			disabled={dryRunLoading || isExecuting || dryRunResults.length === 0}
			class="flex-1 inline-flex min-h-[44px] items-center justify-center gap-2 rounded-xl bg-[var(--color-primary)] px-6 py-3 text-sm font-medium text-white transition-all duration-200 hover:shadow-[var(--shadow-md)] active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
		>
			{#if isExecuting}
				<svg class="h-4 w-4 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
					<circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="2"></circle>
					<path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
				</svg>
				Executing...
			{:else}
				<svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
				</svg>
				Apply Changes
			{/if}
		</button>
	</div>
</div>
