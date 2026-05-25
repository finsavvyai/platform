<script lang="ts">
	import { Check, Loader2 } from 'lucide-svelte';

	interface Plan {
		id: string;
		name: string;
		monthly: number;
		annual: number;
		period: string;
		description: string;
		recommended: boolean;
		highlight?: boolean;
		features: string[];
		// lucide-svelte in Svelte 5 exposes icons with `IconProps` which doesn't
		// satisfy the stricter Component signature — accept any component.
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		icon: any;
		accentColor: string;
	}

	let {
		plan,
		isCurrent,
		annual,
		loadingPlan,
		cancelling,
		onCheckout,
		onCancelClick,
	}: {
		plan: Plan;
		isCurrent: boolean;
		annual: boolean;
		loadingPlan: string | null;
		cancelling: boolean;
		onCheckout: (planId: string) => void;
		onCancelClick: () => void;
	} = $props();

	const displayPrice = $derived(plan.monthly === 0 ? null : annual ? plan.annual : plan.monthly);
	const yearlySaving = $derived(plan.monthly > 0 ? (plan.monthly - plan.annual) * 12 : 0);
</script>

<div
	class="group relative flex flex-col rounded-2xl border p-5 transition-all duration-300
	{plan.recommended
		? 'border-[#8b5cf6]/30 bg-[#8b5cf6]/[0.03] shadow-[0_0_24px_rgba(139,92,246,0.06)]'
		: plan.highlight
			? 'border-[#f59e0b]/25 bg-[#f59e0b]/[0.02]'
			: 'border-[var(--color-border)] hover:border-[var(--color-primary)]/20'}"
>
	<!-- Badges -->
	{#if plan.recommended}
		<span
			class="absolute -top-2.5 left-1/2 -translate-x-1/2 rounded-full bg-gradient-to-r from-[#8b5cf6] to-[#6d28d9] px-3 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white shadow-sm"
		>Most Popular</span>
	{/if}
	{#if plan.highlight}
		<span
			class="absolute -top-2.5 left-1/2 -translate-x-1/2 rounded-full bg-gradient-to-r from-[#f59e0b] to-[#d97706] px-3 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white shadow-sm"
		>Best Value</span>
	{/if}
	{#if isCurrent}
		<span
			class="absolute -top-2.5 right-3 rounded-full bg-[var(--color-success)] px-2.5 py-0.5 text-[10px] font-bold uppercase text-white"
		>Current</span>
	{/if}

	<!-- Icon + Name -->
	<div class="mb-3 flex items-center gap-2.5">
		<div
			class="flex h-9 w-9 items-center justify-center rounded-xl transition-transform group-hover:scale-105"
			style="background: {plan.accentColor}15;"
		>
			<plan.icon size={18} style="color: {plan.accentColor};" />
		</div>
		<div>
			<h3 class="text-sm font-bold text-[var(--color-text)]">{plan.name}</h3>
		</div>
	</div>

	<!-- Price -->
	<div class="mb-1 flex items-baseline gap-1">
		{#if displayPrice !== null}
			<span class="text-3xl font-extrabold tracking-tight text-[var(--color-text)]">${displayPrice}</span>
			<span class="text-xs text-[var(--color-text-tertiary)]">{plan.period}</span>
		{:else}
			<span class="text-2xl font-extrabold tracking-tight text-[var(--color-text)]">Custom</span>
		{/if}
	</div>
	{#if annual && yearlySaving > 0}
		<p class="mb-1 text-[10px] font-semibold" style="color: {plan.accentColor};">
			Save ${yearlySaving}/tenant/year
		</p>
	{/if}
	<p class="mb-4 text-[11px] leading-relaxed text-[var(--color-text-secondary)]">{plan.description}</p>

	<!-- Features -->
	<ul class="mb-5 flex-1 space-y-1.5">
		{#each plan.features as feature}
			<li class="flex items-start gap-2 text-[11px] leading-snug text-[var(--color-text-secondary)]">
				<Check size={12} class="mt-0.5 shrink-0" style="color: {plan.accentColor};" />
				{feature}
			</li>
		{/each}
	</ul>

	<!-- CTA -->
	{#if isCurrent}
		<button
			onclick={onCancelClick}
			disabled={cancelling}
			class="w-full cursor-pointer rounded-xl border border-red-200 py-2.5 text-xs font-semibold text-red-500 transition-all hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-red-800 dark:text-red-400 dark:hover:bg-red-900/20"
		>
			{cancelling ? 'Cancelling...' : 'Cancel Subscription'}
		</button>
	{:else if plan.monthly === 0}
		<a
			href="/support"
			class="flex w-full items-center justify-center rounded-xl border border-[var(--color-border)] py-2.5 text-xs font-semibold text-[var(--color-text)] transition-all hover:bg-[var(--color-bg-secondary)]"
		>
			Contact Sales
		</a>
	{:else}
		<button
			onclick={() => onCheckout(plan.id)}
			disabled={loadingPlan !== null}
			class="flex w-full cursor-pointer items-center justify-center gap-2 rounded-xl py-2.5 text-xs font-semibold transition-all disabled:cursor-not-allowed disabled:opacity-50
			{plan.recommended
				? 'bg-gradient-to-r from-[#8b5cf6] to-[#6d28d9] text-white shadow-sm hover:shadow-md'
				: plan.highlight
					? 'bg-gradient-to-r from-[#f59e0b] to-[#d97706] text-white shadow-sm hover:shadow-md'
					: 'border border-[var(--color-border)] text-[var(--color-text)] hover:bg-[var(--color-bg-secondary)]'}"
		>
			{#if loadingPlan === plan.id}
				<Loader2 size={12} class="animate-spin" />
				Creating checkout...
			{:else}
				Start Free Trial
			{/if}
		</button>
	{/if}
</div>
