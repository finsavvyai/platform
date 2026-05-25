<script lang="ts">
	import { formatRelativeTime } from '$utils/format';

	interface RoleChange {
		id: string;
		userDisplayName: string;
		userEmail: string;
		roleName: string;
		action: 'granted' | 'revoked';
		grantedBy: string;
		effectiveAt: string;
		revokedAt: string | null;
	}

	interface Props { changes: RoleChange[] }

	let { changes }: Props = $props();
</script>

<section>
	<h2 class="mb-4 text-lg font-semibold text-[var(--color-text)]">Admin Role History</h2>
	<div class="space-y-3">
		{#each changes as c}
			<div class="flex gap-4 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4 transition-colors hover:bg-[var(--color-bg-secondary)]">
				<div class="flex h-10 w-10 shrink-0 items-center justify-center rounded-full {c.action === 'granted' ? 'bg-[var(--color-success)]/10' : 'bg-[var(--color-danger)]/10'}">
					{#if c.action === 'granted'}
						<svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 text-[var(--color-success)]" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M12 4.5v15m7.5-7.5h-15" /></svg>
					{:else}
						<svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 text-[var(--color-danger)]" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M19.5 12h-15" /></svg>
					{/if}
				</div>
				<div class="flex-1">
					<div class="flex items-center gap-2">
						<span class="text-sm font-semibold text-[var(--color-text)]">{c.userDisplayName}</span>
						<span class="rounded-full px-2 py-0.5 text-xs font-medium {c.action === 'granted' ? 'bg-[var(--color-success)]/15 text-[var(--color-success)]' : 'bg-[var(--color-danger)]/15 text-[var(--color-danger)]'}">{c.action}</span>
					</div>
					<p class="mt-0.5 text-sm text-[var(--color-text)]">
						<span class="font-medium">{c.roleName}</span>
					</p>
					<p class="mt-1 text-xs text-[var(--color-text-secondary)]">
						By {c.grantedBy} &middot; {formatRelativeTime(c.effectiveAt)}
						{#if c.revokedAt} &middot; Revoked {formatRelativeTime(c.revokedAt)}{/if}
					</p>
				</div>
			</div>
		{/each}
	</div>
</section>
