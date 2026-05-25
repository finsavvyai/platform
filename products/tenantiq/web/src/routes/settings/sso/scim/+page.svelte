<script lang="ts">
	import { api } from '$lib/api/client';
	import { toasts } from '$lib/stores/toast';
	import { auth } from '$lib/stores/auth';
	import { Plus, Trash2, ArrowLeft, KeyRound, Copy, AlertTriangle } from 'lucide-svelte';
	import { untrack } from 'svelte';

	interface ScimToken {
		id: string;
		displayName: string;
		scopes: string[];
		createdAt: number;
		createdBy: string;
		lastUsedAt: number | null;
		revokedAt: number | null;
		revokedBy: string | null;
		status: 'active' | 'revoked';
	}

	interface CreatedToken extends ScimToken {
		plaintextToken?: string;
	}

	let tokens = $state<ScimToken[]>([]);
	let loading = $state(true);
	let creating = $state(false);
	let showForm = $state(false);
	let newDisplayName = $state('');
	let justCreated = $state<CreatedToken | null>(null);

	$effect(() => { if ($auth.user) untrack(() => load()); });

	async function load() {
		loading = true;
		try {
			const r = await api.get<{ tokens: ScimToken[] }>('/sso/scim-tokens');
			tokens = r.tokens;
		} catch {
			toasts.error('Failed to load SCIM tokens');
		} finally {
			loading = false;
		}
	}

	async function create() {
		if (!newDisplayName.trim()) {
			toasts.error('Name is required');
			return;
		}
		creating = true;
		try {
			const r = await api.post<CreatedToken>('/sso/scim-tokens', { displayName: newDisplayName.trim() });
			justCreated = r;
			newDisplayName = '';
			showForm = false;
			await load();
		} catch (err) {
			toasts.error(err instanceof Error ? err.message : 'Create failed');
		} finally {
			creating = false;
		}
	}

	async function revoke(t: ScimToken) {
		if (!confirm(`Revoke "${t.displayName}"? IdP integrations using it will stop working immediately.`)) return;
		try {
			await api.delete(`/sso/scim-tokens/${t.id}`);
			toasts.success('Token revoked');
			await load();
		} catch {
			toasts.error('Revoke failed');
		}
	}

	async function copyToken() {
		if (!justCreated?.plaintextToken) return;
		await navigator.clipboard.writeText(justCreated.plaintextToken);
		toasts.success('Token copied to clipboard');
	}

	function formatTime(epoch: number | null): string {
		if (!epoch) return '—';
		return new Date(epoch * 1000).toLocaleString();
	}
</script>

<svelte:head><title>SCIM Tokens — TenantIQ</title></svelte:head>

