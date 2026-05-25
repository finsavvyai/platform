/**
 * Threat Intelligence Seed Data
 *
 * Realistic IOC entries seeded into KV on first access.
 */
import type { ThreatEntry } from './threat-intel-types.js';

/** Generate seed entries with timestamps relative to now */
export function generateSeedEntries(): ThreatEntry[] {
  const now = Date.now();
  const hour = 3_600_000;
  const day = 24 * hour;

  return [
    // --- 3 Campaigns ---
    campaign('clinejection-npm-supply-chain', 'Clinejection: npm Supply Chain Attack',
      'Coordinated campaign injecting credential-harvesting code into popular npm packages via typosquatted names.',
      'critical', 'opensyber-research', now - 2 * hour,
      [ioc('package', 'lodash-utils-exec@2.1.4', 97), ioc('domain', 'npm-telemetry.click', 94), ioc('ip', '185.220.101.34', 88)],
      ['supply-chain', 'npm', 'credential-theft']),
    campaign('canisterworm-container-escape', 'CanisterWorm: Container Escape Campaign',
      'Exploitation of misconfigured container runtimes to escape sandboxes and access host-level secrets.',
      'critical', 'opensyber-research', now - 18 * hour,
      [ioc('cve', 'CVE-2026-21034', 95), ioc('ip', '45.155.205.89', 91), ioc('hash', 'a3f8b2c1d4e5f60718293a4b5c6d7e8f', 90)],
      ['container-escape', 'runtime', 'lateral-movement']),
    campaign('cursorjack-mcp-poisoning', 'CursorJack: MCP Server Poisoning',
      'Malicious MCP tool servers injecting prompt-override instructions to exfiltrate context from AI coding assistants.',
      'high', 'opensyber-research', now - 1 * day,
      [ioc('domain', 'mcp-tools-registry.dev', 92), ioc('url', 'https://mcp-tools-registry.dev/v1/list', 89)],
      ['mcp', 'prompt-injection', 'ai-agent']),

    // --- 5 IOC Entries ---
    iocEntry('mal-c2-infra-apr26', 'Malicious C2 Infrastructure — APT-AI-7',
      'Command-and-control servers linked to AI agent credential harvesting operations.',
      'high', 'circl', now - 3 * hour,
      [ioc('ip', '91.215.85.142', 96), ioc('ip', '193.42.33.18', 93), ioc('domain', 'agent-health-check.io', 91)]),
    iocEntry('typosquat-pypi-batch', 'PyPI Typosquat Cluster — ai-model-utils',
      'Five related PyPI packages impersonating popular AI/ML libraries with embedded reverse shells.',
      'high', 'community', now - 6 * hour,
      [ioc('package', 'ai-model-utils@0.9.2', 98), ioc('package', 'torch-utils-lite@1.0.0', 95)]),
    iocEntry('phishing-domain-wave', 'Phishing Domain Wave — OpenSyber Impersonation',
      'Newly registered domains mimicking opensyber.cloud to harvest developer OAuth tokens.',
      'medium', 'opensyber-research', now - 12 * hour,
      [ioc('domain', 'opensyber-cloud.com', 97), ioc('domain', 'open-syber.dev', 94)]),
    iocEntry('crypto-miner-hash', 'Cryptominer Payload — AgentJack Variant',
      'SHA-256 hash of cryptominer binary deployed via compromised AI agent skill packages.',
      'medium', 'nvd', now - 1.5 * day,
      [ioc('hash', 'e7d3f2a1b8c9d0e1f2a3b4c5d6e7f8091a2b3c4d', 99)]),
    iocEntry('exfil-dns-tunnel', 'DNS Tunneling Exfiltration — SkillDrop',
      'DNS-over-HTTPS exfiltration channel used by compromised agent skills to leak environment variables.',
      'high', 'opensyber-research', now - 2 * day,
      [ioc('domain', 'dns-relay.agent-telemetry.net', 93), ioc('ip', '104.21.44.132', 87)]),

    // --- 4 CVE Advisories ---
    advisory('cve-2026-21034', 'CVE-2026-21034 — Container Runtime Privilege Escalation',
      'A flaw in runc allows unprivileged containers to write to host /proc, enabling full sandbox escape.',
      'critical', 'nvd', now - 4 * hour, [ioc('cve', 'CVE-2026-21034', 99)]),
    advisory('cve-2026-18922', 'CVE-2026-18922 — AI Agent Tool Call Injection',
      'Improper input validation in agent tool-call dispatchers allows attackers to invoke arbitrary system commands.',
      'critical', 'nvd', now - 8 * hour, [ioc('cve', 'CVE-2026-18922', 98)]),
    advisory('cve-2026-15710', 'CVE-2026-15710 — Prompt Context Window Overflow',
      'Context window overflow in LLM gateway proxies leaks prior conversation context to subsequent requests.',
      'high', 'nvd', now - 1.5 * day, [ioc('cve', 'CVE-2026-15710', 96)]),
    advisory('cve-2026-12488', 'CVE-2026-12488 — Skill Manifest Signature Bypass',
      'Ed25519 signature check in skill installer can be bypassed via crafted SKILL.md header, allowing unsigned code execution.',
      'high', 'nvd', now - 3 * day, [ioc('cve', 'CVE-2026-12488', 94)]),

    // --- 3 Technique Advisories ---
    technique('prompt-injection-indirect', 'Indirect Prompt Injection via Tool Responses',
      'Adversarial instructions embedded in API responses consumed by AI agents override system prompts.',
      'high', 'opensyber-research', now - 5 * hour),
    technique('tool-call-manipulation', 'Tool-Call Argument Manipulation',
      'Attackers craft tool-call arguments that exploit shell injection in agent skill runtimes.',
      'high', 'opensyber-research', now - 1 * day),
    technique('credential-harvest-env', 'Environment Variable Credential Harvesting',
      'Compromised skills read process.env to exfiltrate API keys, database URLs, and auth secrets.',
      'medium', 'community', now - 2.5 * day),
  ];
}

