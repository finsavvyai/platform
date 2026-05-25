<script lang="ts">
	import { browser } from '$app/environment';

	let visible = $state(false);

	if (browser && !localStorage.getItem('cookie-consent')) {
		visible = true;
	}

	function accept() {
		localStorage.setItem('cookie-consent', 'accepted');
		visible = false;
	}
</script>

{#if visible}
	<div
		class="fixed bottom-0 left-0 right-0 z-50 border-t border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-3 shadow-lg sm:px-6"
		role="alert"
		aria-live="polite"
	>
		<div class="mx-auto flex max-w-5xl items-center justify-between gap-3 sm:gap-4">
			<p class="text-sm text-[var(--color-text)]">
				We use essential cookies to keep you signed in. No tracking cookies.
			</p>
			<button
				onclick={accept}
				class="shrink-0 rounded-lg bg-[var(--color-primary)] px-4 py-2.5 text-sm font-medium text-white transition-colors hover:opacity-90 min-h-[44px] min-w-[72px]"
			>
				Got it
			</button>
		</div>
	</div>
{/if}
