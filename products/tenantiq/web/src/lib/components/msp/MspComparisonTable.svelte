<script lang="ts">
	import { formatCurrency, formatNumber, formatRelativeTime } from '$utils/format';

	interface TenantSummary {
		id: string; displayName: string; domain: string; status: string;
		lastSyncAt: string | null; userCount: number; licenseUtilization: number;
		monthlySpend: number; monthlyWaste: number; healthScore: number;
		health: 'green' | 'yellow' | 'red';
		alertCounts: { total: number; critical: number; high: number; medium: number; low: number };
	}

	interface Props {
		tenants: TenantSummary[];
		onSelect: (id: string) => void;
	}

	let { tenants, onSelect }: Props = $props();

	type SortKey = 'displayName' | 'userCount' | 'licenseUtilization' | 'monthlySpend' | 'alertCounts' | 'healthScore';
	let sortKey = $state<SortKey>('healthScore');
	let sortAsc = $state(true);

	function toggleSort(key: SortKey) {
		if (sortKey === key) { sortAsc = !sortAsc; }
		else { sortKey = key; sortAsc = key === 'healthScore'; }
	}

	const sorted = $derived(() => {
		const list = [...tenants];
		list.sort((a, b) => {
			let va: number | string, vb: number | string;
			if (sortKey === 'alertCounts') { va = a.alertCounts.total; vb = b.alertCounts.total; }
			else if (sortKey === 'displayName') { va = a.displayName.toLowerCase(); vb = b.displayName.toLowerCase(); }
			else { va = a[sortKey]; vb = b[sortKey]; }
			if (va < vb) return sortAsc ? -1 : 1;
			if (va > vb) return sortAsc ? 1 : -1;
			return 0;
		});
		return list;
	});

	const healthColors: Record<string, string> = {
		green: 'bg-[var(--color-success)]',
		yellow: 'bg-[var(--color-warning)]',
		red: 'bg-[var(--color-danger)]',
	};

	const cols: { key: SortKey; label: string; align: string }[] = [
		{ key: 'healthScore', label: 'Health', align: 'text-center' },
		{ key: 'displayName', label: 'Tenant', align: 'text-left' },
		{ key: 'userCount', label: 'Users', align: 'text-right' },
		{ key: 'licenseUtilization', label: 'License Util', align: 'text-right' },
		{ key: 'alertCounts', label: 'Alerts', align: 'text-right' },
		{ key: 'monthlySpend', label: 'Spend/mo', align: 'text-right' },
	];

	function sortArrow(key: SortKey): string {
		if (sortKey !== key) return '';
		return sortAsc ? ' \u2191' : ' \u2193';
	}
</script>

<div class="overflow-hidden rounded-xl border border-[var(--color-border)]">
	<div class="overflow-x-auto">
		<table class="w-full min-w-[720px]">
			<thead class="bg-[var(--color-bg)]">
				<tr>
					{#each cols as col}
						<th class="cursor-pointer select-none px-4 py-3 text-xs font-medium text-[var(--color-text-secondary)] {col.align} transition-colors hover:text-[var(--color-text)]"
							onclick={() => toggleSort(col.key)}>
							{col.label}{sortArrow(col.key)}
						</th>
					{/each}
					<th class="px-4 py-3 text-right text-xs font-medium text-[var(--color-text-secondary)]">Last Sync</th>
				</tr>
			</thead>
			<tbody class="divide-y divide-[var(--color-border)] bg-[var(--color-surface)]">
				{#each sorted() as t}
					<tr class="cursor-pointer transition-colors hover:bg-[var(--color-bg-secondary)]"
						onclick={() => onSelect(t.id)}>
						<td class="px-4 py-3 text-center">
							<div class="mx-auto flex items-center justify-center gap-1.5">
								<div class="h-2.5 w-2.5 rounded-full {healthColors[t.health]}"></div>
								<span class="text-sm font-semibold text-[var(--color-text)]">{t.healthScore}</span>
							</div>
						</td>
						<td class="px-4 py-3">
							<p class="text-sm font-medium text-[var(--color-text)]">{t.displayName}</p>
							<p class="text-xs text-[var(--color-text-tertiary)]">{t.domain}</p>
						</td>
						<td class="px-4 py-3 text-right text-sm text-[var(--color-text)]">{formatNumber(t.userCount)}</td>
						<td class="px-4 py-3 text-right">
							<div class="flex items-center justify-end gap-2">
								<div class="h-1.5 w-16 overflow-hidden rounded-full bg-[var(--color-bg)]">
									<div class="h-full rounded-full transition-all duration-300
										{t.licenseUtilization >= 80 ? 'bg-[var(--color-success)]' : t.licenseUtilization >= 50 ? 'bg-[var(--color-warning)]' : 'bg-[var(--color-danger)]'}"
										style="width: {Math.min(t.licenseUtilization, 100)}%"></div>
								</div>
								<span class="text-sm text-[var(--color-text)]">{t.licenseUtilization}%</span>
							</div>
						</td>
						<td class="px-4 py-3 text-right">
							<span class="text-sm text-[var(--color-text)]">{t.alertCounts.total}</span>
							{#if t.alertCounts.critical > 0}
								<span class="ml-1 rounded-full bg-[var(--color-danger)]/10 px-1.5 py-0.5 text-xs font-medium text-[var(--color-danger)]">{t.alertCounts.critical}C</span>
							{/if}
							{#if t.alertCounts.high > 0}
								<span class="ml-0.5 rounded-full bg-[var(--color-warning)]/10 px-1.5 py-0.5 text-xs font-medium text-[var(--color-warning)]">{t.alertCounts.high}H</span>
							{/if}
						</td>
						<td class="px-4 py-3 text-right">
							<p class="text-sm font-medium text-[var(--color-text)]">{formatCurrency(t.monthlySpend)}</p>
							{#if t.monthlyWaste > 0}
								<p class="text-xs text-[var(--color-danger)]">{formatCurrency(t.monthlyWaste)} waste</p>
							{/if}
						</td>
						<td class="px-4 py-3 text-right text-sm text-[var(--color-text-secondary)]">
							{t.lastSyncAt ? formatRelativeTime(t.lastSyncAt) : 'Never'}
						</td>
					</tr>
				{/each}
			</tbody>
		</table>
	</div>
</div>
