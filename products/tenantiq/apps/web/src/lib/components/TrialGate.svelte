<script lang="ts">
	import { meetsMinimumPlan } from '$lib/config/plan-limits';
	import { Lock } from 'lucide-svelte';
	import type { Snippet } from 'svelte';

	interface Props {
		plan: string;
		feature: string;
		previewCount?: number;
		totalCount: number;
		requiredPlan?: string;
		preview?: Snippet;
		locked?: Snippet;
	}

	let {
		plan,
		feature,
		previewCount = 3,
		totalCount,
		requiredPlan = 'professional',
		preview,
		locked,
	}: Props = $props();

	const isGated = $derived(!meetsMinimumPlan(plan, requiredPlan));
	const hiddenCount = $derived(Math.max(0, totalCount - previewCount));
	const planLabel = $derived(requiredPlan.charAt(0).toUpperCase() + requiredPlan.slice(1));
</script>

{#if preview}{@render preview()}{/if}

{#if isGated && hiddenCount > 0}
	<div class="trial-gate-wrapper">
		{#if locked}
			{@render locked()}
		{:else}
			<div class="trial-gate-overlay">
				<div class="trial-gate-fade"></div>
				<div class="trial-gate-content">
					<div class="trial-gate-icon">
						<Lock size={24} />
					</div>
					<p class="trial-gate-text">
						{hiddenCount} more {feature} available
					</p>
					<a
						href="/settings?tab=billing"
						class="trial-gate-cta"
					>
						Upgrade to {planLabel}
					</a>
					<p class="trial-gate-subtext">
						Unlock full access to all {feature.toLowerCase()}
					</p>
				</div>
			</div>
		{/if}
	</div>
{/if}

<style>
	.trial-gate-wrapper {
		position: relative;
		margin-top: -1rem;
	}

	.trial-gate-overlay {
		position: relative;
		display: flex;
		flex-direction: column;
		align-items: center;
		border-radius: 1rem;
		border: 1px solid var(--color-border);
		background: var(--color-surface);
		overflow: hidden;
		min-height: 12rem;
	}

	.trial-gate-fade {
		position: absolute;
		inset: 0;
		backdrop-filter: blur(8px);
		-webkit-backdrop-filter: blur(8px);
		background: linear-gradient(
			to bottom,
			transparent 0%,
			color-mix(in srgb, var(--color-surface) 60%, transparent) 30%,
			color-mix(in srgb, var(--color-surface) 90%, transparent) 100%
		);
		z-index: 1;
	}

	.trial-gate-content {
		position: relative;
		z-index: 2;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		padding: 2.5rem 1.5rem;
		text-align: center;
		width: 100%;
		height: 100%;
		min-height: 12rem;
	}

	.trial-gate-icon {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 3rem;
		height: 3rem;
		border-radius: 0.75rem;
		background: color-mix(in srgb, var(--color-primary) 10%, transparent);
		color: var(--color-primary);
		margin-bottom: 0.75rem;
	}

	.trial-gate-text {
		font-size: 0.9375rem;
		font-weight: 600;
		color: var(--color-text);
		margin-bottom: 1rem;
	}

	.trial-gate-cta {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		min-height: 2.75rem;
		padding: 0.625rem 2rem;
		border-radius: 0.75rem;
		background: var(--color-primary);
		color: white;
		font-size: 0.875rem;
		font-weight: 600;
		text-decoration: none;
		transition: all 0.2s;
		box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
	}

	.trial-gate-cta:hover {
		opacity: 0.9;
		box-shadow: var(--shadow-md);
	}

	.trial-gate-subtext {
		margin-top: 0.5rem;
		font-size: 0.75rem;
		color: var(--color-text-tertiary);
	}
</style>
