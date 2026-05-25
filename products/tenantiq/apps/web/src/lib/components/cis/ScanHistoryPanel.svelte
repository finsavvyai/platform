<script lang="ts">
	interface HistoryScan {
		id: string;
		overall_score: number;
		pass_count: number;
		fail_count: number;
		partial_count: number;
		total_controls: number;
		scanned_at: string;
	}

	interface Props {
		history: HistoryScan[];
		onClose: () => void;
	}

	let { history, onClose }: Props = $props();

	function timeSince(dateStr: string): string {
		const diff = Date.now() - new Date(dateStr).getTime();
		const mins = Math.floor(diff / 60000);
		if (mins < 60) return `${mins}m ago`;
		const hours = Math.floor(mins / 60);
		if (hours < 24) return `${hours}h ago`;
		return `${Math.floor(hours / 24)}d ago`;
	}
</script>

<div class="animate-fade-up rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5">
	<div class="mb-3 flex items-center justify-between">
		<h3 class="text-sm font-semibold uppercase tracking-wide text-[var(--color-text-secondary)]">Scan History</h3>
		<button onclick={onClose} class="text-xs text-[var(--color-text-secondary)] hover:text-[var(--color-text)]">Hide</button>
	</div>
	<ul class="divide-y divide-[var(--color-border)]">
		{#each history as h (h.id)}
			<li class="grid grid-cols-4 gap-4 py-2 text-sm">
				<span class="text-[var(--color-text-secondary)]">{timeSince(h.scanned_at)}</span>
				<span class="font-medium text-[var(--color-text)]">{h.overall_score}% score</span>
				<span class="text-[var(--color-success)]">{h.pass_count} pass</span>
				<span class="text-[var(--color-danger)]">{h.fail_count} fail</span>
			</li>
		{/each}
	</ul>
</div>
