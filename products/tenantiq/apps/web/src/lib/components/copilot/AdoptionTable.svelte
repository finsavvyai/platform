<script lang="ts">
	interface UserAdoption {
		displayName: string;
		userPrincipalName: string;
		lastActivityDate: string | null;
		isActive: boolean;
		appsUsed: string[];
	}

	interface Props {
		users: UserAdoption[];
	}

	let { users }: Props = $props();
	let filter = $state<'all' | 'active' | 'inactive'>('all');

	const filteredUsers = $derived(
		filter === 'all' ? users : users.filter((u) => (filter === 'active' ? u.isActive : !u.isActive)),
	);
</script>

<div class="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5">
	<div class="mb-4 flex items-center justify-between">
		<h3 class="text-sm font-semibold text-[var(--color-text)]">User Adoption ({filteredUsers.length})</h3>
		<div class="flex gap-1">
			{#each ['all', 'active', 'inactive'] as f}
				<button onclick={() => (filter = f as typeof filter)} class="cursor-pointer rounded-lg px-3 py-1 text-xs font-medium transition-colors" class:bg-[var(--color-primary)]={filter === f} class:text-white={filter === f} class:text-[var(--color-text-secondary)]={filter !== f} class:hover:bg-[var(--color-bg)]={filter !== f}>
					{f.charAt(0).toUpperCase() + f.slice(1)}
				</button>
			{/each}
		</div>
	</div>

	{#if filteredUsers.length === 0}
		<p class="text-sm text-[var(--color-text-secondary)]">No users match the filter.</p>
	{:else}
		<div class="max-h-80 overflow-x-auto overflow-y-auto">
			<table class="min-w-full text-sm">
				<thead>
					<tr class="border-b border-[var(--color-border)]">
						<th class="pb-2 text-left text-xs font-medium text-[var(--color-text-secondary)]">User</th>
						<th class="pb-2 text-left text-xs font-medium text-[var(--color-text-secondary)]">Status</th>
						<th class="pb-2 text-left text-xs font-medium text-[var(--color-text-secondary)]">Apps Used</th>
						<th class="pb-2 text-left text-xs font-medium text-[var(--color-text-secondary)]">Last Active</th>
					</tr>
				</thead>
				<tbody>
					{#each filteredUsers as user (user.userPrincipalName)}
						<tr class="border-b border-[var(--color-border)]/50">
							<td class="py-2">
								<div class="font-medium text-[var(--color-text)]">{user.displayName}</div>
								<div class="text-[11px] text-[var(--color-text-tertiary)]">{user.userPrincipalName}</div>
							</td>
							<td class="py-2">
								{#if user.isActive}
									<span class="rounded-full bg-[var(--color-success)]/10 px-2 py-0.5 text-xs font-medium text-[var(--color-success)]">Active</span>
								{:else}
									<span class="rounded-full bg-[var(--color-error)]/10 px-2 py-0.5 text-xs font-medium text-[var(--color-error)]">Inactive</span>
								{/if}
							</td>
							<td class="py-2">
								<div class="flex flex-wrap gap-1">
									{#each user.appsUsed as app}
										<span class="rounded bg-[var(--color-primary)]/10 px-1.5 py-0.5 text-[10px] text-[var(--color-primary)]">{app}</span>
									{/each}
									{#if user.appsUsed.length === 0}
										<span class="text-[10px] text-[var(--color-text-tertiary)]">None</span>
									{/if}
								</div>
							</td>
							<td class="py-2 text-xs text-[var(--color-text-secondary)]">
								{user.lastActivityDate ? new Date(user.lastActivityDate).toLocaleDateString() : 'Never'}
							</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
	{/if}
</div>
