<script lang="ts">
	let { logos }: { logos: string[] } = $props();
</script>

<div class="logo-bar">
	<p class="logo-bar-label">Trusted frameworks & certifications</p>
	<div class="logo-strip">
		{#each logos as logo}
			<span class="logo-item">{logo}</span>
		{/each}
	</div>
</div>

<style>
	.logo-bar {
		position: relative;
		z-index: 1;
		width: 100%;
		max-width: 720px;
		text-align: center;
		margin-top: 4rem;
		padding-bottom: 2rem;
	}

	.logo-bar-label {
		font-size: 0.7rem;
		text-transform: uppercase;
		letter-spacing: 0.08em;
		color: #475569;
		font-weight: 500;
		margin-bottom: 1.25rem;
	}

	.logo-strip {
		display: flex;
		gap: 1.5rem;
		justify-content: center;
		flex-wrap: wrap;
	}

	.logo-item {
		padding: 0.4rem 1rem;
		border: 1px solid rgba(255,255,255,0.06);
		border-radius: 8px;
		font-size: 0.75rem;
		color: #64748b;
		font-weight: 500;
		letter-spacing: 0.03em;
		background: rgba(255,255,255,0.02);
	}

	@media (max-width: 480px) {
		.logo-strip { gap: 0.5rem; }
		.logo-item { font-size: 0.65rem; padding: 0.3rem 0.75rem; }
	}
</style>
