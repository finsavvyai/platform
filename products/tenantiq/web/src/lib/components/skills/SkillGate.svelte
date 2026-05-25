<script lang="ts">
	import { skills, skillsControl, CATEGORY_LABELS } from '$stores/skills';
	import type { Skill } from '$stores/skills';
	import { toasts } from '$stores/toast';
	import { tenant } from '$stores/tenant';
	import { get } from 'svelte/store';
	import { api } from '$lib/api/client';

	interface Props {
		skillId: string;
		children: any;
		/** Set from a caught SkillGateError to show the gate from API 403 */
		serverBlocked?: { skillId: string; skillName: string; price: number } | null;
	}

	let { skillId, children, serverBlocked = null }: Props = $props();

	const skill = $derived($skills.find(s => s.id === skillId));
	const isLocked = $derived(!!serverBlocked || skill?.status === 'locked');
	const displayName = $derived(serverBlocked?.skillName ?? skill?.name ?? skillId);
	const displayPrice = $derived(serverBlocked?.price ?? skill?.price ?? 0);
	const displayDesc = $derived(skill?.description ?? 'This feature is locked');
	const categoryLabel = $derived(skill ? CATEGORY_LABELS[skill.category] : '');

	async function handleTrial() {
		const tid = get(tenant).currentTenantId;
		if (!tid) return;
		try {
			await api.post(`/tenants/${tid}/skills/activate`, { skillId, trial: true });
			skillsControl.startTrial(skillId, 7);
			toasts.success(`${displayName} trial started - 7 days free`);
		} catch {
			toasts.error('Failed to start trial. Please try again.');
		}
	}

	async function handleActivate() {
		const tid = get(tenant).currentTenantId;
		if (!tid) return;
		try {
			await api.post(`/tenants/${tid}/skills/activate`, { skillId });
			skillsControl.activate(skillId);
			toasts.success(`${displayName} activated`);
		} catch {
			toasts.error('Failed to activate skill. Please try again.');
		}
	}
</script>

{#if isLocked}
	<div class="mx-auto max-w-2xl px-4 py-16 text-center">
		<div class="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-10">
			<div class="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-[var(--color-primary)]/10">
				<svg xmlns="http://www.w3.org/2000/svg" class="h-8 w-8 text-[var(--color-primary)]" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z"/></svg>
			</div>
			<h1 class="mt-5 text-2xl font-bold text-[var(--color-text)]">{displayName}</h1>
			<p class="mt-2 text-sm text-[var(--color-text-secondary)]">{displayDesc}</p>

			{#if displayPrice > 0}
				<div class="mt-6 rounded-xl bg-[var(--color-bg-tertiary)] px-6 py-4">
					<p class="text-3xl font-bold text-[var(--color-text)]">${displayPrice}<span class="text-base font-normal text-[var(--color-text-secondary)]">/mo</span></p>
					<p class="mt-1 text-xs text-[var(--color-text-secondary)]">${Math.round(displayPrice * 10.8)}/year (save ~10%)</p>
				</div>
			{/if}

			<div class="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-center">
				<button onclick={handleTrial} class="min-h-[44px] rounded-xl border border-[var(--color-border)] px-6 py-2.5 text-sm font-medium text-[var(--color-text-secondary)] transition-all duration-200 hover:bg-[var(--color-bg-secondary)] hover:shadow-[var(--shadow-sm)]">
					Start 7-Day Free Trial
				</button>
				<button onclick={handleActivate} class="min-h-[44px] rounded-xl bg-[var(--color-primary)] px-6 py-2.5 text-sm font-medium text-white transition-all duration-200 hover:shadow-[var(--shadow-md)]">
					Add to Plan - ${displayPrice}/mo
				</button>
			</div>

			{#if categoryLabel}
				<p class="mt-4 text-xs text-[var(--color-text-tertiary)]">{categoryLabel} skill</p>
			{/if}

			<div class="mt-6 border-t border-[var(--color-border)] pt-5">
				<a href="/skills" class="text-sm font-medium text-[var(--color-primary)] hover:underline">View all skills & plans</a>
			</div>
		</div>
	</div>
{:else}
	{@render children()}
{/if}
