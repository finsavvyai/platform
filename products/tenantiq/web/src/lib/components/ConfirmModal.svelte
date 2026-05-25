<script lang="ts">
	import { trapFocus } from '$utils/focus-trap';

	interface Props {
		open: boolean;
		title: string;
		description: string;
		confirmLabel?: string;
		cancelLabel?: string;
		destructive?: boolean;
		onConfirm: () => void;
		onCancel: () => void;
	}

	let {
		open,
		title,
		description,
		confirmLabel = 'Confirm',
		cancelLabel = 'Cancel',
		destructive = false,
		onConfirm,
		onCancel
	}: Props = $props();
</script>

<svelte:window onkeydown={(e) => open && e.key === 'Escape' && onCancel()} />

{#if open}
	<div class="fixed inset-0 z-50 flex items-center justify-center p-4">
		<div class="fixed inset-0 bg-black/40 backdrop-blur-sm animate-fade-in" onclick={onCancel} role="presentation"></div>
		<div
			use:trapFocus
			role="dialog"
			aria-modal="true"
			aria-labelledby="confirm-title"
			aria-describedby="confirm-desc"
			class="relative z-10 w-full max-w-md overflow-hidden rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] shadow-[var(--shadow-2xl)] animate-modal-in"
		>
			<!-- Gradient accent bar -->
			<div class="h-1 w-full {destructive ? 'bg-gradient-to-r from-red-500 to-red-600' : 'bg-gradient-to-r from-[var(--brand-500)] to-[var(--brand-600)]'}"></div>

			<div class="p-6">
				<h2 id="confirm-title" class="text-lg font-bold tracking-tight text-[var(--color-text)]">{title}</h2>
				<p id="confirm-desc" class="mt-2 text-sm leading-relaxed text-[var(--color-text-secondary)]">{description}</p>
			</div>

			<div class="flex justify-end gap-2.5 border-t border-[var(--color-border-subtle)] bg-[var(--color-bg-secondary)] px-6 py-4">
				<button
					onclick={onCancel}
					class="min-h-[44px] rounded-xl border border-[var(--color-border)] px-5 py-2.5 text-sm font-medium text-[var(--color-text)] transition-all hover:bg-[var(--color-surface)]"
				>
					{cancelLabel}
				</button>
				<button
					onclick={onConfirm}
					class="min-h-[44px] rounded-xl px-5 py-2.5 text-sm font-semibold text-white transition-all active:scale-[0.98]
						{destructive
							? 'bg-gradient-to-r from-red-500 to-red-600 shadow-[0_2px_8px_rgba(239,68,68,0.3)] hover:shadow-[0_4px_16px_rgba(239,68,68,0.4)]'
							: 'bg-gradient-to-r from-[var(--brand-500)] to-[var(--brand-600)] shadow-[0_2px_8px_rgba(59,108,245,0.3)] hover:shadow-[0_4px_16px_rgba(59,108,245,0.4)]'}"
				>
					{confirmLabel}
				</button>
			</div>
		</div>
	</div>
{/if}

<style>
	@keyframes fade-in {
		from { opacity: 0; }
		to { opacity: 1; }
	}
	@keyframes modal-in {
		from { opacity: 0; transform: scale(0.95); }
		to { opacity: 1; transform: scale(1); }
	}
	.animate-fade-in {
		animation: fade-in var(--duration-fast, 200ms) var(--easing, ease-out);
	}
	.animate-modal-in {
		animation: modal-in var(--duration-normal, 300ms) var(--easing, ease-out);
	}

	@media (prefers-reduced-motion: reduce) {
		.animate-fade-in, .animate-modal-in {
			animation: none;
		}
	}
</style>
