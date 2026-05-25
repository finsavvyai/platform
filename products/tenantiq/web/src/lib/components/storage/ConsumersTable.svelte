<script lang="ts">
	interface Consumer {
		id: string;
		name: string;
		email?: string;
		url?: string;
		usedGB: number;
		allocatedGB: number;
		utilizationPct: number;
	}

	interface Props {
		title: string;
		consumers: Consumer[];
		type: 'user' | 'site';
		maxItems?: number;
	}

	let { title, consumers, type, maxItems = 20 }: Props = $props();

	let sortField = $state<'name' | 'usedGB' | 'utilizationPct'>('usedGB');
	let sortDir = $state<'asc' | 'desc'>('desc');

	function toggleSort(field: typeof sortField) {
		if (sortField === field) sortDir = sortDir === 'asc' ? 'desc' : 'asc';
		else { sortField = field; sortDir = 'desc'; }
	}

	const sorted = $derived(
		[...consumers].sort((a, b) => {
			const mul = sortDir === 'asc' ? 1 : -1;
			if (sortField === 'name') return mul * a.name.localeCompare(b.name);
			return mul * ((a[sortField] as number) - (b[sortField] as number));
		})
	);

	const displayed = $derived(sorted.slice(0, maxItems));
	const isCapped = $derived(consumers.length > maxItems);

	function barColor(pct: number): string {
		if (pct > 85) return 'var(--color-danger)';
		if (pct > 60) return 'var(--color-warning)';
		return 'var(--color-primary)';
	}
</script>

<div class="overflow-hidden rounded-2xl border border-[var(--color-border)]">
	<div class="flex items-center justify-between border-b border-[var(--color-border)] bg-[var(--color-surface)] px-5 py-3">
		<h3 class="text-sm font-semibold text-[var(--color-text)]">{title}</h3>
		<span class="text-xs text-[var(--color-text-secondary)]">
			{isCapped ? `${displayed.length} of ${consumers.length}` : consumers.length}
			{type === 'user' ? 'users' : 'sites'}
		</span>
	</div>

	{#if consumers.length === 0}
		<div class="bg-[var(--color-surface)] px-5 py-10 text-center text-sm text-[var(--color-text-secondary)]">
			No data available. Run a scan to populate.
		</div>
	{:else}
		<div class="overflow-x-auto">
			<table class="w-full">
				<thead class="bg-[var(--color-bg)]">
					<tr>
						<th class="px-4 py-3 text-left">
							<button onclick={() => toggleSort('name')} class="cursor-pointer text-xs font-medium text-[var(--color-text-secondary)] hover:text-[var(--color-text)]">
								{type === 'user' ? 'User' : 'Site'} {sortField === 'name' ? (sortDir === 'asc' ? '↑' : '↓') : ''}
							</button>
						</th>
						<th class="px-4 py-3 text-right">
							<button onclick={() => toggleSort('usedGB')} class="cursor-pointer text-xs font-medium text-[var(--color-text-secondary)] hover:text-[var(--color-text)]">
								Used {sortField === 'usedGB' ? (sortDir === 'asc' ? '↑' : '↓') : ''}
							</button>
						</th>
						<th class="px-4 py-3 text-right">
							<button onclick={() => toggleSort('utilizationPct')} class="cursor-pointer text-xs font-medium text-[var(--color-text-secondary)] hover:text-[var(--color-text)]">
								Usage {sortField === 'utilizationPct' ? (sortDir === 'asc' ? '↑' : '↓') : ''}
							</button>
						</th>
					</tr>
				</thead>
				<tbody class="divide-y divide-[var(--color-border)] bg-[var(--color-surface)]">
					{#each displayed as item (item.id)}
						<tr class="transition-colors hover:bg-[var(--color-bg-secondary)]">
							<td class="px-4 py-3">
								<p class="text-sm font-medium text-[var(--color-text)]">{item.name}</p>
								{#if item.email}<p class="text-xs text-[var(--color-text-secondary)]">{item.email}</p>{/if}
								{#if item.url}<p class="truncate text-xs text-[var(--color-text-secondary)]">{item.url}</p>{/if}
							</td>
							<td class="px-4 py-3 text-right text-sm text-[var(--color-text)]">{item.usedGB} GB</td>
							<td class="px-4 py-3 text-right">
								<div class="ml-auto flex w-28 items-center gap-2">
									<div class="h-2 flex-1 overflow-hidden rounded-full bg-[var(--color-border)]">
										<div class="h-full rounded-full" style="width: {Math.min(item.utilizationPct, 100)}%; background: {barColor(item.utilizationPct)}"></div>
									</div>
									<span class="w-8 text-right text-xs text-[var(--color-text-secondary)]">{item.utilizationPct}%</span>
								</div>
								{#if item.utilizationPct >= 90}
									<div data-quota-warning class="quota-warning mt-1 flex items-center gap-1 text-[10px] font-semibold text-[var(--color-danger)]">
										<svg xmlns="http://www.w3.org/2000/svg" class="h-3 w-3 shrink-0" viewBox="0 0 20 20" fill="currentColor">
											<path fill-rule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clip-rule="evenodd"/>
										</svg>
										Over quota — archive or increase limit
									</div>
								{/if}
							</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
	{/if}
</div>
