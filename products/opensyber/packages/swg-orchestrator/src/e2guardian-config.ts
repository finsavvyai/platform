/**
 * e2guardian filter-group config builder.
 *
 * Generates an `e2guardianf1.conf` body for a single filter group. The
 * file is loaded by the e2guardian daemon (Squid's content-filter peer)
 * and references on-disk site/URL list files we keep under
 *   /etc/e2guardian/lists/<category-id>/{domains,urls}
 *
 * Each enabled category contributes a pair of `.Include<>` directives
 * pointing at those list files. Uncategorised traffic falls through to
 * the naive bayes / phrase-weight scorer with the configured threshold.
 *
 * Reference: https://github.com/e2guardian/e2guardian — config-file
 * directive list lives in `configs/e2guardianf1.conf` in the upstream
 * repo (GPLv2). We emit only the directives we actually use; the daemon
 * accepts unknown directives but warns at start-up.
 */

import { SWG_CATEGORIES, getCategory } from './categories.js';
import { DLP_RULES, type DlpRule } from './dlp-rules.js';

export interface E2guardianConfigOptions {
  /** Tenant id — used in comments only. */
  tenantId: string;
  /** Filter-group display name. */
  groupName: string;
  /** Numeric e2guardian filter group id (1..N). */
  groupId?: number;
  /**
   * Naive-Bayes / phrase-weight block threshold. Higher is stricter.
   * 50 is the upstream default and a sane starting point.
   */
  weightedPhraseThreshold?: number;
  /** Whether to log every block. Useful while bedding in. */
  logBlockedRequests?: boolean;
  /** Category ids to enforce. Unknown ids are dropped. */
  enabledCategoryIds: string[];
  /**
   * Filesystem root where category list files live. Defaults to the
   * Debian package location used by upstream cloud images.
   */
  listRoot?: string;
  /**
   * DLP rules to enforce inline. When set, the config references a
   * `bannedregexpcontentlist` file at `${listRoot}/dlp/regex-content`.
   * Pass an empty array to disable DLP entirely. Defaults to DLP_RULES.
   */
  dlpRules?: DlpRule[];
}

const DEFAULT_LIST_ROOT = '/etc/e2guardian/lists';
const DEFAULT_GROUP_ID = 1;
const DEFAULT_WEIGHT_THRESHOLD = 50;

function header(opts: E2guardianConfigOptions): string {
  return [
    `# OpenSyber e2guardian filter group config`,
    `# tenant=${opts.tenantId}`,
    `# group=${opts.groupName}`,
    `# Format reference: https://github.com/e2guardian/e2guardian`,
  ].join('\n');
}

function groupDirectives(opts: E2guardianConfigOptions): string {
  const id = opts.groupId ?? DEFAULT_GROUP_ID;
  const w = opts.weightedPhraseThreshold ?? DEFAULT_WEIGHT_THRESHOLD;
  const log = opts.logBlockedRequests ? 'on' : 'off';
  return [
    `groupmode = 1`,
    `groupname = '${opts.groupName}'`,
    `filtergroup = ${id}`,
    `naughtynesslimit = ${w}`,
    `weighted_phrase_mode = 2`,
    `reportinglevel = 3`,
    `logblockedrequests = ${log}`,
  ].join('\n');
}

function categoryIncludes(opts: E2guardianConfigOptions): string {
  const root = opts.listRoot ?? DEFAULT_LIST_ROOT;
  const out: string[] = [];
  for (const id of opts.enabledCategoryIds) {
    const cat = getCategory(id);
    if (!cat) continue;
    out.push(
      `# category=${cat.id} risk=${cat.riskScore} alwaysOn=${cat.alwaysOn}`,
      `bannedsitelist = '${root}/${cat.id}/domains'`,
      `bannedurllist = '${root}/${cat.id}/urls'`,
    );
  }
  return out.join('\n');
}

function dlpDirectives(opts: E2guardianConfigOptions): string {
  const rules = opts.dlpRules ?? DLP_RULES;
  if (rules.length === 0) return '';
  const root = opts.listRoot ?? DEFAULT_LIST_ROOT;
  return [
    `# DLP — inline content scanning (PCI PAN, IL ID, IBAN, email)`,
    `bannedregexpcontentlist = '${root}/dlp/regex-content'`,
    `bannedregexpurllist = '${root}/dlp/regex-url'`,
  ].join('\n');
}

function bypassBlock(): string {
  // Default deny — no bypass keys, no exceptions for the filter group.
  return [
    `# No bypass — administrator-only override via configmod`,
    `bypass = 0`,
    `infectionbypass = 0`,
  ].join('\n');
}

/**
 * Build a complete e2guardianf1.conf body. Deterministic for identical
 * inputs. Caller is responsible for writing it under
 * `/etc/e2guardian/e2guardianf1.conf` and reloading the daemon.
 */
export function buildE2guardianConfig(opts: E2guardianConfigOptions): string {
  if (!opts.tenantId) throw new Error('e2guardian-config: tenantId is required');
  if (!opts.groupName || !/^[a-zA-Z0-9_\- ]+$/.test(opts.groupName)) {
    throw new Error('e2guardian-config: groupName must be alphanumeric/underscore/space');
  }
  const knownIds = opts.enabledCategoryIds.filter((id) =>
    SWG_CATEGORIES.some((c) => c.id === id),
  );
  const blocks = [
    header(opts),
    groupDirectives(opts),
    categoryIncludes({ ...opts, enabledCategoryIds: knownIds }),
    dlpDirectives(opts),
    bypassBlock(),
  ].filter((b) => b.length > 0);
  return blocks.join('\n\n') + '\n';
}

/**
 * Parse a previously-emitted config back into the directives we know.
 * Used by tests to round-trip the format and by the orchestrator to
 * reconcile drift on next sync.
 */
export function parseE2guardianConfig(text: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.replace(/#.*$/, '').trim();
    if (!line) continue;
    const m = line.match(/^([a-z_]+)\s*=\s*(.*)$/i);
    if (!m || !m[1]) continue;
    const key = m[1];
    let val = (m[2] ?? '').trim();
    // Strip surrounding single quotes if present.
    if (val.startsWith("'") && val.endsWith("'")) val = val.slice(1, -1);
    // For repeated keys (bannedsitelist), append with a separator we can split on.
    if (key in out) out[key] = `${out[key]}\n${val}`;
    else out[key] = val;
  }
  return out;
}
