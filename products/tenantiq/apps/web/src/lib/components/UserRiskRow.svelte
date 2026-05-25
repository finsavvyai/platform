<script lang="ts">
	interface Anomaly { type: string; detail: string; timestamp: string; severity: string }
	interface UebaUser {
		name: string; email: string; role: string;
		riskScore: number; riskChange: number; riskLevel: string;
		anomalies: Anomaly[];
		baseline: { avgLoginTime: string; avgLocation: string; avgDataAccess: string };
		recentActivity: { logins: number; dataAccess: string; resourcesAccessed: number; failedLogins: number };
	}

	let { user }: { user: UebaUser } = $props();
	let expanded = $state(false);

	const colors: Record<string, string> = {
		critical: 'var(--color-danger)', high: 'var(--color-warning)',
		medium: 'var(--color-warning)', low: 'var(--color-success)',
	};
	const color = $derived(colors[user.riskLevel] ?? 'var(--color-text-tertiary)');

	function relTime(ts: string) {
		const h = Math.floor((Date.now() - new Date(ts).getTime()) / 3600000);
		if (h < 1) return 'Just now';
		return h < 24 ? `${h}h ago` : `${Math.floor(h / 24)}d ago`;
	}
</script>

<div class="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] transition-all duration-200 hover:border-[var(--color-primary)]/30">
	<button type="button" class="flex w-full items-center gap-5 p-4 text-left" onclick={() => (expanded = !expanded)}>
		<!-- Avatar -->
		<div class="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-semibold" style="background: {color}20; color: {color}">
			{user.name.charAt(0)}
		</div>

		<!-- Name + email -->
		<div class="min-w-0 flex-1">
			<p class="text-sm font-medium text-[var(--color-text)]">{user.name}</p>
			<p class="truncate text-xs text-[var(--color-text-secondary)]">{user.email}</p>
		</div>

		<!-- Role -->
		<span class="hidden w-32 text-xs text-[var(--color-text-tertiary)] lg:block">{user.role}</span>

		<!-- Risk score + bar -->
		<div class="w-28 shrink-0">
			<div class="flex items-center justify-between text-xs">
				<span class="font-bold" style="color: {color}">{user.riskScore}</span>
				<span class="rounded-full px-2 py-0.5 text-[10px] font-semibold capitalize" style="background: {color}20; color: {color}">{user.riskLevel}</span>
			</div>
			<div class="mt-1.5 h-1 w-full overflow-hidden rounded-full bg-[var(--color-border)]">
				<div class="h-full rounded-full transition-all" style="width: {user.riskScore}%; background: {color}"></div>
			</div>
		</div>

		<!-- Change -->
		<span class="w-10 text-right text-xs font-semibold shrink-0 {user.riskChange > 0 ? 'text-[var(--color-danger)]' : user.riskChange < 0 ? 'text-[var(--color-success)]' : 'text-[var(--color-text-tertiary)]'}">
			{user.riskChange > 0 ? '+' : ''}{user.riskChange}
		</span>

		<!-- Anomaly count -->
		<div class="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold {user.anomalies.length > 0 ? 'bg-[var(--color-danger)]/10 text-[var(--color-danger)]' : 'bg-[var(--color-bg)] text-[var(--color-text-tertiary)]'}">
			{user.anomalies.length}
		</div>

		<!-- Chevron -->
		<svg class="h-4 w-4 shrink-0 text-[var(--color-text-tertiary)] transition-transform {expanded ? 'rotate-180' : ''}" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path d="M19 9l-7 7-7-7"/></svg>
	</button>

	{#if expanded}
		<div class="space-y-4 border-t border-[var(--color-border)] px-4 pb-4 pt-4">
			{#if user.anomalies.length > 0}
				<div>
					<p class="mb-2 text-[11px] font-medium uppercase tracking-wider text-[var(--color-text-tertiary)]">Anomalies</p>
					<div class="space-y-2">
						{#each user.anomalies as a}
							<div class="flex items-start gap-3 rounded-lg bg-[var(--color-bg)] p-3">
								<span class="mt-1 h-2 w-2 shrink-0 rounded-full" style="background: {colors[a.severity]}"></span>
								<div class="flex-1">
									<p class="text-xs font-medium text-[var(--color-text)]">{a.type}</p>
									<p class="text-xs text-[var(--color-text-secondary)]">{a.detail}</p>
								</div>
								<span class="text-[11px] text-[var(--color-text-tertiary)]">{relTime(a.timestamp)}</span>
							</div>
						{/each}
					</div>
				</div>
			{/if}

			<div class="grid grid-cols-2 gap-6">
				<div>
					<p class="mb-2 text-[11px] font-medium uppercase tracking-wider text-[var(--color-text-tertiary)]">Baseline</p>
					<div class="space-y-1.5 text-xs">
						<p class="text-[var(--color-text-secondary)]">Login time: <span class="font-medium text-[var(--color-text)]">{user.baseline.avgLoginTime}</span></p>
						<p class="text-[var(--color-text-secondary)]">Location: <span class="font-medium text-[var(--color-text)]">{user.baseline.avgLocation}</span></p>
						<p class="text-[var(--color-text-secondary)]">Data access: <span class="font-medium text-[var(--color-text)]">{user.baseline.avgDataAccess}</span></p>
					</div>
				</div>
				<div>
					<p class="mb-2 text-[11px] font-medium uppercase tracking-wider text-[var(--color-text-tertiary)]">Recent Activity</p>
					<div class="space-y-1.5 text-xs">
						<p class="text-[var(--color-text-secondary)]">Logins: <span class="font-medium text-[var(--color-text)]">{user.recentActivity.logins}</span></p>
						<p class="text-[var(--color-text-secondary)]">Data: <span class="font-medium text-[var(--color-text)]">{user.recentActivity.dataAccess}</span></p>
						<p class="text-[var(--color-text-secondary)]">Resources: <span class="font-medium text-[var(--color-text)]">{user.recentActivity.resourcesAccessed}</span></p>
						<p class="text-[var(--color-text-secondary)]">Failed logins: <span class="font-medium {user.recentActivity.failedLogins > 0 ? 'text-[var(--color-danger)]' : 'text-[var(--color-text)]'}">{user.recentActivity.failedLogins}</span></p>
					</div>
				</div>
			</div>
		</div>
	{/if}
</div>
