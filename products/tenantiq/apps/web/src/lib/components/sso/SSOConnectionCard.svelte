<script lang="ts">
	import { Shield, ShieldCheck, Trash2, Pencil, Play, Globe, ToggleLeft, ToggleRight } from 'lucide-svelte';

	interface SSOConnection {
		id: string;
		org_id: string;
		provider: 'saml' | 'oidc';
		display_name: string;
		domain: string;
		issuer_url: string | null;
		client_id: string | null;
		metadata_url: string | null;
		status: 'active' | 'inactive';
		jit_enabled: number;
		created_at: number;
		updated_at: number;
	}

	interface Props {
		connection: SSOConnection;
		onEdit: (conn: SSOConnection) => void;
		onDelete: (id: string) => void;
		onTest: (id: string) => void;
		onToggle: (id: string, active: boolean) => void;
		testing: boolean;
	}

	let { connection, onEdit, onDelete, onTest, onToggle, testing }: Props = $props();

	const isActive = $derived(connection.status === 'active');
	const providerLabel = $derived(connection.provider === 'saml' ? 'SAML 2.0' : 'OpenID Connect');
	const updatedLabel = $derived(
		new Date(connection.updated_at).toLocaleDateString('en-US', {
			month: 'short', day: 'numeric', year: 'numeric'
		})
	);
</script>

<div class="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4 transition-shadow hover:shadow-sm">
	<div class="flex items-start justify-between gap-3">
		<div class="flex items-center gap-3">
			{#if isActive}
				<div class="flex h-9 w-9 items-center justify-center rounded-lg bg-[var(--color-success)]/10">
					<ShieldCheck size={18} class="text-[var(--color-success)]" />
				</div>
			{:else}
				<div class="flex h-9 w-9 items-center justify-center rounded-lg bg-[var(--color-bg-tertiary)]">
					<Shield size={18} class="text-[var(--color-text-tertiary)]" />
				</div>
			{/if}
			<div>
				<h3 class="text-sm font-semibold text-[var(--color-text)]">{connection.display_name}</h3>
				<div class="mt-0.5 flex items-center gap-2">
					<span class="rounded-full bg-[var(--color-bg-tertiary)] px-2 py-0.5 text-[10px] font-medium text-[var(--color-text-secondary)]">
						{providerLabel}
					</span>
					<span class="flex items-center gap-1 text-[11px] text-[var(--color-text-tertiary)]">
						<Globe size={10} /> {connection.domain}
					</span>
				</div>
			</div>
		</div>
		<div class="flex items-center gap-1">
			<button onclick={() => onToggle(connection.id, !isActive)} class="cursor-pointer p-1.5 text-[var(--color-text-secondary)] transition-colors hover:text-[var(--color-primary)]" aria-label="{isActive ? 'Disable' : 'Enable'} SSO">
				{#if isActive}
					<ToggleRight size={20} class="text-[var(--color-success)]" />
				{:else}
					<ToggleLeft size={20} />
				{/if}
			</button>
			<button onclick={() => onTest(connection.id)} disabled={testing} class="cursor-pointer p-1.5 text-[var(--color-text-secondary)] transition-colors hover:text-[var(--color-primary)] disabled:opacity-50" aria-label="Test connection">
				<Play size={14} />
			</button>
			<button onclick={() => onEdit(connection)} class="cursor-pointer p-1.5 text-[var(--color-text-secondary)] transition-colors hover:text-[var(--color-primary)]" aria-label="Edit connection">
				<Pencil size={14} />
			</button>
			<button onclick={() => onDelete(connection.id)} class="cursor-pointer p-1.5 text-[var(--color-text-secondary)] transition-colors hover:text-[var(--color-danger)]" aria-label="Delete connection">
				<Trash2 size={14} />
			</button>
		</div>
	</div>
	<div class="mt-3 flex items-center gap-4 text-[11px] text-[var(--color-text-tertiary)]">
		<span>JIT: {connection.jit_enabled ? 'Enabled' : 'Disabled'}</span>
		<span>Updated {updatedLabel}</span>
		<span class="rounded-full px-2 py-0.5 text-[10px] font-medium {isActive ? 'bg-[var(--color-success)]/10 text-[var(--color-success)]' : 'bg-[var(--color-bg-tertiary)] text-[var(--color-text-tertiary)]'}">
			{isActive ? 'Active' : 'Inactive'}
		</span>
	</div>
</div>
