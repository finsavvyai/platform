<script lang="ts">
	import MetricCard from '$components/MetricCard.svelte';
	import ScoreRing from '$components/ScoreRing.svelte';
	import RoiCard from '$lib/components/copilot/RoiCard.svelte';
	import AdoptionTable from '$lib/components/copilot/AdoptionTable.svelte';
	import PageHeader from '$components/ui/PageHeader.svelte';
	import { tenant } from '$stores/tenant';
	import { api } from '$api/client';
	import { toasts } from '$stores/toast';
	import { formatNumber } from '$utils/format';
	import { untrack } from 'svelte';

	interface UserAdoption {
		displayName: string; userPrincipalName: string;
		lastActivityDate: string | null; isActive: boolean; appsUsed: string[];
	}

	interface RoiData {
		monthlyCost: number; monthlyProductivityValue: number;
		netRoi: number; roiPercentage: number; hoursSavedPerMonth: number;
	}

	interface InactiveUser {
		displayName: string; userPrincipalName: string;
		licensedSince: string | null; lastActivityDate: string | null; monthlyCost: number;
	}

	interface Usage {
		totalLicensed: number; activeUsers: number; adoptionRate: number; totalUsers: number;
		copilotSkus?: Array<{ sku: string; seats: number }>;
		byApp?: Record<string, number>;
		userDetails?: UserAdoption[];
		source: string;
	}

	interface ScanResult {
		usage: Usage | null; roi?: RoiData | null;
		inactive?: InactiveUser[]; scannedAt?: string;
	}

	let usage = $state<Usage | null>(null);
	let roi = $state<RoiData | null>(null);
	let inactive = $state<InactiveUser[]>([]);
	let loading = $state(true);
	let scanning = $state(false);
	let scannedAt = $state<string | null>(null);

	$effect(() => { if ($tenant.currentTenantId) untrack(() => loadUsage()); });

	async function loadUsage() {
		loading = true;
		try {
			const res = await api.get<ScanResult>('/copilot-usage');
			usage = res.usage; roi = res.roi ?? null;
			inactive = res.inactive ?? []; scannedAt = res.scannedAt || null;
		} catch { usage = null; }
		finally { loading = false; }
	}

	async function scanUsage() {
		scanning = true;
		try {
			const res = await api.post<{ success?: boolean; error?: string } & ScanResult>('/copilot-usage/scan');
			if (res.error) toasts.error(res.error);
			else {
				usage = res.usage || null; roi = res.roi ?? null;
				inactive = res.inactive ?? []; scannedAt = res.scannedAt || null;
				toasts.success('Copilot usage scanned');
			}
		} catch (e) { toasts.error(e instanceof Error ? e.message : 'Scan failed'); }
		finally { scanning = false; }
	}

	const apps = $derived(usage?.byApp ? Object.entries(usage.byApp).sort((a, b) => b[1] - a[1]) : []);
	const wastedSpend = $derived(inactive.reduce((s, u) => s + u.monthlyCost, 0));
</script>

<svelte:head><title>Copilot Usage | TenantIQ</title></svelte:head>

<div class="page-container space-y-6">
	<PageHeader title="Copilot Usage" description="Track Microsoft 365 Copilot adoption, ROI, and inactive licenses">
		<button onclick={scanUsage} disabled={scanning} class="btn-primary">
			{#if scanning}<span class="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white"></span> Scanning...{:else}Scan Usage{/if}
		</button>
	</PageHeader>

	{#if loading}
		<div class="grid grid-cols-1 gap-4 sm:grid-cols-4">{#each Array(4) as _}<div class="h-28 skeleton rounded-2xl"></div>{/each}</div>
	{:else if !usage}
		<div class="animate-fade-up rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] px-6 py-14 text-center">
			<div class="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-[var(--color-primary)]/10">
				<svg xmlns="http://www.w3.org/2000/svg" class="h-8 w-8 text-[var(--color-primary)]" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z"/></svg>
			</div>
			<h2 class="text-lg font-semibold text-[var(--color-text)]">Track Copilot Adoption</h2>
			<p class="mx-auto mt-2 max-w-md text-sm text-[var(--color-text-secondary)]">Scan your tenant to see Copilot license allocation, active usage per app, adoption rates, and ROI.</p>
			<button onclick={scanUsage} disabled={scanning} class="btn-primary mt-6">
				{#if scanning}<span class="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white"></span> Scanning...{:else}Scan Usage{/if}
			</button>
		</div>
	{:else}
		<div class="grid grid-cols-1 gap-4 sm:grid-cols-4">
			<div class="flex flex-col items-center justify-center rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5">
				<ScoreRing score={usage.adoptionRate} size={96} strokeWidth={7} label="Adoption" />
			</div>
			<MetricCard title="Licensed" value={formatNumber(usage.totalLicensed)} subtitle="Copilot seats assigned" />
			<MetricCard title="Active Users" value={formatNumber(usage.activeUsers)} subtitle="Used in last 30 days" />
			<MetricCard title="Inactive Licenses" value={formatNumber(inactive.length)} subtitle={wastedSpend > 0 ? `$${wastedSpend}/mo wasted` : 'All licenses active'} />
		</div>

		{#if roi}
			<RoiCard monthlyCost={roi.monthlyCost} monthlyProductivityValue={roi.monthlyProductivityValue} netRoi={roi.netRoi} roiPercentage={roi.roiPercentage} hoursSavedPerMonth={roi.hoursSavedPerMonth} />
		{/if}

		{#if usage.userDetails?.length}
			<AdoptionTable users={usage.userDetails} />
		{/if}

		{#if apps.length > 0}
			<div class="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5">
				<h3 class="mb-4 section-title">Usage by App</h3>
				<div class="space-y-3">
					{#each apps as [app, count]}
						{@const maxCount = Math.max(...apps.map(a => a[1] as number))}
						<div class="flex items-center gap-3">
							<span class="w-24 text-xs font-medium capitalize text-[var(--color-text)]">{app}</span>
							<div class="h-2 flex-1 overflow-hidden rounded-full bg-[var(--color-border)]">
								<div class="h-full rounded-full bg-[var(--color-primary)] animate-fill-bar" style="width: {(count as number) / (maxCount as number) * 100}%"></div>
							</div>
							<span class="w-10 text-right text-xs text-[var(--color-text-secondary)]">{count}</span>
						</div>
					{/each}
				</div>
			</div>
		{/if}

		{#if usage.copilotSkus?.length}
			<div class="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5">
				<h3 class="mb-3 section-title">Copilot Licenses</h3>
				<div class="space-y-2">
					{#each usage.copilotSkus as sku}
						<div class="flex items-center justify-between rounded-lg bg-[var(--color-bg)] p-3">
							<span class="text-sm text-[var(--color-text)]">{sku.sku}</span>
							<span class="text-sm font-medium text-[var(--color-text)]">{sku.seats} seats</span>
						</div>
					{/each}
				</div>
			</div>
		{/if}

		<p class="text-xs text-[var(--color-text-tertiary)]">Source: {usage.source}{scannedAt ? ` | Scanned: ${new Date(scannedAt).toLocaleString()}` : ''}</p>
	{/if}
</div>
