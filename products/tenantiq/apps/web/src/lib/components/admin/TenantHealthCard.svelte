<script lang="ts">
	/**
	 * TenantHealthCard — per-tenant health status row.
	 */
	import { formatRelativeTime } from '$utils/format';
	import { CheckCircle, XCircle, AlertTriangle, Clock, Users, Shield } from 'lucide-svelte';

	interface TenantHealth {
		id: string;
		display_name: string;
		domain: string;
		status: string;
		last_sync_at: number | null;
		org_name: string;
		billing_plan: string;
		user_count: number;
		alert_count: number;
		last_sync_status: string | null;
	}

	let { tenant }: { tenant: TenantHealth } = $props();

	const statusColor = $derived.by(() => {
		if (tenant.status === 'suspended') return 'text-[var(--color-danger)]';
		if (tenant.status === 'disconnected') return 'text-[var(--color-text-tertiary)]';
		return 'text-[var(--color-success)]';
	});

	const SyncIconCmp = $derived.by(() => {
		if (!tenant.last_sync_status) return Clock;
		if (tenant.last_sync_status === 'completed') return CheckCircle;
		if (tenant.last_sync_status === 'failed') return XCircle;
		return Clock;
	});

	const syncColor = $derived.by(() => {
		if (!tenant.last_sync_status) return 'text-[var(--color-text-tertiary)]';
		if (tenant.last_sync_status === 'completed') return 'text-[var(--color-success)]';
		if (tenant.last_sync_status === 'failed') return 'text-[var(--color-danger)]';
		return 'text-[var(--color-primary)]';
	});
</script>

<div class="flex items-center gap-4 px-6 py-4 hover:bg-[var(--color-bg-secondary)] transition-colors border-b border-[var(--color-border)] last:border-b-0">
	<div class="flex-1 min-w-0">
		<div class="flex items-center gap-2">
			<h4 class="text-sm font-semibold text-[var(--color-text)] truncate">{tenant.display_name}</h4>
			<span class="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium {statusColor}">
				{tenant.status}
			</span>
		</div>
		<p class="text-xs text-[var(--color-text-secondary)] mt-0.5">
			{tenant.domain ?? 'No domain'} &middot; {tenant.org_name ?? 'Unknown org'} &middot; {tenant.billing_plan ?? 'free'}
		</p>
	</div>

	<div class="flex items-center gap-6 shrink-0 text-sm">
		<div class="flex items-center gap-1.5" title="Users">
			<Users size={14} class="text-[var(--color-text-tertiary)]" />
			<span class="text-[var(--color-text)]">{tenant.user_count}</span>
		</div>

		<div class="flex items-center gap-1.5" title="Active alerts">
			<Shield size={14} class={tenant.alert_count > 0 ? 'text-[var(--color-danger)]' : 'text-[var(--color-text-tertiary)]'} />
			<span class="text-[var(--color-text)]">{tenant.alert_count}</span>
		</div>

		<div class="flex items-center gap-1.5" title="Last sync: {tenant.last_sync_status ?? 'never'}">
			<SyncIconCmp size={14} class={syncColor} />
			<span class="text-xs text-[var(--color-text-secondary)]">
				{tenant.last_sync_at ? formatRelativeTime(tenant.last_sync_at) : 'Never synced'}
			</span>
		</div>
	</div>
</div>
