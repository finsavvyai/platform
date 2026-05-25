<script lang="ts">
	import PageHeader from '$components/ui/PageHeader.svelte';
	import { api } from '$api/client';
	import { toasts } from '$stores/toast';
	import { onMount } from 'svelte';
	import { Trash2, Plug, RefreshCw } from 'lucide-svelte';

	interface Server { id: string; name: string; url: string; enabled: boolean; hasBearer: boolean }
	interface ServerWithTools { serverId: string; serverName: string; tools: { name: string; description: string }[]; error?: string }

	let servers = $state<Server[]>([]);
	let toolsByServer = $state<Record<string, ServerWithTools>>({});
	let loading = $state(true);
	let creating = $state(false);
	let newName = $state('');
	let newUrl = $state('');
	let newBearer = $state('');

	onMount(async () => { await load(); await loadTools(); });

	async function load() {
		loading = true;
		try {
			const r = await api.get<{ servers: Server[] }>('/mcp-external');
			servers = r.servers ?? [];
		} catch { servers = []; }
		finally { loading = false; }
	}

	async function loadTools() {
		try {
			const r = await api.get<{ servers: ServerWithTools[] }>('/mcp-external/tools');
			toolsByServer = Object.fromEntries((r.servers ?? []).map((s) => [s.serverId, s]));
		} catch { /* ignore */ }
	}

	async function add() {
		if (!newName.trim() || !newUrl.trim()) return;
		creating = true;
		try {
			await api.post('/mcp-external', { name: newName, url: newUrl, bearer: newBearer || undefined });
			toasts.success('Server registered');
			newName = ''; newUrl = ''; newBearer = '';
			await load(); await loadTools();
		} catch (e) {
			toasts.error(e instanceof Error ? e.message : 'Could not register');
		} finally { creating = false; }
	}

	async function toggle(s: Server) {
		try {
			await api.patch(`/mcp-external/${s.id}`, { enabled: !s.enabled });
			await load(); await loadTools();
		} catch (e) { toasts.error(e instanceof Error ? e.message : 'Update failed'); }
	}

	async function remove(s: Server) {
		if (!confirm(`Remove "${s.name}"?`)) return;
		try {
			await api.delete(`/mcp-external/${s.id}`);
			toasts.success('Removed');
			await load(); await loadTools();
		} catch (e) { toasts.error(e instanceof Error ? e.message : 'Remove failed'); }
	}

	async function probe(s: Server) {
		try {
			const r = await api.post<{ ok: boolean; serverInfo?: { name: string; version?: string }; error?: string }>(`/mcp-external/${s.id}/probe`, {});
			if (r.ok) toasts.success(`✓ ${s.name} → ${r.serverInfo?.name ?? 'unknown'}`);
			else toasts.error(`✗ ${s.name}: ${r.error}`);
		} catch (e) { toasts.error(e instanceof Error ? e.message : 'Probe failed'); }
	}
</script>

<svelte:head><title>MCP Clients | TenantIQ</title></svelte:head>

