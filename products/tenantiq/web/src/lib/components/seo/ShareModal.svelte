<script lang="ts">
	import { api } from '$api/client';
	import { toasts } from '$stores/toast';
	import { copyToClipboard } from '$utils/export';

	interface Props {
		open: boolean;
		domain: string;
		score: number;
		aiVisibility: number;
		contentScore: number;
		structuredData: number;
		citationScore: number;
		criticalCount: number;
		onclose: () => void;
	}

	let {
		open, domain, score, aiVisibility, contentScore,
		structuredData, citationScore, criticalCount, onclose
	}: Props = $props();

	type Style = 'random' | 'roast' | 'brag' | 'urgent' | 'funny' | 'larry' | 'fintech' | 'compliance';

	const styles: { value: Style; label: string; emoji: string; desc: string }[] = [
		{ value: 'larry', label: 'Larry', emoji: '🤨', desc: 'Curb energy' },
		{ value: 'funny', label: 'Funny', emoji: '😂', desc: 'Self-deprecating' },
		{ value: 'roast', label: 'Roast', emoji: '🔥', desc: 'Brutally honest' },
		{ value: 'fintech', label: 'Fintech', emoji: '🏦', desc: 'Finance humor' },
		{ value: 'compliance', label: 'Compliance', emoji: '📋', desc: 'Audit jokes' },
		{ value: 'brag', label: 'Flex', emoji: '💪', desc: 'Show off' },
		{ value: 'urgent', label: 'FOMO', emoji: '🚨', desc: 'Create urgency' },
		{ value: 'random', label: 'Surprise', emoji: '🎲', desc: 'Mix it up' },
	];

	let selectedStyle = $state<Style>('funny');
	let message = $state('');
	let generating = $state(false);
	let copied = $state(false);
	let hasGenerated = $state(false);

	const grade = $derived(
		score >= 90 ? 'A+' : score >= 80 ? 'A' : score >= 70 ? 'B' : score >= 60 ? 'C' : score >= 50 ? 'D' : 'F'
	);

	const gradeColor = $derived(
		score >= 80 ? 'var(--color-success)' : score >= 60 ? 'var(--color-warning)' : 'var(--color-danger)'
	);

	const shareUrl = $derived(typeof window !== 'undefined' ? window.location.origin + '/seo' : 'https://app.tenantiq.app/seo');

	async function generate() {
		generating = true;
		try {
			const isFintech = selectedStyle === 'fintech' || selectedStyle === 'compliance';
			const endpoint = isFintech ? '/ai-seo/share/generate/fintech' : '/ai-seo/share/generate';
			const res = await api.post<{ message: string; grade: string }>(endpoint, {
				domain, score, aiVisibility, contentScore, structuredData, citationScore, criticalCount,
				style: selectedStyle,
			});
			message = res.message;
			hasGenerated = true;
		} catch {
			toasts.error('Failed to generate message');
		} finally {
			generating = false;
		}
	}

	async function copyMessage() {
		const fullMessage = `${message}\n\n${shareUrl}`;
		const ok = await copyToClipboard(fullMessage);
		if (ok) {
			copied = true;
			toasts.success('Copied! Now paste it everywhere');
			setTimeout(() => { copied = false; }, 2000);
		}
	}

	function shareTwitter() {
		const text = encodeURIComponent(`${message}\n\n`);
		const url = encodeURIComponent(shareUrl);
		window.open(`https://twitter.com/intent/tweet?text=${text}&url=${url}`, '_blank', 'width=600,height=400');
	}

	function shareLinkedIn() {
		const url = encodeURIComponent(shareUrl);
		const text = encodeURIComponent(message);
		window.open(`https://www.linkedin.com/sharing/share-offsite/?url=${url}&summary=${text}`, '_blank', 'width=600,height=500');
	}

	function shareReddit() {
		const title = encodeURIComponent(`My website scored ${score}/100 on AI readiness`);
		const url = encodeURIComponent(shareUrl);
		window.open(`https://www.reddit.com/submit?url=${url}&title=${title}`, '_blank', 'width=600,height=500');
	}

	// Auto-generate on open
	$effect(() => {
		if (open && !hasGenerated) generate();
	});
