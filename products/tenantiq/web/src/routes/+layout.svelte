<script lang="ts">
	import '../app.css';
	import '$stores/theme';
	import { initSentry } from '$lib/sentry-client';
	import Sidebar from '$components/Sidebar.svelte';
	import MobileHeader from '$components/MobileHeader.svelte';
	import SuspendedBanner from '$components/SuspendedBanner.svelte';
	import TrialExpiredBanner from '$components/TrialExpiredBanner.svelte';
	import AdminNotificationBar from '$components/AdminNotificationBar.svelte';
	import GracePeriodOverlay from '$components/GracePeriodOverlay.svelte';
	import SuspendedOverlay from '$components/SuspendedOverlay.svelte';
	import ToastContainer from '$components/ui/ToastContainer.svelte';
	import KeyboardShortcuts from '$components/KeyboardShortcuts.svelte';
	import SignInHero from '$components/landing/SignInHero.svelte';
	import { auth } from '$stores/auth';
	import { tenant } from '$stores/tenant';
	import { notifications } from '$stores/notifications';
	import { api } from '$api/client';
	import { browser } from '$app/environment';
	import { page } from '$app/stores';
	import { trackPageView } from '$lib/analytics';

	const PUBLIC_ROUTES = ['/', '/terms', '/privacy', '/support', '/home', '/auth/callback', '/marketplace', '/changelog', '/demo', '/prospect', '/compare', '/pricing', '/leaderboard', '/ciso-demo'];
	const PUBLIC_PREFIXES = ['/scan/', '/compare/', '/marketplace/'];

	let { children } = $props();
	let sidebarOpen = $state(false);

	function toggleSidebar() { sidebarOpen = !sidebarOpen; }
	function closeSidebar() { sidebarOpen = false; }

	// Lazy-load non-critical components after initial render
	let mounted = $state(false);
	$effect(() => { mounted = true; });

	const isPublicRoute = $derived(
		PUBLIC_ROUTES.includes($page.url.pathname) ||
		PUBLIC_PREFIXES.some(p => $page.url.pathname.startsWith(p))
	);
	const needsAuth = $derived(!isPublicRoute && !$auth.user && !$auth.loading);

	// Dynamic OG image for /scan/:domain shareable URLs. Has to live in the
	// layout because the page component is gated behind `$auth.loading` and
	// its <svelte:head> never fires during SSR — social scrapers see the
	// static og-image.png otherwise.
	const scanDomain = $derived.by(() => {
		const m = $page.url.pathname.match(/^\/scan\/([^/]+)\/?$/);
		return m ? decodeURIComponent(m[1]) : null;
	});
	const scanOgImage = $derived(scanDomain
		? `https://api.tenantiq.app/api/prospect/og.svg?domain=${encodeURIComponent(scanDomain)}`
		: null);

	// Track page views on route change
	$effect(() => {
		if (browser) trackPageView($page.url.pathname);
	});

	// Connect real-time notifications only on authed app routes.
	// Public marketing pages (/, /ciso-demo, /compare, /scan/:domain, …) don't
	// need the WS/SSE pipe and would 401 against tenant-scoped endpoints.
	$effect(() => {
		if (!browser) return;
		const user = $auth.user;
		const tenantId = $tenant.currentTenantId;
		if (user && tenantId && !isPublicRoute) {
			notifications.connect(tenantId);
		} else {
			notifications.disconnect();
		}
		return () => notifications.disconnect();
	});

	// HttpOnly session cookie is the only source of truth. /api/auth/me
	// resolves it on every mount; if 401, the user is logged out.
	if (browser) {
		initSentry();

		// Safety timeout — never show spinner forever if API is unreachable.
		const authTimeout = setTimeout(() => {
			tenant.setLoaded();
			auth.clear();
		}, 8000);

		api.get<{ user: { id: string; email: string; name: string; role: string; organizationId: string; tenantIds: string[]; status?: string; plan?: string; trialEndsAt?: string | null } }>('/auth/me')
			.then((data) => {
				clearTimeout(authTimeout);
				auth.setUser(data.user as any);
				// Tenant fetch is independent — don't let it clear auth on failure.
				api.get<{ tenants: Array<{ id: string; displayName: string; domain: string; status: 'active' | 'suspended' | 'disconnected'; lastSyncAt: string | null }> }>('/tenants')
					.then((td) => {
						tenant.setTenants(td.tenants);
						if (td.tenants.length > 0) {
							tenant.setCurrentTenant(td.tenants[0].id);
						}
					})
					.catch(() => tenant.setLoaded());
			})
			.catch(() => {
				clearTimeout(authTimeout);
				tenant.setLoaded();
				auth.clear();
			});
	}
