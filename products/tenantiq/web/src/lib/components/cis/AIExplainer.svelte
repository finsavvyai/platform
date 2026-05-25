<script lang="ts">
	import { Sparkles, Loader2 } from 'lucide-svelte';
	import { api } from '$api/client';
	import { onMount } from 'svelte';

	interface Props {
		controlId: string;
	}

	let { controlId }: Props = $props();

	let loading = $state(true);
	let explanation = $state<string | null>(null);
	let source = $state<'cache' | 'claude' | 'static-fallback' | null>(null);
	let error = $state<string | null>(null);

	onMount(async () => {
		try {
			const res = await api.post<{ explanation: string; source: 'cache' | 'claude' | 'static-fallback' }>(
				'/cis-benchmark/explain',
				{ controlId },
			);
			explanation = res.explanation;
			source = res.source;
		} catch (e) {
			error = e instanceof Error ? e.message : 'Could not load explanation';
		} finally {
			loading = false;
		}
	});
</script>

<div class="ai-explainer">
	<div class="ai-head">
		<div class="ai-title">
			<Sparkles size={14} />
			<span>AI explanation</span>
		</div>
		{#if source}
			<span class="ai-source" class:claude={source === 'claude'}>
				{source === 'claude' ? 'Claude' : source === 'cache' ? 'Cached' : 'Static fallback'}
			</span>
		{/if}
	</div>

	{#if loading}
		<div class="ai-loading">
			<Loader2 size={14} class="spin" />
			<span>Analysing control + tenant context...</span>
		</div>
	{:else if error}
		<p class="ai-error">{error}</p>
	{:else if explanation}
		<div class="ai-body">{explanation}</div>
	{/if}
</div>

<style>
	.ai-explainer {
		padding: 0.875rem 1rem;
		border-radius: 0.5rem;
		background: color-mix(in srgb, var(--color-primary) 6%, var(--color-surface));
		border: 1px solid color-mix(in srgb, var(--color-primary) 25%, transparent);
		margin-bottom: 0.75rem;
	}
	.ai-head { display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.5rem; }
	.ai-title { display: inline-flex; align-items: center; gap: 0.375rem; font-size: 0.75rem; font-weight: 600; color: var(--color-primary); text-transform: uppercase; letter-spacing: 0.04em; }
	.ai-source { font-size: 0.6875rem; color: var(--color-text-tertiary); padding: 0.125rem 0.375rem; border-radius: 0.25rem; background: var(--color-bg-tertiary); }
	.ai-source.claude { color: var(--color-primary); background: color-mix(in srgb, var(--color-primary) 15%, transparent); font-weight: 500; }
	.ai-loading { display: flex; align-items: center; gap: 0.5rem; color: var(--color-text-secondary); font-size: 0.8125rem; padding: 0.5rem 0; }
	:global(.ai-loading .spin) { animation: spin 1s linear infinite; }
	@keyframes spin { to { transform: rotate(360deg); } }
	.ai-error { margin: 0; font-size: 0.8125rem; color: var(--color-danger); }
	.ai-body { font-size: 0.875rem; line-height: 1.5; color: var(--color-text); white-space: pre-wrap; }
</style>
