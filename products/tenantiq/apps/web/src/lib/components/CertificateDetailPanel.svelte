<script lang="ts">
	import CopyButton from './ui/CopyButton.svelte';
	import { trapFocus } from '$utils/focus-trap';

	interface Certificate {
		appName: string; appId: string; type: string;
		expiresAt: string; daysUntilExpiry: number; status: string;
	}

	interface Props { cert: Certificate; onClose: () => void }

	let { cert, onClose }: Props = $props();
	let visible = $state(false);

	$effect(() => { requestAnimationFrame(() => { visible = true; }); });

	function handleClose() { visible = false; setTimeout(onClose, 300); }

	function statusClass(status: string): string {
		if (status === 'critical') return 'bg-[var(--color-danger)]/15 text-[var(--color-danger)]';
		if (status === 'warning') return 'bg-[var(--color-warning)]/15 text-[var(--color-warning)]';
		return 'bg-[var(--color-success)]/15 text-[var(--color-success)]';
	}

	function formatDate(iso: string): string {
		return new Date(iso).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
	}

	const portalUrl = $derived(`https://portal.azure.com/#blade/Microsoft_AAD_RegisteredApps/ApplicationMenuBlade/Credentials/appId/${cert.appId}`);
</script>

<svelte:window onkeydown={(e) => e.key === 'Escape' && handleClose()} />

<div class="fixed inset-0 z-40 transition-opacity duration-300" class:opacity-0={!visible} class:opacity-100={visible}>
	<div class="absolute inset-0 bg-black/40" onclick={handleClose} role="presentation"></div>
</div>

<div
	use:trapFocus
	class="fixed inset-y-0 right-0 z-50 flex w-full max-w-lg flex-col overflow-y-auto bg-[var(--color-bg)] shadow-[var(--shadow-xl)] transition-transform duration-300 sm:max-w-xl"
	class:translate-x-full={!visible} class:translate-x-0={visible}
	role="dialog" aria-modal="true" aria-label="Certificate detail: {cert.appName}"
	tabindex="-1"
>
	<header class="sticky top-0 z-10 border-b border-[var(--color-border)] bg-[var(--color-bg)] px-6 py-5">
		<div class="flex items-start justify-between gap-4">
			<div class="min-w-0">
				<span class="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium capitalize {statusClass(cert.status)}">{cert.status}</span>
				<h2 class="mt-2 text-lg font-semibold text-[var(--color-text)]">{cert.appName}</h2>
				<p class="mt-1 text-xs text-[var(--color-text-secondary)]">{cert.type}</p>
			</div>
			<button onclick={handleClose} class="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-[var(--color-text-secondary)] transition-colors hover:bg-[var(--color-surface)] hover:text-[var(--color-text)]" aria-label="Close panel">
				<svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clip-rule="evenodd"/></svg>
			</button>
		</div>
	</header>

	<div class="flex-1 space-y-5 px-6 py-5">
		<div class="rounded-lg bg-[var(--color-surface)] p-4">
			<p class="text-xs font-medium text-[var(--color-text-secondary)]">Application ID</p>
			<div class="mt-1 flex items-center gap-2">
				<code class="flex-1 select-all text-sm font-semibold text-[var(--color-text)]">{cert.appId}</code>
				<CopyButton value={cert.appId} label="App ID copied" />
			</div>
		</div>

		<div class="grid grid-cols-2 gap-4">
			<div class="rounded-lg bg-[var(--color-surface)] p-4">
				<p class="text-xs font-medium text-[var(--color-text-secondary)]">Type</p>
				<p class="mt-1 text-sm font-semibold text-[var(--color-text)]">{cert.type}</p>
			</div>
			<div class="rounded-lg bg-[var(--color-surface)] p-4">
				<p class="text-xs font-medium text-[var(--color-text-secondary)]">Days Until Expiry</p>
				<p class="mt-1 text-sm font-semibold {cert.daysUntilExpiry <= 7 ? 'text-[var(--color-danger)]' : cert.daysUntilExpiry <= 30 ? 'text-[var(--color-warning)]' : 'text-[var(--color-text)]'}">
					{cert.daysUntilExpiry} days
				</p>
			</div>
		</div>

		<div class="rounded-lg bg-[var(--color-surface)] p-4">
			<p class="text-xs font-medium text-[var(--color-text-secondary)]">Expiration Date</p>
			<p class="mt-1 text-sm font-semibold text-[var(--color-text)]">{formatDate(cert.expiresAt)}</p>
		</div>

		{#if cert.status === 'critical' || cert.status === 'warning'}
			<div class="rounded-lg border border-[var(--color-warning)]/20 bg-[var(--color-warning)]/5 p-4">
				<p class="text-xs font-semibold text-[var(--color-warning)]">Recommended Action</p>
				<p class="mt-1 text-sm text-[var(--color-text)]">
					{cert.type === 'Certificate'
						? 'Rotate this certificate before expiry to avoid service disruption. Generate a new certificate in Azure Portal and update your application configuration.'
						: 'Rotate this client secret before expiry. Generate a new secret in Azure Portal and update all services that depend on it.'}
				</p>
			</div>
		{/if}
	</div>

	<footer class="sticky bottom-0 border-t border-[var(--color-border)] bg-[var(--color-bg)] px-6 py-4">
		<div class="flex flex-wrap gap-2">
			<a
				href={portalUrl}
				target="_blank"
				rel="noopener noreferrer"
				class="inline-flex min-h-[44px] items-center gap-2 rounded-lg bg-[var(--color-primary)] px-4 py-2 text-sm font-medium text-white transition-colors hover:opacity-90"
			>
				<svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" /></svg>
				Open in Azure Portal
			</a>
			<CopyButton value={cert.appId} label="App ID copied" variant="text" />
		</div>
	</footer>
</div>
