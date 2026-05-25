<script lang="ts">
	import { api } from '$api/client';
	import { toasts } from '$stores/toast';
	import CreateRelationshipForm from '$lib/components/gdap/CreateRelationshipForm.svelte';
	import AccessAssignmentForm from '$lib/components/gdap/AccessAssignmentForm.svelte';

	interface Relationship {
		id: string; customerId: string; customerName: string; displayName: string;
		status: string; roles: string[]; duration: string;
		createdAt: number; expiresAt: number | null;
	}
	interface PartnerInfo { partner_id: string; partner_tenant_id: string; created_at: number }

	let relationships = $state<Relationship[]>([]);
	let availableRoles = $state<{ id: string; name: string }[]>([]);
	let partnerInfo = $state<PartnerInfo | null>(null);
	let loading = $state(true);
	let showCreate = $state(false);
	let assigningTo = $state<string | null>(null);

	let partnerId = $state('');
	let partnerTenantId = $state('');
	let configuringPartner = $state(false);

	const statusColors: Record<string, string> = {
		active: '#22c55e', pending: '#f59e0b', expired: '#64748b', terminated: '#ef4444', created: '#3b82f6',
	};

	$effect(() => { loadData(); });

	async function loadData() {
		loading = true;
		try {
			const [relRes, partRes, rolesRes] = await Promise.all([
				api.get<{ data: Relationship[] }>('/gdap/relationships'),
				api.get<{ data: PartnerInfo | null }>('/gdap/partner-info').catch(() => ({ data: null })),
				api.get<{ data: { id: string; name: string }[] }>('/gdap/roles'),
			]);
			relationships = relRes.data ?? [];
			partnerInfo = partRes.data;
			availableRoles = rolesRes.data ?? [];
		} catch { /* ignore — UI shows empty states */ }
		finally { loading = false; }
	}

	async function terminateRelationship(id: string) {
		try {
			await api.delete(`/gdap/relationships/${id}`);
			toasts.success('Relationship terminated');
			loadData();
		} catch { toasts.error('Failed to terminate'); }
	}

	async function configurePartner() {
		if (!partnerId.trim() || !partnerTenantId.trim()) { toasts.error('Enter Partner Center details'); return; }
		configuringPartner = true;
		try {
			await api.post('/gdap/partner-info', { partnerId: partnerId.trim(), partnerTenantId: partnerTenantId.trim() });
			toasts.success('Partner Center configured');
			loadData();
		} catch (e) { toasts.error(e instanceof Error ? e.message : 'Failed to configure'); }
		finally { configuringPartner = false; }
	}

	function fmtDate(ts: number | null): string {
		if (!ts) return '—';
		// Backend stores integer milliseconds since epoch (Date.now()).
		return new Date(ts).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
	}

	function roleNameById(id: string): string {
		return availableRoles.find((r) => r.id === id)?.name ?? id;
	}
</script>

<svelte:head><title>GDAP Management | TenantIQ</title></svelte:head>

