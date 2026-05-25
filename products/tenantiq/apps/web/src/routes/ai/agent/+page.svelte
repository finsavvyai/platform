<script lang="ts">
	import { tenant } from '$stores/tenant';
	import { api } from '$api/client';
	import { safeErrorMessage } from '$lib/utils/safe-error';
	import MessageBubble from '$components/agent/MessageBubble.svelte';
	import { untrack } from 'svelte';

	// ─── Types ────────────────────────────────────────────────────────────────

	interface AgentMessage {
		id: string;
		role: 'user' | 'assistant' | 'tool';
		content: string;
		toolName?: string;
		timestamp: Date;
	}

	interface RecipeOption {
		id: string;
		name: string;
		description: string;
		icon: string;
	}

	// ─── State ────────────────────────────────────────────────────────────────

	let messages = $state<AgentMessage[]>([]);
	let inputText = $state('');
	let sending = $state(false);
	let sessionId = $state<string | null>(null);
	let messagesEl = $state<HTMLDivElement | null>(null);

	const recipes: RecipeOption[] = [
		{ id: 'msp-morning', name: 'MSP Morning Check', description: 'Daily health overview', icon: 'sun' },
		{ id: 'incident-response', name: 'Incident Response', description: 'Investigate alerts', icon: 'shield' },
	];

	$effect(() => {
		if (messages.length && messagesEl) messagesEl.scrollTop = messagesEl.scrollHeight;
	});

	// ─── Send message ─────────────────────────────────────────────────────────

	async function sendMessage() {
		const text = inputText.trim();
		if (!text || sending) return;
		pushMsg('user', text);
		inputText = '';
		sending = true;

		try {
			const res = await api.post<{ sessionId: string; response: string; toolCalls?: Array<{ tool: string; output: string }> }>(
				'/ai/agent/chat',
				{ sessionId, message: text, tenantId: $tenant.currentTenantId },
			);
			sessionId = res.sessionId;
			for (const tc of res.toolCalls ?? []) pushMsg('tool', tc.output, tc.tool);
			pushMsg('assistant', res.response);
		} catch (err) {
			pushMsg('assistant', safeErrorMessage(err, 'Something went wrong. Please try again.'));
		} finally {
			sending = false;
		}
	}

	// ─── Launch recipe ────────────────────────────────────────────────────────

	async function launchRecipe(recipeId: string) {
		const recipe = recipes.find((r) => r.id === recipeId);
		if (!recipe || sending) return;
		pushMsg('user', `Run recipe: ${recipe.name}`);
		sending = true;

		try {
			const res = await api.post<{ sessionId: string; response: string; steps: Array<{ tool: string; output: string; success: boolean }> }>(
				'/ai/agent/recipe',
				{ sessionId, recipeId, tenantId: $tenant.currentTenantId },
			);
			sessionId = res.sessionId;
			for (const step of res.steps) pushMsg('tool', step.output, step.tool);
			pushMsg('assistant', res.response);
		} catch (err) {
			pushMsg('assistant', safeErrorMessage(err, 'Something went wrong. Please try again.'));
		} finally {
			sending = false;
		}
	}

	function pushMsg(role: AgentMessage['role'], content: string, toolName?: string) {
		messages = [...messages, { id: `${role}_${Date.now()}`, role, content, toolName, timestamp: new Date() }];
	}

	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); }
	}
</script>

<svelte:head><title>Agent Chat | TenantIQ</title></svelte:head>

<div class="flex h-[calc(100vh-7rem)] flex-col">
	<!-- Header -->
	<div class="flex items-center justify-between border-b border-[var(--color-border)] px-4 py-3">
		<div>
			<h1 class="text-lg font-bold text-[var(--color-text)]">Agent Chat</h1>
			<p class="text-xs text-[var(--color-text-secondary)]">Cross-platform orchestration</p>
		</div>
		{#if sessionId}
			<span class="rounded-full bg-green-100 px-2 py-0.5 text-xs text-green-700 dark:bg-green-900/30 dark:text-green-400">Active</span>
		{/if}
	</div>

	<!-- Recipe Quick Launch -->
	<div class="flex gap-2 border-b border-[var(--color-border)] px-4 py-2">
		{#each recipes as recipe}
			<button
				onclick={() => launchRecipe(recipe.id)}
				disabled={sending}
				class="flex items-center gap-1.5 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-1.5 text-xs font-medium text-[var(--color-text)] transition-colors hover:border-[var(--color-primary)] hover:text-[var(--color-primary)] disabled:opacity-50"
			>
				{recipe.name}
			</button>
		{/each}
	</div>

	<!-- Messages -->
	<div bind:this={messagesEl} class="flex-1 overflow-y-auto px-4 py-4 space-y-3" role="log" aria-label="Agent messages">
		{#if messages.length === 0}
			<div class="flex h-full items-center justify-center text-center">
				<div class="max-w-sm">
					<h2 class="text-base font-semibold text-[var(--color-text)]">Unified Agent</h2>
					<p class="mt-1 text-sm text-[var(--color-text-secondary)]">Ask anything or launch a recipe.</p>
				</div>
			</div>
		{/if}
		{#each messages as msg (msg.id)}
			<MessageBubble message={msg} />
		{/each}
		{#if sending}
			<div class="flex justify-start">
				<div class="flex items-center gap-1 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2">
					<span class="inline-block h-2 w-2 animate-bounce rounded-full bg-[var(--color-text-secondary)]"></span>
					<span class="inline-block h-2 w-2 animate-bounce rounded-full bg-[var(--color-text-secondary)] [animation-delay:0.1s]"></span>
					<span class="inline-block h-2 w-2 animate-bounce rounded-full bg-[var(--color-text-secondary)] [animation-delay:0.2s]"></span>
				</div>
			</div>
		{/if}
	</div>

	<!-- Input -->
	<div class="border-t border-[var(--color-border)] px-4 py-3">
		<div class="flex items-end gap-2">
			<textarea
				bind:value={inputText}
				onkeydown={handleKeydown}
				placeholder="Ask the agent anything..."
				rows={1}
				disabled={sending}
				class="flex-1 resize-none rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 text-sm text-[var(--color-text)] placeholder:text-[var(--color-text-secondary)] focus:border-[var(--color-primary)] focus:outline-none disabled:opacity-50"
				aria-label="Message input"
			></textarea>
			<button
				onclick={sendMessage}
				disabled={sending || !inputText.trim()}
				class="rounded-lg bg-[var(--color-primary)] px-4 py-2 text-sm font-medium text-white hover:bg-[var(--color-primary-dark)] disabled:opacity-50"
				aria-label="Send message"
			>Send</button>
		</div>
	</div>
</div>
