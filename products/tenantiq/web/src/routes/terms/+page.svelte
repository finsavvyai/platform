<svelte:head>
	<title>Terms of Service — TenantIQ</title>
	<meta name="description" content="TenantIQ Terms of Service — conditions for using our AI-powered Microsoft 365 security, compliance, and cost intelligence platform." />
	<link rel="canonical" href="https://app.tenantiq.app/terms" />
</svelte:head>

<div class="legal-page">
	<div class="legal-container">
		<p class="last-updated">Last updated: April 2026</p>
		<h1>Terms of Service</h1>
		<p class="intro">These Terms of Service ("Terms") govern your access to and use of TenantIQ. By using our platform, you agree to these Terms.</p>

		<section>
			<h2>1. Acceptance of Terms</h2>
			<p>By accessing or using TenantIQ, you confirm that you have the authority to bind your organization to these Terms. If you do not agree, do not use the platform.</p>
		</section>

		<section>
			<h2>2. Description of Service</h2>
			<p>TenantIQ is a SaaS platform that provides AI-powered security monitoring, compliance automation, and cost optimization for Microsoft 365 environments. Features include CIS benchmark assessments, threat detection, license management, and automated remediation workflows.</p>
		</section>

		<section>
			<h2>3. Account Registration</h2>
			<ul>
				<li>You must provide accurate and complete registration information.</li>
				<li>You are responsible for maintaining the security of your account credentials.</li>
				<li>You must have appropriate Microsoft 365 administrative permissions (Global Admin or Security Admin) to connect a tenant.</li>
				<li>You are responsible for all activity that occurs under your account.</li>
			</ul>
		</section>

		<section>
			<h2>4. Acceptable Use</h2>
			<p>You agree not to:</p>
			<ul>
				<li>Use the platform to violate any applicable law or regulation.</li>
				<li>Attempt to gain unauthorized access to other tenants or platform infrastructure.</li>
				<li>Reverse-engineer, decompile, or disassemble any part of the platform.</li>
				<li>Use the platform to distribute malware or conduct cyberattacks.</li>
				<li>Exceed published API rate limits or abuse platform resources.</li>
			</ul>
		</section>

		<section>
			<h2>5. Microsoft Integration</h2>
			<ul>
				<li>TenantIQ accesses your Microsoft 365 tenant via delegated Microsoft Graph API permissions that you explicitly grant.</li>
				<li>Remediation actions (e.g., disabling accounts, revoking sessions, updating policies) are initiated by you and executed on your behalf — TenantIQ does not take autonomous actions.</li>
				<li>You remain responsible for all changes made to your tenant through TenantIQ.</li>
				<li>You may revoke TenantIQ's access at any time through Microsoft Entra ID.</li>
			</ul>
		</section>

		<section>
			<h2>6. Data & Privacy</h2>
			<p>Your data is governed by our <a href="/privacy">Privacy Policy</a>. Key commitments:</p>
			<ul>
				<li>Tenant data is strictly isolated — no cross-tenant access.</li>
				<li>Data is encrypted in transit and at rest.</li>
				<li>We do not sell or share your data with third-party advertisers.</li>
				<li>Backup data is retained per your plan terms.</li>
			</ul>
		</section>

		<section>
			<h2>7. Intellectual Property</h2>
			<p>TenantIQ and all related software, documentation, designs, and content are the intellectual property of TenantIQ. You retain ownership of your data. You grant us a limited license to process your data solely to provide the platform's services.</p>
		</section>

		<section>
			<h2>8. Billing & Payment</h2>
			<ul>
				<li>Paid plans are billed monthly or annually through LemonSqueezy or Microsoft AppSource.</li>
				<li>Prices are listed in USD and may be updated with 30 days' notice.</li>
				<li>Free trials last 14 days with full feature access.</li>
				<li>Failure to pay may result in service suspension after a 7-day grace period.</li>
			</ul>
		</section>

		<section>
			<h2>9. Service Level Agreement</h2>
			<p>For paid plans, we commit to 99.9% platform uptime, measured monthly, excluding scheduled maintenance. If we fail to meet this SLA, affected customers may request a pro-rated service credit.</p>
		</section>

		<section>
			<h2>10. Disclaimers</h2>
			<p>TenantIQ is provided "as is" without warranties of any kind. We do not guarantee that security scans will detect all vulnerabilities or that remediation actions will resolve all issues. You are responsible for reviewing and approving all changes to your environment.</p>
		</section>

		<section>
			<h2>11. Limitation of Liability</h2>
			<p>To the maximum extent permitted by law, TenantIQ's total liability for any claims arising from use of the platform shall not exceed the fees paid by you in the 12 months preceding the claim. We are not liable for indirect, incidental, or consequential damages.</p>
		</section>

		<section>
			<h2>12. Termination</h2>
			<p>Either party may terminate at any time. Upon termination, your access is revoked and data is deleted within 30 days. You may export your data before termination using the platform's export features.</p>
		</section>

		<section>
			<h2>13. Governing Law</h2>
			<p>These Terms are governed by and construed in accordance with the laws of the State of Delaware, United States, without regard to conflict of law principles.</p>
		</section>

		<section>
			<h2>14. Contact</h2>
			<p>Questions about these Terms? Contact us:</p>
			<ul>
				<li>Email: <a href="mailto:legal@tenantiq.app">legal@tenantiq.app</a></li>
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
	a { color: var(--color-primary); text-decoration: none; }
	a:hover { text-decoration: underline; }
	@media (max-width: 640px) { h1 { font-size: 1.75rem; } .legal-page { padding: 2rem 1rem 3rem; } }
</style>
