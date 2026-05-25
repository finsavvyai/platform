<script lang="ts">
	import type { RiskyUser } from '@tenantiq/shared';

	interface Props {
		users: RiskyUser[];
	}

	let { users }: Props = $props();

	function riskColor(user: RiskyUser): string {
		if (!user.accountEnabled) return 'var(--color-danger)';
		if (user.daysSinceSignIn === null) return 'var(--color-warning)';
		if (user.daysSinceSignIn >= 180) return 'var(--color-danger)';
		if (user.daysSinceSignIn >= 90) return 'var(--color-warning)';
		return 'var(--color-text-tertiary)';
	}
</script>

<section class="animate-fade-up delay-4">
	<div class="mb-3 flex items-center justify-between">
		<h2 class="text-base font-semibold text-[var(--color-text)]">Top Risky Users</h2>
	</div>
	{#if users.length === 0}
		<div class="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-8 text-center">
			<p class="text-sm text-[var(--color-text-secondary)]">No risky users detected. Sync to analyze.</p>
		</div>
	{:else}
		<div class="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] divide-y divide-[var(--color-border)]">
			{#each users as user, i}
				<div class="flex items-center gap-3 px-4 py-3">
					<div class="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold" style="background: {riskColor(user)}20; color: {riskColor(user)}">
						{i + 1}
					</div>
					<div class="min-w-0 flex-1">
						<p class="truncate text-sm font-medium text-[var(--color-text)]">{user.displayName || 'Unknown'}</p>
						<p class="truncate text-xs text-[var(--color-text-secondary)]">{user.email}</p>
					</div>
					<span class="shrink-0 rounded-full px-2.5 py-0.5 text-[11px] font-medium" style="background: {riskColor(user)}15; color: {riskColor(user)}">
						{user.riskReason}
					</span>
				</div>
			{/each}
		</div>
	{/if}
</section>
