<script lang="ts">
	import type { Component } from 'svelte';

	interface Props {
		title: string;
		description?: string;
		icon?: Component;
		iconPath?: string;
		children?: any;
	}

	let { title, description, icon: Icon, iconPath, children }: Props = $props();
</script>

<header class="animate-fade-up page-header">
	<div class="page-header-left">
		{#if Icon || iconPath}
			<div class="page-header-icon">
				{#if Icon}
					<Icon size={20} strokeWidth={1.5} />
				{:else if iconPath}
					<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d={iconPath} /></svg>
				{/if}
			</div>
		{/if}
		<div>
			<h1 class="page-title">{title}</h1>
			{#if description}
				<p class="page-desc">{description}</p>
			{/if}
		</div>
	</div>
	{#if children}
		<div class="page-header-actions">
			{@render children()}
		</div>
	{/if}
</header>

<style>
	.page-header {
		display: flex;
		align-items: flex-start;
		justify-content: space-between;
		gap: 16px;
		flex-wrap: wrap;
	}
	.page-header-left {
		display: flex;
		align-items: flex-start;
		gap: 14px;
	}
	.page-header-icon {
		width: 42px;
		height: 42px;
		border-radius: var(--radius-lg);
		background: linear-gradient(135deg, rgba(0, 122, 255, 0.08), rgba(88, 86, 214, 0.08));
		display: flex;
		align-items: center;
		justify-content: center;
		color: var(--color-primary);
		flex-shrink: 0;
	}
	.page-title {
		font-size: 20px;
		font-weight: 600;
		letter-spacing: -0.02em;
		color: var(--color-text);
		line-height: 1.2;
	}
	.page-desc {
		font-size: 13px;
		color: var(--color-text-secondary);
		margin-top: 2px;
		line-height: 1.4;
	}
	.page-header-actions {
		display: flex;
		align-items: center;
		gap: 8px;
		flex-shrink: 0;
	}
</style>
