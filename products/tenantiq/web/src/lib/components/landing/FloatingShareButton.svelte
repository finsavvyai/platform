<script lang="ts">
	let open = $state(false);
	let message = $state('');
	let loading = $state(false);
	let copied = $state(false);

	const API = 'https://api.tenantiq.app';

	const QUIPS = [
		"*30 seconds of unbroken eye contact*",
		"Losing a friend over this one...",
		"Chair just rolled into the VP...",
		"Still has the bib on...",
		"Security has been called...",
	];
	let quip = $state(QUIPS[0]);

	async function generate() {
		loading = true;
		quip = QUIPS[Math.floor(Math.random() * QUIPS.length)];
		try {
			const res = await fetch(`${API}/api/share/generate`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ platform: 'twitter' }),
			});
			const data = await res.json();
			message = data.message;
		} catch {
			const res = await fetch(`${API}/api/share/random`);
			const data = await res.json();
			message = data.message;
		} finally {
			loading = false;
		}
	}

	function shareTwitter() {
		window.open(`https://x.com/intent/tweet?text=${encodeURIComponent(message)}`, '_blank', 'width=550,height=420');
	}

	function shareLinkedin() {
		window.open(`https://www.linkedin.com/sharing/share-offsite/?url=https://app.tenantiq.app&summary=${encodeURIComponent(message)}`, '_blank', 'width=550,height=520');
	}

	async function copyMsg() {
		await navigator.clipboard.writeText(message);
		copied = true;
		setTimeout(() => (copied = false), 2000);
	}

	function toggle() {
		open = !open;
		if (open && !message) generate();
	}
</script>

