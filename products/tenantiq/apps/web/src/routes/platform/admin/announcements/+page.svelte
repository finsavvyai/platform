<script lang="ts">
	/**
	 * Admin Announcements Page — create, edit, delete platform announcements.
	 */
	import Card from '$lib/components/ui/Card.svelte';
	import { auth } from '$stores/auth';
	import { toasts } from '$stores/toast';
	import { Info, AlertTriangle, Wrench, Trash2, Pencil, Plus } from 'lucide-svelte';

	interface Announcement {
		id: string; title: string; message: string;
		type: 'info' | 'warning' | 'maintenance';
		active: number; expires_at: string | null; created_at: string;
	}

	let loading = $state(true);
	let items = $state<Announcement[]>([]);
	let showForm = $state(false);
	let editId = $state<string | null>(null);
	let form = $state<{ title: string; message: string; type: 'info' | 'warning' | 'maintenance'; active: boolean; expiresAt: string }>({ title: '', message: '', type: 'info', active: true, expiresAt: '' });

	const API = 'https://api.tenantiq.app/api/announcements';
	const headers = $derived({ 'Content-Type': 'application/json' });
	const typeIcons = { info: Info, warning: AlertTriangle, maintenance: Wrench };

	$effect(() => { if ($auth.user) loadAll(); });

	async function loadAll() {
		loading = true;
		try {
			const res = await fetch(`${API}/admin/list`, { headers, credentials: 'include' });
			const data = await res.json();
			items = data.announcements ?? [];
		} catch { /* silent */ } finally { loading = false; }
	}

	function openCreate() {
		editId = null;
		form = { title: '', message: '', type: 'info', active: true, expiresAt: '' };
		showForm = true;
	}

	function openEdit(a: Announcement) {
		editId = a.id;
		form = { title: a.title, message: a.message, type: a.type, active: !!a.active, expiresAt: a.expires_at ?? '' };
		showForm = true;
	}

	async function save() {
		const url = editId ? `${API}/admin/${editId}` : `${API}/admin/create`;
		const method = editId ? 'PUT' : 'POST';
		const body = { ...form, expiresAt: form.expiresAt || undefined };
		try {
			const res = await fetch(url, { method, headers, credentials: 'include', body: JSON.stringify(body) });
			if (!res.ok) throw new Error();
			toasts.success(editId ? 'Announcement updated' : 'Announcement created');
			showForm = false;
			await loadAll();
		} catch { toasts.error('Failed to save'); }
	}

	async function remove(id: string) {
		try {
			await fetch(`${API}/admin/${id}`, { method: 'DELETE', headers, credentials: 'include' });
			toasts.success('Announcement deleted');
			items = items.filter((a) => a.id !== id);
		} catch { toasts.error('Failed to delete'); }
	}
</script>

<svelte:head><title>Announcements - Admin - TenantIQ</title></svelte:head>

<div class="flex items-center justify-between mb-6">
	<h2 class="text-xl font-semibold text-[var(--color-text)]">Announcements</h2>
	<button onclick={openCreate} class="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium bg-[var(--color-primary)] text-white hover:opacity-90 transition-opacity">
		<Plus size={16} /> New Announcement
	</button>
</div>

{#if showForm}
	<Card variant="elevated" padding="lg" class="mb-6">
		<h3 class="text-sm font-semibold text-[var(--color-text)] mb-4">{editId ? 'Edit' : 'Create'} Announcement</h3>
		<div class="space-y-4">
			<input bind:value={form.title} placeholder="Title" class="w-full px-3 py-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] text-sm text-[var(--color-text)]" />
			<textarea bind:value={form.message} placeholder="Message" rows="3" class="w-full px-3 py-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] text-sm text-[var(--color-text)]"></textarea>
			<div class="flex gap-4 flex-wrap">
				<select bind:value={form.type} class="px-3 py-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] text-sm">
					<option value="info">Info</option>
					<option value="warning">Warning</option>
					<option value="maintenance">Maintenance</option>
				</select>
				<input bind:value={form.expiresAt} type="datetime-local" class="px-3 py-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] text-sm" />
				<label class="flex items-center gap-2 text-sm text-[var(--color-text)]">
					<input type="checkbox" bind:checked={form.active} /> Active
				</label>
			</div>
			<div class="flex gap-2">
				<button onclick={save} class="px-4 py-2 rounded-lg text-sm font-medium bg-[var(--color-primary)] text-white hover:opacity-90">Save</button>
				<button onclick={() => showForm = false} class="px-4 py-2 rounded-lg text-sm text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-secondary)]">Cancel</button>
			</div>
		</div>
	</Card>
{/if}

{#if loading}
	<div class="space-y-3">
		{#each Array(3) as _}<Card variant="elevated" padding="md"><div class="h-16 animate-pulse bg-[var(--color-bg-secondary)] rounded"></div></Card>{/each}
	</div>
{:else}
	<div class="space-y-3">
		{#each items as a (a.id)}
			{@const Icon = typeIcons[a.type] ?? Info}
			<Card variant="elevated" padding="md">
				<div class="flex items-start gap-3">
					<Icon size={18} class="shrink-0 mt-0.5 text-[var(--color-text-secondary)]" />
					<div class="flex-1 min-w-0">
						<div class="flex items-center gap-2">
							<h4 class="text-sm font-semibold text-[var(--color-text)]">{a.title}</h4>
							<span class="text-xs px-1.5 py-0.5 rounded {a.active ? 'bg-green-500/10 text-green-700' : 'bg-gray-500/10 text-gray-500'}">{a.active ? 'Active' : 'Inactive'}</span>
							<span class="text-xs px-1.5 py-0.5 rounded bg-[var(--color-bg-secondary)] text-[var(--color-text-secondary)]">{a.type}</span>
						</div>
						<p class="text-sm text-[var(--color-text-secondary)] mt-1">{a.message}</p>
						{#if a.expires_at}<p class="text-xs text-[var(--color-text-tertiary)] mt-1">Expires: {new Date(a.expires_at).toLocaleString()}</p>{/if}
					</div>
					<div class="flex gap-1 shrink-0">
						<button onclick={() => openEdit(a)} class="p-1.5 rounded hover:bg-[var(--color-bg-secondary)]" aria-label="Edit"><Pencil size={14} /></button>
						<button onclick={() => remove(a.id)} class="p-1.5 rounded hover:bg-[var(--color-bg-secondary)] text-[var(--color-danger)]" aria-label="Delete"><Trash2 size={14} /></button>
					</div>
				</div>
			</Card>
		{/each}
		{#if items.length === 0}
			<Card variant="elevated" padding="lg"><p class="text-sm text-[var(--color-text-secondary)] text-center">No announcements yet</p></Card>
		{/if}
	</div>
{/if}