<div class="space-y-6">
	<PageHeader title="External MCP Servers" description="Register MCP servers (Microsoft Graph MCP, GitHub MCP, your own) so TenantIQ's AI Agent can call their tools as part of its toolbelt." iconPath="M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25">
		<a href="/settings" class="btn-secondary">Back</a>
	</PageHeader>

	<div class="panel">
		<div class="panel-header"><div><h2 class="panel-title">Register a server</h2></div></div>
		<div class="form">
			<input bind:value={newName} placeholder="Display name (e.g. GitHub MCP)" class="input" maxlength="80" />
			<input bind:value={newUrl} placeholder="https://example.com/mcp (JSON-RPC endpoint)" class="input" />
			<input bind:value={newBearer} placeholder="Bearer token (optional)" class="input" type="password" />
			<button class="btn-primary" onclick={add} disabled={creating || !newName.trim() || !newUrl.trim()}>
				{creating ? 'Adding…' : '+ Add'}
			</button>
		</div>
	</div>

	<section>
		{#if loading}
			<p class="muted">Loading…</p>
		{:else if servers.length === 0}
			<div class="empty">
				<Plug size={28} />
				<p>No external MCP servers registered yet.</p>
				<p class="hint">Once Microsoft ships a Graph MCP server, plug it in here. Same for GitHub MCP, Moody's MCP, your own internal tooling — TenantIQ will list+call their tools alongside our own.</p>
			</div>
		{:else}
			<ul class="servers">
				{#each servers as s (s.id)}
					{@const meta = toolsByServer[s.id]}
					<li class="server" class:disabled={!s.enabled}>
						<div class="head">
							<strong>{s.name}</strong>
							<span class="status {s.enabled ? 'on' : 'off'}">{s.enabled ? 'Enabled' : 'Disabled'}</span>
							{#if meta?.error}<span class="err">{meta.error}</span>{/if}
							<div class="actions">
								<button class="action" title="Probe" onclick={() => probe(s)}><RefreshCw size={13} /> Probe</button>
								<button class="action" onclick={() => toggle(s)}>{s.enabled ? 'Disable' : 'Enable'}</button>
								<button class="action danger" onclick={() => remove(s)}><Trash2 size={13} /></button>
							</div>
						</div>
						<p class="url"><code>{s.url}</code> {#if s.hasBearer}<span class="bearer">🔑 bearer</span>{/if}</p>
						{#if meta && !meta.error}
							<p class="tools"><strong>{meta.tools.length}</strong> tools exposed</p>
							{#if meta.tools.length > 0}
								<details><summary>tools/list</summary>
									<ul class="tool-list">
										{#each meta.tools.slice(0, 20) as t}
											<li><code>{t.name}</code> — {t.description}</li>
										{/each}
										{#if meta.tools.length > 20}<li class="muted">+{meta.tools.length - 20} more</li>{/if}
									</ul>
								</details>
							{/if}
						{/if}
					</li>
				{/each}
			</ul>
		{/if}
	</section>
</div>

<style>
	.form { display: grid; gap: 0.5rem; padding: 0 1rem 1rem; grid-template-columns: 1fr 1fr 1fr auto; }
	.input { min-height: 38px; padding: 0.5rem 0.75rem; background: var(--color-surface); border: 1px solid var(--color-border); border-radius: 0.5rem; color: var(--color-text); font-size: 0.875rem; }
	@media (max-width: 720px) { .form { grid-template-columns: 1fr; } }
	.empty { text-align: center; padding: 2rem; color: var(--color-text-tertiary); display: flex; flex-direction: column; align-items: center; gap: 0.5rem; }
	.empty p { margin: 0; font-size: 0.875rem; }
	.empty .hint { font-size: 0.75rem; max-width: 520px; }
	.servers { list-style: none; padding: 0; margin: 0; display: flex; flex-direction: column; gap: 0.625rem; }
	.server { background: var(--color-surface); border: 1px solid var(--color-border); border-radius: 0.625rem; padding: 1rem; }
	.server.disabled { opacity: 0.65; }
	.head { display: flex; gap: 0.625rem; align-items: center; flex-wrap: wrap; }
	.head strong { font-size: 0.9375rem; color: var(--color-text); }
	.status { font-size: 0.6875rem; padding: 0.125rem 0.5rem; border-radius: 0.25rem; font-weight: 600; text-transform: uppercase; letter-spacing: 0.04em; }
	.status.on { background: color-mix(in srgb, var(--color-success) 12%, transparent); color: var(--color-success); }
	.status.off { background: var(--color-bg-tertiary); color: var(--color-text-secondary); }
	.err { font-size: 0.75rem; color: var(--color-danger); }
	.actions { margin-left: auto; display: flex; gap: 0.375rem; }
	.action { display: inline-flex; align-items: center; gap: 0.25rem; padding: 0.375rem 0.625rem; border: 1px solid var(--color-border); background: transparent; border-radius: 0.375rem; cursor: pointer; font-size: 0.75rem; color: var(--color-text); min-height: 30px; }
	.action.danger { color: var(--color-danger); border-color: color-mix(in srgb, var(--color-danger) 30%, transparent); }
	.url { font-size: 0.75rem; color: var(--color-text-secondary); margin: 0.5rem 0 0.25rem; }
	.url code { font-family: 'SF Mono', Menlo, monospace; font-size: 0.6875rem; background: var(--color-bg-tertiary); padding: 0.125rem 0.375rem; border-radius: 0.25rem; }
	.bearer { margin-left: 0.5rem; color: var(--color-text-tertiary); }
	.tools { font-size: 0.8125rem; color: var(--color-text-secondary); margin: 0.5rem 0 0; }
	details { margin-top: 0.5rem; }
	summary { cursor: pointer; font-size: 0.75rem; color: var(--color-primary); }
	.tool-list { list-style: none; padding: 0.5rem 0 0; margin: 0; display: flex; flex-direction: column; gap: 0.25rem; font-size: 0.75rem; color: var(--color-text-secondary); }
	.tool-list code { font-family: 'SF Mono', Menlo, monospace; color: var(--color-text); }
	.muted { color: var(--color-text-tertiary); font-size: 0.8125rem; }
</style>
