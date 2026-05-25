<script lang="ts">
	import { trapFocus } from '$utils/focus-trap';

	interface RestoreData {
		metadata: { displayName: string; domain: string; backupDate: string };
		stats: { users: number; licenses: number; groups: number };
	}

	interface Props {
		data: RestoreData;
		onConfirm: () => void;
		onCancel: () => void;
	}

	let { data, onConfirm, onCancel }: Props = $props();

	function formatDate(d: string): string {
		return new Date(d).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' });
	}
</script>

<svelte:window onkeydown={(e) => e.key === 'Escape' && onCancel()} />

<div class="fixed inset-0 z-50 flex items-center justify-center">
	<div class="fixed inset-0 bg-black/50 animate-fade-in" onclick={onCancel} role="presentation"></div>
	<div use:trapFocus role="dialog" aria-modal="true" aria-labelledby="restore-title" class="relative z-10 w-full max-w-lg rounded-2xl bg-[var(--color-surface)] shadow-[var(--shadow-xl)] animate-modal-in">
		<header class="border-b border-[var(--color-border)] px-6 py-4">
			<h2 id="restore-title" class="text-lg font-semibold text-[var(--color-text)]">Restore Preview</h2>
		</header>

		<div class="space-y-4 px-6 py-5">
			<div class="rounded-lg bg-[var(--color-bg-tertiary)] p-4">
				<p class="mb-2 text-xs font-semibold text-[var(--color-text-secondary)]">Backup Metadata</p>
				<div class="space-y-1.5 text-sm">
					<div class="flex justify-between"><span class="text-[var(--color-text-secondary)]">Tenant</span><span class="font-medium text-[var(--color-text)]">{data.metadata.displayName}</span></div>
					<div class="flex justify-between"><span class="text-[var(--color-text-secondary)]">Domain</span><span class="font-medium text-[var(--color-text)]">{data.metadata.domain}</span></div>
					<div class="flex justify-between"><span class="text-[var(--color-text-secondary)]">Backup Date</span><span class="font-medium text-[var(--color-text)]">{formatDate(data.metadata.backupDate)}</span></div>
				</div>
			</div>

			<div class="grid grid-cols-2 gap-3 sm:grid-cols-3">
				{#each [
					{ label: 'Users', val: data.stats.users },
					{ label: 'Licenses', val: data.stats.licenses },
					{ label: 'Groups', val: data.stats.groups }
				] as stat}
					<div class="rounded-lg bg-[var(--color-bg-tertiary)] p-3 text-center">
						<p class="text-2xl font-bold text-[var(--color-primary)]">{stat.val}</p>
						<p class="text-xs text-[var(--color-text-secondary)]">{stat.label}</p>
					</div>
				{/each}
			</div>

			<div class="rounded-lg border border-[var(--color-warning)]/20 bg-[var(--color-warning)]/5 p-3 text-sm text-[var(--color-text)]">
				Review the data carefully before applying to production. This is a preview only.
			</div>
		</div>

		<footer class="flex justify-end gap-3 border-t border-[var(--color-border)] px-6 py-4">
			<button onclick={onCancel} class="min-h-[44px] rounded-lg border border-[var(--color-border)] px-4 py-2 text-sm font-medium text-[var(--color-text)] transition-colors hover:bg-[var(--color-bg)]">Cancel</button>
			<button onclick={onConfirm} class="min-h-[44px] rounded-lg bg-[var(--color-primary)] px-4 py-2 text-sm font-medium text-white transition-colors hover:opacity-90">Apply to Production</button>
		</footer>
	</div>
</div>

<style>
	@keyframes fade-in { from { opacity: 0; } to { opacity: 1; } }
	@keyframes modal-in { from { opacity: 0; transform: scale(0.95); } to { opacity: 1; transform: scale(1); } }
	.animate-fade-in { animation: fade-in var(--duration-fast, 200ms) var(--easing, ease-out); }
	.animate-modal-in { animation: modal-in var(--duration-normal, 300ms) var(--easing, ease-out); }
	@media (prefers-reduced-motion: reduce) { .animate-fade-in, .animate-modal-in { animation: none; } }
</style>
