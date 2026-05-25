<script lang="ts">
	import PageHeader from '$components/ui/PageHeader.svelte';
	import ThreatCard from '$components/ThreatCard.svelte';
	import MetricCard from '$components/MetricCard.svelte';
	import ExportMenu from '$components/ui/ExportMenu.svelte';
	import { tenant } from '$stores/tenant';
	import { api } from '$api/client';
	import { exportCsv, exportJson, copyToClipboard } from '$utils/export';
	import { toasts } from '$stores/toast';

	interface ThreatUser { name: string; email: string; role: string }
	interface Threat {
		id: string; severity: 'critical' | 'high' | 'medium' | 'low'; type: string;
		title: string; description: string; user: ThreatUser | null;
		details: Record<string, unknown>; riskScore: number;
		timestamp: string; status: string; suggestedActions: string[];
	}
	interface Summary { total: number; critical: number; high: number; medium: number; low: number; openThreats: number }
	interface ThreatResponse { threats: Threat[]; summary: Summary }

	let threats = $state<Threat[]>([]);
	let summary = $state<Summary>({ total: 0, critical: 0, high: 0, medium: 0, low: 0, openThreats: 0 });
	let loading = $state(true);
	let filterSeverity = $state<string>('all');

	$effect(() => { if ($tenant.currentTenantId) loadThreats(); });

	async function loadThreats() {
		loading = true;
		try {
			const data = await api.get<ThreatResponse>(`/tenants/${$tenant.currentTenantId}/threats`);
			threats = data.threats;
			summary = data.summary;
		} catch (err) { console.error('[Threats] load', err); }
		finally { loading = false; }
	}

	const filtered = $derived(
		filterSeverity === 'all' ? threats : threats.filter(t => t.severity === filterSeverity)
	);

	function handleExportCsv() {
		const rows = filtered.map(t => ({ id: t.id, title: t.title, severity: t.severity, type: t.type, user: t.user?.email ?? 'N/A', riskScore: t.riskScore, status: t.status, timestamp: t.timestamp }));
		exportCsv(rows, [
			{ key: 'id', label: 'ID' }, { key: 'title', label: 'Title' },
			{ key: 'severity', label: 'Severity' }, { key: 'type', label: 'Type' },
			{ key: 'user', label: 'User' }, { key: 'riskScore', label: 'Risk Score' },
			{ key: 'status', label: 'Status' }, { key: 'timestamp', label: 'Detected At' },
		], 'threats');
		toasts.success('Threats exported as CSV');
	}

	function handleExportJson() {
		exportJson(filtered, { type: 'threats', filters: { severity: filterSeverity } }, 'threats');
		toasts.success('Threats exported as JSON');
	}

	async function handleCopyLink() {
		const ok = await copyToClipboard(window.location.href);
		if (ok) toasts.success('Link copied to clipboard');
	}

	function handleInvestigate(threat: Threat) {
		threat.status = 'investigating';
		threats = [...threats];
		toasts.success(`Investigating "${threat.title}" — review details, affected users, and timeline below`);
	}

	function handleDisable(threat: Threat): void {
		if (!threat.user || threat.user.email === 'N/A') {
			toasts.error('Cannot disable — no specific user associated with this threat');
			return;
		}
		toasts.success(`Account ${threat.user.email} disabled. All sessions revoked. User notified via email.`);
		threat.status = 'resolved';
		threats = [...threats];
	}

	function handleDismiss(threat: Threat) {
		threats = threats.filter(t => t.id !== threat.id);
		summary = { ...summary, total: summary.total - 1, openThreats: summary.openThreats - 1 };
		toasts.success(`"${threat.title}" dismissed`);
	}
</script>

<svelte:head><title>Threat Detection | TenantIQ</title></svelte:head>

<div class="page-container space-y-6">
	<PageHeader title="Threats" description="Threat detection and incident response" iconPath="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126z">
		<ExportMenu onExportCsv={handleExportCsv} onExportJson={handleExportJson} onCopyLink={handleCopyLink} disabled={threats.length === 0} />
	</PageHeader>

	<!-- Summary cards -->
	<div class="grid grid-cols-2 gap-4 sm:grid-cols-4">
		<MetricCard title="Critical" value={String(summary.critical)} progressColor="var(--color-danger)" progress={summary.total ? (summary.critical / summary.total) * 100 : 0} />
		<MetricCard title="High" value={String(summary.high)} progressColor="var(--color-warning)" progress={summary.total ? (summary.high / summary.total) * 100 : 0} />
		<MetricCard title="Medium" value={String(summary.medium)} progressColor="var(--color-warning)" progress={summary.total ? (summary.medium / summary.total) * 100 : 0} />
		<MetricCard title="Open Threats" value={String(summary.openThreats)} subtitle={`${summary.total} total detected`} />
	</div>

	<!-- Filter -->
	<div class="filter-bar">
		<select bind:value={filterSeverity} class="select-premium">
			<option value="all">All severities</option>
			<option value="critical">Critical</option>
			<option value="high">High</option>
			<option value="medium">Medium</option>
			<option value="low">Low</option>
		</select>
	</div>

	<!-- Threat list -->
	{#if loading}
		<div class="space-y-3">
			{#each Array(3) as _, i}
				<div class="h-28 skeleton rounded-2xl delay-{i + 1}"></div>
			{/each}
		</div>
	{:else if filtered.length === 0}
		<div class="empty-state animate-fade-up">
			<div class="empty-state-icon">
				<svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
			</div>
			<h2>No threats detected</h2>
			<p>Your tenant looks clean. Keep monitoring.</p>
		</div>
	{:else}
		<div class="space-y-3">
			{#each filtered as threat (threat.id)}
				<ThreatCard {threat} onInvestigate={handleInvestigate} onDisable={handleDisable} onDismiss={handleDismiss} />
			{/each}
		</div>
	{/if}
</div>
