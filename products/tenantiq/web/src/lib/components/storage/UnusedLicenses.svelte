<script lang="ts">
	interface License {
		userId: string;
		displayName: string;
		email: string;
		licenseName: string;
		allocatedGB: number;
		usedGB: number;
		utilizationPct: number;
		lastActivityDate: string | null;
		monthlyInactive: boolean;
	}

	interface Props {
		licenses: License[];
	}

	let { licenses }: Props = $props();

	const totalWastedGB = $derived(
		licenses.reduce((s, l) => s + (l.allocatedGB - l.usedGB), 0)
	);
</script>

<div class="overflow-hidden rounded-2xl border border-[var(--color-border)]">
	<div class="flex items-center justify-between border-b border-[var(--color-border)] bg-[var(--color-surface)] px-5 py-3">
		<h3 class="text-sm font-semibold text-[var(--color-text)]">Unused Storage Licenses</h3>
		{#if licenses.length > 0}
			<span class="rounded-lg bg-[var(--color-warning)]/10 px-2 py-0.5 text-xs font-medium text-[var(--color-warning)]">
				{Math.round(totalWastedGB)} GB reclaimable
			</span>
		{/if}
	</div>

	{#if licenses.length === 0}
		<div class="bg-[var(--color-surface)] px-5 py-10 text-center text-sm text-[var(--color-text-secondary)]">
			No unused storage licenses detected.
		</div>
	{:else}
		<div class="overflow-x-auto">
			<table class="w-full">
				<thead class="bg-[var(--color-bg)]">
					<tr>
						<th class="px-4 py-3 text-left text-xs font-medium text-[var(--color-text-secondary)]">User</th>
						<th class="px-4 py-3 text-left text-xs font-medium text-[var(--color-text-secondary)]">License</th>
						<th class="px-4 py-3 text-right text-xs font-medium text-[var(--color-text-secondary)]">Allocated</th>
						<th class="px-4 py-3 text-right text-xs font-medium text-[var(--color-text-secondary)]">Used</th>
						<th class="px-4 py-3 text-center text-xs font-medium text-[var(--color-text-secondary)]">Status</th>
					</tr>
				</thead>
				<tbody class="divide-y divide-[var(--color-border)] bg-[var(--color-surface)]">
					{#each licenses as lic (lic.userId)}
						<tr class="transition-colors hover:bg-[var(--color-bg-secondary)]">
							<td class="px-4 py-3">
								<p class="text-sm font-medium text-[var(--color-text)]">{lic.displayName}</p>
								<p class="text-xs text-[var(--color-text-secondary)]">{lic.email}</p>
							</td>
							<td class="px-4 py-3 text-sm text-[var(--color-text)]">{lic.licenseName}</td>
							<td class="px-4 py-3 text-right text-sm text-[var(--color-text)]">{lic.allocatedGB} GB</td>
							<td class="px-4 py-3 text-right text-sm text-[var(--color-text)]">{lic.usedGB} GB</td>
							<td class="px-4 py-3 text-center">
								<span class="inline-block rounded-full bg-[var(--color-danger)]/10 px-2 py-0.5 text-[10px] font-medium text-[var(--color-danger)]">
									Inactive
								</span>
							</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
	{/if}
</div>
