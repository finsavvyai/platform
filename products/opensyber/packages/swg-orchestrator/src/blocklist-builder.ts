/**
 * Blocklist builder — turns a Squidguard-format `domains` file into the
 * sorted, de-duplicated list of hostnames that gets written to
 *   /etc/e2guardian/lists/<category>/domains
 *
 * Canonical sources we support:
 *   - Shalla blacklists (university of Karlsruhe / shalla.de)
 *       http://www.shallalist.de/Downloads/shallalist.tar.gz
 *       Licence: free for non-commercial use; commercial use requires a
 *                Shalla-issued licence. See http://www.shallalist.de/
 *   - blackweb (community-maintained mirror of Shalla + extras)
 *       https://github.com/maravento/blackweb
 *       Licence: MIT on the assembled lists; upstream sources keep their
 *                own licences (see repo README for attribution table).
 *
 * We do NOT bundle the lists with this package — operators fetch them at
 * runtime so they always pick up upstream updates. The orchestrator
 * passes the raw text body of one `domains` file to `parseSquidguardDomains`
 * and writes the parsed result to disk.
 */

import { getCategory, type SwgCategory } from './categories.js';

/** Public Shalla blacklist tarball URL (canonical, no auth required). */
export const SHALLA_TARBALL_URL =
  'http://www.shallalist.de/Downloads/shallalist.tar.gz';

/** Community mirror with additional categories (cryptomining, etc.). */
export const BLACKWEB_REPO_URL = 'https://github.com/maravento/blackweb';

export interface BlocklistSource {
  /** Where this list came from (one of the URLs above, or a local path). */
  origin: string;
  /** Squidguard-format `domains` text body — one host per line. */
  body: string;
}

/**
 * Resolve the on-disk / URL path for a category in a Shalla-shape archive.
 *
 * `archiveBase` is whatever prefix the caller used (e.g. `BL` for the
 * standard Shalla tarball, or the blackweb `category` directory).
 * Returns `<base>/<shallaPath>` so the caller can fetch / read it.
 */
export function categoryListPath(category: SwgCategory, archiveBase: string): string {
  const base = archiveBase.replace(/\/$/, '');
  return `${base}/${category.shallaPath}`;
}

const HOSTNAME_RE =
  /^(?=.{1,253}$)([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,}$/i;

function normalise(host: string): string {
  return host.trim().toLowerCase().replace(/\.$/, '');
}

function isHostname(s: string): boolean {
  return HOSTNAME_RE.test(s);
}

/**
 * Parse a Squidguard `domains` text body.
 *
 * The format is one hostname per line, with `#` introducing a line
 * comment. Squidguard treats each entry as a domain *suffix* match —
 * `example.com` blocks `example.com` and any subdomain. We preserve the
 * raw entry (suffix semantics happen at the e2guardian layer) but
 * validate that it parses as a hostname so we don't ship junk.
 */
export function parseSquidguardDomains(text: string): string[] {
  const seen = new Set<string>();
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.replace(/#.*$/, '').trim();
    if (!line) continue;
    const host = normalise(line);
    if (!isHostname(host)) continue;
    seen.add(host);
  }
  return Array.from(seen).sort((a, b) => a.localeCompare(b));
}

/**
 * Build a single category's blocklist by parsing every supplied source
 * and merging the results. Returns the sorted unique hostname list.
 *
 * The orchestrator typically calls this with a single source (the
 * `domains` file from Shalla or blackweb), but the function accepts an
 * array so we can union multiple feeds for the same category in future.
 */
export function buildCategoryBlocklist(
  categoryId: string,
  sources: readonly BlocklistSource[],
): { category: SwgCategory; domains: string[]; origins: string[] } {
  const category = getCategory(categoryId);
  if (!category) {
    throw new Error(`blocklist-builder: unknown category id "${categoryId}"`);
  }
  if (sources.length === 0) {
    throw new Error('blocklist-builder: at least one source is required');
  }
  const merged = new Set<string>();
  const origins: string[] = [];
  for (const src of sources) {
    origins.push(src.origin);
    for (const d of parseSquidguardDomains(src.body)) merged.add(d);
  }
  const domains = Array.from(merged).sort((a, b) => a.localeCompare(b));
  return { category, domains, origins };
}
