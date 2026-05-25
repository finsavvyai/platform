<script lang="ts">
	/**
	 * Apple HIG-Compliant Card Component
	 *
	 * Features:
	 * - Subtle elevation with shadows
	 * - 12-16pt corner radius
	 * - Consistent padding (16-20pt)
	 * - Optional hover effects
	 * - Semantic variants
	 */

	import type { HTMLAttributes } from 'svelte/elements';

	interface Props extends HTMLAttributes<HTMLDivElement> {
		variant?: 'default' | 'elevated' | 'outlined' | 'flat';
		padding?: 'none' | 'sm' | 'md' | 'lg';
		hoverable?: boolean;
		clickable?: boolean;
	}

	let {
		variant = 'default',
		padding = 'md',
		hoverable = false,
		clickable = false,
		class: className = '',
		children,
		...restProps
	}: Props = $props();

	const baseClasses = 'relative rounded-xl transition-all duration-500 overflow-hidden';

	const variantClasses = {
		default: 'bg-[var(--color-surface)] border border-[var(--color-border)] shadow-[var(--shadow-xs)]',
		elevated: 'bg-[var(--color-surface-elevated)] border border-[var(--color-border-subtle)] shadow-[var(--shadow-md)]',
		outlined: 'bg-transparent border border-[var(--color-border-strong)]',
		flat: 'bg-[var(--color-bg-secondary)] border border-[var(--color-border-subtle)]'
	};

	const paddingClasses = {
		none: 'p-0',
		sm: 'p-4',
		md: 'p-6',
		lg: 'p-8 md:p-10'
	};

	const interactiveClasses = $derived(
		hoverable || clickable
			? 'hover:shadow-[var(--shadow-md)] hover:border-[var(--color-border-strong)]'
			: ''
	);
	const cursorClass = $derived(clickable ? 'cursor-pointer active:shadow-[var(--shadow-xs)]' : '');

	const classes = $derived(
		`${baseClasses} ${variantClasses[variant]} ${paddingClasses[padding]} ${interactiveClasses} ${cursorClass} ${className}`
	);
</script>

{#if clickable}
	<div class={classes} role="button" tabindex="0" {...restProps}>
		{@render children?.()}
	</div>
{:else}
	<div class={classes} {...restProps}>
		{@render children?.()}
	</div>
{/if}

<style>
	div {
		transition: all var(--duration-normal) var(--easing);
	}

	/* Apple's subtle shadow elevation */
	div:hover {
		transition: all var(--duration-fast) var(--easing);
	}
</style>
