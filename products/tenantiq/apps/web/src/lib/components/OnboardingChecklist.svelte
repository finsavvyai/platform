<script lang="ts">
	import { browser } from '$app/environment';
	import { onMount } from 'svelte';
	import { api } from '$api/client';

	interface Props {
		hasSynced: boolean;
	}

	const { hasSynced }: Props = $props();

	const STORAGE_KEY = 'tenantiq_onboarding_checklist';

	interface ChecklistState {
		dismissed: boolean;
		cisScanDone: boolean;
		licensesReviewed: boolean;
		aiTried: boolean;
	}

	function loadState(): ChecklistState {
		if (!browser) return { dismissed: false, cisScanDone: false, licensesReviewed: false, aiTried: false };
		try {
			const raw = localStorage.getItem(STORAGE_KEY);
			if (raw) return JSON.parse(raw);
		} catch { /* use defaults */ }
		return { dismissed: false, cisScanDone: false, licensesReviewed: false, aiTried: false };
	}

	let state = $state(loadState());

	function save() {
		if (browser) localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
	}

	// Auto-detect completion from server — if the tenant has a cached CIS scan,
	// mark that task done regardless of the local flag. Avoids showing "Run CIS
	// benchmark scan" after the user has already run one.
	onMount(async () => {
		if (!hasSynced || state.cisScanDone) return;
		try {
			const res = await api.get<{ overallScore?: number | null; totalControls?: number }>('/cis-benchmark/latest');
			if (res && (res.totalControls ?? 0) > 0) {
				state.cisScanDone = true;
				save();
			}
		} catch { /* ignore — user can still toggle manually */ }
	});

	function toggle(key: keyof Omit<ChecklistState, 'dismissed'>) {
		state[key] = !state[key];
		save();
	}

	function dismiss() {
		state.dismissed = true;
		save();
	}

	const items = $derived([
		{ label: 'Connect Microsoft 365 tenant', href: '/settings', done: true },
		{ label: 'Sync data', href: null, done: hasSynced },
		{ label: 'Run CIS benchmark scan', href: '/security/cis', done: state.cisScanDone, key: 'cisScanDone' as const },
		{ label: 'Review license waste', href: '/licenses', done: state.licensesReviewed, key: 'licensesReviewed' as const },
		{ label: 'Try the AI agent', href: '/ai', done: state.aiTried, key: 'aiTried' as const }
	]);

	const completed = $derived(items.filter((i) => i.done).length);
	const total = $derived(items.length);
	const allDone = $derived(completed === total);
</script>

{#if !state.dismissed && !allDone}
	<div class="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5">
		<div class="mb-3 flex items-center justify-between">
			<h3 class="text-sm font-semibold text-[var(--color-text)]">
				Getting Started — {completed}/{total} completed
			</h3>
			<button onclick={dismiss} class="text-xs text-[var(--color-text-secondary)] hover:text-[var(--color-text)]" aria-label="Dismiss checklist">
				Dismiss
			</button>
		</div>

		<div class="mb-4 h-1.5 w-full overflow-hidden rounded-full bg-[var(--color-bg-tertiary)]">
			<div
				class="h-full rounded-full bg-[var(--color-primary)] transition-all duration-300"
				style="width: {(completed / total) * 100}%"
			></div>
		</div>

		<ul class="space-y-2">
			{#each items as item}
				<li class="flex items-center gap-3 text-sm">
					{#if item.key}
						<button onclick={() => toggle(item.key!)} class="flex h-5 w-5 shrink-0 items-center justify-center rounded border border-[var(--color-border)] transition-colors {item.done ? 'bg-[var(--color-success)] border-[var(--color-success)]' : ''}" aria-label="Mark {item.label} as {item.done ? 'incomplete' : 'complete'}">
							{#if item.done}<svg class="h-3 w-3 text-white" fill="none" viewBox="0 0 24 24" stroke-width="3" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M4.5 12.75l6 6 9-13.5"/></svg>{/if}
						</button>
					{:else}
						<span class="flex h-5 w-5 shrink-0 items-center justify-center rounded {item.done ? 'bg-[var(--color-success)]' : 'border border-[var(--color-border)]'}">
							{#if item.done}<svg class="h-3 w-3 text-white" fill="none" viewBox="0 0 24 24" stroke-width="3" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M4.5 12.75l6 6 9-13.5"/></svg>{/if}
						</span>
					{/if}
					{#if item.href}
						<a href={item.href} class="text-[var(--color-text)] hover:text-[var(--color-primary)] {item.done ? 'line-through opacity-60' : ''}">{item.label}</a>
					{:else}
						<span class="{item.done ? 'line-through opacity-60' : ''} text-[var(--color-text)]">{item.label}</span>
					{/if}
				</li>
			{/each}
		</ul>
	</div>
{/if}
