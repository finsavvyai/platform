<script lang="ts">
	import PageHeader from '$components/ui/PageHeader.svelte';
	import { api } from '$api/client';
	import { toasts } from '$stores/toast';
	import { onMount } from 'svelte';
	import { Trash2, Copy, KeyRound, AlertTriangle } from 'lucide-svelte';
	import McpConnectionHelp from '$components/settings/McpConnectionHelp.svelte';

	interface KeyRow {
		id: string; label: string; prefix: string;
		lastUsedAt: string | null; revokedAt: string | null;
		createdAt: string; active: boolean;
	}

	let keys = $state<KeyRow[]>([]);
	let loading = $state(true);
	let creating = $state(false);
	let newLabel = $state('');
	let mintedPlaintext = $state<string | null>(null);
	let mintedLabel = $state<string | null>(null);
	let copied = $state(false);

	onMount(load);

	async function load() {
		loading = true;
		try {
			const res = await api.get<{ keys: KeyRow[] }>('/mcp-keys');
			keys = res.keys ?? [];
		} catch { keys = []; }
		finally { loading = false; }
	}

	async function create() {
		const label = newLabel.trim();
		if (!label) return;
		creating = true;
		try {
			const res = await api.post<{ plaintext: string; label: string }>('/mcp-keys', { label });
			mintedPlaintext = res.plaintext;
			mintedLabel = res.label;
			newLabel = '';
			await load();
		} catch (e) {
			toasts.error(e instanceof Error ? e.message : 'Could not create key');
		} finally { creating = false; }
	}

	async function revoke(id: string, label: string) {
		if (!confirm(`Revoke "${label}"? Anyone using this key will be disconnected immediately.`)) return;
		try {
			await api.delete(`/mcp-keys/${id}`);
			toasts.success('Key revoked');
			await load();
		} catch (e) {
			toasts.error(e instanceof Error ? e.message : 'Could not revoke');
		}
	}

	async function copyMinted() {
		if (!mintedPlaintext) return;
		await navigator.clipboard.writeText(mintedPlaintext);
		copied = true;
		setTimeout(() => (copied = false), 1500);
	}

	function fmtAge(iso: string | null): string {
		if (!iso) return '—';
		const ms = Date.now() - Date.parse(iso);
		const h = ms / 3600_000;
		if (h < 1) return `${Math.round(ms / 60_000)}m ago`;
		if (h < 48) return `${Math.round(h)}h ago`;
		return `${Math.round(h / 24)}d ago`;
	}
</script>

<svelte:head><title>API Keys | TenantIQ</title></svelte:head>

