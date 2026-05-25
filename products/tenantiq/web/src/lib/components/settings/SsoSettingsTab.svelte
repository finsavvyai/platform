<script lang="ts">
	import { api } from '$api/client';
	import { toasts } from '$stores/toast';

	interface SsoConnection {
		id: string;
		display_name: string;
		provider: 'saml' | 'oidc';
		domain: string;
		status: 'active' | 'inactive';
		issuer_url: string | null;
		client_id: string | null;
		metadata_url: string | null;
		jit_enabled: 0 | 1;
	}

	let connections = $state<SsoConnection[]>([]);
	let loading = $state(true);
	let showAddForm = $state(false);
	let saving = $state(false);
	let provider = $state<'saml' | 'oidc'>('oidc');
	let displayName = $state('');
	let domain = $state('');
	let issuerUrl = $state('');
	let clientId = $state('');
	let metadataUrl = $state('');
	let certificate = $state('');
	let jitEnabled = $state(true);

	$effect(() => { loadConnections(); });

	async function loadConnections() {
		loading = true;
		try {
			const res = await api.get<{ connections: SsoConnection[] }>('/sso');
			connections = res.connections ?? [];
		} catch { toasts.error('Failed to load SSO connections'); }
		finally { loading = false; }
	}

	function resetForm() {
		provider = 'oidc'; displayName = ''; domain = ''; issuerUrl = '';
		clientId = ''; metadataUrl = ''; certificate = ''; jitEnabled = true;
		showAddForm = false;
	}

	async function handleSubmit(e: Event) {
		e.preventDefault();
		if (!displayName.trim() || !domain.trim()) return;
		saving = true;
		try {
			const body: Record<string, unknown> = { provider, display_name: displayName.trim(), domain: domain.trim(), jit_enabled: jitEnabled ? 1 : 0 };
			if (provider === 'oidc') { body.issuer_url = issuerUrl.trim(); body.client_id = clientId.trim(); }
			else { body.metadata_url = metadataUrl.trim(); if (certificate.trim()) body.certificate = certificate.trim(); }
			await api.post('/sso', body);
			toasts.success('SSO connection created');
			resetForm();
			await loadConnections();
		} catch { toasts.error('Failed to create SSO connection'); }
		finally { saving = false; }
	}

	async function handleDelete(id: string, name: string) {
		if (!confirm(`Remove SSO connection "${name}"? This will disable SSO for that domain.`)) return;
		try {
			await api.delete(`/sso/${id}`);
			toasts.success('SSO connection removed');
			await loadConnections();
		} catch { toasts.error('Failed to remove SSO connection'); }
	}

	const inputCls = 'w-full rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-2 py-1.5 text-xs text-[var(--color-text)] placeholder:text-[var(--color-text-tertiary)] focus:outline-none focus:border-[var(--color-primary)]';
	const labelCls = 'mb-1 block text-[11px] text-[var(--color-text-secondary)]';
</script>

