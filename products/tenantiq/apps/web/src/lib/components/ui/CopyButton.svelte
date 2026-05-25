<script lang="ts">
	import { toasts } from '$stores/toast';

	interface Props {
		value: string;
		label?: string;
		variant?: 'icon' | 'text';
	}

	let { value, label = 'Copied to clipboard', variant = 'icon' }: Props = $props();
	let copied = $state(false);

	async function copy(e: Event) {
		e.stopPropagation();
		try {
			await navigator.clipboard.writeText(value);
			copied = true;
			toasts.success(label);
			setTimeout(() => { copied = false; }, 2000);
		} catch {
			toasts.error('Failed to copy');
		}
	}
</script>

<button
	type="button"
	onclick={copy}
	class="inline-flex min-h-[44px] items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium transition-all
		{copied
			? 'bg-[var(--color-success)]/10 text-[var(--color-success)]'
			: 'text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-secondary)] hover:text-[var(--color-text)]'}"
	title="Copy to clipboard"
	aria-label="Copy {value} to clipboard"
>
	{#if copied}
		<svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd"/></svg>
		{#if variant === 'text'}<span>Copied</span>{/if}
	{:else}
		<svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M15.666 3.888A2.25 2.25 0 0013.5 2.25h-3c-1.03 0-1.9.693-2.166 1.638m7.332 0c.055.194.084.4.084.612v0a.75.75 0 01-.75.75H9.75a.75.75 0 01-.75-.75v0c0-.212.03-.418.084-.612m7.332 0c.646.049 1.288.11 1.927.184 1.1.128 1.907 1.077 1.907 2.185V19.5a2.25 2.25 0 01-2.25 2.25H6.75A2.25 2.25 0 014.5 19.5V6.257c0-1.108.806-2.057 1.907-2.185a48.208 48.208 0 011.927-.184" /></svg>
		{#if variant === 'text'}<span>Copy</span>{/if}
	{/if}
</button>
