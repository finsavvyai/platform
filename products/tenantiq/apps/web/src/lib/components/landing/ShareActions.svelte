<script lang="ts">
	let {
		loading,
		message,
		ongenerate,
		onsharetwitter,
		onsharelinkedin,
		oncopy,
		copied,
	}: {
		loading: boolean;
		message: string;
		ongenerate: () => void;
		onsharetwitter: () => void;
		onsharelinkedin: () => void;
		oncopy: () => void;
		copied: boolean;
	} = $props();
</script>

<div class="actions">
	<button class="btn-generate" onclick={ongenerate} disabled={loading}>
		{#if loading}
			<span class="spinner"></span> Larry's writing...
		{:else}
			<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2v4m0 12v4m-7.07-3.93l2.83-2.83m8.49-8.49l2.83-2.83M2 12h4m12 0h4M4.93 4.93l2.83 2.83m8.49 8.49l2.83 2.83"/></svg>
			Generate rant
		{/if}
	</button>

	{#if message}
		<div class="share-btns">
			<button class="btn-share twitter" onclick={onsharetwitter} title="Post on X">
				<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>
				Post it
			</button>
			<button class="btn-share linkedin" onclick={onsharelinkedin} title="Share on LinkedIn">
				<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/></svg>
				Share it
			</button>
			<button class="btn-share copy" onclick={oncopy} title="Copy to clipboard">
				{#if copied}
					<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 6L9 17l-5-5"/></svg>
					Got it!
				{:else}
					<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></svg>
					Copy
				{/if}
			</button>
		</div>
	{/if}
</div>

<style>
	.actions { display: flex; flex-wrap: wrap; gap: 0.75rem; align-items: center; }

	.btn-generate {
		display: flex; align-items: center; gap: 0.5rem;
		padding: 0.65rem 1.25rem; border-radius: 10px;
		background: linear-gradient(135deg, #10b981, #059669); border: none;
		color: #fff; font-size: 0.85rem; font-weight: 600; cursor: pointer;
		transition: all 0.2s;
	}
	.btn-generate:hover:not(:disabled) { filter: brightness(1.1); box-shadow: 0 0 20px rgba(16,185,129,0.25); }
	.btn-generate:disabled { opacity: 0.6; cursor: not-allowed; }

	.spinner { width: 16px; height: 16px; border: 2px solid rgba(255,255,255,0.3); border-top-color: #fff; border-radius: 50%; animation: spin 0.6s linear infinite; }
	@keyframes spin { to { transform: rotate(360deg); } }

	.share-btns { display: flex; gap: 0.4rem; }
	.btn-share {
		display: flex; align-items: center; gap: 0.35rem;
		padding: 0.5rem 0.85rem; border-radius: 8px; border: 1px solid rgba(255,255,255,0.08);
		background: transparent; color: #94a3b8; font-size: 0.78rem; font-weight: 500;
		cursor: pointer; transition: all 0.2s;
	}
	.btn-share:hover { border-color: rgba(255,255,255,0.2); color: #e2e8f0; }
	.btn-share.twitter:hover { color: #f1f5f9; border-color: rgba(255,255,255,0.2); }
	.btn-share.linkedin:hover { color: #0a66c2; border-color: rgba(10,102,194,0.3); }
	.btn-share.copy:hover { color: #10b981; border-color: rgba(16,185,129,0.3); }

	@media (max-width: 480px) {
		.actions { flex-direction: column; align-items: stretch; }
		.btn-generate { justify-content: center; }
		.share-btns { justify-content: center; }
	}
</style>
