<script lang="ts">
	import ShareMessageArea from './ShareMessageArea.svelte';
	import ShareActions from './ShareActions.svelte';

	let message = $state('');
	let loading = $state(false);
	let copied = $state(false);
	let platform = $state<'twitter' | 'linkedin'>('twitter');
	let showTuba = $state(false);

	const API = 'https://api.tenantiq.app';

	async function generate() {
		loading = true;
		showTuba = false;
		try {
			const res = await fetch(`${API}/api/share/generate`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ platform }),
			});
			const data = await res.json();
			message = data.message;
		} catch {
			const res = await fetch(`${API}/api/share/random`);
			const data = await res.json();
			message = data.message;
		} finally {
			loading = false;
			showTuba = true;
			setTimeout(() => (showTuba = false), 2500);
		}
	}

	function shareTwitter() {
		const text = encodeURIComponent(message);
		window.open(`https://x.com/intent/tweet?text=${text}`, '_blank', 'width=550,height=420');
	}

	function shareLinkedin() {
		const text = encodeURIComponent(message);
		window.open(`https://www.linkedin.com/sharing/share-offsite/?url=https://app.tenantiq.app&summary=${text}`, '_blank', 'width=550,height=520');
	}

	async function copyMessage() {
		await navigator.clipboard.writeText(message);
		copied = true;
		setTimeout(() => (copied = false), 2000);
	}
</script>

<section class="share" id="share">
	<div class="inner">
		<span class="eyebrow">Pretty, pretty, pretty good</span>
		<h2>You gonna share this<br /><span class="accent">or just stare at me?</span></h2>
		<p class="sub">Each click generates an AI-powered Larry David meltdown about M365 security. People have lost friends over these. Marriages have been tested. Share at your own risk.</p>

		<div class="card">
			<div class="episode-bar">
				<span class="episode-label">Season 12 / Episode ???</span>
				<span class="episode-title">"The Tenant That Broke Larry"</span>
			</div>

			<div class="platform-toggle">
				<button class:active={platform === 'twitter'} onclick={() => (platform = 'twitter')}>
					<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>
					X / Twitter
				</button>
				<button class:active={platform === 'linkedin'} onclick={() => (platform = 'linkedin')}>
					<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/></svg>
					LinkedIn
				</button>
			</div>

			<ShareMessageArea {loading} {message} />

			{#if showTuba}
				<div class="tuba-moment">
					<span>bum bum buuuuum</span>
				</div>
			{/if}

			<ShareActions {loading} {message} {copied} ongenerate={generate} onsharetwitter={shareTwitter} onsharelinkedin={shareLinkedin} oncopy={copyMessage} />
		</div>
	</div>
</section>

<style>
	.share { padding: 5rem 1.5rem; }
	.inner { max-width: 660px; margin: 0 auto; text-align: center; }

	.eyebrow {
		display: inline-block; padding: 0.3rem 0.85rem;
		border: 1px solid rgba(16,185,129,0.15); border-radius: 999px;
		font-size: 0.7rem; font-weight: 600; color: #10b981;
		letter-spacing: 0.05em; text-transform: uppercase; margin-bottom: 1.25rem;
	}
	h2 { font-size: clamp(1.75rem, 4vw, 2.5rem); font-weight: 800; color: #f1f5f9; line-height: 1.15; letter-spacing: -0.03em; margin-bottom: 0.75rem; }
	.accent { background: linear-gradient(135deg, #34d399, #059669); -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text; }
	.sub { color: #64748b; font-size: 0.92rem; line-height: 1.6; margin-bottom: 2rem; max-width: 500px; margin-left: auto; margin-right: auto; }

	.card {
		background: rgba(255,255,255,0.025); backdrop-filter: blur(20px);
		border: 1px solid rgba(255,255,255,0.06); border-radius: 16px;
		padding: 1.75rem; text-align: left; position: relative; overflow: hidden;
	}

	.episode-bar {
		display: flex; align-items: center; gap: 0.75rem;
		padding: 0.6rem 0.85rem; margin: -1.75rem -1.75rem 1.25rem -1.75rem;
		background: linear-gradient(135deg, #1a1a2e, #16213e);
		border-bottom: 1px solid rgba(255,255,255,0.04);
		font-family: Georgia, 'Times New Roman', serif;
	}
	.episode-label { font-size: 0.65rem; color: #475569; text-transform: uppercase; letter-spacing: 0.08em; }
	.episode-title { font-size: 0.78rem; color: #94a3b8; font-style: italic; }

	.platform-toggle { display: flex; gap: 0.5rem; margin-bottom: 1.25rem; }
	.platform-toggle button {
		display: flex; align-items: center; gap: 0.4rem;
		padding: 0.45rem 0.9rem; border-radius: 8px; border: 1px solid rgba(255,255,255,0.08);
		background: transparent; color: #64748b; font-size: 0.78rem; font-weight: 500;
		cursor: pointer; transition: all 0.2s;
	}
	.platform-toggle button:hover { border-color: rgba(255,255,255,0.15); color: #94a3b8; }
	.platform-toggle button.active { background: rgba(16,185,129,0.1); border-color: rgba(16,185,129,0.25); color: #10b981; }

	.tuba-moment {
		text-align: center; padding: 0.35rem 0; margin-bottom: 0.5rem;
		animation: tuba-fade 2.5s ease-out forwards;
	}
	.tuba-moment span {
		font-family: Georgia, serif; font-style: italic; font-size: 0.75rem;
		color: #10b981; letter-spacing: 0.2em; opacity: 0.7;
	}
	@keyframes tuba-fade { 0% { opacity: 0; transform: scale(0.9); } 15% { opacity: 1; transform: scale(1); } 85% { opacity: 1; } 100% { opacity: 0; } }

	@media (max-width: 480px) {
		.card { padding: 1.25rem; }
		.episode-bar { margin: -1.25rem -1.25rem 1rem -1.25rem; flex-direction: column; gap: 0.2rem; align-items: flex-start; }
	}
</style>