</script>

{#if open}
	<!-- Backdrop -->
	<div class="share-backdrop" onclick={onclose} role="presentation"></div>

	<!-- Modal -->
	<div class="share-modal" role="dialog" aria-label="Share your AI SEO score">
		<!-- Score badge -->
		<div class="share-hero">
			<div class="share-score-ring" style="--ring-color: {gradeColor};">
				<span class="share-grade">{grade}</span>
				<span class="share-score-num">{score}</span>
			</div>
			<div class="share-hero-text">
				<h2 class="share-title">Share your score</h2>
				<p class="share-subtitle">{domain} — AI Readiness {score}/100</p>
			</div>
		</div>

		<!-- Style selector -->
		<div class="style-picker">
			{#each styles as s}
				<button
					class="style-pill"
					class:active={selectedStyle === s.value}
					onclick={() => { selectedStyle = s.value; generate(); }}
				>
					<span class="style-emoji">{s.emoji}</span>
					<span class="style-name">{s.label}</span>
				</button>
			{/each}
		</div>

		<!-- Generated message -->
		<div class="message-area">
			{#if generating}
				<div class="message-skeleton">
					<div class="skel-line w-full"></div>
					<div class="skel-line w-3/4"></div>
					<div class="skel-line w-1/2"></div>
				</div>
			{:else if message}
				<div class="message-content">
					<p class="message-text">{message}</p>
					<div class="message-link">
						<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M13.19 8.688a4.5 4.5 0 011.242 7.244l-4.5 4.5a4.5 4.5 0 01-6.364-6.364l1.757-1.757m9.86-2.008a4.5 4.5 0 00-1.242-7.244l-4.5-4.5a4.5 4.5 0 00-6.364 6.364l1.757 1.757"/></svg>
						{shareUrl}
					</div>
				</div>
			{/if}
		</div>

		<!-- Regenerate button -->
		<button class="regen-btn" onclick={generate} disabled={generating}>
			<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" class:spinning={generating}><path stroke-linecap="round" stroke-linejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182M2.985 19.644l3.181-3.183"/></svg>
			{generating ? 'Generating...' : 'Generate another'}
		</button>

		<!-- Action buttons -->
		<div class="share-actions">
			<button class="share-btn copy-btn" class:copied onclick={copyMessage}>
				{#if copied}
					<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M4.5 12.75l6 6 9-13.5"/></svg>
					Copied!
				{:else}
					<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M15.666 3.888A2.25 2.25 0 0013.5 2.25h-3c-1.03 0-1.9.693-2.166 1.638m7.332 0c.055.194.084.4.084.612v0a.75.75 0 01-.75.75H9.75a.75.75 0 01-.75-.75v0c0-.212.03-.418.084-.612m7.332 0c.646.049 1.288.11 1.927.184 1.1.128 1.907 1.077 1.907 2.185V19.5a2.25 2.25 0 01-2.25 2.25H6.75A2.25 2.25 0 014.5 19.5V6.257c0-1.108.806-2.057 1.907-2.185a48.208 48.208 0 011.927-.184"/></svg>
					Copy message
				{/if}
			</button>

			<div class="social-btns">
				<button class="social-btn twitter" onclick={shareTwitter} title="Share on X/Twitter">
					<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>
				</button>
				<button class="social-btn linkedin" onclick={shareLinkedIn} title="Share on LinkedIn">
					<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/></svg>
				</button>
				<button class="social-btn reddit" onclick={shareReddit} title="Share on Reddit">
					<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M12 0A12 12 0 000 12a12 12 0 0012 12 12 12 0 0012-12A12 12 0 0012 0zm5.01 4.744c.688 0 1.25.561 1.25 1.249a1.25 1.25 0 01-2.498.056l-2.597-.547-.8 3.747c1.824.07 3.48.632 4.674 1.488.308-.309.73-.491 1.207-.491.968 0 1.754.786 1.754 1.754 0 .716-.435 1.333-1.01 1.614a3.111 3.111 0 01.042.52c0 2.694-3.13 4.87-7.004 4.87-3.874 0-7.004-2.176-7.004-4.87 0-.183.015-.366.043-.534A1.748 1.748 0 014.028 12c0-.968.786-1.754 1.754-1.754.463 0 .898.196 1.207.49 1.207-.883 2.878-1.43 4.744-1.487l.885-4.182a.342.342 0 01.14-.197.35.35 0 01.238-.042l2.906.617a1.214 1.214 0 011.108-.701zM9.25 12C8.561 12 8 12.562 8 13.25c0 .687.561 1.248 1.25 1.248.687 0 1.248-.561 1.248-1.249 0-.688-.561-1.249-1.249-1.249zm5.5 0c-.687 0-1.248.561-1.248 1.25 0 .687.561 1.248 1.249 1.248.688 0 1.249-.561 1.249-1.249 0-.687-.562-1.249-1.25-1.249zm-5.466 3.99a.327.327 0 00-.231.094.33.33 0 000 .463c.842.842 2.484.913 2.961.913.477 0 2.105-.056 2.961-.913a.361.361 0 000-.463.327.327 0 00-.462 0c-.545.533-1.684.73-2.512.73-.828 0-1.979-.196-2.512-.73a.326.326 0 00-.205-.094z"/></svg>
				</button>
			</div>
		</div>

		<!-- Close -->
		<button class="share-close" onclick={onclose} aria-label="Close">
			<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>
		</button>
	</div>
{/if}

<style>
	.share-backdrop {
		position: fixed;
		inset: 0;
		background: rgba(0,0,0,0.5);
		backdrop-filter: blur(4px);
		z-index: 999;
		animation: fadeIn 0.2s ease;
	}
	@keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }

	.share-modal {
		position: fixed;
		top: 50%;
		left: 50%;
		transform: translate(-50%, -50%);
		z-index: 1000;
		width: 480px;
		max-width: calc(100vw - 32px);
		max-height: calc(100vh - 64px);
		overflow-y: auto;
		background: var(--color-surface);
		border: 1px solid var(--color-border);
		border-radius: 20px;
		padding: 28px;
		box-shadow: 0 25px 50px -12px rgba(0,0,0,0.25);
		animation: modalIn 0.3s cubic-bezier(0.16, 1, 0.3, 1);
	}
	@keyframes modalIn {
		from { opacity: 0; transform: translate(-50%, -48%) scale(0.96); }
		to { opacity: 1; transform: translate(-50%, -50%) scale(1); }
	}

	/* Hero with score ring */
	.share-hero {
		display: flex;
		align-items: center;
		gap: 16px;
		margin-bottom: 24px;
	}
	.share-score-ring {
		width: 64px;
		height: 64px;
		border-radius: 50%;
		border: 3px solid var(--ring-color);
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		flex-shrink: 0;
		background: linear-gradient(135deg, rgba(0,122,255,0.04), rgba(88,86,214,0.04));
	}
	.share-grade {
		font-size: 20px;
		font-weight: 800;
		color: var(--ring-color);
		line-height: 1;
		letter-spacing: -0.02em;
	}
	.share-score-num {
		font-size: 10px;
		font-weight: 600;
		color: var(--color-text-tertiary);
		font-variant-numeric: tabular-nums;
	}
	.share-title {
		font-size: 18px;
		font-weight: 700;
		color: var(--color-text);
		letter-spacing: -0.02em;
	}
	.share-subtitle {
		font-size: 13px;
		color: var(--color-text-secondary);
		margin-top: 2px;
	}

	/* Style picker pills */
	.style-picker {
		display: flex;
		gap: 6px;
		margin-bottom: 16px;
		flex-wrap: wrap;
	}
	.style-pill {
		display: flex;
		align-items: center;
		gap: 5px;
		padding: 6px 14px;
		border-radius: 100px;
		border: 1px solid var(--color-border);
		background: var(--color-bg);
		font-size: 12px;
		font-weight: 600;
		color: var(--color-text-secondary);
		cursor: pointer;
		transition: all 0.15s ease;
	}
	.style-pill:hover {
		border-color: var(--color-border-strong);
		color: var(--color-text);
	}
	.style-pill.active {
		background: var(--color-primary);
		border-color: var(--color-primary);
		color: white;
	}
	.style-emoji { font-size: 14px; }
	.style-name { line-height: 1; }

	/* Message area */
	.message-area {
		background: var(--color-bg);
		border: 1px solid var(--color-border);
		border-radius: 14px;
		padding: 20px;
		min-height: 120px;
		margin-bottom: 12px;
	}
	.message-text {
		font-size: 14px;
		line-height: 1.6;
		color: var(--color-text);
		white-space: pre-line;
	}
	.message-link {
		margin-top: 12px;
		padding-top: 12px;
		border-top: 1px solid var(--color-border-subtle);
		font-size: 12px;
		color: var(--color-primary);
		display: flex;
		align-items: center;
		gap: 6px;
	}
	.message-skeleton {
		display: flex;
		flex-direction: column;
		gap: 10px;
	}
	.skel-line {
		height: 14px;
		background: var(--color-border-subtle);
		border-radius: 7px;
		animation: pulse 1.5s ease-in-out infinite;
	}
	.w-full { width: 100%; }
	.w-3\/4 { width: 75%; }
	.w-1\/2 { width: 50%; }
	@keyframes pulse {
		0%, 100% { opacity: 1; }
		50% { opacity: 0.4; }
	}

	/* Regenerate button */
	.regen-btn {
		display: flex;
		align-items: center;
		gap: 6px;
		padding: 8px 16px;
		border-radius: 10px;
		border: 1px solid var(--color-border);
		background: var(--color-bg);
		font-size: 13px;
		font-weight: 600;
		color: var(--color-text-secondary);
		cursor: pointer;
		transition: all 0.15s ease;
		margin-bottom: 20px;
	}
	.regen-btn:hover:not(:disabled) {
		border-color: var(--color-primary);
		color: var(--color-primary);
	}
	.regen-btn:disabled { opacity: 0.5; cursor: not-allowed; }
	.spinning { animation: spin 0.8s linear infinite; }
	@keyframes spin { to { transform: rotate(360deg); } }

	/* Action buttons */
	.share-actions {
		display: flex;
		align-items: center;
		gap: 10px;
	}
	.copy-btn {
		flex: 1;
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 8px;
		padding: 12px 20px;
		border-radius: 12px;
		background: var(--color-primary);
		color: white;
		border: none;
		font-size: 14px;
		font-weight: 600;
		cursor: pointer;
		transition: all 0.15s ease;
	}
	.copy-btn:hover { filter: brightness(1.08); box-shadow: 0 4px 12px rgba(0,122,255,0.3); }
	.copy-btn.copied { background: var(--color-success); }

	.social-btns {
		display: flex;
		gap: 6px;
	}
	.social-btn {
		width: 44px;
		height: 44px;
		border-radius: 12px;
		border: 1px solid var(--color-border);
		background: var(--color-bg);
		color: var(--color-text-secondary);
		display: flex;
		align-items: center;
		justify-content: center;
		cursor: pointer;
		transition: all 0.15s ease;
	}
	.social-btn:hover {
		transform: translateY(-2px);
		box-shadow: var(--shadow-md);
	}
	.social-btn.twitter:hover { background: #000; color: white; border-color: #000; }
	.social-btn.linkedin:hover { background: #0A66C2; color: white; border-color: #0A66C2; }
	.social-btn.reddit:hover { background: #FF4500; color: white; border-color: #FF4500; }

	/* Close button */
	.share-close {
		position: absolute;
		top: 16px;
		right: 16px;
		width: 32px;
		height: 32px;
		border-radius: 10px;
		border: none;
		background: var(--color-bg-secondary);
		color: var(--color-text-tertiary);
		display: flex;
		align-items: center;
		justify-content: center;
		cursor: pointer;
		transition: all 0.15s ease;
	}
	.share-close:hover { background: var(--color-bg-tertiary); color: var(--color-text); }
</style>
