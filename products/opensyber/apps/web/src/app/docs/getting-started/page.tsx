import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Getting Started with OpenSyber — Secure Your AI Agent in 5 Minutes',
  description:
    'Step-by-step guide to deploying a secured AI agent with OpenSyber. Create an account, deploy a hardened VM, install security skills, and start monitoring — all in under 5 minutes.',
  openGraph: {
    title: 'Getting Started with OpenSyber — Secure Your AI Agent in 5 Minutes',
    description:
      'Deploy a secured AI agent with real-time monitoring, credential vaulting, and supply chain scanning in under 5 minutes.',
    type: 'article',
  },
};

const jsonLd = {
  '@context': 'https://schema.org',
  '@type': 'HowTo',
  name: 'How to Secure an AI Coding Agent with OpenSyber',
  description:
    'Deploy a fully secured AI agent with real-time behavioral monitoring, encrypted credential storage, and audited security skills in under 5 minutes.',
  totalTime: 'PT5M',
  estimatedCost: { '@type': 'MonetaryAmount', currency: 'USD', value: '0' },
  tool: [
    { '@type': 'HowToTool', name: 'OpenSyber account (free)' },
    { '@type': 'HowToTool', name: 'Web browser' },
  ],
  step: [
    {
      '@type': 'HowToStep',
      position: 1,
      name: 'Create Your Account',
      text: 'Sign up at opensyber.cloud/sign-up. Every account starts on the Free plan with one agent instance and 3 verified skills. No credit card required.',
      url: 'https://opensyber.cloud/sign-up',
    },
    {
      '@type': 'HowToStep',
      position: 2,
      name: 'Deploy Your Agent',
      text: 'From the dashboard, click Deploy Instance. OpenSyber provisions a hardened VM with Docker isolation, read-only root filesystem, deny-by-default firewall, and encrypted credential storage in about 60 seconds.',
      url: 'https://opensyber.cloud/dashboard',
    },
    {
      '@type': 'HowToStep',
      position: 3,
      name: 'Install Security Skills',
      text: 'Navigate to the Skills marketplace. Every verified skill has passed multi-stage security audit: code review, sandboxed execution testing, and dependency scanning. Click Install to add a skill to your agent.',
      url: 'https://opensyber.cloud/marketplace',
    },
    {
      '@type': 'HowToStep',
      position: 4,
      name: 'Configure Security',
      text: 'Visit the Security Dashboard to see your score across 7 categories: gateway binding, credential storage, Docker isolation, skill verification, firewall rules, auto-patching, and audit logging. Set up alert rules for anomalies.',
      url: 'https://opensyber.cloud/dashboard',
    },
    {
      '@type': 'HowToStep',
      position: 5,
      name: 'Monitor and Iterate',
      text: 'OpenSyber continuously monitors your instance for security events. Use audit logs to review skill access, set policies to restrict file/network access, and track compliance against SOC 2 and ISO 27001.',
      url: 'https://opensyber.cloud/dashboard',
    },
  ],
};

export default function GettingStartedPage() {
  return (
    <article className="prose prose-invert max-w-none">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <h1 className="font-[family-name:var(--font-display)] text-4xl tracking-wide tracking-tight">Getting Started</h1>
      <p className="text-lg text-text-secondary mt-2">
        Go from zero to a fully secured AI agent in under 5 minutes.
      </p>

      <hr className="border-border my-8" />

      <h2 className="text-2xl font-semibold">1. Create Your Account</h2>
      <p className="text-text-secondary">
        Sign up at <code className="bg-surface px-1.5 py-0.5 rounded text-sm">opensyber.cloud/sign-up</code>.
        Every account starts on the Free plan with one agent instance and 3 verified skills included.
        No credit card required.
      </p>

      <h2 className="text-2xl font-semibold mt-8">2. Deploy Your Agent</h2>
      <p className="text-text-secondary">
        From the dashboard, click &quot;Deploy Instance&quot;. OpenSyber provisions a hardened VM
        with Docker isolation, read-only root filesystem, deny-by-default firewall, and encrypted
        credential storage. Your agent is ready in about 60 seconds.
      </p>

      <h2 className="text-2xl font-semibold mt-8">3. Install Skills</h2>
      <p className="text-text-secondary">
        Navigate to the Skills marketplace. Every skill with the &quot;Verified&quot; badge has
        passed our multi-stage security audit: code review, sandboxed execution testing, and
        dependency scanning. Click Install to add a skill to your agent.
      </p>

      <h2 className="text-2xl font-semibold mt-8">4. Configure Security</h2>
      <p className="text-text-secondary">
        Visit the Security Dashboard to see your overall score (out of 100) across 7 categories:
        gateway binding, credential storage, Docker isolation, skill verification, firewall rules,
        auto-patching, and audit logging. Set up alert rules to get notified of anomalies.
      </p>

      <h2 className="text-2xl font-semibold mt-8">5. Monitor &amp; Iterate</h2>
      <p className="text-text-secondary">
        OpenSyber continuously monitors your instance for security events. Use audit logs to review
        what skills accessed, set up policies to restrict file/network access, and track compliance
        against frameworks like SOC 2 and ISO 27001.
      </p>

      <div className="mt-8 rounded border border-info/30 bg-info/5 p-6">
        <h3 className="text-lg font-semibold text-signal">Need help?</h3>
        <p className="text-sm text-text-secondary mt-1">
          Check our <a href="/docs/faq" className="text-signal underline">FAQ</a> or email{' '}
          <code className="bg-surface px-1.5 py-0.5 rounded text-sm">support@opensyber.cloud</code>.
        </p>
      </div>
    </article>
  );
}
