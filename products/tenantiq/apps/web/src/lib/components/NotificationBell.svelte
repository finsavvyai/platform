<script lang="ts">
	import { Bell, Check, RefreshCw, AlertTriangle, Shield, Database, Info } from 'lucide-svelte';
	import { untrack } from 'svelte';
	import { tenant } from '$stores/tenant';
	import { api } from '$lib/api/client';

	interface Notification {
		id: string;
		type: 'sync' | 'alert' | 'cis' | 'security' | 'info';
		title: string;
		message: string;
		timestamp: string;
		read: boolean;
	}

	let notifications = $state<Notification[]>([]);
	let open = $state(false);
	let loading = $state(false);

	const unreadCount = $derived(notifications.filter(n => !n.read).length);

	const iconMap: Record<string, typeof Bell> = {
		sync: RefreshCw,
		alert: AlertTriangle,
		cis: Shield,
		security: Shield,
		info: Info,
	};

	function relativeTime(ts: string): string {
		const diff = Date.now() - new Date(ts).getTime();
		const mins = Math.floor(diff / 60000);
		if (mins < 1) return 'just now';
		if (mins < 60) return `${mins}m ago`;
		const hrs = Math.floor(mins / 60);
		if (hrs < 24) return `${hrs}h ago`;
		const days = Math.floor(hrs / 24);
		return `${days}d ago`;
	}

	async function fetchNotifications() {
		const tid = $tenant.currentTenantId;
		if (!tid) return;
		try {
			const res = await api.get<{ notifications: Notification[] }>(
				`/tenants/${tid}/notifications`
			);
			notifications = res.notifications;
		} catch { /* silent */ }
	}

	async function markAllRead() {
		const tid = $tenant.currentTenantId;
		if (!tid || unreadCount === 0) return;
		loading = true;
		try {
			await api.post(`/tenants/${tid}/notifications/read-all`);
			for (const n of notifications) n.read = true;
		} catch { /* silent */ }
		loading = false;
	}

	async function markRead(id: string) {
		const tid = $tenant.currentTenantId;
		if (!tid) return;
		const n = notifications.find(x => x.id === id);
		if (!n || n.read) return;
		n.read = true;
		try {
			await api.post(`/tenants/${tid}/notifications/${id}/read`);
		} catch { /* silent */ }
	}

	function togglePanel() {
		open = !open;
		if (open) fetchNotifications();
	}

	function handleClickOutside(e: MouseEvent) {
		const target = e.target as HTMLElement;
		if (!target.closest('.notification-container')) open = false;
	}

	// Fetch on mount and poll every 60s
	$effect(() => {
		if ($tenant.currentTenantId) untrack(() => fetchNotifications());
	});

	$effect(() => {
		const interval = setInterval(fetchNotifications, 60000);
		return () => clearInterval(interval);
	});

	$effect(() => {
		if (open) {
			document.addEventListener('click', handleClickOutside);
			return () => document.removeEventListener('click', handleClickOutside);
		}
	});
</script>

<div class="notification-container relative">
	<button
		type="button"
		onclick={togglePanel}
		class="relative flex h-8 w-8 items-center justify-center rounded-lg text-[var(--color-text-secondary)] transition-colors hover:bg-[var(--color-bg-secondary)] hover:text-[var(--color-text)]"
		aria-label="Notifications"
	>
		<Bell size={16} />
		{#if unreadCount > 0}
			<span class="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-[var(--color-danger)] px-1 text-[10px] font-bold text-white">
				{unreadCount > 9 ? '9+' : unreadCount}
			</span>
		{/if}
	</button>

	{#if open}
		<div class="absolute right-0 top-10 z-50 w-80 max-w-[90vw] animate-fade-up rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] shadow-lg sm:left-0 sm:right-auto">
			<div class="flex items-center justify-between border-b border-[var(--color-border)] px-4 py-3">
				<h3 class="text-sm font-semibold text-[var(--color-text)]">Notifications</h3>
				{#if unreadCount > 0}
					<button
						type="button"
						onclick={markAllRead}
						disabled={loading}
						class="flex items-center gap-1 text-[11px] font-medium text-[var(--color-primary)] hover:underline disabled:opacity-50"
					>
						<Check size={12} />
						Mark all read
					</button>
				{/if}
			</div>

			<div class="max-h-80 overflow-y-auto">
				{#if notifications.length === 0}
					<div class="px-4 py-8 text-center">
						<Bell size={24} class="mx-auto mb-2 text-[var(--color-text-tertiary)]" />
						<p class="text-xs text-[var(--color-text-tertiary)]">No notifications yet</p>
					</div>
				{:else}
					{#each notifications as n (n.id)}
						{@const Icon = iconMap[n.type] ?? Info}
						<button
							type="button"
							onclick={() => markRead(n.id)}
							class="flex w-full items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-[var(--color-bg-secondary)] {n.read ? 'opacity-60' : ''}"
						>
							<div class="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full {n.read ? 'bg-[var(--color-bg-secondary)]' : 'bg-[var(--color-primary)]/10'}">
								<Icon size={14} class={n.read ? 'text-[var(--color-text-tertiary)]' : 'text-[var(--color-primary)]'} />
							</div>
							<div class="min-w-0 flex-1">
								<div class="flex items-center gap-2">
									<p class="truncate text-xs font-medium text-[var(--color-text)] {n.read ? '' : 'font-semibold'}">{n.title}</p>
									{#if !n.read}
										<span class="h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--color-primary)]"></span>
									{/if}
								</div>
								<p class="mt-0.5 text-[11px] leading-relaxed text-[var(--color-text-secondary)]">{n.message}</p>
								<p class="mt-1 text-[10px] text-[var(--color-text-tertiary)]">{relativeTime(n.timestamp)}</p>
							</div>
						</button>
					{/each}
				{/if}
			</div>
		</div>
	{/if}
</div>
