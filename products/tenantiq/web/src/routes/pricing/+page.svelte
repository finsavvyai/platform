<script lang="ts">
	import LandingNav from '$lib/components/landing/LandingNav.svelte';
	import PricingSection from '$lib/components/landing/PricingSection.svelte';
	import LandingFooter from '$lib/components/landing/LandingFooter.svelte';
</script>

<svelte:head>
	<title>Pricing — TenantIQ</title>
	<meta name="description" content="TenantIQ per-tenant pricing for MSPs and IT teams. Volume discounts, 14-day free trial, no credit card required." />
	<link rel="canonical" href="https://app.tenantiq.app/pricing" />
</svelte:head>

<div class="landing">
	<LandingNav />
	<main id="main-content" style="padding-top: 5rem;">
		<PricingSection />
	</main>
	<LandingFooter />
</div>

<style>
	.landing { min-height: 100vh; background: var(--color-bg); }
</style>
