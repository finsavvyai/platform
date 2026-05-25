import { describe, it, expect } from 'vitest';
import { buildRpzZone } from './rpz-builder.js';

const SOA = {
  origin: 'rpz.tenant-acme.opensyber.cloud.',
  primaryNs: 'ns1.opensyber.cloud.',
  hostmaster: 'hostmaster.opensyber.cloud.',
  serial: 2026042601,
};

describe('buildRpzZone', () => {
  it('emits a valid SOA + NS header and trailing newline', () => {
    const out = buildRpzZone(
      [{ domain: 'evil.example.com', source: 'urlhaus' }],
      SOA,
    );
    expect(out.endsWith('\n')).toBe(true);
    expect(out).toContain('$ORIGIN rpz.tenant-acme.opensyber.cloud.');
    expect(out).toContain('IN  SOA ns1.opensyber.cloud. hostmaster.opensyber.cloud.');
    expect(out).toContain('2026042601 ; serial');
    expect(out).toContain('IN  NS  ns1.opensyber.cloud.');
  });

  it('emits CNAME . record per blocked domain with source comment', () => {
    const out = buildRpzZone(
      [
        { domain: 'evil.example.com', source: 'urlhaus' },
        { domain: 'phish.example.org', source: 'phishtank' },
      ],
      SOA,
    );
    expect(out).toMatch(/^evil\.example\.com CNAME \. ; src=urlhaus$/m);
    expect(out).toMatch(/^phish\.example\.org CNAME \. ; src=phishtank$/m);
  });

  it('dedupes entries by domain and sorts lexicographically', () => {
    const out = buildRpzZone(
      [
        { domain: 'b.example.com', source: 's1' },
        { domain: 'a.example.com', source: 's2' },
        { domain: 'b.example.com', source: 's3' }, // dupe — first wins
      ],
      SOA,
    );
    const aIdx = out.indexOf('a.example.com CNAME');
    const bIdx = out.indexOf('b.example.com CNAME');
    expect(aIdx).toBeGreaterThan(0);
    expect(bIdx).toBeGreaterThan(aIdx);
    // Only one occurrence of b.example.com record line
    const bMatches = out.match(/^b\.example\.com CNAME/gm) ?? [];
    expect(bMatches.length).toBe(1);
  });

  it('reports the entry count in the zone comment', () => {
    const out = buildRpzZone(
      [
        { domain: 'a.example.com', source: 's' },
        { domain: 'b.example.com', source: 's' },
      ],
      SOA,
    );
    expect(out).toContain('; entries  : 2');
  });

  it('rejects negative or non-integer serials', () => {
    expect(() => buildRpzZone([], { ...SOA, serial: -1 })).toThrow();
    expect(() => buildRpzZone([], { ...SOA, serial: 1.5 })).toThrow();
  });

  it('rejects missing SOA fields', () => {
    expect(() => buildRpzZone([], { ...SOA, origin: '' })).toThrow();
    expect(() => buildRpzZone([], { ...SOA, primaryNs: '' })).toThrow();
    expect(() => buildRpzZone([], { ...SOA, hostmaster: '' })).toThrow();
  });
});
