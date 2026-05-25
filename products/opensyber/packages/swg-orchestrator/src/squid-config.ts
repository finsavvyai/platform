/**
 * Squid proxy config-snippet builder.
 *
 * Generates a `squid.conf` fragment that sets up:
 *   1. Listen ports (HTTP + intercept).
 *   2. Optional `cache_peer` chained to an upstream proxy.
 *   3. SSL bumping on a configurable port for HTTPS inspection — REQUIRES
 *      a tenant-deployed root CA on every endpoint that uses the gateway.
 *      We document that requirement in a banner comment and refuse to
 *      emit ssl_bump rules unless the caller passes both `bumpCertPath`
 *      and `bumpKeyPath`.
 *   4. ACL + http_access pairs for each enabled URL category. e2guardian
 *      handles the actual blocklist match; squid just chains to it via
 *      `cache_peer` + `never_direct allow CONNECT`. We still emit
 *      category ACLs so the policy is auditable from squid's side.
 *   5. `icap_service` directives pointing to a configurable ICAP host:port
 *      so the DLP scanner from sdlc-platform can be wired in here.
 *
 * The output is meant to be dropped into `/etc/squid/conf.d/opensyber.conf`
 * and reloaded with `squid -k reconfigure`. Provisioning the file itself
 * is the agent's responsibility, not this module's.
 */

import { SWG_CATEGORIES, getCategory } from './categories.js';

export interface SquidConfigOptions {
  /** Tenant identifier — used in comments only. */
  tenantId: string;
  /** Port squid listens on for plain HTTP CONNECT proxying. Default 3128. */
  listenPort?: number;
  /** Optional intercept port for transparent proxying. */
  interceptPort?: number;
  /**
   * Optional upstream proxy (e.g. corporate egress). When set, squid is
   * configured with `cache_peer` + `never_direct` so all traffic chains.
   */
  upstreamProxy?: { host: string; port: number };
  /**
   * SSL bumping. When undefined or `enabled: false`, no bump rules are
   * emitted and HTTPS passes through with CONNECT-tunnel only.
   */
  sslBump?:
    | { enabled: false }
    | {
        enabled: true;
        listenPort: number;
        bumpCertPath: string;
        bumpKeyPath: string;
      };
  /** ICAP host:port for DLP integration (optional). */
  icapEndpoint?: { host: string; port: number; service?: string };
  /** Category ids to enforce. Unknown ids are silently dropped. */
  enabledCategoryIds: string[];
}

const DEFAULT_LISTEN_PORT = 3128;
const DEFAULT_ICAP_SERVICE = 'opensyber_dlp';

function header(opts: SquidConfigOptions): string {
  const lines = [`# OpenSyber Squid config for tenant ${opts.tenantId}`];
  if (opts.sslBump?.enabled !== false) {
    lines.push(
      `#`,
      `# WARNING: ssl_bump requires a tenant-issued root CA installed on`,
      `# every endpoint that uses this proxy. Without it, HTTPS browsing`,
      `# will fail with TLS errors. The CA is provisioned by agent-runtime;`,
      `# this file only references the cert/key paths.`,
    );
  }
  return lines.join('\n');
}

function listenBlock(opts: SquidConfigOptions): string {
  const port = opts.listenPort ?? DEFAULT_LISTEN_PORT;
  const lines = [`http_port ${port}`];
  if (opts.interceptPort) lines.push(`http_port ${opts.interceptPort} intercept`);
  if (opts.sslBump?.enabled) {
    const b = opts.sslBump;
    lines.push(
      `https_port ${b.listenPort} ssl-bump generate-host-certificates=on ` +
        `dynamic_cert_mem_cache_size=4MB ` +
        `cert=${b.bumpCertPath} key=${b.bumpKeyPath}`,
    );
  }
  return lines.join('\n');
}

function categoryAclBlock(ids: string[]): string {
  const lines: string[] = [];
  for (const id of ids) {
    const cat = getCategory(id);
    if (!cat) continue;
    const aclName = `swg_cat_${id.replace(/-/g, '_')}`;
    lines.push(
      `# category=${cat.id} risk=${cat.riskScore} alwaysOn=${cat.alwaysOn}`,
      `acl ${aclName} dstdom_regex -i \"/etc/squid/categories/${cat.id}.regex\"`,
      `http_access deny ${aclName}`,
    );
  }
  return lines.join('\n');
}

function sslBumpRules(opts: SquidConfigOptions): string {
  if (!opts.sslBump?.enabled) return '';
  return [
    `acl swg_step1 at_step SslBump1`,
    `ssl_bump peek swg_step1`,
    `ssl_bump bump all`,
    `sslcrtd_program /usr/lib/squid/security_file_certgen -s /var/lib/squid/ssl_db -M 4MB`,
  ].join('\n');
}

function upstreamBlock(opts: SquidConfigOptions): string {
  if (!opts.upstreamProxy) return '';
  const { host, port } = opts.upstreamProxy;
  return [
    `cache_peer ${host} parent ${port} 0 no-query default login=PASS`,
    `never_direct allow all`,
  ].join('\n');
}

function icapBlock(opts: SquidConfigOptions): string {
  if (!opts.icapEndpoint) return '';
  const { host, port } = opts.icapEndpoint;
  const service = opts.icapEndpoint.service ?? DEFAULT_ICAP_SERVICE;
  return [
    `icap_enable on`,
    `icap_preview_enable on`,
    `icap_send_client_ip on`,
    `icap_send_client_username on`,
    `icap_service ${service}_req reqmod_precache icap://${host}:${port}/reqmod`,
    `icap_service ${service}_resp respmod_precache icap://${host}:${port}/respmod`,
    `adaptation_access ${service}_req allow all`,
    `adaptation_access ${service}_resp allow all`,
  ].join('\n');
}

/**
 * Build a complete squid.conf snippet. Deterministic for identical inputs.
 */
export function buildSquidConfig(opts: SquidConfigOptions): string {
  if (!opts.tenantId) throw new Error('squid-config: tenantId is required');
  const knownIds = opts.enabledCategoryIds.filter((id) =>
    SWG_CATEGORIES.some((c) => c.id === id),
  );
  const blocks = [
    header(opts),
    listenBlock(opts),
    categoryAclBlock(knownIds),
    sslBumpRules(opts),
    upstreamBlock(opts),
    icapBlock(opts),
  ].filter((b) => b.length > 0);
  return blocks.join('\n\n') + '\n';
}