<div class="page">
	<a href="/settings/sso" class="back"><ArrowLeft size={16} /> Back to SSO</a>

	<header>
		<div>
			<h1><KeyRound size={20} /> SCIM Bearer Tokens</h1>
			<p>Generate tokens for Okta, Entra ID, or other IdPs to provision users into TenantIQ via SCIM 2.0.</p>
		</div>
		<button class="btn-primary" onclick={() => (showForm = true)} disabled={showForm}>
			<Plus size={16} /> New Token
		</button>
	</header>

	{#if justCreated?.plaintextToken}
		<div class="alert-banner">
			<AlertTriangle size={20} />
			<div>
				<strong>Save this token now — it won't be shown again.</strong>
				<div class="token-display">
					<code>{justCreated.plaintextToken}</code>
					<button class="btn-secondary" onclick={copyToken}><Copy size={14} /> Copy</button>
				</div>
				<button class="btn-text" onclick={() => (justCreated = null)}>I've saved it, dismiss</button>
			</div>
		</div>
	{/if}

	{#if showForm}
		<div class="form-card">
			<label>
				Token name
				<input type="text" bind:value={newDisplayName} placeholder="e.g. Okta — Production" maxlength="100" />
			</label>
			<p class="hint">Default scopes: users:read, users:write, groups:read, groups:write</p>
			<div class="form-actions">
				<button class="btn-secondary" onclick={() => (showForm = false)} disabled={creating}>Cancel</button>
				<button class="btn-primary" onclick={create} disabled={creating || !newDisplayName.trim()}>
					{creating ? 'Creating…' : 'Generate Token'}
				</button>
			</div>
		</div>
	{/if}

	{#if loading}
		<div class="empty">Loading…</div>
	{:else if tokens.length === 0}
		<div class="empty">No SCIM tokens yet. Create one to connect Okta or Entra ID.</div>
	{:else}
		<table>
			<thead>
				<tr><th>Name</th><th>Scopes</th><th>Created</th><th>Last used</th><th>Status</th><th></th></tr>
			</thead>
			<tbody>
				{#each tokens as t (t.id)}
					<tr class:revoked={t.status === 'revoked'}>
						<td>{t.displayName}</td>
						<td><span class="scopes">{t.scopes.join(', ')}</span></td>
						<td>{formatTime(t.createdAt)}<br /><small>{t.createdBy}</small></td>
						<td>{formatTime(t.lastUsedAt)}</td>
						<td>
							{#if t.status === 'revoked'}
								<span class="badge-revoked">revoked</span>
							{:else}
								<span class="badge-active">active</span>
							{/if}
						</td>
						<td>
							{#if t.status === 'active'}
								<button class="btn-icon" onclick={() => revoke(t)} aria-label="Revoke {t.displayName}">
									<Trash2 size={16} />
								</button>
							{/if}
						</td>
					</tr>
				{/each}
			</tbody>
		</table>
	{/if}
</div>

<style>
	.page { max-width: 1024px; margin: 0 auto; padding: 2rem 1.5rem; }
	.back { display: inline-flex; align-items: center; gap: 0.4rem; color: var(--text-tertiary); text-decoration: none; font-size: 0.875rem; margin-bottom: 1rem; }
	.back:hover { color: var(--text-primary); }
	header { display: flex; justify-content: space-between; align-items: flex-start; gap: 1rem; margin-bottom: 1.5rem; }
	header h1 { display: flex; align-items: center; gap: 0.5rem; font-size: 1.5rem; margin: 0 0 0.25rem; }
	header p { color: var(--text-secondary); margin: 0; max-width: 520px; }
	.alert-banner { display: flex; gap: 0.75rem; padding: 1rem; background: rgba(234, 179, 8, 0.1); border: 1px solid rgba(234, 179, 8, 0.4); border-radius: 8px; margin-bottom: 1rem; color: #b45309; }
	.token-display { display: flex; align-items: center; gap: 0.5rem; margin: 0.5rem 0; }
	.token-display code { background: var(--bg-secondary); padding: 0.5rem 0.75rem; border-radius: 4px; font-family: ui-monospace, monospace; font-size: 0.85rem; word-break: break-all; flex: 1; }
	.form-card { background: var(--bg-card); border: 1px solid var(--border-subtle); border-radius: 12px; padding: 1.25rem; margin-bottom: 1rem; }
	.form-card label { display: block; font-weight: 500; margin-bottom: 0.5rem; }
	.form-card input { width: 100%; padding: 0.5rem 0.75rem; border: 1px solid var(--border-subtle); border-radius: 6px; background: var(--bg-secondary); color: var(--text-primary); }
	.form-card .hint { font-size: 0.85rem; color: var(--text-tertiary); margin: 0.5rem 0 0; }
	.form-actions { display: flex; gap: 0.5rem; justify-content: flex-end; margin-top: 1rem; }
	.empty { padding: 3rem 1rem; text-align: center; color: var(--text-tertiary); border: 1px dashed var(--border-subtle); border-radius: 12px; }
	table { width: 100%; border-collapse: collapse; }
	th, td { padding: 0.75rem; text-align: left; border-bottom: 1px solid var(--border-subtle); }
	th { font-size: 0.85rem; color: var(--text-tertiary); font-weight: 500; }
	td small { color: var(--text-tertiary); }
	tr.revoked { opacity: 0.5; }
	.scopes { font-family: ui-monospace, monospace; font-size: 0.8rem; color: var(--text-secondary); }
	.badge-active { color: #16a34a; font-weight: 500; font-size: 0.85rem; }
	.badge-revoked { color: #dc2626; font-weight: 500; font-size: 0.85rem; }
	.btn-primary, .btn-secondary, .btn-icon, .btn-text { display: inline-flex; align-items: center; gap: 0.4rem; padding: 0.5rem 1rem; border-radius: 6px; cursor: pointer; font-size: 0.875rem; border: 1px solid transparent; }
	.btn-primary { background: var(--accent); color: white; }
	.btn-primary:disabled { opacity: 0.5; cursor: not-allowed; }
	.btn-secondary { background: var(--bg-secondary); border-color: var(--border-subtle); color: var(--text-primary); }
	.btn-icon { background: transparent; padding: 0.4rem; color: var(--text-tertiary); }
	.btn-icon:hover { color: #dc2626; background: rgba(220, 38, 38, 0.1); }
	.btn-text { background: transparent; border: none; color: var(--text-secondary); padding: 0.25rem 0; }
</style>
