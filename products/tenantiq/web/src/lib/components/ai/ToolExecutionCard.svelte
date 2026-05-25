<script lang="ts">
	interface Props {
		name: string;
		input?: Record<string, unknown>;
		duration?: number;
		success: boolean;
		summary?: string;
		error?: string;
	}

	let { name, input, duration, success, summary, error }: Props = $props();

	let expanded = $state(false);

	function toggleExpanded() {
		expanded = !expanded;
	}

	function formatDuration(ms?: number): string {
		if (!ms) return '';
		return ms < 1000 ? `${ms}ms` : `${(ms / 1000).toFixed(1)}s`;
	}

	function formatToolName(toolName: string): string {
		return toolName.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
	}
</script>

<div
	class="rounded-lg border px-3 py-2 text-sm transition-colors
		{success
		? 'border-green-200 bg-green-50 dark:border-green-900 dark:bg-green-900/10'
		: 'border-red-200 bg-red-50 dark:border-red-900 dark:bg-red-900/10'}"
>
	<button
		onclick={toggleExpanded}
		class="flex w-full items-center justify-between text-left"
		aria-expanded={expanded}
	>
		<div class="flex items-center gap-2">
			<span class="text-xs {success ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}">
				{success ? 'OK' : 'ERR'}
			</span>
			<span class="font-medium text-[var(--color-text)]">{formatToolName(name)}</span>
			{#if duration}
				<span class="text-xs text-[var(--color-text-secondary)]">{formatDuration(duration)}</span>
			{/if}
		</div>
		<svg
			class="h-4 w-4 text-[var(--color-text-secondary)] transition-transform {expanded ? 'rotate-180' : ''}"
			fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"
		>
			<path stroke-linecap="round" stroke-linejoin="round" d="M19 9l-7 7-7-7" />
		</svg>
	</button>

	{#if expanded}
		<div class="mt-2 space-y-2 border-t border-[var(--color-border)] pt-2">
			{#if input && Object.keys(input).length > 0}
				<div>
					<span class="text-xs font-medium text-[var(--color-text-secondary)]">Input</span>
					<pre class="mt-1 overflow-x-auto rounded bg-[var(--color-bg)] p-2 text-xs text-[var(--color-text)]">{JSON.stringify(input, null, 2)}</pre>
				</div>
			{/if}
			{#if success && summary}
				<div>
					<span class="text-xs font-medium text-[var(--color-text-secondary)]">Result</span>
					<pre class="mt-1 overflow-x-auto rounded bg-[var(--color-bg)] p-2 text-xs text-[var(--color-text)]">{summary}</pre>
				</div>
			{/if}
			{#if !success && error}
				<div>
					<span class="text-xs font-medium text-red-600 dark:text-red-400">Error</span>
					<p class="mt-1 text-xs text-red-600 dark:text-red-400">{error}</p>
				</div>
			{/if}
		</div>
	{/if}
</div>
