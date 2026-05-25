<script lang="ts">
	import Card from '$lib/components/ui/Card.svelte';
	import { auth } from '$stores/auth';
	import { Building2, Search, ShieldAlert } from 'lucide-svelte';

	interface Organization { id: string; name: string; slug: string; subscriptionTier: string; subscriptionStatus: string; status: string; primaryContactEmail: string; maxUsers: number; createdAt: string; }

	let accessDenied = $state(false);
	let orgs = $state<Organization[]>([]);
	let loading = $state(true);
	let searchQuery = $state('');

	$effect(() => {
		if ($auth.user && !['admin', 'super_admin', 'platform_admin'].includes($auth.user.role)) {
			accessDenied = true; loading = false;
		} else if ($auth.user) loadOrgs();
	});

	async function loadOrgs() {
		loading = true;
		try {
			const res = await fetch('https://api.tenantiq.app/platform/organizations', {
				credentials: 'include'
			}).then(r => r.ok ? r.json() : { organizations: [] });
			orgs = (res.organizations ?? []).map((o: any) => ({
				id: o.id, name: o.name ?? 'Unnamed', plan: o.billing_plan ?? o.plan ?? 'trial',
				subscriptionStatus: o.status ?? 'active', maxUsers: o.max_users ?? 0,
				status: o.status ?? 'active', createdAt: o.created_at ?? o.createdAt ?? ''
			}));
		} catch { /* keep empty */ }
		finally { loading = false; }
	}

	let filteredOrgs = $derived(
		orgs.filter(o => {
			if (!searchQuery) return true;
			const q = searchQuery.toLowerCase();
			return o.name.toLowerCase().includes(q) || o.slug.toLowerCase().includes(q);
		})
	);

	const fmtDate = (d: string) => { try { return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).format(new Date(d)); } catch { return d; } };
	const planStyles: Record<string, string> = { trial: 'bg-[var(--color-orange)] text-white', starter: 'bg-[var(--color-primary)] text-white', professional: 'bg-purple-600 text-white', enterprise: 'bg-amber-500 text-white', custom: 'bg-[var(--color-green)] text-white' };
	const statusStyles: Record<string, string> = { active: 'bg-[var(--color-success)]/15 text-[var(--color-success)]', suspended: 'bg-[var(--color-danger)]/15 text-[var(--color-danger)]', deleted: 'bg-[var(--color-text-tertiary)]/15 text-[var(--color-text-tertiary)]' };

	async function toggleOrgStatus(org: Organization) {
		const newStatus = org.status === 'active' ? 'suspended' : 'active';
		try {
			await fetch(`https://api.tenantiq.app/platform/organizations/${org.id}`, {
				method: 'PATCH', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
				body: JSON.stringify({ status: newStatus })
			});
			org.status = newStatus;
			orgs = [...orgs];
		} catch { /* */ }
	}

	const tierLabel = (t: string) => ({ starter: 'Starter', professional: 'Professional', enterprise: 'Enterprise', custom: 'Custom' }[t] ?? t);
</script>

<svelte:head>
	<title>Organizations - Platform Admin - TenantIQ</title>
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
						<h1 class="text-2xl font-semibold text-[var(--color-text)]">Organizations</h1>
						<p class="text-sm text-[var(--color-text-secondary)]">Manage all customer organizations</p>
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
						placeholder="Search by name or slug..."
						bind:value={searchQuery}
						class="flex-1 bg-transparent text-[var(--color-text)] placeholder:text-[var(--color-text-tertiary)] outline-none text-sm"
					/>
					<span class="text-sm text-[var(--color-text-secondary)]">
						Total: {filteredOrgs.length} organizations
					</span>
				</div>
			</Card>

			<!-- Orgs Table -->
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
								<th class="px-6 py-3 text-left text-xs font-medium text-[var(--color-text-secondary)] uppercase tracking-wider">Organization</th>
								<th class="px-6 py-3 text-left text-xs font-medium text-[var(--color-text-secondary)] uppercase tracking-wider">Plan</th>
								<th class="px-6 py-3 text-left text-xs font-medium text-[var(--color-text-secondary)] uppercase tracking-wider">Sub. Status</th>
								<th class="px-6 py-3 text-left text-xs font-medium text-[var(--color-text-secondary)] uppercase tracking-wider">Max Users</th>
								<th class="px-6 py-3 text-left text-xs font-medium text-[var(--color-text-secondary)] uppercase tracking-wider">Status</th>
								<th class="px-6 py-3 text-left text-xs font-medium text-[var(--color-text-secondary)] uppercase tracking-wider">Created</th>
								<th class="px-6 py-3 text-right text-xs font-medium text-[var(--color-text-secondary)] uppercase tracking-wider">Actions</th>
							</tr>
						</thead>
						<tbody class="divide-y divide-[var(--color-border)]">
							{#each filteredOrgs as org}
								<tr class="hover:bg-[var(--color-bg-secondary)] transition-colors cursor-pointer">
									<td class="px-6 py-4">
										<p class="text-sm font-medium text-[var(--color-text)]">{org.name}</p>
										<p class="text-xs text-[var(--color-text-secondary)]">{org.slug}</p>
									</td>
									<td class="px-6 py-4">
										<span class="px-2 py-0.5 text-xs font-medium rounded-full {planStyles[org.subscriptionTier] || 'bg-[var(--color-gray)] text-white'}">
											{tierLabel(org.subscriptionTier)}
										</span>
									</td>
									<td class="px-6 py-4">
										<span class="px-2 py-0.5 text-xs font-medium rounded-full {planStyles[org.subscriptionStatus] || 'bg-[var(--color-gray)] text-white'}">
											{org.subscriptionStatus}
										</span>
									</td>
									<td class="px-6 py-4 text-sm text-[var(--color-text-secondary)]">{org.maxUsers}</td>
									<td class="px-6 py-4">
										<span class="px-2 py-0.5 text-xs font-medium rounded-full {statusStyles[org.status] || 'bg-[var(--color-gray)] text-white'}">
											{org.status}
										</span>
									</td>
									<td class="px-6 py-4 text-sm text-[var(--color-text-secondary)]">{fmtDate(org.createdAt)}</td>
									<td class="px-6 py-4 text-right">
										<button onclick={() => toggleOrgStatus(org)} class="rounded-md px-2 py-1 text-xs font-medium {org.status === 'active' ? 'text-[var(--color-warning)] hover:bg-[var(--color-warning)]/10' : 'text-[var(--color-success)] hover:bg-[var(--color-success)]/10'}">
											{org.status === 'active' ? 'Suspend' : 'Activate'}
										</button>
									</td>
								</tr>
							{/each}
						</tbody>
					</table>
				</div>
				{#if filteredOrgs.length === 0 && !searchQuery}
					<div class="py-16 text-center">
						<Building2 class="w-12 h-12 text-[var(--color-text-tertiary)] mx-auto mb-3" />
						<p class="text-sm font-medium text-[var(--color-text)]">No organizations yet</p>
						<p class="mt-1 text-xs text-[var(--color-text-secondary)]">Organizations are created when customers sign up and connect their Microsoft 365 tenants.</p>
					</div>
				{:else if filteredOrgs.length === 0}
					<div class="py-12 text-center">
						<Search class="w-10 h-10 text-[var(--color-text-tertiary)] mx-auto mb-3" />
						<p class="text-sm text-[var(--color-text-secondary)]">No organizations match "{searchQuery}"</p>
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
