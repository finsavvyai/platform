<script lang="ts">
	interface StatItem {
		label: string;
		value: string | number;
		color?: string;
		suffix?: string;
	}

	interface Props {
		stats: StatItem[];
	}

	let { stats }: Props = $props();
</script>

<div class="stat-bar">
	{#each stats as stat, i}
		{#if i > 0}<div class="stat-divider"></div>{/if}
		<div class="stat-item">
			<span class="stat-value" style={stat.color ? `color: ${stat.color};` : ''}>
				{stat.value}{#if stat.suffix}<span class="stat-suffix">{stat.suffix}</span>{/if}
			</span>
			<span class="stat-label">{stat.label}</span>
		</div>
	{/each}
</div>

<style>
	.stat-bar {
		display: flex;
		align-items: center;
		gap: 0;
		padding: 16px 20px;
		border-radius: var(--radius-xl);
		border: 1px solid var(--color-border);
		background: var(--color-surface);
	}
	.stat-divider {
		width: 1px;
		height: 32px;
		background: var(--color-border-subtle);
		margin: 0 24px;
		flex-shrink: 0;
	}
	.stat-item {
		display: flex;
		flex-direction: column;
		gap: 2px;
	}
	.stat-value {
		font-size: 22px;
		font-weight: 700;
		font-variant-numeric: tabular-nums;
		letter-spacing: -0.02em;
		color: var(--color-text);
		line-height: 1;
	}
	.stat-suffix {
		font-size: 14px;
		font-weight: 600;
		margin-left: 2px;
	}
	.stat-label {
		font-size: 11px;
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.05em;
		color: var(--color-text-tertiary);
	}

	@media (max-width: 640px) {
		.stat-bar { flex-wrap: wrap; gap: 16px; }
		.stat-divider { display: none; }
	}
</style>
