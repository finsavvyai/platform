import Link from 'next/link';

export const metadata = {
  title: 'Supply Chain Attacks Targeting AI Agents in 2026 — OpenSyber',
  description:
    'From UNC6426 to CursorJack — how threat actors are exploiting the AI agent ecosystem through malicious packages, MCP hijacking, and IDE extension compromise.',
  openGraph: {
    title: 'Supply Chain Attacks Targeting AI Agents in 2026',
    description:
      'From UNC6426 to CursorJack — how threat actors are exploiting the AI agent ecosystem.',
    type: 'article',
    publishedTime: '2026-03-05',
    authors: ['OpenSyber Research'],
  },
};

const jsonLd = {
  '@context': 'https://schema.org',
  '@type': 'Article',
  headline: 'Supply Chain Attacks Targeting AI Agents in 2026',
  author: { '@type': 'Organization', name: 'OpenSyber Research' },
  datePublished: '2026-03-05',
  publisher: { '@type': 'Organization', name: 'OpenSyber' },
};

const attacks = [
  {
    name: 'UNC6426 — npm Supply Chain Campaign',
    date: 'January 2026',
    desc: 'A threat group tracked as UNC6426 published 12 trojanized npm packages mimicking popular AI utility libraries. The packages contained obfuscated postinstall scripts that exfiltrated environment variables, SSH keys, and cloud credentials to attacker-controlled endpoints. Over 34,000 downloads before detection.',
    impact: 'Credential theft from developer machines running AI coding agents that auto-installed suggested dependencies.',
  },
  {
    name: 'CursorJack — IDE Extension Hijack',
    date: 'February 2026',
    desc: 'Attackers published a malicious VS Code extension mimicking a popular Cursor companion tool. The extension modified MCP configuration files to redirect tool calls through a proxy server, intercepting all agent-to-tool communication including file contents and API responses.',
    impact: 'Source code and API key exfiltration from developers using Cursor with the compromised extension.',
  },
  {
    name: 'PyPI Model Loader Backdoor',
    date: 'February 2026',
    desc: 'A series of PyPI packages with names like ai-model-loader and llm-utils-fast contained backdoored model loading code that executed arbitrary Python during import. AI agents that installed these packages during automated dependency resolution unknowingly ran attacker code with full system access.',
    impact: 'Remote code execution on machines running Python-based AI agents with unrestricted pip install permissions.',
  },
  {
    name: 'MCP Config Injection via Prompt',
    date: 'March 2026',
    desc: 'Researchers demonstrated that prompt injection in repository README files could instruct AI coding agents to modify their own MCP configuration, adding rogue tool servers. The agent would then route subsequent tool calls through attacker infrastructure without user awareness.',
    impact: 'Silent interception of all tool calls, enabling data exfiltration and response manipulation.',
  },
];

export default function SupplyChainPost() {
  return (
    <article className="prose prose-invert max-w-none">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <div className="flex items-center gap-3 text-xs text-text-dim mb-4">
        <span>March 5, 2026</span><span>&middot;</span><span>OpenSyber Research</span><span>&middot;</span><span>8 min read</span>
      </div>

      <h1 className="font-[var(--font-display)] text-4xl font-bold tracking-tight">SUPPLY CHAIN ATTACKS TARGETING AI AGENTS</h1>
      <p className="font-[var(--font-mono)] text-xs text-text-dim uppercase tracking-widest mt-1">2026 Threat Landscape</p>
      <hr className="border-border my-8" />

      <p className="text-text-secondary text-lg">
        Supply chain attacks targeting AI agents increased 340% in Q1 2026 compared to Q1 2025. Threat
        actors are exploiting the unique vulnerabilities of AI coding agents: automatic dependency
        installation, unrestricted filesystem access, and MCP configuration files that can be modified
        programmatically. This report covers the 4 most significant attack campaigns observed so far.
      </p>

      <h2 className="text-2xl font-semibold mt-8">Notable attack campaigns</h2>
      {attacks.map((a) => (
        <div key={a.name} className="mt-6 rounded-2xl border border-border/50 bg-panel/50 p-5">
          <h3 className="text-lg font-semibold text-text-primary">{a.name}</h3>
          <p className="text-xs text-text-dim mt-1">{a.date}</p>
          <p className="text-text-secondary mt-3">{a.desc}</p>
          <p className="text-text-secondary mt-2"><strong className="text-signal">Impact:</strong> {a.impact}</p>
        </div>
      ))}

      <h2 className="text-2xl font-semibold mt-8">Why AI agents are uniquely vulnerable</h2>
      <p className="text-text-secondary">
        Traditional supply chain attacks target build pipelines and CI/CD systems. AI agent supply
        chain attacks are different because: agents install dependencies autonomously during coding
        sessions without human review, agents have real-time filesystem and network access (not just
        build-time access), and MCP configuration files create a new attack surface that did not
        exist in traditional development workflows.
      </p>

      <h2 className="text-2xl font-semibold mt-8">How OpenSyber defends against supply chain attacks</h2>
      <p className="text-text-secondary">
        OpenSyber provides 3 layers of supply chain defense. First, real-time package scanning via
        Socket.dev integration intercepts every npm and pip install, flagging packages with install
        scripts, obfuscated code, or ages under 30 days. Second, a blocklist of 14,200+ known-malicious
        packages is checked before any install executes, with new entries added within 4 hours. Third,
        MCP config integrity monitoring detects unauthorized modifications within 30 seconds and triggers
        automatic rollback with a security alert.
      </p>

      <div className="mt-8 rounded-2xl border border-signal/30 bg-panel p-6">
        <p className="text-text-primary font-semibold">Protect your agents from supply chain attacks.</p>
        <p className="text-text-secondary mt-1">Real-time package scanning, blocklist enforcement, and MCP integrity monitoring.</p>
        <Link href="/sign-up" className="mt-3 inline-block text-signal underline font-semibold">Start free &rarr;</Link>
      </div>
    </article>
  );
}
