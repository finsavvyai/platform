<script lang="ts">
	import { untrack } from 'svelte';
	import { page } from '$app/stores';
	import { api } from '$api/client';
	import { safeErrorMessage } from '$lib/utils/safe-error';

	type Phase = 'resolving' | 'success' | 'error';

	let phase = $state<Phase>('resolving');
	let planName = $state('');
	let planPrice = $state(0);
	let subscriptionId = $state('');
	let errorMessage = $state('');

	interface ResolveResponse {
		data: {
			subscriptionId: string;
			planId: string;
			planName: string;
			planPrice: number;
			quantity: number;
		};
	}

	async function resolveToken(token: string) {
		try {
			const result = await api.post<ResolveResponse>('/marketplace/resolve', { token });
			planName = result.data.planName ?? 'TenantIQ';
			planPrice = result.data.planPrice ?? 0;
			subscriptionId = result.data.subscriptionId ?? '';
			phase = 'success';
		} catch (err) {
			errorMessage = safeErrorMessage(err, 'Failed to activate subscription');
			phase = 'error';
		}
	}

	$effect(() => {
		const token = $page.url.searchParams.get('token');
		if (token) {
			untrack(() => resolveToken(token));
		} else {
			errorMessage = 'No marketplace token provided. Please return to Microsoft AppSource.';
			phase = 'error';
		}
	});
</script>

<svelte:head>
	<title>Activate Subscription — TenantIQ</title>
	<meta name="description" content="Activate your TenantIQ subscription from Microsoft AppSource." />
</svelte:head>

