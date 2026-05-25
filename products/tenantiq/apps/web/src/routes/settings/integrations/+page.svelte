<script lang="ts">
	import IntegrationCard from '$lib/components/integrations/IntegrationCard.svelte';
	import { api } from '$api/client';
	import { untrack } from 'svelte';

	interface Integration {
		provider: string;
		name: string;
		description: string;
		status: 'connected' | 'disconnected' | 'error';
		lastSyncAt: string | null;
		icon: string;
		href: string;
	}

	const PROVIDERS: Omit<Integration, 'status' | 'lastSyncAt'>[] = [
		{
			provider: 'connectwise',
			name: 'ConnectWise PSA',
			description: 'Sync tickets, companies, and configurations with ConnectWise Manage for unified MSP operations.',
			icon: '🔧',
			href: '/settings/integrations/connectwise'
		},
		{
			provider: 'autotask',
			name: 'Datto Autotask',
			description: 'Connect Autotask PSA for ticket sync, company mapping, and automated service desk workflows.',
			icon: '🎯',
			href: '/settings/integrations/datto'
		},
		{
			provider: 'kaseya',
			name: 'Kaseya BMS',
			description: 'Integrate with Kaseya BMS to streamline billing, ticketing, and client management.',
			icon: '📊',
			href: '/settings/integrations/kaseya'
		}
	];

	let integrations = $state<Record<string, { status: string; lastSyncAt: string | null }>>({});
	let loading = $state(true);

	$effect(() => { untrack(() => loadIntegrations()); });

	async function loadIntegrations() {
		loading = true;
		try {
			const data = await api.get<{ integrations: Array<{ provider: string; status: string; lastSyncAt: string | null }> }>('/integrations');
			for (const i of data.integrations) {
				integrations[i.provider] = { status: i.status, lastSyncAt: i.lastSyncAt };
			}
		} catch {
			// No integrations yet — show all as disconnected
		} finally {
			loading = false;
		}
	}

	function getStatus(provider: string): 'connected' | 'disconnected' | 'error' {
		const s = integrations[provider]?.status;
		if (s === 'connected') return 'connected';
		if (s === 'error') return 'error';
		return 'disconnected';
	}
</script>

<svelte:head>
	<title>Integrations | TenantIQ</title>
</svelte:head>

<div class="space-y-6">
	<div>
		<h1 class="text-2xl font-bold text-[var(--color-text)]">Integrations</h1>
		<p class="text-[var(--color-text-secondary)]">Connect your PSA, RMM, and billing tools for unified MSP operations.</p>
	</div>

	{#if loading}
		<div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
			{#each Array(3) as _}
				<div class="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5">
					<div class="flex items-start gap-4">
						<div class="h-12 w-12 animate-pulse rounded-lg bg-[var(--color-bg-secondary)]"></div>
						<div class="flex-1 space-y-2">
							<div class="h-4 w-32 animate-pulse rounded bg-[var(--color-bg-secondary)]"></div>
							<div class="h-3 w-full animate-pulse rounded bg-[var(--color-bg-secondary)]"></div>
						</div>
					</div>
					<div class="mt-4 border-t border-[var(--color-border)] pt-3">
						<div class="h-3 w-24 animate-pulse rounded bg-[var(--color-bg-secondary)]"></div>
					</div>
				</div>
			{/each}
		</div>
	{:else}
		<div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
			{#each PROVIDERS as p}
				<IntegrationCard
					provider={p.provider}
					name={p.name}
					description={p.description}
					icon={p.icon}
					href={p.href}
					status={getStatus(p.provider)}
					lastSyncAt={integrations[p.provider]?.lastSyncAt ?? null}
				/>
			{/each}
		</div>
	{/if}
</div>
