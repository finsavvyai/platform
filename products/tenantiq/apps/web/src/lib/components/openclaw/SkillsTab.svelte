<script lang="ts">
	import SkillCard from './SkillCard.svelte';

	interface CommandCategory { category: string; count: number; icon: string }

	interface Props {
		commands: CommandCategory[];
	}

	let { commands }: Props = $props();

	const totalCommands = $derived(commands.reduce((sum, c) => sum + c.count, 0));

	const examples = [
		{ cmd: 'tenantiq security status', desc: 'Get security posture summary' },
		{ cmd: 'tenantiq license waste', desc: 'Calculate wasted license costs' },
		{ cmd: 'tenantiq inactive users 90', desc: 'Find users inactive for 90+ days' },
		{ cmd: 'tenantiq ask how can I reduce costs?', desc: 'Ask AI for recommendations' }
	];
</script>

<div class="space-y-8">
	<div class="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-6">
		<h2 class="text-lg font-semibold text-[var(--color-text)]">Available Commands</h2>
		<p class="mt-1 text-sm text-[var(--color-text-secondary)]">{totalCommands} commands across {commands.length} categories</p>

		<div class="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
			{#each commands as commandCategory}
				<SkillCard {commandCategory} />
			{/each}
		</div>
	</div>

	<section class="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-6">
		<h3 class="mb-4 text-base font-semibold text-[var(--color-text)]">Example Commands</h3>
		<div class="space-y-2">
			{#each examples as ex}
				<div class="flex items-center justify-between rounded-lg bg-[var(--color-bg-tertiary)] px-4 py-3">
					<code class="text-sm font-semibold text-[var(--color-primary)]">{ex.cmd}</code>
					<span class="text-sm text-[var(--color-text-secondary)]">{ex.desc}</span>
				</div>
			{/each}
		</div>
	</section>
</div>
