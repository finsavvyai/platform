<script lang="ts">
	interface Finding {
		category: string;
		severity: string;
		title: string;
		description: string;
		recommendation: string;
	}

	interface Props {
		findings: Finding[];
	}

	let { findings }: Props = $props();

	let expandedIdx = $state<number | null>(null);

	function toggle(i: number) {
		expandedIdx = expandedIdx === i ? null : i;
	}

	const criticalCount = $derived(findings.filter(f => f.severity === 'critical').length);
	const warningCount = $derived(findings.filter(f => f.severity === 'warning').length);
	const infoCount = $derived(findings.filter(f => f.severity === 'info').length);
</script>

<div class="findings-panel">
	<div class="findings-header">
		<div class="findings-title-row">
			<h3 class="findings-title">Findings</h3>
			<div class="findings-counts">
				{#if criticalCount > 0}
					<span class="count-pill critical">{criticalCount} critical</span>
				{/if}
				{#if warningCount > 0}
					<span class="count-pill warning">{warningCount} warning</span>
				{/if}
				{#if infoCount > 0}
					<span class="count-pill info">{infoCount} info</span>
				{/if}
			</div>
		</div>
	</div>

	{#if findings.length === 0}
		<div class="findings-empty">
			<div class="empty-icon">
				<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
			</div>
			<p>No issues found — your site is well-optimized for AI agents.</p>
		</div>
	{:else}
		<div class="findings-list">
			{#each findings as finding, i}
				<button
					type="button"
					class="finding-row"
					class:expanded={expandedIdx === i}
					onclick={() => toggle(i)}
					aria-expanded={expandedIdx === i}
				>
					<div class="finding-indicator" class:sev-critical={finding.severity === 'critical'} class:sev-warning={finding.severity === 'warning'} class:sev-info={finding.severity === 'info'}></div>
					<div class="finding-content">
						<div class="finding-main">
							<span class="finding-category">{finding.category.replace('_', ' ')}</span>
							<p class="finding-title">{finding.title}</p>
						</div>
						<svg xmlns="http://www.w3.org/2000/svg" class="finding-chevron" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg>
					</div>
					{#if expandedIdx === i}
						<div class="finding-detail" onclick={(e) => e.stopPropagation()} role="presentation">
							<p class="finding-desc">{finding.description}</p>
							<div class="finding-fix">
								<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z"/><path d="m9 12 2 2 4-4"/></svg>
								<span>{finding.recommendation}</span>
							</div>
						</div>
					{/if}
				</button>
			{/each}
		</div>
	{/if}
</div>

<style>
	.findings-panel {
		border-radius: var(--radius-xl);
		border: 1px solid var(--color-border);
		background: var(--color-surface);
		overflow: hidden;
	}
	.findings-header {
		padding: 16px 20px;
		border-bottom: 1px solid var(--color-border);
	}
	.findings-title-row {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 12px;
	}
	.findings-title {
		font-size: 13px;
		font-weight: 600;
		color: var(--color-text);
		letter-spacing: 0.01em;
	}
	.findings-counts {
		display: flex;
		gap: 6px;
	}
	.count-pill {
		font-size: 11px;
		font-weight: 600;
		padding: 2px 8px;
		border-radius: 100px;
		letter-spacing: 0.01em;
	}
	.count-pill.critical { background: rgba(255, 59, 48, 0.1); color: #FF3B30; }
	.count-pill.warning { background: rgba(255, 149, 0, 0.1); color: #FF9500; }
	.count-pill.info { background: rgba(0, 122, 255, 0.1); color: #007AFF; }

	.findings-empty {
		padding: 48px 20px;
		text-align: center;
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 12px;
	}
	.empty-icon {
		width: 48px;
		height: 48px;
		display: flex;
		align-items: center;
		justify-content: center;
		border-radius: 50%;
		background: rgba(52, 199, 89, 0.1);
		color: var(--color-success);
	}
	.findings-empty p {
		font-size: 13px;
		color: var(--color-text-secondary);
	}

	.findings-list {
		display: flex;
		flex-direction: column;
	}
	.finding-row {
		display: flex;
		flex-direction: column;
		width: 100%;
		text-align: left;
		cursor: pointer;
		background: none;
		border: none;
		border-bottom: 1px solid var(--color-border-subtle);
		padding: 0;
		transition: background var(--duration-fast) var(--easing);
	}
	.finding-row:last-child { border-bottom: none; }
	.finding-row:hover { background: var(--color-bg-secondary); }

	.finding-indicator {
		position: absolute;
		left: 0;
		top: 0;
		bottom: 0;
		width: 3px;
	}
	.finding-indicator.sev-critical { background: #FF3B30; }
	.finding-indicator.sev-warning { background: #FF9500; }
	.finding-indicator.sev-info { background: #007AFF; }

	.finding-content {
		position: relative;
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 14px 20px 14px 16px;
		gap: 12px;
	}
	.finding-main { flex: 1; min-width: 0; }

	.finding-category {
		font-size: 10px;
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.06em;
		color: var(--color-text-tertiary);
	}
	.finding-title {
		font-size: 13px;
		font-weight: 500;
		color: var(--color-text);
		margin-top: 2px;
		line-height: 1.4;
	}
	.finding-chevron {
		color: var(--color-text-tertiary);
		flex-shrink: 0;
		transition: transform var(--duration-fast) var(--easing);
	}
	.finding-row.expanded .finding-chevron {
		transform: rotate(180deg);
	}

	.finding-detail {
		padding: 0 20px 16px 16px;
		display: flex;
		flex-direction: column;
		gap: 10px;
		animation: fade-up 200ms ease-out;
	}
	.finding-desc {
		font-size: 12px;
		line-height: 1.6;
		color: var(--color-text-secondary);
	}
	.finding-fix {
		display: flex;
		align-items: flex-start;
		gap: 8px;
		padding: 10px 12px;
		border-radius: var(--radius-md);
		background: rgba(0, 122, 255, 0.05);
		font-size: 12px;
		line-height: 1.5;
		color: var(--color-primary);
	}
	.finding-fix svg {
		flex-shrink: 0;
		margin-top: 1px;
	}
</style>
