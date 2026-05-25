<script lang="ts">
	import PageHeader from '$components/ui/PageHeader.svelte';
	import RoleTimeline from '$lib/components/history/RoleTimeline.svelte';
	import PolicyLifecycle from '$lib/components/history/PolicyLifecycle.svelte';
	import { tenant } from '$stores/tenant';
	import { api } from '$api/client';
	import { untrack } from 'svelte';

	interface RoleChange {
		id: string; userDisplayName: string; userEmail: string; roleName: string;
		action: 'granted' | 'revoked'; grantedBy: string; effectiveAt: string; revokedAt: string | null;
	}
	interface PolicySnapshot {
		id: string; policyName: string; policyType: string;
		action: 'created' | 'modified' | 'enabled' | 'disabled' | 'deleted';
		changedBy: string; changedAt: string;
		previousSettings: Record<string, unknown> | null; newSettings: Record<string, unknown>;
	}

	let roleChanges = $state<RoleChange[]>([]);
	let policySnapshots = $state<PolicySnapshot[]>([]);
	let loading = $state(true);
	let activeTab = $state<'roles' | 'policies'>('roles');

	$effect(() => { if ($tenant.currentTenantId) untrack(() => loadHistory()); });

	async function loadHistory() {
		loading = true;
		try {
			const [roles, policies] = await Promise.all([
				api.get<{ changes: RoleChange[] }>(`/tenants/${$tenant.currentTenantId}/audit/role-history`),
				api.get<{ snapshots: PolicySnapshot[] }>(`/tenants/${$tenant.currentTenantId}/audit/policy-history`)
			]);
			roleChanges = roles.changes;
			policySnapshots = policies.snapshots;
		} catch (err) { console.error('[History]', err); }
		finally { loading = false; }
	}
</script>

<svelte:head><title>Role & Policy History | TenantIQ</title></svelte:head>

<div class="space-y-6">
	<PageHeader title="Config History" description="Track configuration changes over time" iconPath="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />

	<nav class="flex gap-1 border-b border-[var(--color-border)]" aria-label="History tabs">
		<button onclick={() => (activeTab = 'roles')} class="min-h-[44px] border-b-2 px-4 py-2.5 text-sm font-semibold transition-colors {activeTab === 'roles' ? 'border-[var(--color-primary)] text-[var(--color-primary)]' : 'border-transparent text-[var(--color-text-secondary)] hover:text-[var(--color-text)]'}">
			Admin Roles ({roleChanges.length})
		</button>
		<button onclick={() => (activeTab = 'policies')} class="min-h-[44px] border-b-2 px-4 py-2.5 text-sm font-semibold transition-colors {activeTab === 'policies' ? 'border-[var(--color-primary)] text-[var(--color-primary)]' : 'border-transparent text-[var(--color-text-secondary)] hover:text-[var(--color-text)]'}">
			Policy Changes ({policySnapshots.length})
		</button>
	</nav>

	{#if loading}
		<div class="space-y-3">
			{#each Array(4) as _}<div class="h-20 animate-pulse rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)]"></div>{/each}
		</div>
	{:else if activeTab === 'roles'}
		{#if roleChanges.length > 0}
			<RoleTimeline changes={roleChanges} />
		{:else}
			<div class="empty-state">
				<p class="text-sm text-[var(--color-text-secondary)]">No admin role changes recorded yet. Changes will appear here once detected.</p>
			</div>
		{/if}
	{:else}
		{#if policySnapshots.length > 0}
			<PolicyLifecycle snapshots={policySnapshots} />
		{:else}
			<div class="empty-state">
				<p class="text-sm text-[var(--color-text-secondary)]">No policy changes recorded yet. TenantIQ tracks conditional access, MFA, and compliance policy modifications.</p>
			</div>
		{/if}
	{/if}
</div>
