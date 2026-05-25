import Link from 'next/link';
import { ArrowRight, Rocket, ShieldCheck, Puzzle, Code } from 'lucide-react';

export default function DocsOverview() {
  return (
    <article className="prose prose-invert max-w-none">
      <h1 className="font-[family-name:var(--font-display)] text-4xl md:text-5xl tracking-wide">DOCUMENTATION</h1>
      <p className="text-lg text-text-secondary mt-2">
        Everything you need to deploy, secure, and extend your AI agents.
      </p>

      <hr className="border-border my-8" />

      <h2 className="font-[family-name:var(--font-display)] text-2xl tracking-wide">What is OpenSyber?</h2>
      <p className="text-text-primary">
        OpenSyber is the security platform for AI coding agents. It deploys agents on hardened,
        isolated containers with AES-256 encrypted credential vaults, monitors every file access
        and network call in real time, blocks malicious packages via a 4-stage audit pipeline,
        and generates compliance reports for SOC2, ISO 27001, and the EU AI Act. It supports
        Cursor, VS Code, Claude Code, Windsurf, and any MCP-compatible agent.
      </p>

      <h2 className="font-[family-name:var(--font-display)] text-2xl tracking-wide mt-8">Quickstart</h2>
      <ol className="space-y-3 text-text-secondary">
        <li><strong className="text-white">Sign up</strong> — Create a free account at opensyber.cloud</li>
        <li><strong className="text-white">Deploy an agent</strong> — Launch a hardened AI agent instance in one click</li>
        <li><strong className="text-white">Install skills</strong> — Browse the verified marketplace and install skills</li>
        <li><strong className="text-white">Monitor security</strong> — View your security score, alerts, and audit trail</li>
      </ol>

      <h2 className="font-[family-name:var(--font-display)] text-2xl tracking-wide mt-8">Explore the Docs</h2>
      <div className="not-prose grid gap-4 sm:grid-cols-2 mt-4">
        {[
          { href: '/docs/getting-started', label: 'Getting Started', description: 'Step-by-step setup guide', icon: Rocket },
          { href: '/docs/security', label: 'Security Features', description: 'Scores, policies, alerts, compliance', icon: ShieldCheck },
          { href: '/docs/skills', label: 'Skills Development', description: 'Build and publish skills', icon: Puzzle },
          { href: '/docs/api', label: 'API Reference', description: 'All endpoints with examples', icon: Code },
        ].map((item) => {
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className="group rounded border border-border bg-panel/30 p-5 hover:border-wire transition"
            >
              <Icon className="h-6 w-6 text-signal mb-3" />
              <h3 className="text-base font-semibold text-white">{item.label}</h3>
              <p className="text-sm text-text-secondary mt-1">{item.description}</p>
              <span className="mt-3 inline-flex items-center gap-1 text-xs text-signal group-hover:text-signal-hover">
                Read more <ArrowRight className="h-3 w-3" />
              </span>
            </Link>
          );
        })}
      </div>
    </article>
  );
}
