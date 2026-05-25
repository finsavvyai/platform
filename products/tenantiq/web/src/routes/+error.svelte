<script lang="ts">
	import { page } from '$app/stores';

	const errorCode = $derived($page.status || 500);
	const errorMessage = $derived(
		$page.error?.message ||
		(errorCode === 404 ? 'Page not found' : 'An unexpected error occurred')
	);

	const errorDescription = $derived(
		errorCode === 404 ? "The page you're looking for doesn't exist or has been moved." :
		errorCode === 403 ? "You don't have permission to access this resource." :
		errorCode === 401 ? "Please sign in to access this page." :
		errorCode === 429 ? "Too many requests. Please wait a moment and try again." :
		errorCode === 500 ? "Something went wrong on our end. Please try again later." :
		errorCode === 503 ? "The service is temporarily unavailable. Please try again shortly." :
		"An unexpected error occurred."
	);

	const errorIcon = $derived(
		errorCode === 404 ? 'M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z' :
		errorCode === 403 || errorCode === 401 ? 'M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z' :
		'M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z'
	);
</script>

<svelte:head>
	<title>Error {errorCode} | TenantIQ</title>
</svelte:head>

<div class="flex min-h-[80vh] items-center justify-center px-4">
	<div class="w-full max-w-md text-center">
		<div class="mb-4 flex justify-center">
			<span class="text-sm font-semibold tracking-wider uppercase" style="color: var(--color-primary);">TenantIQ</span>
		</div>

		<div class="mb-6 flex justify-center">
			<div class="flex h-20 w-20 items-center justify-center rounded-full" style="background: color-mix(in srgb, var(--color-danger) 12%, transparent);">
				<svg class="h-10 w-10" style="color: var(--color-danger);" fill="none" viewBox="0 0 24 24" stroke="currentColor">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d={errorIcon} />
				</svg>
			</div>
		</div>

		<h1 class="mb-2 text-6xl font-bold" style="color: var(--color-text);">{errorCode}</h1>
		<p class="mb-1 text-xl font-semibold" style="color: var(--color-text);">{errorDescription}</p>
		<p class="mb-8 text-sm" style="color: var(--color-text-secondary);">{errorMessage}</p>

		<div class="flex flex-col gap-3 sm:flex-row sm:justify-center">
			<a href="/"
				class="inline-flex items-center justify-center rounded-md px-6 py-2.5 text-sm font-medium text-white transition-colors"
				style="background: var(--color-primary);">
				Return Home
			</a>
			<button
				onclick={() => window.history.back()}
				class="inline-flex items-center justify-center rounded-md border px-6 py-2.5 text-sm font-medium transition-colors"
				style="border-color: var(--color-border); background: var(--color-surface); color: var(--color-text);">
				Go Back
			</button>
		</div>

		{#if errorCode === 404}
			<div class="mt-8 text-sm" style="color: var(--color-text-secondary);">
				<p>Looking for something specific?</p>
				<div class="mt-3 flex flex-wrap justify-center gap-3">
					<a href="/" class="hover:underline" style="color: var(--color-primary);">Dashboard</a>
					<span style="color: var(--color-border);">&#8226;</span>
					<a href="/security" class="hover:underline" style="color: var(--color-primary);">Security</a>
					<span style="color: var(--color-border);">&#8226;</span>
					<a href="/alerts" class="hover:underline" style="color: var(--color-primary);">Alerts</a>
					<span style="color: var(--color-border);">&#8226;</span>
					<a href="/settings" class="hover:underline" style="color: var(--color-primary);">Settings</a>
					<span style="color: var(--color-border);">&#8226;</span>
					<a href="/ai" class="hover:underline" style="color: var(--color-primary);">AI Agent</a>
				</div>
			</div>
		{/if}
	</div>
</div>
