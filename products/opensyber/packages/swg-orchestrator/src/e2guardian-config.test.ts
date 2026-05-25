import { describe, it, expect } from 'vitest';
import {
  buildE2guardianConfig,
  parseE2guardianConfig,
} from './e2guardian-config.js';

describe('buildE2guardianConfig', () => {
  it('throws when tenantId is empty', () => {
    expect(() =>
      buildE2guardianConfig({
        tenantId: '',
        groupName: 'default',
        enabledCategoryIds: [],
      }),
    ).toThrow(/tenantId/);
  });

  it('throws on a groupName with disallowed characters', () => {
    expect(() =>
      buildE2guardianConfig({
        tenantId: 't',
        groupName: 'bad;name',
        enabledCategoryIds: [],
      }),
    ).toThrow(/groupName/);
  });

  it('accepts alphanumeric/underscore/space groupName', () => {
    const out = buildE2guardianConfig({
      tenantId: 't',
      groupName: 'staff_office 1',
      enabledCategoryIds: [],
    });
    expect(out).toContain("groupname = 'staff_office 1'");
  });

  it('emits the configured weighted phrase threshold', () => {
    const out = buildE2guardianConfig({
      tenantId: 't',
      groupName: 'g',
      weightedPhraseThreshold: 80,
      enabledCategoryIds: [],
    });
    expect(out).toContain('naughtynesslimit = 80');
  });

  it('falls back to the default threshold when not provided', () => {
    const out = buildE2guardianConfig({
      tenantId: 't',
      groupName: 'g',
      enabledCategoryIds: [],
    });
    expect(out).toContain('naughtynesslimit = 50');
  });

  it('toggles logblockedrequests on/off based on input', () => {
    const on = buildE2guardianConfig({
      tenantId: 't',
      groupName: 'g',
      logBlockedRequests: true,
      enabledCategoryIds: [],
    });
    const off = buildE2guardianConfig({
      tenantId: 't',
      groupName: 'g',
      logBlockedRequests: false,
      enabledCategoryIds: [],
    });
    expect(on).toContain('logblockedrequests = on');
    expect(off).toContain('logblockedrequests = off');
  });

  it('emits one bannedsitelist + bannedurllist pair per known category', () => {
    const out = buildE2guardianConfig({
      tenantId: 't',
      groupName: 'g',
      enabledCategoryIds: ['malware', 'phishing'],
    });
    expect(out).toContain(
      "bannedsitelist = '/etc/e2guardian/lists/malware/domains'",
    );
    expect(out).toContain(
      "bannedurllist = '/etc/e2guardian/lists/malware/urls'",
    );
    expect(out).toContain(
      "bannedsitelist = '/etc/e2guardian/lists/phishing/domains'",
    );
  });

  it('drops unknown category ids silently', () => {
    const out = buildE2guardianConfig({
      tenantId: 't',
      groupName: 'g',
      enabledCategoryIds: ['malware', 'totally-bogus'],
    });
    expect(out).toContain('/etc/e2guardian/lists/malware/domains');
    expect(out).not.toContain('totally-bogus');
  });

  it('honours a custom listRoot path', () => {
    const out = buildE2guardianConfig({
      tenantId: 't',
      groupName: 'g',
      enabledCategoryIds: ['malware'],
      listRoot: '/var/lib/swg/lists',
    });
    expect(out).toContain("'/var/lib/swg/lists/malware/domains'");
  });

  it('always emits bypass = 0 (no bypass keys)', () => {
    const out = buildE2guardianConfig({
      tenantId: 't',
      groupName: 'g',
      enabledCategoryIds: [],
    });
    expect(out).toContain('bypass = 0');
    expect(out).toContain('infectionbypass = 0');
  });

  it('output ends with a trailing newline', () => {
    const out = buildE2guardianConfig({
      tenantId: 't',
      groupName: 'g',
      enabledCategoryIds: [],
    });
    expect(out.endsWith('\n')).toBe(true);
  });

  it('uses the explicit groupId when provided', () => {
    const out = buildE2guardianConfig({
      tenantId: 't',
      groupName: 'g',
      groupId: 7,
      enabledCategoryIds: [],
    });
    expect(out).toContain('filtergroup = 7');
  });
});

describe('parseE2guardianConfig', () => {
  it('round-trips simple key/value lines', () => {
    const text = "naughtynesslimit = 50\ngroupname = 'staff'\n";
    const out = parseE2guardianConfig(text);
    expect(out['naughtynesslimit']).toBe('50');
    expect(out['groupname']).toBe('staff');
  });

  it('strips inline comments and blank lines', () => {
    const text = '# header\n\nfoo = bar # trailing\n';
    const out = parseE2guardianConfig(text);
    expect(out['foo']).toBe('bar');
  });

  it('joins repeated keys with newline separators', () => {
    const text = `bannedsitelist = '/a'\nbannedsitelist = '/b'\n`;
    const out = parseE2guardianConfig(text);
    expect(out['bannedsitelist']).toBe('/a\n/b');
  });

  it('ignores malformed lines without an `=` separator', () => {
    const text = 'this is not a directive\nfoo = bar\n';
    const out = parseE2guardianConfig(text);
    expect(out).toEqual({ foo: 'bar' });
  });

  it('round-trips a buildE2guardianConfig output cleanly', () => {
    const generated = buildE2guardianConfig({
      tenantId: 't1',
      groupName: 'staff',
      enabledCategoryIds: ['malware'],
    });
    const parsed = parseE2guardianConfig(generated);
    expect(parsed['groupname']).toBe('staff');
    expect(parsed['filtergroup']).toBe('1');
    expect(parsed['bannedsitelist']).toContain('/malware/domains');
  });
});
