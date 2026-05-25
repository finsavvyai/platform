<script lang="ts">
	import { onMount } from 'svelte';
	import { Fingerprint, Plus } from 'lucide-svelte';
	import { isWebAuthnSupported, registerPasskey } from '$utils/webauthn-client';

	let supported = $state<boolean | null>(null);
	let registering = $state(false);
	let deviceName = $state('');

	onMount(async () => {
		supported = await isWebAuthnSupported();
	});

	async function onRegister() {
		registering = true;
		try {
			const ok = await registerPasskey(deviceName.trim() || undefined);
			if (ok) deviceName = '';
		} finally {
			registering = false;
		}
	}
</script>

<section class="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-6">
	<div class="mb-4 flex items-start gap-3">
		<div class="flex h-10 w-10 items-center justify-center rounded-lg bg-[var(--color-primary-muted)] text-[var(--color-primary)]">
			<Fingerprint size={20} />
		</div>
		<div class="flex-1">
			<h3 class="text-base font-semibold text-[var(--color-text)]">Biometric login (passkey)</h3>
			<p class="mt-1 text-sm text-[var(--color-text-secondary)]">
				Sign in with TouchID, FaceID, Windows Hello, or your security key — no password needed.
				Pairs with TenantIQ's existing TokenForge device binding for stronger session protection.
			</p>
		</div>
	</div>

	{#if supported === null}
		<div class="text-sm text-[var(--color-text-tertiary)]">Checking browser support…</div>
	{:else if !supported}
		<div class="rounded-md bg-[var(--color-bg-secondary)] p-3 text-sm text-[var(--color-text-secondary)]">
			This device does not support WebAuthn / passkeys. Enable your platform authenticator
			(TouchID/FaceID/Windows Hello) or use a compatible security key.
		</div>
	{:else}
		<div class="flex flex-col gap-3 sm:flex-row">
			<input
				type="text"
				bind:value={deviceName}
				placeholder="Device name (e.g. iPhone 15)"
				class="flex-1 rounded-md border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 text-sm text-[var(--color-text)] placeholder:text-[var(--color-text-tertiary)] focus:border-[var(--color-primary)] focus:outline-none"
			/>
			<button
				type="button"
				onclick={onRegister}
				disabled={registering}
				class="inline-flex items-center justify-center gap-2 rounded-md bg-[var(--color-primary)] px-4 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-50 min-h-[44px]"
			>
				<Plus size={16} />
				{registering ? 'Registering…' : 'Add passkey'}
			</button>
		</div>
	{/if}
</section>
