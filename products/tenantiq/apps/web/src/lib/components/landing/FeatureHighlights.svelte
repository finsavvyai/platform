<script lang="ts">
	const features = [
		{
			icon: 'M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z',
			title: '100+ CIS Controls',
			description: 'Automated CIS benchmark scanning with real-time compliance scoring and one-click remediation.',
		},
		{
			icon: 'M13.19 8.688a4.5 4.5 0 011.242 7.244l-4.5 4.5a4.5 4.5 0 01-6.364-6.364l1.757-1.757m9.86-2.02a4.5 4.5 0 00-6.364-6.364L4.5 8.257m9.86-2.02l4.5 4.5',
			title: '3 PSA Integrations',
			description: 'Native ConnectWise, Datto, and Kaseya integrations for bi-directional alert sync.',
		},
		{
			icon: 'M3.75 12h16.5m-16.5 3.75h16.5M3.75 19.5h16.5M5.625 4.5h12.75a1.875 1.875 0 010 3.75H5.625a1.875 1.875 0 010-3.75z',
			title: '25 Workflow Templates',
			description: 'Pre-built automation for user onboarding, license reclamation, and compliance reporting.',
		},
		{
			icon: 'M20.25 6.375c0 2.278-3.694 4.125-8.25 4.125S3.75 8.653 3.75 6.375m16.5 0c0-2.278-3.694-4.125-8.25-4.125S3.75 4.097 3.75 6.375m16.5 0v11.25c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125V6.375m16.5 0v3.75m-16.5-3.75v3.75m16.5 0v3.75C20.25 16.153 16.556 18 12 18s-8.25-1.847-8.25-4.125v-3.75',
			title: 'Data Backup',
			description: 'Enterprise-grade backup for Exchange, SharePoint, OneDrive, and Teams with point-in-time recovery.',
		},
	];
</script>

<section class="section">
	<div class="header">
		<span class="eyebrow">Capabilities</span>
		<h2>Everything MSPs need<br /><span class="muted">in one platform.</span></h2>
	</div>
	<div class="grid">
		{#each features as feature (feature.title)}
			<a href="/home" class="card">
				<div class="icon-box">
					<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
						<path stroke-linecap="round" stroke-linejoin="round" d={feature.icon} />
					</svg>
				</div>
				<h3>{feature.title}</h3>
				<p>{feature.description}</p>
			</a>
		{/each}
	</div>
</section>

<style>
	.section { padding: 8rem 5%; max-width: 1100px; margin: 0 auto; }
	.header { text-align: center; margin-bottom: 4rem; }
	.eyebrow { display: inline-block; padding: 0.3rem 0.9rem; border: 1px solid rgba(16,185,129,0.15); border-radius: 999px; font-size: 0.7rem; color: #10b981; font-weight: 600; letter-spacing: 0.06em; text-transform: uppercase; margin-bottom: 1.25rem; }
	h2 { font-size: clamp(2rem, 4vw, 3rem); font-weight: 700; letter-spacing: -0.03em; color: #f1f5f9; line-height: 1.15; }
	.muted { color: #475569; }

	.grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 1rem; }

	.card {
		background: rgba(255,255,255,0.02);
		border: 1px solid rgba(255,255,255,0.06);
		border-radius: 16px;
		padding: 1.75rem;
		text-decoration: none;
		color: inherit;
		transition: border-color 0.3s, box-shadow 0.3s;
	}
	.card:hover {
		border-color: rgba(16,185,129,0.2);
		box-shadow: 0 8px 24px rgba(0,0,0,0.15);
	}

	.icon-box {
		width: 40px; height: 40px;
		border-radius: 10px;
		background: rgba(16,185,129,0.08);
		border: 1px solid rgba(16,185,129,0.12);
		display: flex; align-items: center; justify-content: center;
		color: #10b981;
		margin-bottom: 1rem;
	}

	h3 { font-size: 0.95rem; font-weight: 650; color: #e2e8f0; letter-spacing: -0.01em; margin-bottom: 0.4rem; }
	p { font-size: 0.8rem; line-height: 1.6; color: #7a8a9a; }

	@media (max-width: 768px) {
		.section { padding: 5rem 5%; }
		.grid { grid-template-columns: 1fr 1fr; }
	}
	@media (max-width: 480px) {
		.section { padding: 3.5rem 4%; }
		.grid { grid-template-columns: 1fr; }
		.card { padding: 1.5rem; }
	}
</style>
