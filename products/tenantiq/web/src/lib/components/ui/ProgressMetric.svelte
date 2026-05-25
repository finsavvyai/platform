<script lang="ts">
	interface Props {
		label: string;
		value: number;
		max?: number;
		color?: string;
		size?: 'sm' | 'md';
		showValue?: boolean;
	}

	let { label, value, max = 100, color, size = 'sm', showValue = true }: Props = $props();

	const percent = $derived(Math.min(100, Math.round((value / max) * 100)));
	const barColor = $derived(
		color || (percent >= 80 ? 'var(--color-success)' : percent >= 50 ? 'var(--color-warning)' : 'var(--color-danger)')
	);
</script>

<div class="progress-metric" class:md={size === 'md'}>
	<div class="progress-top">
		<span class="progress-label">{label}</span>
		{#if showValue}
			<span class="progress-value" style="color: {barColor};">{value}{#if max !== 100}<span class="progress-max">/{max}</span>{/if}</span>
		{/if}
	</div>
	<div class="progress-track" class:track-md={size === 'md'}>
		<div class="progress-fill animate-fill-bar" style="width: {percent}%; background: {barColor};"></div>
	</div>
</div>

<style>
	.progress-metric {
		display: flex;
		flex-direction: column;
		gap: 6px;
	}
	.progress-top {
		display: flex;
		align-items: center;
		justify-content: space-between;
	}
	.progress-label {
		font-size: 13px;
		font-weight: 500;
		color: var(--color-text);
	}
	.progress-value {
		font-size: 14px;
		font-weight: 700;
		font-variant-numeric: tabular-nums;
		letter-spacing: -0.01em;
	}
	.progress-max {
		font-size: 11px;
		font-weight: 500;
		color: var(--color-text-tertiary);
	}
	.progress-track {
		height: 4px;
		border-radius: 2px;
		background: var(--color-border-subtle);
		overflow: hidden;
	}
	.track-md { height: 6px; border-radius: 3px; }
	.progress-fill {
		height: 100%;
		border-radius: inherit;
		transition: width 0.6s var(--easing);
	}
</style>
