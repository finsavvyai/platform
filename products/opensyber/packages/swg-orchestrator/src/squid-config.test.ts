import { describe, it, expect } from 'vitest';
import { buildSquidConfig } from './squid-config.js';

describe('buildSquidConfig', () => {
  it('throws when tenantId is empty', () => {
    expect(() =>
      buildSquidConfig({ tenantId: '', enabledCategoryIds: [] }),
    ).toThrow(/tenantId/);
  });

  it('emits a tenant header banner with the tenant id', () => {
    const out = buildSquidConfig({
      tenantId: 'acme-corp',
      enabledCategoryIds: [],
    });
    expect(out).toContain('# OpenSyber Squid config for tenant acme-corp');
    expect(out).toContain('WARNING: ssl_bump requires a tenant-issued root CA');
  });

  it('uses the default listen port when none is provided', () => {
    const out = buildSquidConfig({
      tenantId: 't1',
      enabledCategoryIds: [],
    });
    expect(out).toContain('http_port 3128');
  });

  it('honours an explicit listen port and intercept port', () => {
    const out = buildSquidConfig({
      tenantId: 't1',
      listenPort: 4040,
      interceptPort: 4041,
      enabledCategoryIds: [],
    });
    expect(out).toContain('http_port 4040');
    expect(out).toContain('http_port 4041 intercept');
  });

  it('emits ssl_bump rules only when sslBump is enabled with paths', () => {
    const out = buildSquidConfig({
      tenantId: 't1',
      enabledCategoryIds: [],
      sslBump: {
        enabled: true,
        listenPort: 3129,
        bumpCertPath: '/etc/ssl/swg.pem',
        bumpKeyPath: '/etc/ssl/swg.key',
      },
    });
    expect(out).toContain('https_port 3129 ssl-bump');
    expect(out).toContain('cert=/etc/ssl/swg.pem key=/etc/ssl/swg.key');
    expect(out).toContain('ssl_bump bump all');
    expect(out).toContain('sslcrtd_program');
  });

  it('omits ssl_bump rules when explicitly disabled', () => {
    const out = buildSquidConfig({
      tenantId: 't1',
      enabledCategoryIds: [],
      sslBump: { enabled: false },
    });
    expect(out).not.toContain('ssl_bump');
    expect(out).not.toContain('https_port');
  });

  it('chains an upstream proxy with cache_peer + never_direct', () => {
    const out = buildSquidConfig({
      tenantId: 't1',
      enabledCategoryIds: [],
      upstreamProxy: { host: 'egress.corp', port: 8080 },
    });
    expect(out).toContain('cache_peer egress.corp parent 8080');
    expect(out).toContain('never_direct allow all');
  });

  it('emits ICAP directives for DLP when icapEndpoint is set', () => {
    const out = buildSquidConfig({
      tenantId: 't1',
      enabledCategoryIds: [],
      icapEndpoint: { host: 'dlp.local', port: 1344 },
    });
    expect(out).toContain('icap_enable on');
    expect(out).toContain('icap://dlp.local:1344/reqmod');
    expect(out).toContain('opensyber_dlp_resp respmod_precache');
  });

  it('uses the custom ICAP service name when provided', () => {
    const out = buildSquidConfig({
      tenantId: 't1',
      enabledCategoryIds: [],
      icapEndpoint: { host: 'dlp.local', port: 1344, service: 'corp_dlp' },
    });
    expect(out).toContain('corp_dlp_req reqmod_precache');
    expect(out).toContain('corp_dlp_resp respmod_precache');
  });

  it('emits one ACL block per known category and ignores unknown ids', () => {
    const out = buildSquidConfig({
      tenantId: 't1',
      enabledCategoryIds: ['malware', 'phishing', 'does-not-exist'],
    });
    expect(out).toContain('acl swg_cat_malware dstdom_regex');
    expect(out).toContain('acl swg_cat_phishing dstdom_regex');
    expect(out).not.toContain('does-not-exist');
    expect(out).not.toContain('swg_cat_does_not_exist');
  });

  it('replaces hyphens with underscores in ACL identifiers', () => {
    const out = buildSquidConfig({
      tenantId: 't1',
      enabledCategoryIds: ['cryptocurrency-mining', 'social-media'],
    });
    expect(out).toContain('acl swg_cat_cryptocurrency_mining');
    expect(out).toContain('acl swg_cat_social_media');
  });

  it('output is deterministic for identical inputs', () => {
    const opts = {
      tenantId: 't1',
      listenPort: 3128,
      enabledCategoryIds: ['malware', 'phishing'],
      upstreamProxy: { host: 'p', port: 80 },
    };
    expect(buildSquidConfig(opts)).toBe(buildSquidConfig(opts));
  });

  it('terminates output with a trailing newline', () => {
    const out = buildSquidConfig({ tenantId: 't1', enabledCategoryIds: [] });
    expect(out.endsWith('\n')).toBe(true);
  });
});
