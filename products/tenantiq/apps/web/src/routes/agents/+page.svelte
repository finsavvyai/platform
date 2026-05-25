<script lang="ts">
	import PageHeader from '$components/ui/PageHeader.svelte';
	import MetricCard from '$components/MetricCard.svelte';
	import AgentActionRow from '$lib/components/agents/AgentActionRow.svelte';
	import { onMount, onDestroy } from 'svelte';
	import { Activity, Pause, Play } from 'lucide-svelte';

	interface Action {
		id: string; orgId: string | null; tenantId: string | null;
		agent: string; action: string; findingId: string | null;
		severity: string | null; status: string;
		metadata: Record<string, unknown> | null; at: string;
	}
	interface Summary {
		windowHours: number; total: number;
		byAgent: { agent: string; n: number }[];
		byStatus: { status: string; n: number }[];
		bySeverity: { severity: string; n: number }[];
	}

	const API = (path: string) =>
		(typeof window !== 'undefined' && window.location.hostname === 'localhost'
			? 'http://localhost:8787'
			: 'https://api.tenantiq.app') + path;

	let actions = $state<Action[]>([]);
	let summary = $state<Summary | null>(null);
	let loading = $state(true);
	let streaming = $state(true);
	let agentFilter = $state<string>('all');
	let statusFilter = $state<string>('all');
	let busyId = $state<string | null>(null);
	let toast = $state<string | null>(null);

	let abortCtrl: AbortController | null = null;

	onMount(async () => {
		await loadHistory();
		await loadSummary();
		startStream();
	});

	onDestroy(() => abortCtrl?.abort());

	async function loadHistory() {
		loading = true;
		try {
			const res = await fetch(API('/api/agent-actions?limit=200'), { credentials: 'include' });
			if (res.ok) {
				const body = await res.json() as { actions: Action[] };
				actions = body.actions;
			}
		} catch { /* offline-tolerant */ }
		finally { loading = false; }
	}

	async function loadSummary() {
		try {
			const res = await fetch(API('/api/agent-actions/summary'), { credentials: 'include' });
			if (res.ok) summary = await res.json() as Summary;
		} catch { /* offline-tolerant */ }
	}

	async function startStream() {
		if (abortCtrl) abortCtrl.abort();
		abortCtrl = new AbortController();
		try {
			const res = await fetch(API('/api/agent-actions/stream'), {
				headers: { Accept: 'text/event-stream' },
				credentials: 'include',
				signal: abortCtrl.signal,
			});
			if (!res.body) return;
			const reader = res.body.getReader();
			const dec = new TextDecoder();
			let buf = '';
			while (streaming) {
				const { value, done } = await reader.read();
				if (done) break;
				buf += dec.decode(value, { stream: true });
				let nl;
				while ((nl = buf.indexOf('\n\n')) !== -1) {
					const frame = buf.slice(0, nl); buf = buf.slice(nl + 2);
					if (!frame.startsWith('data: ')) continue;
					try {
						const ev = JSON.parse(frame.slice(6)) as Action;
						actions = [ev, ...actions].slice(0, 500);
					} catch { /* ignore */ }
				}
			}
		} catch { /* aborted or transient */ }
	}

	async function approve(id: string) {
		busyId = id;
		try {
			const res = await fetch(API(`/api/agent-actions/${id}/approve`), { method: 'POST', credentials: 'include' });
			if (!res.ok) throw new Error(`HTTP ${res.status}`);
			toast = 'Approved — re-enqueued in live mode';
			actions = actions.map((a) => a.id === id ? { ...a, status: 'approved' } : a);
		} catch (e) {
			toast = e instanceof Error ? e.message : 'Approve failed';
		} finally { busyId = null; setTimeout(() => (toast = null), 2500); }
	}

	async function abort(id: string) {
		if (!confirm('Abort this pending auto-fix? It will not be re-enqueued.')) return;
		busyId = id;
		try {
			const res = await fetch(API(`/api/agent-actions/${id}/abort`), { method: 'POST', credentials: 'include' });
			if (!res.ok) throw new Error(`HTTP ${res.status}`);
			toast = 'Aborted';
			actions = actions.map((a) => a.id === id ? { ...a, status: 'aborted' } : a);
		} catch (e) {
			toast = e instanceof Error ? e.message : 'Abort failed';
		} finally { busyId = null; setTimeout(() => (toast = null), 2500); }
	}

	function toggleStream() {
		streaming = !streaming;
		if (streaming) {
			startStream();
		} else {
			abortCtrl?.abort();
		}
	}

	const filtered = $derived(
		actions.filter((a) =>
			(agentFilter === 'all' || a.agent === agentFilter)
			&& (statusFilter === 'all' || a.status === statusFilter),
		),
	);

	const agents = $derived(Array.from(new Set(actions.map((a) => a.agent))).sort());
