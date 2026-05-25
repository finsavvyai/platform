<script lang="ts">
	import { untrack } from 'svelte';
	import { X } from 'lucide-svelte';

	interface SSOFormData {
		provider: 'saml' | 'oidc';
		displayName: string;
		domain: string;
		issuerUrl: string;
		clientId: string;
		metadataUrl: string;
		certificate: string;
		jitEnabled: boolean;
		status?: 'active' | 'inactive';
	}

	interface Props {
		initial?: Partial<SSOFormData> | null;
		saving: boolean;
		onSave: (data: SSOFormData) => void;
		onCancel: () => void;
	}

	let { initial = null, saving, onSave, onCancel }: Props = $props();

	let provider = $state<'saml' | 'oidc'>(untrack(() => initial?.provider ?? 'oidc'));
	let displayName = $state(untrack(() => initial?.displayName ?? ''));
	let domain = $state(untrack(() => initial?.domain ?? ''));
	let issuerUrl = $state(untrack(() => initial?.issuerUrl ?? ''));
	let clientId = $state(untrack(() => initial?.clientId ?? ''));
	let metadataUrl = $state(untrack(() => initial?.metadataUrl ?? ''));
	let certificate = $state(untrack(() => initial?.certificate ?? ''));
	let jitEnabled = $state(untrack(() => initial?.jitEnabled ?? true));

	const isValid = $derived(displayName.trim() && domain.trim());
	const isEditing = $derived(Boolean(initial));

	function handleSubmit(e: SubmitEvent) {
		e.preventDefault();
		if (!isValid) return;
		onSave({
			provider, displayName: displayName.trim(), domain: domain.trim(),
			issuerUrl: issuerUrl.trim(), clientId: clientId.trim(),
			metadataUrl: metadataUrl.trim(), certificate: certificate.trim(),
			jitEnabled, status: initial?.status,
		});
	}

	const inputCls = 'w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 text-sm text-[var(--color-text)] placeholder:text-[var(--color-text-tertiary)] focus:border-[var(--color-primary)] focus:outline-none';
	const labelCls = 'block text-xs font-medium text-[var(--color-text-secondary)] mb-1';
</script>

<div class="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5">
	<div class="flex items-center justify-between mb-4">
		<h3 class="text-sm font-semibold text-[var(--color-text)]">
			{isEditing ? 'Edit SSO Connection' : 'New SSO Connection'}
		</h3>
		<button onclick={onCancel} class="cursor-pointer p-1 text-[var(--color-text-tertiary)] hover:text-[var(--color-text)]" aria-label="Cancel">
			<X size={16} />
		</button>
	</div>

	<form onsubmit={handleSubmit} class="space-y-4">
		<div class="grid grid-cols-2 gap-4">
			<div>
				<label for="sso-provider" class={labelCls}>Provider Type</label>
				<select id="sso-provider" bind:value={provider} class="{inputCls} cursor-pointer">
					<option value="oidc">OpenID Connect (OIDC)</option>
					<option value="saml">SAML 2.0</option>
				</select>
			</div>
			<div>
				<label for="sso-name" class={labelCls}>Display Name</label>
				<input id="sso-name" bind:value={displayName} placeholder="e.g. Okta, Entra ID" class={inputCls} required />
			</div>
		</div>

		<div>
			<label for="sso-domain" class={labelCls}>Email Domain</label>
			<input id="sso-domain" bind:value={domain} placeholder="example.com" class={inputCls} required />
			<p class="mt-1 text-[10px] text-[var(--color-text-tertiary)]">Users with this email domain will be routed to SSO.</p>
		</div>

		<div>
			<label for="sso-issuer" class={labelCls}>
				{provider === 'oidc' ? 'Issuer URL' : 'Identity Provider SSO URL'}
			</label>
			<input id="sso-issuer" bind:value={issuerUrl} placeholder={provider === 'oidc' ? 'https://login.microsoftonline.com/...' : 'https://idp.example.com/sso'} class={inputCls} />
		</div>

		{#if provider === 'oidc'}
			<div>
				<label for="sso-client" class={labelCls}>Client ID</label>
				<input id="sso-client" bind:value={clientId} placeholder="Application (client) ID" class={inputCls} />
			</div>
		{/if}

		<div>
			<label for="sso-metadata" class={labelCls}>Metadata URL</label>
			<input id="sso-metadata" bind:value={metadataUrl} placeholder={provider === 'oidc' ? 'https://.../.well-known/openid-configuration' : 'https://idp.example.com/metadata'} class={inputCls} />
		</div>

		{#if provider === 'saml'}
			<div>
				<label for="sso-cert" class={labelCls}>X.509 Certificate</label>
				<textarea id="sso-cert" bind:value={certificate} rows={4} placeholder="-----BEGIN CERTIFICATE-----&#10;...&#10;-----END CERTIFICATE-----" class="{inputCls} font-mono text-[11px] resize-y"></textarea>
			</div>
		{/if}

		<label class="flex items-center gap-2 text-xs text-[var(--color-text-secondary)] cursor-pointer">
			<input type="checkbox" bind:checked={jitEnabled} class="rounded" />
			Enable Just-in-Time (JIT) provisioning
		</label>
		<p class="text-[10px] text-[var(--color-text-tertiary)] -mt-2 ml-5">Automatically create user accounts on first SSO login.</p>

		<div class="flex justify-end gap-2 pt-2">
			<button type="button" onclick={onCancel} class="cursor-pointer rounded-lg border border-[var(--color-border)] px-4 py-2 text-xs font-medium text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-secondary)]">
				Cancel
			</button>
			<button type="submit" disabled={!isValid || saving} class="cursor-pointer rounded-lg bg-[var(--color-primary)] px-4 py-2 text-xs font-medium text-white hover:opacity-90 disabled:opacity-50">
				{saving ? 'Saving...' : isEditing ? 'Update Connection' : 'Create Connection'}
			</button>
		</div>
	</form>
</div>
