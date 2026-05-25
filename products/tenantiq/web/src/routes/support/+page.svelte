<script lang="ts">
	import { Search, Rocket, Code, Shield, CreditCard, Mail, Building, Activity } from 'lucide-svelte';

	let searchQuery = $state('');
	let openFaq = $state<number | null>(null);

	function toggleFaq(i: number) { openFaq = openFaq === i ? null : i; }

	const quickLinks = [
		{ title: 'Getting Started', description: 'Connect your first tenant and run your initial scan.', href: '/docs', Icon: Rocket },
		{ title: 'API Reference', description: 'Integrate TenantIQ with your tools and workflows.', href: '/docs/api', Icon: Code },
		{ title: 'Security & Compliance', description: 'CIS benchmarks, SOC 2, HIPAA, and GDPR controls.', href: '/security/cis', Icon: Shield },
		{ title: 'Billing & Plans', description: 'Manage subscriptions, invoices, and plan upgrades.', href: '/settings?tab=billing', Icon: CreditCard }
	];

	const faqs = [
		{ q: 'What Microsoft permissions does TenantIQ need?', a: 'TenantIQ requires delegated Microsoft Graph API permissions including User.Read.All, Directory.Read.All, SecurityEvents.Read.All, and Policy.Read.All. All permissions are read-only by default — write permissions are only requested when you enable remediation features.' },
		{ q: 'Is my tenant data secure?', a: 'Yes. All data is encrypted in transit (TLS 1.3) and at rest (AES-256). Each tenant\'s data is strictly isolated at the database level. We are SOC 2 compliant and undergo regular third-party security audits.' },
		{ q: 'Can I undo a remediation action?', a: 'Yes. Every remediation action is logged with a full audit trail. Most actions can be reversed from the audit history page. We recommend reviewing all changes before applying them.' },
		{ q: 'How does the free trial work?', a: 'The 14-day free trial includes full access to all features with one connected tenant. No credit card required. At the end of your trial, you can upgrade to a paid plan or your account will switch to the free tier.' },
		{ q: 'What compliance frameworks are supported?', a: 'TenantIQ supports CIS Microsoft 365 Benchmark (100+ controls), SOC 2, HIPAA, GDPR, NIST CSF, and Zero Trust assessments. Custom framework mappings are available on Enterprise plans.' }
	];
</script>

<svelte:head>
	<title>Support — TenantIQ</title>
	<meta name="description" content="Get help with TenantIQ — documentation, FAQs, API reference, and contact support for Microsoft 365 security and compliance." />
	<link rel="canonical" href="https://app.tenantiq.app/support" />
</svelte:head>

