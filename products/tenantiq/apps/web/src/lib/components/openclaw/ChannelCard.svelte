<script lang="ts">
	interface Props {
		platform: {
			id: string;
			name: string;
			icon: string;
			enabled: boolean;
			connected: boolean;
			channelId?: string;
			channelName?: string;
		};
		onConnect?: () => void;
		onDisconnect?: () => void;
	}

	let { platform, onConnect, onDisconnect }: Props = $props();
</script>

<div
	class="relative flex items-center gap-4 rounded-xl border-2 p-5 transition-all duration-[var(--duration-fast)]
		{platform.connected
			? 'border-[var(--color-success)]/30 bg-[var(--color-success)]/5'
			: 'border-[var(--color-border)] bg-[var(--color-surface)] hover:border-[var(--color-primary)]/40 hover:shadow-[var(--shadow-sm)]'}"
>
	<span class="shrink-0 text-4xl">{platform.icon}</span>

	<div class="min-w-0 flex-1">
		<h3 class="text-base font-semibold text-[var(--color-text)]">{platform.name}</h3>
		{#if platform.connected && platform.channelName}
			<p class="mt-0.5 text-sm font-medium text-[var(--color-success)]">{platform.channelName}</p>
		{:else}
			<p class="mt-0.5 text-sm text-[var(--color-text-secondary)]">Not connected</p>
		{/if}
	</div>

	<div class="shrink-0">
		{#if platform.connected}
			<button
				onclick={onDisconnect}
				class="min-h-[44px] rounded-lg bg-[var(--color-danger)] px-4 py-2 text-sm font-semibold text-white transition-colors hover:opacity-90"
			>
				Disconnect
			</button>
		{:else}
			<button
				onclick={onConnect}
				disabled={!platform.enabled}
				class="min-h-[44px] rounded-lg bg-[var(--color-primary)] px-4 py-2 text-sm font-semibold text-white transition-colors hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
			>
				Connect
			</button>
		{/if}
	</div>

	<div
		class="absolute right-4 top-4 h-3 w-3 rounded-full
			{platform.connected
				? 'bg-[var(--color-success)] shadow-[0_0_0_3px_var(--color-success)]/20'
				: 'bg-[var(--color-text-tertiary)]'}"
	></div>
</div>
