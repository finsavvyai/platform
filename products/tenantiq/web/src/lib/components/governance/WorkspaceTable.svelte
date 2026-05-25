<script lang="ts">
	import { formatNumber } from '$utils/format';
	import { safeUrl } from '$lib/utils/safe-url';

	interface Workspace {
		id: string; display_name: string; workspace_type: string;
		member_count: number; guest_count: number; owner_count: number;
		visibility: string; external_sharing: string; status: string;
		description?: string; mail?: string; created_date_time?: string;
		web_url?: string; sharepoint_url?: string;
	}

	interface Props { workspaces: Workspace[] }
	let { workspaces }: Props = $props();

	let expandedId = $state<string | null>(null);
	let activeTab = $state<'members' | 'guests' | 'owners'>('members');

	const typeIcons: Record<string, string> = { team: 'T', group: 'G', site: 'S' };
	const typeColors: Record<string, string> = {
		team: 'bg-[var(--color-primary)]/10 text-[var(--color-primary)]',
		group: 'bg-[var(--color-warning)]/10 text-[var(--color-warning)]',
		site: 'bg-[var(--color-success)]/10 text-[var(--color-success)]',
	};

	function toggleExpand(id: string) {
		expandedId = expandedId === id ? null : id;
		activeTab = 'members';
	}

	function getTeamsUrl(ws: Workspace) {
		if (ws.web_url) return ws.web_url;
		if (ws.workspace_type === 'team') return `https://teams.microsoft.com/l/team/${ws.id}`;
		return null;
	}
</script>

