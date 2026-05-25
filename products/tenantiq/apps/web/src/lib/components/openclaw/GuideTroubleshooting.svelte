<script lang="ts">
	const items = [
		{
			summary: 'Command not found: openclaw',
			content: 'Make sure OpenClaw is installed and in your PATH. Try running:',
			code: 'which openclaw',
			footer: 'If not found, reinstall using the installation command from Step 1.'
		},
		{
			summary: 'Authentication failed',
			content: 'Ensure you have the correct permissions in your Microsoft 365 tenant. You need:',
			list: [
				'Global Administrator role, or',
				'Cloud Application Administrator role, or',
				'Application Administrator role'
			]
		},
		{
			summary: 'Webhooks not receiving notifications',
			content: 'Check the following:',
			list: [
				'Webhook URL is accessible from the internet',
				'Webhook secret matches on both ends',
				'Webhook is enabled in configuration',
				'Alert severity is above the minimum threshold'
			]
		},
		{
			summary: 'Commands not working in messaging platform',
			content: 'Verify:',
			list: [
				'Platform is connected (check connection status)',
				'Bot/app has necessary permissions in the channel',
				'OpenClaw service is running',
				'TenantIQ skill is installed'
			]
		}
	];
</script>

<div class="troubleshooting">
	<h3>Troubleshooting</h3>

	{#each items as item}
		<details>
			<summary>{item.summary}</summary>
			<p>{item.content}</p>
			{#if item.code}
				<div class="code-block">
					<code>{item.code}</code>
				</div>
				{#if item.footer}
					<p>{item.footer}</p>
				{/if}
			{/if}
			{#if item.list}
				<ul>
					{#each item.list as entry}
						<li>{entry}</li>
					{/each}
				</ul>
			{/if}
		</details>
	{/each}
</div>

<style>
	.troubleshooting {
		background: #f8f9fa;
		padding: 1.5rem;
		border-radius: 8px;
		margin-top: 2rem;
	}

	.troubleshooting h3 {
		margin-bottom: 1rem;
		color: #1a1a1a;
	}

	details {
		background: white;
		padding: 1rem;
		border-radius: 6px;
		margin-bottom: 0.5rem;
		cursor: pointer;
	}

	summary {
		font-weight: 600;
		color: #1a1a1a;
	}

	details[open] summary {
		margin-bottom: 1rem;
		color: #0066cc;
	}

	details p {
		margin: 0.5rem 0;
		color: #666;
	}

	details ul {
		margin: 0.5rem 0 0 1.5rem;
		color: #666;
	}

	.code-block {
		background: #f5f5f5;
		padding: 1rem;
		border-radius: 6px;
		font-family: 'Courier New', monospace;
		margin: 1rem 0;
		border-left: 4px solid #0066cc;
	}

	.code-block code {
		color: #333;
	}
</style>
