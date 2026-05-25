<script lang="ts">
	import PageHeader from '$components/ui/PageHeader.svelte';
	import MetricCard from '$components/MetricCard.svelte';
	import ScoreRing from '$components/ScoreRing.svelte';
	import { api } from '$api/client';
	import { tenant } from '$stores/tenant';
	import { AlertTriangle } from 'lucide-svelte';

	type Severity = 'critical' | 'high' | 'medium' | 'low' | 'info';
	type Kind = 'standing' | 'eligible' | 'active';

	interface Principal {
		principalId: string; principalUpn: string | null; principalDisplayName: string | null;
		principalType: 'user' | 'group' | 'servicePrincipal' | 'unknown';
		roleDisplayName: string; roleDefinitionId: string;
		kind: Kind; endDateTime: string | null;
		mfaRegistered?: boolean | null;
	}
	interface Finding {
		id: string; severity: Severity;
		category: 'standing-access' | 'expiration' | 'mfa' | 'activation' | 'over-privileged';
		title: string; detail: string; remediation: string;
		affectedCount: number; principals?: string[]; roles?: string[];
	}
	interface Summary {
		totalAssignments: number; standingCount: number; eligibleCount: number; activeCount: number;
		privilegedRolePrincipals: number; standingPrivileged: number;
		perpetualAssignments: number; mfaGapCount: number; postureScore: number;
	}
	interface ScanResp { scannedAt: string; summary: Summary; findings: Finding[]; principals: Principal[] }
	interface ErrResp { error: string }

	let loading = $state(true);
	let data = $state<ScanResp | null>(null);
	let error = $state<string | null>(null);
	let kindFilter = $state<Kind | 'all'>('all');

	$effect(() => { if ($tenant.currentTenantId) load(); });

	async function load() {
		loading = true; error = null;
		try {
			const res = await api.get<ScanResp | ErrResp>('/pim/scan');
			if ('error' in res) { error = res.error; data = null; }
			else { data = res; }
		} catch (e) {
			error = e instanceof Error ? e.message : 'Failed to load PIM audit';
		} finally { loading = false; }
	}

	const filtered = $derived(
		!data ? []
			: kindFilter === 'all' ? data.principals
			: data.principals.filter((p) => p.kind === kindFilter),
	);

	const sevColor: Record<Severity, string> = { critical: 'var(--color-danger)', high: 'var(--color-warning)', medium: 'var(--color-warning)', low: 'var(--color-info)', info: 'var(--color-text-secondary)' };
	const kindColor: Record<Kind, string> = { standing: 'var(--color-danger)', eligible: 'var(--color-success)', active: 'var(--color-warning)' };
</script>

<svelte:head><title>PIM Audit | TenantIQ</title></svelte:head>

