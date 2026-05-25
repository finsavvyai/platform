<script lang="ts">
	/**
	 * Admin System Alerts Page
	 *
	 * Platform-level alerts: high error rate, sync failures, quota limits.
	 */
	import Card from '$lib/components/ui/Card.svelte';
	import { auth } from '$stores/auth';
	import { AlertTriangle, XCircle, Server, Clock, CheckCircle } from 'lucide-svelte';

	interface SystemAlert {
		id: string;
		type: string;
		severity: string;
		title: string;
		description: string;
		detectedAt: number;
	}

	let loading = $state(true);
	let alerts = $state<SystemAlert[]>([]);

	$effect(() => {
		if ($auth.user) loadAlerts();
	});

	async function loadAlerts() {
		loading = true;
		try {
			const res = await fetch('https://api.tenantiq.app/platform/admin/system-alerts', {
				credentials: 'include',
			}).then((r) => r.json());
			alerts = res.alerts ?? [];
		} catch {
			/* keep defaults */
		} finally {
			loading = false;
		}
	}

	function severityConfig(severity: string) {
		switch (severity) {
			case 'critical': return { color: 'border-red-500 bg-red-500/5', icon: XCircle, iconColor: 'text-red-500' };
			case 'high': return { color: 'border-orange-500 bg-orange-500/5', icon: AlertTriangle, iconColor: 'text-orange-500' };
			case 'medium': return { color: 'border-amber-500 bg-amber-500/5', icon: Clock, iconColor: 'text-amber-500' };
			default: return { color: 'border-[var(--color-border)] bg-[var(--color-surface)]', icon: Server, iconColor: 'text-[var(--color-text-secondary)]' };
		}
	}
</script>

<svelte:head>
	<title>System Alerts - Admin - TenantIQ</title>
</svelte:head>

<div class="flex items-center justify-between mb-4">
	<h2 class="text-lg font-semibold text-[var(--color-text)]">System Alerts</h2>
	<button
		onclick={loadAlerts}
		class="rounded-lg border border-[var(--color-border)] px-4 py-2 text-sm text-[var(--color-text)] hover:bg-[var(--color-bg-secondary)] transition-colors cursor-pointer"
	>Refresh</button>
</div>

{#if loading}
	<div class="space-y-3">
		{#each Array(3) as _}
			<Card variant="elevated" padding="md">
				<div class="animate-pulse space-y-2">
					<div class="h-4 w-48 rounded bg-[var(--color-bg-secondary)]"></div>
					<div class="h-3 w-80 rounded bg-[var(--color-bg-secondary)]"></div>
				</div>
			</Card>
		{/each}
	</div>
{:else if alerts.length === 0}
	<Card variant="elevated" padding="lg">
		<div class="text-center py-8">
			<CheckCircle class="w-12 h-12 text-[var(--color-success)] mx-auto mb-3" />
			<h3 class="text-base font-semibold text-[var(--color-text)]">All Clear</h3>
			<p class="text-sm text-[var(--color-text-secondary)] mt-1">No system alerts detected.</p>
		</div>
	</Card>
{:else}
	<div class="space-y-3">
		{#each alerts as alert (alert.id)}
			{@const config = severityConfig(alert.severity)}
			{@const SevIcon = config.icon}
			<div class="rounded-xl border-l-4 p-4 {config.color}">
				<div class="flex items-start gap-3">
					<SevIcon size={20} class={config.iconColor} />
					<div class="flex-1">
						<div class="flex items-center gap-2">
							<h3 class="text-sm font-semibold text-[var(--color-text)]">{alert.title}</h3>
							<span class="rounded-full px-2 py-0.5 text-xs font-medium uppercase {config.iconColor}">
								{alert.severity}
							</span>
						</div>
						<p class="mt-1 text-sm text-[var(--color-text-secondary)]">{alert.description}</p>
					</div>
				</div>
			</div>
		{/each}
	</div>
{/if}
