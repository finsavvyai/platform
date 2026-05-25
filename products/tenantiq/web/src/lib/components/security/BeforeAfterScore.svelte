<script lang="ts">
	import { untrack } from 'svelte';

	interface Props {
		before: number;
		after: number;
	}

	let { before, after }: Props = $props();

	let displayedBefore = $state(untrack(() => before));
	let displayedAfter = $state(untrack(() => before));

	$effect(() => {
		if (after > before) {
			const duration = 1000;
			const startTime = Date.now();

			const animate = () => {
				const elapsed = Date.now() - startTime;
				const progress = Math.min(elapsed / duration, 1);

				displayedAfter = Math.floor(before + (after - before) * progress);

				if (progress < 1) {
					requestAnimationFrame(animate);
				} else {
					displayedAfter = after;
				}
			};

			requestAnimationFrame(animate);
		}
	});

	const improvement = $derived(after - before);
	const improvementPercent = $derived(before > 0 ? Math.round(((after - before) / before) * 100) : 0);
</script>

<div class="grid grid-cols-2 gap-6">
	<!-- Before -->
	<div class="flex flex-col items-center justify-center rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] p-6">
		<p class="mb-4 text-xs font-medium text-[var(--color-text-secondary)]">BEFORE</p>
		<div class="flex items-baseline gap-1">
			<span class="text-4xl font-bold text-[#ef4444]">{displayedBefore}</span>
			<span class="text-lg text-[var(--color-text-tertiary)]">/100</span>
		</div>
	</div>

	<!-- After -->
	<div class="flex flex-col items-center justify-center rounded-xl border border-[#16a34a]/30 bg-[#16a34a]/5 p-6">
		<p class="mb-4 text-xs font-medium text-[var(--color-text-secondary)]">AFTER</p>
		<div class="flex items-baseline gap-1">
			<span class="text-4xl font-bold text-[#16a34a]">{displayedAfter}</span>
			<span class="text-lg text-[var(--color-text-tertiary)]">/100</span>
		</div>
	</div>
</div>

<!-- Improvement badge -->
{#if improvement > 0}
	<div class="flex items-center justify-center gap-2 rounded-full bg-[#16a34a]/10 px-4 py-2">
		<svg class="h-5 w-5 text-[#16a34a]" fill="currentColor" viewBox="0 0 20 20">
			<path fill-rule="evenodd" d="M12 7a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0V9.414l-4.293 4.293a1 1 0 01-1.414-1.414L13.586 8H12z" clip-rule="evenodd" />
		</svg>
		<span class="text-sm font-semibold text-[#16a34a]">+{improvement} points (+{improvementPercent}%)</span>
	</div>
{/if}
