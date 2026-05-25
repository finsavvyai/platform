<script lang="ts">
	import { browser } from '$app/environment';
	import { auth } from '$stores/auth';
	import { API_BASE } from '$lib/config';

	let error = $state<string | null>(null);
	let processing = $state(true);

	if (browser) {
		const params = new URLSearchParams(window.location.search);
		const code = params.get('code');
		const errMsg = params.get('error');

		if (errMsg) {
			error = errMsg;
			processing = false;
		} else if (code) {
			// Exchange the one-time auth code for a session (HttpOnly cookie set by API)
			fetch(`${API_BASE}/auth/exchange`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				credentials: 'include',
				body: JSON.stringify({ code }),
			})
				.then((resp) => {
					if (!resp.ok) throw new Error('Code exchange failed');
					return resp.json() as Promise<{ user: Record<string, unknown> }>;
				})
				.then(({ user }) => {
					auth.setUser(user as any);
					window.location.href = '/';
				})
				.catch((err) => {
					console.error('Auth callback error:', err);
					error = 'Authentication failed. The sign-in code may have expired — please try again.';
					processing = false;
				});
		} else {
			error = 'Missing authentication data. The sign-in response was incomplete.';
			processing = false;
		}
	}

	const isPermissionError = $derived(error?.includes('AADSTS') || error?.includes('scope') || error?.includes('permission') || error?.includes('consent'));
	const isTokenError = $derived(error?.includes('token') || error?.includes('expired') || error?.includes('AADSTS700'));
</script>

<svelte:head>
	<title>{error ? 'Sign-in Error' : 'Signing in...'} | TenantIQ</title>
</svelte:head>

<div class="flex min-h-screen items-center justify-center bg-[var(--color-bg)] px-4">
	{#if error}
		<div class="w-full max-w-lg text-center">
			<div class="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-[var(--color-danger)]/10">
				<svg xmlns="http://www.w3.org/2000/svg" class="h-8 w-8 text-[var(--color-danger)]" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126z"/></svg>
			</div>
			<h2 class="text-xl font-bold text-[var(--color-text)]">Sign-in Failed</h2>

			<!-- Error detail box -->
			<div class="mx-auto mt-4 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4 text-left">
				<p class="text-xs font-medium text-[var(--color-text-secondary)]">Error Details</p>
				<p class="mt-1 text-sm text-[var(--color-text)]">{error}</p>
			</div>

			<!-- Contextual help based on error type -->
			{#if isPermissionError}
				<div class="mx-auto mt-4 rounded-xl border border-[var(--color-warning)]/20 bg-[var(--color-warning)]/5 p-4 text-left">
					<p class="text-sm font-semibold text-[var(--color-warning)]">Permission Issue</p>
					<p class="mt-1 text-xs text-[var(--color-text-secondary)]">Your Azure AD admin needs to grant the requested permissions. Go to Azure Portal > App Registrations > TenantIQ > API Permissions and click "Grant admin consent."</p>
				</div>
			{:else if isTokenError}
				<div class="mx-auto mt-4 rounded-xl border border-[var(--color-primary)]/20 bg-[var(--color-primary)]/5 p-4 text-left">
					<p class="text-sm font-semibold text-[var(--color-primary)]">Session Expired</p>
					<p class="mt-1 text-xs text-[var(--color-text-secondary)]">Your previous session has expired. Click "Try Again" to sign in fresh.</p>
				</div>
			{/if}

			<div class="mt-6 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
				<a href="{API_BASE}/auth/login" class="inline-flex min-h-[44px] items-center rounded-xl bg-[var(--color-primary)] px-6 py-2.5 text-sm font-medium text-white transition-all duration-200 hover:shadow-[var(--shadow-md)]">
					Try Again
				</a>
				<a href="/" class="inline-flex min-h-[44px] items-center rounded-xl border border-[var(--color-border)] px-6 py-2.5 text-sm font-medium text-[var(--color-text-secondary)] transition-all duration-200 hover:bg-[var(--color-bg-secondary)]">
					Go to Homepage
				</a>
			</div>

			<p class="mt-6 text-xs text-[var(--color-text-tertiary)]">
				If this keeps happening, contact your IT admin or reach out to support@tenantiq.app
			</p>
		</div>
	{:else}
		<div class="text-center">
			<div class="mx-auto mb-4 h-8 w-8 animate-spin rounded-full border-2 border-[var(--color-primary)] border-t-transparent"></div>
			<p class="text-sm text-[var(--color-text-secondary)]">Signing you in...</p>
		</div>
	{/if}
</div>
