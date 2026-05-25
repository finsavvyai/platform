import Link from 'next/link';

export const metadata = {
  title: 'MCP Security Best Practices for Production Deployments — OpenSyber',
  description:
    'How to harden Model Context Protocol servers against prompt injection, tool poisoning, and data exfiltration in production AI agent deployments.',
  openGraph: {
    title: 'MCP Security Best Practices for Production Deployments',
    description:
      'How to harden Model Context Protocol servers against prompt injection and data exfiltration.',
    type: 'article',
    publishedTime: '2026-03-12',
    authors: ['OpenSyber Team'],
  },
};

const jsonLd = {
  '@context': 'https://schema.org',
  '@type': 'Article',
  headline: 'MCP Security Best Practices for Production Deployments',
  author: { '@type': 'Organization', name: 'OpenSyber Team' },
  datePublished: '2026-03-12',
  publisher: { '@type': 'Organization', name: 'OpenSyber' },
};

export default function McpSecurityPost() {
  return (
    <article className="prose prose-invert max-w-none">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <div className="flex items-center gap-3 text-xs text-text-dim mb-4">
        <span>March 12, 2026</span><span>&middot;</span><span>OpenSyber Team</span><span>&middot;</span><span>7 min read</span>
      </div>

      <h1 className="font-[var(--font-display)] text-4xl font-bold tracking-tight">MCP SECURITY BEST PRACTICES</h1>
      <p className="font-[var(--font-mono)] text-xs text-text-dim uppercase tracking-widest mt-1">Hardening Model Context Protocol for Production</p>
      <hr className="border-border my-8" />

      <p className="text-text-secondary text-lg">
        The Model Context Protocol (MCP) connects AI agents to external tools and data sources. In production,
        an improperly configured MCP server is a direct path to credential theft, data exfiltration, and
        supply chain compromise. This guide covers 7 best practices for securing MCP deployments.
      </p>

      <h2 className="text-2xl font-semibold mt-8">1. Validate all tool call parameters</h2>
      <p className="text-text-secondary">
        Every MCP tool should validate its input parameters with a strict schema (Zod, JSON Schema, or
        equivalent). Without validation, an attacker can inject arbitrary arguments through prompt injection,
        causing tools to read sensitive files, execute unintended commands, or connect to malicious endpoints.
        Define exact types, ranges, and allowed values for every parameter.
      </p>

      <h2 className="text-2xl font-semibold mt-8">2. Run MCP servers in isolated containers</h2>
      <p className="text-text-secondary">
        Never run MCP servers on the host machine. Each server should run in its own Docker container with
        a read-only root filesystem, no-new-privileges flag, and a seccomp profile that restricts system
        calls. OpenSyber provisions each MCP server in an isolated environment with deny-by-default
        network rules and resource limits (CPU, memory, disk).
      </p>

      <h2 className="text-2xl font-semibold mt-8">3. Monitor MCP config file integrity</h2>
      <p className="text-text-secondary">
        MCP configuration files (typically mcp.json or .cursor/mcp.json) define which servers an agent
        connects to. An attacker who modifies this file can redirect the agent to a rogue server that
        intercepts all tool calls. OpenSyber monitors MCP config files every 30 seconds and alerts
        immediately on any unauthorized modification.
      </p>

      <h2 className="text-2xl font-semibold mt-8">4. Restrict tool permissions to minimum scope</h2>
      <p className="text-text-secondary">
        Each MCP tool should declare exactly which resources it needs: specific file paths, specific
        network domains, and specific credential names. Tools should never have blanket filesystem or
        network access. OpenSyber enforces this through its permissions model where tools declare
        access requirements in their manifest and users approve them before installation.
      </p>

      <h2 className="text-2xl font-semibold mt-8">5. Authenticate server-to-server connections</h2>
      <p className="text-text-secondary">
        MCP servers that connect to external APIs should use short-lived tokens with automatic rotation,
        not long-lived API keys. Store credentials in an encrypted vault (not environment variables or
        config files) and inject them at runtime. OpenSyber&apos;s credential vault provides AES-256
        encryption at rest with 24-hour automatic rotation policies.
      </p>

      <h2 className="text-2xl font-semibold mt-8">6. Log every tool invocation</h2>
      <p className="text-text-secondary">
        Every MCP tool call should be logged with: timestamp, tool name, input parameters (redacting
        secrets), output summary, execution duration, and the identity of the requesting agent. These
        logs are essential for incident investigation and compliance. OpenSyber captures full audit
        trails with configurable retention from 7 days (Free) to 1 year (Enterprise).
      </p>

      <h2 className="text-2xl font-semibold mt-8">7. Guard against tool poisoning</h2>
      <p className="text-text-secondary">
        Tool poisoning occurs when a malicious MCP server returns crafted responses designed to
        manipulate the AI agent into executing harmful actions. Defenses include: validating tool
        outputs against expected schemas, limiting the actions an agent can take based on tool
        responses, and flagging unexpected patterns like base64-encoded data or URLs in tool outputs.
        OpenSyber&apos;s behavioral analysis monitors tool response patterns and alerts on anomalies.
      </p>

      <div className="mt-8 rounded-2xl border border-signal/30 bg-panel p-6">
        <p className="text-text-primary font-semibold">Secure your MCP servers with OpenSyber.</p>
        <p className="text-text-secondary mt-1">Runtime monitoring, config integrity checks, and audit logging out of the box.</p>
        <Link href="/sign-up" className="mt-3 inline-block text-signal underline font-semibold">Start free &rarr;</Link>
      </div>
    </article>
  );
}
