<script lang="ts">
	interface AuthRecord {
		domain: string;
		spf: 'pass' | 'fail' | 'none';
		dkim: 'pass' | 'fail' | 'none';
		dmarc: 'pass' | 'fail' | 'none' | 'reject' | 'quarantine';
		dmarcPolicy: string;
		lastChecked: string;
	}

	interface Props { records: AuthRecord[] }

	let { records }: Props = $props();

	function badge(val: string): string {
		if (val === 'pass' || val === 'reject') return 'bg-[var(--color-success)]/15 text-[var(--color-success)]';
		if (val === 'quarantine') return 'bg-[var(--color-warning)]/15 text-[var(--color-warning)]';
		if (val === 'fail') return 'bg-[var(--color-danger)]/15 text-[var(--color-danger)]';
		return 'bg-[var(--color-text-secondary)]/10 text-[var(--color-text-secondary)]';
	}
</script>

<section>
	<h2 class="mb-3 text-lg font-semibold text-[var(--color-text)]">Email Authentication (SPF / DKIM / DMARC)</h2>
	<div class="overflow-x-auto rounded-lg border border-[var(--color-border)]">
		<table class="min-w-full">
			<thead class="bg-[var(--color-bg)]">
				<tr>
					<th class="px-4 py-3 text-left text-xs font-medium text-[var(--color-text-secondary)]">Domain</th>
					<th class="px-4 py-3 text-center text-xs font-medium text-[var(--color-text-secondary)]">SPF</th>
					<th class="px-4 py-3 text-center text-xs font-medium text-[var(--color-text-secondary)]">DKIM</th>
					<th class="px-4 py-3 text-center text-xs font-medium text-[var(--color-text-secondary)]">DMARC</th>
					<th class="px-4 py-3 text-left text-xs font-medium text-[var(--color-text-secondary)]">DMARC Policy</th>
				</tr>
			</thead>
			<tbody class="divide-y divide-[var(--color-border)] bg-[var(--color-surface)]">
				{#each records as r}
					<tr class="transition-colors hover:bg-[var(--color-bg-secondary)]">
						<td class="px-4 py-3 text-sm font-medium text-[var(--color-text)]">{r.domain}</td>
						<td class="px-4 py-3 text-center"><span class="inline-block rounded-full px-2 py-0.5 text-xs font-medium capitalize {badge(r.spf)}">{r.spf}</span></td>
						<td class="px-4 py-3 text-center"><span class="inline-block rounded-full px-2 py-0.5 text-xs font-medium capitalize {badge(r.dkim)}">{r.dkim}</span></td>
						<td class="px-4 py-3 text-center"><span class="inline-block rounded-full px-2 py-0.5 text-xs font-medium capitalize {badge(r.dmarc)}">{r.dmarc}</span></td>
						<td class="px-4 py-3 text-sm text-[var(--color-text-secondary)]">{r.dmarcPolicy}</td>
					</tr>
				{/each}
			</tbody>
		</table>
	</div>
</section>
