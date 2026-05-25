<script lang="ts">
	import ChannelCard from './ChannelCard.svelte';

	interface Platform {
		id: string; name: string; icon: string; enabled: boolean;
		connected: boolean; channelId?: string; channelName?: string;
	}

	interface Props {
		platforms: Platform[];
		onConnect: (id: string) => void;
		onDisconnect: (id: string) => void;
	}

	let { platforms, onConnect, onDisconnect }: Props = $props();
</script>

<div class="space-y-8">
	<div class="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-6">
		<h2 class="text-lg font-semibold text-[var(--color-text)]">Connected Platforms</h2>
		<p class="mt-1 text-sm text-[var(--color-text-secondary)]">Connect TenantIQ to your messaging platforms to manage tenants from anywhere</p>

		<div class="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2">
			{#each platforms as platform}
				<ChannelCard
					{platform}
					onConnect={() => onConnect(platform.id)}
					onDisconnect={() => onDisconnect(platform.id)}
				/>
			{/each}
		</div>
	</div>

	<section class="rounded-xl bg-[var(--color-bg-tertiary)] p-5">
		<h3 class="mb-3 font-semibold text-[var(--color-text)]">How It Works</h3>
		<ol class="ml-5 list-decimal space-y-1.5 text-sm text-[var(--color-text-secondary)]">
			<li>Click "Connect" on any platform</li>
			<li>Authorize OpenClaw to access your account</li>
			<li>Select which channels/groups to enable TenantIQ in</li>
			<li>Start using commands in your messaging app</li>
		</ol>
	</section>
</div>
