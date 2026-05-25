import { describe, it, expect } from 'vitest';
import {
  SHALLA_TARBALL_URL,
  BLACKWEB_REPO_URL,
  categoryListPath,
  parseSquidguardDomains,
  buildCategoryBlocklist,
} from './blocklist-builder.js';
import { getCategory } from './categories.js';

describe('blocklist-builder constants', () => {
  it('exposes canonical Shalla and blackweb URLs', () => {
    expect(SHALLA_TARBALL_URL).toMatch(/shallalist/);
    expect(BLACKWEB_REPO_URL).toMatch(/blackweb/);
  });
});

describe('categoryListPath', () => {
  it('joins the archive base with the category shallaPath', () => {
    const cat = getCategory('malware');
    if (!cat) throw new Error('expected malware category to exist');
    expect(categoryListPath(cat, 'BL')).toBe('BL/malware/domains');
  });

  it('strips a trailing slash from the archive base', () => {
    const cat = getCategory('malware');
    if (!cat) throw new Error('expected malware category to exist');
    expect(categoryListPath(cat, 'BL/')).toBe('BL/malware/domains');
  });
});

describe('parseSquidguardDomains', () => {
  it('parses a simple list, dedupes, and sorts', () => {
    const out = parseSquidguardDomains(
      ['evil.com', 'attacker.io', 'evil.com'].join('\n'),
    );
    expect(out).toEqual(['attacker.io', 'evil.com']);
  });

  it('strips line comments introduced with #', () => {
    const out = parseSquidguardDomains(
      ['# header comment', 'evil.com # inline', '', 'good.org'].join('\n'),
    );
    expect(out).toEqual(['evil.com', 'good.org']);
  });

  it('lowercases and removes trailing dots', () => {
    const out = parseSquidguardDomains('Evil.COM.\nGOOD.ORG');
    expect(out).toEqual(['evil.com', 'good.org']);
  });

  it('handles CRLF line endings', () => {
    const out = parseSquidguardDomains('a.com\r\nb.com\r\n');
    expect(out).toEqual(['a.com', 'b.com']);
  });

  it('rejects entries that are not valid hostnames', () => {
    const out = parseSquidguardDomains(
      ['valid.com', '*.wildcard.com', 'no spaces.com', '127.0.0.1'].join('\n'),
    );
    expect(out).toEqual(['valid.com']);
  });

  it('returns an empty list for an all-comments body', () => {
    expect(parseSquidguardDomains('# comment\n# another\n')).toEqual([]);
  });
});

describe('buildCategoryBlocklist', () => {
  it('throws on an unknown category id', () => {
    expect(() =>
      buildCategoryBlocklist('not-a-category', [
        { origin: 'inline', body: 'evil.com' },
      ]),
    ).toThrow(/unknown category/);
  });

  it('throws when no sources are supplied', () => {
    expect(() => buildCategoryBlocklist('malware', [])).toThrow(/source/);
  });

  it('merges multiple sources, dedupes, and preserves origins', () => {
    const out = buildCategoryBlocklist('malware', [
      { origin: 'shalla', body: 'a.com\nb.com' },
      { origin: 'blackweb', body: 'b.com\nc.com' },
    ]);
    expect(out.category.id).toBe('malware');
    expect(out.domains).toEqual(['a.com', 'b.com', 'c.com']);
    expect(out.origins).toEqual(['shalla', 'blackweb']);
  });

  it('returns the category record so callers can audit risk score', () => {
    const out = buildCategoryBlocklist('phishing', [
      { origin: 's', body: 'p.com' },
    ]);
    expect(out.category.id).toBe('phishing');
    expect(out.category.alwaysOn).toBe(true);
  });
});
