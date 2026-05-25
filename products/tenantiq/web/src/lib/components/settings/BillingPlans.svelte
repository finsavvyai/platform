<script lang="ts">
	import { auth } from '$stores/auth';
	import { api } from '$lib/api/client';
	import { toasts } from '$stores/toast';
	import { safeErrorMessage } from '$lib/utils/safe-error';
	import ConfirmModal from '$components/ConfirmModal.svelte';
	import { Sparkles, Shield, Zap, Crown } from 'lucide-svelte';
	import { page } from '$app/stores';
	import { onMount } from 'svelte';
	import BillingToggle from './BillingToggle.svelte';
	import PlanCard from './PlanCard.svelte';

	const currentPlan = $derived($auth.user?.plan ?? 'trial');
	const trialEnd = $derived($auth.user?.trialEndsAt ? new Date($auth.user.trialEndsAt) : null);
	const isExpired = $derived(trialEnd ? trialEnd < new Date() : false);
	const daysLeft = $derived(
		trialEnd ? Math.max(0, Math.ceil((trialEnd.getTime() - Date.now()) / 86_400_000)) : 0
	);

	let billingEl: HTMLElement | undefined = $state();
	let loadingPlan: string | null = $state(null);
	interface BillingSubscription { tier: string; status: string; subscription: any }
	let subscription: BillingSubscription | null = $state(null as BillingSubscription | null);
	let cancelling = $state(false);
	let showCancelModal = $state(false);
	let annual = $state(false);

	$effect(() => {
		if (billingEl && $page.url.searchParams.get('tab') === 'billing') {
			billingEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
		}
	});

	onMount(async () => {
		try {
			subscription = await api.get('/billing/subscription');
		} catch { /* no subscription */ }
	});

	const activeTier = $derived(subscription?.tier ?? 'free');
	const hasActiveSub = $derived(
		subscription?.subscription !== null && subscription?.status === 'active',
	);

	async function handleCheckout(planId: string) {
		if (loadingPlan) return;
		loadingPlan = planId;
		try {
			const res = await api.post<{ checkoutUrl: string }>('/billing/checkout', {
				plan: planId,
				cycle: annual ? 'annual' : 'monthly',
			});
			window.location.href = res.checkoutUrl;
		} catch (err: any) {
			toasts.error(safeErrorMessage(err, 'Failed to create checkout. Please try again.'));
			loadingPlan = null;
		}
	}

	async function handleCancel() {
		if (cancelling) return;
		cancelling = true;
		try {
			await api.post('/billing/cancel');
			subscription = await api.get('/billing/subscription');
			toasts.success('Subscription will cancel at end of billing period.');
		} catch (err: any) {
			toasts.error(safeErrorMessage(err, 'Failed to cancel subscription.'));
		} finally {
			cancelling = false;
			showCancelModal = false;
		}
	}

	const plans = [
		{
			id: 'core', name: 'Core', monthly: 79, annual: 63,
			period: '/tenant/mo', description: 'Visibility into your M365 security posture',
			icon: Shield, accentColor: 'var(--color-primary)',
			recommended: false,
			features: [
				'Up to 5 tenants',
				'100+ CIS benchmark controls',
				'Security dashboard & real-time alerts',
				'License utilization reports',
				'Email & Slack notifications',
				'Basic compliance reporting',
			],
		},
		{
			id: 'professional', name: 'Professional', monthly: 199, annual: 159,
			period: '/tenant/mo', description: 'AI-powered analysis & automated remediation',
			icon: Zap, accentColor: '#8b5cf6',
			recommended: true,
			features: [
				'Up to 25 tenants',
				'Everything in Core',
				'AI Agent with 13+ security tools',
				'Auto-remediation with rollback',
				'SOC2, HIPAA, GDPR compliance',
				'Workflow automation engine',
				'License optimization savings',
				'Priority support (4h SLA)',
			],
		},
		{
			id: 'security_suite', name: 'Security Suite', monthly: 399, annual: 319,
			period: '/tenant/mo', description: 'Full security control plane — configure, harden, monitor',
			icon: Crown, accentColor: '#f59e0b',
			recommended: false,
			highlight: true,
			features: [
				'Up to 50 tenants',
				'Everything in Professional',
				'Security hardening wizard',
				'Configuration drift monitoring',
				'Microsoft security stack management',
				'TokenForge session protection',
				'Config snapshots & diff viewer',
				'Advanced PDF/executive reporting',
				'Dedicated support engineer',
			],
		},
		{
			id: 'enterprise', name: 'Enterprise', monthly: 0, annual: 0,
			period: '', description: 'For MSPs at scale with custom requirements',
			icon: Sparkles, accentColor: '#10b981',
			recommended: false,
			features: [
				'Unlimited tenants',
				'Everything in Security Suite',
				'SSO / SAML / OIDC',
				'White-label & custom branding',
				'Custom integrations & API',
				'SLA guarantee (99.9%)',
				'Dedicated CSM',
				'Data residency options',
				'Onboarding & training',
			],
		},
	];
