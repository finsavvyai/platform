<script lang="ts">
	import { tenant } from '$stores/tenant';
	import { api } from '$api/client';
	import { toasts } from '$stores/toast';
	import { formatRelativeTime } from '$utils/format';
	import { untrack } from 'svelte';

	interface ApprovalItem { id: string; description: string; impact: string; approved: boolean }
	interface Approval {
		id: string; type: string; items: ApprovalItem[];
		requestedBy: string; requestedAt: string; status: string;
		decidedBy?: string; decidedAt?: string;
	}

	let pending = $state<Approval[]>([]);
	let history = $state<Approval[]>([]);
	let loading = $state(true);
	let activeTab = $state<'pending' | 'history'>('pending');
	let expanded = $state<string | null>(null);
	let decisions = $state<Record<string, boolean>>({});
	let submitting = $state(false);

	$effect(() => { if ($tenant.currentTenantId) untrack(() => loadData()); });

	async function loadData() {
		loading = true;
		try {
			const [pRes, hRes] = await Promise.all([
				api.get<{ approvals: Approval[] }>('/approvals'),
				api.get<{ approvals: Approval[] }>('/approvals/history'),
			]);
			pending = pRes.approvals;
			history = hRes.approvals;
		} catch { pending = []; history = []; }
		finally { loading = false; }
	}

	function toggleExpand(id: string) {
		if (expanded === id) { expanded = null; return; }
		expanded = id;
		const approval = pending.find(a => a.id === id);
		if (approval) {
			decisions = {};
			approval.items.forEach(item => { decisions[item.id] = false; });
		}
	}

	async function submitDecisions(approvalId: string) {
		submitting = true;
		try {
			const itemDecisions = Object.entries(decisions).map(([itemId, approved]) => ({ itemId, approved }));
			await api.post(`/approvals/${approvalId}/decide`, { decisions: itemDecisions });
			toasts.success('Decisions submitted');
			expanded = null;
			loadData();
		} catch { toasts.error('Failed to submit decisions'); }
		finally { submitting = false; }
	}

	const typeColors: Record<string, string> = {
		license_optimization: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
		guest_removal: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300',
		license_request: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300',
	};
	const statusColors: Record<string, string> = {
		approved: 'text-[var(--color-success)]', denied: 'text-[var(--color-danger)]',
		partial: 'text-[var(--color-warning)]', pending: 'text-[var(--color-text-secondary)]',
	};
</script>

<svelte:head><title>Approval Queue | TenantIQ</title></svelte:head>

<div class="space-y-6">
	<div>
		<h1 class="text-2xl font-bold text-[var(--color-text)]">Approval Queue</h1>
		<p class="text-[var(--color-text-secondary)]">Review and approve pending actions</p>
	</div>

	<div class="flex gap-1 rounded-lg bg-[var(--color-bg-secondary)] p-1">
		<button onclick={() => (activeTab = 'pending')} class="flex-1 rounded-md px-4 py-2 text-sm font-medium transition-all {activeTab === 'pending' ? 'bg-[var(--color-surface)] text-[var(--color-text)] shadow-sm' : 'text-[var(--color-text-secondary)]'}">
			Pending ({pending.length})
		</button>
		<button onclick={() => (activeTab = 'history')} class="flex-1 rounded-md px-4 py-2 text-sm font-medium transition-all {activeTab === 'history' ? 'bg-[var(--color-surface)] text-[var(--color-text)] shadow-sm' : 'text-[var(--color-text-secondary)]'}">
			History ({history.length})
		</button>
	</div>

	{#if loading}
		<div class="space-y-3">{#each Array(3) as _}<div class="h-16 skeleton rounded-xl"></div>{/each}</div>
	{:else if activeTab === 'pending'}
		{#if pending.length === 0}
			<div class="animate-fade-up rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] px-6 py-14 text-center">
				<div class="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-[var(--color-success)]/10">
					<svg xmlns="http://www.w3.org/2000/svg" class="h-7 w-7 text-[var(--color-success)]" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
				</div>
				<h3 class="text-base font-semibold text-[var(--color-text)]">All caught up</h3>
				<p class="mt-1 text-sm text-[var(--color-text-secondary)]">No pending approvals at this time.</p>
			</div>
		{:else}
			<div class="space-y-3">
				{#each pending as approval (approval.id)}
					<div class="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] transition-all">
						<button onclick={() => toggleExpand(approval.id)} class="flex w-full items-center justify-between p-4 text-left">
							<div class="flex items-center gap-3">
								<span class="rounded-full px-2.5 py-0.5 text-xs font-medium {typeColors[approval.type] ?? 'bg-[var(--color-bg-tertiary)] text-[var(--color-text-secondary)]'}">{approval.type.replace(/_/g, ' ')}</span>
								<span class="text-sm text-[var(--color-text)]">{approval.items.length} item(s)</span>
								<span class="text-xs text-[var(--color-text-secondary)]">by {approval.requestedBy}</span>
							</div>
							<span class="text-xs text-[var(--color-text-tertiary)]">{formatRelativeTime(approval.requestedAt)}</span>
						</button>
						{#if expanded === approval.id}
							<div class="border-t border-[var(--color-border)] p-4 space-y-3">
								{#each approval.items as item (item.id)}
									<label class="flex items-start gap-3 rounded-lg border border-[var(--color-border)] p-3 cursor-pointer">
										<input type="checkbox" bind:checked={decisions[item.id]} class="mt-0.5 rounded" />
										<div>
											<p class="text-sm font-medium text-[var(--color-text)]">{item.description}</p>
											<p class="text-xs text-[var(--color-text-secondary)]">{item.impact}</p>
										</div>
									</label>
								{/each}
								<button onclick={() => submitDecisions(approval.id)} disabled={submitting} class="rounded-lg bg-[var(--color-primary)] px-4 py-2 text-sm font-medium text-white disabled:opacity-50">
									{submitting ? 'Submitting...' : 'Submit Decisions'}
								</button>
							</div>
						{/if}
					</div>
				{/each}
			</div>
		{/if}
	{:else}
		{#if history.length === 0}
			<div class="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-8 text-center text-sm text-[var(--color-text-secondary)]">No approval history yet.</div>
		{:else}
			<div class="space-y-2">
				{#each history as approval (approval.id)}
					<div class="flex items-center justify-between rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
						<div class="flex items-center gap-3">
							<span class="rounded-full px-2.5 py-0.5 text-xs font-medium {typeColors[approval.type] ?? 'bg-[var(--color-bg-tertiary)] text-[var(--color-text-secondary)]'}">{approval.type.replace(/_/g, ' ')}</span>
							<span class="text-sm capitalize font-medium {statusColors[approval.status] ?? ''}">{approval.status}</span>
							<span class="text-xs text-[var(--color-text-secondary)]">{approval.items.length} item(s)</span>
						</div>
						<span class="text-xs text-[var(--color-text-tertiary)]">{approval.decidedAt ? formatRelativeTime(approval.decidedAt) : ''}</span>
					</div>
				{/each}
			</div>
		{/if}
	{/if}
</div>
