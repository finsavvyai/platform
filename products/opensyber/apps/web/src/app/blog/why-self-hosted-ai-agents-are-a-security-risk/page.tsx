import Link from 'next/link';

export const metadata = {
  title: 'Why Self-Hosted AI Agents Are a Security Risk — OpenSyber',
  description:
    'The hidden dangers of running unmanaged AI coding agents — public gateway binding, plaintext credentials, unvetted skills, no isolation, and no audit trail. Learn how to fix them.',
  openGraph: {
    title: 'Why Self-Hosted AI Agents Are a Security Risk',
    description:
      'The hidden dangers of running unmanaged AI coding agents — public gateway binding, plaintext credentials, unvetted skills, no isolation, and no audit trail.',
    type: 'article',
    publishedTime: '2026-02-01',
    authors: ['OpenSyber Team'],
  },
};

export default function SecurityRiskPost() {
  return (
    <article className="prose prose-invert max-w-none">
      <div className="flex items-center gap-3 text-xs text-text-dim mb-4">
        <span>February 1, 2026</span>
        <span>&middot;</span>
        <span>OpenSyber Team</span>
        <span>&middot;</span>
        <span>6 min read</span>
      </div>

      <h1 className="text-4xl font-bold tracking-tight">
        Why Self-Hosted AI Agents Are a Security Risk
      </h1>

      <hr className="border-border my-8" />

      <p className="text-text-secondary text-lg">
        Developers love AI coding agents for their productivity gains. But the default setup of most
        self-hosted agents is a security nightmare. Here are the top risks — and how to mitigate them.
      </p>

      <h2 className="text-2xl font-semibold mt-8">1. Public Gateway Binding</h2>
      <p className="text-text-secondary">
        Most AI agents bind their HTTP gateway to 0.0.0.0 by default, making it accessible from any
        network interface. This means anyone who can reach your server can interact with your agent.
        OpenSyber binds to loopback (127.0.0.1) and uses a reverse proxy with authentication.
      </p>

      <h2 className="text-2xl font-semibold mt-8">2. Plaintext Credentials</h2>
      <p className="text-text-secondary">
        API keys, tokens, and passwords are commonly stored in .env files or plain config files.
        Anyone with read access to the filesystem — including malicious skills — can exfiltrate them.
        OpenSyber encrypts all credentials with AES-256 and provides a vault API for skill access.
      </p>

      <h2 className="text-2xl font-semibold mt-8">3. Unvetted Skills</h2>
      <p className="text-text-secondary">
        Community skill marketplaces have no security review process. A skill can contain obfuscated
        code that reads your SSH keys, opens reverse shells, or modifies your source code. OpenSyber
        verifies every skill through automated scanning, sandboxed execution, and manual code review.
      </p>

      <h2 className="text-2xl font-semibold mt-8">4. No Container Isolation</h2>
      <p className="text-text-secondary">
        Running an AI agent directly on your development machine gives it full access to your
        filesystem, network, and processes. Docker isolation with read-only root filesystems,
        resource limits, and namespace separation significantly reduces the blast radius.
      </p>

      <h2 className="text-2xl font-semibold mt-8">5. No Audit Trail</h2>
      <p className="text-text-secondary">
        Without logging, you have no way to know what your agent did, what files it accessed, or what
        network connections it made. OpenSyber logs every command, file access, and network connection
        with configurable retention (3 days to 1 year depending on plan).
      </p>

      <h2 className="text-2xl font-semibold mt-8">6. No Auto-Patching</h2>
      <p className="text-text-secondary">
        Self-hosted agents run on whatever version you installed. When CVEs are disclosed, you have to
        manually update. OpenSyber applies critical patches within hours and non-critical patches
        within 24 hours, automatically.
      </p>

      <h2 className="text-2xl font-semibold mt-8">What You Can Do</h2>
      <p className="text-text-secondary">
        If you must self-host, follow these minimum security practices: bind to localhost only,
        encrypt credentials, use Docker with read-only root, enable logging, and review skills
        before installing. Or let{' '}
        <Link href="/sign-up" className="text-signal underline">
          OpenSyber handle it for you
        </Link>
        — free forever on our starter plan.
      </p>
    </article>
  );
}
