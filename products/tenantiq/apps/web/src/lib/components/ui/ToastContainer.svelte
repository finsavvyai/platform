<script lang="ts">
	import { toasts } from '$stores/toast';

	const typeConfig: Record<string, { bg: string; icon: string; iconColor: string; accent: string }> = {
		success: {
			bg: 'bg-[var(--color-surface)]/95 border-[var(--color-success)]/25',
			icon: 'M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z',
			iconColor: 'text-[var(--color-success)]',
			accent: 'bg-gradient-to-b from-[var(--color-success)] to-green-600',
		},
		error: {
			bg: 'bg-[var(--color-surface)]/95 border-[var(--color-danger)]/25',
			icon: 'M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z',
			iconColor: 'text-[var(--color-danger)]',
			accent: 'bg-gradient-to-b from-[var(--color-danger)] to-red-600',
		},
		info: {
			bg: 'bg-[var(--color-surface)]/95 border-[var(--color-primary)]/25',
			icon: 'M11.25 11.25l.041-.02a.75.75 0 011.063.852l-.708 2.836a.75.75 0 001.063.853l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9-3.75h.008v.008H12V8.25z',
			iconColor: 'text-[var(--color-primary)]',
			accent: 'bg-gradient-to-b from-[var(--color-primary)] to-indigo-600',
		},
	};
</script>

{#if $toasts.length > 0}
	<div class="fixed bottom-6 right-6 z-[100] flex flex-col gap-3" role="status" aria-live="polite">
		{#each $toasts as toast (toast.id)}
			{@const c = typeConfig[toast.type] ?? typeConfig.info}
			<div class="toast-enter group relative flex min-w-[300px] max-w-sm items-center gap-3 overflow-hidden rounded-2xl border px-4 py-3.5 shadow-[var(--shadow-lg)] backdrop-blur-xl {c.bg}">
				<!-- Accent stripe -->
				<div class="absolute left-0 top-0 h-full w-1 {c.accent}"></div>

				<div class="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-[var(--color-bg-secondary)] {c.iconColor}">
					<svg xmlns="http://www.w3.org/2000/svg" class="h-4.5 w-4.5" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor">
						<path stroke-linecap="round" stroke-linejoin="round" d={c.icon} />
					</svg>
				</div>

				<p class="flex-1 pl-1 text-sm font-medium leading-snug text-[var(--color-text)]">{toast.message}</p>

				<button onclick={() => toasts.remove(toast.id)} class="shrink-0 rounded-lg p-1.5 text-[var(--color-text-tertiary)] transition-all hover:bg-[var(--color-bg-secondary)] hover:text-[var(--color-text)]" aria-label="Dismiss">
					<svg xmlns="http://www.w3.org/2000/svg" class="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clip-rule="evenodd"/></svg>
				</button>
			</div>
		{/each}
	</div>
{/if}

<style>
	@keyframes toast-slide-in {
		from { opacity: 0; transform: translateX(24px) scale(0.96); }
		to { opacity: 1; transform: translateX(0) scale(1); }
	}
	.toast-enter {
		animation: toast-slide-in 0.3s cubic-bezier(0.22, 1, 0.36, 1);
	}
	@media (prefers-reduced-motion: reduce) {
		.toast-enter { animation: none; }
	}
</style>
