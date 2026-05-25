<script lang="ts">
	import type { Skill } from '$stores/skills';
	import { iconMap } from '$lib/components/skills/skill-icons';
	import { Lock } from 'lucide-svelte';

	interface Props {
		skill: Skill;
		onActivate?: (id: string) => void;
		onDeactivate?: (id: string) => void;
		onTrial?: (id: string) => void;
	}

	let { skill, onActivate, onDeactivate, onTrial }: Props = $props();

	const isFoundation = $derived(skill.includedIn === 'all');

	const tierLabels: Record<string, string> = {
		all: 'All plans',
		core: 'Core+',
		professional: 'Professional+',
		security_suite: 'Security Suite+',
		enterprise: 'Enterprise',
	};

	const statusColors: Record<string, string> = {
		active: 'border-[var(--color-success)]/30 bg-[var(--color-success)]/5',
		trial: 'border-[var(--color-warning)]/30 bg-[var(--color-warning)]/5',
		locked: 'border-[var(--color-border)] bg-[var(--color-surface)]'
	};

	const statusBadge: Record<string, string> = {
		active: 'bg-[var(--color-success)]/15 text-[var(--color-success)]',
		trial: 'bg-[var(--color-warning)]/15 text-[var(--color-warning)]',
		locked: 'bg-[var(--color-text-secondary)]/10 text-[var(--color-text-secondary)]'
	};

	const IconComponent = $derived(iconMap[skill.icon]);
</script>

<div class="group flex h-full flex-col rounded-2xl border p-5 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[var(--shadow-md)] {statusColors[skill.status]}">
	<div class="flex items-start justify-between">
		<div class="flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--color-primary)]/10">
			{#if IconComponent}
				<IconComponent size={20} class="text-[var(--color-primary)]" />
			{/if}
		</div>
		<span class="flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase {statusBadge[skill.status]}">
			{#if skill.status === 'locked'}<Lock size={10} />{/if}
			{skill.status === 'trial' ? `Trial (${skill.trialDaysLeft}d)` : skill.status}
		</span>
	</div>

	<h3 class="mt-3 text-sm font-semibold text-[var(--color-text)]">{skill.name}</h3>
	<p class="mt-1 flex-1 text-xs leading-relaxed text-[var(--color-text-secondary)]">{skill.description}</p>

	<div class="mt-3 flex items-baseline justify-between">
		<p class="text-xs font-medium {skill.status === 'locked' ? 'text-[var(--color-text-secondary)]' : 'text-[var(--color-success)]'}">
			{skill.status === 'locked' ? 'Upgrade required' : 'Included in your plan'}
		</p>
		<span class="rounded-full bg-[var(--color-bg-tertiary)] px-2 py-0.5 text-[10px] font-medium text-[var(--color-text-secondary)]">
			{tierLabels[skill.includedIn] ?? skill.includedIn}
		</span>
	</div>

	<div class="mt-4">
		{#if skill.status === 'active' || skill.status === 'trial'}
			<div class="flex gap-2">
				<a href={skill.href} class="inline-flex min-h-[40px] flex-1 items-center justify-center rounded-lg bg-[var(--color-primary)] px-4 py-2 text-sm font-medium text-white transition-colors hover:opacity-90">
					Open
				</a>
				{#if !isFoundation}
					<button onclick={() => onDeactivate?.(skill.id)} class="min-h-[40px] rounded-lg border border-[var(--color-danger)]/30 px-3 py-2 text-xs font-medium text-[var(--color-danger)] transition-colors hover:bg-[var(--color-danger)]/10">
						Deactivate
					</button>
				{/if}
			</div>
		{:else}
			<div class="flex gap-2">
				<button onclick={() => onTrial?.(skill.id)} class="min-h-[40px] flex-1 rounded-lg border border-[var(--color-border)] px-3 py-2 text-xs font-medium text-[var(--color-text-secondary)] transition-colors hover:bg-[var(--color-bg)]">
					Free Trial
				</button>
				<button onclick={() => onActivate?.(skill.id)} class="min-h-[40px] flex-1 rounded-lg bg-[var(--color-primary)] px-3 py-2 text-xs font-medium text-white transition-colors hover:opacity-90">
					Add to Plan
				</button>
			</div>
		{/if}
	</div>
</div>
