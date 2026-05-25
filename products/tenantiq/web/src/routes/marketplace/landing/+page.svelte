<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { page } from '$app/stores';

	const API_BASE = (import.meta.env.PUBLIC_API_URL as string | undefined)?.replace(/\/$/, '') ?? 'https://api.tenantiq.app/api';

	type ResolvedSubscription = {
		id: string;
		subscriptionName: string;
		offerId: string;
		planId: string;
		quantity: number;
		subscription: {
			id: string;
			saasSubscriptionStatus: string;
			beneficiary?: { tenantId?: string; emailId?: string };
		};
	};

	let loading = $state(true);
	let activating = $state(false);
	let error: string | null = $state(null);
	let subscription: ResolvedSubscription | null = $state(null);
	let activatedOrgId: string | null = $state(null);

	const PLAN_LABELS: Record<string, { name: string; price: string; tagline: string }> = {
		'tenantiq-core': { name: 'Core', price: '$79 / tenant / month', tagline: 'Single-tenant CIS scanning, anomaly detection, email security' },
		'tenantiq-professional': { name: 'Professional', price: '$79 / tenant / month', tagline: 'Up to 10 tenants, AI insights, lifecycle workflows, skill marketplace' },
		'tenantiq-enterprise': { name: 'Enterprise', price: '$149 / tenant / month', tagline: 'Unlimited tenants, SSO/SAML, custom compliance, priority support' },
	};

	async function resolveToken(token: string): Promise<void> {
		try {
			const res = await fetch(`${API_BASE}/marketplace/resolve`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ token }),
			});
			if (!res.ok) {
				const body = await res.json().catch(() => ({}));
				error = body.error ?? `Microsoft rejected the marketplace token (HTTP ${res.status})`;
				return;
			}
			const json = (await res.json()) as { data: ResolvedSubscription };
			subscription = json.data;
		} catch (e) {
			error = e instanceof Error ? e.message : 'Failed to resolve marketplace token';
		} finally {
			loading = false;
		}
	}

	async function activate(): Promise<void> {
		if (!subscription) return;
		activating = true;
		error = null;
		try {
			const res = await fetch(`${API_BASE}/marketplace/activate`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					subscriptionId: subscription.subscription.id,
					planId: subscription.planId,
					quantity: subscription.quantity,
				}),
			});
			if (!res.ok) {
				const body = await res.json().catch(() => ({}));
				error = body.error ?? `Activation failed (HTTP ${res.status})`;
				return;
			}
			const json = (await res.json()) as { data: { orgId: string } };
			activatedOrgId = json.data.orgId;
		} catch (e) {
			error = e instanceof Error ? e.message : 'Activation failed';
		} finally {
			activating = false;
		}
	}

	onMount(() => {
		const token = $page.url.searchParams.get('token');
		if (!token) {
			error = 'Missing marketplace token. This page must be opened from Microsoft AppSource after a purchase.';
			loading = false;
			return;
		}
		void resolveToken(token);
	});
</script>

<svelte:head>
	<title>Activate TenantIQ — Microsoft Marketplace</title>
	<meta name="robots" content="noindex" />
</svelte:head>

