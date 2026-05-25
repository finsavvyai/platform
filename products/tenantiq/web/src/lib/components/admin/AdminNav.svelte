<script lang="ts">
	/**
	 * Admin Sub-Navigation
	 *
	 * Tab-style navigation for admin panel sub-pages.
	 */
	import { page } from '$app/stores';
	import {
		LayoutDashboard,
		Server,
		RefreshCw,
		BarChart3,
		AlertTriangle,
		FileText,
		Flag,
		DollarSign,
		Megaphone
	} from 'lucide-svelte';

	const navItems = [
		{ href: '/platform/admin', label: 'Overview', icon: LayoutDashboard },
		{ href: '/platform/admin/tenants', label: 'Tenants', icon: Server },
		{ href: '/platform/admin/sync', label: 'Sync Jobs', icon: RefreshCw },
		{ href: '/platform/admin/metrics', label: 'Metrics', icon: BarChart3 },
		{ href: '/platform/admin/alerts', label: 'Alerts', icon: AlertTriangle },
		{ href: '/platform/admin/audit', label: 'Audit Log', icon: FileText },
		{ href: '/platform/admin/revenue', label: 'Revenue', icon: DollarSign },
		{ href: '/platform/admin/announcements', label: 'Announcements', icon: Megaphone },
		{ href: '/platform/admin/feature-flags', label: 'Flags', icon: Flag },
	];

	const currentPath = $derived($page.url.pathname);
</script>

<nav class="flex gap-1 overflow-x-auto border-b border-[var(--color-border)] bg-[var(--color-surface)] px-4">
	{#each navItems as item}
		{@const isActive = currentPath === item.href || (item.href !== '/platform/admin' && currentPath.startsWith(item.href))}
		<a
			href={item.href}
			class="flex items-center gap-2 whitespace-nowrap border-b-2 px-4 py-3 text-sm font-medium transition-colors
				{isActive
					? 'border-[var(--color-primary)] text-[var(--color-primary)]'
					: 'border-transparent text-[var(--color-text-secondary)] hover:text-[var(--color-text)] hover:border-[var(--color-border)]'}"
		>
			<item.icon size={16} />
			{item.label}
		</a>
	{/each}
</nav>
