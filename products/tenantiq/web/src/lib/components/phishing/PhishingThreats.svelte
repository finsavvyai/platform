<script lang="ts">
	import type { Threat } from './phishing-types';
	import { formatTimeAgo } from './phishing-utils';

	let { threats, onselect }: { threats: Threat[]; onselect: (t: Threat) => void } = $props();
</script>

<div class="section">
	<h2 class="section-title">Active Threats</h2>
	<div class="threats-grid">
		{#each threats as threat}
			<button type="button" class="threat-card" onclick={() => onselect(threat)}>
				<div class="threat-header">
					<div>
						<div class="threat-type">{threat.threatType}</div>
						<div class="threat-time">{formatTimeAgo(threat.receivedAt)}</div>
					</div>
					<div class="confidence-badge" class:high={threat.confidence >= 90}>
						{threat.confidence}% confident
					</div>
				</div>
				<div class="threat-subject">{threat.subject}</div>
				<div class="threat-sender">
					<span class="sender-icon">📧</span>
					{threat.sender}
				</div>
				<div class="threat-indicators">
					{#each threat.indicators.slice(0, 2) as indicator}
						<span class="indicator-tag">{indicator}</span>
					{/each}
					{#if threat.indicators.length > 2}
						<span class="indicator-more">+{threat.indicators.length - 2} more</span>
					{/if}
				</div>
			</button>
		{/each}
	</div>
</div>

<style>
	.section { margin-bottom: 2rem; }

	.section-title {
		font-size: 1.5rem;
		font-weight: 700;
		color: #ffffff;
		margin: 0 0 1rem 0;
	}

	.threats-grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(350px, 1fr));
		gap: 1rem;
	}

	.threat-card {
		background: rgba(255, 255, 255, 0.03);
		border: 1px solid rgba(255, 255, 255, 0.1);
		border-radius: 12px;
		padding: 1.25rem;
		cursor: pointer;
		transition: all 0.2s;
		text-align: left;
		font: inherit;
		color: inherit;
		display: block;
		width: 100%;
	}

	.threat-card:hover {
		border-color: #667eea;
		transform: translateY(-2px);
		box-shadow: 0 8px 16px rgba(102, 126, 234, 0.2);
	}

	.threat-header {
		display: flex;
		justify-content: space-between;
		align-items: flex-start;
		margin-bottom: 0.75rem;
	}

	.threat-type {
		font-weight: 600;
		color: #ef4444;
		font-size: 0.875rem;
		margin-bottom: 0.25rem;
	}

	.threat-time { font-size: 0.75rem; color: #6b7280; }

	.confidence-badge {
		background: rgba(251, 191, 36, 0.2);
		color: #fbbf24;
		padding: 0.25rem 0.75rem;
		border-radius: 6px;
		font-size: 0.75rem;
		font-weight: 600;
		border: 1px solid #fbbf24;
	}

	.confidence-badge.high {
		background: rgba(239, 68, 68, 0.2);
		color: #ef4444;
		border-color: #ef4444;
	}

	.threat-subject {
		font-weight: 600;
		color: #ffffff;
		margin-bottom: 0.5rem;
		line-height: 1.4;
	}

	.threat-sender {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		color: #9ca3af;
		font-size: 0.875rem;
		margin-bottom: 0.75rem;
	}

	.sender-icon { font-size: 1rem; }

	.threat-indicators {
		display: flex;
		flex-wrap: wrap;
		gap: 0.5rem;
	}

	.indicator-tag {
		background: rgba(255, 255, 255, 0.05);
		border: 1px solid rgba(255, 255, 255, 0.1);
		padding: 0.25rem 0.75rem;
		border-radius: 6px;
		font-size: 0.75rem;
		color: #d1d5db;
	}

	.indicator-more {
		color: #6b7280;
		font-size: 0.75rem;
		padding: 0.25rem 0.5rem;
	}

	@media (max-width: 768px) {
		.threats-grid { grid-template-columns: 1fr; }
	}
</style>