<div class="fab-wrap">
	{#if open}
		<!-- svelte-ignore a11y_no_static_element_interactions -->
		<div class="backdrop" onclick={() => (open = false)} onkeydown={(e) => e.key === 'Escape' && (open = false)}></div>
		<div class="popup">
			<div class="popup-header">
				<div class="popup-title-area">
					<span class="popup-title">Share the rant</span>
					<span class="popup-subtitle">Curb Your M365</span>
				</div>
				<button class="popup-close" onclick={() => (open = false)} aria-label="Close">
					<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6L6 18M6 6l12 12"/></svg>
				</button>
			</div>

			<div class="popup-msg">
				{#if loading}
					<div class="skel"><div class="skel-line"></div><div class="skel-line short"></div></div>
					<p class="quip">{quip}</p>
				{:else if message}
					<p>{message}</p>
				{:else}
					<p class="muted">"You opened this and you're NOT sharing? That's a social violation."</p>
				{/if}
			</div>

			<div class="popup-actions">
				<button class="btn-regen" onclick={generate} disabled={loading}>
					<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2v4m0 12v4m-7.07-3.93l2.83-2.83m8.49-8.49l2.83-2.83M2 12h4m12 0h4M4.93 4.93l2.83 2.83m8.49 8.49l2.83 2.83"/></svg>
					Another one
				</button>
				{#if message}
					<button class="btn-sm" onclick={shareTwitter} title="Post on X">
						<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>
					</button>
					<button class="btn-sm" onclick={shareLinkedin} title="Share on LinkedIn">
						<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/></svg>
					</button>
					<button class="btn-sm" onclick={copyMsg} title="Copy">
						{#if copied}
							<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 6L9 17l-5-5"/></svg>
						{:else}
							<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></svg>
						{/if}
					</button>
				{/if}
			</div>
		</div>
	{/if}

	<button class="fab" class:open onclick={toggle} aria-label="Share TenantIQ">
		{#if open}
			<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6L6 18M6 6l12 12"/></svg>
		{:else}
			<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 12v8a2 2 0 002 2h12a2 2 0 002-2v-8"/><polyline points="16 6 12 2 8 6"/><line x1="12" y1="2" x2="12" y2="15"/></svg>
		{/if}
	</button>
</div>

<style>
	.fab-wrap { position: fixed; bottom: 1.5rem; right: 1.5rem; z-index: 1000; }

	.fab {
		width: 52px; height: 52px; border-radius: 50%;
		background: linear-gradient(135deg, #10b981, #059669); border: none;
		color: #fff; cursor: pointer; display: flex; align-items: center; justify-content: center;
		box-shadow: 0 4px 20px rgba(16,185,129,0.35);
		transition: all 0.3s; animation: fab-enter 0.4s ease-out;
	}
	.fab:hover { transform: scale(1.08); box-shadow: 0 6px 28px rgba(16,185,129,0.45); }
	.fab.open { background: rgba(255,255,255,0.1); box-shadow: none; }
	@keyframes fab-enter { from { transform: scale(0) rotate(-90deg); opacity: 0; } to { transform: scale(1) rotate(0); opacity: 1; } }

	.backdrop { position: fixed; inset: 0; z-index: -1; }

	.popup {
		position: absolute; bottom: 64px; right: 0; width: 340px;
		background: #0f1419; border: 1px solid rgba(255,255,255,0.08);
		border-radius: 14px; box-shadow: 0 12px 40px rgba(0,0,0,0.5);
		animation: popup-in 0.25s ease-out; overflow: hidden;
	}
	@keyframes popup-in { from { opacity: 0; transform: translateY(8px) scale(0.95); } to { opacity: 1; transform: translateY(0) scale(1); } }

	.popup-header {
		display: flex; align-items: center; justify-content: space-between;
		padding: 0.85rem 1rem; background: linear-gradient(135deg, #1a1a2e, #16213e);
		border-bottom: 1px solid rgba(255,255,255,0.04);
	}
	.popup-title-area { display: flex; flex-direction: column; gap: 0.1rem; }
	.popup-title { font-size: 0.82rem; font-weight: 650; color: #f1f5f9; }
	.popup-subtitle { font-size: 0.62rem; color: #475569; font-family: Georgia, serif; font-style: italic; }
	.popup-close { background: none; border: none; color: #64748b; cursor: pointer; padding: 0.2rem; border-radius: 6px; }
	.popup-close:hover { color: #94a3b8; background: rgba(255,255,255,0.05); }

	.popup-msg { min-height: 56px; padding: 0.85rem 1rem; border-left: 3px solid rgba(16,185,129,0.25); margin: 0.75rem; border-radius: 0 8px 8px 0; background: rgba(255,255,255,0.02); }
	.popup-msg p { margin: 0; font-size: 0.8rem; line-height: 1.55; color: #cbd5e1; font-family: Georgia, serif; font-style: italic; }
	.popup-msg .muted { color: #475569; }
	.quip { margin: 0.5rem 0 0 0 !important; font-size: 0.68rem !important; color: #475569 !important; }

	.skel { display: flex; flex-direction: column; gap: 0.4rem; }
	.skel-line { height: 12px; border-radius: 3px; background: rgba(255,255,255,0.06); animation: shimmer 1.5s infinite; }
	.skel-line.short { width: 55%; }
	@keyframes shimmer { 0%, 100% { opacity: 0.4; } 50% { opacity: 0.8; } }

	.popup-actions { display: flex; gap: 0.4rem; align-items: center; padding: 0 1rem 0.85rem; }
	.btn-regen {
		display: flex; align-items: center; gap: 0.3rem;
		padding: 0.4rem 0.7rem; border-radius: 7px;
		background: rgba(16,185,129,0.12); border: 1px solid rgba(16,185,129,0.2);
		color: #10b981; font-size: 0.72rem; font-weight: 600; cursor: pointer; transition: all 0.2s;
	}
	.btn-regen:hover:not(:disabled) { background: rgba(16,185,129,0.2); }
	.btn-regen:disabled { opacity: 0.5; cursor: not-allowed; }

	.btn-sm {
		display: flex; align-items: center; justify-content: center;
		width: 32px; height: 32px; border-radius: 7px;
		border: 1px solid rgba(255,255,255,0.08); background: transparent;
		color: #94a3b8; cursor: pointer; transition: all 0.2s;
	}
	.btn-sm:hover { border-color: rgba(255,255,255,0.2); color: #e2e8f0; }

	@media (max-width: 480px) {
		.popup { width: calc(100vw - 2rem); right: -0.5rem; }
		.fab-wrap { bottom: 1rem; right: 1rem; }
	}
</style>
