<script lang="ts">
	import Card from '$lib/components/ui/Card.svelte';
	import { auth } from '$stores/auth';
	import { formatRelativeTime } from '$utils/format';
	import { Users, Search, ShieldAlert } from 'lucide-svelte';

	interface PlatformUser {
		id: string;
		name: string;
		email: string;
		role: string;
		organizationId: string | null;
		status: string;
		lastLoginAt: string | null;
		createdAt: string;
	}

	let accessDenied = $state(false);
	let users = $state<PlatformUser[]>([]);
	let loading = $state(true);
	let searchQuery = $state('');

	$effect(() => {
		if ($auth.user && !['admin', 'super_admin', 'platform_admin'].includes($auth.user.role)) {
			accessDenied = true; loading = false;
		} else if ($auth.user) loadUsers();
	});

	async function loadUsers() {
		loading = true;
		try {
			const res = await fetch('https://api.tenantiq.app/platform/admin/stats', {
				credentials: 'include'
			}).then(r => r.json());
			users = (res.recentSignups ?? []).map((u: any) => ({
				id: u.id, name: u.name ?? u.email, email: u.email, role: 'user',
				organizationId: null, status: 'active', lastLoginAt: u.date, createdAt: u.date
			}));
			// Also try to get full user list from D1
			const full = await fetch('https://api.tenantiq.app/platform/users', {
				credentials: 'include'
			}).then(r => r.ok ? r.json() : null).catch(() => null);
			if (full?.users?.length) users = full.users;
		} catch { /* keep empty */ }
		finally { loading = false; }
	}

	let filteredUsers = $derived(
		users.filter(u => {
			if (!searchQuery) return true;
			const q = searchQuery.toLowerCase();
			return u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q);
		})
	);

	const roleLabels: Record<string, string> = { platform_admin: 'Platform Admin', super_admin: 'Super Admin', admin: 'Admin', tenant_admin: 'Admin', tenant_operator: 'Operator', tenant_viewer: 'Viewer' };

	const statusStyles: Record<string, string> = {
		active: 'bg-[var(--color-success)]/15 text-[var(--color-success)]',
		invited: 'bg-[var(--color-warning)]/15 text-[var(--color-warning)]',
		suspended: 'bg-[var(--color-danger)]/15 text-[var(--color-danger)]',
		deleted: 'bg-[var(--color-text-tertiary)]/15 text-[var(--color-text-tertiary)]'
	};

	async function toggleUserStatus(user: PlatformUser) {
		const newStatus = user.status === 'active' ? 'suspended' : 'active';
		try {
			await fetch(`https://api.tenantiq.app/platform/users/${user.id}`, {
				method: 'PATCH', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
				body: JSON.stringify({ status: newStatus })
			});
			user.status = newStatus;
			users = [...users];
		} catch { /* */ }
	}

	async function deleteUser(user: PlatformUser) {
		if (!confirm(`Delete ${user.name || user.email}? This cannot be undone.`)) return;
		try {
			await fetch(`https://api.tenantiq.app/platform/users/${user.id}`, {
				method: 'DELETE', credentials: 'include'
			});
			users = users.filter(u => u.id !== user.id);
		} catch { /* */ }
	}
</script>

<svelte:head>
	<title>Users - Platform Admin - TenantIQ</title>
</svelte:head>

