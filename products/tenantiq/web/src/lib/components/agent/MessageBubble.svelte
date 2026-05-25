<script lang="ts">
	interface AgentMessage {
		id: string;
		role: 'user' | 'assistant' | 'tool';
		content: string;
		toolName?: string;
		timestamp: Date;
	}

	interface Props {
		message: AgentMessage;
	}

	let { message }: Props = $props();

	function formatTime(date: Date): string {
		return new Date(date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
	}
</script>

<div class="flex {message.role === 'user' ? 'justify-end' : 'justify-start'}">
	<div class="max-w-[75%] rounded-lg px-3 py-2 text-sm
		{message.role === 'user'
			? 'bg-[var(--color-primary)] text-white'
			: message.role === 'tool'
				? 'border border-[var(--color-border)] bg-[var(--color-bg)] font-mono text-xs'
				: 'bg-[var(--color-surface)] text-[var(--color-text)] border border-[var(--color-border)]'}">
		{#if message.role === 'tool' && message.toolName}
			<div class="mb-1 text-[10px] font-semibold text-[var(--color-text-secondary)]">
				{message.toolName}
			</div>
		{/if}
		<p class="whitespace-pre-wrap">{message.content}</p>
		<div class="mt-1 text-[10px] opacity-60">{formatTime(message.timestamp)}</div>
	</div>
</div>
