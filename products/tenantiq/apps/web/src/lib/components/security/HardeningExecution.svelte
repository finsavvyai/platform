<script lang="ts">
	import HardeningProgress from './HardeningProgress.svelte';

	interface HardeningAction {
		id: string;
		title: string;
		description?: string;
		status: 'pending' | 'running' | 'success' | 'failed';
		error?: string;
	}

	interface Props {
		actions: HardeningAction[];
	}

	let { actions }: Props = $props();
</script>

<div class="space-y-6">
	<div class="animate-fade-up rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-6">
		<div class="mb-6 flex items-center gap-3">
			<div class="flex h-10 w-10 items-center justify-center rounded-full bg-[var(--color-primary)]/10">
				<svg class="h-6 w-6 animate-spin text-[var(--color-primary)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
					<circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="2"></circle>
					<path
						class="opacity-75"
						fill="currentColor"
						d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
					></path>
				</svg>
			</div>
			<div>
				<h2 class="text-lg font-semibold text-[var(--color-text)]">Hardening in Progress</h2>
				<p class="text-sm text-[var(--color-text-secondary)]">Please keep this window open. Don't navigate away.</p>
			</div>
		</div>

		<HardeningProgress {actions} />
	</div>
</div>
