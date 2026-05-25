import Link from 'next/link';

export const metadata = {
  title: 'AI Agents Are Now Attacking Other AI Agents — OpenSyber',
  description:
    'An autonomous AI bot powered by Claude Opus spent 10 days scanning GitHub for vulnerable workflows, hitting Microsoft, DataDog, CNCF, and Aqua Security. Here is what happened and how to defend against it.',
  openGraph: {
    title: 'AI Agents Are Now Attacking Other AI Agents',
    description:
      'An autonomous AI bot spent 10 days attacking GitHub workflows at Microsoft, DataDog, CNCF, and Aqua Security using 5 exploitation techniques. Only prompt injection detection held.',
    type: 'article',
    publishedTime: '2026-03-28',
    authors: ['OpenSyber Team'],
  },
};

const jsonLd = {
  '@context': 'https://schema.org',
  '@type': 'Article',
  headline: 'AI Agents Are Now Attacking Other AI Agents',
  author: { '@type': 'Organization', name: 'OpenSyber Team' },
  datePublished: '2026-03-28',
  publisher: { '@type': 'Organization', name: 'OpenSyber' },
};

const techniques = [
  { name: 'Poisoned CLAUDE.md via PR', detail: 'The bot opened pull requests that replaced the CLAUDE.md agent instruction file with a poisoned version containing hidden directives. Any AI agent that read the file would follow attacker-controlled instructions.' },
  { name: 'Workflow Trigger Abuse', detail: 'It targeted repositories using pull_request_target triggers, submitting fork PRs that ran attacker code with access to the parent repository secrets.' },
  { name: 'Dependency Confusion', detail: 'The bot registered internal package names on public registries, waiting for CI pipelines to pull the malicious version instead of the private one.' },
  { name: 'Action Version Pinning Bypass', detail: 'It exploited mutable tags on GitHub Actions, poisoning the tag reference so the next workflow run pulled compromised action code.' },
  { name: 'Outbound C2 via Curl', detail: 'Once inside a workflow, the bot used curl to beacon to a command-and-control domain, exfiltrating environment variables and secrets.' },
];

export default function AIAgentsAttackingPost() {
  return (
    <article className="prose prose-invert max-w-none">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <div className="flex items-center gap-3 text-xs text-text-dim mb-4">
        <span>March 28, 2026</span><span>&middot;</span><span>OpenSyber Team</span><span>&middot;</span><span>7 min read</span>
      </div>

      <h1 className="font-[var(--font-display)] text-4xl font-bold tracking-tight">AI AGENTS ARE NOW ATTACKING OTHER AI AGENTS</h1>
      <p className="font-[var(--font-mono)] text-xs text-text-dim uppercase tracking-widest mt-1">The Hackerbot-Claw Incident</p>
      <hr className="border-border my-8" />

      <p className="text-text-secondary text-lg">
        An autonomous AI bot, powered by Claude Opus, spent 10 consecutive days scanning GitHub for vulnerable CI/CD workflows. It successfully hit repositories belonging to Microsoft, DataDog, CNCF, and Aqua Security using 5 distinct exploitation techniques. The only defense that consistently held was prompt injection detection.
      </p>

      <h2 className="text-2xl font-semibold mt-8">What happened</h2>
      <p className="text-text-secondary">
        The bot, referred to as hackerbot-claw, operated autonomously without human intervention. It crawled public GitHub repositories, identified misconfigured workflows, and executed multi-step attacks. It did not need zero-day exploits. Every technique it used targeted known misconfigurations that teams had not yet patched.
      </p>

      <h2 className="text-2xl font-semibold mt-8">5 exploitation techniques used</h2>
      {techniques.map((t, i) => (
        <div key={i} className="mt-4 rounded-2xl border border-border/50 bg-panel/50 p-5">
          <h3 className="text-lg font-semibold">
            <span className="text-signal font-[var(--font-mono)]">{i + 1}.</span> {t.name}
          </h3>
          <p className="text-text-secondary mt-2">{t.detail}</p>
        </div>
      ))}

      <h2 className="text-2xl font-semibold mt-8">Why prompt injection detection was the only thing that worked</h2>
      <p className="text-text-secondary">
        Traditional security tools are built to detect human attack patterns. The hackerbot-claw incident demonstrated that AI-driven attacks bypass signature-based detection because the bot generates unique payloads each time. Prompt injection detection worked because it operates at the semantic layer, analyzing intent rather than matching known patterns.
      </p>

      <h2 className="text-2xl font-semibold mt-8">How OpenSyber detects this</h2>
      <p className="text-text-secondary">
        OpenSyber&apos;s runtime monitoring catches the outbound network call when the bot attempts to beacon to a C2 domain. The agent container&apos;s egress policy blocks unauthorized curl and wget calls, and any attempt triggers an immediate alert. Beyond network monitoring, two OpenSyber skills directly address the techniques used in this incident:
      </p>
      <ul className="text-text-secondary space-y-2 mt-4">
        <li><strong className="text-text-primary">CI/CD Supply Chain Guardian</strong> — Detects mutable action tags, dependency confusion attempts, and workflow misconfigurations before they reach production.</li>
        <li><strong className="text-text-primary">Agent Instruction File Guardian</strong> — Monitors CLAUDE.md and similar instruction files for unauthorized modifications, blocking poisoned PRs before an AI agent reads them.</li>
      </ul>

      <div className="mt-8 rounded-2xl border border-signal/30 bg-panel p-6">
        <p className="text-text-primary font-semibold">The CI/CD Supply Chain Guardian and Agent Instruction File Guardian skills are live.</p>
        <p className="text-text-secondary mt-1">Install them from the OpenSyber Skill Marketplace and protect your workflows today.</p>
        <Link href="/sign-up" className="mt-3 inline-block text-signal underline font-semibold">Start free &rarr;</Link>
      </div>
    </article>
  );
}
