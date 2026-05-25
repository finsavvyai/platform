<script lang="ts">
	import { tenant } from '$stores/tenant';
	import { api } from '$api/client';
	import { toasts } from '$stores/toast';
	import { safeErrorMessage } from '$lib/utils/safe-error';
	import { formatRelativeTime } from '$utils/format';
	import { untrack } from 'svelte';

	interface Guest {
		id: string; displayName: string; mail: string | null;
		userPrincipalName: string; lastSignIn: string | null;
		daysSinceSignIn: number | null; status: string;
	}
	interface ReviewResult {
		tenantId: string; runAt: string; total: number;
		stale: number; removeCandidates: number; guests: Guest[];
	}

	let results = $state<ReviewResult | null>(null);
	let loading = $state(true);
	let running = $state(false);
	let selected = $state<Set<string>>(new Set());
	let approving = $state(false);

	$effect(() => { if ($tenant.currentTenantId) untrack(() => loadResults()); });

	async function loadResults() {
		loading = true;
		try {
			const data = await api.get<{ results: ReviewResult | null }>('/guest-review/results');
			results = data.results;
		} catch { results = null; }
		finally { loading = false; }
	}

	async function runReview() {
		running = true;
		try {
			const data = await api.post<ReviewResult>('/guest-review/run');
			results = data;
			toasts.success(`Review complete: ${data.total} guests scanned`);
		} catch (err) { toasts.error(safeErrorMessage(err, 'Review failed')); }
		finally { running = false; }
	}

	async function approveRemoval() {
		if (selected.size === 0) return;
		approving = true;
		try {
			await api.post('/guest-review/approve', { guestIds: [...selected] });
			toasts.success(`${selected.size} guest(s) queued for removal`);
			selected = new Set();
		} catch { toasts.error('Failed to approve removal'); }
		finally { approving = false; }
	}

	function toggleSelect(id: string) {
		const next = new Set(selected);
		next.has(id) ? next.delete(id) : next.add(id);
		selected = next;
	}

	function toggleAll() {
		if (!results) return;
		const removable = results.guests.filter(g => g.status !== 'active');
		selected = selected.size === removable.length ? new Set() : new Set(removable.map(g => g.id));
	}

	const statusColor: Record<string, string> = {
		active: 'bg-[var(--color-success)]/15 text-[var(--color-success)]',
		stale: 'bg-[var(--color-warning)]/15 text-[var(--color-warning)]',
		remove_candidate: 'bg-[var(--color-danger)]/15 text-[var(--color-danger)]',
	};
	const statusLabel: Record<string, string> = { active: 'Active', stale: 'Stale', remove_candidate: 'Remove' };
</script>

<svelte:head><title>Guest User Review | TenantIQ</title></svelte:head>

<div class="space-y-6">
	<div class="flex items-start justify-between gap-4">
		<div>
			<h1 class="text-2xl font-bold text-[var(--color-text)]">Guest User Review</h1>
			<p class="text-[var(--color-text-secondary)]">Identify stale or orphaned guest accounts</p>
		</div>
		<button onclick={runReview} disabled={running} class="inline-flex min-h-[44px] items-center gap-2 rounded-xl bg-[var(--color-primary)] px-5 py-2.5 text-sm font-medium text-white hover:shadow-[var(--shadow-md)] disabled:opacity-50">
			{running ? 'Scanning...' : 'Run Review'}
		</button>
	</div>

	{#if loading}
		<div class="space-y-3">{#each Array(3) as _}<div class="h-14 skeleton rounded-xl"></div>{/each}</div>
	{:else if !results}
		<div class="animate-fade-up rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] px-6 py-14 text-center">
			<div class="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-[var(--color-bg-tertiary)]">
				<svg xmlns="http://www.w3.org/2000/svg" class="h-7 w-7 text-[var(--color-text-secondary)]" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z"/></svg>
			</div>
			<h3 class="text-base font-semibold text-[var(--color-text)]">No review results yet</h3>
			<p class="mt-1 text-sm text-[var(--color-text-secondary)]">Run a review to scan guest users.</p>
		</div>
	{:else}
		<div class="grid grid-cols-2 gap-3 sm:grid-cols-3">
			<div class="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4 text-center">
				<p class="text-2xl font-bold text-[var(--color-text)]">{results.total}</p>
				<p class="text-xs text-[var(--color-text-secondary)]">Total Guests</p>
			</div>
			<div class="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4 text-center">
				<p class="text-2xl font-bold text-[var(--color-warning)]">{results.stale}</p>
				<p class="text-xs text-[var(--color-text-secondary)]">Stale</p>
			</div>
			<div class="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4 text-center">
				<p class="text-2xl font-bold text-[var(--color-danger)]">{results.removeCandidates}</p>
				<p class="text-xs text-[var(--color-text-secondary)]">Remove Candidates</p>
			</div>
		</div>

		{#if selected.size > 0}
			<div class="flex items-center gap-3">
				<span class="text-sm text-[var(--color-text-secondary)]">{selected.size} selected</span>
				<button onclick={approveRemoval} disabled={approving} class="rounded-lg bg-[var(--color-danger)] px-4 py-2 text-sm font-medium text-white disabled:opacity-50">
					{approving ? 'Approving...' : 'Approve Removal'}
				</button>
			</div>
		{/if}

		<div class="overflow-x-auto rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)]">
			<table class="w-full text-sm">
				<thead>
					<tr class="border-b border-[var(--color-border)] text-left text-xs text-[var(--color-text-secondary)]">
						<th class="p-3"><input type="checkbox" onchange={toggleAll} class="rounded" /></th>
						<th class="p-3">Guest</th>
						<th class="p-3">Status</th>
						<th class="p-3">Last Sign-in</th>
						<th class="p-3">Days Inactive</th>
					</tr>
				</thead>
				<tbody>
					{#each results.guests as guest (guest.id)}
						<tr class="border-b border-[var(--color-border)] last:border-0">
							<td class="p-3"><input type="checkbox" checked={selected.has(guest.id)} onchange={() => toggleSelect(guest.id)} disabled={guest.status === 'active'} class="rounded" /></td>
							<td class="p-3">
								<p class="font-medium text-[var(--color-text)]">{guest.displayName}</p>
								<p class="text-xs text-[var(--color-text-secondary)]">{guest.mail ?? guest.userPrincipalName}</p>
							</td>
							<td class="p-3"><span class="inline-block rounded-full px-2.5 py-0.5 text-xs font-medium {statusColor[guest.status] ?? ''}">{statusLabel[guest.status] ?? guest.status}</span></td>
							<td class="p-3 text-[var(--color-text-secondary)]">{guest.lastSignIn ? formatRelativeTime(guest.lastSignIn) : 'Never'}</td>
							<td class="p-3 text-[var(--color-text-secondary)]">{guest.daysSinceSignIn ?? 'N/A'}</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
	{/if}
</div>
