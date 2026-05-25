<script lang="ts">
	import { getPriorityColor } from './phishing-utils';

	let { recommendations }: {
		recommendations: Array<{
			priority: 'high' | 'medium' | 'low';
			action: string;
			impact: string;
		}>;
	} = $props();
</script>

<div class="section">
	<h2 class="section-title">Security Recommendations</h2>
	<div class="recommendations-grid">
		{#each recommendations as rec}
			<div class="recommendation-card">
				<div class="rec-header">
					<span
						class="priority-badge"
						style="background: {getPriorityColor(rec.priority)}22; color: {getPriorityColor(rec.priority)}; border-color: {getPriorityColor(rec.priority)};"
					>
						{rec.priority} priority
					</span>
				</div>
				<h4 class="rec-action">{rec.action}</h4>
				<p class="rec-impact">
					<span class="impact-icon">💡</span>
					{rec.impact}
				</p>
			</div>
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

	.recommendations-grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
		gap: 1rem;
	}

	.recommendation-card {
		background: rgba(255, 255, 255, 0.03);
		border: 1px solid rgba(255, 255, 255, 0.1);
		border-radius: 12px;
		padding: 1.25rem;
	}

	.rec-header { margin-bottom: 0.75rem; }

	.priority-badge {
		display: inline-block;
		padding: 0.25rem 0.75rem;
		border-radius: 6px;
		font-size: 0.75rem;
		font-weight: 600;
		border: 1px solid;
		text-transform: uppercase;
	}

	.rec-action {
		margin: 0 0 0.75rem 0;
		font-size: 1rem;
		font-weight: 600;
		color: #ffffff;
	}

	.rec-impact {
		display: flex;
		align-items: flex-start;
		gap: 0.5rem;
		margin: 0;
		color: #9ca3af;
		font-size: 0.875rem;
		line-height: 1.5;
	}

	.impact-icon { font-size: 1rem; }

	@media (max-width: 768px) {
		.recommendations-grid { grid-template-columns: 1fr; }
	}
</style>
