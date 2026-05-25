<script lang="ts">
	interface Props {
		webhookUrl: string;
		webhookSecret: string;
		enabled: boolean;
		onUrlChange: (val: string) => void;
		onSecretChange: (val: string) => void;
		onEnabledChange: (val: boolean) => void;
	}

	let { webhookUrl, webhookSecret, enabled, onUrlChange, onSecretChange, onEnabledChange }: Props = $props();

	function generateSecret() {
		const array = new Uint8Array(32);
		crypto.getRandomValues(array);
		onSecretChange(Array.from(array, byte => byte.toString(16).padStart(2, '0')).join(''));
	}

	function copyUrl() {
		navigator.clipboard.writeText(webhookUrl);
	}
</script>

<section class="space-y-5 border-b border-[var(--color-border)] pb-6">
	<h3 class="text-sm font-semibold text-[var(--color-text)]">Webhook Endpoint</h3>

	<div class="space-y-1.5">
		<label for="webhook-url" class="block text-sm font-medium text-[var(--color-text)]">Webhook URL</label>
		<div class="flex gap-2">
			<input
				id="webhook-url"
				type="url"
				value={webhookUrl}
				oninput={(e) => onUrlChange((e.target as HTMLInputElement).value)}
				placeholder="https://openclaw.app/webhooks/tenantiq"
				class="min-h-[44px] flex-1 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] px-3 text-sm text-[var(--color-text)] transition-colors focus:border-[var(--color-primary)] focus:outline-none"
			/>
			<button onclick={copyUrl} class="min-h-[44px] shrink-0 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-4 text-sm font-medium text-[var(--color-text-secondary)] transition-colors hover:bg-[var(--color-bg)]">Copy</button>
		</div>
		<p class="text-xs text-[var(--color-text-secondary)]">The URL where TenantIQ will send webhook notifications</p>
	</div>

	<div class="space-y-1.5">
		<label for="webhook-secret" class="block text-sm font-medium text-[var(--color-text)]">Webhook Secret</label>
		<div class="flex gap-2">
			<input
				id="webhook-secret"
				type="password"
				value={webhookSecret}
				oninput={(e) => onSecretChange((e.target as HTMLInputElement).value)}
				placeholder="Secure random string"
				class="min-h-[44px] flex-1 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] px-3 text-sm text-[var(--color-text)] transition-colors focus:border-[var(--color-primary)] focus:outline-none"
			/>
			<button onclick={generateSecret} class="min-h-[44px] shrink-0 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-4 text-sm font-medium text-[var(--color-text-secondary)] transition-colors hover:bg-[var(--color-bg)]">Generate</button>
		</div>
		<p class="text-xs text-[var(--color-text-secondary)]">HMAC secret for verifying webhook signatures</p>
	</div>

	<label class="flex min-h-[44px] cursor-pointer items-center gap-3">
		<input type="checkbox" checked={enabled} onchange={(e) => onEnabledChange((e.target as HTMLInputElement).checked)} class="h-5 w-5 cursor-pointer rounded accent-[var(--color-primary)]" />
		<span class="text-sm font-medium text-[var(--color-text)]">Enable webhook notifications</span>
	</label>
</section>
