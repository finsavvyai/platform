<script lang="ts">
	import InviteMember from '$lib/components/team/InviteMember.svelte';
	import PageHeader from '$components/ui/PageHeader.svelte';
	import { auth } from '$stores/auth';
	import { api } from '$api/client';
	import { toasts } from '$stores/toast';
	import { formatRelativeTime } from '$utils/format';

	interface Member { id: string; email: string; display_name: string; role: string; status: string; created_at: string }
	interface Invitation { id: string; email: string; role: string; status: string; invited_by: string; created_at: string }

	let members = $state<Member[]>([]);
	let invitations = $state<Invitation[]>([]);
	let loading = $state(true);
	let error = $state('');

	$effect(() => {
		if ($auth.user) loadTeam();
		else if (!$auth.loading) loading = false;
	});

	async function loadTeam() {
		loading = true;
		error = '';
		try {
			const res = await api.get<{ members: Member[]; invitations: Invitation[] }>('/team');
			members = res.members ?? [];
			invitations = res.invitations ?? [];
		} catch (e) {
			members = [];
			invitations = [];
			error = e instanceof Error ? e.message : 'Failed to load team';
		} finally {
			loading = false;
		}
	}

	async function removeMember(id: string) {
		if (!confirm('Remove this team member?')) return;
		try {
			await api.delete(`/team/${id}`);
			toasts.success('Member removed');
			loadTeam();
		} catch { toasts.error('Failed to remove'); }
	}

	async function changeRole(id: string, role: string) {
		try {
			await api.patch(`/team/${id}/role`, { role });
			toasts.success('Role updated');
			loadTeam();
		} catch { toasts.error('Failed to update role'); }
	}

	async function revokeInvite(id: string) {
		try {
			await api.delete(`/team/invitations/${id}`);
			toasts.success('Invitation revoked');
			loadTeam();
		} catch { toasts.error('Failed to revoke'); }
	}

	const roleLabels: Record<string, string> = { tenant_admin: 'Admin', tenant_operator: 'Operator', tenant_viewer: 'Viewer', admin: 'Admin', member: 'Operator', viewer: 'Viewer' };
	const roleColors: Record<string, string> = { tenant_admin: 'bg-[var(--color-primary)]/10 text-[var(--color-primary)]', admin: 'bg-[var(--color-primary)]/10 text-[var(--color-primary)]', tenant_operator: 'bg-[var(--color-warning)]/10 text-[var(--color-warning)]', member: 'bg-[var(--color-warning)]/10 text-[var(--color-warning)]', tenant_viewer: 'bg-[var(--color-bg-tertiary)] text-[var(--color-text-secondary)]', viewer: 'bg-[var(--color-bg-tertiary)] text-[var(--color-text-secondary)]' };
	const isAdmin = $derived($auth.user?.role === 'admin' || $auth.user?.role === 'super_admin');
</script>

<svelte:head><title>Team | TenantIQ</title></svelte:head>

<div class="page-container space-y-6">
	<PageHeader title="Team" description="Manage team members and access control" />

	{#if isAdmin}
		<InviteMember onInvited={loadTeam} />
	{/if}

	{#if loading}
		<div class="space-y-3">{#each Array(3) as _}<div class="h-16 skeleton rounded-2xl"></div>{/each}</div>
	{:else if error}
		<div class="rounded-2xl border border-[var(--color-danger)]/20 bg-[var(--color-danger)]/5 p-6 text-center">
			<p class="text-sm text-[var(--color-danger)]">{error}</p>
			<button onclick={loadTeam} class="btn-primary mt-3">Retry</button>
		</div>
	{:else}
		<!-- Team members -->
		<div>
			<h2 class="mb-3 section-title">Members ({members.length})</h2>
			<div class="overflow-hidden rounded-2xl border border-[var(--color-border)]">
				<table class="table-premium w-full">
					<thead class="bg-[var(--color-bg)]">
						<tr>
							<th class="px-4 py-3 text-left text-xs font-medium text-[var(--color-text-secondary)]">Member</th>
							<th class="px-4 py-3 text-center text-xs font-medium text-[var(--color-text-secondary)]">Role</th>
							<th class="px-4 py-3 text-center text-xs font-medium text-[var(--color-text-secondary)]">Status</th>
							<th class="px-4 py-3 text-right text-xs font-medium text-[var(--color-text-secondary)]">Joined</th>
							{#if isAdmin}<th class="px-4 py-3 text-right text-xs font-medium text-[var(--color-text-secondary)]">Actions</th>{/if}
						</tr>
					</thead>
					<tbody class="divide-y divide-[var(--color-border)] bg-[var(--color-surface)]">
						{#each members as m (m.id)}
							<tr class="transition-colors hover:bg-[var(--color-bg-secondary)]">
								<td class="px-4 py-3">
									<div class="flex items-center gap-3">
										<div class="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--color-primary)]/10 text-xs font-semibold text-[var(--color-primary)]">{(m.display_name || m.email).charAt(0).toUpperCase()}</div>
										<div>
											<p class="text-sm font-medium text-[var(--color-text)]">{m.display_name || m.email}</p>
											<p class="text-[11px] text-[var(--color-text-secondary)]">{m.email}</p>
										</div>
									</div>
								</td>
								<td class="px-4 py-3 text-center">
									{#if isAdmin && m.id !== $auth.user?.id}
										<select value={m.role} onchange={(e) => changeRole(m.id, (e.target as HTMLSelectElement).value)} class="select-premium">
											<option value="tenant_viewer">Viewer</option>
											<option value="tenant_operator">Operator</option>
											<option value="tenant_admin">Admin</option>
										</select>
									{:else}
										<span class="rounded-full px-2 py-0.5 text-[11px] font-medium {roleColors[m.role] || ''}">{roleLabels[m.role] || m.role}</span>
									{/if}
								</td>
								<td class="px-4 py-3 text-center">
									<span class="rounded-full px-2 py-0.5 text-[10px] font-medium capitalize {m.status === 'active' ? 'bg-[var(--color-success)]/10 text-[var(--color-success)]' : 'bg-[var(--color-text-secondary)]/10 text-[var(--color-text-secondary)]'}">{m.status}</span>
								</td>
								<td class="px-4 py-3 text-right text-xs text-[var(--color-text-secondary)]">{formatRelativeTime(m.created_at)}</td>
								{#if isAdmin}
									<td class="px-4 py-3 text-right">
										{#if m.id !== $auth.user?.id}
											<button onclick={() => removeMember(m.id)} class="text-xs text-[var(--color-danger)] hover:underline">Remove</button>
										{:else}
											<span class="text-xs text-[var(--color-text-tertiary)]">You</span>
										{/if}
									</td>
								{/if}
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
		</div>

		<!-- Pending invitations -->
		{#if invitations.length > 0}
			<div>
				<h2 class="mb-3 section-title">Pending Invitations ({invitations.length})</h2>
				<div class="space-y-2">
					{#each invitations as inv (inv.id)}
						<div class="flex items-center justify-between rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
							<div>
								<p class="text-sm font-medium text-[var(--color-text)]">{inv.email}</p>
								<p class="text-[11px] text-[var(--color-text-secondary)]">Invited as {roleLabels[inv.role] || inv.role} by {inv.invited_by} {formatRelativeTime(inv.created_at)}</p>
							</div>
							{#if isAdmin}
								<button onclick={() => revokeInvite(inv.id)} class="text-xs text-[var(--color-danger)] hover:underline">Revoke</button>
							{/if}
						</div>
					{/each}
				</div>
			</div>
		{/if}
	{/if}
</div>
