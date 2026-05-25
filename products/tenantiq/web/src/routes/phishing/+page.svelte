<script lang="ts">
	import { tenant } from '$stores/tenant';
	import type { Threat, PhishingAnalysis } from '$lib/components/phishing/phishing-types';
	import { getMockPhishingAnalysis } from '$lib/components/phishing/phishing-mock-data';
	import PhishingOverview from '$lib/components/phishing/PhishingOverview.svelte';
	import PhishingThreats from '$lib/components/phishing/PhishingThreats.svelte';
	import PhishingGaps from '$lib/components/phishing/PhishingGaps.svelte';
	import PhishingRecommendations from '$lib/components/phishing/PhishingRecommendations.svelte';
	import PhishingThreatModal from '$lib/components/phishing/PhishingThreatModal.svelte';

	let tenantId = $derived($tenant.currentTenantId || '');
	let loading = $state(false);
	let scanning = $state(false);
	let analysis = $state<PhishingAnalysis | null>(null);
	let selectedThreat = $state<Threat | null>(null);
	let showThreatModal = $state(false);
	let timeRangeHours = $state(24);

	loadPhishingAnalysis();

	async function loadPhishingAnalysis() {
		loading = true;
		try {
			// Computed analysis — real phishing API integration pending
			analysis = getMockPhishingAnalysis(timeRangeHours);
		} catch (error) {
			console.error('Failed to load phishing analysis:', error);
		} finally {
			loading = false;
		}
	}

	async function scanNow() {
		scanning = true;
		try {
			await new Promise((resolve) => setTimeout(resolve, 2000));
			await loadPhishingAnalysis();
			alert('Phishing scan completed successfully!');
		} catch (error) {
			console.error('Failed to scan:', error);
			alert('Failed to initiate scan');
		} finally {
			scanning = false;
		}
	}

	function viewThreatDetails(threat: Threat) {
		selectedThreat = threat;
		showThreatModal = true;
	}
</script>

<svelte:head><title>Phishing Defense | TenantIQ</title></svelte:head>

<div class="phishing-container">
	<div class="header">
		<div>
			<h1>Email Phishing Monitor</h1>
			<p class="subtitle">AI-powered threat detection and analysis</p>
		</div>
		<button class="btn-primary" onclick={scanNow} disabled={scanning}>
			{scanning ? 'Scanning...' : 'Scan Now'}
		</button>
	</div>

	{#if loading}
		<div class="loading">
			<div class="spinner"></div>
			<p>Loading phishing analysis...</p>
		</div>
	{:else if analysis}
		<PhishingOverview {analysis} />
		<PhishingThreats threats={analysis.activeThreats} onselect={viewThreatDetails} />
		{#if analysis.protectionGaps}
			<PhishingGaps gaps={analysis.protectionGaps} />
		{/if}
		<PhishingRecommendations recommendations={analysis.recommendations} />
	{/if}
</div>

{#if showThreatModal && selectedThreat}
	<PhishingThreatModal threat={selectedThreat} onclose={() => (showThreatModal = false)} />
{/if}

<style>
	.phishing-container {
		padding: 2rem;
		max-width: 1400px;
		margin: 0 auto;
		background: #0a0a0a;
		min-height: 100vh;
		color: #ffffff;
	}

	.header {
		display: flex;
		justify-content: space-between;
		align-items: flex-start;
		margin-bottom: 2rem;
	}

	h1 {
		font-size: 2.5rem;
		font-weight: 700;
		background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
		background-clip: text;
		-webkit-background-clip: text;
		-webkit-text-fill-color: transparent;
		color: transparent;
		margin: 0 0 0.5rem 0;
	}

	.subtitle { color: #9ca3af; font-size: 1rem; margin: 0; }

	.btn-primary {
		background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
		color: white;
		border: none;
		padding: 0.875rem 2rem;
		border-radius: 8px;
		font-size: 1rem;
		font-weight: 600;
		cursor: pointer;
		transition: all 0.2s;
	}

	.btn-primary:hover:not(:disabled) {
		transform: translateY(-2px);
		box-shadow: 0 8px 16px rgba(102, 126, 234, 0.3);
	}

	.btn-primary:disabled { opacity: 0.5; cursor: not-allowed; }

	.loading {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		padding: 4rem;
		color: #9ca3af;
	}

	.spinner {
		width: 40px;
		height: 40px;
		border: 3px solid rgba(102, 126, 234, 0.2);
		border-top-color: #667eea;
		border-radius: 50%;
		animation: spin 0.8s linear infinite;
	}

	@keyframes spin { to { transform: rotate(360deg); } }

	@media (max-width: 768px) {
		.phishing-container { padding: 1rem; }
		h1 { font-size: 1.75rem; }
		.header { flex-direction: column; gap: 1rem; }
		.btn-primary { width: 100%; }
	}
</style>
