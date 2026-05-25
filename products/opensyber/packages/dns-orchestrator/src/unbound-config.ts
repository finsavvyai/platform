/**
 * Unbound config-snippet builder.
 *
 * Generates an `unbound.conf` fragment that:
 *   1. Listens on the tenant's resolver IP (and optionally 127.0.0.1).
 *   2. Enables RPZ via `auth-zone:` blocks, one per zone file.
 *   3. Configures sane defaults for a security-focused recursive resolver:
 *      DNSSEC validation, QNAME minimisation, aggressive NSEC, and
 *      0x20 randomisation.
 *
 * The output is meant to be dropped into
 *   /etc/unbound/unbound.conf.d/opensyber.conf
 * and reloaded with `unbound-control reload`. Provisioning the file
 * itself is the agent's responsibility, not this module's.
 */

export interface UnboundRpzZone {
  /** Zone name (e.g. `rpz.tenant-acme.opensyber.cloud`). */
  name: string;
  /** Path on disk where the zone file lives. */
  zonefile: string;
  /** When true, Unbound logs every block. Useful while bedding in. */
  log_rpz_actions?: boolean;
}

export interface UnboundConfigOptions {
  /** Tenant identifier — used in comments only. */
  tenant_id: string;
  /** IPs unbound should listen on (e.g. ['10.0.0.5', '127.0.0.1']). */
  listen_ips: string[];
  /** Networks allowed to query (CIDR). Defaults to RFC1918 + localhost. */
  access_control?: string[];
  /** RPZ zones to load. */
  rpz_zones: UnboundRpzZone[];
  /** Forwarders for non-blocked queries; undefined → recursive resolution. */
  forward_addrs?: string[];
}

const DEFAULT_ACL = ['127.0.0.0/8', '10.0.0.0/8', '172.16.0.0/12', '192.168.0.0/16'];

function indent(lines: string[]): string {
  return lines.map((l) => (l ? `    ${l}` : l)).join('\n');
}

function serverBlock(opts: UnboundConfigOptions): string {
  const acl = (opts.access_control && opts.access_control.length > 0
    ? opts.access_control
    : DEFAULT_ACL
  ).map((n) => `access-control: ${n} allow`);
  const listen = opts.listen_ips.map((ip) => `interface: ${ip}`);
  const lines = [
    `# OpenSyber Unbound config for tenant ${opts.tenant_id}`,
    `verbosity: 1`,
    `do-ip4: yes`,
    `do-ip6: no`,
    `do-udp: yes`,
    `do-tcp: yes`,
    ``,
    ...listen,
    ``,
    ...acl,
    ``,
    `# Security hardening`,
    `harden-glue: yes`,
    `harden-dnssec-stripped: yes`,
    `harden-below-nxdomain: yes`,
    `harden-referral-path: yes`,
    `qname-minimisation: yes`,
    `aggressive-nsec: yes`,
    `use-caps-for-id: yes`,
    `prefetch: yes`,
    `prefetch-key: yes`,
    `cache-min-ttl: 60`,
    `cache-max-ttl: 86400`,
  ];
  return `server:\n${indent(lines)}`;
}

function authZoneBlocks(zones: UnboundRpzZone[]): string {
  return zones
    .map((z) => {
      const lines = [
        `name: "${z.name}"`,
        `zonefile: "${z.zonefile}"`,
        `for-downstream: no`,
        `for-upstream: no`,
        `fallback-enabled: yes`,
      ];
      if (z.log_rpz_actions) lines.push(`# log_rpz_actions enabled`);
      return `auth-zone:\n${indent(lines)}`;
    })
    .join('\n\n');
}

function rpzBlocks(zones: UnboundRpzZone[]): string {
  return zones
    .map((z) => {
      const lines = [
        `name: "${z.name}"`,
        `zonefile: "${z.zonefile}"`,
        `rpz-action-override: nxdomain`,
        z.log_rpz_actions ? `rpz-log: yes` : `rpz-log: no`,
        z.log_rpz_actions ? `rpz-log-name: "${z.name}"` : ``,
      ].filter(Boolean) as string[];
      return `rpz:\n${indent(lines)}`;
    })
    .join('\n\n');
}

function forwardBlock(addrs?: string[]): string {
  if (!addrs || addrs.length === 0) return '';
  const lines = [
    `name: "."`,
    ...addrs.map((a) => `forward-addr: ${a}`),
    `forward-first: no`,
  ];
  return `forward-zone:\n${indent(lines)}`;
}

/**
 * Build a complete Unbound config snippet.
 *
 * The output is deterministic for identical inputs and contains every
 * directive required to load the supplied RPZ zones with NXDOMAIN action.
 */
export function buildUnboundConfig(opts: UnboundConfigOptions): string {
  if (!opts.tenant_id) throw new Error('unbound-config: tenant_id is required');
  if (!opts.listen_ips || opts.listen_ips.length === 0) {
    throw new Error('unbound-config: at least one listen_ip is required');
  }
  const parts = [
    serverBlock(opts),
    authZoneBlocks(opts.rpz_zones),
    rpzBlocks(opts.rpz_zones),
    forwardBlock(opts.forward_addrs),
  ].filter((s) => s.length > 0);
  return `${parts.join('\n\n')}\n`;
}
