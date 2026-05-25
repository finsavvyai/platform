// @ts-nocheck
/**
 * SSE bundle builder — assembles a deployable config bundle for a tenant
 * from the SWG / WLP orchestrators. The result is a flat manifest of
 * `{ path, content }` entries the agent writes verbatim to the VM:
 *
 *   /etc/squid/squid.conf
 *   /etc/e2guardian/e2guardianf1.conf
 *   /etc/e2guardian/lists/dlp/regex-content
 *   /etc/falco/falco.yaml          (when WLP enabled)
 *   /etc/osquery/osquery.conf      (when WLP enabled)
 *
 * Pure function — no I/O. Storage to R2 / signing happens in the route
 * that calls this. Keeping the builder pure makes it trivial to snapshot-
 * test and to reuse from CI / preview environments.
 */

import {
  buildSquidConfig,
  buildE2guardianConfig,
  renderE2guardianRegexBody,
  DLP_RULES,
  type SquidConfigOptions,
  type E2guardianConfigOptions,
  type DlpRule,
} from '@opensyber/swg-orchestrator';
import {
  buildFalcoConfig,
  buildOsqueryConfig,
  type FalcoConfigInput,
  type OsqueryConfigInput,
} from '@opensyber/wlp-orchestrator';

export interface BundleEntry {
  path: string;
  content: string;
  mode?: number;
}

export interface SseBundleInput {
  tenantId: string;
  swg: {
    listenPort?: number;
    upstreamProxy?: SquidConfigOptions['upstreamProxy'];
    sslBump?: SquidConfigOptions['sslBump'];
    enabledCategoryIds: string[];
    groupName: string;
    weightedPhraseThreshold?: number;
    dlpRules?: DlpRule[];
  };
  wlp?: {
    falco: FalcoConfigInput;
    osquery: OsqueryConfigInput;
  };
}

export interface SseBundle {
  tenantId: string;
  entries: BundleEntry[];
  /** Stable order — caller can hash this for change detection. */
  fingerprint: string;
}

const SQUID_PATH = '/etc/squid/squid.conf';
const E2G_PATH = '/etc/e2guardian/e2guardianf1.conf';
const DLP_REGEX_PATH = '/etc/e2guardian/lists/dlp/regex-content';
const DLP_URL_PATH = '/etc/e2guardian/lists/dlp/regex-url';
const FALCO_PATH = '/etc/falco/falco.yaml';
const OSQUERY_PATH = '/etc/osquery/osquery.conf';

export function buildSseBundle(input: SseBundleInput): SseBundle {
  const entries: BundleEntry[] = [];

  const squidOpts: SquidConfigOptions = {
    tenantId: input.tenantId,
    listenPort: input.swg.listenPort,
    upstreamProxy: input.swg.upstreamProxy,
    sslBump: input.swg.sslBump,
    enabledCategoryIds: input.swg.enabledCategoryIds,
  };
  entries.push({ path: SQUID_PATH, content: buildSquidConfig(squidOpts), mode: 0o644 });

  const e2gOpts: E2guardianConfigOptions = {
    tenantId: input.tenantId,
    groupName: input.swg.groupName,
    weightedPhraseThreshold: input.swg.weightedPhraseThreshold,
    enabledCategoryIds: input.swg.enabledCategoryIds,
    dlpRules: input.swg.dlpRules ?? DLP_RULES,
  };
  entries.push({ path: E2G_PATH, content: buildE2guardianConfig(e2gOpts), mode: 0o644 });

  const dlpRules = input.swg.dlpRules ?? DLP_RULES;
  if (dlpRules.length > 0) {
    entries.push({
      path: DLP_REGEX_PATH,
      content: renderE2guardianRegexBody(dlpRules),
      mode: 0o644,
    });
    // URL-side regex list intentionally empty — DLP is body-side only for now.
    // The empty file must exist or e2guardian refuses to start.
    entries.push({
      path: DLP_URL_PATH,
      content: '# DLP URL-side regex list (currently unused)\n',
      mode: 0o644,
    });
  }

  if (input.wlp) {
    entries.push({
      path: FALCO_PATH,
      content: buildFalcoConfig(input.wlp.falco),
      mode: 0o644,
    });
    entries.push({
      path: OSQUERY_PATH,
      content: buildOsqueryConfig(input.wlp.osquery),
      mode: 0o644,
    });
  }

  entries.sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0));
  return {
    tenantId: input.tenantId,
    entries,
    fingerprint: simpleFingerprint(entries),
  };
}

function simpleFingerprint(entries: BundleEntry[]): string {
  // Non-cryptographic fingerprint, just for change detection.
  // Strong hashing happens on the agent side at apply time.
  let hash = 0x811c9dc5;
  for (const e of entries) {
    for (const ch of e.path) {
      hash ^= ch.charCodeAt(0);
      hash = Math.imul(hash, 0x01000193) >>> 0;
    }
    for (const ch of e.content) {
      hash ^= ch.charCodeAt(0);
      hash = Math.imul(hash, 0x01000193) >>> 0;
    }
  }
  return hash.toString(16).padStart(8, '0');
}
