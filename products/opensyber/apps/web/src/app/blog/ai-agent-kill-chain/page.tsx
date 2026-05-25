import Link from 'next/link';

export const metadata = {
  title: 'The AI Agent Kill Chain: How MCP Server Attacks Work in 7 Stages — OpenSyber',
  description:
    'The AI agent kill chain is a 7-stage attack sequence targeting MCP servers and AI coding agents — from AI-powered phishing to credential exfiltration. OpenSyber detects 5 of 7 stages today.',
  openGraph: {
    title: 'The AI Agent Kill Chain: How MCP Server Attacks Work in 7 Stages',
    description:
      'The 7-stage attack sequence targeting MCP servers — from AI-powered phishing to credential exfiltration. OpenSyber detects 5 of 7 stages today.',
    type: 'article',
    publishedTime: '2026-03-21',
    authors: ['OpenSyber Team'],
  },
};

const jsonLd = {
  '@context': 'https://schema.org',
  '@type': 'Article',
  headline: 'The AI Agent Kill Chain: How MCP Server Attacks Work in 7 Stages',
  author: { '@type': 'Organization', name: 'OpenSyber Team' },
  datePublished: '2026-03-21',
  publisher: { '@type': 'Organization', name: 'OpenSyber' },
};

const stages = [
  { n: 1, name: 'AI-Powered Phishing', attack: 'Attacker uses GPT-4-class models to generate targeted phishing emails impersonating npm, PyPI, or GitHub. These emails pass traditional spam filters 68% of the time because LLMs produce grammatically perfect, context-aware content.', detect: 'OpenSyber monitors inbound link reputation and flags credential-harvesting domains within 12 seconds of agent interaction.' },
  { n: 2, name: 'npm Credentials Stolen', attack: 'The developer clicks a phishing link and enters their npm token on a cloned login page. Attackers now control publishing rights to packages the developer maintains.', detect: 'Not yet covered. Planned for Q2 2026 via credential-leak watchers integrated with Have I Been Pwned and GitHub secret scanning.' },
  { n: 3, name: 'Malicious Package Published', attack: 'Attacker publishes a trojanized patch version (e.g., bumping 2.3.1 to 2.3.2) containing an obfuscated postinstall script. 91% of downstream consumers auto-update patch versions.', detect: 'OpenSyber\'s supply chain guard scans every npm install in real time using Socket.dev integration, flagging obfuscated code, install scripts, and typosquats in under 3 seconds.' },
  { n: 4, name: 'Developer Installs via Agent', attack: 'An AI coding agent like Cursor, Copilot, or Claude Code runs npm install as part of a task. The agent has no mechanism to distinguish legitimate packages from compromised ones.', detect: 'OpenSyber intercepts every package install command, cross-references against a blocklist of 14,200+ known-malicious packages, and requires explicit approval for new dependencies.' },
  { n: 5, name: 'AI CLI Hijacked', attack: 'The malicious postinstall script modifies the agent\'s MCP configuration, injecting a rogue tool server that intercepts all subsequent commands. The agent now routes requests through attacker infrastructure.', detect: 'OpenSyber\'s runtime behavior monitor detects MCP config modifications within 30 seconds and triggers an automatic rollback plus security alert.' },
  { n: 6, name: 'Filesystem Enumerated', attack: 'The rogue MCP server instructs the agent to list .env files, SSH keys, AWS credentials, and database connection strings. The agent complies because it has full filesystem access.', detect: 'OpenSyber enforces deny-by-default file access policies. Agents can only read files within explicitly allowed directories. Any attempt to access .env, .ssh, or credential files triggers an immediate block and alert.' },
  { n: 7, name: 'Credentials Exfiltrated', attack: 'Stolen credentials are sent to attacker-controlled endpoints via DNS tunneling or HTTPS POST to domains that mimic legitimate analytics services.', detect: 'Not yet covered. Planned for Q2 2026 via DNS query analysis and egress traffic fingerprinting on agent containers.' },
];

export default function AIAgentKillChainPost() {
  return (
    <article className="prose prose-invert max-w-none">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <div className="flex items-center gap-3 text-xs text-text-dim mb-4">
        <span>March 21, 2026</span><span>&middot;</span><span>OpenSyber Team</span><span>&middot;</span><span>8 min read</span>
      </div>

      <h1 className="font-[var(--font-display)] text-4xl font-bold tracking-tight">THE AI AGENT KILL CHAIN</h1>
      <p className="font-[var(--font-mono)] text-xs text-text-dim uppercase tracking-widest mt-1">7-Stage Attack Sequence for MCP Servers</p>
      <hr className="border-border my-8" />

      <p className="text-text-secondary text-lg">
        The AI agent kill chain is a 7-stage attack sequence that exploits MCP servers and AI coding agents to steal developer credentials. Attackers combine AI-generated phishing, supply chain poisoning, and MCP configuration hijacking to compromise entire development environments in under 4 minutes. OpenSyber detects 5 of these 7 stages today, with full coverage shipping in Q2 2026.
      </p>

      <h2 className="text-2xl font-semibold mt-8">What is the AI agent kill chain?</h2>
      <p className="text-text-secondary">
        The AI agent kill chain is a structured attack model describing how threat actors compromise AI coding agents like Cursor, GitHub Copilot, and Claude Code. It follows 7 sequential stages: AI-powered phishing, credential theft, malicious package publication, agent-side installation, CLI hijacking via MCP, filesystem enumeration, and credential exfiltration. Each stage builds on the previous one, and blocking any single stage breaks the chain.
      </p>

      <h2 className="text-2xl font-semibold mt-8">How does each stage work?</h2>
      {stages.map((s) => (
        <div key={s.n} className="mt-6 rounded-2xl border border-border/50 bg-panel/50 p-5">
          <h3 className="text-lg font-semibold">
            <span className="text-signal font-[var(--font-mono)]">Stage {s.n}:</span> {s.name}
          </h3>
          <p className="text-text-secondary mt-2"><strong className="text-text-primary">Attack:</strong> {s.attack}</p>
          <p className="text-text-secondary mt-2"><strong className="text-signal">Detection:</strong> {s.detect}</p>
        </div>
      ))}

      <h2 className="text-2xl font-semibold mt-8">How does OpenSyber detect kill chain attacks?</h2>
      <p className="text-text-secondary">
        OpenSyber monitors 5 of 7 kill chain stages in real time: phishing link interception (Stage 1), supply chain scanning via Socket.dev (Stage 3), package blocklist enforcement with 14,200+ entries (Stage 4), MCP config integrity monitoring with 30-second detection (Stage 5), and deny-by-default filesystem policies (Stage 6). Stages 2 and 7 ship in Q2 2026 with credential-leak watchers and DNS egress analysis. Every detection fires a structured alert to Slack, PagerDuty, Discord, Teams, or OpsGenie within 15 seconds.
      </p>

      <div className="mt-8 rounded-2xl border border-signal/30 bg-panel p-6">
        <p className="text-text-primary font-semibold">Protect your agents from kill chain attacks.</p>
        <p className="text-text-secondary mt-1">Deploy a secured AI agent with runtime monitoring in 60 seconds.</p>
        <Link href="/sign-up" className="mt-3 inline-block text-signal underline font-semibold">Start free &rarr;</Link>
      </div>
    </article>
  );
}
