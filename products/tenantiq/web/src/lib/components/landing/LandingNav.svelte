<script lang="ts">
	import { LOGIN_URL } from '$lib/config';

	let scrolled = $state(false);
	let menuOpen = $state(false);

	const links = [
		{ label: 'Features', href: '#features' },
		{ label: 'vs Optimize365', href: '/compare' },
		{ label: 'CISO Demo', href: '/ciso-demo' },
		{ label: 'Pricing', href: '/pricing' },
		{ label: 'Free Scan', href: '/prospect' },
		{ label: 'Changelog', href: '/changelog' },
	];

	function handleScroll() { scrolled = window.scrollY > 40; }
	function closeMenu() { menuOpen = false; }
</script>

<svelte:window onscroll={handleScroll} />

<nav class="nav" class:scrolled aria-label="Main navigation">
	<div class="nav-inner">
		<a href="#hero" class="logo" aria-label="TenantIQ home">
			<img src="/brand/logo-horizontal.png" alt="TenantIQ" width="160" height="40" />
		</a>
		<div class="nav-links">
			{#each links as link}
				<a href={link.href} class="nav-link">{link.label}</a>
			{/each}
		</div>
		<div class="nav-right">
			<a href="{LOGIN_URL}" class="nav-login">Log in</a>
			<a href="https://app.tenantiq.app" class="nav-cta">Start free trial</a>
		</div>
		<button class="hamburger" class:open={menuOpen} onclick={() => (menuOpen = !menuOpen)} aria-label={menuOpen ? 'Close menu' : 'Open menu'} aria-expanded={menuOpen}>
			<span class="bar"></span><span class="bar"></span><span class="bar"></span>
		</button>
	</div>
</nav>

{#if menuOpen}
	<div class="mobile-overlay" role="presentation" onclick={closeMenu}></div>
	<div class="mobile-menu" role="dialog" aria-label="Navigation menu">
		{#each links as link}
			<a href={link.href} class="mobile-link" onclick={closeMenu}>{link.label}</a>
		{/each}
		<div class="mobile-divider"></div>
		<a href="{LOGIN_URL}" class="mobile-link" onclick={closeMenu}>Log in</a>
		<a href="https://app.tenantiq.app" class="mobile-cta" onclick={closeMenu}>Start free trial</a>
	</div>
{/if}

<style>
	.nav { position: fixed; top: 0; left: 0; right: 0; z-index: 100; padding: 0.875rem 5%; transition: all 0.3s ease; }
	.nav.scrolled { background: rgba(6,11,15,0.85); backdrop-filter: blur(20px) saturate(180%); border-bottom: 1px solid rgba(255,255,255,0.05); }
	.nav-inner { max-width: 1200px; margin: 0 auto; display: flex; align-items: center; gap: 2rem; }
	.logo { display: inline-flex; align-items: center; margin-right: auto; text-decoration: none; }
	.logo img { height: 34px; width: auto; filter: brightness(0) invert(1); transition: filter 0.2s; }
	.nav.scrolled .logo img { filter: none; }
	.nav-links { display: flex; gap: 1.75rem; }
	.nav-link { color: #64748b; text-decoration: none; font-size: 0.85rem; font-weight: 450; transition: color 0.2s; letter-spacing: -0.01em; }
	.nav-link:hover { color: #e2e8f0; }
	.nav-right { display: flex; align-items: center; gap: 0.75rem; }
	.nav-login { color: #94a3b8; font-size: 0.85rem; font-weight: 500; text-decoration: none; transition: color 0.2s; }
	.nav-login:hover { color: #e2e8f0; }
	.nav-cta { padding: 0.5rem 1.1rem; background: #10b981; color: #fff; font-size: 0.8rem; font-weight: 600; border-radius: 8px; text-decoration: none; transition: all 0.2s; min-height: 36px; display: inline-flex; align-items: center; }
	.nav-cta:hover { background: #059669; box-shadow: 0 4px 16px rgba(16,185,129,0.25); }

	.hamburger { display: none; flex-direction: column; justify-content: center; gap: 5px; width: 40px; height: 40px; padding: 8px; background: none; border: 1px solid rgba(255,255,255,0.08); border-radius: 8px; cursor: pointer; }
	.bar { display: block; width: 100%; height: 1.5px; background: #e2e8f0; border-radius: 2px; transition: all 0.3s ease; transform-origin: center; }
	.hamburger.open .bar:nth-child(1) { transform: rotate(45deg) translate(4.5px, 4.5px); }
	.hamburger.open .bar:nth-child(2) { opacity: 0; }
	.hamburger.open .bar:nth-child(3) { transform: rotate(-45deg) translate(4.5px, -4.5px); }

	.mobile-overlay { display: none; position: fixed; inset: 0; background: rgba(0,0,0,0.5); z-index: 98; backdrop-filter: blur(4px); }
	.mobile-menu { display: none; position: fixed; top: 0; right: 0; width: min(300px, 80vw); height: 100dvh; background: #0c1219; border-left: 1px solid rgba(255,255,255,0.06); z-index: 99; padding: 5rem 1.5rem 2rem; flex-direction: column; gap: 0.25rem; animation: slideIn 0.2s ease; }
	@keyframes slideIn { from { transform: translateX(100%); } to { transform: translateX(0); } }
	.mobile-link { display: block; padding: 0.85rem 1rem; color: #cbd5e1; text-decoration: none; font-size: 1rem; font-weight: 450; border-radius: 10px; transition: background 0.15s; }
	.mobile-link:hover { background: rgba(255,255,255,0.04); }
	.mobile-divider { height: 1px; background: rgba(255,255,255,0.06); margin: 0.5rem 0; }
	.mobile-cta { display: block; margin-top: 0.75rem; padding: 0.85rem; text-align: center; background: #10b981; color: #fff; font-size: 0.95rem; font-weight: 600; border-radius: 10px; text-decoration: none; min-height: 48px; }

	@media (max-width: 768px) {
		.nav-links, .nav-right { display: none; }
		.hamburger { display: flex; }
		.mobile-overlay, .mobile-menu { display: flex; }
	}
</style>
