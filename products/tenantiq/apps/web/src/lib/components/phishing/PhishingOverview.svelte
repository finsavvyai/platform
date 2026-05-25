<script lang="ts">
	import type { PhishingAnalysis } from './phishing-types';
	import { getThreatLevelColor } from './phishing-utils';

	let { analysis }: { analysis: PhishingAnalysis } = $props();
</script>

<div class="overview-grid">
	<div class="overview-card threat-level">
		<div class="card-header">
			<span class="card-icon">🛡️</span>
			<h3>Threat Level</h3>
		</div>
		<div
			class="threat-badge"
			style="background: {getThreatLevelColor(analysis.threatLevel)}22; border-color: {getThreatLevelColor(analysis.threatLevel)};"
		>
			<span style="color: {getThreatLevelColor(analysis.threatLevel)};">
				{analysis.threatLevel.toUpperCase()}
			</span>
		</div>
		<p class="card-detail">{analysis.scannedEmails} emails scanned</p>
	</div>

	<div class="overview-card phishing-score">
		<div class="card-header">
			<span class="card-icon">📊</span>
			<h3>Phishing Score</h3>
		</div>
		<div class="score-display" class:danger={analysis.phishingScore >= 70}>
			<div class="score-value">{analysis.phishingScore}</div>
			<div class="score-label">/100</div>
		</div>
		<div class="score-bar">
			<div
				class="score-fill"
				style="width: {analysis.phishingScore}%; background: {analysis.phishingScore >= 70
					? '#ef4444'
					: analysis.phishingScore >= 40
						? '#f59e0b'
						: '#22c55e'};"
			></div>
		</div>
	</div>

	<div class="overview-card active-threats">
		<div class="card-header">
			<span class="card-icon">⚠️</span>
			<h3>Active Threats</h3>
		</div>
		<div class="threat-count">{analysis.activeThreats.length}</div>
		<p class="card-detail">Detected in {analysis.timeRange}</p>
	</div>

	<div class="overview-card protection-gaps">
		<div class="card-header">
			<span class="card-icon">🔓</span>
			<h3>Protection Gaps</h3>
		</div>
		<div class="gap-count">{analysis.protectionGaps?.length || 0}</div>
		<p class="card-detail">Security vulnerabilities</p>
	</div>
</div>

<style>
	.overview-grid {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
		gap: 1.5rem;
		margin-bottom: 2rem;
	}

	.overview-card {
		background: rgba(255, 255, 255, 0.03);
		border: 1px solid rgba(255, 255, 255, 0.1);
		border-radius: 16px;
		padding: 1.5rem;
		backdrop-filter: blur(10px);
	}

	.card-header {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		margin-bottom: 1rem;
	}

	.card-icon { font-size: 1.5rem; }

	.card-header h3 {
		margin: 0;
		font-size: 1rem;
		font-weight: 600;
		color: #9ca3af;
	}

	.threat-badge {
		display: inline-block;
		padding: 0.75rem 1.5rem;
		border-radius: 12px;
		font-weight: 700;
		font-size: 1.25rem;
		border: 2px solid;
		margin-bottom: 0.5rem;
	}

	.card-detail {
		color: #6b7280;
		font-size: 0.875rem;
		margin: 0;
	}

	.score-display {
		display: flex;
		align-items: baseline;
		gap: 0.5rem;
		margin-bottom: 1rem;
	}

	.score-value {
		font-size: 3rem;
		font-weight: 700;
		color: #22c55e;
	}

	.score-display.danger .score-value { color: #ef4444; }
	.score-label { font-size: 1.5rem; color: #6b7280; }

	.score-bar {
		width: 100%;
		height: 8px;
		background: rgba(255, 255, 255, 0.1);
		border-radius: 4px;
		overflow: hidden;
	}

	.score-fill {
		height: 100%;
		border-radius: 4px;
		transition: width 0.5s ease;
	}

	.threat-count,
	.gap-count {
		font-size: 3rem;
		font-weight: 700;
		color: #ef4444;
		margin-bottom: 0.5rem;
	}

	@media (max-width: 768px) {
		.overview-grid { grid-template-columns: 1fr; }
	}
</style>
