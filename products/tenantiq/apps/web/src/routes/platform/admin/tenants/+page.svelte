<script lang="ts">
	/**
	 * Admin Tenant Health Page
	 *
	 * Lists all tenants with health status, sync info, and alert counts.
	 */
	import Card from '$lib/components/ui/Card.svelte';
	import TenantHealthCard from '$lib/components/admin/TenantHealthCard.svelte';
	import { auth } from '$stores/auth';
	import { Search } from 'lucide-svelte';

	let loading = $state(true);
	let tenants = $state<any[]>([]);
	let total = $state(0);
	let currentPage = $state(1);
	let search = $state('');

	const filteredTenants = $derived(
		search
			? tenants.filter(
					(t) =>
						t.display_name?.toLowerCase().includes(search.toLowerCase()) ||
						t.domain?.toLowerCase().includes(search.toLowerCase())
				)
			: tenants
	);

	$effect(() => {
		if ($auth.user) loadTenants();
	});

	async function loadTenants() {
		loading = true;
		try {
			const res = await fetch(
				`https://api.tenantiq.app/platform/admin/tenants?page=${currentPage}&limit=50`,
				{ credentials: 'include' }
			).then((r) => r.json());
			tenants = res.tenants ?? [];
			total = res.total ?? 0;
		} catch {
			/* keep defaults */
		} finally {
			loading = false;
		}
	}
</script>

<svelte:head>
	<title>Tenant Health - Admin - TenantIQ</title>
</svelte:head>

<div class="flex items-center justify-between mb-4">
	<h2 class="text-lg font-semibold text-[var(--color-text)]">Tenant Health ({total})</h2>
	<div class="relative">
		<Search size={14} class="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-text-tertiary)]" />
		<input
			bind:value={search}
			type="text"
			placeholder="Search tenants..."
			class="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] pl-9 pr-4 py-2 text-sm text-[var(--color-text)]"
		/>
	</div>
</div>

<Card variant="elevated" padding="none">
	{#if loading}
		<div class="p-8 text-center text-sm text-[var(--color-text-secondary)]">Loading tenants...</div>
	{:else if filteredTenants.length === 0}
		<div class="p-8 text-center text-sm text-[var(--color-text-secondary)]">No tenants found</div>
	{:else}
		{#each filteredTenants as t (t.id)}
			<TenantHealthCard tenant={t} />
		{/each}
	{/if}
</Card>

{#if total > 50}
	<div class="flex items-center justify-center gap-4 mt-4">
		<button
			onclick={() => { currentPage = Math.max(1, currentPage - 1); loadTenants(); }}
			disabled={currentPage === 1}
			class="rounded-lg border border-[var(--color-border)] px-4 py-2 text-sm text-[var(--color-text)] disabled:opacity-50 cursor-pointer"
		>Previous</button>
		<span class="text-sm text-[var(--color-text-secondary)]">Page {currentPage}</span>
		<button
			onclick={() => { currentPage++; loadTenants(); }}
			disabled={currentPage * 50 >= total}
			class="rounded-lg border border-[var(--color-border)] px-4 py-2 text-sm text-[var(--color-text)] disabled:opacity-50 cursor-pointer"
		>Next</button>
	</div>
{/if}
