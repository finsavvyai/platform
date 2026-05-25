<script lang="ts">
	interface TokenForgeStatus {
		enabled: boolean;
		configured: boolean;
		enforceMode: string;
		maxDevicesPerUser?: number;
		bindingTtlDays?: number;
		autoRevokeOnRisk?: boolean;
		stats: {
			totalBindings: number;
			activeBindings: number;
			revokedBindings: number;
			recentEvents: number;
		};
	}

	interface Props {
		status?: TokenForgeStatus | null;
		loading?: boolean;
		onSetup?: () => void;
		onToggle?: (enabled: boolean) => void;
	}

	let { status = null, loading = false, onSetup, onToggle }: Props = $props();

	const connected = $derived(status?.enabled ?? false);
	const configured = $derived(status?.configured ?? false);
	const modeLabel = $derived(
		status?.enforceMode === 'strict' ? 'Strict' :
		status?.enforceMode === 'enforce' ? 'Enforcing' : 'Monitoring'
	);
</script>

<div class="relative overflow-hidden rounded-2xl border border-[var(--color-border)] bg-gradient-to-br from-[var(--color-surface)] to-[var(--color-bg-secondary)] p-6">
	<div class="absolute -right-20 -top-20 h-40 w-40 rounded-full bg-[var(--brand-500)]/5 blur-3xl"></div>

	<div class="relative flex items-start justify-between gap-4">
		<div class="flex-1">
			<div class="mb-4 flex items-center gap-3">
				<div class="inline-flex items-center gap-2 rounded-lg bg-[var(--brand-500)]/10 px-3 py-1">
					<span class="h-2 w-2 rounded-full {connected ? 'bg-[var(--color-success)]' : configured ? 'bg-[var(--color-warning)]' : 'bg-[var(--color-text-tertiary)]'}"></span>
					<span class="text-xs font-medium {connected ? 'text-[var(--color-success)]' : configured ? 'text-[var(--color-warning)]' : 'text-[var(--color-text-secondary)]'}">
						{connected ? 'Active' : configured ? 'Paused' : 'Not Configured'}
					</span>
				</div>
				{#if configured}
					<span class="rounded-md bg-[var(--color-surface-secondary)] px-2 py-0.5 text-[10px] font-medium text-[var(--color-text-secondary)]">
						{modeLabel}
					</span>
				{/if}
			</div>

			<h3 class="text-lg font-bold text-[var(--color-text)]">Protect with TokenForge</h3>
			<p class="mt-2 text-sm text-[var(--color-text-secondary)]">
				Device-bound cryptographic tokens make stolen cookies and tokens useless without your device's private key.
			</p>

			{#if configured && status}
				<div class="mt-4 grid grid-cols-3 gap-3">
					<div class="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] p-2.5 text-center">
						<p class="text-lg font-bold text-[var(--color-text)]">{status.stats.activeBindings}</p>
						<p class="text-[10px] text-[var(--color-text-tertiary)]">Active Devices</p>
					</div>
					<div class="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] p-2.5 text-center">
						<p class="text-lg font-bold text-[var(--color-text)]">{status.stats.revokedBindings}</p>
						<p class="text-[10px] text-[var(--color-text-tertiary)]">Revoked</p>
					</div>
					<div class="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] p-2.5 text-center">
						<p class="text-lg font-bold text-[var(--color-text)]">{status.stats.recentEvents}</p>
						<p class="text-[10px] text-[var(--color-text-tertiary)]">Events (7d)</p>
					</div>
				</div>
			{:else}
				<ul class="mt-4 space-y-2 text-xs text-[var(--color-text-secondary)]">
					<li class="flex items-center gap-2">
						<svg xmlns="http://www.w3.org/2000/svg" class="h-3.5 w-3.5 text-[var(--color-success)]" viewBox="0 0 20 20" fill="currentColor">
							<path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd" />
						</svg>
						Bind tokens to device hardware
					</li>
					<li class="flex items-center gap-2">
						<svg xmlns="http://www.w3.org/2000/svg" class="h-3.5 w-3.5 text-[var(--color-success)]" viewBox="0 0 20 20" fill="currentColor">
							<path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd" />
						</svg>
						Automatic revocation if device compromised
					</li>
					<li class="flex items-center gap-2">
						<svg xmlns="http://www.w3.org/2000/svg" class="h-3.5 w-3.5 text-[var(--color-success)]" viewBox="0 0 20 20" fill="currentColor">
							<path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd" />
						</svg>
						Zero friction for legitimate users
					</li>
				</ul>
			{/if}
		</div>
	</div>

	<div class="mt-6 flex items-center gap-3">
		<button
			onclick={onSetup}
			disabled={loading}
			class="inline-flex min-h-[40px] items-center gap-2 rounded-lg bg-[var(--brand-500)] px-4 py-2 text-sm font-medium text-white transition-all hover:shadow-[var(--shadow-md)] disabled:opacity-50"
		>
			{#if loading}
				<div class="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white"></div>
			{:else}
				<svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
					<path d="M10.5 1.5H5.75A2.25 2.25 0 003.5 3.75v12.5A2.25 2.25 0 005.75 18.5h8.5a2.25 2.25 0 002.25-2.25V9.5M16 2.5v5m0 0h-5m5 0l-7-7" />
				</svg>
			{/if}
			{configured ? 'Manage TokenForge' : 'Set Up TokenForge'}
		</button>
		{#if configured}
			<button
				onclick={() => onToggle?.(!connected)}
				class="rounded-lg border border-[var(--color-border)] px-3 py-2 text-xs font-medium text-[var(--color-text-secondary)] transition-colors hover:bg-[var(--color-surface-secondary)]"
			>
				{connected ? 'Pause' : 'Resume'}
			</button>
		{/if}
	</div>
</div>