<div class="space-y-6">
	<PageHeader title="Privileged Identity Audit" description="Standing access, PIM adoption, MFA gaps, segregation of duties" iconPath="M12 1.5a5.25 5.25 0 00-5.25 5.25v3a3 3 0 00-3 3v6.75a3 3 0 003 3h10.5a3 3 0 003-3v-6.75a3 3 0 00-3-3v-3c0-2.9-2.35-5.25-5.25-5.25zm3.75 8.25v-3a3.75 3.75 0 10-7.5 0v3h7.5z">
		<button class="btn-secondary" onclick={load} disabled={loading}>{loading ? 'Loading…' : 'Refresh'}</button>
	</PageHeader>

	{#if loading}
		<div class="grid grid-cols-1 gap-4 sm:grid-cols-4">
			{#each Array(4) as _}<div class="h-24 animate-pulse rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)]"></div>{/each}
		</div>
	{:else if error}
		<div class="empty-state"><AlertTriangle size={32} /><h3>Could not load PIM data</h3><p>{error}</p><p class="mt-4 text-xs">Required Graph permission: <code>RoleManagement.Read.Directory</code></p></div>
	{:else if data}
		<div class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
			<div class="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5 flex items-center gap-4">
				<ScoreRing score={data.summary.postureScore} size={64} strokeWidth={5} label="/100" />
				<div>
					<p class="text-sm font-semibold">PIM posture</p>
					<p class="text-xs text-[var(--color-text-secondary)]">JIT adoption + MFA + expiration</p>
				</div>
			</div>
			<MetricCard title="Standing privileged" value={String(data.summary.standingPrivileged)} subtitle="Always-active = highest risk" />
			<MetricCard title="Perpetual" value={String(data.summary.perpetualAssignments)} subtitle="No expiration set" />
			<MetricCard title="MFA gap" value={String(data.summary.mfaGapCount)} subtitle="Privileged users w/o MFA" />
		</div>

		<div class="grid grid-cols-3 gap-3">
			<div class="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-3">
				<p class="text-xs text-[var(--color-text-secondary)]">Standing</p>
				<p class="text-lg font-semibold tabular-nums" style="color: {kindColor.standing};">{data.summary.standingCount}</p>
			</div>
			<div class="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-3">
				<p class="text-xs text-[var(--color-text-secondary)]">Eligible (PIM)</p>
				<p class="text-lg font-semibold tabular-nums" style="color: {kindColor.eligible};">{data.summary.eligibleCount}</p>
			</div>
			<div class="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-3">
				<p class="text-xs text-[var(--color-text-secondary)]">Active (activated)</p>
				<p class="text-lg font-semibold tabular-nums" style="color: {kindColor.active};">{data.summary.activeCount}</p>
			</div>
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
							{#if f.principals && f.principals.length > 0}
								<p class="finding-list"><strong>Affected:</strong> {f.principals.slice(0, 8).join(', ')}{f.principals.length > 8 ? `, +${f.principals.length - 8} more` : ''}</p>
							{/if}
						</div>
					{/each}
				</div>
			</section>
		{/if}

		<section>
			<div class="filter-bar">
				<select bind:value={kindFilter} class="filter-select">
					<option value="all">All assignments</option>
					<option value="standing">Standing (non-PIM)</option>
					<option value="eligible">Eligible (PIM)</option>
					<option value="active">Active (activated)</option>
				</select>
				<span class="filter-count">{filtered.length} of {data.principals.length}</span>
			</div>

			<div class="overflow-x-auto rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)]">
				<table class="min-w-full">
					<thead class="bg-[var(--color-bg-tertiary)]">
						<tr><th>Principal</th><th>Role</th><th>Type</th><th class="text-center">Kind</th><th class="text-center">Expires</th><th class="text-center">MFA</th></tr>
					</thead>
					<tbody class="divide-y divide-[var(--color-border)]">
						{#each filtered as p (p.principalId + '/' + p.roleDefinitionId + '/' + p.kind)}
							<tr>
								<td>
									<p class="text-sm font-medium">{p.principalDisplayName ?? p.principalUpn ?? p.principalId}</p>
									{#if p.principalUpn && p.principalUpn !== p.principalDisplayName}<p class="text-xs text-[var(--color-text-tertiary)]">{p.principalUpn}</p>{/if}
								</td>
								<td class="text-sm">{p.roleDisplayName}</td>
								<td class="text-xs text-[var(--color-text-secondary)]">{p.principalType}</td>
								<td class="text-center"><span class="pill" style="background: color-mix(in srgb, {kindColor[p.kind]} 15%, transparent); color: {kindColor[p.kind]};">{p.kind}</span></td>
								<td class="text-center text-xs text-[var(--color-text-secondary)]">{p.endDateTime ? new Date(p.endDateTime).toISOString().slice(0, 10) : '—'}</td>
								<td class="text-center">{p.mfaRegistered === true ? '✓' : p.mfaRegistered === false ? '⚠' : '?'}</td>
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
	.finding-detail, .finding-fix, .finding-list { margin: 0.25rem 0; font-size: 0.8125rem; line-height: 1.5; color: var(--color-text); }
	.finding-fix, .finding-list { color: var(--color-text-secondary); }
	.filter-bar { display: flex; gap: 0.5rem; align-items: center; margin-bottom: 0.75rem; flex-wrap: wrap; }
	.filter-select { background: var(--color-surface); border: 1px solid var(--color-border); border-radius: 0.5rem; padding: 0.375rem 0.75rem; font-size: 0.8125rem; color: var(--color-text); min-height: 36px; }
	.filter-count { font-size: 0.75rem; color: var(--color-text-tertiary); margin-left: auto; }
	.pill { font-size: 0.6875rem; padding: 0.125rem 0.5rem; border-radius: 0.25rem; font-weight: 500; text-transform: capitalize; }
</style>
