<script lang="ts">
	import WebhookEndpointForm from './WebhookEndpointForm.svelte';
	import NotificationSettings from './NotificationSettings.svelte';
	import QuietHoursForm from './QuietHoursForm.svelte';

	interface Props {
		config: {
			webhookUrl: string;
			webhookSecret: string;
			enabled: boolean;
			notificationMode: 'realtime' | 'digest';
			minSeverity?: 'low' | 'medium' | 'high' | 'critical';
			categories: string[];
			quietHoursStart?: string;
			quietHoursEnd?: string;
		};
		onSave?: () => void;
	}

	let { config, onSave }: Props = $props();
</script>

<div class="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-6 shadow-[var(--shadow-sm)]">
	<div class="mb-6">
		<h2 class="text-lg font-semibold text-[var(--color-text)]">Webhook Configuration</h2>
		<p class="mt-1 text-sm text-[var(--color-text-secondary)]">Configure real-time notifications for OpenClaw integration</p>
	</div>

	<div class="space-y-6">
		<WebhookEndpointForm
			webhookUrl={config.webhookUrl}
			webhookSecret={config.webhookSecret}
			enabled={config.enabled}
			onUrlChange={(v) => (config.webhookUrl = v)}
			onSecretChange={(v) => (config.webhookSecret = v)}
			onEnabledChange={(v) => (config.enabled = v)}
		/>

		<NotificationSettings
			notificationMode={config.notificationMode}
			minSeverity={config.minSeverity ?? 'low'}
			categories={config.categories}
			onModeChange={(v) => (config.notificationMode = v)}
			onSeverityChange={(v) => (config.minSeverity = v as 'low' | 'medium' | 'high' | 'critical')}
			onCategoriesChange={(v) => (config.categories = v)}
		/>

		<QuietHoursForm
			quietHoursStart={config.quietHoursStart ?? ''}
			quietHoursEnd={config.quietHoursEnd ?? ''}
			onStartChange={(v) => (config.quietHoursStart = v)}
			onEndChange={(v) => (config.quietHoursEnd = v)}
		/>
	</div>

	<div class="mt-6 flex justify-end">
		<button
			onclick={onSave}
			class="min-h-[44px] rounded-lg bg-[var(--color-success)] px-6 py-2.5 text-sm font-semibold text-white transition-colors hover:opacity-90"
		>
			Save Configuration
		</button>
	</div>
</div>
