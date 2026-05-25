<script lang="ts">
	import LandingNav from '$lib/components/landing/LandingNav.svelte';
	import HeroSection from '$lib/components/landing/HeroSection.svelte';
	import ProblemSection from '$lib/components/landing/ProblemSection.svelte';
	import FeaturesSection from '$lib/components/landing/FeaturesSection.svelte';
	import FeatureHighlights from '$lib/components/landing/FeatureHighlights.svelte';
	import DemoSection from '$lib/components/landing/DemoSection.svelte';
	import AISection from '$lib/components/landing/AISection.svelte';
	import RemediationSection from '$lib/components/landing/RemediationSection.svelte';
	import TestimonialsSection from '$lib/components/landing/TestimonialsSection.svelte';
	import TrustSignals from '$lib/components/landing/TrustSignals.svelte';
	import PricingSection from '$lib/components/landing/PricingSection.svelte';
	import ShareSection from '$lib/components/landing/ShareSection.svelte';
	import FloatingShareButton from '$lib/components/landing/FloatingShareButton.svelte';
	import LandingFooter from '$lib/components/landing/LandingFooter.svelte';
	import AutonomousCounter from '$lib/components/landing/AutonomousCounter.svelte';
	import { onMount } from 'svelte';

	onMount(() => {
		const sections = document.querySelectorAll('.landing > :not(nav)');
		const observer = new IntersectionObserver(
			(entries) => {
				entries.forEach((entry) => {
					if (entry.isIntersecting) {
						entry.target.classList.add('revealed');
						observer.unobserve(entry.target);
					}
				});
			},
			{ threshold: 0.08, rootMargin: '0px 0px -40px 0px' }
		);
		sections.forEach((s) => observer.observe(s));
		return () => observer.disconnect();
	});
</script>

<svelte:head>
	<title>TenantIQ - AI-Powered Microsoft 365 Security & Compliance for MSPs</title>
	<meta name="description" content="TenantIQ is the AI-powered Microsoft 365 control plane for MSPs. Automate 100+ CIS benchmark controls, detect threats in real-time, optimize license costs by 20-40%, and achieve SOC 2/HIPAA/GDPR compliance — across all your tenants from one dashboard." />
	<link rel="canonical" href="https://app.tenantiq.app/home" />
	<meta property="og:title" content="TenantIQ — AI-Powered Microsoft 365 Control Plane for MSPs" />
	<meta property="og:description" content="Automate CIS benchmarks, detect threats, optimize licenses, and manage compliance across all your Microsoft 365 tenants. 14-day free trial." />
	<meta property="og:url" content="https://app.tenantiq.app/home" />
	<meta property="og:type" content="website" />
	<meta name="twitter:title" content="TenantIQ — AI-Powered M365 Security for MSPs" />
	<meta name="twitter:description" content="100+ CIS controls, AI security agent, license optimization. The unified control plane for MSPs managing Microsoft 365." />
</svelte:head>

<div class="landing">
	<LandingNav />
	<HeroSection />
	<AutonomousCounter />
	<ProblemSection />
	<FeaturesSection />
	<FeatureHighlights />
	<DemoSection />
	<AISection />
	<RemediationSection />
	<TrustSignals />
	<TestimonialsSection />
	<PricingSection />
	<ShareSection />
	<LandingFooter />
	<FloatingShareButton />
</div>

<style>
	.landing {
		min-height: 100vh;
		background: #060b0f;
		color: #f1f5f9;
		scroll-behavior: smooth;
		overflow-x: hidden;
	}

	/* Scroll-reveal: sections fade in from below */
	.landing > :global(*:not(nav)) {
		opacity: 0;
		transform: translateY(24px);
		transition: opacity 0.7s ease, transform 0.7s ease;
	}

	.landing > :global(.revealed) {
		opacity: 1;
		transform: translateY(0);
	}

	/* First section (hero) visible immediately */
	.landing > :global(*:first-child),
	.landing > :global(*:nth-child(2)) {
		opacity: 1;
		transform: translateY(0);
	}
</style>
