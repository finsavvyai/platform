<script lang="ts">
	interface HardeningAction {
		id: string;
		title: string;
		status: 'pending' | 'running' | 'success' | 'failed';
		error?: string;
	}

	interface Props {
		actions: HardeningAction[];
	}

	let { actions }: Props = $props();

	const executedCount = $derived(
		actions.filter((a) => a.status === 'success' || a.status === 'failed').length
	);
	const totalCount = $derived(actions.length);
	const progressPercent = $derived(Math.round((executedCount / totalCount) * 100));

	function getStatusIcon(status: string) {
		switch (status) {
			case 'success':
				return '✓';
			case 'failed':
				return '✕';
			case 'running':
				return '⟳';
			default:
				return '○';
		}
	}

	function getStatusColor(status: string) {
		switch (status) {
			case 'success':
				return 'text-[#16a34a]';
			case 'failed':
				return 'text-[#dc2626]';
			case 'running':
				return 'text-[var(--color-primary)] animate-spin';
			default:
				return 'text-[var(--color-text-tertiary)]';
		}
	}
</script>

<div class="space-y-6">
	<!-- Progress bar -->
	<div class="animate-fade-up rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-6">
		<div class="mb-2 flex items-center justify-between">
			<h2 class="text-lg font-semibold text-[var(--color-text)]">Applying Security Hardening</h2>
			<span class="text-sm font-medium text-[var(--color-primary)]">{progressPercent}%</span>
		</div>

		<div class="h-2 w-full overflow-hidden rounded-full bg-[var(--color-bg)]">
			<div
				class="h-full bg-gradient-to-r from-[var(--color-primary)] to-[#7c3aed] transition-all duration-500 ease-out"
				style="width: {progressPercent}%"
			></div>
		</div>

		<p class="mt-3 text-sm text-[var(--color-text-secondary)]">
			Completed {executedCount} of {totalCount} actions
		</p>
	</div>

	<!-- Actions timeline -->
	<div class="animate-fade-up delay-1 space-y-2">
		{#each actions as action, i}
			<div
				class="flex items-start gap-4 rounded-lg border transition-all duration-300
					{action.status === 'pending'
						? 'border-[var(--color-border)] bg-[var(--color-bg)]'
						: action.status === 'running'
							? 'border-[var(--color-primary)]/30 bg-[var(--color-primary)]/5'
							: action.status === 'success'
								? 'border-[#16a34a]/30 bg-[#16a34a]/5'
								: 'border-[#dc2626]/30 bg-[#dc2626]/5'} p-3"
			>
				<div class={`mt-1 flex h-6 w-6 items-center justify-center rounded-full text-sm font-bold ${getStatusColor(action.status)}`}>
					{#if action.status === 'running'}
						<svg class="h-5 w-5 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="2"></circle>
							<path
								class="opacity-75"
								fill="currentColor"
								d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
							></path>
						</svg>
					{:else}
						{getStatusIcon(action.status)}
					{/if}
				</div>

				<div class="flex-1 min-w-0">
					<p class="text-sm font-medium text-[var(--color-text)]">{action.title}</p>
					{#if action.status === 'running'}
						<p class="mt-0.5 text-xs text-[var(--color-primary)]">Applying...</p>
					{:else if action.status === 'failed' && action.error}
						<p class="mt-0.5 text-xs text-[#dc2626]">{action.error}</p>
					{/if}
				</div>
			</div>
		{/each}
	</div>
</div>
