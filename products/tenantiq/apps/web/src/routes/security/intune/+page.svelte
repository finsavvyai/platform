<script lang="ts">
	import PageHeader from '$components/ui/PageHeader.svelte';
	import MetricCard from '$components/MetricCard.svelte';
	import ScoreRing from '$components/ScoreRing.svelte';
	import { api } from '$api/client';
	import { tenant } from '$stores/tenant';
	import { AlertTriangle } from 'lucide-svelte';

	type Os = 'iOS' | 'Android' | 'Windows' | 'macOS' | 'Linux' | 'Unknown';
	type ComplianceState = 'compliant' | 'noncompliant' | 'inGracePeriod' | 'configManager' | 'error' | 'unknown';
	type Severity = 'critical' | 'high' | 'medium' | 'low' | 'info';

	interface Device {
		id: string; deviceName: string; userPrincipalName: string | null;
		operatingSystem: Os; osVersion: string; complianceState: ComplianceState;
		lastSyncDateTime: string; isEncrypted: boolean;
		jailBroken: 'True' | 'False' | 'Unknown';
	}
	interface Finding {
		id: string; severity: Severity; category: 'device' | 'compliance-policy' | 'app-protection';
		title: string; detail: string; remediation: string; affectedCount: number;
	}
	interface Summary {
		totalDevices: number; compliantDevices: number; noncompliantDevices: number;
		gracePeriodDevices: number; encryptionRate: number; jailbrokenCount: number;
		staleEnrollmentCount: number; osBreakdown: Record<Os, number>;
		compliancePolicyCount: number; unassignedCompliancePolicyCount: number;
		appProtectionPolicyCount: number; platformsWithoutMam: ('iOS' | 'Android')[];
		postureScore: number;
	}
	interface ScanResp { scannedAt: string; summary: Summary; findings: Finding[]; devices: Device[] }
	interface ErrResp { error: string }

	let loading = $state(true);
	let data = $state<ScanResp | null>(null);
	let error = $state<string | null>(null);
	let osFilter = $state<Os | 'all'>('all');
	let complianceFilter = $state<ComplianceState | 'all'>('all');

	$effect(() => { if ($tenant.currentTenantId) load(); });

	async function load() {
		loading = true; error = null;
		try {
			const res = await api.get<ScanResp | ErrResp>('/intune/scan');
			if ('error' in res) { error = res.error; data = null; }
			else { data = res; }
		} catch (e) {
			error = e instanceof Error ? e.message : 'Failed to load Intune scan';
		} finally { loading = false; }
	}

	const filteredDevices = $derived(
		!data ? []
			: data.devices.filter((d) =>
				(osFilter === 'all' || d.operatingSystem === osFilter)
				&& (complianceFilter === 'all' || d.complianceState === complianceFilter),
			),
	);

	const sevColor: Record<Severity, string> = { critical: 'var(--color-danger)', high: 'var(--color-warning)', medium: 'var(--color-warning)', low: 'var(--color-info)', info: 'var(--color-text-secondary)' };

	function fmtAge(iso: string): string {
		if (!iso) return '—';
		const ms = Date.now() - Date.parse(iso);
		if (isNaN(ms)) return '—';
		const h = ms / 3600_000;
		return h < 24 ? `${Math.round(h)}h ago` : `${Math.round(h / 24)}d ago`;
	}
</script>

<svelte:head><title>Intune | TenantIQ</title></svelte:head>

