/**
 * Remote Browser Isolation policies.
 *
 * A policy maps a set of URL patterns to one of three actions:
 *   - 'isolate' — render the URL in a Kasm container, stream pixels back
 *   - 'block'   — refuse to load (returns sentinel page to user)
 *   - 'allow'   — pass-through, no isolation
 *
 * Patterns support exact host match (`evil.example.com`) and glob fallback
 * (`*.tor2web.io`, `*.zip-dl.*`). Precedence is enforced by url-matcher.ts:
 * exact-host wins, then most-specific glob, then default.
 *
 * The default policy set covers the highest-risk URL classes per RBI/SASE
 * vendor docs (Menlo, Cloudflare Browser Isolation, Zscaler ZDX): newly
 * registered domains, executable downloads, anonymizers/proxies.
 */

export type RbiPolicyAction = 'isolate' | 'block' | 'allow';

export interface RbiPolicy {
  /** Stable id, kebab-case. Used in audit logs and DB foreign refs. */
  id: string;
  /** Human-readable name shown in dashboard. */
  name: string;
  /** Why this policy exists — surfaces in user-facing block pages. */
  description: string;
  /** Match list. Each entry is exact host OR glob (`*` allowed). */
  urlPatterns: string[];
  /** What to do when a URL matches. */
  action: RbiPolicyAction;
  /** Kasm image to launch when action is 'isolate'. Empty for non-isolate. */
  kasmImageId: string;
  /** Max seconds the isolated session is allowed to live. */
  durationSeconds: number;
  /** Lower numbers evaluated first when multiple globs match. */
  priority: number;
}

/**
 * Default Kasm image ids reference the upstream chrome-headless workspace
 * (`kasmweb/chrome:1.16.0` is the canonical RBI image; deployments override
 * via the tenant `default_image_id` column).
 */
const DEFAULT_KASM_IMAGE = 'kasmweb/chrome:1.16.0';

export const DEFAULT_RBI_POLICIES: RbiPolicy[] = [
  {
    id: 'isolate-anonymizers',
    name: 'Isolate anonymizers and Tor gateways',
    description:
      'Tor2Web, public proxies, and tunnel services frequently host phishing kits and credential harvesters.',
    urlPatterns: [
      '*.tor2web.io',
      '*.onion.ws',
      '*.onion.pet',
      '*.onion.ly',
      '*.cyberghost.com',
      '*.proxysite.com',
      '*.hide.me',
    ],
    action: 'isolate',
    kasmImageId: DEFAULT_KASM_IMAGE,
    durationSeconds: 1800,
    priority: 10,
  },
  {
    id: 'isolate-newly-registered',
    name: 'Isolate newly registered domains',
    description:
      'Domains <30 days old are statistically dominant in active phishing campaigns. We isolate by default.',
    // The matcher tags newly-registered hosts via the `nrd:` synthetic prefix
    // (set by upstream enrichment); listed here so routing is explicit.
    urlPatterns: ['nrd:*'],
    action: 'isolate',
    kasmImageId: DEFAULT_KASM_IMAGE,
    durationSeconds: 1200,
    priority: 20,
  },
  {
    id: 'block-executable-downloads',
    name: 'Block direct executable downloads',
    description:
      'Direct .exe/.msi/.scr/.dmg downloads from non-allowlisted hosts are refused outright.',
    urlPatterns: [
      '*.exe',
      '*.msi',
      '*.scr',
      '*.bat',
      '*.dmg',
      '*.pkg',
      '*.apk',
    ],
    action: 'block',
    kasmImageId: '',
    durationSeconds: 0,
    priority: 30,
  },
  {
    id: 'isolate-known-malware-categories',
    name: 'Isolate URLs flagged by threat feeds',
    description:
      'Hosts marked malicious by URLhaus/OpenPhish are isolated rather than allowed; users keep working without blast-radius.',
    urlPatterns: ['threat:*'],
    action: 'isolate',
    kasmImageId: DEFAULT_KASM_IMAGE,
    durationSeconds: 900,
    priority: 40,
  },
  {
    id: 'allow-default',
    name: 'Allow everything else',
    description:
      'Pass-through default. Operators can flip to "isolate" globally to enable always-on RBI.',
    urlPatterns: ['*'],
    action: 'allow',
    kasmImageId: '',
    durationSeconds: 0,
    priority: 1000,
  },
];

export function getPolicyById(id: string, list: RbiPolicy[] = DEFAULT_RBI_POLICIES): RbiPolicy | undefined {
  return list.find((p) => p.id === id);
}

/**
 * Validate a policy list — used in tests and in the API ingest path so
 * malformed operator-supplied policies are rejected before they hit the matcher.
 * Returns issue strings; empty array means valid.
 */
export function validatePolicies(list: RbiPolicy[]): string[] {
  const issues: string[] = [];
  const seen = new Set<string>();
  for (const p of list) {
    if (!p.id || !/^[a-z][a-z0-9-]*$/.test(p.id)) issues.push(`bad id: ${p.id}`);
    if (seen.has(p.id)) issues.push(`duplicate id: ${p.id}`);
    seen.add(p.id);
    if (!p.name) issues.push(`${p.id}: name required`);
    if (!Array.isArray(p.urlPatterns) || p.urlPatterns.length === 0) {
      issues.push(`${p.id}: urlPatterns must be non-empty`);
    }
    if (!['isolate', 'block', 'allow'].includes(p.action)) {
      issues.push(`${p.id}: invalid action`);
    }
    if (p.action === 'isolate' && !p.kasmImageId) {
      issues.push(`${p.id}: isolate action requires kasmImageId`);
    }
    if (p.action === 'isolate' && p.durationSeconds <= 0) {
      issues.push(`${p.id}: isolate action requires positive durationSeconds`);
    }
  }
  return issues;
}