<div class="page">
	<div class="inner">
		<header class="hero">
			<h1>How can we help?</h1>
			<div class="search-wrap">
				<Search size={16} class="search-icon" />
				<input type="text" placeholder="Search docs, FAQs, and guides..." bind:value={searchQuery} aria-label="Search support" />
			</div>
		</header>

		<section class="cards">
			{#each quickLinks as link}
				{@const LinkIcon = link.Icon}
				<a href={link.href} class="card">
					<div class="card-icon"><LinkIcon size={18} /></div>
					<h3>{link.title}</h3>
					<p>{link.description}</p>
				</a>
			{/each}
		</section>

		<section class="contact">
			<h2>Contact</h2>
			<div class="contact-grid">
				<div class="contact-card">
					<div class="contact-icon"><Mail size={16} /></div>
					<h3>Email Support</h3>
					<a href="mailto:support@tenantiq.app">support@tenantiq.app</a>
					<p>90% resolved within 2 business days.</p>
				</div>
				<div class="contact-card">
					<div class="contact-icon"><Building size={16} /></div>
					<h3>Enterprise</h3>
					<a href="mailto:enterprise@tenantiq.app">enterprise@tenantiq.app</a>
					<p>Dedicated account manager and priority SLA.</p>
				</div>
				<div class="contact-card">
					<div class="contact-icon"><Activity size={16} /></div>
					<h3>System Status</h3>
					<div class="status">
						<span class="dot"></span>
						All systems operational
					</div>
				</div>
			</div>
		</section>

		<section class="faq">
			<h2>FAQ</h2>
			{#each faqs as faq, i}
				<button class="faq-item" class:open={openFaq === i} onclick={() => toggleFaq(i)}>
					<div class="faq-q">
						<span>{faq.q}</span>
						<svg class="chevron" width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M4 6l4 4 4-4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
					</div>
					{#if openFaq === i}
						<p class="faq-a">{faq.a}</p>
					{/if}
				</button>
			{/each}
		</section>
	</div>
</div>

<style>
	.page { min-height: 100vh; background: var(--color-bg); }
	.inner { max-width: 880px; margin: 0 auto; padding: 0 1.5rem 4rem; }

	.hero { text-align: center; padding: 3.5rem 0 3rem; }
	.hero h1 { font-size: clamp(1.75rem, 4vw, 2.25rem); font-weight: 700; letter-spacing: -0.03em; color: var(--color-text); margin-bottom: 1.5rem; }

	.search-wrap { position: relative; max-width: 480px; margin: 0 auto; }
	.search-wrap :global(.search-icon) { position: absolute; left: 14px; top: 50%; transform: translateY(-50%); color: var(--color-text-tertiary); pointer-events: none; }
	.search-wrap input {
		width: 100%; padding: 0.8rem 1rem 0.8rem 2.5rem;
		font-size: 0.9rem; border: 1px solid var(--color-border);
		border-radius: 12px; background: var(--color-surface);
		color: var(--color-text); outline: none; transition: border-color 0.15s;
	}
	.search-wrap input:focus { border-color: var(--color-primary); box-shadow: 0 0 0 3px rgba(16,185,129,0.1); }

	.cards { display: grid; grid-template-columns: repeat(2, 1fr); gap: 0.75rem; margin-bottom: 3rem; }
	.card {
		display: block; padding: 1.25rem; border: 1px solid var(--color-border);
		border-radius: 14px; background: var(--color-surface);
		text-decoration: none; transition: border-color 0.2s, box-shadow 0.2s;
	}
	.card:hover { border-color: var(--color-primary); box-shadow: 0 4px 16px rgba(0,0,0,0.08); }
	.card-icon {
		width: 32px; height: 32px; border-radius: 8px;
		background: rgba(16,185,129,0.08); color: var(--color-primary);
		display: flex; align-items: center; justify-content: center;
		margin-bottom: 0.75rem;
	}
	.card h3 { font-size: 0.9rem; font-weight: 600; color: var(--color-text); margin-bottom: 0.25rem; letter-spacing: -0.01em; }
	.card p { font-size: 0.8rem; color: var(--color-text-secondary); line-height: 1.5; margin: 0; }

	.contact { margin-bottom: 3rem; }
	h2 { font-size: 1.1rem; font-weight: 650; color: var(--color-text); margin-bottom: 1rem; letter-spacing: -0.01em; }

	.contact-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 0.75rem; }
	.contact-card { padding: 1.25rem; border: 1px solid var(--color-border); border-radius: 14px; background: var(--color-surface); }
	.contact-icon { width: 28px; height: 28px; border-radius: 7px; background: rgba(16,185,129,0.08); color: var(--color-primary); display: flex; align-items: center; justify-content: center; margin-bottom: 0.6rem; }
	.contact-card h3 { font-size: 0.85rem; font-weight: 600; color: var(--color-text); margin-bottom: 0.35rem; }
	.contact-card a { color: var(--color-primary); text-decoration: none; font-weight: 500; font-size: 0.8rem; }
	.contact-card a:hover { text-decoration: underline; }
	.contact-card p { font-size: 0.75rem; color: var(--color-text-secondary); line-height: 1.5; margin-top: 0.3rem; }
	.status { display: flex; align-items: center; gap: 0.4rem; font-size: 0.8rem; color: var(--color-success); font-weight: 500; margin-top: 0.35rem; }
	.dot { width: 7px; height: 7px; border-radius: 50%; background: var(--color-success); box-shadow: 0 0 6px var(--color-success); }

	.faq-item {
		display: block; width: 100%; text-align: left;
		border: 1px solid var(--color-border); border-radius: 12px;
		margin-bottom: 0.5rem; background: var(--color-surface);
		cursor: pointer; overflow: hidden; transition: border-color 0.15s;
	}
	.faq-item:hover { border-color: var(--color-primary); }
	.faq-q {
		display: flex; align-items: center; justify-content: space-between;
		padding: 0.9rem 1.1rem; font-size: 0.875rem; font-weight: 550;
		color: var(--color-text); gap: 1rem;
	}
	.chevron { color: var(--color-text-tertiary); transition: transform 0.2s; flex-shrink: 0; }
	.faq-item.open .chevron { transform: rotate(180deg); }
	.faq-a { padding: 0 1.1rem 1rem; font-size: 0.825rem; color: var(--color-text-secondary); line-height: 1.7; margin: 0; }

	@media (max-width: 768px) { .cards { grid-template-columns: 1fr; } .contact-grid { grid-template-columns: 1fr; } }
	@media (max-width: 480px) { .inner { padding: 0 1rem 3rem; } }
</style>
