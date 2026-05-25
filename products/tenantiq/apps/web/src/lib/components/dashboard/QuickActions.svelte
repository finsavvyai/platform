<script lang="ts">
	import { formatRelativeTime } from '$utils/format';

	interface Props {
		lastSyncAt: string | null;
		tenantId: string;
		onSync: () => void;
		syncing?: boolean;
	}

	let { lastSyncAt, tenantId, onSync, syncing = false }: Props = $props();

	const actions = [
		{ label: 'Run CIS Scan', href: '/security/cis', icon: 'M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z' },
		{ label: 'AI Analysis', href: '/ai', icon: 'M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 00-2.455 2.456z' },
		{ label: 'Create Backup', href: '/backups/config', icon: 'M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75 7.5m8.25 3v6.75m0 0l-3-3m3 3l3-3M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z' },
	];
</script>

<div class="animate-fade-up delay-2 rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
	<div class="flex flex-col gap-3 sm:flex-row sm:items-center">
		<div class="flex items-center gap-3">
			<button
				onclick={onSync}
				disabled={syncing}
				class="inline-flex min-h-[44px] cursor-pointer items-center gap-2 rounded-xl bg-[var(--color-primary)] px-5 py-2.5 text-sm font-medium text-white transition-all duration-200 hover:shadow-[var(--shadow-md)] disabled:opacity-50"
			>
				<svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 {syncing ? 'animate-spin' : ''}" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182"/></svg>
				{syncing ? 'Syncing...' : 'Sync Now'}
			</button>
			{#if lastSyncAt}
				<span class="text-xs text-[var(--color-text-tertiary)]">Last sync {formatRelativeTime(lastSyncAt)}</span>
			{:else}
				<span class="text-xs text-[var(--color-warning)]">Never synced</span>
			{/if}
		</div>
		<div class="flex items-center gap-2 sm:ml-auto">
			{#each actions as action}
				<a href={action.href} class="inline-flex min-h-[44px] cursor-pointer items-center gap-2 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] px-4 py-2 text-sm font-medium text-[var(--color-text-secondary)] transition-all duration-200 hover:border-[var(--color-primary)]/30 hover:text-[var(--color-primary)] hover:shadow-[var(--shadow-sm)]">
					<svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d={action.icon}/></svg>
					<span class="hidden md:inline">{action.label}</span>
				</a>
			{/each}
		</div>
	</div>
</div>
