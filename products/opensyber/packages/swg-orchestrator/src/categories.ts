/**
 * Secure Web Gateway URL block category catalog.
 *
 * Categories map 1:1 to e2guardian content-list groups and to public
 * Squidguard-format blacklists (Shalla / blackweb mirror). The `id` is
 * the canonical key used in DB rows, route payloads, and config files.
 *
 * Risk score is a 0..100 ordinal — 100 is unconditionally blocked
 * everywhere (malware, phishing); lower categories are typically opt-in
 * by org policy. Used by the dashboard to colour the policy editor.
 *
 * The `shallaPath` is the directory path inside the Shalla / blackweb
 * tarball where the category's `domains` file lives. We keep these as
 * data so the blocklist-builder can fetch them generically.
 */

export interface SwgCategory {
  /** Canonical id — DNS-safe, lowercase, hyphenated. */
  id: string;
  /** Short human label for the dashboard. */
  name: string;
  /** One-line description shown next to the toggle. */
  description: string;
  /** 0..100, monotonically meaningful for sorting. */
  riskScore: number;
  /**
   * Path inside the Shalla blacklist tar (and the blackweb mirror) where
   * this category's `domains` file lives, relative to the BL/ root.
   * Source: http://www.shallalist.de/Downloads/shallalist.tar.gz
   * Mirror: https://github.com/maravento/blackweb
   */
  shallaPath: string;
  /**
   * When true, this category is enforced even on the lowest "minimal"
   * policy preset — operators cannot disable it without contract override.
   */
  alwaysOn: boolean;
}

export const SWG_CATEGORIES: SwgCategory[] = [
  {
    id: 'malware',
    name: 'Malware',
    description: 'Domains hosting malware payloads, droppers, or C2 servers.',
    riskScore: 100,
    shallaPath: 'malware/domains',
    alwaysOn: true,
  },
  {
    id: 'phishing',
    name: 'Phishing',
    description: 'Credential-harvesting and brand-impersonation sites.',
    riskScore: 100,
    // Shalla bundles phishing under the broader "spyware" set; community
    // mirrors expose a dedicated phishing/ subtree we prefer when present.
    shallaPath: 'spyware/domains',
    alwaysOn: true,
  },
  {
    id: 'gambling',
    name: 'Gambling',
    description: 'Online casinos, sportsbooks, and betting sites.',
    riskScore: 60,
    shallaPath: 'gamble/domains',
    alwaysOn: false,
  },
  {
    id: 'adult',
    name: 'Adult Content',
    description: 'Pornography and other adult-only material.',
    riskScore: 70,
    shallaPath: 'porn/domains',
    alwaysOn: false,
  },
  {
    id: 'social-media',
    name: 'Social Media',
    description: 'Major social networks (Facebook, X, Instagram, TikTok…).',
    riskScore: 30,
    shallaPath: 'socialnet/domains',
    alwaysOn: false,
  },
  {
    id: 'file-sharing',
    name: 'File Sharing',
    description: 'P2P, torrents, warez, and file-locker services.',
    riskScore: 65,
    shallaPath: 'warez/domains',
    alwaysOn: false,
  },
  {
    id: 'anonymizers',
    name: 'Anonymizers',
    description: 'Anonymous proxies, VPN gateways, and Tor portals.',
    riskScore: 80,
    shallaPath: 'anonvpn/domains',
    alwaysOn: false,
  },
  {
    id: 'cryptocurrency-mining',
    name: 'Cryptocurrency Mining',
    description: 'Browser cryptojacking pools and mining-pool endpoints.',
    riskScore: 90,
    // Shalla doesn't ship a dedicated crypto-mining list; the blackweb
    // mirror exposes `cryptomining/domains` derived from CoinBlockerLists.
    shallaPath: 'cryptomining/domains',
    alwaysOn: true,
  },
];

/** Look up a category by id. Returns undefined for unknown ids. */
export function getCategory(id: string): SwgCategory | undefined {
  return SWG_CATEGORIES.find((c) => c.id === id);
}

/** Categories that must be enforced regardless of operator selection. */
export function alwaysOnCategories(): SwgCategory[] {
  return SWG_CATEGORIES.filter((c) => c.alwaysOn);
}

/**
 * Validate a list of category ids supplied by an API caller.
 *
 * Returns the canonical sorted unique list of known ids, plus any
 * unknown ids the caller supplied so the route can surface an error.
 */
export function normaliseCategoryIds(
  ids: readonly string[],
): { known: string[]; unknown: string[] } {
  const known: string[] = [];
  const unknown: string[] = [];
  const seen = new Set<string>();
  for (const raw of ids) {
    const id = raw.trim().toLowerCase();
    if (!id || seen.has(id)) continue;
    seen.add(id);
    if (getCategory(id)) known.push(id);
    else unknown.push(id);
  }
  known.sort();
  unknown.sort();
  return { known, unknown };
}
