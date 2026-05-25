<script lang="ts">
	import { api } from '$api/client';
	import { toasts } from '$stores/toast';
	import { auth } from '$stores/auth';
	import { ArrowLeft, Palette, Upload, Eye } from 'lucide-svelte';
	import { untrack } from 'svelte';

	interface Branding {
		id: string;
		org_id: string;
		logo_url: string | null;
		favicon_url: string | null;
		primary_color: string;
		secondary_color: string;
		company_name: string;
		custom_domain: string | null;
		custom_domain_status?: string | null;
		custom_domain_verification_token?: string | null;
		custom_domain_verified_at?: string | null;
		email_from_name: string | null;
	}

	interface InitResponse {
		domain: string;
		recordType: string;
		recordName: string;
		recordValue: string;
		instruction: string;
		status: string;
	}

	interface VerifyResponse {
		verified: boolean;
		expected?: string;
		found?: string[];
		message?: string;
		domain?: string;
		verifiedAt?: string;
		nextStep?: string;
	}

	let loading = $state(true);
	let saving = $state(false);
	let branding = $state<Branding | null>(null);

	let primaryColor = $state('#2563eb');
	let secondaryColor = $state('#7c3aed');
	let companyName = $state('');
	let customDomain = $state('');
	let emailFromName = $state('');
	let showPreview = $state(false);

	let domainChallenge = $state<InitResponse | null>(null);
	let verifying = $state(false);
	let initializingDomain = $state(false);
	let logoFile = $state<File | null>(null);
	let logoUploading = $state(false);

	$effect(() => { if ($auth.user) untrack(() => loadBranding()); });

	async function loadBranding() {
		loading = true;
		try {
			const res = await api.get<{ branding: Branding | null }>('/branding');
			branding = res.branding;
			if (branding) {
				primaryColor = branding.primary_color;
				secondaryColor = branding.secondary_color;
				companyName = branding.company_name;
				customDomain = branding.custom_domain ?? '';
				emailFromName = branding.email_from_name ?? '';
			}
		} catch { toasts.error('Failed to load branding'); }
		finally { loading = false; }
	}

	async function handleSave() {
		saving = true;
		try {
			await api.request('/branding', { method: 'PUT', body: {
				primaryColor, secondaryColor, companyName,
				customDomain: customDomain || null,
				emailFromName: emailFromName || null,
			} });
			toasts.success('Branding updated');
			await loadBranding();
		} catch { toasts.error('Failed to save branding'); }
		finally { saving = false; }
	}

	async function initCustomDomain() {
		if (!customDomain.trim()) { toasts.error('Enter a domain first'); return; }
		initializingDomain = true;
		try {
			const res = await api.post<InitResponse>('/branding/custom-domain/init', { domain: customDomain.trim() });
			domainChallenge = res;
			toasts.success('TXT record challenge generated');
		} catch { toasts.error('Could not generate verification challenge'); }
		finally { initializingDomain = false; }
	}

	async function verifyCustomDomain() {
		verifying = true;
		try {
			const res = await api.post<VerifyResponse>('/branding/custom-domain/verify', {});
			if (res.verified) {
				toasts.success(`${res.domain} verified`);
				domainChallenge = null;
				await loadBranding();
			} else {
				toasts.error(res.message ?? 'TXT record not yet visible — DNS can take 5–30 min to propagate');
			}
		} catch { toasts.error('Verification request failed'); }
		finally { verifying = false; }
	}

	async function uploadLogo() {
		if (!logoFile) return;
		if (logoFile.size > 2 * 1024 * 1024) { toasts.error('Logo must be ≤ 2 MB'); return; }
		logoUploading = true;
		try {
			const res = await fetch('/api/branding/logo', {
				method: 'POST',
				credentials: 'include',
				headers: { 'Content-Type': logoFile.type },
				body: await logoFile.arrayBuffer(),
			});
			if (!res.ok) throw new Error(await res.text());
			toasts.success('Logo uploaded');
			logoFile = null;
			await loadBranding();
		} catch (err) {
			toasts.error(err instanceof Error ? err.message : 'Upload failed');
		} finally { logoUploading = false; }
	}

	function copyChallenge() {
		if (!domainChallenge) return;
		navigator.clipboard.writeText(domainChallenge.recordValue);
		toasts.success('Copied');
	}