</script>

<svelte:head>
	{#if scanDomain && scanOgImage}
		<title>{scanDomain} — M365 security scan | TenantIQ</title>
		<meta property="og:title" content="{scanDomain} — M365 security scan" />
		<meta property="og:description" content="Free public M365 security posture scan by TenantIQ — DNS auth, tenant discovery, federation type. No signup required." />
		<meta property="og:image" content={scanOgImage} />
		<meta property="og:image:type" content="image/svg+xml" />
		<meta property="og:image:width" content="1200" />
		<meta property="og:image:height" content="630" />
		<meta property="og:url" content="https://app.tenantiq.app/scan/{scanDomain}" />
		<meta name="twitter:card" content="summary_large_image" />
		<meta name="twitter:title" content="{scanDomain} — M365 security scan" />
		<meta name="twitter:image" content={scanOgImage} />
	{:else}
		<meta property="og:title" content="TenantIQ — AI-Powered Microsoft 365 Control Plane for MSPs" />
		<meta property="og:description" content="Secure identities, enforce compliance, and eliminate license waste across all your Microsoft 365 tenants." />
		<meta property="og:url" content="https://app.tenantiq.app" />
		<meta property="og:image" content="https://tenantiq.app/og-image.png" />
		<meta property="og:image:type" content="image/png" />
		<meta property="og:image:width" content="1128" />
		<meta property="og:image:height" content="191" />
		<meta name="twitter:card" content="summary_large_image" />
		<meta name="twitter:title" content="TenantIQ — AI-Powered Microsoft 365 Control Plane for MSPs" />
		<meta name="twitter:image" content="https://tenantiq.app/og-image.png" />
	{/if}
</svelte:head>

<a href="#main-content" class="skip-link">Skip to main content</a>

{#if $auth.loading}
	<div class="flex h-screen items-center justify-center bg-[var(--color-bg)]">
		<div class="text-center">
			<div class="mx-auto mb-4 h-8 w-8 animate-spin rounded-full border-2 border-[var(--color-primary)] border-t-transparent"></div>
			<p class="text-sm text-[var(--color-text-secondary)]">Loading...</p>
		</div>
	</div>
{:else}
	<div class="flex h-screen bg-[var(--color-bg)]">
		{#if $auth.user}
			<Sidebar mobileOpen={sidebarOpen} onClose={closeSidebar} />
		{/if}
		<div class="flex flex-1 flex-col overflow-hidden">
			{#if $auth.user}
				<MobileHeader onToggleSidebar={toggleSidebar} />
			{/if}
			<SuspendedBanner />
			<TrialExpiredBanner />
			<AdminNotificationBar />
			<main id="main-content" class="relative flex-1 overflow-auto p-4 pb-20 md:p-6">
				{#if needsAuth}
					<SignInHero />
				{:else}
					<div class="animate-fade-up">
						{@render children()}
					</div>
					<SuspendedOverlay />
					<GracePeriodOverlay />
				{/if}
			</main>
		</div>
	</div>
{/if}

<ToastContainer />
<KeyboardShortcuts />
{#if mounted}
	{#await import('$components/chat/ChatGuide.svelte') then { default: ChatGuide }}
		<ChatGuide />
	{/await}
	{#await import('$components/CookieConsent.svelte') then { default: CookieConsent }}
		<CookieConsent />
	{/await}
{/if}