{#if accessDenied}
	<div class="min-h-screen flex items-center justify-center bg-[var(--color-bg-secondary)]">
		<Card variant="elevated" padding="lg">
			<div class="text-center py-8">
				<ShieldAlert class="w-16 h-16 text-[var(--color-danger)] mx-auto mb-4" />
				<h2 class="text-xl font-semibold text-[var(--color-text)] mb-2">Access Denied</h2>
				<p class="text-sm text-[var(--color-text-secondary)]">Admin privileges required.</p>
			</div>
		</Card>
	</div>
{:else}
	<div class="min-h-screen bg-[var(--color-bg-secondary)]">
		<header class="sticky top-0 z-10 bg-[var(--color-surface)] border-b border-[var(--color-border)] hig-header">
			<div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
				<div class="flex items-center justify-between h-16">
					<div>
						<h1 class="text-2xl font-semibold text-[var(--color-text)]">Users</h1>
						<p class="text-sm text-[var(--color-text-secondary)]">Manage all registered platform users</p>
					</div>
					<a href="/platform/admin" class="text-sm text-[var(--color-primary)] hover:underline">Back to Admin</a>
				</div>
			</div>
		</header>

		<main class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
			<!-- Search -->
			<Card variant="elevated" padding="md" class="mb-6">
				<div class="flex items-center gap-3">
					<Search class="w-5 h-5 text-[var(--color-text-secondary)]" />
					<input
						type="text"
						placeholder="Search by name or email..."
						bind:value={searchQuery}
						class="flex-1 bg-transparent text-[var(--color-text)] placeholder:text-[var(--color-text-tertiary)] outline-none text-sm"
					/>
					<span class="text-sm text-[var(--color-text-secondary)]">
						Total: {filteredUsers.length} users
					</span>
				</div>
			</Card>

			<!-- Users Table -->
			{#if loading}
				<Card variant="elevated" padding="md">
					<div class="space-y-3">
						{#each Array(5) as _}<div class="h-14 skeleton rounded-xl"></div>{/each}
					</div>
				</Card>
			{:else}
			<Card variant="elevated" padding="none">
				<div class="overflow-x-auto">
					<table class="w-full">
						<thead>
							<tr class="border-b border-[var(--color-border)]">
								<th class="px-6 py-3 text-left text-xs font-medium text-[var(--color-text-secondary)] uppercase tracking-wider">Name</th>
								<th class="px-6 py-3 text-left text-xs font-medium text-[var(--color-text-secondary)] uppercase tracking-wider">Email</th>
								<th class="px-6 py-3 text-left text-xs font-medium text-[var(--color-text-secondary)] uppercase tracking-wider">Role</th>
								<th class="px-6 py-3 text-left text-xs font-medium text-[var(--color-text-secondary)] uppercase tracking-wider">Status</th>
								<th class="px-6 py-3 text-left text-xs font-medium text-[var(--color-text-secondary)] uppercase tracking-wider">Last Login</th>
								<th class="px-6 py-3 text-right text-xs font-medium text-[var(--color-text-secondary)] uppercase tracking-wider">Actions</th>
							</tr>
						</thead>
						<tbody class="divide-y divide-[var(--color-border)]">
							{#each filteredUsers as user}
								<tr class="hover:bg-[var(--color-bg-secondary)] transition-colors cursor-pointer">
									<td class="px-6 py-4 text-sm font-medium text-[var(--color-text)]">{user.name}</td>
									<td class="px-6 py-4 text-sm text-[var(--color-text-secondary)]">{user.email}</td>
									<td class="px-6 py-4 text-sm text-[var(--color-text-secondary)]">{roleLabels[user.role] || user.role}</td>
									<td class="px-6 py-4">
										<span class="px-2 py-0.5 text-xs font-medium rounded-full {statusStyles[user.status] || 'bg-[var(--color-gray)] text-white'}">
											{user.status}
										</span>
									</td>
									<td class="px-6 py-4 text-sm text-[var(--color-text-secondary)]">{formatRelativeTime(user.lastLoginAt)}</td>
									<td class="px-6 py-4 text-right">
										<div class="flex items-center justify-end gap-2">
											<button onclick={() => toggleUserStatus(user)} class="rounded-md px-2 py-1 text-xs font-medium {user.status === 'active' ? 'text-[var(--color-warning)] hover:bg-[var(--color-warning)]/10' : 'text-[var(--color-success)] hover:bg-[var(--color-success)]/10'}">
												{user.status === 'active' ? 'Suspend' : 'Activate'}
											</button>
											<button onclick={() => deleteUser(user)} class="rounded-md px-2 py-1 text-xs font-medium text-[var(--color-danger)] hover:bg-[var(--color-danger)]/10">Delete</button>
										</div>
									</td>
								</tr>
							{/each}
						</tbody>
					</table>
				</div>
				{#if filteredUsers.length === 0 && !searchQuery}
					<div class="py-16 text-center">
						<Users class="w-12 h-12 text-[var(--color-text-tertiary)] mx-auto mb-3" />
						<p class="text-sm font-medium text-[var(--color-text)]">No users registered yet</p>
						<p class="mt-1 text-xs text-[var(--color-text-secondary)]">Users will appear here once they sign up or are invited to the platform.</p>
					</div>
				{:else if filteredUsers.length === 0}
					<div class="py-12 text-center">
						<Search class="w-10 h-10 text-[var(--color-text-tertiary)] mx-auto mb-3" />
						<p class="text-sm text-[var(--color-text-secondary)]">No users match "{searchQuery}"</p>
					</div>
				{/if}
			</Card>
			{/if}
		</main>
	</div>
{/if}

<style>
	.hig-header { backdrop-filter: blur(20px); -webkit-backdrop-filter: blur(20px); }
	table th { white-space: nowrap; }
</style>
