<script lang="ts">
	import { CheckCircle, XCircle, X } from 'lucide-svelte';

	interface Check {
		name: string;
		passed: boolean;
		message: string;
	}

	interface Props {
		checks: Check[];
		success: boolean;
		onClose: () => void;
	}

	let { checks, success, onClose }: Props = $props();
</script>

<div class="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
	<div class="flex items-center justify-between mb-3">
		<div class="flex items-center gap-2">
			{#if success}
				<CheckCircle size={16} class="text-[var(--color-success)]" />
				<h4 class="text-sm font-semibold text-[var(--color-success)]">All checks passed</h4>
			{:else}
				<XCircle size={16} class="text-[var(--color-danger)]" />
				<h4 class="text-sm font-semibold text-[var(--color-danger)]">Some checks failed</h4>
			{/if}
		</div>
		<button onclick={onClose} class="cursor-pointer p-1 text-[var(--color-text-tertiary)] hover:text-[var(--color-text)]" aria-label="Close test results">
			<X size={14} />
		</button>
	</div>
	<div class="space-y-2">
		{#each checks as check}
			<div class="flex items-center gap-2 text-xs">
				{#if check.passed}
					<CheckCircle size={12} class="shrink-0 text-[var(--color-success)]" />
				{:else}
					<XCircle size={12} class="shrink-0 text-[var(--color-danger)]" />
				{/if}
				<span class="font-medium text-[var(--color-text)]">{check.name}</span>
				<span class="text-[var(--color-text-secondary)]">{check.message}</span>
			</div>
		{/each}
	</div>
</div>
