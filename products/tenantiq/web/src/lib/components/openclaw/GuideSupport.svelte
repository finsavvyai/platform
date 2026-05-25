<script lang="ts">
	const links = [
		{ icon: 'docs', label: 'Full Documentation', href: 'https://docs.tenantiq.app/openclaw' },
		{ icon: 'discord', label: 'Discord Community', href: 'https://discord.gg/tenantiq' },
		{ icon: 'email', label: 'support@tenantiq.app', href: 'mailto:support@tenantiq.app' },
		{ icon: 'github', label: 'GitHub Issues', href: 'https://github.com/tenantiq/openclaw-skill/issues' }
	];
</script>

<div class="support">
	<h3>Need Help?</h3>
	<p>If you're still having issues, we're here to help:</p>
	<ul>
		{#each links as link}
			<li>
				<a href={link.href} target="_blank" rel="noopener noreferrer">{link.label}</a>
			</li>
		{/each}
	</ul>
</div>

<style>
	.support {
		background: #f8f9fa;
		padding: 1.5rem;
		border-radius: 8px;
		margin-top: 2rem;
	}

	.support h3 {
		margin-bottom: 1rem;
		color: #1a1a1a;
	}

	.support ul {
		list-style: none;
		padding: 0;
		margin: 1rem 0;
	}

	.support li {
		margin-bottom: 0.75rem;
	}

	.support a {
		color: #0066cc;
		text-decoration: none;
		font-weight: 600;
	}

	.support a:hover {
		text-decoration: underline;
	}
</style>
