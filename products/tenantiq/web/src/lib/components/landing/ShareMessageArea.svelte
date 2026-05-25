<script lang="ts">
	let { loading, message }: { loading: boolean; message: string } = $props();
</script>

<div class="message-area">
	{#if loading}
		<div class="skeleton">
			<div class="skeleton-line"></div>
			<div class="skeleton-line mid"></div>
			<div class="skeleton-line short"></div>
		</div>
		<p class="loading-quip">*stares at you while composing an unhinged rant*</p>
	{:else if message}
		<p class="generated">{message}</p>
	{:else}
		<p class="placeholder">"Go ahead. Hit the button. I DARE you. You won't. You're scared. That's fine. I get it. ...You're still not hitting it?"</p>
	{/if}
</div>

<style>
	.message-area { min-height: 100px; margin-bottom: 1.25rem; padding: 1.15rem; border-radius: 10px; background: rgba(0,0,0,0.25); border-left: 3px solid rgba(16,185,129,0.3); }
	.generated { color: #e2e8f0; font-size: 0.9rem; line-height: 1.65; margin: 0; font-family: Georgia, 'Times New Roman', serif; font-style: italic; }
	.placeholder { color: #475569; font-size: 0.88rem; font-style: italic; margin: 0; font-family: Georgia, 'Times New Roman', serif; }
	.loading-quip { color: #475569; font-size: 0.72rem; font-style: italic; margin: 0.6rem 0 0 0; font-family: Georgia, 'Times New Roman', serif; }
	.skeleton { display: flex; flex-direction: column; gap: 0.5rem; }
	.skeleton-line { height: 14px; border-radius: 4px; background: rgba(255,255,255,0.06); animation: shimmer 1.5s infinite; }
	.skeleton-line.mid { width: 80%; }
	.skeleton-line.short { width: 55%; }
	@keyframes shimmer { 0%, 100% { opacity: 0.4; } 50% { opacity: 0.8; } }
</style>
