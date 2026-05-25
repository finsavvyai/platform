<script lang="ts">
	import { untrack } from 'svelte';
	import { page } from '$app/stores';
	import { auth } from '$stores/auth';
	import { tenant } from '$stores/tenant';
	import { ONBOARD_ORG_URL } from '$lib/config';
	import { ChevronDown, X } from 'lucide-svelte';
	import NotificationBell from '$components/NotificationBell.svelte';
	import TenantSwitcher from '$components/TenantSwitcher.svelte';
	import SidebarFooter from '$components/sidebar/SidebarFooter.svelte';
	import { quickAccess, buildNavGroups, type NavGroup } from '$components/sidebar/nav-config';

	interface Props {
		mobileOpen?: boolean;
		onClose?: () => void;
	}

	let { mobileOpen = false, onClose }: Props = $props();

	function handleNavClick() { onClose?.(); }

	const isAdminUser = $derived(
		['admin', 'super_admin', 'platform_admin'].includes($auth.user?.role ?? '')
	);
	const navGroups: NavGroup[] = $derived(buildNavGroups(isAdminUser));

	let openGroups = $state<Record<string, boolean>>({
		Management: true, Security: true, Analytics: false, Enterprise: false,
	});

	function toggle(label: string) { openGroups[label] = !openGroups[label]; }

	const isActive = (href: string) => {
		const path = $page.url.pathname;
		if (href === '/') return path === '/';
		if (href === '/security') return path === '/security';
		if (href === '/audit') return path === '/audit';
		return path === href || path.startsWith(href + '/');
	};

	// Auto-expand nav group containing the active page on route change
	$effect(() => {
		const path = $page.url.pathname;
		const groups = navGroups;
		untrack(() => {
			for (const g of groups) {
				if (g.items.some(i => {
					if (i.href === '/') return path === '/';
					return path === i.href || path.startsWith(i.href + '/');
				})) {
					openGroups[g.label] = true;
				}
			}
		});
	});
</script>

