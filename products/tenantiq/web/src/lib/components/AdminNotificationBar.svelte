<script lang="ts">
	/**
	 * AdminNotificationBar — displays admin broadcast notifications.
	 * Fetches unread notifications on mount. Dismissible (marks as read via API).
	 */
	import { auth } from '$stores/auth';
	import { onMount } from 'svelte';
	import { Info, AlertTriangle, Star, X } from 'lucide-svelte';

	interface AdminNotification {
		id: string;
		title: string;
		message: string;
		type: 'info' | 'warning' | 'promotion' | 'maintenance';
	}

	let notifications = $state<AdminNotification[]>([]);

	const typeConfig: Record<string, { bg: string; border: string; text: string; icon: typeof Info }> = {
		info: { bg: 'bg-blue-500/10', border: 'border-blue-500/30', text: 'text-blue-700 dark:text-blue-300', icon: Info },
		warning: { bg: 'bg-amber-500/10', border: 'border-amber-500/30', text: 'text-amber-700 dark:text-amber-300', icon: AlertTriangle },
		promotion: { bg: 'bg-green-500/10', border: 'border-green-500/30', text: 'text-green-700 dark:text-green-300', icon: Star },
		maintenance: { bg: 'bg-orange-500/10', border: 'border-orange-500/30', text: 'text-orange-700 dark:text-orange-300', icon: AlertTriangle },
	};

	onMount(async () => {
		const fetches: Promise<void>[] = [];

		// Fetch user-specific notifications (requires auth)
		if ($auth.user) {
			fetches.push(
				fetch('https://api.tenantiq.app/platform/admin/notifications/mine', {
					credentials: 'include',
				}).then(async (res) => {
					if (res.ok) {
						const data = await res.json();
						notifications = [...notifications, ...(data.notifications ?? [])];
					}
				}).catch(() => {})
			);
		}

		// Fetch public announcements (no auth needed)
		fetches.push(
			fetch('https://api.tenantiq.app/platform/announcements/active')
				.then(async (res) => {
					if (res.ok) {
						const data = await res.json();
						const mapped = (data.announcements ?? []).map((a: any) => ({
							id: `ann-${a.id}`, title: a.title, message: a.message, type: a.type,
						}));
						notifications = [...notifications, ...mapped];
					}
				}).catch(() => {})
		);

		await Promise.allSettled(fetches);
	});

	async function dismiss(id: string) {
		notifications = notifications.filter((n) => n.id !== id);
		try {
			await fetch(`https://api.tenantiq.app/platform/admin/notifications/mine/${id}/read`, {
				method: 'POST',
				credentials: 'include',
			});
		} catch { /* silent */ }
	}
</script>

{#each notifications as notif (notif.id)}
	{@const cfg = typeConfig[notif.type] ?? typeConfig.info}
	{@const NotifIcon = cfg.icon}
	<div class="flex items-center gap-3 border-b {cfg.border} {cfg.bg} px-6 py-2.5" role="status">
		<NotifIcon size={16} class="shrink-0 {cfg.text}" />
		<div class="flex-1">
			<span class="text-sm font-semibold {cfg.text}">{notif.title}</span>
			<span class="ml-2 text-sm text-[var(--color-text-secondary)]">{notif.message}</span>
		</div>
		<button
			onclick={() => dismiss(notif.id)}
			class="text-[var(--color-text-tertiary)] transition-colors hover:text-[var(--color-text-secondary)]"
			aria-label="Dismiss notification"
		>
			<X size={16} />
		</button>
	</div>
{/each}
