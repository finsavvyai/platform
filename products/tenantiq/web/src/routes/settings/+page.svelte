<script lang="ts">
	import ConfirmModal from '$components/ConfirmModal.svelte';
	import AIProviderSettings from '$lib/components/settings/AIProviderSettings.svelte';
	import WebhookSettings from '$lib/components/settings/WebhookSettings.svelte';
	import BillingPlans from '$lib/components/settings/BillingPlans.svelte';
	import TenantList from '$lib/components/settings/TenantList.svelte';
	import InactivityThreshold from '$lib/components/settings/InactivityThreshold.svelte';
	import PageHeader from '$components/ui/PageHeader.svelte';
	import { auth } from '$stores/auth';
	import { tenant } from '$stores/tenant';
	import { api } from '$api/client';
	import { formatRelativeTime } from '$utils/format';

	let newAzureTenantId = $state('');
	let newDisplayName = $state('');
	let adding = $state(false);
	let disconnectTarget = $state<string | null>(null);
	let purgeTarget = $state<string | null>(null);
	async function addTenant() {
		if (!newAzureTenantId.trim() || !newDisplayName.trim()) return;
		adding = true;
		try {
			const result = await api.post<{ tenant: { id: string }; token?: string }>('/tenants', {
				azureTenantId: newAzureTenantId.trim(),
				displayName: newDisplayName.trim(),
				domain: newAzureTenantId.trim()
			});
			// Session cookie is automatically updated by the API response
			newAzureTenantId = '';
			newDisplayName = '';
			// Reload tenants
			const data = await api.get<{ tenants: Array<{ id: string; displayName: string; domain: string; status: 'active' | 'suspended' | 'disconnected'; lastSyncAt: string | null }> }>('/tenants');
			tenant.setTenants(data.tenants);
			if (data.tenants.length === 1) {
				tenant.setCurrentTenant(data.tenants[0].id);
			}
		} catch (err) { console.error('[Settings] addTenant', err); } finally {
			adding = false;
		}
	}

	async function confirmDisconnect() {
		if (!disconnectTarget) return;
		try {
			await api.delete(`/tenants/${disconnectTarget}`);
			await reloadTenants();
		} catch (err) { console.error('[Settings] confirmDisconnect', err); }
		disconnectTarget = null;
	}

	async function confirmPurge() {
		if (!purgeTarget) return;
		try {
			await api.delete(`/tenants/${purgeTarget}?purge=true`);
			await reloadTenants();
		} catch (err) { console.error('[Settings] confirmPurge', err); }
		purgeTarget = null;
	}

	async function reloadTenants() {
		const data = await api.get<{ tenants: Array<{ id: string; displayName: string; domain: string; status: string; lastSyncAt: string | null }> }>('/tenants');
		tenant.setTenants(data.tenants as any);
		if (data.tenants.length > 0) tenant.setCurrentTenant(data.tenants[0].id);
	}

	function logout() {
		// Call logout endpoint to clear HttpOnly session cookie
		fetch(
			(import.meta.env.PUBLIC_API_URL ? `${import.meta.env.PUBLIC_API_URL}/api` : 'https://api.tenantiq.app/api') + '/auth/logout',
			{ method: 'POST', credentials: 'include' },
		).catch(() => {});
		auth.logout();
		window.location.href = '/';
	}
</script>

<svelte:head>
	<title>Settings | TenantIQ</title>
</svelte:head>

<div class="page-container space-y-6">
	<PageHeader title="Settings" description="Manage your tenants, billing, and account" />
	{#if $auth.user}
		<div class="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
			<h2 class="mb-3 section-title">Account</h2>
			<div class="flex items-center justify-between">
				<div class="grid grid-cols-3 gap-4 text-sm flex-1">
					<div><p class="text-xs text-[var(--color-text-secondary)]">Name</p><p class="text-[var(--color-text)]">{$auth.user.name}</p></div>
					<div><p class="text-xs text-[var(--color-text-secondary)]">Email</p><p class="text-[var(--color-text)]">{$auth.user.email}</p></div>
					<div><p class="text-xs text-[var(--color-text-secondary)]">Role</p><p class="text-[var(--color-text)]">{$auth.user.role}</p></div>
				</div>
				<button onclick={logout} class="rounded-md border border-[var(--color-danger)] px-3 py-1.5 text-sm text-[var(--color-danger)] hover:bg-[var(--color-danger)]/5">Sign Out</button>
			</div>
		</div>
	{/if}

	<div class="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
		<div class="flex items-center justify-between">
			<div>
				<h2 class="section-title">Enterprise SSO</h2>
				<p class="mt-0.5 text-xs text-[var(--color-text-secondary)]">Configure SAML or OIDC identity providers for single sign-on.</p>
			</div>
			<a href="/settings/sso" class="btn-primary">Configure SSO</a>
		</div>
	</div>

	<TenantList onDisconnect={(id) => (disconnectTarget = id)} onPurge={(id) => (purgeTarget = id)} />

	<InactivityThreshold />
	<BillingPlans />
	<AIProviderSettings />
	<WebhookSettings />
	<div class="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
		<h2 class="mb-3 section-title">Add Tenant</h2>
		<div class="flex gap-3">
			<input
				bind:value={newDisplayName}
				placeholder="Display name"
				class="flex-1 rounded-md border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 text-sm text-[var(--color-text)] placeholder:text-[var(--color-text-secondary)]"
			/>
			<input
				bind:value={newAzureTenantId}
				placeholder="Azure Tenant ID"
				class="flex-1 rounded-md border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 text-sm text-[var(--color-text)] placeholder:text-[var(--color-text-secondary)]"
			/>
			<button
				onclick={addTenant}
				disabled={adding || !newAzureTenantId.trim() || !newDisplayName.trim()}
				class="btn-primary"
			>
				{adding ? 'Adding...' : 'Add'}
			</button>
		</div>
	</div>
</div>

<ConfirmModal
	open={disconnectTarget !== null}
	title="Disconnect Tenant"
	description="This will disconnect the tenant and stop monitoring. Your data will be preserved and you can reconnect later."
	confirmLabel="Disconnect"
	destructive={true}
	onConfirm={confirmDisconnect}
	onCancel={() => (disconnectTarget = null)}
/>

<ConfirmModal
	open={purgeTarget !== null}
	title="Remove Tenant Entirely"
	description="This will permanently delete the tenant and ALL its data including users, licenses, alerts, audit logs, backups, and configurations. This action cannot be undone."
	confirmLabel="Remove Everything"
	destructive={true}
	onConfirm={confirmPurge}
	onCancel={() => (purgeTarget = null)}
/>