{#if mobileOpen}
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<div
		class="sidebar-backdrop fixed inset-0 z-40 bg-black/50 md:hidden"
		onclick={onClose}
		onkeydown={(e) => { if (e.key === 'Escape') onClose?.(); }}
	></div>
{/if}

<aside class="sidebar-drawer flex w-64 flex-col border-r border-[var(--color-border)] bg-[var(--color-surface)] {mobileOpen ? 'sidebar-open' : ''}">
	<div class="flex h-[68px] items-center justify-between border-b border-[var(--color-border-subtle)] px-6">
		<a href="/" class="flex items-center gap-2.5 rounded-lg hover:opacity-80 focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]" aria-label="Go to dashboard">
			<img src="/brand/app-icon.png" alt="" aria-hidden="true" width="32" height="32" class="h-8 w-8 rounded-xl shadow-[0_2px_8px_rgba(79,70,229,0.3)]" />
			<div class="flex flex-col leading-tight">
				<span class="text-[15px] font-bold tracking-tight text-[var(--color-text)]">TenantIQ</span>
				<span class="text-[10px] font-medium text-[var(--color-text-tertiary)]">M365 Security</span>
			</div>
		</a>
		<button type="button" onclick={onClose} aria-label="Close menu" class="flex h-10 w-10 cursor-pointer items-center justify-center rounded-lg text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-secondary)] md:hidden">
			<X size={18} />
		</button>
		<div class="hidden md:block"><NotificationBell /></div>
	</div>

	{#if $tenant.tenants.length > 0}
		<div class="border-b border-[var(--color-border-subtle)] px-4 py-3"><TenantSwitcher /></div>
	{:else if $auth.user}
		<div class="border-b border-[var(--color-border-subtle)] px-4 py-3">
			<a
				href="{ONBOARD_ORG_URL}"
				class="flex min-h-[40px] w-full items-center justify-center gap-2 rounded-md bg-[var(--color-primary)] px-3 py-2 text-[13px] font-medium text-white transition-colors hover:opacity-90"
			>
				<svg width="14" height="14" viewBox="0 0 23 23" fill="none" aria-hidden="true">
					<rect width="10" height="10" fill="#F25022" />
					<rect x="12" width="10" height="10" fill="#7FBA00" />
					<rect y="12" width="10" height="10" fill="#00A4EF" />
					<rect x="12" y="12" width="10" height="10" fill="#FFB900" />
				</svg>
				Connect Tenant
			</a>
			<p class="mt-2 text-[10px] leading-tight text-[var(--color-text-tertiary)]">No tenants connected. Work/school account + Global Admin required.</p>
		</div>
	{/if}

	<nav class="flex-1 overflow-y-auto px-3 py-4" aria-label="Main navigation">
		{#each quickAccess as item}
			<a href={item.href} onclick={handleNavClick} class="nav-link group relative flex min-h-[40px] items-center gap-3 rounded-md px-3 py-2 text-[13px] font-medium transition-all duration-300 {isActive(item.href) ? 'bg-[var(--color-primary-muted)] text-[var(--color-primary)]' : 'text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-secondary)] hover:text-[var(--color-text)]'}">
				{#if isActive(item.href)}<span class="active-indicator"></span>{/if}
				<item.icon size={16} strokeWidth={isActive(item.href) ? 2 : 1.5} />
				<span class="tracking-tight">{item.label}</span>
			</a>
		{/each}

		{#each navGroups as group}
			<button type="button" onclick={() => toggle(group.label)} aria-expanded={openGroups[group.label]} aria-label="Toggle {group.label} section" class="mt-6 mb-1 flex w-full min-h-[28px] cursor-pointer items-center justify-between px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--color-text-tertiary)] transition-colors hover:text-[var(--color-text-secondary)]">
				{group.label}
				<ChevronDown size={11} class="transition-transform duration-300 {openGroups[group.label] ? 'rotate-180' : ''}" />
			</button>
			<div class="nav-group-items" class:nav-group-open={openGroups[group.label]}>
				<div class="nav-group-inner">
					{#each group.items as item}
						<a href={item.href} onclick={handleNavClick} class="nav-link group relative flex min-h-[36px] items-center gap-3 rounded-md px-3 py-1.5 text-[13px] font-medium transition-all duration-300 {isActive(item.href) ? 'bg-[var(--color-primary-muted)] text-[var(--color-primary)]' : 'text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-secondary)] hover:text-[var(--color-text)]'}">
							{#if isActive(item.href)}<span class="active-indicator"></span>{/if}
							<item.icon size={15} strokeWidth={isActive(item.href) ? 2 : 1.5} />
							<span class="tracking-tight">{item.label}</span>
						</a>
					{/each}
				</div>
			</div>
		{/each}
	</nav>

	<SidebarFooter />
</aside>

<style>
	.active-indicator {
		position: absolute;
		left: -12px;
		top: 50%;
		transform: translateY(-50%);
		width: 3px;
		height: 60%;
		background: linear-gradient(180deg, var(--brand-400), var(--brand-600));
		border-radius: 0 3px 3px 0;
		box-shadow: 0 0 12px rgba(59, 108, 245, 0.4);
		animation: indicator-in var(--duration-slow, 420ms) var(--easing-smooth, cubic-bezier(0.22, 1, 0.36, 1));
	}
	@keyframes indicator-in {
		from { transform: translateY(-50%) scaleY(0); opacity: 0; }
		to { transform: translateY(-50%) scaleY(1); opacity: 1; }
	}
	.nav-group-items { display: grid; grid-template-rows: 0fr; transition: grid-template-rows 200ms ease-out, opacity 200ms ease-out; opacity: 0; }
	.nav-group-inner { overflow: hidden; }
	.nav-group-open { grid-template-rows: 1fr; opacity: 1; }
	@media (max-width: 767px) {
		.sidebar-drawer { position: fixed; top: 0; left: 0; bottom: 0; z-index: 50; transform: translateX(-100%); transition: transform 300ms cubic-bezier(0.4, 0, 0.2, 1); width: 280px; max-width: 85vw; box-shadow: none; }
		.sidebar-drawer.sidebar-open { transform: translateX(0); box-shadow: var(--shadow-xl); }
		.sidebar-backdrop { animation: backdrop-in 200ms ease-out; }
		@keyframes backdrop-in { from { opacity: 0; } to { opacity: 1; } }
	}
	@media (min-width: 768px) { .sidebar-backdrop { display: none; } }
	@media (prefers-reduced-motion: reduce) { .active-indicator { animation: none; } .nav-group-items, .sidebar-drawer { transition: none; } }
</style>
