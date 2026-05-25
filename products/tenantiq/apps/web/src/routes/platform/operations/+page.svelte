<script lang="ts">
	import { api } from '$api/client';
	import { tenant } from '$stores/tenant';
	import { untrack } from 'svelte';

	// ─── Types ────────────────────────────────────────────────────────────────

	interface HealthCard {
		cisScore: number;
		alertCount: number;
		tenantCount: number;
		criticalAlerts: number;
	}

	interface CICard {
		lastDeploy: string;
		lastDeployStatus: 'success' | 'failed' | 'pending';
		pipelineHealth: number;
		lastDeployTime: string;
	}

	interface AgentCard {
		activeSessions: number;
		recentConversations: number;
		lastActivity: string;
	}

	// ─── State ────────────────────────────────────────────────────────────────

	let health = $state<HealthCard | null>(null);
	let ci = $state<CICard | null>(null);
	let agent = $state<AgentCard | null>(null);
	let loading = $state(true);

	// ─── Load data ────────────────────────────────────────────────────────────

	$effect(() => {
		if ($tenant.currentTenantId) untrack(() => loadData());
	});

	async function loadData() {
		loading = true;
		try {
			const [h, c, a] = await Promise.all([
				api.get<HealthCard>('/platform/operations/health').catch(() => null),
				api.get<CICard>('/platform/operations/ci').catch(() => null),
				api.get<AgentCard>('/platform/operations/agents').catch(() => null),
			]);
			health = h;
			ci = c;
			agent = a;
		} finally {
			loading = false;
		}
	}

	function statusColor(status: string): string {
		if (status === 'success') return 'text-green-500';
		if (status === 'failed') return 'text-red-500';
		return 'text-yellow-500';
	}

	function scoreColor(score: number): string {
		if (score >= 80) return 'text-green-500';
		if (score >= 60) return 'text-yellow-500';
		return 'text-red-500';
	}
</script>

<svelte:head>
	<title>Operations | TenantIQ</title>
</svelte:head>

<div class="space-y-6 p-4">
	<div>
		<h1 class="text-xl font-bold text-[var(--color-text)]">Operations Dashboard</h1>
		<p class="text-sm text-[var(--color-text-secondary)]">
			Unified view across TenantIQ, CI/CD, and agent sessions
		</p>
	</div>

	{#if loading}
		<div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
			{#each [1, 2, 3] as _}
				<div class="h-48 animate-pulse rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)]"></div>
			{/each}
		</div>
	{:else}
		<div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
			<!-- TenantIQ Health -->
			<div class="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-5">
				<h2 class="mb-4 text-sm font-semibold text-[var(--color-text-secondary)]">TenantIQ Health</h2>
				{#if health}
					<div class="grid grid-cols-2 gap-4">
						<div>
							<div class="text-2xl font-bold {scoreColor(health.cisScore)}">{health.cisScore}%</div>
							<div class="text-xs text-[var(--color-text-secondary)]">CIS Score</div>
						</div>
						<div>
							<div class="text-2xl font-bold text-[var(--color-text)]">{health.tenantCount}</div>
							<div class="text-xs text-[var(--color-text-secondary)]">Tenants</div>
						</div>
						<div>
							<div class="text-2xl font-bold text-[var(--color-text)]">{health.alertCount}</div>
							<div class="text-xs text-[var(--color-text-secondary)]">Alerts</div>
						</div>
						<div>
							<div class="text-2xl font-bold text-red-500">{health.criticalAlerts}</div>
							<div class="text-xs text-[var(--color-text-secondary)]">Critical</div>
						</div>
					</div>
				{:else}
					<p class="text-sm text-[var(--color-text-secondary)]">No health data available</p>
				{/if}
			</div>

			<!-- CI/CD Status -->
			<div class="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-5">
				<h2 class="mb-4 text-sm font-semibold text-[var(--color-text-secondary)]">CI/CD Pipeline</h2>
				{#if ci}
					<div class="space-y-3">
						<div>
							<div class="text-sm font-medium text-[var(--color-text)]">{ci.lastDeploy}</div>
							<div class="mt-0.5 flex items-center gap-1.5">
								<span class="inline-block h-2 w-2 rounded-full {ci.lastDeployStatus === 'success' ? 'bg-green-500' : ci.lastDeployStatus === 'failed' ? 'bg-red-500' : 'bg-yellow-500'}"></span>
								<span class="text-xs {statusColor(ci.lastDeployStatus)}">{ci.lastDeployStatus}</span>
							</div>
						</div>
						<div>
							<div class="text-2xl font-bold {scoreColor(ci.pipelineHealth)}">{ci.pipelineHealth}%</div>
							<div class="text-xs text-[var(--color-text-secondary)]">Pipeline Health</div>
						</div>
						<div class="text-xs text-[var(--color-text-secondary)]">{ci.lastDeployTime}</div>
					</div>
				{:else}
					<p class="text-sm text-[var(--color-text-secondary)]">No CI/CD data available</p>
				{/if}
			</div>

			<!-- Agent Sessions -->
			<div class="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-5">
				<h2 class="mb-4 text-sm font-semibold text-[var(--color-text-secondary)]">Agent Sessions</h2>
				{#if agent}
					<div class="space-y-3">
						<div class="grid grid-cols-2 gap-4">
							<div>
								<div class="text-2xl font-bold text-[var(--color-text)]">{agent.activeSessions}</div>
								<div class="text-xs text-[var(--color-text-secondary)]">Active</div>
							</div>
							<div>
								<div class="text-2xl font-bold text-[var(--color-text)]">{agent.recentConversations}</div>
								<div class="text-xs text-[var(--color-text-secondary)]">Recent</div>
							</div>
						</div>
						<div class="text-xs text-[var(--color-text-secondary)]">Last activity: {agent.lastActivity}</div>
					</div>
				{:else}
					<p class="text-sm text-[var(--color-text-secondary)]">No agent data available</p>
				{/if}
				<a
					href="/ai/agent"
					class="mt-4 inline-block text-xs font-medium text-[var(--color-primary)] hover:underline"
				>
					Open Agent Chat
				</a>
			</div>
		</div>
	{/if}
</div>
