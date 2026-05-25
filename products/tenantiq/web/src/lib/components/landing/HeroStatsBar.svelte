<script lang="ts">
	interface Stat {
		value: string;
		label: string;
	}

	let { stats }: { stats: Stat[] } = $props();
</script>

<div class="stats-bar">
	{#each stats as stat}
		<div class="stat">
			<span class="stat-num">{stat.value}</span>
			<span class="stat-label">{stat.label}</span>
		</div>
	{/each}
</div>

<style>
	.stats-bar {
		display: flex;
		justify-content: center;
		gap: 3rem;
		margin-top: 3.5rem;
		padding-top: 2.5rem;
		border-top: 1px solid rgba(255,255,255,0.06);
	}

	.stat-num {
		display: block;
		font-size: 1.75rem;
		font-weight: 700;
		color: #e2e8f0;
		letter-spacing: -0.02em;
	}

	.stat-label {
		display: block;
		font-size: 0.75rem;
		color: #94a3b8;
		margin-top: 0.15rem;
		letter-spacing: 0.04em;
		text-transform: uppercase;
		font-weight: 500;
	}

	@media (max-width: 768px) {
		.stats-bar { gap: 1.5rem; flex-wrap: wrap; }
	}

	@media (max-width: 480px) {
		.stat-num { font-size: 1.35rem; }
		.stats-bar { gap: 1rem; display: grid; grid-template-columns: 1fr 1fr; }
		.stat { text-align: center; }
	}
</style>
