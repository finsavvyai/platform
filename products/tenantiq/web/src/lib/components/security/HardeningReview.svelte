<script lang="ts">
	import HardeningActionItem from './HardeningActionItem.svelte';

	interface HardeningAction {
		id: string;
		title: string;
		description: string;
		impact: 'Critical' | 'High' | 'Medium';
		affectedCount: number;
		reversible: boolean;
		enabled: boolean;
		status: 'pending' | 'running' | 'success' | 'failed';
	}

	interface Props {
		actions: HardeningAction[];
		executeActions: () => void;
	}

	let { actions = $bindable(), executeActions }: Props = $props();

	function toggleAction(id: string) {
		const idx = actions.findIndex((a) => a.id === id);
		if (idx >= 0) {
			actions[idx].enabled = !actions[idx].enabled;
			actions = actions;
		}
	}

	const enabledCount = $derived(actions.filter((a) => a.enabled).length);
	const totalEnabled = $derived(actions.filter((a) => a.enabled).reduce((sum, a) => sum + a.affectedCount, 0));
</script>

<div class="space-y-6">
	<!-- Header -->
	<div class="animate-fade-up rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-6">
		<h2 class="text-lg font-semibold text-[var(--color-text)]">Review Hardening Actions</h2>
		<p class="mt-1 text-sm text-[var(--color-text-secondary)]">
			Select which actions to apply. All are enabled by default.
		</p>

		<div class="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3">
			<div class="flex flex-col gap-1 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] p-3">
				<span class="text-2xl font-bold text-[var(--color-primary)]">{enabledCount}</span>
				<p class="text-xs text-[var(--color-text-secondary)]">Actions enabled</p>
			</div>
			<div class="flex flex-col gap-1 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] p-3">
				<span class="text-2xl font-bold text-[var(--color-primary)]">{totalEnabled}</span>
				<p class="text-xs text-[var(--color-text-secondary)]">Users affected</p>
			</div>
			<div class="flex flex-col gap-1 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] p-3">
				<span class="text-2xl font-bold text-[#16a34a]">~3 min</span>
				<p class="text-xs text-[var(--color-text-secondary)]">Est. time</p>
			</div>
		</div>
	</div>

	<!-- Actions list -->
	<div class="animate-fade-up delay-1 space-y-3">
		{#each actions as action (action.id)}
			<HardeningActionItem {action} onToggle={toggleAction} />
		{/each}
	</div>

	<!-- Footer buttons -->
	<div class="animate-fade-up delay-2 flex gap-3 rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-6">
		<button
			onclick={executeActions}
			disabled={enabledCount === 0}
			class="flex-1 inline-flex min-h-[44px] items-center justify-center gap-2 rounded-xl bg-[var(--color-primary)] px-6 py-3 text-sm font-medium text-white transition-all duration-200 hover:shadow-[var(--shadow-md)] active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
		>
			<svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
				<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
			</svg>
			Preview Changes ({enabledCount})
		</button>
	</div>
</div>
