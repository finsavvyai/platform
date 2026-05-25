<script lang="ts">
	let { annual = $bindable() }: { annual: boolean } = $props();
</script>

<div class="mb-5 flex items-center justify-center gap-3">
	<span
		class="text-xs font-medium"
		class:text-[var(--color-text)]={!annual}
		class:text-[var(--color-text-tertiary)]={annual}>Monthly</span
	>
	<button
		onclick={() => (annual = !annual)}
		class="relative h-6 w-11 cursor-pointer rounded-full transition-colors duration-200
			{annual ? 'bg-[var(--color-primary)]' : 'bg-[var(--color-border)]'}"
		aria-label="Toggle annual billing"
	>
		<span
			class="absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform duration-200
				{annual ? 'translate-x-5' : 'translate-x-0'}"
		></span>
	</button>
	<span
		class="text-xs font-medium"
		class:text-[var(--color-text)]={annual}
		class:text-[var(--color-text-tertiary)]={!annual}
	>
		Annual
		<span
			class="ml-1 rounded-full bg-[var(--color-primary)]/10 px-1.5 py-0.5 text-[10px] font-bold text-[var(--color-primary)]"
		>
			Save 20%
		</span>
	</span>
</div>
