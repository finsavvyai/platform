/**
 * OpenSyber MCP Tool Handlers
 *
 * Implements the business logic for each MCP tool.
 * Currently returns curated mock data; will connect to the OpenSyber API
 * once the MCP server is deployed alongside the platform.
 */

import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { getProtectConfigs, SUPPORTED_FRAMEWORKS } from './protect-configs.js';

/**
 * Result type returned by every handler. Mirrors the MCP SDK's
 * CallToolResult shape so setRequestHandler signatures line up
 * without extra casts when the SDK tightens its types.
 */
type ToolResult = CallToolResult;

/** @returns Safety assessment for an npm package */
export function handleScanDependency(args: Record<string, unknown>): ToolResult {
  const pkg = String(args.package ?? '');
  const version = args.version ? String(args.version) : 'latest';

  if (!pkg) {
    return text('Error: "package" parameter is required.');
  }

  const knownMalicious: Record<string, string> = {
    'event-stream': 'Compromised in v3.3.6 — malicious flatmap-stream dependency stole crypto wallets.',
    'ua-parser-js': 'Hijacked in Oct 2021 — crypto miner injected into v0.7.29, 0.8.0, 1.0.0.',
    'colors': 'Sabotaged by maintainer in v1.4.1 — infinite loop "LIBERTY LIBERTY LIBERTY".',
    'node-ipc': 'Protestware in v10.1.1+ — overwrites files on Russian/Belarusian IPs.',
  };

  if (knownMalicious[pkg]) {
    return text(
      `## ${pkg}@${version} -- MALICIOUS\n\n` +
      `**Status:** malicious\n` +
      `**Reason:** ${knownMalicious[pkg]}\n` +
      `**Recommendation:** Do NOT install. Use a verified alternative.`,
    );
  }

  const suspicious = ['faker', 'left-pad'];
  if (suspicious.includes(pkg)) {
    return text(
      `## ${pkg}@${version} -- SUSPICIOUS\n\n` +
      `**Status:** suspicious\n` +
      `**Reasons:**\n` +
      `- Maintainer has history of unpublishing / sabotage\n` +
      `- No active security policy\n` +
      `**Recommendation:** Pin exact version, monitor for changes.`,
    );
  }

  return text(
    `## ${pkg}@${version} -- SAFE\n\n` +
    `**Status:** safe\n` +
    `**Details:**\n` +
    `- No known CVEs for this version\n` +
    `- Active maintainers (last publish < 90 days)\n` +
    `- Trusted publisher on npm\n` +
    `- No install scripts detected`,
  );
}

/** @returns Security score breakdown for a project */
export function handleCheckSecurity(args: Record<string, unknown>): ToolResult {
  const projectPath = args.projectPath ? String(args.projectPath) : process.cwd();

  return text(
    `## Security Score: 74/100\n\n` +
    `**Project:** ${projectPath}\n\n` +
    `| Category | Score | Notes |\n` +
    `|----------|-------|-------|\n` +
    `| Dependencies | 8/10 | 2 outdated packages with known CVEs |\n` +
    `| Secrets | 10/10 | No hardcoded secrets detected |\n` +
    `| Authentication | 9/10 | JWT validation present, consider rotating keys |\n` +
    `| Input Validation | 7/10 | 3 endpoints missing Zod schemas |\n` +
    `| Encryption | 10/10 | TLS enforced, AES-256 at rest |\n` +
    `| Logging | 8/10 | Audit logs present, missing PII redaction |\n` +
    `| Access Control | 9/10 | RBAC enforced, 1 route missing permission check |\n` +
    `| Infrastructure | 13/20 | No rate limiting on /api/webhook, missing CSP header |\n\n` +
    `**Top Recommendations:**\n` +
    `1. Update \`jsonwebtoken\` to >=9.0.2 (CVE-2022-23529)\n` +
    `2. Add Zod validation to POST /api/agents/bulk\n` +
    `3. Add rate limiting to webhook endpoints\n` +
    `4. Add Content-Security-Policy header`,
  );
}

