<script lang="ts">
	import { api } from '$api/client';
	import { toasts } from '$stores/toast';
	import { safeErrorMessage } from '$lib/utils/safe-error';
	import { auth } from '$stores/auth';
	import ConfirmModal from '$components/ConfirmModal.svelte';
	import SSOConnectionCard from '$lib/components/sso/SSOConnectionCard.svelte';
	import SSOConnectionForm from '$lib/components/sso/SSOConnectionForm.svelte';
	import SSOTestResult from '$lib/components/sso/SSOTestResult.svelte';
	import PageHeader from '$components/ui/PageHeader.svelte';
	import { Plus, ShieldCheck, ArrowLeft } from 'lucide-svelte';
	import { untrack } from 'svelte';

	interface SSOFormData {
		provider: 'saml' | 'oidc';
		displayName: string;
		domain: string;
		issuerUrl: string;
		clientId: string;
		metadataUrl: string;
		certificate: string;
		jitEnabled: boolean;
		status?: 'active' | 'inactive';
	}

	interface SSOConnection {
		id: string;
		org_id: string;
		provider: 'saml' | 'oidc';
		display_name: string;
		domain: string;
		issuer_url: string | null;
		client_id: string | null;
		metadata_url: string | null;
		certificate?: string | null;
		status: 'active' | 'inactive';
		jit_enabled: number;
		created_at: number;
		updated_at: number;
	}

	interface TestCheck { name: string; passed: boolean; message: string }

	let connections = $state<SSOConnection[]>([]);
	let loading = $state(true);
	let saving = $state(false);
	let testing = $state(false);
	let showForm = $state(false);
	let editTarget = $state<SSOConnection | null>(null);
	let deleteTarget = $state<string | null>(null);
	let testResult = $state<{ success: boolean; checks: TestCheck[] } | null>(null);

	$effect(() => { if ($auth.user) untrack(() => loadConnections()); });

	async function loadConnections() {
		loading = true;
		try {
			const res = await api.get<{ connections: SSOConnection[] }>('/sso');
			connections = res.connections;
		} catch { toasts.error('Failed to load SSO connections'); }
		finally { loading = false; }
	}

	async function handleSave(data: SSOFormData) {
		saving = true;
		try {
			if (editTarget) {
				await api.patch(`/sso/${editTarget.id}`, data);
				toasts.success('SSO connection updated');
			} else {
				await api.post('/sso', data);
				toasts.success('SSO connection created');
			}
			showForm = false;
			editTarget = null;
			await loadConnections();
		} catch (err) {
			toasts.error(safeErrorMessage(err, 'Failed to save'));
		} finally { saving = false; }
	}

	function startEdit(conn: SSOConnection) {
		editTarget = conn;
		showForm = true;
		testResult = null;
	}

	function startCreate() {
		editTarget = null;
		showForm = true;
		testResult = null;
	}

	async function handleToggle(id: string, active: boolean) {
		try {
			await api.patch(`/sso/${id}`, { status: active ? 'active' : 'inactive' });
			toasts.success(active ? 'SSO enabled' : 'SSO disabled');
			await loadConnections();
		} catch { toasts.error('Failed to update status'); }
	}

	async function handleTest(id: string) {
		testing = true;
		testResult = null;
		try {
			const res = await api.post<{ success: boolean; checks: TestCheck[] }>(`/sso/${id}/test`);
			testResult = res;
			if (res.success) toasts.success('All checks passed');
			else toasts.error('Some checks failed');
		} catch { toasts.error('Test failed'); }
		finally { testing = false; }
	}

	async function confirmDelete() {
		if (!deleteTarget) return;
		try {
			await api.delete(`/sso/${deleteTarget}`);
			toasts.success('SSO connection deleted');
			await loadConnections();
		} catch { toasts.error('Failed to delete'); }
		deleteTarget = null;
	}

	const editFormData = $derived<Partial<SSOFormData> | null>(editTarget ? {
		provider: editTarget.provider,
		displayName: editTarget.display_name,
		domain: editTarget.domain,
		issuerUrl: editTarget.issuer_url ?? '',
		clientId: editTarget.client_id ?? '',
		metadataUrl: editTarget.metadata_url ?? '',
		certificate: editTarget.certificate ?? '',
		jitEnabled: Boolean(editTarget.jit_enabled),
		status: editTarget.status,
	} : null);
</script>

<svelte:head><title>SSO Configuration | TenantIQ</title></svelte:head>

<div class="page-container space-y-5">
	<div class="flex items-center gap-3">
		<a href="/settings" class="cursor-pointer rounded-lg p-1.5 text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-secondary)]" aria-label="Back to settings">
			<ArrowLeft size={16} />
		</a>
		<div class="flex-1">
			<PageHeader title="Enterprise SSO" description="Configure SAML or OIDC identity providers for your organization">
				{#if !showForm}
					<button onclick={startCreate} class="btn-primary flex items-center gap-1.5">
						<Plus size={14} /> Add Connection
					</button>
				{/if}
			</PageHeader>
		</div>
	</div>

	{#if showForm}
		<SSOConnectionForm initial={editFormData} {saving} onSave={handleSave} onCancel={() => { showForm = false; editTarget = null; }} />
	{/if}

	{#if testResult}
		<SSOTestResult checks={testResult.checks} success={testResult.success} onClose={() => (testResult = null)} />
	{/if}

	{#if loading}
		<div class="space-y-3">
			{#each Array(2) as _}
				<div class="h-24 rounded-xl skeleton"></div>
			{/each}
		</div>
	{:else if connections.length === 0 && !showForm}
		<div class="flex flex-col items-center justify-center rounded-xl border border-dashed border-[var(--color-border)] bg-[var(--color-surface)] py-12">
			<ShieldCheck size={32} class="mb-3 text-[var(--color-text-tertiary)]" />
			<h3 class="text-sm font-semibold text-[var(--color-text)]">No SSO connections</h3>
			<p class="mt-1 text-xs text-[var(--color-text-secondary)]">Add a SAML or OIDC provider to enable single sign-on.</p>
			<button onclick={startCreate} class="btn-primary mt-4 flex items-center gap-1.5">
				<Plus size={14} /> Add Connection
			</button>
		</div>
	{:else}
		<div class="space-y-3">
			{#each connections as conn (conn.id)}
				<SSOConnectionCard connection={conn} onEdit={startEdit} onDelete={(id) => (deleteTarget = id)} onTest={handleTest} onToggle={handleToggle} {testing} />
			{/each}
		</div>
	{/if}
</div>

<ConfirmModal
	open={deleteTarget !== null}
	title="Delete SSO Connection"
	description="This will permanently remove this SSO connection. Users who sign in via this provider will need to use a different authentication method."
	confirmLabel="Delete"
	destructive={true}
	onConfirm={confirmDelete}
	onCancel={() => (deleteTarget = null)}
/>
