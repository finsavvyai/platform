<script lang="ts">
	interface RelayRule {
		name: string;
		connector: string;
		direction: 'inbound' | 'outbound';
		status: 'active' | 'disabled';
		tlsEnforced: boolean;
		lastActivity: string;
		messageCount: number;
	}

	interface Props { rules: RelayRule[] }

	let { rules }: Props = $props();
</script>

<section>
	<h2 class="mb-3 text-lg font-semibold text-[var(--color-text)]">Mail Flow & Relay Rules</h2>
	<div class="overflow-x-auto rounded-lg border border-[var(--color-border)]">
		<table class="min-w-full">
			<thead class="bg-[var(--color-bg)]">
				<tr>
					<th class="px-4 py-3 text-left text-xs font-medium text-[var(--color-text-secondary)]">Rule</th>
					<th class="px-4 py-3 text-left text-xs font-medium text-[var(--color-text-secondary)]">Connector</th>
					<th class="px-4 py-3 text-center text-xs font-medium text-[var(--color-text-secondary)]">Direction</th>
					<th class="px-4 py-3 text-center text-xs font-medium text-[var(--color-text-secondary)]">TLS</th>
					<th class="px-4 py-3 text-right text-xs font-medium text-[var(--color-text-secondary)]">Messages</th>
					<th class="px-4 py-3 text-center text-xs font-medium text-[var(--color-text-secondary)]">Status</th>
				</tr>
			</thead>
			<tbody class="divide-y divide-[var(--color-border)] bg-[var(--color-surface)]">
				{#each rules as r}
					<tr class="transition-colors hover:bg-[var(--color-bg-secondary)]">
						<td class="px-4 py-3 text-sm font-medium text-[var(--color-text)]">{r.name}</td>
						<td class="px-4 py-3 text-sm text-[var(--color-text-secondary)]">{r.connector}</td>
						<td class="px-4 py-3 text-center">
							<span class="rounded-full px-2 py-0.5 text-xs font-medium capitalize {r.direction === 'inbound' ? 'bg-[var(--color-primary)]/10 text-[var(--color-primary)]' : 'bg-[var(--color-text-secondary)]/10 text-[var(--color-text-secondary)]'}">{r.direction}</span>
						</td>
						<td class="px-4 py-3 text-center">
							{#if r.tlsEnforced}
								<span class="text-xs font-medium text-[var(--color-success)]">Enforced</span>
							{:else}
								<span class="text-xs font-medium text-[var(--color-danger)]">Not enforced</span>
							{/if}
						</td>
						<td class="px-4 py-3 text-right text-sm text-[var(--color-text)]">{r.messageCount.toLocaleString()}</td>
						<td class="px-4 py-3 text-center">
							<span class="rounded-full px-2 py-0.5 text-xs font-medium {r.status === 'active' ? 'bg-[var(--color-success)]/15 text-[var(--color-success)]' : 'bg-[var(--color-text-secondary)]/10 text-[var(--color-text-secondary)]'}">{r.status}</span>
						</td>
					</tr>
				{/each}
			</tbody>
		</table>
	</div>
</section>
