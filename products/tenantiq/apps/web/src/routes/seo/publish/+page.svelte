<script lang="ts">
	import { api } from '$api/client';
	import { toasts } from '$stores/toast';
	import { page } from '$app/stores';
	import { copyToClipboard } from '$utils/export';

	interface ContentItem {
		id: string; domain: string; content_type: string; title: string;
		content: string; status: string; metadata: string;
		published_at: number | null; created_at: number; updated_at: number;
	}

	const contentTypes = [
		{ value: 'fact_sheet', label: 'Fact Sheet', desc: 'Machine-readable brand facts for AI agents', icon: '📋' },
		{ value: 'faq_schema', label: 'FAQ Schema', desc: 'Structured Q&A that AI agents cite directly', icon: '❓' },
		{ value: 'blog_post', label: 'Authority Article', desc: 'Long-form content structured for AI extraction', icon: '📝' },
		{ value: 'json_ld', label: 'JSON-LD Schema', desc: 'Organization & Product structured data', icon: '🏷' },
		{ value: 'knowledge_base', label: 'Knowledge Base', desc: 'Entity-rich descriptions for AI reference', icon: '📚' },
	];

	let domain = $state($page.url.searchParams.get('domain') || '');
	let selectedType = $state($page.url.searchParams.get('type') || 'fact_sheet');
	let brandName = $state('');
	let description = $state('');
	let keywords = $state('');
	let targetPrompts = $state('');
	let generating = $state(false);
	let generatedContent = $state('');
	let contentList = $state<ContentItem[]>([]);
	let loading = $state(true);
	let editingId = $state<string | null>(null);
	let editContent = $state('');
	let activeView = $state<'generate' | 'library'>('generate');

	$effect(() => { loadContent(); });

	async function loadContent() {
		loading = true;
		try {
			const data = await api.get<{ content: ContentItem[] }>('/ai-seo/content');
			contentList = data.content;
		} catch { contentList = []; }
		finally { loading = false; }
	}

	async function generate() {
		if (!domain.trim() || !brandName.trim()) {
			toasts.error('Domain and brand name are required');
			return;
		}
		generating = true;
		try {
			const res = await api.post<{ content: string; contentType: string; contentId: string; error?: string }>(
				'/ai-seo/content/generate', {
					domain: domain.trim(),
					contentType: selectedType,
					brandName: brandName.trim(),
					description: description.trim(),
					keywords: keywords.split(',').map(k => k.trim()).filter(Boolean),
					targetPrompts: targetPrompts.split('\n').map(p => p.trim()).filter(Boolean),
				}
			);
			if (res.error) { toasts.error(res.error); }
			else {
				generatedContent = res.content;
				toasts.success('Content generated');
				loadContent();
			}
		} catch (e) {
			toasts.error(e instanceof Error ? e.message : 'Generation failed');
		} finally { generating = false; }
	}

	async function publishContent(id: string) {
		try {
			await api.patch(`/ai-seo/content/${id}`, { status: 'published' });
			toasts.success('Content published');
			loadContent();
		} catch (e) {
			toasts.error(e instanceof Error ? e.message : 'Publish failed');
		}
	}

	async function deleteContent(id: string) {
		try {
			await api.delete(`/ai-seo/content/${id}`);
			toasts.success('Content deleted');
			loadContent();
		} catch (e) {
			toasts.error(e instanceof Error ? e.message : 'Delete failed');
		}
	}

	async function saveEdit(id: string) {
		try {
			await api.patch(`/ai-seo/content/${id}`, { content: editContent });
			toasts.success('Content updated');
			editingId = null;
			loadContent();
		} catch (e) {
			toasts.error(e instanceof Error ? e.message : 'Save failed');
		}
	}

	function startEdit(item: ContentItem) {
		editingId = item.id;
		editContent = item.content;
	}

	async function copyContent(content: string) {
		const ok = await copyToClipboard(content);
		if (ok) toasts.success('Copied to clipboard');
	}

	function formatDate(ts: number): string {
		return new Date(ts * 1000).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
	}

	const selectedTypeInfo = $derived(contentTypes.find(ct => ct.value === selectedType));
	const draftCount = $derived(contentList.filter(c => c.status === 'draft').length);
	const publishedCount = $derived(contentList.filter(c => c.status === 'published').length);
