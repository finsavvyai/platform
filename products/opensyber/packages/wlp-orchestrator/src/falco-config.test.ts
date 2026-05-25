import { describe, it, expect } from 'vitest';
import {
  buildFalcoConfig,
  activeRuleNames,
  falcoConfigSchema,
} from './falco-config.js';
import { FALCO_RULES } from './falco-rules.js';

const baseInput = {
  webhookUrl: 'https://api.opensyber.cloud/api/wlp/findings',
};

describe('falcoConfigSchema', () => {
  it('rejects a non-URL webhookUrl', () => {
    const r = falcoConfigSchema.safeParse({ webhookUrl: 'not-a-url' });
    expect(r.success).toBe(false);
  });

  it('defaults ruleFiles and buffered when omitted', () => {
    const r = falcoConfigSchema.parse(baseInput);
    expect(r.ruleFiles).toEqual(['falco_rules.yaml']);
    expect(r.buffered).toBe(false);
  });

  it('rejects an empty ruleFiles array', () => {
    const r = falcoConfigSchema.safeParse({ ...baseInput, ruleFiles: [] });
    expect(r.success).toBe(false);
  });

  it('rejects an empty webhookBearer string', () => {
    const r = falcoConfigSchema.safeParse({
      ...baseInput,
      webhookBearer: '',
    });
    expect(r.success).toBe(false);
  });
});

describe('buildFalcoConfig output', () => {
  it('emits json_output:true and json_include_output_property:true', () => {
    const out = buildFalcoConfig(baseInput);
    expect(out).toContain('json_output: true');
    expect(out).toContain('json_include_output_property: true');
  });

  it('writes the webhook URL into http_output.url', () => {
    const out = buildFalcoConfig({
      webhookUrl: 'https://example.test/hook',
    });
    expect(out).toContain('url: "https://example.test/hook"');
    expect(out).toContain('http_output:');
    expect(out).toContain('  enabled: true');
  });

  it('emits Authorization header only when webhookBearer is set', () => {
    const without = buildFalcoConfig(baseInput);
    expect(without).not.toContain('Authorization:');

    const withBearer = buildFalcoConfig({
      ...baseInput,
      webhookBearer: 'top-secret',
    });
    expect(withBearer).toContain('Authorization: "Bearer top-secret"');
  });

  it('escapes quotes and backslashes in YAML strings', () => {
    const out = buildFalcoConfig({
      webhookUrl: 'https://x.test/?q=1',
      webhookBearer: 'a"b\\c',
    });
    // \\ → \\\\ and " → \"
    expect(out).toContain('Authorization: "Bearer a\\"b\\\\c"');
  });

  it('emits each rules_files entry under /etc/falco', () => {
    const out = buildFalcoConfig({
      ...baseInput,
      ruleFiles: ['falco_rules.yaml', 'falco_rules.local.yaml'],
    });
    expect(out).toContain('  - /etc/falco/falco_rules.yaml');
    expect(out).toContain('  - /etc/falco/falco_rules.local.yaml');
  });

  it('emits buffered_outputs:true when buffered=true', () => {
    const out = buildFalcoConfig({ ...baseInput, buffered: true });
    expect(out).toContain('buffered_outputs: true');
  });

  it('lists every catalog rule when enabledRuleNames is omitted', () => {
    const out = buildFalcoConfig(baseInput);
    for (const r of FALCO_RULES) {
      expect(out).toContain(`#   - ${r.name}`);
    }
  });

  it('filters to enabledRuleNames when provided', () => {
    const out = buildFalcoConfig({
      ...baseInput,
      enabledRuleNames: ['Terminal shell in container'],
    });
    expect(out).toContain('#   - Terminal shell in container');
    expect(out).not.toContain('#   - Write below etc');
  });

  it('falls back to full catalog when enabledRuleNames is empty', () => {
    const out = buildFalcoConfig({
      ...baseInput,
      enabledRuleNames: [],
    });
    expect(out).toContain('#   - Terminal shell in container');
    expect(out).toContain('#   - Write below etc');
  });
});

describe('activeRuleNames', () => {
  it('returns every catalog rule name when no filter', () => {
    const names = activeRuleNames(baseInput);
    expect(names.length).toBe(FALCO_RULES.length);
  });

  it('honours enabledRuleNames', () => {
    const names = activeRuleNames({
      ...baseInput,
      enabledRuleNames: ['Write below etc'],
    });
    expect(names).toEqual(['Write below etc']);
  });

  it('throws on invalid input (rejects unparseable schema)', () => {
    expect(() => activeRuleNames({ webhookUrl: 'nope' })).toThrow();
  });
});
