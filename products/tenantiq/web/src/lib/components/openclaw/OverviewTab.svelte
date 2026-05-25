<script lang="ts">
	interface Props {
		commandCount: number;
		connectedCount: number;
		totalPlatforms: number;
		webhookEnabled: boolean;
		notificationMode: string;
		skillInstalled: boolean;
		hasWebhookUrl: boolean;
		hasPlatformConnected: boolean;
		onGoToChannels: () => void;
		onGoToWebhooks: () => void;
		onCopyInstall: () => void;
	}

	let {
		commandCount, connectedCount, totalPlatforms, webhookEnabled,
		notificationMode, skillInstalled, hasWebhookUrl, hasPlatformConnected,
		onGoToChannels, onGoToWebhooks, onCopyInstall
	}: Props = $props();

	const stats = $derived([
		{ icon: '🎯', value: String(commandCount), label: 'Available Commands' },
		{ icon: '📱', value: `${connectedCount}/${totalPlatforms}`, label: 'Connected Platforms' },
		{ icon: '🔔', value: webhookEnabled ? 'Active' : 'Inactive', label: 'Webhook Status' },
		{ icon: '⚡', value: notificationMode, label: 'Notification Mode' }
	]);

	const steps = $derived([
		{ num: 1, title: 'Install OpenClaw Skill', desc: 'Run the install command in your OpenClaw instance:', done: skillInstalled, action: 'copy' as const },
		{ num: 2, title: 'Connect Messaging Platforms', desc: 'Connect your preferred messaging platforms (Slack, Teams, Discord, etc.)', done: hasPlatformConnected, action: 'channels' as const },
		{ num: 3, title: 'Configure Webhooks', desc: 'Set up webhook notifications for real-time alerts', done: !!hasWebhookUrl, action: 'webhooks' as const },
		{ num: 4, title: 'Start Using Commands', desc: 'Try: tenantiq security status or tenantiq license waste', done: false, action: null }
	]);

	const features = [
		{ icon: '🔒', title: 'Security Monitoring', desc: 'Check security status, MFA adoption, and risky users from any platform' },
		{ icon: '💰', title: 'License Optimization', desc: 'Find license waste, inactive users, and optimize costs automatically' },
		{ icon: '👥', title: 'User Management', desc: 'Search users, manage guests, and reset passwords on-the-go' },
		{ icon: '📋', title: 'Compliance', desc: 'Track compliance status, audit trails, and orphaned groups' },
		{ icon: '🤖', title: 'AI Assistant', desc: 'Ask questions and get intelligent recommendations powered by Claude' },
		{ icon: '🔔', title: 'Real-time Alerts', desc: 'Get instant notifications for critical security and compliance issues' }
	];
</script>

<div class="space-y-8">
	<div class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
		{#each stats as stat}
			<div class="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5 text-center">
				<p class="text-3xl">{stat.icon}</p>
				<p class="mt-2 text-2xl font-bold text-[var(--color-primary)]">{stat.value}</p>
				<p class="mt-1 text-sm text-[var(--color-text-secondary)]">{stat.label}</p>
			</div>
		{/each}
	</div>

	<section class="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-6">
		<h2 class="mb-5 text-lg font-semibold text-[var(--color-text)]">Quick Start</h2>
		<div class="space-y-4">
			{#each steps as step}
				<div class="flex gap-4 rounded-xl border-2 p-4 transition-colors {step.done ? 'border-[var(--color-success)]/30 bg-[var(--color-success)]/5' : 'border-[var(--color-border)]'}">
					<div class="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-lg font-bold {step.done ? 'bg-[var(--color-success)] text-white' : 'bg-[var(--color-bg-tertiary)] text-[var(--color-text)]'}">
						{step.num}
					</div>
					<div class="flex-1">
						<h3 class="font-semibold text-[var(--color-text)]">{step.title}</h3>
						<p class="mt-1 text-sm text-[var(--color-text-secondary)]">{step.desc}</p>
						{#if step.action === 'copy'}
							<div class="mt-2 flex items-center gap-2 rounded-lg bg-[var(--color-bg-tertiary)] px-3 py-2">
								<code class="flex-1 text-sm font-medium text-[var(--color-text)]">openclaw install tenantiq</code>
								<button onclick={onCopyInstall} class="min-h-[44px] rounded-lg bg-[var(--color-primary)] px-4 text-sm font-medium text-white transition-colors hover:opacity-90">Copy</button>
							</div>
						{:else if step.action === 'channels'}
							<button onclick={onGoToChannels} class="mt-2 min-h-[44px] rounded-lg bg-[var(--color-primary)] px-4 py-2 text-sm font-medium text-white transition-colors hover:opacity-90">Connect Platforms</button>
						{:else if step.action === 'webhooks'}
							<button onclick={onGoToWebhooks} class="mt-2 min-h-[44px] rounded-lg bg-[var(--color-primary)] px-4 py-2 text-sm font-medium text-white transition-colors hover:opacity-90">Configure Webhooks</button>
						{/if}
					</div>
				</div>
			{/each}
		</div>
	</section>

	<section>
		<h2 class="mb-4 text-lg font-semibold text-[var(--color-text)]">Features</h2>
		<div class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
			{#each features as feat}
				<div class="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5">
					<p class="text-3xl">{feat.icon}</p>
					<h3 class="mt-3 font-semibold text-[var(--color-text)]">{feat.title}</h3>
					<p class="mt-1 text-sm text-[var(--color-text-secondary)]">{feat.desc}</p>
				</div>
			{/each}
		</div>
	</section>
</div>
