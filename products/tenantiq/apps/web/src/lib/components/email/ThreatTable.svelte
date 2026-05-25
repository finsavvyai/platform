<script lang="ts">
	import SeverityBadge from '$components/SeverityBadge.svelte';
	import CopyButton from '$components/ui/CopyButton.svelte';
	import { formatRelativeTime } from '$utils/format';
	import type { Severity } from '@tenantiq/shared';

	interface EmailThreat {
		id: string;
		subject: string;
		sender: string;
		recipient: string;
		receivedAt: string;
		threatType: string;
		confidence: number;
		severity: Severity;
		status: 'blocked' | 'quarantined' | 'delivered' | 'released';
		indicators: string[];
	}

	interface Props {
		threats: EmailThreat[];
		onSelect?: (t: EmailThreat) => void;
		onQuarantine?: (t: EmailThreat) => void;
		onRelease?: (t: EmailThreat) => void;
	}

	let { threats, onSelect, onQuarantine, onRelease }: Props = $props();

	function statusBadge(s: string): string {
		if (s === 'blocked') return 'bg-[var(--color-danger)]/15 text-[var(--color-danger)]';
		if (s === 'quarantined') return 'bg-[var(--color-warning)]/15 text-[var(--color-warning)]';
		if (s === 'released') return 'bg-[var(--color-primary)]/15 text-[var(--color-primary)]';
		return 'bg-[var(--color-success)]/15 text-[var(--color-success)]';
	}
</script>

<section>
	<h2 class="mb-3 text-lg font-semibold text-[var(--color-text)]">Detected Threats</h2>
	<div class="overflow-x-auto rounded-lg border border-[var(--color-border)]">
		<table class="min-w-full">
			<thead class="bg-[var(--color-bg)]">
				<tr>
					<th class="px-4 py-3 text-left text-xs font-medium text-[var(--color-text-secondary)]">Threat</th>
					<th class="px-4 py-3 text-left text-xs font-medium text-[var(--color-text-secondary)]">Sender</th>
					<th class="px-4 py-3 text-left text-xs font-medium text-[var(--color-text-secondary)]">Type</th>
					<th class="px-4 py-3 text-right text-xs font-medium text-[var(--color-text-secondary)]">Confidence</th>
					<th class="px-4 py-3 text-left text-xs font-medium text-[var(--color-text-secondary)]">Status</th>
					<th class="px-4 py-3 text-left text-xs font-medium text-[var(--color-text-secondary)]">Time</th>
					<th class="w-24 px-4 py-3"></th>
				</tr>
			</thead>
			<tbody class="divide-y divide-[var(--color-border)] bg-[var(--color-surface)]">
				{#each threats as t}
					<tr class="group cursor-pointer transition-colors hover:bg-[var(--color-bg-secondary)]" onclick={() => onSelect?.(t)}>
						<td class="max-w-[200px] px-4 py-3">
							<p class="truncate text-sm font-medium text-[var(--color-text)]">{t.subject}</p>
							<p class="truncate text-xs text-[var(--color-text-secondary)]">To: {t.recipient}</p>
						</td>
						<td class="px-4 py-3">
							<div class="flex items-center gap-1">
								<span class="text-sm text-[var(--color-text)]">{t.sender}</span>
								<div class="opacity-0 transition-opacity group-hover:opacity-100">
									<CopyButton value={t.sender} label="Sender copied" />
								</div>
							</div>
						</td>
						<td class="px-4 py-3"><SeverityBadge severity={t.severity} /></td>
						<td class="px-4 py-3 text-right">
							<span class="text-sm font-semibold {t.confidence >= 90 ? 'text-[var(--color-danger)]' : t.confidence >= 70 ? 'text-[var(--color-warning)]' : 'text-[var(--color-text)]'}">{t.confidence}%</span>
						</td>
						<td class="px-4 py-3">
							<span class="rounded-full px-2 py-0.5 text-xs font-medium capitalize {statusBadge(t.status)}">{t.status}</span>
						</td>
						<td class="px-4 py-3 text-xs text-[var(--color-text-secondary)]">{formatRelativeTime(t.receivedAt)}</td>
						<td class="px-4 py-3">
							<div class="flex gap-1 opacity-0 transition-opacity group-hover:opacity-100">
								{#if t.status === 'delivered'}
									<button type="button" onclick={(e) => { e.stopPropagation(); onQuarantine?.(t); }} class="min-h-[44px] rounded-lg bg-[var(--color-warning)]/10 px-3 py-1.5 text-xs font-medium text-[var(--color-warning)] transition-colors hover:bg-[var(--color-warning)]/20">Quarantine</button>
								{:else if t.status === 'quarantined'}
									<button type="button" onclick={(e) => { e.stopPropagation(); onRelease?.(t); }} class="min-h-[44px] rounded-lg bg-[var(--color-success)]/10 px-3 py-1.5 text-xs font-medium text-[var(--color-success)] transition-colors hover:bg-[var(--color-success)]/20">Release</button>
								{/if}
							</div>
						</td>
					</tr>
				{/each}
			</tbody>
		</table>
	</div>
</section>
