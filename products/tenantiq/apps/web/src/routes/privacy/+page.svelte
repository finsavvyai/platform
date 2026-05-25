<svelte:head>
	<title>Privacy Policy — TenantIQ</title>
	<meta name="description" content="TenantIQ Privacy Policy — how we collect, use, and protect your Microsoft 365 tenant data. SOC 2 compliant, AES-256 encryption, tenant data isolation." />
	<link rel="canonical" href="https://app.tenantiq.app/privacy" />
</svelte:head>

<div class="legal-page">
	<div class="legal-container">
		<p class="last-updated">Last updated: April 2026</p>
		<h1>Privacy Policy</h1>
		<p class="intro">TenantIQ ("we", "our", "us") is committed to protecting your privacy. This policy explains how we collect, use, and safeguard information when you use our platform.</p>

		<section>
			<h2>1. Information We Collect</h2>
			<p>We collect information you provide directly and data accessed through integrations:</p>
			<ul>
				<li><strong>Account Information</strong> — name, email, organization details provided during registration.</li>
				<li><strong>Microsoft 365 Tenant Data</strong> — users, groups, licenses, security events, audit logs, mail flow metadata, and policy configurations accessed via Microsoft Graph API with your delegated consent.</li>
				<li><strong>Usage Data</strong> — pages visited, features used, session duration, and interaction patterns.</li>
				<li><strong>Device & Browser Data</strong> — IP address, browser type, operating system, and screen resolution.</li>
			</ul>
		</section>

		<section>
			<h2>2. How We Use Your Information</h2>
			<ul>
				<li>Provide, operate, and improve the TenantIQ platform.</li>
				<li>Run security scans, CIS benchmark assessments, and compliance checks on your tenant data.</li>
				<li>Generate AI-powered insights, anomaly detection, and optimization recommendations.</li>
				<li>Send security alerts, notifications, and operational updates.</li>
				<li>Process billing and manage your subscription.</li>
				<li>Respond to support requests and communicate about your account.</li>
			</ul>
		</section>

		<section>
			<h2>3. Data Storage & Security</h2>
			<p>Your data is stored on Cloudflare's global edge network using:</p>
			<ul>
				<li><strong>Cloudflare D1</strong> (SQLite) — structured tenant data with per-organization isolation.</li>
				<li><strong>Cloudflare KV</strong> — cached tokens, scores, and session data.</li>
				<li><strong>Cloudflare R2</strong> — encrypted backups and exported reports (AES-256-GCM encryption).</li>
			</ul>
			<p>All data is encrypted in transit (TLS 1.3) and at rest. Each tenant's data is strictly isolated — no cross-tenant data access is possible.</p>
		</section>

		<section>
			<h2>4. Third-Party Services</h2>
			<p>We integrate with the following services to deliver our platform:</p>
			<ul>
				<li><strong>Microsoft Graph API</strong> — to read and manage your M365 tenant configuration with your consent.</li>
				<li><strong>Anthropic Claude</strong> — AI analysis for security anomaly detection, optimization, and compliance insights. Tenant data sent to Claude is not used to train AI models.</li>
				<li><strong>Resend</strong> — transactional email delivery (alerts, notifications).</li>
				<li><strong>LemonSqueezy / Microsoft AppSource</strong> — payment processing and subscription management.</li>
			</ul>
			<p>We do not sell, rent, or share your data with advertisers or data brokers.</p>
		</section>

		<section>
			<h2>5. Data Retention</h2>
			<p>We retain your data for as long as your account is active or as needed to provide services. Specifically:</p>
			<ul>
				<li>Account data — retained until account deletion is requested.</li>
				<li>Tenant scan results — retained per your plan's history limits.</li>
				<li>Backups — retained per your plan terms, then permanently deleted.</li>
				<li>Audit logs — retained for 12 months for compliance purposes.</li>
			</ul>
			<p>Upon account deletion request (<code>DELETE /api/account</code> or via Settings → Account), primary stores (D1, KV, R2) are purged immediately; encrypted infrastructure backups age out within 30 days and are not restored on customer request after deletion. See <a href="https://github.com/tenantiq/tenantiq/blob/main/docs/DATA_DELETION.md" rel="noopener">DATA_DELETION.md</a>.</p>
		</section>

		<section>
			<h2>6. Your Rights (GDPR / CCPA)</h2>
			<p>Depending on your jurisdiction, you may have the following rights:</p>
			<ul>
				<li><strong>Access / Portability</strong> — <code>GET /api/account/export</code> returns your organization, members, and connected tenants in JSON.</li>
				<li><strong>Rectification</strong> — edit profile in Settings or email <a href="mailto:privacy@tenantiq.app">privacy@tenantiq.app</a>.</li>
				<li><strong>Deletion</strong> — <code>DELETE /api/account</code> with body <code>&#123;"confirm":"DELETE"&#125;</code> triggers the cascade above.</li>
				<li><strong>Restriction</strong> — limit how we process your data.</li>
				<li><strong>Objection</strong> — object to processing based on legitimate interests.</li>
			</ul>
			<p>To exercise rights without using the API, email <a href="mailto:privacy@tenantiq.app">privacy@tenantiq.app</a>. We respond within 30 days. Sub-processors are listed at <a href="https://github.com/tenantiq/tenantiq/blob/main/docs/SUB_PROCESSORS.md" rel="noopener">SUB_PROCESSORS.md</a>; the DPA is at <a href="https://github.com/tenantiq/tenantiq/blob/main/docs/DPA.md" rel="noopener">DPA.md</a>.</p>
		</section>

		<section>
			<h2>7. Children's Privacy</h2>
			<p>TenantIQ is a business-to-business platform and is not intended for use by individuals under the age of 16. We do not knowingly collect personal information from children.</p>
		</section>

		<section>
			<h2>8. Changes to This Policy</h2>
			<p>We may update this policy from time to time. Material changes will be communicated via email or an in-app notification at least 30 days before they take effect.</p>
		</section>

		<section>
			<h2>9. Contact Us</h2>
			<p>If you have questions about this privacy policy or our data practices, contact us:</p>
			<ul>
				<li>Email: <a href="mailto:privacy@tenantiq.app">privacy@tenantiq.app</a></li>
				<li>Support: <a href="/support">tenantiq.app/support</a></li>
			</ul>
		</section>
	</div>
