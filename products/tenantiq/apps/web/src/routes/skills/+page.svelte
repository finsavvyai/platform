<script lang="ts">
	import SkillCardComponent from '$lib/components/skills/SkillCard.svelte';
	import SkillRecommendation from '$lib/components/skills/SkillRecommendation.svelte';
	import SkillTemplates from '$lib/components/skills/SkillTemplates.svelte';
	import PageHeader from '$components/ui/PageHeader.svelte';
	import { skills, skillsControl, activeSkills, lockedSkills, activeCount, totalCount, CATEGORY_LABELS, promoApplied, applyPromo } from '$stores/skills';
	import { toasts } from '$stores/toast';
	import type { Skill, SkillCategory } from '$stores/skills';

	const CATEGORIES: SkillCategory[] = ['foundation', 'management', 'security', 'analytics', 'enterprise'];

	let filterCategory = $state<SkillCategory | 'all'>('all');
	let showPromoInput = $state(false);
	let promoCode = $state('');

	const filtered = $derived(
		filterCategory === 'all' ? $skills : $skills.filter(s => s.category === filterCategory)
	);

	const monthlySpend = $derived($activeSkills.reduce((sum, s) => sum + s.price, 0));

	const recommendation = $derived($lockedSkills.find(s => s.id === 'threats'));

	const grouped = $derived(() => {
		const map = new Map<SkillCategory, Skill[]>();
		for (const cat of CATEGORIES) {
			const items = filtered.filter(s => s.category === cat);
			if (items.length > 0) map.set(cat, items);
		}
		return map;
	});

	function handleActivate(id: string) {
		skillsControl.activate(id);
		const sk = $skills.find(s => s.id === id);
		toasts.success(`${sk?.name} activated`);
	}

	function handleDeactivate(id: string) {
		const sk = $skills.find(s => s.id === id);
		skillsControl.deactivate(id);
		toasts.success(`${sk?.name} deactivated`);
	}

	function handleTrial(id: string) {
		skillsControl.startTrial(id, 7);
		const sk = $skills.find(s => s.id === id);
		toasts.success(`${sk?.name} trial started - 7 days free`);
	}

	function handleApplyPromo() {
		const valid = applyPromo(promoCode);
		if (valid) {
			toasts.success('Promo code applied - all skills unlocked!');
			promoCode = '';
			showPromoInput = false;
		} else {
			toasts.error('Invalid promotion code');
		}
	}
</script>

<svelte:head><title>Skills Hub | TenantIQ</title></svelte:head>

<div class="page-container-wide space-y-8">
	<PageHeader title="Skills Hub" description="Install and manage skills for your tenant" iconPath="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />

	<!-- Promo code section -->
	{#if !$promoApplied}
		<div class="text-sm">
			{#if !showPromoInput}
				<button onclick={() => (showPromoInput = true)} class="text-[var(--color-primary)] hover:underline">
					Have a promo code?
				</button>
			{:else}
				<div class="flex items-center gap-2">
					<input
						bind:value={promoCode}
						placeholder="Enter promo code"
						class="min-h-[36px] rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-1.5 text-sm text-[var(--color-text)] placeholder:text-[var(--color-text-secondary)]"
						onkeydown={(e) => { if (e.key === 'Enter') handleApplyPromo(); }}
					/>
					<button onclick={handleApplyPromo} class="btn-primary">
						Apply
					</button>
					<button onclick={() => (showPromoInput = false)} class="text-xs text-[var(--color-text-secondary)] hover:text-[var(--color-text)]">
						Cancel
					</button>
				</div>
			{/if}
		</div>
	{/if}

	<div class="panel">
		<div class="flex flex-wrap items-center gap-4 px-5 py-3">
			<span class="text-sm font-semibold text-[var(--color-text)]">Professional Plan</span>
			{#if $promoApplied}
				<span class="pill-success">All Access</span>
			{/if}
			<span class="h-4 w-px bg-[var(--color-border)]"></span>
			<span class="text-sm text-[var(--color-text-secondary)] tabular-nums">{$activeCount}/{$totalCount} Skills Active</span>
			<span class="h-4 w-px bg-[var(--color-border)]"></span>
			<span class="text-sm text-[var(--color-text-secondary)] tabular-nums">${monthlySpend}/mo</span>
		</div>
	</div>

	<SkillTemplates />

	{#if recommendation}
		<SkillRecommendation
			skill={recommendation}
			reason="Based on your alert volume, this skill would significantly reduce triage time."
			benefit="Detects identity threats 40% faster with behavioral analytics"
			onTrial={handleTrial}
		/>
	{/if}

	<div class="filter-bar flex-wrap gap-2">
		<button onclick={() => (filterCategory = 'all')} class="{filterCategory === 'all' ? 'btn-primary' : 'btn-secondary'}">
			All ({$totalCount})
		</button>
		{#each CATEGORIES as cat}
			{@const count = $skills.filter(s => s.category === cat).length}
			<button onclick={() => (filterCategory = cat)} class="{filterCategory === cat ? 'btn-primary' : 'btn-secondary'}">
				{CATEGORY_LABELS[cat]} ({count})
			</button>
		{/each}
	</div>

	{#each [...grouped().entries()] as [category, categorySkills] (category)}
		<section>
			<h2 class="micro-label mb-4">
				{CATEGORY_LABELS[category]}
				{#if category === 'foundation'}
					<span class="ml-2 text-[var(--color-success)]">-- Always included</span>
				{/if}
			</h2>
			<div class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
				{#each categorySkills as skill (skill.id)}
					<SkillCardComponent {skill} onActivate={handleActivate} onDeactivate={handleDeactivate} onTrial={handleTrial} />
				{/each}
			</div>
		</section>
	{/each}
</div>
