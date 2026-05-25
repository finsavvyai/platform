<script lang="ts">
	/**
	 * iOS PWA install hint — Apple Safari doesn't show the native install
	 * banner like Android Chrome. We render a custom dismissible bottom sheet
	 * with the manual "Share → Add to Home Screen" instructions.
	 *
	 * Shows when:
	 *   - User is on iOS (iPhone/iPad/iPod)
	 *   - Browser is Safari (Chrome/Firefox/Edge on iOS still use WebKit but
	 *     can't actually install — they'd just bounce out)
	 *   - Not already running as installed PWA (display-mode !== standalone)
	 *   - User hasn't dismissed within the last 30 days
	 */
	import { onMount } from 'svelte';
	import { Share, X } from 'lucide-svelte';

	const STORAGE_KEY = 'ios-install-dismissed-at';
	const DISMISS_DAYS = 30;

	let visible = $state(false);

	function isIos(): boolean {
		const ua = navigator.userAgent.toLowerCase();
		return /iphone|ipad|ipod/.test(ua) ||
			// iPadOS 13+ identifies as Mac — detect via touch + platform.
			(ua.includes('mac') && 'ontouchend' in document);
	}

	function isSafari(): boolean {
		const ua = navigator.userAgent;
		return /safari/i.test(ua) && !/crios|fxios|edgios/i.test(ua);
	}

	function isStandalone(): boolean {
		// iOS Safari uses navigator.standalone; W3C standard uses matchMedia.
		return (window.navigator as { standalone?: boolean }).standalone === true ||
			window.matchMedia('(display-mode: standalone)').matches;
	}

	function recentlyDismissed(): boolean {
		const ts = localStorage.getItem(STORAGE_KEY);
		if (!ts) return false;
		const ageMs = Date.now() - parseInt(ts, 10);
		return ageMs < DISMISS_DAYS * 24 * 60 * 60 * 1000;
	}

	onMount(() => {
		if (typeof navigator === 'undefined') return;
		if (!isIos() || !isSafari() || isStandalone() || recentlyDismissed()) return;
		// Slight delay so we don't pop up immediately on first paint.
		setTimeout(() => { visible = true; }, 2500);
	});

	function dismiss() {
		localStorage.setItem(STORAGE_KEY, String(Date.now()));
		visible = false;
	}
</script>

{#if visible}
	<div class="fixed inset-x-0 bottom-0 z-50 p-3 sm:p-4">
		<div class="mx-auto max-w-md rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface-glass)] p-4 shadow-2xl backdrop-blur-xl">
			<div class="flex items-start gap-3">
				<img src="/brand/app-icon.png" alt="" aria-hidden="true" width="40" height="40" class="h-10 w-10 shrink-0 rounded-xl" />
				<div class="flex-1">
					<p class="text-sm font-semibold text-[var(--color-text)]">Install TenantIQ for a better experience</p>
					<p class="mt-1 text-xs text-[var(--color-text-secondary)]">
						Tap <Share size={14} class="mx-0.5 inline align-text-bottom" /> in the toolbar, then
						<strong class="font-semibold text-[var(--color-text)]">Add to Home Screen</strong>. Required to enable push notifications on iOS.
					</p>
				</div>
				<button
					type="button"
					onclick={dismiss}
					aria-label="Dismiss install hint"
					class="-mr-1 -mt-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-[var(--color-text-tertiary)] hover:bg-[var(--color-bg-secondary)] hover:text-[var(--color-text)]"
				>
					<X size={18} />
				</button>
			</div>
		</div>
	</div>
{/if}