</script>

<svelte:head><title>White-Label Branding | TenantIQ</title></svelte:head>

<div class="page-container">
	<header class="page-header">
		<a href="/settings" class="back-link"><ArrowLeft size={16} /> Settings</a>
		<h1><Palette size={24} /> White-Label Branding</h1>
		<p class="subtitle">Customize your portal appearance for clients.</p>
	</header>

	{#if loading}
		<div class="skeleton-grid">
			{#each Array(4) as _}<div class="skeleton-block"></div>{/each}
		</div>
	{:else}
		<div class="branding-layout">
			<form class="branding-form" onsubmit={(e) => { e.preventDefault(); handleSave(); }}>
				<div class="field">
					<label for="companyName">Company Name</label>
					<input id="companyName" type="text" bind:value={companyName}
						placeholder="Your Company" maxlength="200" />
				</div>

				<div class="color-row">
					<div class="field">
						<label for="primaryColor">Primary Color</label>
						<div class="color-input-group">
							<input id="primaryColor" type="color" bind:value={primaryColor} />
							<span class="color-hex">{primaryColor}</span>
						</div>
					</div>
					<div class="field">
						<label for="secondaryColor">Secondary Color</label>
						<div class="color-input-group">
							<input id="secondaryColor" type="color" bind:value={secondaryColor} />
							<span class="color-hex">{secondaryColor}</span>
						</div>
					</div>
				</div>

				<div class="field">
					<label for="customDomain">Custom Domain</label>
					<div class="domain-row">
						<input id="customDomain" type="text" bind:value={customDomain}
							placeholder="portal.yourcompany.com" />
						{#if branding?.custom_domain_status === 'verified'}
							<span class="badge-verified" title={branding.custom_domain_verified_at ?? ''}>✓ Verified</span>
						{:else if branding?.custom_domain_status === 'pending'}
							<span class="badge-pending">Pending</span>
						{/if}
					</div>
					<div class="domain-actions">
						<button type="button" class="btn-secondary btn-sm" onclick={initCustomDomain} disabled={initializingDomain || !customDomain.trim()}>
							{initializingDomain ? 'Generating...' : 'Generate verification token'}
						</button>
						{#if domainChallenge || branding?.custom_domain_status === 'pending'}
							<button type="button" class="btn-secondary btn-sm" onclick={verifyCustomDomain} disabled={verifying}>
								{verifying ? 'Checking DNS...' : 'Verify DNS'}
							</button>
						{/if}
					</div>
					{#if domainChallenge}
						<div class="challenge-card">
							<p class="challenge-instruction">Add this TXT record at your DNS provider:</p>
							<dl class="challenge-fields">
								<dt>Type</dt><dd>{domainChallenge.recordType}</dd>
								<dt>Name</dt><dd><code>{domainChallenge.recordName}</code></dd>
								<dt>Value</dt><dd>
									<code class="token">{domainChallenge.recordValue}</code>
									<button type="button" class="btn-tiny" onclick={copyChallenge}>Copy</button>
								</dd>
							</dl>
							<p class="challenge-hint">DNS can take 5–30 minutes to propagate. After publishing, click <strong>Verify DNS</strong>.</p>
						</div>
					{/if}
				</div>

				<div class="field">
					<label for="emailFromName">Email From Name</label>
					<input id="emailFromName" type="text" bind:value={emailFromName}
						placeholder="Your Company Security" maxlength="100" />
				</div>

				<div class="field">
					<label for="logoFile">Logo</label>
					{#if branding?.logo_url}
						<img src={branding.logo_url} alt="Current logo" class="logo-preview" />
					{/if}
					<div class="upload-area">
						<Upload size={24} />
						<input id="logoFile" type="file" accept="image/png,image/jpeg,image/svg+xml"
							onchange={(e) => { logoFile = (e.currentTarget as HTMLInputElement).files?.[0] ?? null; }}
						/>
						<span>PNG, JPEG, or SVG up to 2 MB</span>
						{#if logoFile}
							<button type="button" class="btn-secondary btn-sm" onclick={uploadLogo} disabled={logoUploading}>
								{logoUploading ? 'Uploading...' : `Upload ${logoFile.name}`}
							</button>
						{/if}
					</div>
				</div>

				<div class="actions">
					<button type="button" class="btn-secondary" onclick={() => showPreview = !showPreview}>
						<Eye size={16} /> {showPreview ? 'Hide' : 'Show'} Preview
					</button>
					<button type="submit" class="btn-primary" disabled={saving}>
						{saving ? 'Saving...' : 'Save Branding'}
					</button>
				</div>
			</form>

			{#if showPreview}
				<div class="preview-pane" style="--preview-primary: {primaryColor}; --preview-secondary: {secondaryColor};">
					<h3>Preview</h3>
					<div class="preview-header" style="background: {primaryColor};">
						<span class="preview-logo">{companyName || 'Your Company'}</span>
					</div>
					<div class="preview-body">
						<div class="preview-btn" style="background: {primaryColor};">Primary Button</div>
						<div class="preview-btn" style="background: {secondaryColor};">Secondary Button</div>
						<p class="preview-text">Portal branded for <strong>{companyName || 'Your Company'}</strong></p>
					</div>
				</div>
			{/if}
		</div>
	{/if}
</div>

<style>
	.page-container { max-width: 900px; margin: 0 auto; padding: 2rem 1.5rem; }
	.page-header { margin-bottom: 2rem; }
	.page-header h1 { display: flex; align-items: center; gap: 0.5rem; font-size: 1.5rem; margin: 0.5rem 0; }
	.subtitle { color: var(--text-secondary, #6b7280); margin: 0; }
	.back-link { display: inline-flex; align-items: center; gap: 0.25rem; color: var(--text-secondary); text-decoration: none; font-size: 0.875rem; }
	.skeleton-grid { display: grid; gap: 1rem; }
	.skeleton-block { height: 3rem; border-radius: 0.5rem; background: var(--skeleton-bg, #e5e7eb); animation: pulse 1.5s infinite; }
	@keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.5; } }
	.branding-layout { display: grid; grid-template-columns: 1fr; gap: 2rem; }
	.branding-form { display: flex; flex-direction: column; gap: 1.25rem; }
	.field label { display: block; font-weight: 500; margin-bottom: 0.375rem; font-size: 0.875rem; }
	.field input[type="text"] { width: 100%; padding: 0.5rem 0.75rem; border: 1px solid var(--border, #d1d5db); border-radius: 0.375rem; font-size: 0.875rem; background: var(--input-bg, #fff); color: var(--text-primary, #111); }
	.color-row { display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; }
	.color-input-group { display: flex; align-items: center; gap: 0.5rem; }
	.color-input-group input[type="color"] { width: 2.5rem; height: 2.5rem; border: 1px solid var(--border); border-radius: 0.375rem; cursor: pointer; padding: 0.125rem; }
	.color-hex { font-family: monospace; font-size: 0.875rem; color: var(--text-secondary); }
	.upload-area { border: 2px dashed var(--border, #d1d5db); border-radius: 0.5rem; padding: 2rem; text-align: center; color: var(--text-secondary); display: flex; flex-direction: column; align-items: center; gap: 0.5rem; cursor: pointer; }
	.actions { display: flex; gap: 0.75rem; justify-content: flex-end; margin-top: 0.5rem; }
	.btn-primary { padding: 0.5rem 1.25rem; border-radius: 0.375rem; background: var(--color-primary, #2563eb); color: #fff; border: none; font-weight: 500; cursor: pointer; }
	.btn-primary:disabled { opacity: 0.5; }
	.btn-secondary { padding: 0.5rem 1.25rem; border-radius: 0.375rem; background: var(--surface, #f3f4f6); color: var(--text-primary); border: 1px solid var(--border); font-weight: 500; cursor: pointer; display: inline-flex; align-items: center; gap: 0.375rem; }
	.preview-pane { border: 1px solid var(--border); border-radius: 0.75rem; overflow: hidden; }
	.preview-pane h3 { padding: 0.75rem 1rem; margin: 0; font-size: 0.875rem; border-bottom: 1px solid var(--border); }
	.preview-header { padding: 1rem; color: #fff; font-weight: 600; }
	.preview-body { padding: 1rem; display: flex; flex-direction: column; gap: 0.75rem; }
	.preview-btn { display: inline-block; padding: 0.5rem 1rem; border-radius: 0.375rem; color: #fff; font-size: 0.8125rem; width: fit-content; }
	.preview-text { font-size: 0.875rem; color: var(--text-secondary); margin: 0; }

	@media (min-width: 768px) {
		.branding-layout { grid-template-columns: 1fr 1fr; }
	}

	.domain-row { display: flex; align-items: center; gap: 0.5rem; }
	.domain-actions { display: flex; gap: 0.5rem; margin-top: 0.5rem; }
	.btn-sm { padding: 0.375rem 0.75rem; font-size: 0.8125rem; }
	.btn-tiny { padding: 0.25rem 0.5rem; font-size: 0.75rem; border-radius: 0.25rem; background: var(--surface, #f3f4f6); border: 1px solid var(--border); cursor: pointer; }
	.badge-verified { font-size: 0.75rem; padding: 0.25rem 0.5rem; border-radius: 1rem; background: rgba(34, 197, 94, 0.15); color: #16a34a; font-weight: 500; }
	.badge-pending { font-size: 0.75rem; padding: 0.25rem 0.5rem; border-radius: 1rem; background: rgba(245, 158, 11, 0.15); color: #d97706; font-weight: 500; }
	.challenge-card { margin-top: 0.75rem; padding: 1rem; border: 1px solid var(--border); border-radius: 0.5rem; background: var(--surface, #f9fafb); }
	.challenge-instruction { margin: 0 0 0.75rem 0; font-size: 0.875rem; font-weight: 500; }
	.challenge-fields { display: grid; grid-template-columns: 5rem 1fr; gap: 0.5rem; margin: 0; font-size: 0.875rem; }
	.challenge-fields dt { color: var(--text-secondary, #6b7280); font-weight: 500; }
	.challenge-fields dd { margin: 0; display: flex; align-items: center; gap: 0.5rem; }
	.challenge-fields code { font-family: 'SF Mono', Menlo, monospace; font-size: 0.8125rem; padding: 0.125rem 0.375rem; background: var(--input-bg, #fff); border: 1px solid var(--border); border-radius: 0.25rem; }
	.challenge-fields code.token { word-break: break-all; max-width: 28rem; }
	.challenge-hint { margin: 0.75rem 0 0 0; font-size: 0.8125rem; color: var(--text-secondary, #6b7280); }
	.logo-preview { max-height: 4rem; max-width: 12rem; margin-bottom: 0.5rem; border: 1px solid var(--border); border-radius: 0.375rem; padding: 0.5rem; background: var(--input-bg, #fff); }

	:global(.dark) .skeleton-block { background: #374151; }
	:global(.dark) .field input[type="text"] { background: #1f2937; border-color: #4b5563; color: #f9fafb; }
	:global(.dark) .upload-area { border-color: #4b5563; }
	:global(.dark) .challenge-card { background: #1f2937; }
	:global(.dark) .challenge-fields code { background: #111827; border-color: #374151; }
</style>
