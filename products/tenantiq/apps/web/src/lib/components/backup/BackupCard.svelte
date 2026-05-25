<script lang="ts">
	import CopyButton from '$components/ui/CopyButton.svelte';

	interface Backup {
		backupId: string;
		type: string;
		timestamp: string;
		size: number;
		encryptionAlgorithm: string;
		items?: { users?: number; licenses?: number; conditionalAccessPolicies?: number };
	}

	interface Props {
		backup: Backup;
		onRestore?: (id: string) => void;
		onDetails?: (id: string) => void;
	}

	let { backup, onRestore, onDetails }: Props = $props();

	function formatBytes(bytes: number): string {
		if (bytes === 0) return '0 B';
		const k = 1024;
		const sizes = ['B', 'KB', 'MB', 'GB'];
		const i = Math.floor(Math.log(bytes) / Math.log(k));
		return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
	}

	function formatDate(d: string): string {
		return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' });
	}
</script>

<div class="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5 transition-all duration-200 hover:shadow-[var(--shadow-md)]">
	<div class="flex items-center gap-3 border-b border-[var(--color-border)] pb-3">
		<div class="flex items-center gap-2">
			<code class="text-sm font-semibold text-[var(--color-text)]">{backup.backupId.slice(0, 8)}...</code>
			<CopyButton value={backup.backupId} label="Backup ID copied" />
		</div>
		<span class="ml-auto rounded-full bg-[var(--color-primary)]/10 px-2.5 py-0.5 text-xs font-medium text-[var(--color-primary)]">{backup.type}</span>
	</div>

	<div class="mt-3 space-y-2 text-sm">
		<div class="flex justify-between"><span class="text-[var(--color-text-secondary)]">Created</span><span class="font-medium text-[var(--color-text)]">{formatDate(backup.timestamp)}</span></div>
		<div class="flex justify-between"><span class="text-[var(--color-text-secondary)]">Size</span><span class="font-medium text-[var(--color-text)]">{formatBytes(backup.size)}</span></div>
		<div class="flex justify-between"><span class="text-[var(--color-text-secondary)]">Encryption</span><span class="font-medium text-[var(--color-success)]">{backup.encryptionAlgorithm}</span></div>
	</div>

	{#if backup.items}
		<div class="mt-3 flex gap-3 rounded-lg bg-[var(--color-bg-tertiary)] p-2.5 text-xs text-[var(--color-text-secondary)]">
			<span>{backup.items.users ?? 0} users</span>
			<span>{backup.items.licenses ?? 0} licenses</span>
			<span>{backup.items.conditionalAccessPolicies ?? 0} policies</span>
		</div>
	{/if}

	<div class="mt-4 flex gap-2">
		<button onclick={() => onRestore?.(backup.backupId)} class="min-h-[44px] flex-1 rounded-lg bg-[var(--color-primary)] px-3 py-2 text-sm font-medium text-white transition-colors hover:opacity-90">Restore</button>
		<button onclick={() => onDetails?.(backup.backupId)} class="min-h-[44px] flex-1 rounded-lg border border-[var(--color-border)] px-3 py-2 text-sm font-medium text-[var(--color-text-secondary)] transition-colors hover:bg-[var(--color-bg)]">Details</button>
	</div>
</div>