</script>

<div
	bind:this={billingEl}
	id="billing"
	class="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-6"
>
	<!-- Header -->
	<div class="mb-2 flex items-center gap-2">
		<div class="flex h-7 w-7 items-center justify-center rounded-lg bg-[var(--color-primary)]/10">
			<Sparkles size={15} class="text-[var(--color-primary)]" />
		</div>
		<h2 class="text-sm font-semibold text-[var(--color-text)]">Plans & Billing</h2>
	</div>

	<!-- Trial status -->
	<div class="mb-5">
		{#if isExpired}
			<div class="rounded-xl border border-[var(--color-danger)]/20 bg-[var(--color-danger)]/5 px-4 py-3">
				<p class="text-xs font-medium text-[var(--color-danger)]">Your trial has ended. Choose a plan to continue using TenantIQ.</p>
			</div>
		{:else if currentPlan === 'trial' && trialEnd}
			<div class="rounded-xl border border-[var(--color-primary)]/15 bg-[var(--color-primary)]/5 px-4 py-3">
				<p class="text-xs text-[var(--color-text-secondary)]">
					<span class="font-semibold text-[var(--color-primary)]">{daysLeft} days left</span> on your free trial.
					Upgrade anytime — your data carries over.
				</p>
			</div>
		{:else if hasActiveSub}
			<p class="text-xs text-[var(--color-text-secondary)]">
				You're on the <span class="font-semibold capitalize text-[var(--color-text)]">{activeTier.replace('_', ' ')}</span> plan.
			</p>
		{/if}

		{#if subscription?.subscription?.cancelAtPeriodEnd}
			<div class="mt-3 flex items-start gap-2 rounded-lg border border-[var(--color-warning)]/30 bg-[var(--color-warning)]/5 px-3 py-2">
				<svg xmlns="http://www.w3.org/2000/svg" class="mt-0.5 h-4 w-4 flex-shrink-0 text-[var(--color-warning)]" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
					<path stroke-linecap="round" stroke-linejoin="round" d="M12 9v3.75m0-10.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285zm0 13.036h.008v.008H12v-.008z" />
				</svg>
				<div class="text-xs leading-snug">
					<p class="font-medium text-[var(--color-text)]">Subscription cancels on {subscription.subscription.currentPeriodEnd ? new Date(subscription.subscription.currentPeriodEnd).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' }) : 'the end of the current period'}</p>
					<p class="mt-0.5 text-[var(--color-text-secondary)]">You'll keep {activeTier.replace('_', ' ')} access until then, then revert to Free.</p>
				</div>
			</div>
		{/if}
	</div>

	<BillingToggle bind:annual />

	<!-- Cybiz comparison note -->
	<div class="mb-5 rounded-xl border border-[var(--color-primary)]/10 bg-[var(--color-primary)]/3 px-4 py-3 text-center">
		<p class="text-[11px] text-[var(--color-text-secondary)]">
			Replaces third-party security stacks costing <span class="font-semibold text-[var(--color-text)]">$1,500+/mo</span>
			— TenantIQ manages your Microsoft security natively.
		</p>
	</div>

	<!-- Plan cards -->
	<div class="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
		{#each plans as plan}
			<PlanCard
				{plan}
				isCurrent={activeTier === plan.id && hasActiveSub}
				{annual}
				{loadingPlan}
				{cancelling}
				onCheckout={handleCheckout}
				onCancelClick={() => (showCancelModal = true)}
			/>
		{/each}
	</div>

	<p class="mt-4 text-center text-[10px] text-[var(--color-text-tertiary)]">
		14-day free trial on all plans. No credit card required. Cancel anytime.
		Volume discounts available for 10+ tenants.
	</p>
</div>

<ConfirmModal
	open={showCancelModal}
	title="Cancel Subscription"
	description="Your subscription will remain active until the end of the current billing period. After that, you'll be downgraded to the free plan."
	confirmLabel="Cancel Subscription"
	destructive={true}
	onConfirm={handleCancel}
	onCancel={() => (showCancelModal = false)}
/>
