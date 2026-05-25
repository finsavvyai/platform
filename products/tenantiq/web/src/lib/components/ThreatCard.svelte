<script lang="ts">
	import SeverityBadge from '$components/SeverityBadge.svelte';

	interface ThreatUser {
		name: string;
		email: string;
		role: string;
	}

	interface ThreatAction {
		label: string;
		href?: string;
		kind?: 'primary' | 'danger' | 'secondary';
	}

	interface Threat {
		id: string;
		severity: 'critical' | 'high' | 'medium' | 'low';
		type: string;
		title: string;
		description: string;
		user: ThreatUser | null;
		affectedUsers?: number;
		details: Record<string, unknown>;
		riskScore: number;
		timestamp: string;
		firstSeen?: string;
		lastSeen?: string;
		status: string;
		suggestedActions: string[];
		actions?: ThreatAction[];
		occurrences?: number;
		occurrenceDates?: string[];
	}

	interface Props {
		threat: Threat;
		onInvestigate?: (t: Threat) => void;
		onDisable?: (t: Threat) => void;
		onDismiss?: (t: Threat) => void;
		onAction?: (t: Threat, action: ThreatAction) => void;
	}

	let { threat, onInvestigate, onDisable, onDismiss, onAction }: Props = $props();
	let expanded = $state(false);

	const statusColors: Record<string, string> = {
		open: 'bg-[var(--color-danger)]/15 text-[var(--color-danger)]',
		active: 'bg-[var(--color-danger)]/15 text-[var(--color-danger)]',
		investigating: 'bg-[var(--color-warning)]/15 text-[var(--color-warning)]',
		resolved: 'bg-[var(--color-success)]/15 text-[var(--color-success)]',
	};

	const riskColor = (score: number) => {
		if (score >= 80) return 'var(--color-danger)';
		if (score >= 50) return 'var(--color-warning)';
		return 'var(--color-success)';
	};

	function relativeTime(ts: string) {
		const diff = Date.now() - new Date(ts).getTime();
		if (!isFinite(diff) || diff < 0) return '';
		const minutes = Math.floor(diff / 60000);
		if (minutes < 1) return 'just now';
		if (minutes < 60) return `${minutes}m ago`;
		const hours = Math.floor(minutes / 60);
		if (hours < 24) return `${hours}h ago`;
		return `${Math.floor(hours / 24)}d ago`;
	}

	const isMeaningful = (v: unknown) => {
		if (v === null || v === undefined) return false;
		const s = String(v).trim();
		return s !== '' && s.toLowerCase() !== 'n/a' && s.toLowerCase() !== 'unknown';
	};

	interface DetailEntry {
		label: string;
		value: string;
		items?: Array<Record<string, unknown>>;
	}

	function labelize(key: string): string {
		return key.replace(/([A-Z])/g, ' $1').replace(/_/g, ' ').replace(/^./, (s) => s.toUpperCase());
	}

	function detailEntries(details: Record<string, unknown>): DetailEntry[] {
		return Object.entries(details ?? {})
			.filter(([, v]) => isMeaningful(v))
			.map(([k, v]) => {
				// Arrays render as structured lists below; scalar values render inline.
				if (Array.isArray(v)) {
					const items = v.map((item) =>
						item && typeof item === 'object' ? (item as Record<string, unknown>) : { value: item },
					);
					return { label: labelize(k), value: `${items.length} item${items.length === 1 ? '' : 's'}`, items };
				}
				return { label: labelize(k), value: String(v) };
			});
	}

	const actionKindClass = (kind?: string) => {
		if (kind === 'danger') return 'bg-[var(--color-danger)]/10 text-[var(--color-danger)] hover:bg-[var(--color-danger)]/20';
		if (kind === 'primary') return 'bg-[var(--color-primary)] text-white hover:opacity-90';
		return 'bg-[var(--color-bg-secondary)] text-[var(--color-text-secondary)] hover:bg-[var(--color-border)]';
	};

	const hasUser = $derived(!!(threat.user && (threat.user.email || threat.user.name)));
	const details = $derived(detailEntries(threat.details));
	const occurrenceTags = $derived((threat.occurrenceDates ?? []).slice(0, 4).map(relativeTime).filter(Boolean));
	const occurrenceSummary = $derived(() => {
		const n = threat.occurrences ?? 0;
		if (n <= 1) return '';
		const first = threat.firstSeen ? relativeTime(threat.firstSeen) : '';
		return first ? `${n} times since ${first}` : `${n} occurrences`;
	});
</script>

<div class="w-full rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5 transition-all duration-200 hover:border-[var(--color-primary)]/30">
<button
	type="button"
	class="block w-full text-left"
	onclick={() => (expanded = !expanded)}
	aria-expanded={expanded}
