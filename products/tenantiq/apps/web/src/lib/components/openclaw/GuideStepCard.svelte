<script lang="ts">
	import type { Snippet } from 'svelte';

	type Props = {
		stepNumber: number;
		title: string;
		active: boolean;
		onActivate: () => void;
		children: Snippet;
	};

	let { stepNumber, title, active, onActivate, children }: Props = $props();
</script>

<div class="step-card" class:active>
	<button class="step-header" onclick={onActivate}>
		<div class="step-number">{stepNumber}</div>
		<h3>{title}</h3>
	</button>

	{#if active}
		<div class="step-content">
			{@render children()}
		</div>
	{/if}
</div>

<style>
	.step-card {
		border: 2px solid #e0e0e0;
		border-radius: 8px;
		overflow: hidden;
		transition: all 0.3s;
	}

	.step-card.active {
		border-color: #0066cc;
		box-shadow: 0 4px 12px rgba(0, 102, 204, 0.1);
	}

	.step-header {
		display: flex;
		align-items: center;
		gap: 1rem;
		padding: 1.5rem;
		cursor: pointer;
		background: #f8f9fa;
		border: none;
		width: 100%;
		text-align: left;
		font: inherit;
	}

	.step-card.active .step-header {
		background: #e3f2fd;
	}

	.step-number {
		width: 40px;
		height: 40px;
		display: flex;
		align-items: center;
		justify-content: center;
		background: #0066cc;
		color: white;
		border-radius: 50%;
		font-weight: 700;
		font-size: 1.25rem;
		flex-shrink: 0;
	}

	.step-header h3 {
		margin: 0;
		color: #1a1a1a;
	}

	.step-content {
		padding: 1.5rem;
		border-top: 1px solid #e0e0e0;
	}

	.step-content :global(p) {
		color: #666;
		margin-bottom: 1rem;
	}

	.step-content :global(ol),
	.step-content :global(ul) {
		margin: 1rem 0 1rem 1.5rem;
		color: #666;
	}

	.step-content :global(li) {
		margin-bottom: 0.5rem;
	}
</style>
