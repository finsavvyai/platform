import { describe, it, expect } from 'vitest';
import { parseFeed } from './feed-parser.js';

describe('parseFeed — hosts (URLhaus-shape)', () => {
  it('parses valid hosts entries and skips comments/blanks', () => {
    const text = [
      '# This is the URLhaus malware domains hostfile',
      '# https://urlhaus.abuse.ch/',
      '',
      '127.0.0.1 localhost',
      '0.0.0.0 evil.example.com',
      '0.0.0.0 phish.example.org # active 2026-04-26',
      'not-a-line',
    ].join('\n');
    const out = parseFeed('hosts', text, 'urlhaus');
    expect(out).toEqual([
      { domain: 'evil.example.com', source: 'urlhaus' },
      { domain: 'phish.example.org', source: 'urlhaus' },
    ]);
  });

  it('skips obviously invalid hostnames', () => {
    const text = '0.0.0.0 ..\n0.0.0.0 a\n0.0.0.0 -bad.example.com\n0.0.0.0 ok.example.com';
    const out = parseFeed('hosts', text, 'urlhaus');
    expect(out).toEqual([{ domain: 'ok.example.com', source: 'urlhaus' }]);
  });
});

describe('parseFeed — domain-list (PhishTank-shape, AlphaSOC)', () => {
  it('parses one domain per line', () => {
    const text = '# header\nbad-domain.tld\nWORSE-DOMAIN.TLD\n\n#trailing comment\n';
    const out = parseFeed('domain-list', text, 'alphasoc');
    expect(out).toEqual([
      { domain: 'bad-domain.tld', source: 'alphasoc' },
      { domain: 'worse-domain.tld', source: 'alphasoc' },
    ]);
  });
});

describe('parseFeed — urls (OpenPhish-shape)', () => {
  it('extracts hostname from URLs and ignores non-URLs', () => {
    const text = [
      'https://login.evil.example.com/wp-admin',
      'http://Tracker.Bad.Example/path?x=1',
      'not a url',
      'https://[::1]/foo', // hostname `[::1]` rejected by validator
    ].join('\n');
    const out = parseFeed('urls', text, 'openphish');
    expect(out).toEqual([
      { domain: 'login.evil.example.com', source: 'openphish' },
      { domain: 'tracker.bad.example', source: 'openphish' },
    ]);
  });
});

describe('parseFeed — phishtank-csv', () => {
  it('parses url column and skips header row', () => {
    const text = [
      'phish_id,url,phish_detail_url,submission_time,verified',
      '1,"https://login.evil.example.com/x","https://detail/1","2026-04-26T00:00:00Z",yes',
      '2,"http://other.example.com/y","https://detail/2","2026-04-26T00:00:00Z",yes',
    ].join('\n');
    const out = parseFeed('phishtank-csv', text, 'phishtank');
    expect(out).toEqual([
      { domain: 'login.evil.example.com', source: 'phishtank' },
      { domain: 'other.example.com', source: 'phishtank' },
    ]);
  });
});

describe('parseFeed — spamhaus-zone', () => {
  it('extracts owner names from BIND zone A records', () => {
    const text = [
      '$TTL 60',
      '@ IN SOA dbl.spamhaus.org. hostmaster.spamhaus.org. ( 1 1h 15m 30d 1h )',
      '@ IN NS  ns.spamhaus.org.',
      'evil.example.com. 60 IN A 127.0.1.2',
      'phish.example.org. IN A 127.0.1.4',
      'comment-only.example.com. IN TXT "spam"', // ignored: not A
    ].join('\n');
    const out = parseFeed('spamhaus-zone', text, 'spamhaus');
    expect(out.map((e) => e.domain)).toEqual(['evil.example.com', 'phish.example.org']);
  });
});

describe('parseFeed — unknown format', () => {
  it('returns [] for unknown formats', () => {
    // @ts-expect-error — intentionally invalid format
    expect(parseFeed('does-not-exist', 'foo')).toEqual([]);
  });
});
