import Link from 'next/link';

export const metadata = {
  title: 'Gartner Named Our Category: Guardian Agents — OpenSyber',
  description:
    'Gartner published its first Market Guide for Guardian Agents in February 2026. OpenSyber is a pure-play Guardian Agent provider. Here is what the category means and how we differentiate.',
  openGraph: {
    title: 'Gartner Named Our Category: Guardian Agents',
    description:
      'The first-ever Gartner Market Guide for Guardian Agents validates the category. OpenSyber is a pure-play provider with full agent security coverage.',
    type: 'article',
    publishedTime: '2026-03-28',
    authors: ['OpenSyber Team'],
  },
};

const jsonLd = {
  '@context': 'https://schema.org',
  '@type': 'Article',
  headline: 'Gartner Named Our Category: Guardian Agents',
  author: { '@type': 'Organization', name: 'OpenSyber Team' },
  datePublished: '2026-03-28',
  publisher: { '@type': 'Organization', name: 'OpenSyber' },
};

const capabilities = [
  { name: 'Runtime Behavior Monitoring', detail: 'Observing what AI agents actually do at runtime — file access, network calls, process execution — and flagging anomalies against a baseline.' },
  { name: 'Supply Chain Verification', detail: 'Validating every dependency, action, and tool an agent uses before it runs, ensuring nothing has been tampered with.' },
  { name: 'Instruction File Integrity', detail: 'Protecting agent instruction files (CLAUDE.md, .cursorrules, etc.) from poisoning attacks that hijack agent behavior.' },
  { name: 'Egress Control', detail: 'Enforcing deny-by-default outbound network policies so compromised agents cannot exfiltrate data to attacker-controlled endpoints.' },
  { name: 'Audit and Compliance', detail: 'Logging every agent action with tamper-evident records for compliance frameworks and incident response.' },
];

const comparisons = [
  { vendor: 'Chainguard', focus: 'Secures what you run (container images, base OS)', gap: 'Does not monitor what the agent does at runtime. No behavioral analysis or instruction file protection.' },
  { vendor: 'StepSecurity', focus: 'Secures GitHub Actions workflows (Harden-Runner)', gap: 'Workflow-only scope. No coverage for agent containers, MCP servers, skill execution, or marketplace security.' },
  { vendor: 'OpenSyber', focus: 'Full agent security lifecycle — from deploy to runtime to audit', gap: 'Pure-play Guardian Agent provider covering supply chain, runtime, egress, instruction integrity, and compliance.' },
];

export default function GartnerGuardianAgentsPost() {
  return (
    <article className="prose prose-invert max-w-none">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <div className="flex items-center gap-3 text-xs text-text-dim mb-4">
        <span>March 28, 2026</span><span>&middot;</span><span>OpenSyber Team</span><span>&middot;</span><span>7 min read</span>
      </div>

      <h1 className="font-[var(--font-display)] text-4xl font-bold tracking-tight">GARTNER NAMED OUR CATEGORY: GUARDIAN AGENTS</h1>
      <p className="font-[var(--font-mono)] text-xs text-text-dim uppercase tracking-widest mt-1">First-Ever Market Guide for AI Agent Security</p>
      <hr className="border-border my-8" />

      <p className="text-text-secondary text-lg">
        In February 2026, Gartner published its first-ever Market Guide for Guardian Agents. This is the formal recognition of a new security category: autonomous agents whose sole purpose is to protect other AI agents. OpenSyber is a pure-play Guardian Agent provider.
      </p>

      <h2 className="text-2xl font-semibold mt-8">What are Guardian Agents?</h2>
      <p className="text-text-secondary">
        Guardian Agents are security-focused AI agents that monitor, protect, and audit other AI agents in production. They operate alongside the agents they protect, observing runtime behavior, verifying supply chains, and enforcing security policies. The Gartner Market Guide identifies five core capabilities that define the category:
      </p>

      {capabilities.map((cap, i) => (
        <div key={i} className="mt-4 rounded-2xl border border-border/50 bg-panel/50 p-5">
          <h3 className="text-lg font-semibold">
            <span className="text-signal font-[var(--font-mono)]">{i + 1}.</span> {cap.name}
          </h3>
          <p className="text-text-secondary mt-2">{cap.detail}</p>
        </div>
      ))}

      <h2 className="text-2xl font-semibold mt-8">How OpenSyber compares</h2>
      <div className="mt-4 overflow-x-auto">
        <table className="w-full text-sm text-left">
          <thead>
            <tr className="border-b border-border">
              <th className="py-3 pr-4 text-text-primary font-semibold">Vendor</th>
              <th className="py-3 pr-4 text-text-primary font-semibold">Focus</th>
              <th className="py-3 text-text-primary font-semibold">Scope</th>
            </tr>
          </thead>
          <tbody>
            {comparisons.map((row, i) => (
              <tr key={i} className="border-b border-border/50">
                <td className="py-3 pr-4 text-signal font-semibold">{row.vendor}</td>
                <td className="py-3 pr-4 text-text-secondary">{row.focus}</td>
                <td className="py-3 text-text-secondary">{row.gap}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <h2 className="text-2xl font-semibold mt-8">Why this matters</h2>
      <p className="text-text-secondary">
        When Gartner names a category, enterprise buyers start budgeting for it. Guardian Agents are no longer a niche concern — they are a recognized market segment with defined capabilities and vendor evaluation criteria. For teams already running AI agents in production, this is the signal to formalize agent security as a distinct function, not an afterthought bolted onto existing DevSecOps tooling.
      </p>

      <div className="mt-8 rounded-2xl border border-signal/30 bg-panel p-6">
        <p className="text-text-primary font-semibold">OpenSyber is a pure-play Guardian Agent provider.</p>
        <p className="text-text-secondary mt-1">Deploy a secured AI agent with runtime monitoring, supply chain verification, and compliance in 60 seconds.</p>
        <Link href="/sign-up" className="mt-3 inline-block text-signal underline font-semibold">Start free &rarr;</Link>
      </div>
    </article>
  );
}