<div class="overflow-x-auto rounded-2xl border border-[var(--color-border)]">
	<table class="min-w-full">
		<thead class="bg-[var(--color-bg)]">
			<tr>
				<th class="px-4 py-3 text-left text-xs font-medium text-[var(--color-text-secondary)]">Workspace</th>
				<th class="px-4 py-3 text-center text-xs font-medium text-[var(--color-text-secondary)]">Type</th>
				<th class="px-4 py-3 text-right text-xs font-medium text-[var(--color-text-secondary)]">Members</th>
				<th class="px-4 py-3 text-right text-xs font-medium text-[var(--color-text-secondary)]">Guests</th>
				<th class="px-4 py-3 text-right text-xs font-medium text-[var(--color-text-secondary)]">Owners</th>
				<th class="px-4 py-3 text-center text-xs font-medium text-[var(--color-text-secondary)]">Visibility</th>
				<th class="px-4 py-3 text-center text-xs font-medium text-[var(--color-text-secondary)]">Sharing</th>
				<th class="px-4 py-3 text-center text-xs font-medium text-[var(--color-text-secondary)]">Actions</th>
			</tr>
		</thead>
		<tbody class="divide-y divide-[var(--color-border)] bg-[var(--color-surface)]">
			{#each workspaces as ws (ws.id)}
				<tr class="transition-colors hover:bg-[var(--color-bg-secondary)] cursor-pointer" onclick={() => toggleExpand(ws.id)}>
					<td class="px-4 py-3">
						<div class="flex items-center gap-2">
							<span class="text-sm font-medium text-[var(--color-text)]">{ws.display_name}</span>
							{#if ws.status === 'inactive'}
								<span class="rounded-full bg-[var(--color-text-tertiary)]/10 px-1.5 py-0.5 text-[10px] text-[var(--color-text-tertiary)]">Inactive</span>
							{/if}
						</div>
						{#if ws.description}
							<p class="mt-0.5 text-[11px] text-[var(--color-text-tertiary)] line-clamp-1">{ws.description}</p>
						{/if}
					</td>
					<td class="px-4 py-3 text-center">
						<span class="inline-flex h-6 w-6 items-center justify-center rounded-md text-[10px] font-bold {typeColors[ws.workspace_type] || ''}">{typeIcons[ws.workspace_type] || '?'}</span>
					</td>
					<td class="px-4 py-3 text-right text-sm text-[var(--color-text)]">{formatNumber(ws.member_count)}</td>
					<td class="px-4 py-3 text-right text-sm {ws.guest_count > 0 ? 'text-[var(--color-warning)]' : 'text-[var(--color-text-secondary)]'}">{ws.guest_count}</td>
					<td class="px-4 py-3 text-right text-sm {ws.owner_count === 0 ? 'text-[var(--color-danger)]' : 'text-[var(--color-text)]'}">{ws.owner_count}{#if ws.owner_count === 0} (!){/if}</td>
					<td class="px-4 py-3 text-center text-xs text-[var(--color-text-secondary)]">{ws.visibility}</td>
					<td class="px-4 py-3 text-center">
						<span class="rounded-full px-2 py-0.5 text-[10px] font-medium {ws.external_sharing !== 'internal_only' ? 'bg-[var(--color-warning)]/10 text-[var(--color-warning)]' : 'bg-[var(--color-bg-tertiary)] text-[var(--color-text-secondary)]'}">
							{ws.external_sharing === 'internal_only' ? 'Internal' : 'External'}
						</span>
					</td>
					<td class="px-4 py-3 text-center">
						<!-- svelte-ignore a11y_click_events_have_key_events -->
						<!-- svelte-ignore a11y_no_static_element_interactions -->
						<div class="flex items-center justify-center gap-1" onclick={(e) => e.stopPropagation()}>
							{#if safeUrl(getTeamsUrl(ws))}
								<a href={safeUrl(getTeamsUrl(ws))} target="_blank" rel="noopener noreferrer"
									class="rounded-lg px-2 py-1 text-[11px] font-medium text-[var(--color-primary)] hover:bg-[var(--color-primary)]/10 transition-colors"
									title="Open in Teams/M365">
									Open ↗
								</a>
							{/if}
							<button onclick={() => toggleExpand(ws.id)}
								class="rounded-lg px-2 py-1 text-[11px] font-medium text-[var(--color-text-secondary)] hover:bg-[var(--color-bg)] transition-colors">
								{expandedId === ws.id ? 'Hide' : 'Details'}
							</button>
						</div>
					</td>
				</tr>

				{#if expandedId === ws.id}
					<tr>
						<td colspan="8" class="bg-[var(--color-bg)] p-0">
							<div class="px-6 py-4 space-y-3">
								<!-- Tab bar: Members / Guests / Owners -->
								<div class="flex gap-1 border-b border-[var(--color-border)]">
									<button onclick={() => { activeTab = 'members'; }}
										class="px-3 py-2 text-xs font-medium transition-colors border-b-2
											{activeTab === 'members' ? 'border-[var(--color-primary)] text-[var(--color-primary)]' : 'border-transparent text-[var(--color-text-secondary)]'}">
										Members ({ws.member_count})
									</button>
									<button onclick={() => { activeTab = 'guests'; }}
										class="px-3 py-2 text-xs font-medium transition-colors border-b-2
											{activeTab === 'guests' ? 'border-[var(--color-warning)] text-[var(--color-warning)]' : 'border-transparent text-[var(--color-text-secondary)]'}">
										Guests ({ws.guest_count})
									</button>
									<button onclick={() => { activeTab = 'owners'; }}
										class="px-3 py-2 text-xs font-medium transition-colors border-b-2
											{activeTab === 'owners' ? 'border-[var(--color-success)] text-[var(--color-success)]' : 'border-transparent text-[var(--color-text-secondary)]'}">
										Owners ({ws.owner_count})
									</button>
								</div>

								<!-- Tab content -->
								<div class="min-h-[60px]">
									{#if activeTab === 'members'}
										<div class="grid grid-cols-2 gap-3 sm:grid-cols-4">
											<div class="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-3 text-center">
												<p class="text-lg font-bold text-[var(--color-text)]">{ws.member_count}</p>
												<p class="text-[11px] text-[var(--color-text-secondary)]">Total Members</p>
											</div>
											<div class="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-3 text-center">
												<p class="text-lg font-bold text-[var(--color-text)]">{ws.member_count - ws.guest_count}</p>
												<p class="text-[11px] text-[var(--color-text-secondary)]">Internal Users</p>
											</div>
											<div class="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-3 text-center">
												<p class="text-lg font-bold {ws.guest_count > 0 ? 'text-[var(--color-warning)]' : 'text-[var(--color-text)]'}">{ws.guest_count}</p>
												<p class="text-[11px] text-[var(--color-text-secondary)]">External Guests</p>
											</div>
											<div class="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-3 text-center">
												<p class="text-lg font-bold {ws.owner_count === 0 ? 'text-[var(--color-danger)]' : 'text-[var(--color-text)]'}">{ws.owner_count}</p>
												<p class="text-[11px] text-[var(--color-text-secondary)]">Owners</p>
											</div>
										</div>
										<p class="mt-2 text-[11px] text-[var(--color-text-tertiary)]">Sync your tenant to see individual member names and details.</p>
									{:else if activeTab === 'guests'}
										{#if ws.guest_count === 0}
											<p class="py-4 text-center text-xs text-[var(--color-text-secondary)]">No external guests in this workspace.</p>
										{:else}
											<div class="rounded-lg border border-[var(--color-warning)]/20 bg-[var(--color-warning)]/5 p-3">
												<p class="text-xs font-medium text-[var(--color-warning)]">{ws.guest_count} external guest{ws.guest_count !== 1 ? 's' : ''} have access</p>
												<p class="mt-1 text-[11px] text-[var(--color-text-secondary)]">
													External guests can access shared files and conversations in this workspace.
													{#if ws.external_sharing !== 'internal_only'}Sharing is set to <strong>{ws.external_sharing}</strong> — consider restricting if sensitive.{/if}
												</p>
											</div>
										{/if}
									{:else if activeTab === 'owners'}
										{#if ws.owner_count === 0}
											<div class="rounded-lg border border-[var(--color-danger)]/20 bg-[var(--color-danger)]/5 p-3">
												<p class="text-xs font-medium text-[var(--color-danger)]">No owners assigned — orphaned workspace</p>
												<p class="mt-1 text-[11px] text-[var(--color-text-secondary)]">This workspace has no owner. Assign one to prevent governance gaps and ensure proper management.</p>
											</div>
										{:else}
											<div class="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-3">
												<p class="text-xs text-[var(--color-text)]">{ws.owner_count} owner{ws.owner_count !== 1 ? 's' : ''} assigned</p>
												<p class="mt-1 text-[11px] text-[var(--color-text-secondary)]">Owners can manage settings, membership, and permissions for this workspace.</p>
											</div>
										{/if}
									{/if}
								</div>

								<!-- Quick info row -->
								<div class="flex flex-wrap gap-3 text-[11px] text-[var(--color-text-tertiary)]">
									{#if ws.mail}<span>Mail: {ws.mail}</span>{/if}
									{#if ws.created_date_time}<span>Created: {new Date(ws.created_date_time).toLocaleDateString()}</span>{/if}
									<span>Visibility: {ws.visibility}</span>
									<span>Sharing: {ws.external_sharing}</span>
								</div>
							</div>
						</td>
					</tr>
				{/if}
			{/each}
		</tbody>
	</table>
</div>