</script>

<svelte:head><title>Agents | TenantIQ</title></svelte:head>

<div class="space-y-6">
	<PageHeader title="Autonomous Agents" description="What every TenantIQ agent in your org has done — live feed (5s push)." iconPath="M8.25 6.75h12M8.25 12h12m-12 5.25h12M3.75 6.75h.007v.008H3.75V6.75zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zM3.75 12h.007v.008H3.75V12zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zM3.75 17.25h.007v.008H3.75v-.008zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z">
		<button class="btn-secondary" onclick={toggleStream}>
			{#if streaming}<Pause size={14} /> Pause stream{:else}<Play size={14} /> Resume{/if}
		</button>
	</PageHeader>

	{#if summary}
		<div class="grid grid-cols-2 gap-4 sm:grid-cols-4">
			<MetricCard title="24h actions" value={String(summary.total)} subtitle="Across all agents" />
			<MetricCard title="Successful" value={String(summary.byStatus.find(s => s.status === 'success')?.n ?? 0)} subtitle="Last 24 hours" />
			<MetricCard title="Failed" value={String(summary.byStatus.find(s => s.status === 'failed')?.n ?? 0)} subtitle="Last 24 hours" />
			<MetricCard title="Rolled back" value={String(summary.byStatus.find(s => s.status === 'rolled-back')?.n ?? 0)} subtitle="Auto-revert events" />
		</div>
	{/if}

	<div class="filter-bar">
		<select bind:value={agentFilter} class="filter-select">
			<option value="all">All agents</option>
			{#each agents as a}<option value={a}>{a}</option>{/each}
		</select>
		<select bind:value={statusFilter} class="filter-select">
			<option value="all">All statuses</option>
			<option value="success">success</option>
			<option value="failed">failed</option>
			<option value="rolled-back">rolled-back</option>
		</select>
		<span class="filter-count">{filtered.length} of {actions.length}</span>
		{#if streaming}
			<span class="live-badge"><span class="pulse"></span> Live</span>
		{:else}
			<span class="paused-badge">Paused</span>
		{/if}
	</div>

	{#if toast}<div class="toast">{toast}</div>{/if}

	<div class="feed">
		{#if loading}
			<p class="empty">Loading…</p>
		{:else if filtered.length === 0}
			<p class="empty">No agent activity yet for this org. Activity appears here as autonomous agents run (every 6h auditor, hourly auto-fix scanner, on every public scan, etc.)</p>
		{:else}
			<ul>
				{#each filtered as r (r.id)}
					<AgentActionRow row={r} onApprove={approve} onAbort={abort} busy={busyId === r.id} />
				{/each}
			</ul>
		{/if}
	</div>
</div>

<style>
	.filter-bar { display: flex; gap: 0.5rem; align-items: center; flex-wrap: wrap; }
	.filter-select { background: var(--color-surface); border: 1px solid var(--color-border); border-radius: 0.5rem; padding: 0.375rem 0.75rem; font-size: 0.8125rem; color: var(--color-text); min-height: 36px; }
	.filter-count { font-size: 0.75rem; color: var(--color-text-tertiary); margin-left: auto; }
	.live-badge, .paused-badge { display: inline-flex; align-items: center; gap: 0.375rem; padding: 0.25rem 0.625rem; border-radius: 999px; font-size: 0.6875rem; font-weight: 600; text-transform: uppercase; letter-spacing: 0.04em; }
	.live-badge { background: color-mix(in srgb, var(--color-success) 12%, transparent); color: var(--color-success); }
	.paused-badge { background: var(--color-bg-tertiary); color: var(--color-text-secondary); }
	.pulse { width: 6px; height: 6px; border-radius: 50%; background: var(--color-success); animation: pulse 2s infinite; }
	@keyframes pulse { 70% { box-shadow: 0 0 0 6px color-mix(in srgb, var(--color-success) 0%, transparent); } 100% { box-shadow: 0 0 0 0 color-mix(in srgb, var(--color-success) 0%, transparent); } }
	.feed { background: var(--color-surface); border: 1px solid var(--color-border); border-radius: 0.75rem; overflow: hidden; }
	.feed ul { list-style: none; padding: 0; margin: 0; }
	.empty { padding: 2.5rem 1.25rem; text-align: center; color: var(--color-text-tertiary); font-size: 0.875rem; margin: 0; }
	.toast { padding: 0.625rem 1rem; background: color-mix(in srgb, var(--color-primary) 12%, var(--color-surface)); border: 1px solid color-mix(in srgb, var(--color-primary) 30%, transparent); border-radius: 0.5rem; color: var(--color-text); font-size: 0.8125rem; }
</style>
