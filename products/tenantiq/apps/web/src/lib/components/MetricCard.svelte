<script lang="ts">
	interface Props {
		title: string;
		value: string | number;
		subtitle?: string;
		trend?: { value: number; direction: 'up' | 'down' };
		href?: string;
		icon?: string;
		progress?: number;
		progressColor?: string;
		variant?: 'default' | 'primary' | 'accent';
	}

	let { title, value, subtitle, trend, href, icon, progress, progressColor, variant = 'default' }: Props = $props();

	const iconBgClass = $derived(
		variant === 'primary'
			? 'bg-gradient-to-br from-[var(--brand-500)]/10 to-[var(--brand-600)]/5 text-[var(--brand-500)]'
			: variant === 'accent'
				? 'bg-gradient-to-br from-[var(--accent-500)]/10 to-[var(--accent-600)]/5 text-[var(--accent-500)]'
				: 'bg-[var(--color-bg-secondary)] text-[var(--color-text-secondary)]'
	);
</script>

{#snippet content()}
	<!-- Subtle gradient shimmer on hover -->
	<div class="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-500 group-hover:opacity-100"
		style="background: radial-gradient(circle at 30% 0%, rgba(59, 108, 245, 0.04), transparent 60%);"></div>

	<div class="relative flex items-start justify-between">
		<div class="flex items-center gap-3">
			{#if icon}
				<div class="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg {iconBgClass} ring-1 ring-inset ring-[var(--color-border-subtle)] transition-all duration-500 group-hover:ring-[var(--color-border-strong)]">
					<svg xmlns="http://www.w3.org/2000/svg" class="h-[18px] w-[18px]" fill="none" viewBox="0 0 24 24" stroke-width="1.75" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d={icon} /></svg>
				</div>
			{/if}
			<p class="eyebrow">{title}</p>
		</div>
		{#if href}
			<svg xmlns="http://www.w3.org/2000/svg" class="h-3.5 w-3.5 text-[var(--color-text-tertiary)] transition-all duration-500 group-hover:translate-x-1 group-hover:text-[var(--color-primary)]" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clip-rule="evenodd"/></svg>
		{/if}
	</div>

	<!-- Bold display number -->
	<div class="relative mt-5 flex items-baseline gap-3">
		<p class="text-[36px] font-extrabold leading-none tracking-tighter text-[var(--color-text)] tabular-nums">{value}</p>
		{#if trend}
			<span class="inline-flex items-center gap-1 text-[11px] font-medium tracking-tight {trend.direction === 'up' ? 'text-[var(--brand-600)] dark:text-[var(--brand-400)]' : 'text-[#a82d2d] dark:text-[#d97373]'}" aria-label="{trend.direction === 'up' ? 'Up' : 'Down'} {trend.value} percent">
				<svg xmlns="http://www.w3.org/2000/svg" class="h-2.5 w-2.5 {trend.direction === 'down' ? 'rotate-180' : ''}" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M5.293 9.707a1 1 0 010-1.414l4-4a1 1 0 011.414 0l4 4a1 1 0 01-1.414 1.414L11 7.414V15a1 1 0 11-2 0V7.414L6.707 9.707a1 1 0 01-1.414 0z" clip-rule="evenodd"/></svg>
				{trend.direction === 'up' ? '+' : ''}{trend.value}%
			</span>
		{/if}
	</div>

	{#if subtitle}
		<p class="relative mt-2 text-[12px] italic-serif text-[var(--color-text-secondary)]">{subtitle}</p>
	{/if}

	{#if progress != null}
		<div class="relative mt-5 h-[3px] w-full overflow-hidden rounded-full bg-[var(--color-border-subtle)]">
			<div class="h-full rounded-full animate-fill-bar" style="width: {progress}%; background: {progressColor || 'linear-gradient(90deg, var(--brand-500), var(--brand-600))'}"></div>
		</div>
	{/if}
{/snippet}

{#if href}
	<a {href} class="group relative block cursor-pointer overflow-hidden rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-6 shadow-[var(--shadow-xs)] transition-all duration-500 hover:-translate-y-0.5 hover:border-[var(--color-border-strong)] hover:shadow-[var(--shadow-md)]">
		{@render content()}
	</a>
{:else}
	<div class="group relative overflow-hidden rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-6 shadow-[var(--shadow-xs)] transition-all duration-500 hover:border-[var(--color-border-strong)] hover:shadow-[var(--shadow-sm)]">
		{@render content()}
	</div>
{/if}
