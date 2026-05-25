<script lang="ts">
	interface Props {
		commandCategory: {
			category: string;
			count: number;
			icon: string;
		};
	}

	let { commandCategory }: Props = $props();
	let expanded = $state(false);

	const categoryCommands: Record<string, string[]> = {
		'Security': ['security status', 'check alerts', 'show critical alerts', 'mfa status', 'risky users'],
		'License Optimization': ['license waste', 'inactive users', 'unused licenses', 'downgrade', 'optimize licenses'],
		'User Management': ['search user', 'user details', 'guest users', 'remove guest', 'reset password'],
		'Compliance': ['compliance status', 'groups without owners', 'audit trail'],
		'Tenant Management': ['switch tenant', 'list tenants', 'dashboard'],
		'AI Assistant': ['ask', 'recommend']
	};

	const commands = $derived(categoryCommands[commandCategory.category] || []);
</script>

<div class="overflow-hidden rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] transition-shadow duration-[var(--duration-fast)] hover:shadow-[var(--shadow-md)]">
	<button
		type="button"
		onclick={() => (expanded = !expanded)}
		class="flex min-h-[44px] w-full items-center justify-between px-5 py-4 text-left"
		aria-expanded={expanded}
	>
		<div class="flex items-center gap-3">
			<span class="text-2xl">{commandCategory.icon}</span>
			<div>
				<h3 class="text-base font-semibold text-[var(--color-text)]">{commandCategory.category}</h3>
				<p class="mt-0.5 text-sm text-[var(--color-text-secondary)]">{commandCategory.count} commands</p>
			</div>
		</div>
		<svg
			xmlns="http://www.w3.org/2000/svg"
			class="h-4 w-4 text-[var(--color-text-secondary)] transition-transform duration-[var(--duration-fast)]"
			class:rotate-90={expanded}
			viewBox="0 0 20 20"
			fill="currentColor"
		>
			<path fill-rule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clip-rule="evenodd" />
		</svg>
	</button>

	{#if expanded}
		<div class="border-t border-[var(--color-border)] px-5 pb-4 pt-3">
			<ul class="space-y-0">
				{#each commands as command}
					<li class="border-b border-[var(--color-border-subtle)] py-2 last:border-0">
						<code class="text-sm font-semibold text-[var(--color-primary)]">tenantiq {command}</code>
					</li>
				{/each}
			</ul>
		</div>
	{/if}
</div>