function ioc(type: IOC['type'], value: string, confidence: number): IOC {
  return { type, value, confidence };
}

type IOC = { type: 'domain' | 'ip' | 'hash' | 'url' | 'package' | 'cve'; value: string; confidence: number };

function entry(id: string, type: ThreatEntry['type'], title: string, desc: string,
  severity: ThreatEntry['severity'], source: string, ts: number,
  indicators: IOC[], tags: string[], autoBlock: boolean): ThreatEntry {
  return {
    id, type, title, description: desc, severity, source, indicators, tags,
    publishedAt: new Date(ts).toISOString(), updatedAt: new Date(ts).toISOString(),
    autoBlockEnabled: autoBlock,
  };
}

function campaign(id: string, title: string, desc: string,
  severity: ThreatEntry['severity'], source: string, ts: number,
  indicators: IOC[], tags: string[]): ThreatEntry {
  return entry(id, 'campaign', title, desc, severity, source, ts, indicators, tags, true);
}

function iocEntry(id: string, title: string, desc: string,
  severity: ThreatEntry['severity'], source: string, ts: number,
  indicators: IOC[]): ThreatEntry {
  return entry(id, 'ioc', title, desc, severity, source, ts, indicators, [], true);
}

function advisory(id: string, title: string, desc: string,
  severity: ThreatEntry['severity'], source: string, ts: number,
  indicators: IOC[]): ThreatEntry {
  return entry(id, 'advisory', title, desc, severity, source, ts, indicators, ['cve'], false);
}

function technique(id: string, title: string, desc: string,
  severity: ThreatEntry['severity'], source: string, ts: number): ThreatEntry {
  return entry(id, 'technique', title, desc, severity, source, ts, [], ['ai-security'], false);
}
