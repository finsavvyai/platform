<script lang="ts">
	import { toasts } from '$stores/toast';
	import { copyToClipboard } from '$utils/export';

	interface Props {
		score: number;
		domain: string;
		grade: string;
	}

	let { score, domain, grade }: Props = $props();

	type BadgeStyle = 'minimal' | 'detailed' | 'shield';
	let selectedStyle = $state<BadgeStyle>('minimal');
	let copied = $state(false);

	const color = $derived(score >= 80 ? '#22c55e' : score >= 60 ? '#f59e0b' : '#ef4444');

	const embedCodes: Record<BadgeStyle, string> = $derived({
		minimal: `<a href="https://app.tenantiq.app/seo" target="_blank" rel="noopener" title="AI Readiness Score: ${score}/100"><img src="https://img.shields.io/badge/AI_Readiness-${grade}_${score}%25-${color.slice(1)}?style=flat-square&logo=data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIyNCIgaGVpZ2h0PSIyNCIgdmlld0JveD0iMCAwIDI0IDI0IiBmaWxsPSJub25lIiBzdHJva2U9IndoaXRlIiBzdHJva2Utd2lkdGg9IjIiPjxwYXRoIGQ9Ik0yMSAyMWwtNS4yLTUuMm0wIDBBNy41IDcuNSAwIDEwNS4yIDUuMmE3LjUgNy41IDAgMDAxMC42IDEwLjZ6Ii8+PC9zdmc+" alt="AI Readiness: ${grade}" /></a>`,
		detailed: `<!-- TenantIQ AI Readiness Badge -->
<div style="display:inline-flex;align-items:center;gap:10px;padding:10px 16px;border-radius:10px;border:1px solid #e5e7eb;background:#fafafa;font-family:system-ui,sans-serif;text-decoration:none" onclick="window.open('https://app.tenantiq.app/seo','_blank')">
  <div style="width:40px;height:40px;border-radius:50%;border:2.5px solid ${color};display:flex;flex-direction:column;align-items:center;justify-content:center">
    <span style="font-size:16px;font-weight:800;color:${color};line-height:1">${grade}</span>
    <span style="font-size:8px;color:#999;font-weight:600">${score}</span>
  </div>
  <div>
    <div style="font-size:12px;font-weight:700;color:#111">AI Ready</div>
    <div style="font-size:10px;color:#888">by TenantIQ</div>
  </div>
</div>`,
		shield: `<a href="https://app.tenantiq.app/seo" target="_blank" rel="noopener"><img src="https://img.shields.io/badge/AI_SEO-${score}%25_${grade}-${color.slice(1)}?style=for-the-badge&logo=data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIyNCIgaGVpZ2h0PSIyNCIgdmlld0JveD0iMCAwIDI0IDI0IiBmaWxsPSJub25lIiBzdHJva2U9IndoaXRlIiBzdHJva2Utd2lkdGg9IjIiPjxwYXRoIGQ9Ik0yMSAyMWwtNS4yLTUuMm0wIDBBNy41IDcuNSAwIDEwNS4yIDUuMmE3LjUgNy41IDAgMDAxMC42IDEwLjZ6Ii8+PC9zdmc+" alt="AI SEO Score" /></a>`,
	});

	async function copyEmbed() {
		const ok = await copyToClipboard(embedCodes[selectedStyle]);
		if (ok) {
			copied = true;
			toasts.success('Badge code copied');
			setTimeout(() => { copied = false; }, 2000);
		}
	}
</script>

