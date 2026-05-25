<script lang="ts">
	const footerLinks = [
		{
			title: 'Product',
			links: [
				{ label: 'Features', href: '#features' },
				{ label: 'Demo', href: '/demo' },
				{ label: 'Pricing', href: '#pricing' },
				{ label: 'Changelog', href: '/changelog' }
			]
		},
		{
			title: 'Company',
			links: [
				{ label: 'About', href: '/about' },
				{ label: 'Blog', href: '/blog' },
				{ label: 'Support', href: '/support' },
				{ label: 'Contact', href: '/contact' }
			]
		},
		{
			title: 'Legal',
			links: [
				{ label: 'Privacy', href: '/privacy' },
				{ label: 'Terms', href: '/terms' },
				{ label: 'Security', href: '/security' },
				{ label: 'DPA', href: '/dpa' }
			]
		}
	];
</script>

<section class="final-cta">
	<div class="cta-inner">
		<h2>Stop juggling admin portals.<br /><span class="muted">Start controlling your tenants.</span></h2>
		<div class="cta-row">
			<a href="https://app.tenantiq.app" class="btn-primary">
				Start free trial
				<svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M3 8h10m0 0L9 4m4 4L9 12" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
			</a>
		</div>
		<p class="cta-sub">14-day free trial. No credit card required.</p>
	</div>
</section>

<footer class="footer">
	<div class="footer-inner">
		<div class="brand">
			<span class="brand-name">TenantIQ</span>
			<p>AI-powered Microsoft 365 control plane for Managed Service Providers.</p>
		</div>
		{#each footerLinks as section}
			<div class="col">
				<h4>{section.title}</h4>
				{#each section.links as link}
					<a href={link.href}>{link.label}</a>
				{/each}
			</div>
		{/each}
	</div>
	<div class="footer-bottom">
		<p>&copy; 2026 TenantIQ. All rights reserved.</p>
	</div>
</footer>

<style>
	.final-cta {
		padding: 6rem 5%;
		text-align: center;
		border-top: 1px solid rgba(255,255,255,0.04);
		background: radial-gradient(ellipse 60% 50% at 50% 100%, rgba(16,185,129,0.06) 0%, transparent 60%);
	}
	.cta-inner { max-width: 640px; margin: 0 auto; }

	h2 {
		font-size: clamp(1.75rem, 4vw, 2.5rem);
		font-weight: 700;
		letter-spacing: -0.03em;
		line-height: 1.2;
		color: #f1f5f9;
		margin-bottom: 2rem;
	}
	.muted { color: #475569; }

	.cta-row { display: flex; justify-content: center; }
	.btn-primary {
		display: inline-flex; align-items: center; gap: 0.5rem;
		padding: 0.9rem 2rem;
		background: #10b981; color: #fff;
		font-weight: 600; font-size: 0.95rem;
		border-radius: 10px; text-decoration: none;
		transition: all 0.2s; min-height: 48px;
	}
	.btn-primary:hover { background: #059669; box-shadow: 0 0 32px rgba(16,185,129,0.3); }
	.cta-sub { margin-top: 1rem; font-size: 0.8rem; color: #475569; }

	.footer {
		padding: 4rem 5% 2rem;
		max-width: 1100px;
		margin: 0 auto;
	}
	.footer-inner {
		display: grid;
		grid-template-columns: 2fr 1fr 1fr 1fr;
		gap: 3rem;
		margin-bottom: 3rem;
	}

	.brand-name {
		display: block;
		font-size: 1.1rem;
		font-weight: 800;
		color: #f1f5f9;
		letter-spacing: -0.02em;
		margin-bottom: 0.6rem;
	}
	.brand p { color: #475569; line-height: 1.6; font-size: 0.8rem; max-width: 260px; }

	.col h4 {
		font-size: 0.7rem;
		font-weight: 600;
		margin-bottom: 0.85rem;
		color: #64748b;
		text-transform: uppercase;
		letter-spacing: 0.06em;
	}
	.col a {
		display: block; color: #475569; text-decoration: none;
		margin-bottom: 0.5rem; font-size: 0.8rem;
		transition: color 0.15s;
	}
	.col a:hover { color: #e2e8f0; }

	.footer-bottom {
		padding-top: 2rem;
		border-top: 1px solid rgba(255,255,255,0.04);
		text-align: center;
		color: #334155;
		font-size: 0.75rem;
	}

	@media (max-width: 768px) {
		.footer-inner { grid-template-columns: 1fr 1fr; gap: 2rem; }
		.brand { grid-column: 1 / -1; }
	}
	@media (max-width: 480px) {
		.final-cta { padding: 4rem 4%; }
		.footer { padding: 3rem 4% 1.5rem; }
		.btn-primary { width: 100%; justify-content: center; }
	}
</style>
