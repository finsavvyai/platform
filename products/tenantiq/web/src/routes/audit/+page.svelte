<script lang="ts">
	import PageHeader from '$components/ui/PageHeader.svelte';
	import ExportMenu from '$components/ui/ExportMenu.svelte';
	import { tenant } from '$stores/tenant';
	import { api } from '$api/client';
	import { formatRelativeTime } from '$utils/format';
	import { exportCsv, exportJson, copyToClipboard } from '$utils/export';
	import { toasts } from '$stores/toast';
	import type { AuditLogEntry } from '$lib/types/shared';

	let entries = $state<AuditLogEntry[]>([]);
	let loading = $state(true);
	let filterAction = $state('');
	let page = $state(1);
	let hasMore = $state(false);

	$effect(() => {
		if ($tenant.currentTenantId) loadAudit();
	});

	async function loadAudit() {
		loading = true;
		try {
			const params = new URLSearchParams({ page: String(page), limit: '50' });
			if (filterAction) params.set('action', filterAction);
			const data = await api.get<{ entries: AuditLogEntry[]; total: number; page: number; limit: number }>(`/tenants/${$tenant.currentTenantId}/audit?${params}`);
			entries = data.entries;
			hasMore = data.entries.length === 50;
		} catch (err) { console.error('[Audit] loadAudit', err); } finally {
			loading = false;
		}
	}

	function handleExportCsv() {
		exportCsv(entries, [
			{ key: 'createdAt', label: 'Time' }, { key: 'actor', label: 'Actor' },
			{ key: 'action', label: 'Action' }, { key: 'resourceType', label: 'Resource Type' },
			{ key: 'resourceId', label: 'Resource ID' },
		], 'audit-log');
		toasts.success('Audit log exported as CSV');
	}

	function handleExportJson() {
		exportJson(entries, { type: 'audit-log' }, 'audit-log');
		toasts.success('Audit log exported as JSON');
	}

	async function handleCopyLink() {
		const ok = await copyToClipboard(window.location.href);
		if (ok) toasts.success('Link copied to clipboard');
	}

	function nextPage() { page++; loadAudit(); }
	function prevPage() { if (page > 1) { page--; loadAudit(); } }
</script>

<svelte:head>
	<title>Audit Log | TenantIQ</title>
</svelte:head>

<div class="page-container" style="display:flex;flex-direction:column;gap:24px;">
	<PageHeader title="Audit & Compliance" description="Activity logs and compliance tracking" iconPath="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z">
		<ExportMenu onExportCsv={handleExportCsv} onExportJson={handleExportJson} onCopyLink={handleCopyLink} disabled={entries.length === 0} />
	</PageHeader>

	<div class="filter-bar">
		<input
			bind:value={filterAction}
			oninput={() => { page = 1; loadAudit(); }}
			placeholder="Filter by action..."
			class="select-premium"
			style="min-width:220px;"
		/>
	</div>

	{#if loading}
		<div class="panel">
			<div class="panel-body" style="display:flex;flex-direction:column;gap:8px;">
				{#each Array(5) as _}
					<div class="skeleton" style="height:44px;border-radius:var(--radius-md);"></div>
				{/each}
			</div>
		</div>
	{:else if entries.length === 0}
		<div class="panel">
			<div class="panel-body">
				<div class="empty-state">
					<div class="empty-state-icon">
						<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z"/></svg>
					</div>
					<h3>No audit entries yet</h3>
					<p>Audit events are recorded automatically as you manage your tenant -- remediate alerts, modify policies, or run scans.</p>
					<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:12px;max-width:320px;margin:24px auto 0;">
						<div class="panel" style="padding:12px;text-align:center;">
							<span class="section-title">Actions</span>
							<span class="micro-label" style="display:block;margin-top:2px;">Auto-logged</span>
						</div>
						<div class="panel" style="padding:12px;text-align:center;">
							<span class="section-title">Changes</span>
							<span class="micro-label" style="display:block;margin-top:2px;">Tracked</span>
						</div>
						<div class="panel" style="padding:12px;text-align:center;">
							<span class="section-title">Exports</span>
							<span class="micro-label" style="display:block;margin-top:2px;">CSV & JSON</span>
						</div>
					</div>
					<a href="/" class="btn-primary" style="display:inline-flex;margin-top:24px;">Go to Dashboard</a>
				</div>
			</div>
		</div>
	{:else}
		<div class="panel">
			<div class="panel-body" style="padding:0;">
				<table class="table-premium">
					<thead>
						<tr>
							<th>Time</th>
							<th>Actor</th>
							<th>Action</th>
							<th>Resource</th>
						</tr>
					</thead>
					<tbody>
						{#each entries as entry}
							<tr>
								<td><span class="tabular-nums" style="font-size:12px;color:var(--color-text-secondary);">{formatRelativeTime(entry.createdAt)}</span></td>
								<td>{entry.actor}</td>
								<td><span class="pill-info">{entry.action}</span></td>
								<td style="color:var(--color-text-secondary);">
									{#if entry.resourceType}
										{entry.resourceType}{entry.resourceId ? `: ${entry.resourceId}` : ''}
									{:else}
										--
									{/if}
								</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
		</div>

		<div class="filter-bar" style="justify-content:space-between;">
			<button onclick={prevPage} disabled={page === 1} class="btn-secondary">
				Previous
			</button>
			<span class="micro-label">Page <span class="tabular-nums">{page}</span></span>
			<button onclick={nextPage} disabled={!hasMore} class="btn-secondary">
				Next
			</button>
		</div>
	{/if}
</div>