/** @returns Current AI agent threat intelligence */
export function handleQueryThreats(args: Record<string, unknown>): ToolResult {
  const severity = (args.severity as string) ?? 'high';
  const severities = ['critical', 'high', 'medium'];
  const cutoff = severities.indexOf(severity);

  // [severity, id, title, description, mitigation]
  const threats: Array<[string, string, string, string, string]> = [
    ['critical', 'OSYB-2026-0041', 'Prompt Injection via Tool Results',
      'Attackers embed hidden instructions in API responses consumed by AI agents.',
      'Sanitize all tool outputs, enforce output length limits, use OpenSyber content filtering.'],
    ['critical', 'OSYB-2026-0039', 'MCP Server Supply Chain Attack',
      'Malicious MCP servers on npm impersonating popular tools exfiltrate conversation context.',
      'Only install MCP servers from verified publishers. Use OpenSyber skill marketplace.'],
    ['high', 'OSYB-2026-0037', 'Agent Credential Leakage via Logs',
      'AI agents logging full HTTP headers including Authorization tokens to stdout.',
      'Use OpenSyber credential vault with automatic redaction. Never log bearer tokens.'],
    ['medium', 'OSYB-2026-0035', 'Excessive Tool Permission Scope',
      'Agents granted write access to filesystem and network when only read access needed.',
      'Apply principle of least privilege. Use OpenSyber RBAC to restrict agent tool access.'],
  ];

  const filtered = threats.filter((t) => severities.indexOf(t[0]) <= cutoff);

  const lines = filtered.map(
    ([sev, id, title, desc, fix]) =>
      `### [${sev.toUpperCase()}] ${id}: ${title}\n${desc}\n**Mitigation:** ${fix}`,
  );

  return text(
    `## AI Agent Threat Intelligence\n` +
    `**Filter:** ${severity}+ severity | **Date:** ${new Date().toISOString().split('T')[0]}\n\n` +
    (lines.length > 0 ? lines.join('\n\n') : 'No threats matching this severity level.'),
  );
}

/** @returns Available skills from the marketplace */
export function handleListSkills(args: Record<string, unknown>): ToolResult {
  const category = args.category ? String(args.category).toLowerCase() : undefined;

  // [name, category, description, installs, rating]
  const skills: Array<[string, string, string, number, number]> = [
    ['osquery-monitor', 'monitoring', 'Real-time OS-level threat detection via osquery', 1842, 4.8],
    ['dep-audit', 'scanning', 'Continuous dependency vulnerability scanning with CVE alerts', 3201, 4.9],
    ['secret-scanner', 'scanning', 'Detect hardcoded secrets and credentials in code', 2756, 4.7],
    ['soc2-checklist', 'compliance', 'Automated SOC 2 Type II compliance evidence collection', 891, 4.6],
    ['network-sentinel', 'networking', 'Monitor outbound connections, detect data exfiltration', 1203, 4.5],
    ['container-hardener', 'infrastructure', 'Auto-apply CIS benchmarks to Docker containers', 1567, 4.8],
    ['prompt-firewall', 'monitoring', 'Detect and block prompt injection attempts in real-time', 4102, 4.9],
    ['gdpr-export', 'compliance', 'Automated GDPR data subject access request fulfillment', 672, 4.4],
  ];

  const filtered = category ? skills.filter((s) => s[1] === category) : skills;

  if (filtered.length === 0) {
    const cats = 'monitoring, scanning, compliance, networking, infrastructure';
    return text(`No skills found for category "${category}". Available: ${cats}.`);
  }

  const rows = filtered.map(
    ([n, c, d, i, r]) => `| ${n} | ${c} | ${d} | ${i} | ${r}/5 |`,
  );

  return text(
    `## OpenSyber Skill Marketplace\n` +
    (category ? `**Category:** ${category}\n\n` : '\n') +
    `| Name | Category | Description | Installs | Rating |\n` +
    `|------|----------|-------------|----------|--------|\n` +
    rows.join('\n') +
    `\n\nInstall via: \`opensyber skill install <name>\``,
  );
}

/** @returns Security config snippet for the given framework */
export function handleProtect(args: Record<string, unknown>): ToolResult {
  const framework = String(args.framework ?? '');
  const configs = getProtectConfigs();

  if (!configs[framework]) {
    return text(
      `Error: Unsupported framework "${framework}". ` +
      `Supported: ${SUPPORTED_FRAMEWORKS.join(', ')}.`,
    );
  }

  return text(
    `## OpenSyber Security Config for ${framework}\n\n` +
    '```typescript\n' +
    configs[framework] +
    '\n```\n\n' +
    `**Included protections:**\n` +
    `- Content-Security-Policy and security headers\n` +
    `- CORS with explicit origin allowlist\n` +
    `- Rate limiting (100 req/min per IP)\n` +
    `- TokenForge device-bound session verification\n\n` +
    `Install dependencies: \`npm install @opensyber/tokenforge\``,
  );
}

/** Helper to wrap a string in the MCP text content format */
function text(message: string): ToolResult {
  return { content: [{ type: 'text', text: message }] };
}
