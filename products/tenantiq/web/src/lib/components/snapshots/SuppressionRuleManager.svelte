<script lang="ts">
	import { api } from '$api/client';
	import { toasts } from '$stores/toast';
	import { untrack } from 'svelte';

	interface Rule {
		id: string;
		category: string;
		path_pattern: string;
		reason: string | null;
		created_by: string;
		created_at: number;
	}

	let rules = $state<Rule[]>([]);
	let loading = $state(true);
	let category = $state('');
	let pathPattern = $state('');
	let reason = $state('');
	let adding = $state(false);

	export function refresh() { loadRules(); }

	async function loadRules() {
		loading = true;
		try {
			const res = await api.get<{ rules: Rule[] }>('/config-drifts/suppression-rules');
			rules = res.rules;
		} catch { rules = []; }
		finally { loading = false; }
	}

	async function addRule() {
		if (!category.trim() || !pathPattern.trim()) {
			toasts.error('Category and path pattern are required');
			return;
		}
		adding = true;
		try {
			const res = await api.post<{ success: boolean; error?: string }>('/config-drifts/suppression-rules', {
				category: category.trim(),
				pathPattern: pathPattern.trim(),
				reason: reason.trim() || undefined,
			});
			if (res.error) { toasts.error(res.error); return; }
			toasts.success('Suppression rule added');
			category = ''; pathPattern = ''; reason = '';
			loadRules();
		} catch (e) { toasts.error(e instanceof Error ? e.message : 'Failed to add rule'); }
		finally { adding = false; }
	}

	async function deleteRule(id: string) {
		try {
			await api.delete(`/config-drifts/suppression-rules/${id}`);
			rules = rules.filter((r) => r.id !== id);
			toasts.success('Rule deleted');
		} catch { toasts.error('Failed to delete rule'); }
	}

	$effect(() => { untrack(() => loadRules()); });
</script>

<div class="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5">
	<h3 class="mb-4 text-sm font-semibold text-[var(--color-text)]">Drift Suppression Rules</h3>
	<p class="mb-4 text-xs text-[var(--color-text-secondary)]">
		Suppress specific config changes from triggering drift alerts. Use glob patterns for paths.
	</p>

	<!-- Add rule form -->
	<div class="mb-4 grid grid-cols-1 gap-2 sm:grid-cols-4">
		<input bind:value={category} placeholder="Category (e.g. conditional_access)" class="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 text-sm text-[var(--color-text)] placeholder:text-[var(--color-text-tertiary)]" />
		<input bind:value={pathPattern} placeholder="Path pattern (e.g. policies.*)" class="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 text-sm text-[var(--color-text)] placeholder:text-[var(--color-text-tertiary)]" />
		<input bind:value={reason} placeholder="Reason (optional)" class="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 text-sm text-[var(--color-text)] placeholder:text-[var(--color-text-tertiary)]" />
		<button onclick={addRule} disabled={adding} class="cursor-pointer rounded-lg bg-[var(--color-primary)] px-4 py-2 text-sm font-medium text-white hover:shadow-[var(--shadow-md)] disabled:opacity-50">
			{adding ? 'Adding...' : 'Add Rule'}
		</button>
	</div>

	<!-- Rules list -->
	{#if loading}
		<div class="space-y-2">{#each Array(2) as _}<div class="h-10 skeleton rounded-lg"></div>{/each}</div>
	{:else if rules.length === 0}
		<p class="text-xs text-[var(--color-text-tertiary)]">No suppression rules configured.</p>
	{:else}
		<div class="space-y-2">
			{#each rules as rule (rule.id)}
				<div class="flex items-center justify-between rounded-lg bg-[var(--color-bg)] p-3">
					<div class="min-w-0 flex-1">
						<div class="flex items-center gap-2">
							<span class="rounded bg-[var(--color-primary)]/10 px-2 py-0.5 text-xs font-medium text-[var(--color-primary)]">{rule.category}</span>
							<code class="text-xs text-[var(--color-text)]">{rule.path_pattern}</code>
						</div>
						{#if rule.reason}
							<p class="mt-1 text-[11px] text-[var(--color-text-secondary)]">{rule.reason}</p>
						{/if}
					</div>
					<button onclick={() => deleteRule(rule.id)} class="ml-3 cursor-pointer rounded-lg px-2 py-1 text-xs text-[var(--color-error)] hover:bg-[var(--color-error)]/10" aria-label="Delete rule">
						Delete
					</button>
				</div>
			{/each}
		</div>
	{/if}
</div>
