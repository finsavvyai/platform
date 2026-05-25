<script lang="ts">
	import { Check, X, Minus, Zap } from 'lucide-svelte';
	import type { CompetitorRow, Status } from './vendors';

	interface Props {
		themLabel: string;
		rows: CompetitorRow[];
	}
	let { themLabel, rows }: Props = $props();

	const statusIcon = { yes: Check, no: X, partial: Minus, unique: Zap } as const;
	const statusClass: Record<Status, string> = {
		yes: 'cell-yes', no: 'cell-no', partial: 'cell-partial', unique: 'cell-unique',
	};
	const statusLabel: Record<Status, string> = {
		yes: 'Yes', no: 'No', partial: 'Partial', unique: 'TenantIQ only',
	};
</script>

<div class="cmp-table">
	<div class="cmp-row cmp-row-head">
		<span>Capability</span>
		<span>TenantIQ</span>
		<span>{themLabel}</span>
	</div>
	{#snippet cell(status: Status, note: string | undefined)}
		{@const Icon = statusIcon[status]}
		<div class="cell {statusClass[status]}">
			<span class="status-pill">
				<Icon size={14} />
				{statusLabel[status]}
			</span>
			{#if note}<small>{note}</small>{/if}
		</div>
	{/snippet}
	{#each rows as r (r.feature)}
		<div class="cmp-row">
			<div class="feature">
				<strong>{r.feature}</strong>
				{#if r.detail}<p class="feature-detail">{r.detail}</p>{/if}
			</div>
			{@render cell(r.tenantiq.status, r.tenantiq.note)}
			{@render cell(r.them.status, r.them.note)}
		</div>
	{/each}
</div>

<style>
	.cmp-table { display: grid; gap: 0; border: 1px solid var(--color-border); border-radius: 14px; overflow: hidden; background: var(--color-surface); }
	.cmp-row { display: grid; grid-template-columns: 2fr 1fr 1fr; align-items: stretch; border-top: 1px solid var(--color-border); }
	.cmp-row:first-child { border-top: none; }
	.cmp-row-head { background: var(--color-bg-tertiary, rgba(255,255,255,0.03)); font-weight: 600; font-size: 0.8125rem; color: var(--color-text-secondary); text-transform: uppercase; letter-spacing: 0.04em; }
	.cmp-row-head span { padding: 0.875rem 1rem; }
	.feature { padding: 1rem; }
	.feature strong { font-size: 0.9375rem; color: var(--color-text); }
	.feature-detail { font-size: 0.8125rem; color: var(--color-text-secondary); margin: 0.25rem 0 0; line-height: 1.5; }
	.cell { padding: 1rem; display: flex; flex-direction: column; gap: 0.375rem; align-items: flex-start; border-left: 1px solid var(--color-border); }
	.cell small { font-size: 0.75rem; color: var(--color-text-tertiary); }
	.status-pill { display: inline-flex; align-items: center; gap: 0.375rem; padding: 0.25rem 0.625rem; border-radius: 999px; font-size: 0.75rem; font-weight: 600; }
	.cell-yes .status-pill { background: color-mix(in srgb, var(--color-success) 12%, transparent); color: var(--color-success); }
	.cell-no .status-pill { background: var(--color-bg-tertiary, rgba(255,255,255,0.04)); color: var(--color-text-tertiary); }
	.cell-partial .status-pill { background: color-mix(in srgb, var(--color-warning) 12%, transparent); color: var(--color-warning); }
	.cell-unique .status-pill { background: color-mix(in srgb, var(--color-primary) 12%, transparent); color: var(--color-primary); }
	@media (max-width: 720px) { .cmp-row { grid-template-columns: 1fr; } .cell { border-left: none; border-top: 1px solid var(--color-border); } }
</style>
