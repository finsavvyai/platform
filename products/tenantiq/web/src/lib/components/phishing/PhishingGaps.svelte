<script lang="ts">
	import { getSeverityColor } from './phishing-utils';

	let { gaps }: {
		gaps: Array<{
			category: string;
			severity: 'critical' | 'high' | 'medium' | 'low';
			description: string;
		}>;
	} = $props();
</script>

{#if gaps.length > 0}
	<div class="section">
		<h2 class="section-title">Protection Gaps</h2>
		<div class="gaps-list">
			{#each gaps as gap}
				<div class="gap-card">
					<div class="gap-header">
						<span
							class="severity-badge"
							style="background: {getSeverityColor(gap.severity)}22; color: {getSeverityColor(gap.severity)}; border-color: {getSeverityColor(gap.severity)};"
						>
							{gap.severity}
						</span>
						<h4>{gap.category}</h4>
					</div>
					<p class="gap-description">{gap.description}</p>
				</div>
			{/each}
		</div>
	</div>
{/if}

<style>
	.section { margin-bottom: 2rem; }

	.section-title {
		font-size: 1.5rem;
		font-weight: 700;
		color: #ffffff;
		margin: 0 0 1rem 0;
	}

	.gaps-list {
		display: flex;
		flex-direction: column;
		gap: 1rem;
	}

	.gap-card {
		background: rgba(239, 68, 68, 0.05);
		border: 1px solid rgba(239, 68, 68, 0.2);
		border-radius: 12px;
		padding: 1.25rem;
	}

	.gap-header {
		display: flex;
		align-items: center;
		gap: 1rem;
		margin-bottom: 0.5rem;
	}

	.severity-badge {
		padding: 0.25rem 0.75rem;
		border-radius: 6px;
		font-size: 0.75rem;
		font-weight: 600;
		border: 1px solid;
		text-transform: uppercase;
	}

	.gap-header h4 {
		margin: 0;
		font-size: 1rem;
		color: #ffffff;
	}

	.gap-description {
		margin: 0;
		color: #d1d5db;
		font-size: 0.875rem;
	}
</style>
