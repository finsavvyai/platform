<script lang="ts">
	/**
	 * Feature Flags Admin — list, create, toggle, and delete targeted flags.
	 */
	import Card from '$lib/components/ui/Card.svelte';
	import { toasts } from '$stores/toast';
	import { Flag, Plus, Trash2, X } from 'lucide-svelte';

	const API_URL = import.meta.env.PUBLIC_API_URL || 'https://api.tenantiq.app';
	const API_BASE = `${API_URL}/platform/admin/feature-flags`;

	interface FlagRule {
		name: string;
		enabled: boolean;
		description?: string;
		orgs?: string[];
		plans?: string[];
		percentage?: number;
		createdAt?: string;
		updatedAt?: string;
	}

	let flags = $state<FlagRule[]>([]);
	let loading = $state(true);
	let showForm = $state(false);

	// Form state
	let formName = $state('');
	let formEnabled = $state(true);
	let formDescription = $state('');
	let formOrgs = $state('');
	let formPlans = $state('');
	let formPercentage = $state(100);
	let saving = $state(false);

	async function apiFetch(path: string, opts?: RequestInit) {
		const res = await fetch(path, {
			...opts,
			headers: { 'Content-Type': 'application/json', ...opts?.headers },
			credentials: 'include',
		});
		if (!res.ok) throw new Error(await res.text());
		return res.json();
	}

	async function loadFlags() {
		loading = true;
		try {
			const data = await apiFetch(API_BASE);
			flags = data.flags ?? [];
		} catch { flags = []; }
		loading = false;
	}

	async function createFlag() {
		saving = true;
		try {
			const body: Record<string, unknown> = {
				name: formName.trim(),
				enabled: formEnabled,
				description: formDescription.trim() || undefined,
				percentage: formPercentage < 100 ? formPercentage : undefined,
			};
			const orgs = formOrgs.split(',').map((s) => s.trim()).filter(Boolean);
			const plans = formPlans.split(',').map((s) => s.trim()).filter(Boolean);
			if (orgs.length) body.orgs = orgs;
			if (plans.length) body.plans = plans;

			await apiFetch(API_BASE, { method: 'POST', body: JSON.stringify(body) });
			toasts.success('Flag created');
			resetForm();
			await loadFlags();
		} catch (err) {
			toasts.error('Failed to create flag');
		}
		saving = false;
	}

	async function toggleFlag(flag: FlagRule) {
		try {
			await apiFetch(API_BASE, {
				method: 'POST',
				body: JSON.stringify({ name: flag.name, enabled: !flag.enabled }),
			});
			flag.enabled = !flag.enabled;
		} catch { toasts.error('Toggle failed'); }
	}

	async function deleteFlag(name: string) {
		try {
			await apiFetch(`${API_BASE}/${name}`, { method: 'DELETE' });
			flags = flags.filter((f) => f.name !== name);
			toasts.success('Flag deleted');
		} catch { toasts.error('Delete failed'); }
	}

	function resetForm() {
		showForm = false; formName = ''; formEnabled = true; formDescription = '';
		formOrgs = ''; formPlans = ''; formPercentage = 100;
	}

	$effect(() => { loadFlags(); });
</script>

<svelte:head><title>Feature Flags | TenantIQ</title></svelte:head>