</script>

<svelte:head><title>AI Publisher | TenantIQ</title></svelte:head>

<div class="publisher-page space-y-8">
	<!-- Header -->
	<div class="animate-fade-up flex items-start justify-between gap-4">
		<div>
			<div class="flex items-center gap-3">
				<div class="header-icon">
					<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5" /></svg>
				</div>
				<div>
					<div class="flex items-center gap-2">
						<a href="/seo" class="breadcrumb-link">AI SEO</a>
						<span class="breadcrumb-sep">/</span>
						<h1 class="text-xl font-semibold tracking-tight text-[var(--color-text)]">Publisher</h1>
					</div>
					<p class="text-[13px] text-[var(--color-text-secondary)]">Generate and publish AI-optimized content for maximum agent discoverability</p>
				</div>
			</div>
		</div>
	</div>

	<!-- View tabs -->
	<div class="animate-fade-up delay-1 view-tabs">
		<button class="view-tab" class:active={activeView === 'generate'} onclick={() => activeView = 'generate'}>
			<svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" /></svg>
			Generate
		</button>
		<button class="view-tab" class:active={activeView === 'library'} onclick={() => activeView = 'library'}>
			<svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75 7.5M10 11.25h4M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z" /></svg>
			Library
			{#if contentList.length > 0}
				<span class="view-tab-count">{contentList.length}</span>
			{/if}
		</button>
	</div>

	{#if activeView === 'generate'}
		<!-- Content type selector -->
		<div class="animate-fade-up delay-1 type-selector">
			{#each contentTypes as ct}
				<button
					class="type-card"
					class:selected={selectedType === ct.value}
					onclick={() => selectedType = ct.value}
				>
					<span class="type-icon">{ct.icon}</span>
					<span class="type-label">{ct.label}</span>
				</button>
			{/each}
		</div>

		<!-- Generator form -->
		<div class="animate-fade-up delay-2 gen-panel">
			<div class="gen-panel-header">
				<div class="gen-type-badge">
					<span>{selectedTypeInfo?.icon}</span>
					<span>{selectedTypeInfo?.label}</span>
				</div>
				<p class="gen-type-desc">{selectedTypeInfo?.desc}</p>
			</div>

			<div class="gen-form">
				<div class="gen-row">
					<div class="gen-field">
						<label for="pub-domain" class="field-label">Domain</label>
						<input id="pub-domain" type="text" bind:value={domain} placeholder="example.com" class="field-input" />
					</div>
					<div class="gen-field">
						<label for="pub-brand" class="field-label">Brand Name</label>
						<input id="pub-brand" type="text" bind:value={brandName} placeholder="Your Brand" class="field-input" />
					</div>
				</div>
				<div class="gen-field">
					<label for="pub-desc" class="field-label">Brand Description</label>
					<textarea id="pub-desc" bind:value={description} rows="2" placeholder="Brief description of your product or service..." class="field-textarea"></textarea>
				</div>
				<div class="gen-field">
					<label for="pub-keywords" class="field-label">Keywords</label>
					<input id="pub-keywords" type="text" bind:value={keywords} placeholder="AI, SaaS, security, compliance — comma-separated" class="field-input" />
				</div>
				<div class="gen-field">
					<label for="pub-prompts" class="field-label">Target AI Prompts <span class="label-hint">What questions should AI agents answer with your brand?</span></label>
					<textarea id="pub-prompts" bind:value={targetPrompts} rows="3" placeholder="What is the best tool for M365 security?&#10;How do I automate compliance?&#10;Compare TenantIQ vs CoreView" class="field-textarea"></textarea>
				</div>
			</div>

			<div class="gen-footer">
				<button onclick={generate} disabled={generating} class="gen-btn">
					{#if generating}
						<span class="gen-spinner"></span>
						Generating
					{:else}
						<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" /></svg>
						Generate {selectedTypeInfo?.label}
					{/if}
				</button>
			</div>
		</div>

		<!-- Generated preview -->
		{#if generatedContent}
			<div class="animate-fade-up preview-panel">
				<div class="preview-header">
					<h3 class="preview-title">Generated Content</h3>
					<div class="preview-actions">
						<button onclick={() => copyContent(generatedContent)} class="preview-action-btn">
							<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M15.666 3.888A2.25 2.25 0 0013.5 2.25h-3c-1.03 0-1.9.693-2.166 1.638m7.332 0c.055.194.084.4.084.612v0a.75.75 0 01-.75.75H9.75a.75.75 0 01-.75-.75v0c0-.212.03-.418.084-.612m7.332 0c.646.049 1.288.11 1.927.184 1.1.128 1.907 1.077 1.907 2.185V19.5a2.25 2.25 0 01-2.25 2.25H6.75A2.25 2.25 0 014.5 19.5V6.257c0-1.108.806-2.057 1.907-2.185a48.208 48.208 0 011.927-.184" /></svg>
							Copy
						</button>
					</div>
				</div>
				<div class="preview-body">
					<pre class="preview-code">{generatedContent}</pre>
				</div>
			</div>
		{/if}

	{:else}
		<!-- Library view -->
		<div class="animate-fade-up delay-1 library-stats">
			<div class="lib-stat">
				<span class="lib-stat-value">{contentList.length}</span>
				<span class="lib-stat-label">Total</span>
			</div>
			<div class="lib-stat">
				<span class="lib-stat-value draft-val">{draftCount}</span>
				<span class="lib-stat-label">Drafts</span>
			</div>
			<div class="lib-stat">
				<span class="lib-stat-value published-val">{publishedCount}</span>
				<span class="lib-stat-label">Published</span>
			</div>
		</div>

		<div class="animate-fade-up delay-2 library-panel">
			{#if loading}
				<div class="library-loading">
					{#each Array(3) as _, i}
						<div class="skeleton" style="height: 72px; border-radius: var(--radius-lg); animation-delay: {i * 75}ms;"></div>
					{/each}
				</div>
			{:else if contentList.length === 0}
				<div class="library-empty">
					<div class="empty-icon-wrap">
						<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" /></svg>
					</div>
					<p class="empty-text">No content yet. Switch to Generate to create your first piece.</p>
				</div>
			{:else}
				<div class="library-list">
					{#each contentList as item, i}
						<div class="library-item animate-fade-up" style="animation-delay: {i * 50}ms;">
							<div class="item-left-stripe" class:status-draft={item.status === 'draft'} class:status-published={item.status === 'published'}></div>
							<div class="item-body">
								<div class="item-top">
									<div class="item-meta">
										<span class="item-type">{item.content_type.replace(/_/g, ' ')}</span>
										<span class="item-status" class:is-draft={item.status === 'draft'} class:is-published={item.status === 'published'}>{item.status}</span>
									</div>
									<div class="item-actions">
										<button onclick={() => copyContent(item.content)} class="action-btn" title="Copy">
											<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M15.666 3.888A2.25 2.25 0 0013.5 2.25h-3c-1.03 0-1.9.693-2.166 1.638m7.332 0c.055.194.084.4.084.612v0a.75.75 0 01-.75.75H9.75a.75.75 0 01-.75-.75v0c0-.212.03-.418.084-.612m7.332 0c.646.049 1.288.11 1.927.184 1.1.128 1.907 1.077 1.907 2.185V19.5a2.25 2.25 0 01-2.25 2.25H6.75A2.25 2.25 0 014.5 19.5V6.257c0-1.108.806-2.057 1.907-2.185a48.208 48.208 0 011.927-.184" /></svg>
										</button>
										<button onclick={() => startEdit(item)} class="action-btn" title="Edit">
											<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10" /></svg>
										</button>
										{#if item.status === 'draft'}
											<button onclick={() => publishContent(item.id)} class="action-btn publish" title="Publish">
												<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5" /></svg>
											</button>
										{/if}
										<button onclick={() => deleteContent(item.id)} class="action-btn delete" title="Delete">
											<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" /></svg>
										</button>
									</div>
								</div>
								<p class="item-title">{item.title}</p>
								<p class="item-domain">{item.domain} · {formatDate(item.created_at)}</p>

								{#if editingId === item.id}
									<div class="edit-area">
										<textarea bind:value={editContent} rows="10" class="edit-textarea"></textarea>
										<div class="edit-actions">
											<button onclick={() => { editingId = null; }} class="edit-cancel">Cancel</button>
											<button onclick={() => saveEdit(item.id)} class="edit-save">Save Changes</button>
										</div>
									</div>
								{/if}
							</div>
						</div>
					{/each}
				</div>
			{/if}
		</div>
	{/if}
</div>

<style>
	.publisher-page { max-width: 960px; }

	.header-icon {
		width: 40px;
		height: 40px;
		border-radius: var(--radius-lg);
		background: linear-gradient(135deg, rgba(0, 122, 255, 0.1), rgba(88, 86, 214, 0.1));
		display: flex;
		align-items: center;
		justify-content: center;
		color: var(--color-primary);
	}
	.breadcrumb-link {
		font-size: 20px;
		font-weight: 600;
		color: var(--color-text-tertiary);
		text-decoration: none;
		letter-spacing: -0.01em;
		transition: color var(--duration-fast) var(--easing);
	}
	.breadcrumb-link:hover { color: var(--color-primary); }
	.breadcrumb-sep {
		color: var(--color-text-tertiary);
		font-size: 18px;
		font-weight: 300;
	}

	/* View tabs */
	.view-tabs {
		display: flex;
		gap: 4px;
		padding: 4px;
		border-radius: var(--radius-lg);
		background: var(--color-bg-secondary);
		border: 1px solid var(--color-border-subtle);
		width: fit-content;
	}
	.view-tab {
		display: flex;
		align-items: center;
		gap: 6px;
		padding: 8px 16px;
		border-radius: var(--radius-md);
		font-size: 13px;
		font-weight: 600;
		color: var(--color-text-secondary);
		background: none;
		border: none;
		cursor: pointer;
		transition: all var(--duration-fast) var(--easing);
	}
	.view-tab:hover { color: var(--color-text); }
	.view-tab.active {
		background: var(--color-surface);
		color: var(--color-text);
		box-shadow: var(--shadow-sm);
	}
	.view-tab-count {
		font-size: 11px;
		font-weight: 600;
		padding: 1px 7px;
		border-radius: 100px;
		background: var(--color-primary);
		color: white;
	}

	/* Content type selector */
	.type-selector {
		display: flex;
		gap: 8px;
		overflow-x: auto;
		padding-bottom: 4px;
	}
	.type-card {
		display: flex;
		align-items: center;
		gap: 8px;
		padding: 10px 16px;
		border-radius: var(--radius-lg);
		border: 1.5px solid var(--color-border);
		background: var(--color-surface);
		cursor: pointer;
		white-space: nowrap;
		transition: all var(--duration-fast) var(--easing);
		font-size: 13px;
		font-weight: 600;
		color: var(--color-text-secondary);
	}
	.type-card:hover { border-color: var(--color-border-strong); color: var(--color-text); }
	.type-card.selected {
		border-color: var(--color-primary);
		background: rgba(0, 122, 255, 0.04);
		color: var(--color-primary);
	}
	.type-icon { font-size: 16px; }
	.type-label { font-size: 13px; }

	/* Generator panel */
	.gen-panel {
		border-radius: var(--radius-xl);
		border: 1px solid var(--color-border);
		background: var(--color-surface);
		overflow: hidden;
	}
	.gen-panel-header {
		padding: 16px 20px;
		border-bottom: 1px solid var(--color-border-subtle);
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 12px;
	}
	.gen-type-badge {
		display: flex;
		align-items: center;
		gap: 6px;
		font-size: 13px;
		font-weight: 600;
		color: var(--color-text);
	}
	.gen-type-desc {
		font-size: 12px;
		color: var(--color-text-tertiary);
	}
	.gen-form {
		padding: 20px;
		display: flex;
		flex-direction: column;
		gap: 16px;
	}
	.gen-row {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 12px;
	}
	@media (max-width: 640px) {
		.gen-row { grid-template-columns: 1fr; }
	}
	.gen-field { display: flex; flex-direction: column; gap: 6px; }

	.field-label {
		font-size: 11px;
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.05em;
		color: var(--color-text-secondary);
	}
	.label-hint {
		font-weight: 400;
		text-transform: none;
		letter-spacing: 0;
		color: var(--color-text-tertiary);
	}
	.field-input, .field-textarea {
		border-radius: var(--radius-md);
		border: 1px solid var(--color-border);
		background: var(--color-bg);
		padding: 10px 14px;
		font-size: 14px;
		color: var(--color-text);
		transition: border-color var(--duration-fast) var(--easing), box-shadow var(--duration-fast) var(--easing);
	}
	.field-input { height: 42px; }
	.field-input::placeholder, .field-textarea::placeholder { color: var(--color-text-tertiary); }
	.field-input:focus, .field-textarea:focus {
		outline: none;
		border-color: var(--color-primary);
		box-shadow: 0 0 0 3px rgba(0, 122, 255, 0.1);
	}
	.field-textarea {
		resize: vertical;
		min-height: 60px;
		font-family: inherit;
		line-height: 1.5;
	}
	.gen-footer {
		padding: 16px 20px;
		border-top: 1px solid var(--color-border-subtle);
		display: flex;
		justify-content: flex-end;
	}
	.gen-btn {
		height: 42px;
		border-radius: var(--radius-lg);
		background: var(--color-primary);
		color: white;
		border: none;
		padding: 0 24px;
		font-size: 14px;
		font-weight: 600;
		cursor: pointer;
		display: inline-flex;
		align-items: center;
		gap: 8px;
		transition: all var(--duration-fast) var(--easing);
	}
	.gen-btn:hover:not(:disabled) {
		filter: brightness(1.08);
		box-shadow: 0 4px 12px rgba(0, 122, 255, 0.3);
	}
	.gen-btn:disabled { opacity: 0.6; cursor: not-allowed; }
	.gen-spinner {
		width: 16px;
		height: 16px;
		border-radius: 50%;
		border: 2px solid rgba(255,255,255,0.3);
		border-top-color: white;
		animation: spin 0.6s linear infinite;
	}
	@keyframes spin { to { transform: rotate(360deg); } }

	/* Preview panel */
	.preview-panel {
		border-radius: var(--radius-xl);
		border: 1px solid var(--color-border);
		background: var(--color-surface);
		overflow: hidden;
	}
	.preview-header {
		padding: 14px 20px;
		border-bottom: 1px solid var(--color-border-subtle);
		display: flex;
		align-items: center;
		justify-content: space-between;
	}
	.preview-title {
		font-size: 13px;
		font-weight: 600;
		color: var(--color-text);
	}
	.preview-actions { display: flex; gap: 4px; }
	.preview-action-btn {
		display: flex;
		align-items: center;
		gap: 5px;
		padding: 6px 12px;
		border-radius: var(--radius-md);
		font-size: 12px;
		font-weight: 600;
		color: var(--color-primary);
		background: none;
		border: none;
		cursor: pointer;
		transition: background var(--duration-fast) var(--easing);
	}
	.preview-action-btn:hover { background: rgba(0, 122, 255, 0.06); }
	.preview-body { padding: 20px; }
	.preview-code {
		font-family: 'SF Mono', 'Fira Code', 'Cascadia Code', monospace;
		font-size: 12px;
		line-height: 1.7;
		color: var(--color-text-secondary);
		white-space: pre-wrap;
		word-break: break-word;
		margin: 0;
	}

	/* Library stats */
	.library-stats {
		display: flex;
		gap: 24px;
	}
	.lib-stat {
		display: flex;
		flex-direction: column;
		gap: 2px;
	}
	.lib-stat-value {
		font-size: 24px;
		font-weight: 700;
		font-variant-numeric: tabular-nums;
		color: var(--color-text);
		letter-spacing: -0.02em;
	}
	.draft-val { color: var(--color-warning); }
	.published-val { color: var(--color-success); }
	.lib-stat-label {
		font-size: 11px;
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.05em;
		color: var(--color-text-tertiary);
	}

	/* Library panel */
	.library-panel {
		border-radius: var(--radius-xl);
		border: 1px solid var(--color-border);
		background: var(--color-surface);
		overflow: hidden;
	}
	.library-loading {
		padding: 16px;
		display: flex;
		flex-direction: column;
		gap: 8px;
	}
	.library-empty {
		padding: 60px 20px;
		text-align: center;
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 12px;
	}
	.empty-icon-wrap {
		width: 48px;
		height: 48px;
		border-radius: 50%;
		background: var(--color-bg-tertiary);
		display: flex;
		align-items: center;
		justify-content: center;
		color: var(--color-text-tertiary);
	}
	.empty-text {
		font-size: 13px;
		color: var(--color-text-secondary);
	}

	.library-list { display: flex; flex-direction: column; }
	.library-item {
		display: flex;
		border-bottom: 1px solid var(--color-border-subtle);
		transition: background var(--duration-fast) var(--easing);
	}
	.library-item:last-child { border-bottom: none; }
	.library-item:hover { background: var(--color-bg-secondary); }

	.item-left-stripe {
		width: 3px;
		flex-shrink: 0;
	}
	.item-left-stripe.status-draft { background: var(--color-warning); }
	.item-left-stripe.status-published { background: var(--color-success); }

	.item-body {
		flex: 1;
		padding: 14px 20px;
		min-width: 0;
	}
	.item-top {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 8px;
	}
	.item-meta {
		display: flex;
		align-items: center;
		gap: 8px;
	}
	.item-type {
		font-size: 10px;
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: 0.06em;
		color: var(--color-primary);
	}
	.item-status {
		font-size: 10px;
		font-weight: 600;
		padding: 2px 8px;
		border-radius: 100px;
	}
	.item-status.is-draft { background: rgba(255, 149, 0, 0.1); color: var(--color-warning); }
	.item-status.is-published { background: rgba(52, 199, 89, 0.1); color: var(--color-success); }

	.item-actions {
		display: flex;
		gap: 2px;
		opacity: 0.6;
		transition: opacity var(--duration-fast) var(--easing);
	}
	.library-item:hover .item-actions { opacity: 1; }

	.action-btn {
		width: 32px;
		height: 32px;
		border-radius: var(--radius-md);
		background: none;
		border: none;
		cursor: pointer;
		display: flex;
		align-items: center;
		justify-content: center;
		color: var(--color-text-secondary);
		transition: all var(--duration-fast) var(--easing);
	}
	.action-btn:hover { background: var(--color-bg-tertiary); color: var(--color-text); }
	.action-btn.publish:hover { color: var(--color-success); }
	.action-btn.delete:hover { color: var(--color-danger); }

	.item-title {
		font-size: 14px;
		font-weight: 600;
		color: var(--color-text);
		margin-top: 6px;
		line-height: 1.3;
	}
	.item-domain {
		font-size: 12px;
		color: var(--color-text-tertiary);
		margin-top: 2px;
	}

	/* Edit area */
	.edit-area {
		margin-top: 12px;
		border-radius: var(--radius-lg);
		border: 1px solid var(--color-border);
		overflow: hidden;
	}
	.edit-textarea {
		width: 100%;
		border: none;
		background: var(--color-bg);
		padding: 14px;
		font-family: 'SF Mono', 'Fira Code', monospace;
		font-size: 12px;
		line-height: 1.7;
		color: var(--color-text);
		resize: vertical;
	}
	.edit-textarea:focus { outline: none; }
	.edit-actions {
		display: flex;
		gap: 8px;
		justify-content: flex-end;
		padding: 10px 14px;
		border-top: 1px solid var(--color-border-subtle);
		background: var(--color-bg-secondary);
	}
	.edit-cancel {
		padding: 6px 14px;
		border-radius: var(--radius-md);
		font-size: 12px;
		font-weight: 600;
		color: var(--color-text-secondary);
		background: none;
		border: none;
		cursor: pointer;
	}
	.edit-cancel:hover { color: var(--color-text); }
	.edit-save {
		padding: 6px 14px;
		border-radius: var(--radius-md);
		font-size: 12px;
		font-weight: 600;
		color: white;
		background: var(--color-primary);
		border: none;
		cursor: pointer;
	}
	.edit-save:hover { filter: brightness(1.08); }
</style>
