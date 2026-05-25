<script lang="ts">
	/**
	 * Transient toast on network state transitions.
	 *
	 * Quiet during stable connectivity. Fires:
	 *   - "Back online — syncing queued actions" when offline → online (3s)
	 *   - "Working offline — your changes will sync when reconnected" when online → offline (4s)
	 *
	 * Uses navigator.onLine events. Capacitor wraps these in the WebView too,
	 * so the same component works in iOS/Android shells via @capacitor/network
	 * (handled at the bridge level — this component sees the same window event).
	 */
	import { onMount } from 'svelte';
	import { WifiOff, Wifi } from 'lucide-svelte';

	type State = 'hidden' | 'offline' | 'reconnected';
	let state = $state<State>('hidden');
	let timer: ReturnType<typeof setTimeout> | null = null;

	function show(next: State, ms: number) {
		state = next;
		if (timer) clearTimeout(timer);
		timer = setTimeout(() => { state = 'hidden'; timer = null; }, ms);
	}

	onMount(() => {
		const onOffline = () => show('offline', 4000);
		const onOnline = () => show('reconnected', 3000);
		window.addEventListener('offline', onOffline);
		window.addEventListener('online', onOnline);

		// On mount, show offline if we're starting offline (no toast for already-stable online).
		if (typeof navigator !== 'undefined' && !navigator.onLine) show('offline', 4000);

		return () => {
			window.removeEventListener('offline', onOffline);
			window.removeEventListener('online', onOnline);
			if (timer) clearTimeout(timer);
		};
	});
</script>

{#if state === 'offline'}
	<div class="net-toast net-toast-offline" role="status" aria-live="polite">
		<WifiOff size={16} />
		<span>Working offline — changes will sync when reconnected</span>
	</div>
{:else if state === 'reconnected'}
	<div class="net-toast net-toast-online" role="status" aria-live="polite">
		<Wifi size={16} />
		<span>Back online — syncing queued actions</span>
	</div>
{/if}

<style>
	.net-toast {
		position: fixed;
		top: env(safe-area-inset-top, 0);
		left: 50%;
		transform: translateX(-50%);
		margin-top: 1rem;
		display: flex;
		align-items: center;
		gap: 0.5rem;
		padding: 0.6rem 1rem;
		border-radius: 9999px;
		font-size: 0.8rem;
		font-weight: 500;
		box-shadow: 0 10px 30px rgba(0, 0, 0, 0.2);
		z-index: 60;
		backdrop-filter: blur(12px);
		animation: slide-down 0.25s ease-out;
	}
	.net-toast-offline {
		background: rgba(239, 68, 68, 0.15);
		color: #ef4444;
		border: 1px solid rgba(239, 68, 68, 0.3);
	}
	.net-toast-online {
		background: rgba(34, 197, 94, 0.15);
		color: #22c55e;
		border: 1px solid rgba(34, 197, 94, 0.3);
	}
	@keyframes slide-down {
		from { opacity: 0; transform: translate(-50%, -100%); }
		to { opacity: 1; transform: translate(-50%, 0); }
	}
</style>
