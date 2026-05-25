<script lang="ts">
	/**
	 * Push notification preferences UI.
	 *
	 * Two-tier control:
	 *   1. Master toggle: subscribe / unsubscribe (Web Push or native)
	 *   2. Per-category toggles: security / remediation / backup / workflow
	 *      — backend filters dispatch by category preference
	 */
	import { onMount } from 'svelte';
	import { Bell, BellOff } from 'lucide-svelte';
	import { isPushSupported, isPushEnabled, enablePush, disablePush } from '$utils/web-push-client';
	import { toasts } from '$stores/toast';

	const API_BASE = import.meta.env.PUBLIC_API_URL
		? `${import.meta.env.PUBLIC_API_URL}/api`
		: 'https://api.tenantiq.app/api';

	interface Preferences {
		categories: {
			security: boolean;
			remediation: boolean;
			backup: boolean;
			workflow: boolean;
		};
	}

	const CATEGORY_LABELS: Record<keyof Preferences['categories'], { title: string; desc: string }> = {
		security: { title: 'Security alerts', desc: 'Critical & high-severity findings (MFA disabled, suspicious sign-ins)' },
		remediation: { title: 'Remediation results', desc: 'When auto-remediation actions complete' },
		backup: { title: 'Backup status', desc: 'Backup job success/failure notifications' },
		workflow: { title: 'Workflow events', desc: 'Onboarding/offboarding completion + scheduled scans' },
	};

	let supported = $state<boolean | null>(null);
	let enabled = $state(false);
	let toggling = $state(false);
	let prefs = $state<Preferences>({
		categories: { security: true, remediation: true, backup: true, workflow: true },
	});
	let saving = $state(false);

	onMount(async () => {
		supported = await isPushSupported();
		if (supported) {
			enabled = await isPushEnabled();
			await loadPrefs();
		}
	});

	async function loadPrefs() {
		try {
			const res = await fetch(`${API_BASE}/push/preferences`, { credentials: 'include' });
			if (res.ok) prefs = await res.json();
		} catch { /* keep defaults */ }
	}

	async function toggleEnabled() {
		toggling = true;
		try {
			if (enabled) {
				const ok = await disablePush();
				if (ok) enabled = false;
			} else {
				const ok = await enablePush();
				if (ok) enabled = true;
			}
		} finally {
			toggling = false;
		}
	}

	async function saveCategory(key: keyof Preferences['categories']) {
		saving = true;
		try {
			const res = await fetch(`${API_BASE}/push/preferences`, {
				method: 'PATCH',
				credentials: 'include',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ categories: { [key]: prefs.categories[key] } }),
			});
			if (!res.ok) {
				toasts.error('Failed to save preference');
				prefs.categories[key] = !prefs.categories[key]; // revert
			}
		} catch {
			toasts.error('Failed to save preference');
		} finally {
			saving = false;
		}
	}
</script>

<section class="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-6">
	<div class="mb-4 flex items-start gap-3">
		<div class="flex h-10 w-10 items-center justify-center rounded-lg bg-[var(--color-primary-muted)] text-[var(--color-primary)]">
			{#if enabled}
				<Bell size={20} />
			{:else}
				<BellOff size={20} />
			{/if}
		</div>
		<div class="flex-1">
			<h3 class="text-base font-semibold text-[var(--color-text)]">Push notifications</h3>
			<p class="mt-1 text-sm text-[var(--color-text-secondary)]">
				Get alerted on your device for critical security events without keeping a tab open.
				{#if !supported}
					<span class="text-[var(--color-warning)]">Not supported on this browser.</span>
				{/if}
			</p>
		</div>
	</div>

	{#if supported}
		<button
			type="button"
			onclick={toggleEnabled}
			disabled={toggling}
			class="mb-4 inline-flex items-center justify-center gap-2 rounded-md {enabled
				? 'border border-[var(--color-border)] bg-[var(--color-bg)] text-[var(--color-text)]'
				: 'bg-[var(--color-primary)] text-white'} px-4 py-2 text-sm font-medium transition-opacity hover:opacity-90 disabled:opacity-50 min-h-[44px]"
		>
			{#if enabled}
				<BellOff size={16} /> Disable notifications
			{:else}
				<Bell size={16} /> Enable notifications
			{/if}
		</button>

		{#if enabled}
			<div class="space-y-3 border-t border-[var(--color-border)] pt-4">
				<p class="text-xs font-semibold uppercase tracking-wide text-[var(--color-text-tertiary)]">Categories</p>
				{#each Object.entries(CATEGORY_LABELS) as [key, label]}
					{@const k = key as keyof Preferences['categories']}
					<label class="flex items-start gap-3 cursor-pointer">
						<input
							type="checkbox"
							bind:checked={prefs.categories[k]}
							onchange={() => saveCategory(k)}
							disabled={saving}
							class="mt-1 h-4 w-4 rounded border-[var(--color-border)] text-[var(--color-primary)] focus:ring-[var(--color-primary)]"
						/>
						<div>
							<p class="text-sm font-medium text-[var(--color-text)]">{label.title}</p>
							<p class="text-xs text-[var(--color-text-secondary)]">{label.desc}</p>
						</div>
					</label>
				{/each}
			</div>
		{/if}
	{/if}
</section>
