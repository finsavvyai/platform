<script lang="ts">
	import { onMount } from 'svelte';
	import DriftAlert from '$lib/components/security/DriftAlert.svelte';
	import type { SecurityDrift } from '$lib/types/security-drift';

	interface MonitorData {
		lastScan: string | null;
		drifts: SecurityDrift[];
		snapshot: Record<string, unknown> | null;
	}

	let tenantId = $state('');
	let data: MonitorData | null = $state(null);
	let loading = $state(true);
	let scanning = $state(false);

	onMount(async () => {
		const params = new URLSearchParams(window.location.search);
		tenantId = params.get('tenantId') || '';
		if (tenantId) {
			await loadMonitorData();
		}
	});

	async function loadMonitorData() {
		try {
			loading = true;
			const response = await fetch(`/api/tenants/${tenantId}/security/stack/monitor`);
			data = await response.json();
		} catch (error) {
			console.error('Failed to load monitor data', error);
		} finally {
			loading = false;
		}
	}

	async function handleScanNow() {
		try {
			scanning = true;
			const response = await fetch(`/api/tenants/${tenantId}/security/stack/monitor/scan`, {
				method: 'POST',
			});
			if (response.ok) {
				setTimeout(() => loadMonitorData(), 2000);
			}
		} finally {
			scanning = false;
		}
	}

	async function handleSetBaseline() {
		try {
			const response = await fetch(`/api/tenants/${tenantId}/security/stack/monitor/baseline`, {
				method: 'POST',
			});
			if (response.ok) {
				await loadMonitorData();
			}
		} catch (error) {
			console.error('Failed to update baseline', error);
		}
	}

	async function handleAcknowledgeDrift(driftId: string) {
		try {
			await fetch(
				`/api/tenants/${tenantId}/security/stack/monitor/drifts/${driftId}/acknowledge`,
				{ method: 'PATCH' }
			);
			await loadMonitorData();
		} catch (error) {
			console.error('Failed to acknowledge drift', error);
		}
	}

	const activeDrifts = data?.drifts.filter((d) => !d.acknowledged) || [];
	const lastScanTime = data?.lastScan ? new Date(data.lastScan) : null;
	const criticalCount = data?.drifts.filter((d) => d.severity === 'critical').length || 0;
</script>

<div class="space-y-6 p-6 max-w-6xl mx-auto">
	<!-- Header -->
	<div class="flex items-start justify-between mb-8">
		<div>
			<h1 class="text-3xl font-bold text-gray-900">Security Stack Monitor</h1>
			<p class="text-gray-600 mt-2">
				Detect and respond to changes in your Microsoft 365 security configuration
			</p>
		</div>
		<button
			disabled={scanning}
			onclick={handleScanNow}
			class="px-6 py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
		>
			{scanning ? 'Scanning...' : 'Scan Now'}
		</button>
	</div>

	{#if loading}
		<!-- Loading skeletons -->
		<div class="grid grid-cols-3 gap-4">
			{#each [1, 2, 3] as _}
				<div class="border rounded-lg p-4 bg-gray-50 animate-pulse">
					<div class="h-6 bg-gray-200 rounded mb-2"></div>
					<div class="h-8 bg-gray-200 rounded"></div>
				</div>
			{/each}
		</div>
	{:else if !data}
		<!-- No data state -->
		<div class="border rounded-lg p-12 text-center bg-gray-50">
			<p class="text-gray-500 text-lg">No data available. Click "Scan Now" to start monitoring.</p>
		</div>
	{:else}
		<!-- Summary cards -->
		<div class="grid grid-cols-3 gap-4">
			<div class="border rounded-lg p-4 bg-white shadow-sm">
				<p class="text-gray-600 text-sm font-medium">Last Scan</p>
				<p class="text-2xl font-bold text-gray-900 mt-2">
					{lastScanTime?.toLocaleDateString() || 'Never'}
				</p>
				{#if lastScanTime}
					<p class="text-xs text-gray-500 mt-1">{lastScanTime.toLocaleTimeString()}</p>
				{/if}
			</div>

			<div class="border rounded-lg p-4 bg-white shadow-sm">
				<p class="text-gray-600 text-sm font-medium">Active Drifts</p>
				<p class="text-2xl font-bold text-red-600 mt-2">{activeDrifts.length}</p>
				<p class="text-xs text-gray-500 mt-1">Require attention</p>
			</div>

			<div class="border rounded-lg p-4 bg-white shadow-sm">
				<p class="text-gray-600 text-sm font-medium">Critical Issues</p>
				<p class="text-2xl font-bold text-orange-600 mt-2">{criticalCount}</p>
				<p class="text-xs text-gray-500 mt-1">Immediate action</p>
			</div>
		</div>

		<!-- Drifts section -->
		{#if activeDrifts.length > 0}
			<div class="space-y-4">
				<div class="flex items-center justify-between">
					<h2 class="text-xl font-semibold text-gray-900">Recent Changes</h2>
					<button
						onclick={handleSetBaseline}
						class="px-4 py-2 bg-gray-200 text-gray-900 rounded-lg hover:bg-gray-300 transition-colors text-sm font-medium"
					>
						Set as Baseline
					</button>
				</div>

				{#each activeDrifts as drift (drift.id)}
					<DriftAlert
						{drift}
						onAcknowledge={handleAcknowledgeDrift}
						onAccept={handleSetBaseline}
					/>
				{/each}
			</div>
		{:else}
			<!-- No drifts state -->
			<div class="border rounded-lg p-12 text-center bg-green-50">
				<p class="text-green-700 text-lg font-medium">All secure!</p>
				<p class="text-green-600 text-sm mt-1">No configuration changes detected.</p>
			</div>
		{/if}
	{/if}
</div>

<style>
	:global(body) {
		background-color: #f9fafb;
	}

	:global(* {
		@apply scroll-smooth;
	})
</style>
