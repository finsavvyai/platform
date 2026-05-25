import { describe, it, expect } from 'vitest';
import {
  FALCO_RULES,
  getFalcoRule,
  rulesBySeverity,
  isValidMitreTechnique,
  type FalcoRule,
  type FalcoSeverity,
} from './falco-rules.js';

describe('FALCO_RULES catalog', () => {
  it('contains the documented upstream rules verbatim', () => {
    const names = FALCO_RULES.map((r) => r.name);
    // Verbatim names from https://github.com/falcosecurity/rules
    expect(names).toContain('Terminal shell in container');
    expect(names).toContain('Write below etc');
    expect(names).toContain('Read sensitive file untrusted');
    expect(names).toContain('Container drift detected (open+create)');
    expect(names).toContain('Launch Privileged Container');
    expect(names).toContain('Disallowed SSH Connection');
    expect(names).toContain('Modify binary dirs');
    expect(names).toContain('Schedule Cron Jobs');
  });

  it('every rule maps to a syntactically-valid MITRE technique', () => {
    for (const r of FALCO_RULES) {
      expect(isValidMitreTechnique(r.mitreTechnique)).toBe(true);
    }
  });

  it('covers the required ATT&CK techniques (T1059, T1055/T1546, T1611)', () => {
    const techniques = new Set(FALCO_RULES.map((r) => r.mitreTechnique));
    // T1059 — Command and Scripting Interpreter
    expect(techniques.has('T1059')).toBe(true);
    // T1546 — Event Triggered Execution
    expect(techniques.has('T1546')).toBe(true);
    // T1611 — Escape to Host
    expect(techniques.has('T1611')).toBe(true);
  });

  it('every rule declares its upstream source file', () => {
    const allowed = new Set(['falco_rules.yaml', 'application_rules.yaml']);
    for (const r of FALCO_RULES) {
      expect(allowed.has(r.source)).toBe(true);
    }
  });

  it('rule names are unique within the catalog', () => {
    const names = FALCO_RULES.map((r) => r.name);
    expect(new Set(names).size).toBe(names.length);
  });
});

describe('getFalcoRule', () => {
  it('finds a rule by exact upstream name', () => {
    const rule = getFalcoRule('Terminal shell in container');
    expect(rule).toBeDefined();
    expect(rule?.mitreTechnique).toBe('T1059');
  });

  it('returns undefined for unknown names', () => {
    expect(getFalcoRule('not a real rule')).toBeUndefined();
  });

  it('is case-sensitive (matches Falco rule_filter behaviour)', () => {
    expect(getFalcoRule('terminal shell in container')).toBeUndefined();
  });
});

describe('rulesBySeverity', () => {
  it('returns CRITICAL+ERROR rules when min=ERROR', () => {
    const rules = rulesBySeverity('ERROR');
    const severities: FalcoSeverity[] = rules.map((r: FalcoRule) => r.severity);
    for (const s of severities) {
      expect(['CRITICAL', 'ERROR']).toContain(s);
    }
  });

  it('returns ALL rules when min=DEBUG', () => {
    const all = rulesBySeverity('DEBUG');
    expect(all.length).toBe(FALCO_RULES.length);
  });

  it('returns no rules when severity below the lowest in catalog', () => {
    // No CRITICAL rule in catalog; min=CRITICAL should return 0.
    const rules = rulesBySeverity('CRITICAL');
    expect(rules.length).toBe(0);
  });

  it('every WARNING+ rule is also returned by NOTICE', () => {
    const warningPlus = new Set(rulesBySeverity('WARNING').map((r) => r.name));
    const noticePlus = new Set(rulesBySeverity('NOTICE').map((r) => r.name));
    for (const n of warningPlus) expect(noticePlus.has(n)).toBe(true);
  });
});

describe('isValidMitreTechnique', () => {
  it('accepts top-level techniques', () => {
    expect(isValidMitreTechnique('T1059')).toBe(true);
  });

  it('accepts sub-techniques (TXXXX.YYY)', () => {
    expect(isValidMitreTechnique('T1059.004')).toBe(true);
  });

  it('rejects malformed strings', () => {
    expect(isValidMitreTechnique('1059')).toBe(false);
    expect(isValidMitreTechnique('T59')).toBe(false);
    expect(isValidMitreTechnique('T1059.4')).toBe(false);
    expect(isValidMitreTechnique('T1059.0044')).toBe(false);
    expect(isValidMitreTechnique('')).toBe(false);
  });
});
