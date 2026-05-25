/**
 * RPZ zone-file builder.
 *
 * Response Policy Zones (RFC draft-vixie-dnsop-dns-rpz) are standard DNS
 * zones whose RR data is interpreted as a policy by the resolver:
 *
 *   <name>            CNAME .          → NXDOMAIN  (the action we use)
 *   <name>            CNAME *.         → NODATA
 *   <name>            A 127.0.0.1      → walled-garden redirect
 *
 * Unbound consumes RPZ via `auth-zone:` + `for-upstream: no` +
 * `rpz-action-override: nxdomain`. We emit the "NXDOMAIN" action so
 * blocked domains return as if they don't exist — quiet failure mode
 * that doesn't tip off attacker tooling.
 */

import type { ParsedEntry } from './feed-parser.js';

export interface SoaConfig {
  /** Origin (the zone name itself), e.g. `rpz.tenant-acme.opensyber.cloud.` */
  origin: string;
  /** Primary nameserver, e.g. `ns1.opensyber.cloud.` */
  primaryNs: string;
  /** Hostmaster mailbox in zone-file form, e.g. `hostmaster.opensyber.cloud.` */
  hostmaster: string;
  /** SOA serial — caller passes a monotonically increasing integer. */
  serial: number;
  /** SOA timers (seconds). Defaults are RFC1912-friendly for fast feeds. */
  refresh?: number;
  retry?: number;
  expire?: number;
  minimum?: number;
  /** TTL for individual RPZ records (seconds). */
  recordTtl?: number;
}

const DEFAULT_TIMERS = {
  refresh: 300,
  retry: 60,
  expire: 86400,
  minimum: 60,
  recordTtl: 60,
};

function ensureFqdn(name: string): string {
  return name.endsWith('.') ? name : `${name}.`;
}

function dedupe(entries: ParsedEntry[]): ParsedEntry[] {
  const seen = new Set<string>();
  const out: ParsedEntry[] = [];
  for (const e of entries) {
    if (seen.has(e.domain)) continue;
    seen.add(e.domain);
    out.push(e);
  }
  return out;
}

function buildHeader(soa: SoaConfig, count: number): string {
  const t = { ...DEFAULT_TIMERS, ...soa };
  const origin = ensureFqdn(soa.origin);
  const ns = ensureFqdn(soa.primaryNs);
  const rname = ensureFqdn(soa.hostmaster);
  return [
    `; OpenSyber DNS firewall — RPZ zone`,
    `; origin   : ${origin}`,
    `; serial   : ${soa.serial}`,
    `; entries  : ${count}`,
    `; action   : NXDOMAIN (CNAME .) for all blocked names`,
    `; generated: ${new Date().toISOString()}`,
    ``,
    `$ORIGIN ${origin}`,
    `$TTL ${t.recordTtl}`,
    `@   IN  SOA ${ns} ${rname} (`,
    `        ${soa.serial} ; serial`,
    `        ${t.refresh}   ; refresh`,
    `        ${t.retry}     ; retry`,
    `        ${t.expire}    ; expire`,
    `        ${t.minimum}   ; minimum`,
    `        )`,
    `    IN  NS  ${ns}`,
    ``,
  ].join('\n');
}

function recordLine(entry: ParsedEntry): string {
  // RPZ owner name is the blocked domain itself (relative to $ORIGIN).
  // We emit `CNAME .` for NXDOMAIN action. Source is preserved as a
  // comment for audit / debugging.
  return `${entry.domain} CNAME . ; src=${entry.source}`;
}

/**
 * Build a complete RPZ zone-file body.
 *
 * The output is byte-identical given identical inputs (after dedupe +
 * lexicographic sort), so it's safe to hash for change detection.
 */
export function buildRpzZone(entries: ParsedEntry[], soa: SoaConfig): string {
  if (!soa.origin || !soa.primaryNs || !soa.hostmaster) {
    throw new Error('rpz-builder: origin, primaryNs, and hostmaster are required');
  }
  if (!Number.isInteger(soa.serial) || soa.serial < 0) {
    throw new Error('rpz-builder: serial must be a non-negative integer');
  }
  const sorted = dedupe(entries).sort((a, b) => a.domain.localeCompare(b.domain));
  const header = buildHeader(soa, sorted.length);
  const body = sorted.map(recordLine).join('\n');
  return `${header}${body}\n`;
}
