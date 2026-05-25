import Link from 'next/link';

export const metadata = {
  title: 'Introducing OpenSyber: Secure AI Agent Hosting — OpenSyber',
  description:
    'Why we built OpenSyber — a managed platform for deploying, monitoring, and securing AI coding agents with runtime isolation, encrypted credentials, and a verified skill marketplace.',
  openGraph: {
    title: 'Introducing OpenSyber: Secure AI Agent Hosting',
    description:
      'Why we built OpenSyber — a managed platform for deploying, monitoring, and securing AI coding agents with runtime isolation, encrypted credentials, and a verified skill marketplace.',
    type: 'article',
    publishedTime: '2026-01-15',
    authors: ['OpenSyber Team'],
  },
};

export default function IntroducingOpenSyberPost() {
  return (
    <article className="prose prose-invert max-w-none">
      <div className="flex items-center gap-3 text-xs text-text-dim mb-4">
        <span>January 15, 2026</span>
        <span>&middot;</span>
        <span>OpenSyber Team</span>
        <span>&middot;</span>
        <span>4 min read</span>
      </div>

      <h1 className="text-4xl font-bold tracking-tight">
        Introducing OpenSyber: Secure AI Agent Hosting
      </h1>

      <hr className="border-border my-8" />

      <p className="text-text-secondary text-lg">
        AI coding agents are transforming how developers work. But with great power comes great
        responsibility — and most agents run with zero security guardrails.
      </p>

      <h2 className="text-2xl font-semibold mt-8">The Problem</h2>
      <p className="text-text-secondary">
        Self-hosted AI agents typically bind to 0.0.0.0 (publicly accessible), store credentials
        in plaintext, run without container isolation, and have no audit trail. Skills from
        community marketplaces are unvetted and can exfiltrate data, modify files, or open
        backdoors.
      </p>

      <h2 className="text-2xl font-semibold mt-8">Our Solution</h2>
      <p className="text-text-secondary">
        OpenSyber provides three things in one platform: secure hosted infrastructure, a verified
        skill marketplace, and real-time security monitoring. Every instance runs on a hardened VM
        with Docker isolation, encrypted credential storage, deny-by-default firewall, and
        automatic security patching.
      </p>

      <h2 className="text-2xl font-semibold mt-8">Key Features</h2>
      <ul className="space-y-2 text-text-secondary">
        <li><strong className="text-white">One-click deployment</strong> — Launch a hardened agent instance in under 60 seconds</li>
        <li><strong className="text-white">Verified skill marketplace</strong> — Every skill passes code review and sandboxed testing</li>
        <li><strong className="text-white">Security score</strong> — Real-time scoring across 7 security categories</li>
        <li><strong className="text-white">Audit logging</strong> — Full trail of every command, file access, and network connection</li>
        <li><strong className="text-white">Compliance tracking</strong> — SOC 2, ISO 27001, and NIST CSF dashboards</li>
      </ul>

      <h2 className="text-2xl font-semibold mt-8">Get Started</h2>
      <p className="text-text-secondary">
        OpenSyber is available today with a free plan that includes one agent instance, three
        verified skills, and a basic security dashboard.{' '}
        <Link href="/sign-up" className="text-signal underline">
          Create your free account
        </Link>{' '}
        and deploy your first secure agent in minutes.
      </p>
    </article>
  );
}
