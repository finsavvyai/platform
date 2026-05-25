<script lang="ts">
	import MetricCard from '$components/MetricCard.svelte';
	import QuotaBar from './QuotaBar.svelte';

	interface Overview {
		totalUsedGB: number;
		totalAllocatedGB: number;
		utilizationPct: number;
		oneDriveUsedGB: number;
		oneDriveAllocatedGB: number;
		sharePointUsedGB: number;
		sharePointAllocatedGB: number;
		userCount: number;
		siteCount: number;
		scannedAt: string;
	}

	interface Props {
		overview: Overview;
	}

	let { overview }: Props = $props();

	const odPct = $derived(overview.oneDriveAllocatedGB > 0
		? Math.round((overview.oneDriveUsedGB / overview.oneDriveAllocatedGB) * 100) : 0);
	const spPct = $derived(overview.sharePointAllocatedGB > 0
		? Math.round((overview.sharePointUsedGB / overview.sharePointAllocatedGB) * 100) : 0);
</script>

<div class="space-y-4">
	<div class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
		<MetricCard
			title="Total Storage Used"
			value="{overview.totalUsedGB} GB"
			subtitle="of {overview.totalAllocatedGB} GB allocated"
			progress={overview.utilizationPct}
			progressColor={overview.utilizationPct > 80 ? 'var(--color-danger)' : overview.utilizationPct > 50 ? 'var(--color-warning)' : 'var(--color-success)'}
		/>
		<MetricCard title="Utilization" value="{overview.utilizationPct}%" subtitle="Overall usage rate" />
		<MetricCard title="OneDrive Users" value={String(overview.userCount)} subtitle="{overview.oneDriveUsedGB} GB used" />
		<MetricCard title="SharePoint Sites" value={String(overview.siteCount)} subtitle="{overview.sharePointUsedGB} GB used" />
	</div>

	<div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
		<div class="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5">
			<p class="mb-3 text-sm font-medium text-[var(--color-text-secondary)]">OneDrive Usage</p>
			<QuotaBar usedGB={overview.oneDriveUsedGB} allocatedGB={overview.oneDriveAllocatedGB} pct={odPct} />
		</div>
		<div class="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5">
			<p class="mb-3 text-sm font-medium text-[var(--color-text-secondary)]">SharePoint Usage</p>
			<QuotaBar usedGB={overview.sharePointUsedGB} allocatedGB={overview.sharePointAllocatedGB} pct={spPct} />
		</div>
	</div>
</div>
