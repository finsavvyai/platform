<script lang="ts">
	/**
	 * Apple HIG-Compliant Button Component
	 *
	 * Features:
	 * - 44pt minimum touch target
	 * - Semantic color variants
	 * - Scale animation on interaction
	 * - Accessible focus states
	 * - Loading and disabled states
	 */

	import type { HTMLButtonAttributes } from 'svelte/elements';

	interface Props extends HTMLButtonAttributes {
		variant?: 'primary' | 'secondary' | 'destructive' | 'ghost';
		size?: 'sm' | 'md' | 'lg';
		loading?: boolean;
		fullWidth?: boolean;
		icon?: boolean;
	}

	let {
		variant = 'primary',
		size = 'md',
		loading = false,
		fullWidth = false,
		icon = false,
		disabled = false,
		class: className = '',
		children,
		...restProps
	}: Props = $props();

	const baseClasses =
		'relative inline-flex items-center justify-center font-medium rounded-lg tracking-tight transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed disabled:pointer-events-none overflow-hidden active:scale-[0.98] select-none';

	const variantClasses = {
		primary:
			'text-white bg-gradient-to-r from-[var(--brand-500)] to-[var(--brand-600)] shadow-[0_1px_2px_rgba(59,108,245,0.4),inset_0_1px_0_rgba(255,255,255,0.12)] hover:shadow-[0_4px_16px_rgba(59,108,245,0.35),inset_0_1px_0_rgba(255,255,255,0.2)] hover:-translate-y-px',
		secondary:
			'bg-[var(--color-surface)] border border-[var(--color-border)] text-[var(--color-text)] shadow-[var(--shadow-xs)] hover:bg-[var(--color-bg-secondary)] hover:border-[var(--color-border-strong)] hover:shadow-[var(--shadow-sm)]',
		destructive:
			'text-white bg-gradient-to-r from-[#ef4444] to-[#dc2626] shadow-[0_1px_2px_rgba(239,68,68,0.4),inset_0_1px_0_rgba(255,255,255,0.12)] hover:shadow-[0_4px_16px_rgba(239,68,68,0.35)] hover:-translate-y-px',
		ghost:
			'bg-transparent text-[var(--color-text-secondary)] hover:bg-[var(--color-primary-muted)] hover:text-[var(--color-primary)]'
	};

	const sizeClasses = $derived(
		icon
			? {
					sm: 'h-9 w-9 p-2',
					md: 'h-11 w-11 p-2.5',
					lg: 'h-14 w-14 p-3'
				}
			: {
					sm: 'h-9 px-3 text-sm gap-1.5',
					md: 'h-11 px-4 text-base gap-2',
					lg: 'h-14 px-6 text-lg gap-2.5'
				}
	);

	const widthClass = $derived(fullWidth ? 'w-full' : '');

	const classes = $derived(
		`${baseClasses} ${variantClasses[variant]} ${sizeClasses[size]} ${widthClass} ${className}`
	);
</script>

<button class={classes} disabled={disabled || loading} {...restProps}>
	{#if loading}
		<svg
			class="animate-spin h-4 w-4"
			xmlns="http://www.w3.org/2000/svg"
			fill="none"
			viewBox="0 0 24 24"
		>
			<circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"
			></circle>
			<path
				class="opacity-75"
				fill="currentColor"
				d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
			></path>
		</svg>
	{/if}
	{@render children?.()}
</button>

<style>
	button {
		/* Ensure minimum touch target of 44pt */
		min-height: 44px;
	}

	/* No scale on hover — avoids layout shift. Use shadow/opacity transitions instead. */
	button {
		transition: all var(--duration-fast) var(--easing);
	}
</style>
