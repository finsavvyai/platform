import { describe, it, expect } from 'vitest';
import { buildUnboundConfig } from './unbound-config.js';

describe('buildUnboundConfig', () => {
  const baseOpts = {
    tenant_id: 'acme',
    listen_ips: ['10.0.0.5', '127.0.0.1'],
    rpz_zones: [
      {
        name: 'rpz.tenant-acme.opensyber.cloud',
        zonefile: '/etc/unbound/rpz/acme.rpz',
        log_rpz_actions: true,
      },
    ],
  };

  it('emits a server: block with listen interfaces and hardening', () => {
    const out = buildUnboundConfig(baseOpts);
    expect(out).toMatch(/^server:/m);
    expect(out).toContain('interface: 10.0.0.5');
    expect(out).toContain('interface: 127.0.0.1');
    expect(out).toContain('qname-minimisation: yes');
    expect(out).toContain('harden-dnssec-stripped: yes');
    expect(out).toContain('use-caps-for-id: yes');
  });

  it('emits an auth-zone: block referencing each RPZ zone file', () => {
    const out = buildUnboundConfig(baseOpts);
    expect(out).toMatch(/auth-zone:/);
    expect(out).toContain('name: "rpz.tenant-acme.opensyber.cloud"');
    expect(out).toContain('zonefile: "/etc/unbound/rpz/acme.rpz"');
  });

  it('emits an rpz: block with NXDOMAIN action override', () => {
    const out = buildUnboundConfig(baseOpts);
    expect(out).toMatch(/rpz:/);
    expect(out).toContain('rpz-action-override: nxdomain');
    // log_rpz_actions=true → rpz-log: yes
    expect(out).toContain('rpz-log: yes');
  });

  it('emits a forward-zone: block when forward_addrs supplied', () => {
    const out = buildUnboundConfig({ ...baseOpts, forward_addrs: ['1.1.1.1', '9.9.9.9'] });
    expect(out).toContain('forward-zone:');
    expect(out).toContain('forward-addr: 1.1.1.1');
    expect(out).toContain('forward-addr: 9.9.9.9');
  });

  it('omits forward-zone: block when forward_addrs absent', () => {
    const out = buildUnboundConfig(baseOpts);
    expect(out).not.toContain('forward-zone:');
  });

  it('uses default RFC1918 + localhost ACL when none supplied', () => {
    const out = buildUnboundConfig(baseOpts);
    expect(out).toContain('access-control: 127.0.0.0/8 allow');
    expect(out).toContain('access-control: 10.0.0.0/8 allow');
    expect(out).toContain('access-control: 192.168.0.0/16 allow');
  });

  it('rejects empty tenant_id or listen_ips', () => {
    expect(() => buildUnboundConfig({ ...baseOpts, tenant_id: '' })).toThrow();
    expect(() => buildUnboundConfig({ ...baseOpts, listen_ips: [] })).toThrow();
  });
});