<div class="space-y-6">
	<PageHeader title="Intune Endpoint Posture" description="Managed device compliance, configuration policies, and app protection (MAM)" iconPath="M14.25 9.75v-4.5m0 4.5h4.5m-4.5 0l6-6m-3 18c-8.284 0-15-6.716-15-15V4.5A2.25 2.25 0 014.5 2.25h1.372c.516 0 .966.351 1.091.852l1.106 4.423c.11.44-.054.902-.417 1.173l-1.293.97a1.062 1.062 0 00-.38 1.21 12.035 12.035 0 007.143 7.143c.441.162.928-.004 1.21-.38l.97-1.293a1.125 1.125 0 011.173-.417l4.423 1.106c.5.125.852.575.852 1.091V19.5a2.25 2.25 0 01-2.25 2.25h-2.25z">
		<button class="btn-secondary" onclick={load} disabled={loading}>{loading ? 'Loading…' : 'Refresh'}</button>
	</PageHeader>

	{#if loading}
		<div class="grid grid-cols-1 gap-4 sm:grid-cols-4">
			{#each Array(4) as _}<div class="h-24 animate-pulse rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)]"></div>{/each}
		</div>
	{:else if error}
		<div class="empty-state"><AlertTriangle size={32} /><h3>Could not load Intune data</h3><p>{error}</p></div>
	{:else if data}
		<div class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
			<div class="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5 flex items-center gap-4">
				<ScoreRing score={data.summary.postureScore} size={64} strokeWidth={5} label="/100" />
				<div>
					<p class="text-sm font-semibold">Posture score</p>
					<p class="text-xs text-[var(--color-text-secondary)]">Compliance + encryption + freshness</p>
				</div>
			</div>
			<MetricCard title="Devices" value={String(data.summary.totalDevices)} subtitle="{data.summary.compliantDevices} compliant" />
			<MetricCard title="Encryption" value={`${Math.round(data.summary.encryptionRate * 100)}%`} subtitle="Disk encryption rate" />
			<MetricCard title="At risk" value={String(data.summary.jailbrokenCount + data.summary.staleEnrollmentCount)} subtitle="Jailbroken + stale" />
		</div>

		<div class="grid grid-cols-2 gap-3 sm:grid-cols-6">
			{#each Object.entries(data.summary.osBreakdown).filter(([_, n]) => n > 0) as [os, count]}
				<div class="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-3">
					<p class="text-xs text-[var(--color-text-secondary)]">{os}</p>
					<p class="text-lg font-semibold tabular-nums">{count}</p>
				</div>
			{/each}
		</div>

		{#if data.findings.length > 0}
			<section>
				<h2 class="section-title">Findings ({data.findings.length})</h2>
				<div class="space-y-3">
					{#each data.findings as f}
						<div class="finding" style="border-left-color: {sevColor[f.severity]};">
							<div class="finding-head">
								<span class="sev-tag" style="background: color-mix(in srgb, {sevColor[f.severity]} 15%, transparent); color: {sevColor[f.severity]};">{f.severity}</span>
								<strong>{f.title}</strong>
								<span class="finding-id">{f.id}</span>
							</div>
							<p class="finding-detail">{f.detail}</p>
							<p class="finding-fix"><strong>Fix:</strong> {f.remediation}</p>
						</div>
					{/each}
				</div>
			</section>
		{/if}

		<section>
			<div class="filter-bar">
				<select bind:value={osFilter} class="filter-select">
					<option value="all">All OS</option>
					<option value="iOS">iOS</option>
					<option value="Android">Android</option>
					<option value="Windows">Windows</option>
					<option value="macOS">macOS</option>
				</select>
				<select bind:value={complianceFilter} class="filter-select">
					<option value="all">All compliance</option>
					<option value="compliant">Compliant</option>
					<option value="noncompliant">Non-compliant</option>
					<option value="inGracePeriod">Grace period</option>
				</select>
				<span class="filter-count">{filteredDevices.length} of {data.devices.length}</span>
			</div>

			<div class="overflow-x-auto rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)]">
				<table class="min-w-full">
					<thead class="bg-[var(--color-bg-tertiary)]">
						<tr>
							<th>Device</th><th>User</th><th>OS</th>
							<th class="text-center">Compliance</th>
							<th class="text-center">Encrypted</th>
							<th class="text-center">Jailbroken</th>
							<th>Last sync</th>
						</tr>
					</thead>
					<tbody class="divide-y divide-[var(--color-border)]">
						{#each filteredDevices as d (d.id)}
							<tr>
								<td><span class="text-sm font-medium">{d.deviceName}</span></td>
								<td class="text-xs text-[var(--color-text-secondary)]">{d.userPrincipalName ?? '—'}</td>
								<td class="text-xs">{d.operatingSystem} <span class="text-[var(--color-text-tertiary)]">{d.osVersion}</span></td>
								<td class="text-center">
									<span class="pill" class:pass={d.complianceState === 'compliant'} class:fail={d.complianceState === 'noncompliant'} class:warn={d.complianceState === 'inGracePeriod'}>
										{d.complianceState === 'inGracePeriod' ? 'grace' : d.complianceState}
									</span>
								</td>
								<td class="text-center">{d.isEncrypted ? '✓' : '✗'}</td>
								<td class="text-center">{d.jailBroken === 'True' ? '⚠' : d.jailBroken === 'False' ? '✓' : '?'}</td>
								<td class="text-xs text-[var(--color-text-secondary)]">{fmtAge(d.lastSyncDateTime)}</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
		</section>
	{/if}
</div>

<style>
	th { padding: 0.75rem 1rem; text-align: left; font-size: 0.75rem; font-weight: 500; color: var(--color-text-secondary); }
	td { padding: 0.75rem 1rem; }
	.section-title { font-size: 0.9375rem; font-weight: 600; margin: 0 0 0.75rem 0; }

	.finding { background: var(--color-surface); border: 1px solid var(--color-border); border-left: 4px solid; border-radius: 0.5rem; padding: 1rem; }
	.finding-head { display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.5rem; flex-wrap: wrap; }
	.sev-tag { padding: 0.125rem 0.5rem; border-radius: 0.25rem; font-size: 0.6875rem; font-weight: 600; text-transform: uppercase; }
	.finding-id { font-family: 'SF Mono', Menlo, monospace; font-size: 0.6875rem; color: var(--color-text-tertiary); margin-left: auto; }
	.finding-detail, .finding-fix { margin: 0.25rem 0; font-size: 0.8125rem; line-height: 1.5; color: var(--color-text); }
	.finding-fix { color: var(--color-text-secondary); }

	.filter-bar { display: flex; gap: 0.5rem; align-items: center; margin-bottom: 0.75rem; flex-wrap: wrap; }
	.filter-select { background: var(--color-surface); border: 1px solid var(--color-border); border-radius: 0.5rem; padding: 0.375rem 0.75rem; font-size: 0.8125rem; color: var(--color-text); min-height: 36px; }
	.filter-count { font-size: 0.75rem; color: var(--color-text-tertiary); margin-left: auto; }

	.pill { font-size: 0.6875rem; padding: 0.125rem 0.5rem; border-radius: 0.25rem; font-weight: 500; text-transform: capitalize; background: var(--color-bg-tertiary); color: var(--color-text-secondary); }
	.pill.pass { background: color-mix(in srgb, var(--color-success) 15%, transparent); color: var(--color-success); }
	.pill.fail { background: color-mix(in srgb, var(--color-danger) 15%, transparent); color: var(--color-danger); }
	.pill.warn { background: color-mix(in srgb, var(--color-warning) 15%, transparent); color: var(--color-warning); }
</style>