<div class="gdap-page space-y-6">
	<div class="animate-fade-up flex items-start justify-between gap-4">
		<div>
			<h1 class="text-xl font-semibold tracking-tight text-[var(--color-text)]">GDAP & Partner Center</h1>
			<p class="text-[13px] text-[var(--color-text-secondary)]">Manage Granular Delegated Admin Privileges for customer tenants</p>
		</div>
		<button class="create-btn" onclick={() => (showCreate = !showCreate)}>
			{showCreate ? 'Cancel' : '+ New Relationship'}
		</button>
	</div>

	{#if !partnerInfo}
		<div class="config-card animate-fade-up delay-1">
			<h3>Configure Partner Center</h3>
			<p>Connect your Microsoft Partner Center to manage GDAP relationships. Partner Tenant ID is the GUID of your own M365 tenant — the one you use to manage customers.</p>
			<div class="config-form">
				<input class="config-input" bind:value={partnerId} placeholder="Partner ID (MPN ID)" />
				<input class="config-input" bind:value={partnerTenantId} placeholder="Partner Tenant ID (GUID)" />
				<button class="config-btn" onclick={configurePartner} disabled={configuringPartner}>
					{configuringPartner ? 'Connecting...' : 'Connect Partner Center'}
				</button>
			</div>
		</div>
	{:else}
		<div class="partner-bar animate-fade-up delay-1">
			<span class="partner-label">Partner Center</span>
			<span class="partner-id">{partnerInfo.partner_id}</span>
			<span class="partner-tenant">tenant {partnerInfo.partner_tenant_id}</span>
			<span class="partner-status">Connected</span>
		</div>
	{/if}

	{#if showCreate}
		<CreateRelationshipForm
			availableRoles={availableRoles}
			onCreated={() => { showCreate = false; loadData(); }}
			onCancel={() => (showCreate = false)}
		/>
	{/if}

	<div class="rel-section animate-fade-up delay-2">
		<h3>Relationships ({relationships.length})</h3>
		{#if loading}
			<div class="skeleton-list">{#each [1,2,3] as _}<div class="skel-row"></div>{/each}</div>
		{:else if relationships.length === 0}
			<div class="empty-state">
				<p>No GDAP relationships yet</p>
				<p class="empty-sub">Create your first relationship to manage customer tenants with least-privilege access.</p>
			</div>
		{:else}
			<div class="rel-list">
				{#each relationships as rel (rel.id)}
					<div class="rel-card">
						<div class="rel-header">
							<div>
								<h4>{rel.displayName}</h4>
								<p class="rel-customer">{rel.customerName || rel.customerId}</p>
							</div>
							<span class="rel-status" style="color: {statusColors[rel.status] ?? '#64748b'};">{rel.status}</span>
						</div>
						<div class="rel-meta">
							<span>Created: {fmtDate(rel.createdAt)}</span>
							<span>Expires: {fmtDate(rel.expiresAt)}</span>
							<span>{rel.roles.length} role{rel.roles.length !== 1 ? 's' : ''}</span>
						</div>
						<div class="rel-roles">
							{#each rel.roles.slice(0, 4) as role (role)}
								<span class="role-tag">{roleNameById(role)}</span>
							{/each}
							{#if rel.roles.length > 4}<span class="role-tag more">+{rel.roles.length - 4}</span>{/if}
						</div>
						{#if rel.status === 'active' && partnerInfo}
							<div class="actions">
								<button class="assign-btn" onclick={() => (assigningTo = assigningTo === rel.id ? null : rel.id)}>
									{assigningTo === rel.id ? 'Cancel assign' : 'Assign access →'}
								</button>
								<button class="terminate-btn" onclick={() => terminateRelationship(rel.id)}>Terminate</button>
							</div>
							{#if assigningTo === rel.id}
								<AccessAssignmentForm relationshipId={rel.id} availableRoles={availableRoles} onAssigned={() => { assigningTo = null; loadData(); }} />
							{/if}
						{/if}
					</div>
				{/each}
			</div>
		{/if}
	</div>
</div>

<style>
	.gdap-page { max-width: 960px; }
	.create-btn { padding: 8px 18px; border-radius: 10px; background: var(--color-primary); color: white; border: none; font-size: 13px; font-weight: 600; cursor: pointer; }
	.config-card { padding: 24px; border-radius: 16px; border: 1px solid var(--color-border); background: var(--color-surface); }
	.config-card h3 { font-size: 16px; font-weight: 700; margin-bottom: 6px; }
	.config-card p { font-size: 13px; color: var(--color-text-secondary); margin-bottom: 16px; }
	.config-form { display: flex; gap: 8px; flex-wrap: wrap; }
	.config-input { flex: 1; min-width: 200px; height: 42px; border-radius: 10px; border: 1px solid var(--color-border); background: var(--color-bg); padding: 0 14px; font-size: 14px; color: var(--color-text); }
	.config-btn { height: 42px; padding: 0 20px; border-radius: 10px; background: var(--color-primary); color: white; border: none; font-size: 14px; font-weight: 600; cursor: pointer; white-space: nowrap; }
	.partner-bar { display: flex; align-items: center; gap: 12px; padding: 12px 18px; border-radius: 12px; border: 1px solid var(--color-border); background: var(--color-surface); font-size: 13px; flex-wrap: wrap; }
	.partner-label { font-weight: 600; color: var(--color-text-secondary); }
	.partner-id, .partner-tenant { font-family: monospace; color: var(--color-text-tertiary); font-size: 12px; }
	.partner-status { font-weight: 700; margin-left: auto; color: #22c55e; }
	.rel-section h3 { font-size: 16px; font-weight: 700; margin-bottom: 12px; }
	.rel-list { display: flex; flex-direction: column; gap: 10px; }
	.rel-card { padding: 18px; border-radius: 14px; border: 1px solid var(--color-border); background: var(--color-surface); }
	.rel-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 8px; }
	.rel-header h4 { font-size: 15px; font-weight: 700; }
	.rel-customer { font-size: 12px; color: var(--color-text-tertiary); margin-top: 2px; font-family: monospace; }
	.rel-status { font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; }
	.rel-meta { display: flex; gap: 16px; font-size: 12px; color: var(--color-text-tertiary); margin-bottom: 10px; }
	.rel-roles { display: flex; gap: 4px; flex-wrap: wrap; margin-bottom: 10px; }
	.role-tag { font-size: 11px; padding: 3px 10px; border-radius: 100px; background: rgba(59,130,246,0.08); color: var(--color-primary); font-weight: 500; }
	.role-tag.more { background: var(--color-bg-secondary); color: var(--color-text-tertiary); }
	.actions { display: flex; gap: 8px; }
	.assign-btn, .terminate-btn { font-size: 12px; padding: 5px 14px; border-radius: 8px; cursor: pointer; font-weight: 600; border: 1px solid; }
	.assign-btn { border-color: rgba(59,130,246,0.3); background: rgba(59,130,246,0.05); color: var(--color-primary); }
	.terminate-btn { border-color: rgba(239,68,68,0.2); background: rgba(239,68,68,0.05); color: #ef4444; }
	.empty-state { text-align: center; padding: 40px; color: var(--color-text-secondary); }
	.empty-sub { font-size: 13px; color: var(--color-text-tertiary); margin-top: 6px; }
	.skeleton-list { display: flex; flex-direction: column; gap: 10px; }
	.skel-row { height: 80px; border-radius: 14px; background: var(--color-bg-secondary); animation: pulse 1.5s ease-in-out infinite; }
	@keyframes pulse { 0%,100% { opacity: 1; } 50% { opacity: 0.4; } }
</style>
