<script lang="ts">
	import { MessageCircle, X, Send, ArrowRight } from 'lucide-svelte';
	import { findResponse } from './chat-responses';
	import { page } from '$app/stores';
	import { auth } from '$stores/auth';

	interface Message {
		role: 'user' | 'assistant';
		text: string;
		link?: string;
	}

	const hideOnAiPage = $derived($page.url.pathname === '/ai');
	const hideForGuests = $derived(!$auth.user);
	let isOpen = $state(false);
	let input = $state('');
	let messages = $state<Message[]>([
		{ role: 'assistant', text: 'Hi! I\'m the TenantIQ Guide. Ask me about features, navigation, or how to get started.' },
	]);
	let isTyping = $state(false);
	let listEl = $state<HTMLElement | null>(null);

	function scrollToBottom() {
		requestAnimationFrame(() => { listEl?.scrollTo({ top: listEl.scrollHeight, behavior: 'smooth' }); });
	}

	function send() {
		const q = input.trim();
		if (!q) return;
		messages = [...messages, { role: 'user', text: q }];
		input = '';
		isTyping = true;
		scrollToBottom();

		setTimeout(() => {
			const { answer, link } = findResponse(q);
			messages = [...messages, { role: 'assistant', text: answer, link }];
			isTyping = false;
			scrollToBottom();
		}, 600);
	}

	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); }
	}
</script>

<!-- Floating trigger button -->
{#if !isOpen && !hideOnAiPage && !hideForGuests}
	<button
		onclick={() => (isOpen = true)}
		aria-label="Open chat guide"
		class="fixed bottom-20 right-6 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-[var(--color-primary)] text-white shadow-[var(--shadow-lg)] transition-transform duration-200 hover:scale-105 active:scale-95"
	>
		<MessageCircle size={24} />
	</button>
{/if}

<!-- Chat panel -->
{#if isOpen && !hideOnAiPage && !hideForGuests}
	<div class="fixed bottom-20 right-6 z-50 flex w-[380px] max-w-[calc(100vw-2rem)] flex-col overflow-hidden rounded-2xl border border-white/10 shadow-[var(--shadow-xl)]"
		style="height: 500px; background: color-mix(in srgb, var(--color-surface) 85%, transparent); backdrop-filter: blur(20px) saturate(180%);"
	>
		<!-- Header -->
		<div class="flex items-center justify-between border-b border-[var(--color-border)] px-4 py-3">
			<div class="flex items-center gap-2">
				<div class="flex h-7 w-7 items-center justify-center rounded-full bg-[var(--color-primary)]/15">
					<MessageCircle size={14} class="text-[var(--color-primary)]" />
				</div>
				<span class="text-sm font-semibold text-[var(--color-text)]">TenantIQ Guide</span>
				<span class="rounded-full bg-[var(--color-success)]/15 px-1.5 py-0.5 text-[9px] font-bold uppercase text-[var(--color-success)]">Free</span>
			</div>
			<button onclick={() => (isOpen = false)} aria-label="Close chat" class="rounded-lg p-1 text-[var(--color-text-secondary)] transition-colors hover:bg-[var(--color-bg-tertiary)]">
				<X size={16} />
			</button>
		</div>

		<!-- Messages -->
		<div bind:this={listEl} class="flex-1 space-y-3 overflow-y-auto px-4 py-3">
			{#each messages as msg (msg)}
				<div class="flex {msg.role === 'user' ? 'justify-end' : 'justify-start'}">
					<div class="max-w-[85%] rounded-2xl px-3.5 py-2.5 text-[13px] leading-relaxed {msg.role === 'user'
						? 'bg-[var(--color-primary)] text-white'
						: 'bg-[var(--color-bg-tertiary)] text-[var(--color-text)]'}"
					>
						{msg.text}
						{#if msg.link && msg.role === 'assistant'}
							<a href={msg.link} onclick={() => (isOpen = false)}
								class="mt-1.5 flex items-center gap-1 text-[12px] font-medium text-[var(--color-primary)]"
							>
								Go to page <ArrowRight size={12} />
							</a>
						{/if}
					</div>
				</div>
			{/each}
			{#if isTyping}
				<div class="flex justify-start">
					<div class="flex gap-1 rounded-2xl bg-[var(--color-bg-tertiary)] px-4 py-3">
						<span class="h-1.5 w-1.5 animate-bounce rounded-full bg-[var(--color-text-secondary)]" style="animation-delay: 0ms"></span>
						<span class="h-1.5 w-1.5 animate-bounce rounded-full bg-[var(--color-text-secondary)]" style="animation-delay: 150ms"></span>
						<span class="h-1.5 w-1.5 animate-bounce rounded-full bg-[var(--color-text-secondary)]" style="animation-delay: 300ms"></span>
					</div>
				</div>
			{/if}
		</div>

		<!-- Upgrade banner -->
		<div class="border-t border-[var(--color-border)] px-4 py-2">
			<a href="/ai" onclick={() => (isOpen = false)}
				class="flex items-center justify-center gap-1.5 rounded-lg bg-[var(--color-primary)]/10 px-3 py-1.5 text-[11px] font-medium text-[var(--color-primary)] transition-colors hover:bg-[var(--color-primary)]/20"
			>
				Need deeper analysis? Try the AI Agent <ArrowRight size={11} />
			</a>
		</div>

		<!-- Input -->
		<div class="border-t border-[var(--color-border)] px-3 py-2.5">
			<div class="flex items-center gap-2">
				<input
					bind:value={input}
					onkeydown={handleKeydown}
					placeholder="Ask about features..."
					class="min-h-[36px] flex-1 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 text-sm text-[var(--color-text)] placeholder:text-[var(--color-text-tertiary)] focus:border-[var(--color-primary)] focus:outline-none"
				/>
				<button onclick={send} disabled={!input.trim()} aria-label="Send message"
					class="flex h-9 w-9 items-center justify-center rounded-xl bg-[var(--color-primary)] text-white transition-opacity disabled:opacity-40"
				>
					<Send size={16} />
				</button>
			</div>
		</div>
	</div>
{/if}
