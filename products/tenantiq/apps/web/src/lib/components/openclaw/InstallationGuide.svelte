<script lang="ts">
	import GuideStepCard from './GuideStepCard.svelte';
	import GuideTroubleshooting from './GuideTroubleshooting.svelte';
	import GuideSupport from './GuideSupport.svelte';

	let activeStep = $state(1);

	const platforms = [
		{ name: 'Slack', command: 'openclaw connect slack', hint: 'Follow the prompts to authorize the Slack app.' },
		{ name: 'Microsoft Teams', command: 'openclaw connect teams', hint: 'Sign in with your Microsoft account.' },
		{ name: 'Discord', command: 'openclaw connect discord', hint: 'Provide your Discord bot token.' },
		{ name: 'WhatsApp', command: 'openclaw connect whatsapp', hint: 'Scan the QR code with WhatsApp.' }
	];

	const testCommands = [
		{ command: 'tenantiq help', description: 'See all available commands' },
		{ command: 'tenantiq security status', description: "Check your tenant's security posture" },
		{ command: 'tenantiq license waste', description: 'Find wasted license costs' },
		{ command: 'tenantiq check alerts', description: 'See active alerts' }
	];
</script>

<div class="installation-guide">
	<h2>Installation Guide</h2>
	<p class="description">Follow these steps to set up TenantIQ with OpenClaw</p>

	<div class="steps">
		<GuideStepCard stepNumber={1} title="Install OpenClaw" active={activeStep === 1} onActivate={() => activeStep = 1}>
			<p>First, install the OpenClaw platform on your system:</p>
			<div class="code-block"><code>curl -fsSL https://openclaw.sh | sh</code></div>
			<p>Or using npm:</p>
			<div class="code-block"><code>npm install -g openclaw</code></div>
			<div class="info-box">
				<strong>Info:</strong> OpenClaw runs locally on your computer or server and connects to your messaging platforms.
			</div>
		</GuideStepCard>

		<GuideStepCard stepNumber={2} title="Install TenantIQ Skill" active={activeStep === 2} onActivate={() => activeStep = 2}>
			<p>Install the TenantIQ skill package:</p>
			<div class="code-block"><code>openclaw install tenantiq</code></div>
			<p>Verify installation:</p>
			<div class="code-block"><code>openclaw list</code></div>
			<p>You should see "tenantiq" in the installed skills list.</p>
			<div class="success-box">
				<strong>Success!</strong> The TenantIQ skill includes 20+ commands for managing your Microsoft 365 tenants.
			</div>
		</GuideStepCard>

		<GuideStepCard stepNumber={3} title="Authenticate with TenantIQ" active={activeStep === 3} onActivate={() => activeStep = 3}>
			<p>Run the setup command to authenticate:</p>
			<div class="code-block"><code>tenantiq setup</code></div>
			<p>This will:</p>
			<ol>
				<li>Open your browser to TenantIQ authentication page</li>
				<li>Prompt you to sign in with Microsoft</li>
				<li>Grant permissions to access your tenant data</li>
				<li>Store the authentication token securely</li>
			</ol>
			<div class="warning-box">
				<strong>Important:</strong> Make sure you have admin permissions in your Microsoft 365 tenant.
			</div>
		</GuideStepCard>

		<GuideStepCard stepNumber={4} title="Connect Messaging Platforms" active={activeStep === 4} onActivate={() => activeStep = 4}>
			<p>Connect your preferred messaging platforms:</p>
			<div class="platform-instructions">
				{#each platforms as platform}
					<div class="platform">
						<h4>{platform.name}</h4>
						<div class="code-block"><code>{platform.command}</code></div>
						<p>{platform.hint}</p>
					</div>
				{/each}
			</div>
		</GuideStepCard>

		<GuideStepCard stepNumber={5} title="Configure Webhooks" active={activeStep === 5} onActivate={() => activeStep = 5}>
			<p>Set up webhooks for real-time notifications:</p>
			<ol>
				<li>Go to the "Webhooks" tab in this page</li>
				<li>Copy your OpenClaw webhook URL</li>
				<li>Paste it in the "Webhook URL" field</li>
				<li>Generate a webhook secret</li>
				<li>Configure notification preferences</li>
				<li>Click "Save Configuration"</li>
			</ol>
			<p>Typical OpenClaw webhook URL format:</p>
			<div class="code-block"><code>https://your-openclaw-instance.com/webhooks/tenantiq</code></div>
			<div class="info-box">
				<strong>Info:</strong> Webhooks enable TenantIQ to send real-time alerts to your messaging platforms automatically.
			</div>
		</GuideStepCard>

		<GuideStepCard stepNumber={6} title="Test Commands" active={activeStep === 6} onActivate={() => activeStep = 6}>
			<p>Try these commands in your connected messaging platform:</p>
			<div class="test-commands">
				{#each testCommands as cmd}
					<div class="test-command">
						<div class="code-block"><code>{cmd.command}</code></div>
						<p>{cmd.description}</p>
					</div>
				{/each}
			</div>
			<div class="success-box">
				<strong>Congratulations!</strong> You're now managing your Microsoft 365 tenants from anywhere!
			</div>
		</GuideStepCard>
	</div>

	<GuideTroubleshooting />
	<GuideSupport />
</div>

<style>
	.installation-guide {
		background: white;
		padding: 2rem;
		border-radius: 12px;
		box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
	}

	h2 {
		margin-bottom: 0.5rem;
		color: #1a1a1a;
	}

	.description {
		color: #666;
		margin-bottom: 2rem;
	}

	.steps {
		display: flex;
		flex-direction: column;
		gap: 1rem;
		margin-bottom: 3rem;
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

	.info-box, .success-box, .warning-box {
		padding: 1rem; border-radius: 8px; margin: 1rem 0;
	}
	.info-box { background: #e3f2fd; border-left: 4px solid #2196f3; }
	.success-box { background: #d4edda; border-left: 4px solid #28a745; }
	.warning-box { background: #fff3cd; border-left: 4px solid #ffc107; }

	.platform-instructions {
		display: grid;
		gap: 1.5rem;
		margin: 1.5rem 0;
	}

	.platform h4 { margin-bottom: 0.5rem; color: #1a1a1a; }
	.platform p { margin: 0.5rem 0 0 0; font-size: 0.875rem; }
	.test-commands { display: flex; flex-direction: column; gap: 1rem; margin: 1.5rem 0; }
	.test-command p { margin: 0.5rem 0 0 0; font-size: 0.875rem; color: #666; }
</style>
