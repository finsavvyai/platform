<script lang="ts">
	import { Activity, AlertTriangle, Zap, GitBranch, ScanLine, Mail, RefreshCw } from 'lucide-svelte';

	interface Action {
		id: string; orgId: string | null; tenantId: string | null;
		agent: string; action: string; findingId: string | null;
		severity: string | null; status: string;
		metadata: Record<string, unknown> | null; at: string;
	}
	interface Props {
		row: Action;
		onApprove?: (id: string) => void;
		onAbort?: (id: string) => void;
		busy?: boolean;
	}
	let { row, onApprove, onAbort, busy = false }: Props = $props();
	const isPending = $derived(row.status === 'pending-approval');

	function fmtAge(iso: string): string {
		const ms = Date.now() - Date.parse(iso);
		if (isNaN(ms)) return '—';
		if (ms < 60_000) return `${Math.round(ms / 1000)}s ago`;
		if (ms < 3_600_000) return `${Math.round(ms / 60_000)}m ago`;
		if (ms < 86_400_000) return `${Math.round(ms / 3_600_000)}h ago`;
		return `${Math.round(ms / 86_400_000)}d ago`;
	}

	const sevColor: Record<string, string> = {
		critical: 'var(--color-danger)', high: 'var(--color-warning)',
		medium: 'var(--color-warning)', low: 'var(--color-info)', info: 'var(--color-text-secondary)',
	};
	const statusColor: Record<string, string> = {
		success: 'var(--color-success)', failed: 'var(--color-danger)', 'rolled-back': 'var(--color-warning)',
	};

	const Icon = $derived(
		row.action === 'scan' ? ScanLine
			: row.action === 'email-sent' ? Mail
			: row.action === 'fix-applied' ? Zap
			: row.action === 'drift-reverted' ? GitBranch
			: row.action === 'rollback' ? RefreshCw
			: row.action === 'finding-raised' ? AlertTriangle
			: Activity,
	);

	const subtitle = $derived(() => {
		const m = row.metadata ?? {};
		const parts: string[] = [];
		if (typeof m.domain === 'string') parts.push(`domain=${m.domain}`);
		if (typeof m.score === 'number') parts.push(`score=${m.score}`);
		if (typeof m.findings === 'number') parts.push(`${m.findings} findings`);
		if (typeof m.dryRun === 'boolean' && m.dryRun) parts.push('dry-run');
		if (typeof m.recipeId === 'string') parts.push(`recipe=${m.recipeId}`);
		if (typeof m.reason === 'string') parts.push(m.reason);
		return parts.join(' · ');
	});
</script>

<li class="row">
	<span class="icon" style="color: {row.severity ? (sevColor[row.severity] ?? 'var(--color-text-secondary)') : 'var(--color-primary)'};">
		<Icon size={16} />
	</span>
	<div class="body">
		<div class="head">
			<span class="agent">{row.agent}</span>
			<span class="action">{row.action.replace(/-/g, ' ')}</span>
			{#if row.severity}
				<span class="sev" style="background: color-mix(in srgb, {sevColor[row.severity]} 15%, transparent); color: {sevColor[row.severity]};">{row.severity}</span>
			{/if}
			<span class="status" style="color: {statusColor[row.status] ?? 'var(--color-text-secondary)'};">{row.status}</span>
			<span class="at">{fmtAge(row.at)}</span>
		</div>
		<p class="sub">
			{#if row.findingId}<code>{row.findingId}</code>{/if}
			{#if row.tenantId}<span class="tenant">tenant <code>{row.tenantId.slice(0, 12)}</code></span>{/if}
			{#if subtitle()}<span class="meta">{subtitle()}</span>{/if}
		</p>
		{#if isPending && (onApprove || onAbort)}
			<div class="actions">
				{#if onApprove}
					<button class="btn-approve" disabled={busy} onclick={() => onApprove?.(row.id)}>
						Approve & apply live
					</button>
				{/if}
				{#if onAbort}
					<button class="btn-abort" disabled={busy} onclick={() => onAbort?.(row.id)}>
						Abort
					</button>
				{/if}
			</div>
		{/if}
	</div>
</li>

<style>
	.row { display: grid; grid-template-columns: 22px 1fr; gap: 0.75rem; align-items: start; padding: 0.625rem 0.875rem; border-bottom: 1px solid var(--color-border); }
	.row:last-child { border-bottom: none; }
	.icon { padding-top: 2px; }
	.body { display: flex; flex-direction: column; gap: 0.125rem; min-width: 0; }
	.head { display: flex; gap: 0.5rem; align-items: center; flex-wrap: wrap; font-size: 0.8125rem; }
	.agent { font-family: 'SF Mono', Menlo, monospace; color: var(--color-primary); font-size: 0.75rem; }
	.action { color: var(--color-text); font-weight: 500; text-transform: capitalize; }
	.sev { font-size: 0.6875rem; padding: 0.125rem 0.375rem; border-radius: 0.25rem; font-weight: 600; text-transform: uppercase; }
	.status { font-size: 0.75rem; text-transform: uppercase; letter-spacing: 0.04em; }
	.at { margin-left: auto; font-size: 0.75rem; color: var(--color-text-tertiary); font-variant-numeric: tabular-nums; }
	.sub { font-size: 0.75rem; color: var(--color-text-secondary); margin: 0; display: flex; gap: 0.625rem; flex-wrap: wrap; }
	code { font-family: 'SF Mono', Menlo, monospace; font-size: 0.6875rem; background: var(--color-bg-tertiary); padding: 0.125rem 0.375rem; border-radius: 0.25rem; }
	.tenant code { color: var(--color-text); }
	.meta { color: var(--color-text-tertiary); }
	.actions { display: flex; gap: 0.5rem; margin-top: 0.5rem; }
	.btn-approve, .btn-abort { display: inline-flex; align-items: center; gap: 0.25rem; padding: 0.375rem 0.75rem; border-radius: 0.375rem; font-size: 0.75rem; font-weight: 500; cursor: pointer; min-height: 32px; border: 1px solid; transition: all 0.15s; }
	.btn-approve { background: color-mix(in srgb, var(--color-success) 12%, transparent); color: var(--color-success); border-color: color-mix(in srgb, var(--color-success) 30%, transparent); }
	.btn-approve:hover:not(:disabled) { background: color-mix(in srgb, var(--color-success) 20%, transparent); }
	.btn-abort { background: transparent; color: var(--color-danger); border-color: color-mix(in srgb, var(--color-danger) 30%, transparent); }
	.btn-abort:hover:not(:disabled) { background: color-mix(in srgb, var(--color-danger) 8%, transparent); }
	.btn-approve:disabled, .btn-abort:disabled { opacity: 0.6; cursor: not-allowed; }
</style>