</div>

<style>
	.legal-page { min-height: 100vh; background: var(--color-bg); padding: 3rem 1.5rem 4rem; }
	.legal-container { max-width: 720px; margin: 0 auto; }
	.last-updated { font-size: 0.8rem; color: var(--color-text-tertiary); text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 0.5rem; }
	h1 { font-size: 2.25rem; font-weight: 700; color: var(--color-text); margin-bottom: 1rem; }
	.intro { font-size: 1.05rem; color: var(--color-text-secondary); line-height: 1.7; margin-bottom: 2.5rem; }
	section { margin-bottom: 2rem; }
	h2 { font-size: 1.15rem; font-weight: 600; color: var(--color-text); margin-bottom: 0.75rem; padding-bottom: 0.5rem; border-bottom: 1px solid var(--color-border-subtle); }
	p { color: var(--color-text-secondary); line-height: 1.7; margin-bottom: 0.75rem; }
	ul { padding-left: 1.25rem; margin-bottom: 0.75rem; }
	li { color: var(--color-text-secondary); line-height: 1.7; margin-bottom: 0.4rem; }
	li strong { color: var(--color-text); }
	a { color: var(--color-primary); text-decoration: none; }
	a:hover { text-decoration: underline; }
	@media (max-width: 640px) { h1 { font-size: 1.75rem; } .legal-page { padding: 2rem 1rem 3rem; } }
</style>