<div class="space-y-6">
	<PageHeader title="MCP API Keys" description="Long-lived keys for connecting Claude Desktop, Cowork, or your own MCP client to TenantIQ." iconPath="M15.75 5.25a3 3 0 013 3m3 0a6 6 0 01-7.029 5.912c-.563-.097-1.159.026-1.563.43L10.5 17.25H8.25v2.25H6v2.25H2.25v-2.818c0-.597.237-1.17.659-1.591l6.499-6.499c.404-.404.527-1 .43-1.563A6 6 0 1121.75 8.25z">
		<a href="/settings" class="btn-secondary">Back to settings</a>
	</PageHeader>

	{#if mintedPlaintext}
		<div class="minted-banner">
			<div class="minted-head">
				<AlertTriangle size={16} />
				<strong>Copy this key now — it won't be shown again.</strong>
			</div>
			<p class="minted-label">Label: <code>{mintedLabel}</code></p>
			<div class="minted-key-row">
				<code class="minted-key">{mintedPlaintext}</code>
				<button class="copy-btn" onclick={copyMinted}>
					<Copy size={14} /> {copied ? 'Copied!' : 'Copy'}
				</button>
			</div>
			<button class="dismiss" onclick={() => { mintedPlaintext = null; mintedLabel = null; }}>I've stored it — dismiss</button>
		</div>
	{/if}

	<div class="panel">
		<div class="panel-header">
			<div>
				<h2 class="panel-title">Create a new key</h2>
				<p class="panel-sub">Give it a memorable label so you can revoke the right one later. Admin role required.</p>
			</div>
		</div>
		<div class="create-form">
			<input
				bind:value={newLabel}
				placeholder="e.g. Claude Desktop — laptop, Cowork prod, …"
				class="create-input"
				onkeydown={(e) => { if (e.key === 'Enter') create(); }}
				maxlength="80"
			/>
			<button class="btn-primary" onclick={create} disabled={creating || !newLabel.trim()}>
				{creating ? 'Creating…' : 'Create key'}
			</button>
		</div>
	</div>

	<div class="panel overflow-hidden">
		<div class="panel-header">
			<div>
				<h2 class="panel-title">Active keys</h2>
				<p class="panel-sub">Hover any prefix to see when it last authenticated.</p>
			</div>
		</div>

		{#if loading}
			<div class="p-6 text-sm text-[var(--color-text-secondary)]">Loading…</div>
		{:else if keys.length === 0}
			<div class="p-8 text-center">
				<KeyRound size={32} class="mx-auto mb-2 text-[var(--color-text-tertiary)]" />
				<p class="text-sm text-[var(--color-text-secondary)]">No API keys yet. Create one above to connect Claude Desktop or Cowork.</p>
			</div>
		{:else}
			<div class="overflow-x-auto">
				<table class="min-w-full">
					<thead class="bg-[var(--color-bg-tertiary)]">
						<tr>
							<th>Label</th><th>Prefix</th><th>Last used</th><th>Created</th><th class="text-right"></th>
						</tr>
					</thead>
					<tbody class="divide-y divide-[var(--color-border)]">
						{#each keys as k (k.id)}
							<tr class:revoked={!k.active}>
								<td>
									<p class="text-sm font-medium">{k.label}</p>
									{#if !k.active}<p class="text-xs text-[var(--color-text-tertiary)]">Revoked {fmtAge(k.revokedAt)}</p>{/if}
								</td>
								<td><code class="prefix-code">{k.prefix}…</code></td>
								<td class="text-xs text-[var(--color-text-secondary)] tabular-nums">{fmtAge(k.lastUsedAt)}</td>
								<td class="text-xs text-[var(--color-text-secondary)] tabular-nums">{fmtAge(k.createdAt)}</td>
								<td class="text-right">
									{#if k.active}
										<button class="revoke-btn" onclick={() => revoke(k.id, k.label)}>
											<Trash2 size={13} /> Revoke
										</button>
									{/if}
								</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
		{/if}
	</div>

	<McpConnectionHelp />
</div>

<style>
	th { padding: 0.75rem 1rem; text-align: left; font-size: 0.75rem; font-weight: 500; color: var(--color-text-secondary); }
	td { padding: 0.75rem 1rem; }
	tr.revoked { opacity: 0.5; }

	.minted-banner { background: color-mix(in srgb, var(--color-warning) 8%, var(--color-surface)); border: 1px solid color-mix(in srgb, var(--color-warning) 30%, transparent); border-radius: 0.75rem; padding: 1rem 1.25rem; }
	.minted-head { display: flex; align-items: center; gap: 0.5rem; color: var(--color-warning); margin-bottom: 0.5rem; }
	.minted-label { font-size: 0.8125rem; color: var(--color-text-secondary); margin: 0 0 0.5rem 0; }
	.minted-key-row { display: flex; gap: 0.5rem; align-items: center; }
	.minted-key { flex: 1; font-family: 'SF Mono', Menlo, monospace; font-size: 0.8125rem; padding: 0.5rem 0.75rem; background: var(--color-bg-tertiary); border: 1px solid var(--color-border); border-radius: 0.375rem; word-break: break-all; }
	.copy-btn { display: inline-flex; align-items: center; gap: 0.25rem; padding: 0.5rem 0.75rem; background: var(--color-primary); color: white; border: none; border-radius: 0.375rem; font-size: 0.8125rem; font-weight: 500; cursor: pointer; min-height: 36px; }
	.dismiss { margin-top: 0.75rem; background: transparent; border: none; color: var(--color-text-secondary); font-size: 0.75rem; cursor: pointer; text-decoration: underline; }

	.create-form { display: flex; gap: 0.5rem; padding: 0 1rem 1rem 1rem; }
	.create-input { flex: 1; min-height: 40px; padding: 0.5rem 0.75rem; background: var(--color-surface); border: 1px solid var(--color-border); border-radius: 0.5rem; color: var(--color-text); font-size: 0.875rem; }

	.prefix-code { font-family: 'SF Mono', Menlo, monospace; font-size: 0.75rem; padding: 0.125rem 0.375rem; background: var(--color-bg-tertiary); border-radius: 0.25rem; }
	.revoke-btn { display: inline-flex; align-items: center; gap: 0.25rem; padding: 0.375rem 0.75rem; background: transparent; color: var(--color-danger); border: 1px solid color-mix(in srgb, var(--color-danger) 30%, transparent); border-radius: 0.375rem; font-size: 0.75rem; cursor: pointer; min-height: 32px; }
	.revoke-btn:hover { background: color-mix(in srgb, var(--color-danger) 8%, transparent); }
</style>
