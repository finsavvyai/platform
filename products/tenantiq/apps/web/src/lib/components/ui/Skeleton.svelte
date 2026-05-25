<script lang="ts">
	interface Props {
		class?: string;
		height?: string;
		count?: number;
		rounded?: string;
	}

	let { class: classes = '', height = 'h-20', count = 1, rounded = 'rounded-xl' }: Props = $props();
</script>

{#each Array(count) as _}
	<div class="{height} w-full animate-pulse rounded-lg bg-[var(--color-bg-secondary)] {rounded} {classes}"></div>
{/each}