<div class="marketplace-page">
	<div class="gradient-mesh"></div>
	<div class="content">
		<a href="/" class="logo gradient-text">TenantIQ</a>

		{#if phase === 'resolving'}
			<div class="card">
				<div class="spinner" aria-label="Loading"></div>
				<h1>Activating your subscription</h1>
				<p>Verifying your purchase with Microsoft AppSource. This only takes a moment.</p>
			</div>
		{:else if phase === 'success'}
			<div class="card">
				<div class="status-icon success-icon">
					<svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M4.5 12.75l6 6 9-13.5"/></svg>
				</div>
				<h1>Subscription Activated</h1>
				<p>Your TenantIQ subscription is ready. Welcome aboard.</p>
				<div class="plan-details">
					<div class="plan-row">
						<span class="label">Plan</span>
						<span class="value">{planName}</span>
					</div>
					{#if planPrice > 0}
						<div class="plan-row">
							<span class="label">Price</span>
							<span class="value">${planPrice}/mo</span>
						</div>
					{/if}
					{#if subscriptionId}
						<div class="plan-row">
							<span class="label">Subscription</span>
							<span class="value mono">{subscriptionId.slice(0, 12)}...</span>
						</div>
					{/if}
				</div>
				<a href="/" class="btn-primary">Get Started</a>
			</div>
		{:else}
			<div class="card">
				<div class="status-icon error-icon">
					<svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>
				</div>
				<h1>Activation Failed</h1>
				<p>{errorMessage}</p>
				<div class="support-row">
					<p>Need help? Contact <a href="mailto:support@tenantiq.app">support@tenantiq.app</a></p>
				</div>
				<a href="https://appsource.microsoft.com" class="btn-secondary">Return to AppSource</a>
			</div>
		{/if}

		<footer class="page-footer">
			<a href="/privacy">Privacy</a>
			<span class="dot"></span>
			<a href="/terms">Terms</a>
			<span class="dot"></span>
			<a href="/support">Support</a>
		</footer>
	</div>
</div>

<style>
	.marketplace-page { position: relative; min-height: 100vh; background: #0a0a0f; display: flex; align-items: center; justify-content: center; overflow: hidden; }
	.gradient-mesh { position: absolute; inset: 0; background: radial-gradient(ellipse 80% 50% at 50% -20%, rgba(102,126,234,0.15), transparent), radial-gradient(ellipse 60% 40% at 80% 60%, rgba(118,75,162,0.1), transparent); pointer-events: none; }
	.content { position: relative; z-index: 1; width: 100%; max-width: 480px; padding: 2rem 1.5rem; text-align: center; }
	.logo { display: block; font-size: 1.25rem; font-weight: 700; letter-spacing: 0.05em; margin-bottom: 2rem; text-decoration: none; }
	.gradient-text { background: linear-gradient(135deg, #667eea, #764ba2); -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text; }
	.card { background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.08); border-radius: 16px; padding: 2.5rem 2rem; backdrop-filter: blur(12px); animation: fadeUp 0.6s ease; }
	h1 { font-size: 1.5rem; font-weight: 600; color: #fff; margin: 1rem 0 0.5rem; }
	p { color: #9ca3af; line-height: 1.6; font-size: 0.95rem; }
	.spinner { width: 40px; height: 40px; border: 3px solid rgba(255,255,255,0.1); border-top-color: #667eea; border-radius: 50%; margin: 0 auto; animation: spin 0.8s linear infinite; }
	@keyframes spin { to { transform: rotate(360deg); } }
	.status-icon { width: 56px; height: 56px; border-radius: 50%; display: flex; align-items: center; justify-content: center; margin: 0 auto; }
	.success-icon { background: linear-gradient(135deg, rgba(52,199,89,0.2), rgba(52,199,89,0.1)); color: #34c759; }
	.error-icon { background: linear-gradient(135deg, rgba(255,59,48,0.2), rgba(255,59,48,0.1)); color: #ff3b30; }
	.plan-details { margin: 1.5rem 0; border: 1px solid rgba(255,255,255,0.08); border-radius: 10px; overflow: hidden; }
	.plan-row { display: flex; justify-content: space-between; padding: 0.75rem 1rem; border-bottom: 1px solid rgba(255,255,255,0.06); }
	.plan-row:last-child { border-bottom: none; }
	.label { color: #6b7280; font-size: 0.875rem; }
	.value { font-weight: 600; color: #fff; font-size: 0.875rem; }
	.mono { font-family: monospace; font-size: 0.8rem; }
	.btn-primary { display: inline-flex; align-items: center; gap: 0.5rem; padding: 0.85rem 2rem; font-size: 1rem; font-weight: 600; border-radius: 12px; border: none; cursor: pointer; background: linear-gradient(135deg, #667eea, #764ba2); color: #fff; text-decoration: none; margin-top: 0.5rem; transition: all 0.3s ease; }
	.btn-primary:hover { transform: translateY(-2px); box-shadow: 0 0 30px rgba(102,126,234,0.35); }
	.btn-secondary { display: inline-flex; padding: 0.75rem 1.75rem; font-size: 0.9rem; font-weight: 500; border-radius: 10px; border: 1px solid rgba(255,255,255,0.12); background: transparent; color: #9ca3af; text-decoration: none; margin-top: 0.5rem; transition: all 0.2s ease; }
	.btn-secondary:hover { border-color: rgba(255,255,255,0.25); color: #fff; }
	.support-row { margin: 1rem 0; }
	.support-row a { color: #667eea; text-decoration: none; }
	.support-row a:hover { text-decoration: underline; }
	.page-footer { margin-top: 2rem; display: flex; align-items: center; justify-content: center; gap: 0.75rem; }
	.page-footer a { color: #4b5563; font-size: 0.8rem; text-decoration: none; transition: color 0.2s; }
	.page-footer a:hover { color: #9ca3af; }
	.dot { width: 3px; height: 3px; border-radius: 50%; background: #374151; }
	@keyframes fadeUp { from { opacity: 0; transform: translateY(16px); } to { opacity: 1; transform: translateY(0); } }
	@media (max-width: 640px) { .card { padding: 2rem 1.25rem; } h1 { font-size: 1.25rem; } }
</style>