<div class="space-y-4">
	<div class="flex items-center justify-between">
		<div>
			<h2 class="text-lg font-semibold text-[var(--color-text)]">Feature Flags</h2>
			<p class="text-xs text-[var(--color-text-secondary)]">Manage targeted rollout flags</p>
		</div>
		<button onclick={() => (showForm = !showForm)}
			class="flex items-center gap-1.5 rounded-md bg-[var(--color-primary)] px-3 py-1.5 text-sm font-medium text-white hover:opacity-90">
			{#if showForm}<X size={14} />{:else}<Plus size={14} />{/if}
			{showForm ? 'Cancel' : 'New Flag'}
		</button>
	</div>

	{#if showForm}
		<Card>
			<form onsubmit={(e) => { e.preventDefault(); createFlag(); }} class="space-y-3 p-4">
				<div class="grid grid-cols-2 gap-3">
					<label class="block text-xs text-[var(--color-text-secondary)]">
						Name (alphanumeric, -, _)
						<input bind:value={formName} required pattern="[a-zA-Z0-9_-]+"
							class="mt-1 block w-full rounded border border-[var(--color-border)] bg-[var(--color-bg)] px-2 py-1.5 text-sm text-[var(--color-text)]" />
					</label>
					<label class="block text-xs text-[var(--color-text-secondary)]">
						Description
						<input bind:value={formDescription}
							class="mt-1 block w-full rounded border border-[var(--color-border)] bg-[var(--color-bg)] px-2 py-1.5 text-sm text-[var(--color-text)]" />
					</label>
				</div>
				<div class="grid grid-cols-3 gap-3">
					<label class="block text-xs text-[var(--color-text-secondary)]">
						Org IDs (comma-separated)
						<input bind:value={formOrgs} placeholder="org-1, org-2"
							class="mt-1 block w-full rounded border border-[var(--color-border)] bg-[var(--color-bg)] px-2 py-1.5 text-sm text-[var(--color-text)]" />
					</label>
					<label class="block text-xs text-[var(--color-text-secondary)]">
						Plans (comma-separated)
						<input bind:value={formPlans} placeholder="starter, professional"
							class="mt-1 block w-full rounded border border-[var(--color-border)] bg-[var(--color-bg)] px-2 py-1.5 text-sm text-[var(--color-text)]" />
					</label>
					<label class="block text-xs text-[var(--color-text-secondary)]">
						Rollout % <span class="font-mono text-[var(--color-text)]">{formPercentage}%</span>
						<input type="range" min="0" max="100" bind:value={formPercentage}
							class="mt-2 block w-full accent-[var(--color-primary)]" />
					</label>
				</div>
				<div class="flex items-center justify-between">
					<label class="flex items-center gap-2 text-sm text-[var(--color-text)]">
						<input type="checkbox" bind:checked={formEnabled} class="accent-[var(--color-primary)]" />
						Enabled
					</label>
					<button type="submit" disabled={saving || !formName.trim()}
						class="rounded-md bg-[var(--color-primary)] px-4 py-1.5 text-sm font-medium text-white disabled:opacity-50">
						{saving ? 'Creating...' : 'Create Flag'}
					</button>
				</div>
			</form>
		</Card>
	{/if}

	{#if loading}
		{#each Array(3) as _}<div class="h-14 animate-pulse rounded-lg bg-[var(--color-bg-secondary)] mb-2"></div>{/each}
	{:else if flags.length === 0}
		<Card><div class="flex flex-col items-center py-8 text-center">
			<Flag size={32} class="text-[var(--color-text-secondary)] mb-2" />
			<p class="text-sm text-[var(--color-text-secondary)]">No feature flags configured yet.</p>
		</div></Card>
	{:else}
		{#each flags as flag (flag.name)}
			<div class="flex items-center justify-between rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-3 mb-2">
				<div class="flex items-center gap-3 min-w-0">
					<button onclick={() => toggleFlag(flag)} aria-label="Toggle {flag.name}"
						class="h-5 w-9 shrink-0 rounded-full transition-colors {flag.enabled ? 'bg-[var(--color-success)]' : 'bg-[var(--color-border)]'}">
						<span class="block h-4 w-4 rounded-full bg-white shadow transition-transform {flag.enabled ? 'translate-x-4' : 'translate-x-0.5'}"></span>
					</button>
					<div class="min-w-0">
						<span class="block truncate font-mono text-sm text-[var(--color-text)]">{flag.name}</span>
						{#if flag.description}<span class="block truncate text-xs text-[var(--color-text-secondary)]">{flag.description}</span>{/if}
					</div>
				</div>
				<div class="flex items-center gap-3 text-xs text-[var(--color-text-secondary)]">
					{#if flag.orgs?.length}<span>Orgs: {flag.orgs.length}</span>{/if}
					{#if flag.plans?.length}<span>Plans: {flag.plans.join(', ')}</span>{/if}
					{#if flag.percentage !== undefined && flag.percentage < 100}<span>{flag.percentage}%</span>{/if}
					<button onclick={() => deleteFlag(flag.name)} aria-label="Delete {flag.name}"
						class="p-1 text-[var(--color-danger)] hover:bg-[var(--color-danger)]/10 rounded"><Trash2 size={14} /></button>
				</div>
			</div>
		{/each}
	{/if}
</div>