<div class="embed-section">
	<div class="embed-header">
		<div class="embed-icon">
			<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M17.25 6.75L22.5 12l-5.25 5.25m-10.5 0L1.5 12l5.25-5.25m7.5-3l-4.5 16.5"/></svg>
		</div>
		<div>
			<h3 class="embed-title">Embed your score</h3>
			<p class="embed-desc">Add an AI readiness badge to your website or README</p>
		</div>
	</div>

	<!-- Style selector -->
	<div class="badge-styles">
		{#each [
			{ value: 'minimal', label: 'Shield', desc: 'shields.io badge' },
			{ value: 'detailed', label: 'Rich', desc: 'HTML widget' },
			{ value: 'shield', label: 'Large', desc: 'for-the-badge' },
		] as s}
			<button
				class="badge-style-btn"
				class:active={selectedStyle === s.value}
				onclick={() => selectedStyle = s.value as BadgeStyle}
			>
				<span class="badge-style-label">{s.label}</span>
				<span class="badge-style-desc">{s.desc}</span>
			</button>
		{/each}
	</div>

	<!-- Preview -->
	<div class="badge-preview">
		<span class="preview-label">PREVIEW</span>
		<div class="preview-render">
			{#if selectedStyle === 'minimal' || selectedStyle === 'shield'}
				<div class="shield-preview" class:large={selectedStyle === 'shield'}>
					<span class="shield-left">AI {selectedStyle === 'shield' ? 'SEO' : 'Readiness'}</span>
					<span class="shield-right" style="background: {color};">{grade} {score}%</span>
				</div>
			{:else}
				<div class="rich-preview">
					<div class="rich-ring" style="border-color: {color};">
						<span class="rich-grade" style="color: {color};">{grade}</span>
						<span class="rich-num">{score}</span>
					</div>
					<div class="rich-text">
						<span class="rich-label">AI Ready</span>
						<span class="rich-brand">by TenantIQ</span>
					</div>
				</div>
			{/if}
		</div>
	</div>

	<!-- Code + Copy -->
	<div class="embed-code-area">
		<pre class="embed-code"><code>{embedCodes[selectedStyle]}</code></pre>
		<button class="embed-copy-btn" class:copied onclick={copyEmbed}>
			{#if copied}
				<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M4.5 12.75l6 6 9-13.5"/></svg>
				Copied
			{:else}
				<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M15.666 3.888A2.25 2.25 0 0013.5 2.25h-3c-1.03 0-1.9.693-2.166 1.638m7.332 0c.055.194.084.4.084.612v0a.75.75 0 01-.75.75H9.75a.75.75 0 01-.75-.75v0c0-.212.03-.418.084-.612m7.332 0c.646.049 1.288.11 1.927.184 1.1.128 1.907 1.077 1.907 2.185V19.5a2.25 2.25 0 01-2.25 2.25H6.75A2.25 2.25 0 014.5 19.5V6.257c0-1.108.806-2.057 1.907-2.185a48.208 48.208 0 011.927-.184"/></svg>
				Copy code
			{/if}
		</button>
	</div>
</div>

<style>
	.embed-section {
		border-radius: var(--radius-xl);
		border: 1px solid var(--color-border);
		background: var(--color-surface);
		padding: 20px;
	}
	.embed-header {
		display: flex;
		align-items: center;
		gap: 12px;
		margin-bottom: 16px;
	}
	.embed-icon {
		width: 36px;
		height: 36px;
		border-radius: 10px;
		background: linear-gradient(135deg, rgba(124,58,237,0.1), rgba(37,99,235,0.1));
		display: flex;
		align-items: center;
		justify-content: center;
		color: var(--color-primary);
		flex-shrink: 0;
	}
	.embed-title {
		font-size: 14px;
		font-weight: 700;
		color: var(--color-text);
	}
	.embed-desc {
		font-size: 12px;
		color: var(--color-text-secondary);
	}

	/* Badge style selector */
	.badge-styles {
		display: flex;
		gap: 6px;
		margin-bottom: 14px;
	}
	.badge-style-btn {
		flex: 1;
		padding: 8px;
		border-radius: 10px;
		border: 1px solid var(--color-border);
		background: var(--color-bg);
		cursor: pointer;
		text-align: center;
		transition: all 0.15s ease;
	}
	.badge-style-btn:hover { border-color: var(--color-border-strong); }
	.badge-style-btn.active {
		border-color: var(--color-primary);
		background: rgba(0,122,255,0.04);
	}
	.badge-style-label {
		display: block;
		font-size: 12px;
		font-weight: 700;
		color: var(--color-text);
	}
	.badge-style-desc {
		display: block;
		font-size: 10px;
		color: var(--color-text-tertiary);
		margin-top: 1px;
	}

	/* Preview */
	.badge-preview {
		background: var(--color-bg);
		border-radius: 10px;
		padding: 16px;
		margin-bottom: 12px;
		text-align: center;
	}
	.preview-label {
		display: block;
		font-size: 9px;
		font-weight: 700;
		letter-spacing: 0.1em;
		color: var(--color-text-tertiary);
		margin-bottom: 10px;
	}
	.preview-render {
		display: flex;
		justify-content: center;
	}

	/* Shield preview */
	.shield-preview {
		display: inline-flex;
		border-radius: 4px;
		overflow: hidden;
		font-family: 'Verdana', sans-serif;
		font-size: 11px;
		line-height: 1;
	}
	.shield-preview.large { font-size: 13px; border-radius: 6px; }
	.shield-left {
		padding: 5px 8px;
		background: #555;
		color: white;
	}
	.shield-preview.large .shield-left { padding: 7px 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; }
	.shield-right {
		padding: 5px 8px;
		color: white;
		font-weight: 700;
	}
	.shield-preview.large .shield-right { padding: 7px 12px; }

	/* Rich preview */
	.rich-preview {
		display: inline-flex;
		align-items: center;
		gap: 10px;
		padding: 10px 16px;
		border-radius: 10px;
		border: 1px solid var(--color-border);
		background: var(--color-surface);
	}
	.rich-ring {
		width: 40px;
		height: 40px;
		border-radius: 50%;
		border: 2.5px solid;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
	}
	.rich-grade {
		font-size: 16px;
		font-weight: 800;
		line-height: 1;
	}
	.rich-num {
		font-size: 8px;
		color: var(--color-text-tertiary);
		font-weight: 600;
	}
	.rich-text { text-align: left; }
	.rich-label {
		display: block;
		font-size: 12px;
		font-weight: 700;
		color: var(--color-text);
	}
	.rich-brand {
		display: block;
		font-size: 10px;
		color: var(--color-text-tertiary);
	}

	/* Embed code */
	.embed-code-area {
		position: relative;
	}
	.embed-code {
		background: var(--color-bg);
		border: 1px solid var(--color-border);
		border-radius: 10px;
		padding: 14px;
		padding-right: 90px;
		font-size: 11px;
		line-height: 1.5;
		font-family: 'SF Mono', 'Fira Code', monospace;
		color: var(--color-text-secondary);
		overflow-x: auto;
		white-space: pre-wrap;
		word-break: break-all;
		max-height: 120px;
	}
	.embed-copy-btn {
		position: absolute;
		top: 10px;
		right: 10px;
		display: inline-flex;
		align-items: center;
		gap: 5px;
		padding: 6px 12px;
		border-radius: 8px;
		border: 1px solid var(--color-border);
		background: var(--color-surface);
		font-size: 12px;
		font-weight: 600;
		color: var(--color-text-secondary);
		cursor: pointer;
		transition: all 0.15s ease;
	}
	.embed-copy-btn:hover { border-color: var(--color-primary); color: var(--color-primary); }
	.embed-copy-btn.copied { background: var(--color-success); border-color: var(--color-success); color: white; }
</style>
