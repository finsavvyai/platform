<script lang="ts">
	import { tenant } from '$stores/tenant';
	import { api } from '$api/client';
	import { ONBOARD_ORG_URL } from '$lib/config';
	import { Shield, RefreshCw, Users, Key, FileText, Mail } from 'lucide-svelte';

	interface Props {
		onDisconnect: (id: string) => void;
		onPurge: (id: string) => void;
	}

	let { onDisconnect, onPurge }: Props = $props();

	let syncing = $state<string | null>(null);
	let expandedPermissions = $state<string | null>(null);

	const permissions = [
		{ scope: 'User.ReadWrite.All', label: 'Users', icon: Users, access: 'Read & Write' },
		{ scope: 'Group.ReadWrite.All', label: 'Groups', icon: Users, access: 'Read & Write' },
		{ scope: 'Policy.ReadWrite.ConditionalAccess', label: 'Policies', icon: Shield, access: 'Read & Write' },
		{ scope: 'SecurityEvents.Read.All', label: 'Security', icon: Shield, access: 'Read' },
		{ scope: 'AuditLog.Read.All', label: 'Audit Logs', icon: FileText, access: 'Read' },
		{ scope: 'Mail.Send', label: 'Mail', icon: Mail, access: 'Send' },
		{ scope: 'Directory.Read.All', label: 'Directory', icon: Key, access: 'Read' },
	];

	async function syncTenant(tenantId: string) {
		syncing = tenantId;
		try { await api.post(`/tenants/${tenantId}/sync`); } catch { /* */ }
		finally { syncing = null; }
	}

	function togglePermissions(id: string) {
		expandedPermissions = expandedPermissions === id ? null : id;
	}
</script>

<div class="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
	<div class="mb-3 flex items-center justify-between">
		<h2 class="text-sm font-semibold text-[var(--color-text)]">Connected Tenants</h2>
		<a
			href="{ONBOARD_ORG_URL}"
			class="inline-flex items-center gap-1.5 rounded-md bg-[var(--color-primary)] px-3 py-1.5 text-xs font-medium text-white hover:bg-[var(--color-primary-dark)]"
		>
			<svg width="12" height="12" viewBox="0 0 16 16" fill="none" aria-hidden="true">
				<path d="M8 3v10M3 8h10" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" />
			</svg>
			Connect Microsoft 365 Tenant
		</a>
	</div>
	{#if $tenant.tenants.length === 0}
		<div class="flex flex-col items-center justify-center rounded-xl border border-dashed border-[var(--color-border)] p-8 text-center">
			<p class="text-sm font-medium text-[var(--color-text)]">No tenants connected yet</p>
			<p class="mt-1 text-xs text-[var(--color-text-secondary)]">Click "Connect Microsoft 365 Tenant" above to grant admin consent and start monitoring.</p>
			<p class="mt-2 text-[11px] text-[var(--color-text-secondary)]">
				Requires a <strong>work or school</strong> account with Global Admin, Privileged Role Admin, or Application Admin on the target tenant. Personal Microsoft accounts are not supported.
			</p>
		</div>
	{:else}
		<div class="space-y-2">
			{#each $tenant.tenants as t}
				<div class="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] p-3">
					<div class="flex items-center justify-between">
						<div>
							<p class="text-sm font-medium text-[var(--color-text)]">{t.displayName}</p>
							<p class="text-xs text-[var(--color-text-secondary)]">{t.domain}</p>
						</div>
						<div class="flex items-center gap-2">
							<span class="rounded-full px-2 py-0.5 text-[10px] font-medium {t.status === 'active' ? 'bg-[var(--color-success)]/10 text-[var(--color-success)]' : 'bg-[var(--color-text-secondary)]/10 text-[var(--color-text-secondary)]'}">{t.status}</span>
							<button onclick={() => syncTenant(t.id)} disabled={syncing === t.id} class="rounded-md border border-[var(--color-border)] px-2 py-1 text-xs text-[var(--color-text-secondary)] hover:bg-[var(--color-surface)] disabled:opacity-50">
								{syncing === t.id ? 'Syncing...' : 'Sync'}
							</button>
							<button onclick={() => tenant.setCurrentTenant(t.id)} class="rounded-md border px-2 py-1 text-xs text-[var(--color-primary)] hover:bg-[var(--color-surface)] {$tenant.currentTenantId === t.id ? 'border-[var(--color-primary)]' : 'border-[var(--color-border)]'}">
								{$tenant.currentTenantId === t.id ? 'Active' : 'Select'}
							</button>
							<button onclick={() => togglePermissions(t.id)} class="rounded-md border border-[var(--color-border)] px-2 py-1 text-xs text-[var(--color-text-secondary)] hover:bg-[var(--color-surface)]">
								Permissions
							</button>
							<button onclick={() => onDisconnect(t.id)} class="rounded-md border border-[var(--color-border)] px-2 py-1 text-xs text-[var(--color-text-secondary)] hover:bg-[var(--color-bg)]">Disconnect</button>
							<button onclick={() => onPurge(t.id)} class="rounded-md border border-[var(--color-danger)]/30 px-2 py-1 text-xs text-[var(--color-danger)] hover:bg-[var(--color-danger)]/5">Remove</button>
						</div>
					</div>

					{#if expandedPermissions === t.id}
						<div class="mt-3 border-t border-[var(--color-border)] pt-3">
							<p class="mb-2 text-[11px] font-semibold text-[var(--color-text-secondary)]">Microsoft Graph API Permissions</p>
							<div class="grid grid-cols-2 gap-1.5 sm:grid-cols-4">
								{#each permissions as perm}
									<div class="flex items-center gap-2 rounded-lg bg-[var(--color-surface)] px-2.5 py-1.5">
										<perm.icon size={12} class="shrink-0 text-[var(--color-primary)]" />
										<div>
											<p class="text-[11px] font-medium text-[var(--color-text)]">{perm.label}</p>
											<p class="text-[9px] text-[var(--color-text-tertiary)]">{perm.access}</p>
										</div>
									</div>
								{/each}
							</div>
							<p class="mt-2 text-[9px] text-[var(--color-text-tertiary)]">Permissions granted via Azure AD admin consent. Manage in Azure Portal &gt; App Registrations.</p>
						</div>
					{/if}
				</div>
			{/each}
		</div>
	{/if}
</div>
