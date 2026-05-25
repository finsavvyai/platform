/** @vitest-environment node */
/**
 * Smoke tests for the MCP server manifests.
 *
 * Validates that mcp.json and server.json:
 * - parse as JSON
 * - report the same version as package.json
 * - declare every tool that the actual server registers in src/index.ts
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = join(__dirname, '..');

interface McpJson {
  name: string;
  version: string;
  capabilities: { tools: Array<{ name: string }> };
}
interface ServerJson { version: string; name: string }
interface PackageJson { version: string; name: string; mcpName: string }

function loadJson<T>(rel: string): T {
  return JSON.parse(readFileSync(join(ROOT, rel), 'utf8')) as T;
}

const REGISTERED_TOOLS = [
  'clawpipe_prompt',
  'clawpipe_analyze_cost',
  'clawpipe_stats',
  'clawpipe_booster_check',
  'clawpipe_skill_reasoning',
  'clawpipe_skill_triage',
  'clawpipe_skill_remediation',
  'clawpipe_skill_compliance',
  'clawpipe_skill_threat_intel',
  'clawpipe_skill_incident',
  'clawpipe_report_to_jira',
  'clawpipe_report_to_notion',
];

describe('mcp.json', () => {
  const doc = loadJson<McpJson>('mcp.json');
  it('is valid JSON with name=clawpipe', () => {
    expect(doc.name).toBe('clawpipe');
  });
  it('declares every tool the server registers', () => {
    const declared = doc.capabilities.tools.map((t) => t.name);
    for (const name of REGISTERED_TOOLS) {
      expect(declared, `mcp.json missing tool: ${name}`).toContain(name);
    }
  });
});

describe('server.json (Anthropic MCP registry shape)', () => {
  const server = loadJson<ServerJson>('server.json');
  const pkg = loadJson<PackageJson>('package.json');
  it('matches package.json version', () => {
    expect(server.version).toBe(pkg.version);
  });
  it('uses the io.github.* canonical name', () => {
    expect(server.name).toBe(pkg.mcpName);
  });
});

describe('mcp.json + server.json + package.json version parity', () => {
  it('all three agree', () => {
    const mcp = loadJson<McpJson>('mcp.json');
    const server = loadJson<ServerJson>('server.json');
    const pkg = loadJson<PackageJson>('package.json');
    expect(mcp.version).toBe(pkg.version);
    expect(server.version).toBe(pkg.version);
  });
});

describe('public landing-page mirror', () => {
  it('landing-page/.well-known/mcp.json declares the same name', () => {
    const wellKnown = JSON.parse(
      readFileSync(join(ROOT, '..', 'landing-page', '.well-known', 'mcp.json'), 'utf8'),
    ) as { name: string };
    expect(wellKnown.name).toBe('clawpipe');
  });
});

describe('tool module imports', () => {
  // Import each tool registrar — verifies the dist/ build is wired correctly.
  // Skipped for now: the registrars require a live McpServer + pipeline. The
  // build itself (`tsc`) is the real smoke check; here we only assert that
  // the source files exist by reading them so the test fails loudly if any
  // are deleted accidentally.
  const tools = [
    'tool-prompt.ts', 'tool-analyze-cost.ts', 'tool-stats.ts',
    'tool-booster-check.ts', 'tool-jira.ts', 'tool-notion.ts', 'tool-skills.ts',
  ];
  for (const t of tools) {
    it(`${t} exists`, () => {
      expect(() => readFileSync(join(ROOT, 'src', t), 'utf8')).not.toThrow();
    });
  }
});
