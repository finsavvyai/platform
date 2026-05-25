<script lang="ts">
	/**
	 * Android (and Edge/Chrome) PWA install button.
	 *
	 * The browser fires `beforeinstallprompt` when the PWA is installable
	 * (passes manifest + SW + engagement heuristics). We capture the event,
	 * suppress the browser's default banner, and expose our own button so we
	 * control placement + timing.
	 *
	 * Hides itself if:
	 *   - Browser hasn't fired beforeinstallprompt (not eligible / iOS / installed)
	 *   - User dismissed within 14 days
	 *   - App is already running as installed PWA (display-mode: standalone)
	 */
	import { onMount } from 'svelte';
	import { Download } from 'lucide-svelte';

	const STORAGE_KEY = 'android-install-dismissed-at';
	const DISMISS_DAYS = 14;

	interface BeforeInstallPromptEvent extends Event {
		prompt(): Promise<void>;
		userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
	}

	let visible = $state(false);
	let prompt = $state<BeforeInstallPromptEvent | null>(null);
	let installing = $state(false);

	function isStandalone(): boolean {
		return window.matchMedia('(display-mode: standalone)').matches;
	}

	function recentlyDismissed(): boolean {
		const ts = localStorage.getItem(STORAGE_KEY);
		if (!ts) return false;
		return Date.now() - parseInt(ts, 10) < DISMISS_DAYS * 24 * 60 * 60 * 1000;
	}

	onMount(() => {
		if (isStandalone() || recentlyDismissed()) return;

		const handler = (e: Event) => {
			e.preventDefault(); // suppress browser's default mini-infobar
			prompt = e as BeforeInstallPromptEvent;
			visible = true;
		};
		window.addEventListener('beforeinstallprompt', handler);

		const installed = () => { visible = false; };
		window.addEventListener('appinstalled', installed);

		return () => {
			window.removeEventListener('beforeinstallprompt', handler);
			window.removeEventListener('appinstalled', installed);
		};
	});

	async function install() {
		if (!prompt) return;
		installing = true;
		try {
			await prompt.prompt();
			const result = await prompt.userChoice;
			if (result.outcome === 'dismissed') localStorage.setItem(STORAGE_KEY, String(Date.now()));
			visible = false;
			prompt = null;
		} finally {
			installing = false;
		}
	}

	function dismiss() {
		localStorage.setItem(STORAGE_KEY, String(Date.now()));
		visible = false;
	}
</script>

{#if visible}
	<div class="fixed inset-x-0 bottom-0 z-50 p-3 sm:p-4">
		<div class="mx-auto max-w-md rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface-glass)] p-4 shadow-2xl backdrop-blur-xl">
			<div class="flex items-center gap-3">
				<img src="/brand/app-icon.png" alt="" aria-hidden="true" width="40" height="40" class="h-10 w-10 shrink-0 rounded-xl" />
				<div class="flex-1 min-w-0">
					<p class="text-sm font-semibold text-[var(--color-text)]">Install TenantIQ</p>
					<p class="text-xs text-[var(--color-text-secondary)]">Faster launches, push notifications, offline access.</p>
				</div>
				<button
					type="button"
					onclick={install}
					disabled={installing}
					class="inline-flex items-center gap-1.5 rounded-lg bg-[var(--color-primary)] px-3 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-50 min-h-[44px]"
				>
					<Download size={16} />
					{installing ? '…' : 'Install'}
				</button>
				<button
					type="button"
					onclick={dismiss}
					aria-label="Dismiss"
					class="text-xs text-[var(--color-text-tertiary)] hover:text-[var(--color-text)] px-2 min-h-[44px]"
				>
					Later
				</button>
			</div>
		</div>
	</div>
{/if}
