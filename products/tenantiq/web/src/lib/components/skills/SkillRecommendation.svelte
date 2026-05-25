<script lang="ts">
	import type { Skill } from '$stores/skills';
	import { iconMap } from '$lib/components/skills/skill-icons';

	interface Props {
		skill: Skill;
		reason: string;
		benefit: string;
		onTrial?: (id: string) => void;
	}

	let { skill, reason, benefit, onTrial }: Props = $props();

	const IconComponent = $derived(iconMap[skill.icon]);
</script>

<div class="rounded-2xl border border-[var(--color-primary)]/20 bg-[var(--color-primary)]/5 p-5">
	<div class="flex items-start gap-3">
		<div class="flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--color-primary)]/15">
			{#if IconComponent}
				<IconComponent size={20} class="text-[var(--color-primary)]" />
			{/if}
		</div>
		<div class="flex-1">
			<div class="flex items-center gap-2">
				<h3 class="text-sm font-semibold text-[var(--color-text)]">{skill.name}</h3>
				<span class="rounded-full bg-[var(--color-primary)]/15 px-2 py-0.5 text-[10px] font-semibold text-[var(--color-primary)]">Recommended</span>
			</div>
			<p class="mt-1 text-xs text-[var(--color-text-secondary)]">{reason}</p>
			<p class="mt-2 text-xs font-medium text-[var(--color-success)]">{benefit}</p>
			{#if skill.price}
				<p class="mt-2 text-xs text-[var(--color-text-secondary)]">${skill.price}/mo -- 7-day free trial</p>
			{/if}
		</div>
	</div>
	<div class="mt-4 flex gap-2">
		<button onclick={() => onTrial?.(skill.id)} class="min-h-[44px] flex-1 rounded-lg bg-[var(--color-primary)] px-4 py-2 text-sm font-medium text-white transition-colors hover:opacity-90">Start 7-Day Trial</button>
		<button class="min-h-[44px] rounded-lg border border-[var(--color-border)] px-4 py-2 text-sm font-medium text-[var(--color-text-secondary)] transition-colors hover:bg-[var(--color-bg)]">Later</button>
	</div>
</div>