<div class="page">
	<header>
		<img src="/favicon.svg" alt="" width="48" height="48" />
		<h1>Activate your TenantIQ subscription</h1>
		<p class="subtitle">Confirming your Microsoft AppSource purchase…</p>
	</header>

	{#if loading}
		<div class="card centered">
			<div class="spinner"></div>
			<p>Resolving your marketplace token with Microsoft…</p>
		</div>
	{:else if error}
		<div class="card error">
			<h2>Activation problem</h2>
			<p>{error}</p>
			<p class="hint">If you just purchased TenantIQ from AppSource and landed here, please retry from your Microsoft 365 admin marketplace. Otherwise contact <a href="mailto:support@tenantiq.app">support@tenantiq.app</a>.</p>
		</div>
	{:else if activatedOrgId}
		<div class="card success">
			<h2>You're in.</h2>
			<p>Your TenantIQ organization is provisioned.</p>
			<p class="org-id">Org ID: <code>{activatedOrgId}</code></p>
			<button class="btn primary" onclick={() => goto('/')}>Connect your first Microsoft 365 tenant →</button>
		</div>
	{:else if subscription}
		<div class="card">
			<h2>{subscription.subscriptionName}</h2>
			<dl>
				<dt>Plan</dt>
				<dd><strong>{PLAN_LABELS[subscription.planId]?.name ?? subscription.planId}</strong> · {PLAN_LABELS[subscription.planId]?.price ?? ''}</dd>
				<dt>Includes</dt>
				<dd>{PLAN_LABELS[subscription.planId]?.tagline ?? ''}</dd>
				<dt>Quantity</dt>
				<dd>{subscription.quantity} tenant{subscription.quantity === 1 ? '' : 's'}</dd>
				<dt>Microsoft status</dt>
				<dd><code>{subscription.subscription.saasSubscriptionStatus}</code></dd>
				{#if subscription.subscription.beneficiary?.emailId}
					<dt>Beneficiary</dt>
					<dd>{subscription.subscription.beneficiary.emailId}</dd>
				{/if}
			</dl>
			<button class="btn primary" onclick={activate} disabled={activating}>
				{activating ? 'Activating…' : 'Activate subscription'}
			</button>
			<p class="fine-print">Microsoft will be billed for this subscription. By activating, you agree to TenantIQ's <a href="/terms">terms</a> and <a href="/privacy">privacy policy</a>.</p>
		</div>
	{/if}
</div>

<style>
	.page { max-width: 640px; margin: 4rem auto; padding: 0 1.5rem; font-family: -apple-system, 'SF Pro Text', system-ui, sans-serif; color: #f1f5f9; }
	header { text-align: center; margin-bottom: 2rem; }
	header img { margin-bottom: 1rem; }
	h1 { font-size: 1.75rem; font-weight: 700; margin: 0 0 0.5rem; letter-spacing: -0.02em; }
	.subtitle { color: #94a3b8; margin: 0; }
	.card { background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.08); border-radius: 16px; padding: 2rem; }
	.card h2 { margin: 0 0 1rem; font-size: 1.25rem; font-weight: 600; }
	.centered { text-align: center; }
	.error { border-color: rgba(239,68,68,0.4); background: rgba(239,68,68,0.05); }
	.success { border-color: rgba(34,197,94,0.4); background: rgba(34,197,94,0.05); }
	.hint { font-size: 0.875rem; color: #94a3b8; margin-top: 1rem; }
	.org-id { font-size: 0.875rem; color: #94a3b8; }
	.org-id code { background: rgba(255,255,255,0.05); padding: 0.125rem 0.375rem; border-radius: 4px; }
	dl { display: grid; grid-template-columns: 140px 1fr; gap: 0.5rem 1rem; margin: 0 0 1.5rem; }
	dt { color: #94a3b8; font-size: 0.875rem; }
	dd { margin: 0; }
	dd code { background: rgba(255,255,255,0.05); padding: 0.125rem 0.375rem; border-radius: 4px; font-size: 0.8125rem; }
	.btn { display: inline-block; padding: 0.75rem 1.5rem; border-radius: 8px; border: none; cursor: pointer; font-size: 0.9375rem; font-weight: 600; transition: transform 0.1s; }
	.btn:disabled { opacity: 0.6; cursor: not-allowed; }
	.btn:not(:disabled):active { transform: scale(0.98); }
	.btn.primary { background: #ef4444; color: white; }
	.fine-print { font-size: 0.75rem; color: #64748b; margin-top: 1rem; }
	.fine-print a { color: #94a3b8; }
	.spinner { width: 32px; height: 32px; border: 3px solid rgba(255,255,255,0.1); border-top-color: #ef4444; border-radius: 50%; animation: spin 0.8s linear infinite; margin: 0 auto 1rem; }
	@keyframes spin { to { transform: rotate(360deg); } }
</style>