<div class="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5">
	<div class="mb-4 flex items-center justify-between">
		<div>
			<h3 class="text-sm font-semibold text-[var(--color-text)]">Enterprise SSO</h3>
			<p class="mt-0.5 text-xs text-[var(--color-text-secondary)]">Configure SAML or OIDC identity providers for single sign-on.</p>
		</div>
		{#if !showAddForm}
			<button onclick={() => (showAddForm = true)} aria-label="Add SSO connection" class="rounded-lg bg-[var(--color-primary)] px-3 py-1.5 text-xs font-medium text-white hover:opacity-90">
				Add Connection
			</button>
		{/if}
	</div>

	{#if loading}
		<div class="space-y-2"><div class="h-10 skeleton rounded-lg"></div><div class="h-10 skeleton rounded-lg"></div></div>
	{:else if connections.length === 0 && !showAddForm}
		<p class="py-4 text-center text-xs text-[var(--color-text-tertiary)]">No SSO connections configured. Add one to enable enterprise sign-on.</p>
	{:else}
		<div class="space-y-2" data-testid="sso-connection-list">
			{#each connections as conn (conn.id)}
				<div class="flex items-center justify-between rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2.5">
					<div class="flex items-center gap-3">
						<span class="rounded-full bg-[var(--color-bg-tertiary)] px-2 py-0.5 text-[10px] font-semibold uppercase text-[var(--color-text-secondary)]">{conn.provider}</span>
						<div>
							<p class="text-xs font-medium text-[var(--color-text)]">{conn.display_name}</p>
							<p class="text-[11px] text-[var(--color-text-tertiary)]">{conn.domain}</p>
						</div>
					</div>
					<div class="flex items-center gap-2">
						<span class="rounded-full px-2 py-0.5 text-[10px] font-medium {conn.status === 'active' ? 'bg-green-500/10 text-green-400' : 'bg-[var(--color-bg-tertiary)] text-[var(--color-text-secondary)]'}">{conn.status}</span>
						<button onclick={() => handleDelete(conn.id, conn.display_name)} aria-label="Remove {conn.display_name} SSO connection" class="rounded-md border border-[var(--color-danger)] px-2 py-1 text-[10px] text-[var(--color-danger)] hover:bg-[var(--color-danger)]/5">Remove</button>
					</div>
				</div>
			{/each}
		</div>
	{/if}

	{#if showAddForm}
		<form onsubmit={handleSubmit} class="mt-4 space-y-3 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] p-4">
			<h4 class="text-xs font-semibold text-[var(--color-text)]">New SSO Connection</h4>
			<div class="grid grid-cols-2 gap-3">
				<div>
					<label for="sso-tab-provider" class={labelCls}>Provider</label>
					<select id="sso-tab-provider" bind:value={provider} class={inputCls}>
						<option value="oidc">OIDC</option>
						<option value="saml">SAML</option>
					</select>
				</div>
				<div>
					<label for="sso-tab-name" class={labelCls}>Display Name *</label>
					<input id="sso-tab-name" bind:value={displayName} required placeholder="Acme Corp" class={inputCls} />
				</div>
				<div class="col-span-2">
					<label for="sso-tab-domain" class={labelCls}>Domain *</label>
					<input id="sso-tab-domain" bind:value={domain} required placeholder="contoso.com" class={inputCls} />
				</div>
				{#if provider === 'oidc'}
					<div class="col-span-2"><label for="sso-tab-issuer" class={labelCls}>Issuer URL</label><input id="sso-tab-issuer" bind:value={issuerUrl} placeholder="https://accounts.google.com" class={inputCls} /></div>
					<div class="col-span-2"><label for="sso-tab-client" class={labelCls}>Client ID</label><input id="sso-tab-client" bind:value={clientId} placeholder="client-id" class={inputCls} /></div>
				{:else}
					<div class="col-span-2"><label for="sso-tab-meta" class={labelCls}>Metadata URL</label><input id="sso-tab-meta" bind:value={metadataUrl} placeholder="https://idp.contoso.com/metadata" class={inputCls} /></div>
					<div class="col-span-2">
						<label for="sso-tab-cert" class={labelCls}>Certificate (optional if Metadata URL provided)</label>
						<textarea id="sso-tab-cert" bind:value={certificate} rows={3} placeholder="-----BEGIN CERTIFICATE-----" class="{inputCls} font-mono text-[10px]"></textarea>
					</div>
				{/if}
				<div class="col-span-2">
					<label class="flex items-center gap-2 text-xs text-[var(--color-text-secondary)]">
						<input type="checkbox" bind:checked={jitEnabled} class="rounded" aria-label="Enable JIT provisioning" />
						Enable JIT provisioning (auto-create users on first SSO login)
					</label>
				</div>
			</div>
			<div class="flex justify-end gap-2 pt-1">
				<button type="button" onclick={resetForm} class="rounded-lg border border-[var(--color-border)] px-3 py-1.5 text-xs text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-secondary)]">Cancel</button>
				<button type="submit" disabled={saving} class="rounded-lg bg-[var(--color-primary)] px-3 py-1.5 text-xs font-medium text-white hover:opacity-90 disabled:opacity-50">{saving ? 'Saving...' : 'Save Connection'}</button>
			</div>
		</form>
	{/if}
</div>
