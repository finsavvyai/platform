<script lang="ts">
	import { tenant } from '$stores/tenant';
	import { tick } from 'svelte';
	import ToolExecutionCard from './ToolExecutionCard.svelte';
	import SuggestedActions from './SuggestedActions.svelte';

	interface ToolExecution { name: string; input?: Record<string, unknown>; duration?: number; success: boolean; summary?: string; error?: string }
	interface SuggestedAction { label: string; type: 'navigate' | 'remediate' | 'scan' | 'export'; target: string; description: string }
	interface Message { role: 'user' | 'assistant'; content: string; timestamp?: Date; toolExecutions?: ToolExecution[]; suggestedActions?: SuggestedAction[] }

	let messages = $state<Message[]>([]);
	let input = $state('');
	let sending = $state(false);
	let activeTools = $state<ToolExecution[]>([]);
	let chatContainer: HTMLDivElement;

	function scrollToBottom() { if (chatContainer) chatContainer.scrollTop = chatContainer.scrollHeight; }

	async function sendMessage() {
		if (!input.trim() || sending || !$tenant.currentTenantId) return;
		const question = input.trim();
		input = '';
		messages = [...messages, { role: 'user', content: question, timestamp: new Date() }];
		sending = true;
		activeTools = [];
		await tick();
		scrollToBottom();

		try {
			const res = await fetch(`/api/tenants/${$tenant.currentTenantId}/ai/stream`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				credentials: 'include',
				body: JSON.stringify({ message: question })
			});
			if (!res.ok || !res.body) throw new Error(`HTTP ${res.status}`);
			const reader = res.body.getReader();
			const decoder = new TextDecoder();
			let buffer = '', streamedText = '';
			const tools: ToolExecution[] = [];

			while (true) {
				const { done, value } = await reader.read();
				if (done) break;
				buffer += decoder.decode(value, { stream: true });
				const lines = buffer.split('\n');
				buffer = lines.pop() ?? '';
				for (const line of lines) {
					if (!line.startsWith('event: ')) continue;
					const eventType = line.slice(7).trim();
					const nextLine = lines[lines.indexOf(line) + 1];
					if (!nextLine?.startsWith('data: ')) continue;
					const data = JSON.parse(nextLine.slice(6));
					handleSSEEvent(eventType, data, tools);
					if (eventType === 'text') { streamedText += data.text; await tick(); scrollToBottom(); }
				}
			}
			const lastEvent = parseDoneEvent(buffer);
			messages = [...messages, {
				role: 'assistant', content: streamedText || lastEvent.response || 'No response',
				timestamp: new Date(), toolExecutions: tools.length > 0 ? tools : undefined, suggestedActions: lastEvent.suggestedActions
			}];
		} catch (e: unknown) {
			messages = [...messages, { role: 'assistant', content: `Error: ${e instanceof Error ? e.message : 'Unknown error'}`, timestamp: new Date() }];
		} finally { sending = false; activeTools = []; await tick(); scrollToBottom(); }
	}

	function handleSSEEvent(type: string, data: Record<string, unknown>, tools: ToolExecution[]) {
		if (type === 'tool_start') { tools.push({ name: data.name as string, input: data.input as Record<string, unknown>, success: true }); activeTools = [...tools]; }
		else if (type === 'tool_end') {
			const t = tools.find((x) => x.name === data.name && x.duration === undefined);
			if (t) { t.duration = data.duration as number; t.success = data.success as boolean; t.summary = data.summary as string; t.error = data.error as string; activeTools = [...tools]; }
		}
	}

	function parseDoneEvent(buf: string) {
		try { const m = buf.match(/data: (.+)/); if (m) return JSON.parse(m[1]); } catch {}
		return { response: '', suggestedActions: [] };
	}

	function handleKeydown(e: KeyboardEvent) { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); } }
	function useQuickAction(s: string) { input = s; sendMessage(); }
	const SUGGESTIONS = ['What are my top security risks?', 'How much am I wasting on licenses?', 'Which users are security risks?', 'Are we GDPR compliant?'];
</script>

<div class="flex h-full flex-col rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)]">
	<div bind:this={chatContainer} class="flex-1 overflow-auto p-4 space-y-4">
		{#if messages.length === 0}
			<div class="flex h-full items-center justify-center">
				<div class="text-center max-w-md">
					<div class="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-[var(--color-primary)]/10 text-3xl">🤖</div>
					<p class="text-lg font-semibold text-[var(--color-text)]">AI Assistant</p>
					<p class="mt-1 text-sm text-[var(--color-text-secondary)]">Ask natural language questions about your M365 tenant</p>
					<div class="mt-4 flex flex-wrap justify-center gap-2">
						{#each SUGGESTIONS as suggestion}
							<button onclick={() => useQuickAction(suggestion)} class="rounded-full border border-[var(--color-border)] px-3 py-1.5 text-xs text-[var(--color-text-secondary)] hover:bg-[var(--color-bg)] hover:border-[var(--color-primary)]">
								{suggestion}
							</button>
						{/each}
					</div>
				</div>
			</div>
		{:else}
			{#each messages as msg}
				<div class="flex {msg.role === 'user' ? 'justify-end' : 'justify-start'}">
					<div class="max-w-[80%] space-y-2">
						<div class="rounded-lg px-4 py-2
							{msg.role === 'user' ? 'bg-[var(--color-primary)] text-white' : 'bg-[var(--color-bg)] text-[var(--color-text)] border border-[var(--color-border)]'}">
							<p class="whitespace-pre-wrap text-sm">{msg.content}</p>
						</div>
						{#if msg.toolExecutions}
							<div class="space-y-1">
								{#each msg.toolExecutions as tool}
									<ToolExecutionCard {...tool} />
								{/each}
							</div>
						{/if}
						{#if msg.suggestedActions}
							<SuggestedActions actions={msg.suggestedActions} />
						{/if}
					</div>
				</div>
			{/each}
			{#if sending}
				<div class="flex justify-start">
					<div class="space-y-2">
						{#if activeTools.length > 0}
							{#each activeTools as tool}
								<ToolExecutionCard {...tool} />
							{/each}
						{/if}
						<div class="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] px-4 py-3">
							<div class="flex gap-1.5">
								<div class="h-2 w-2 animate-bounce rounded-full bg-[var(--color-text-secondary)]" style="animation-delay: 0ms"></div>
								<div class="h-2 w-2 animate-bounce rounded-full bg-[var(--color-text-secondary)]" style="animation-delay: 150ms"></div>
								<div class="h-2 w-2 animate-bounce rounded-full bg-[var(--color-text-secondary)]" style="animation-delay: 300ms"></div>
							</div>
						</div>
					</div>
				</div>
			{/if}
		{/if}
	</div>

	<div class="border-t border-[var(--color-border)] p-4">
		<div class="flex gap-2">
			<textarea bind:value={input} onkeydown={handleKeydown} placeholder="Ask about your tenant's security, licenses, compliance..." rows="2" class="flex-1 resize-none rounded-md border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 text-sm text-[var(--color-text)] placeholder:text-[var(--color-text-secondary)] focus:border-[var(--color-primary)] focus:outline-none"></textarea>
			<button onclick={sendMessage} disabled={!input.trim() || sending || !$tenant.currentTenantId} class="shrink-0 rounded-md bg-[var(--color-primary)] px-4 py-2 text-sm font-medium text-white hover:bg-[var(--color-primary-dark)] disabled:opacity-50 min-h-[44px] min-w-[64px]">
				Send
			</button>
		</div>
	</div>
</div>