>
	<div class="flex items-start justify-between gap-4">
		<div class="flex-1 space-y-2">
			<div class="flex flex-wrap items-center gap-2">
				<SeverityBadge severity={threat.severity} />
				<span class="rounded-full px-2 py-0.5 text-[11px] font-medium capitalize {statusColors[threat.status] ?? ''}">{threat.status}</span>
				<span class="text-xs text-[var(--color-text-tertiary)]">{relativeTime(threat.lastSeen ?? threat.timestamp)}</span>
				{#if threat.occurrences && threat.occurrences > 1}
					<span class="rounded-full bg-[var(--color-bg-tertiary)] px-2 py-0.5 text-[10px] font-medium text-[var(--color-text-secondary)]" title={occurrenceSummary()}>
						{threat.occurrences}×
					</span>
				{/if}
			</div>
			<h3 class="text-sm font-semibold text-[var(--color-text)]">{threat.title}</h3>
			{#if threat.description}
				<p class="text-xs text-[var(--color-text-secondary)]">{threat.description}</p>
			{/if}
			{#if hasUser}
				<div class="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-[var(--color-text-secondary)]">
					{#if threat.user?.name}<span>{threat.user.name}</span>{/if}
					{#if threat.user?.email}<span class="text-[var(--color-text-tertiary)]">{threat.user.email}</span>{/if}
				</div>
			{:else if threat.affectedUsers && threat.affectedUsers > 0}
				<div class="text-xs text-[var(--color-text-secondary)]">{threat.affectedUsers} affected resource{threat.affectedUsers === 1 ? '' : 's'}</div>
			{/if}
			{#if occurrenceTags.length > 1}
				<div class="flex flex-wrap items-center gap-1.5 pt-0.5">
					<span class="text-[10px] uppercase tracking-wider text-[var(--color-text-tertiary)]">Seen:</span>
					{#each occurrenceTags as tag}
						<span class="rounded bg-[var(--color-bg-secondary)] px-1.5 py-0.5 text-[10px] text-[var(--color-text-secondary)]">{tag}</span>
					{/each}
				</div>
			{/if}
		</div>
		<div class="flex flex-col items-end gap-1">
			<span class="text-xs text-[var(--color-text-tertiary)]">Risk</span>
			<span class="text-lg font-bold" style="color: {riskColor(threat.riskScore)}">{threat.riskScore}</span>
			<div class="h-1.5 w-16 overflow-hidden rounded-full bg-[var(--color-border)]">
				<div class="h-full rounded-full" style="width: {threat.riskScore}%; background: {riskColor(threat.riskScore)}"></div>
			</div>
		</div>
	</div>
</button>

	{#if expanded}
		<div class="mt-4 space-y-4 border-t border-[var(--color-border)] pt-4">
			{#if details.length > 0}
				{@const scalars = details.filter((d) => !d.items)}
				{@const lists = details.filter((d) => d.items)}
				{#if scalars.length > 0}
					<div class="grid grid-cols-2 gap-3 sm:grid-cols-3">
						{#each scalars as entry}
							<div>
								<p class="text-[11px] font-medium text-[var(--color-text-tertiary)]">{entry.label}</p>
								<p class="text-xs text-[var(--color-text)]">{entry.value}</p>
							</div>
						{/each}
					</div>
				{/if}
				{#each lists as entry}
					<div>
						<p class="mb-2 text-[11px] font-medium uppercase tracking-wider text-[var(--color-text-tertiary)]">
							{entry.label} ({entry.items?.length ?? 0})
						</p>
						<div class="divide-y divide-[var(--color-border)]/60 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-secondary)]/40">
							{#each entry.items ?? [] as item}
								{@const name = String((item as any).name ?? (item as any).displayName ?? (item as any).value ?? '—')}
								{@const email = (item as any).email ?? (item as any).userPrincipalName ?? ''}
								{@const extras = Object.entries(item as Record<string, unknown>).filter(([k]) => !['name', 'displayName', 'email', 'userPrincipalName', 'value'].includes(k))}
								<div class="flex flex-col gap-1 px-3 py-2 text-xs text-[var(--color-text)] sm:flex-row sm:items-start sm:justify-between">
									<div class="min-w-0 flex-1">
										<p class="truncate font-medium">{name}</p>
										{#if email}<p class="truncate text-[11px] text-[var(--color-text-secondary)]">{email}</p>{/if}
									</div>
									{#if extras.length > 0}
										<div class="flex flex-wrap justify-end gap-x-3 gap-y-0.5 text-[11px] text-[var(--color-text-tertiary)]">
											{#each extras as [k, v]}
												<span><span class="uppercase tracking-wide">{labelize(k)}:</span> {String(v)}</span>
											{/each}
										</div>
									{/if}
								</div>
							{/each}
						</div>
					</div>
				{/each}
			{/if}

			{#if threat.occurrences && threat.occurrences > 1}
				<div>
					<p class="mb-1 text-[11px] font-medium uppercase tracking-wider text-[var(--color-text-tertiary)]">Occurrences</p>
					<p class="text-xs text-[var(--color-text-secondary)]">{occurrenceSummary()}</p>
				</div>
			{/if}

			{#if threat.actions && threat.actions.length > 0}
				<div>
					<p class="mb-2 text-[11px] font-medium uppercase tracking-wider text-[var(--color-text-tertiary)]">Suggested Actions</p>
					<div class="flex flex-wrap gap-2">
						{#each threat.actions as action}
							<button
								type="button"
								class="rounded-lg px-3 py-1.5 text-xs font-medium transition-colors {actionKindClass(action.kind)}"
								onclick={(e) => { e.stopPropagation(); onAction?.(threat, action); }}
							>{action.label}</button>
						{/each}
					</div>
				</div>
			{/if}

			<div class="flex flex-wrap gap-2 border-t border-[var(--color-border)]/60 pt-3">
				<button type="button" class="rounded-lg bg-[var(--color-primary)] px-3 py-1.5 text-xs font-medium text-white" onclick={(e) => { e.stopPropagation(); onInvestigate?.(threat); }}>Investigate</button>
				{#if hasUser}
					<button type="button" class="rounded-lg bg-[var(--color-danger)]/10 px-3 py-1.5 text-xs font-medium text-[var(--color-danger)]" onclick={(e) => { e.stopPropagation(); onDisable?.(threat); }}>Disable account</button>
				{/if}
				<button type="button" class="rounded-lg bg-[var(--color-bg-secondary)] px-3 py-1.5 text-xs font-medium text-[var(--color-text-secondary)]" onclick={(e) => { e.stopPropagation(); onDismiss?.(threat); }}>Dismiss</button>
			</div>
		</div>
	{/if}
</div>
