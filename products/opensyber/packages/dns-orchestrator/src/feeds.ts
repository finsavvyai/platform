/**
 * DNS threat feed catalog.
 *
 * Each feed is a public source of malicious domain indicators. The
 * orchestrator pulls these on `refresh_interval_seconds`, parses with
 * `feed-parser.ts`, and writes the merged set into a per-tenant RPZ zone.
 *
 * Format identifiers:
 *   - 'hosts'        : hosts(5) format — `0.0.0.0 evil.example.com`
 *   - 'domain-list'  : one fully-qualified domain per line
 *   - 'urls'         : one URL per line (we extract hostname)
 *   - 'phishtank-csv': PhishTank CSV (column 2 = url)
 *   - 'spamhaus-zone': Spamhaus DBL bind-zone format (rname IN A 127.0.1.x)
 *
 * IMPORTANT: licensing/attribution is per-feed. Tenants must comply with
 * each feed's terms; we surface attribution via the RPZ zone SOA comment.
 */

export type FeedFormat =
  | 'hosts'
  | 'domain-list'
  | 'urls'
  | 'phishtank-csv'
  | 'spamhaus-zone';

export interface FeedSource {
  /** Stable identifier used in RPZ comments and DB rows. */
  id: string;
  /** Human-readable name. */
  name: string;
  /** HTTPS URL the orchestrator GETs. */
  url: string;
  /** Parser format (see FeedFormat). */
  format: FeedFormat;
  /** When false, fetcher skips this feed. */
  enabled: boolean;
  /** How often to refresh (seconds). */
  refresh_interval_seconds: number;
  /** License/attribution string — reproduced in RPZ zone SOA comment. */
  attribution: string;
  /** Whether the feed requires registration / API key. */
  requires_auth?: boolean;
}

export const FEEDS: FeedSource[] = [
  {
    // URLhaus (abuse.ch) — free, no auth, CC0 licence on the data feed.
    // Hosts file format, refreshed every ~5 min upstream.
    // https://urlhaus.abuse.ch/api/#hostfile
    id: 'urlhaus-domains',
    name: 'URLhaus (abuse.ch) — hosts',
    url: 'https://urlhaus.abuse.ch/downloads/hostfile/',
    format: 'hosts',
    enabled: true,
    refresh_interval_seconds: 900,
    attribution: 'URLhaus by abuse.ch — CC0 (https://urlhaus.abuse.ch/api/)',
  },
  {
    // OpenPhish — Community feed (free, plain URL list, refreshed every ~12h).
    // Free tier is a single text file of newly observed phishing URLs.
    // https://openphish.com/feed.txt
    id: 'openphish',
    name: 'OpenPhish Community Feed',
    url: 'https://openphish.com/feed.txt',
    format: 'urls',
    enabled: true,
    refresh_interval_seconds: 43200,
    attribution:
      'OpenPhish Community Feed — free non-commercial use (https://openphish.com/phishing_feeds.html)',
  },
  {
    // PhishTank — free with registration (api_key required for higher rate).
    // Public CSV mirror of online-valid phishes.
    // https://www.phishtank.com/developer_info.php
    id: 'phishtank',
    name: 'PhishTank online-valid',
    url: 'https://data.phishtank.com/data/online-valid.csv',
    format: 'phishtank-csv',
    enabled: true,
    refresh_interval_seconds: 3600,
    attribution:
      'PhishTank by Cisco Talos — free with attribution (https://www.phishtank.com/terms_of_use.php)',
    requires_auth: false,
  },
  {
    // AlphaSOC public C2 / threat feed mirror on GitHub.
    // Plain domain list, MIT-style permissive licence on repo.
    // https://github.com/alphasoc/public-feeds
    id: 'alphasoc-public',
    name: 'AlphaSOC public C2 feed',
    url: 'https://raw.githubusercontent.com/alphasoc/public-feeds/master/c2.txt',
    format: 'domain-list',
    enabled: true,
    refresh_interval_seconds: 21600,
    attribution:
      'AlphaSOC Public Feeds — see repo LICENSE (https://github.com/alphasoc/public-feeds)',
  },
  {
    // Spamhaus DBL — bulk zone download requires a Spamhaus DQS / data feed
    // contract. We register the source so operators can plug in a key, but
    // ship it disabled by default (HTTP fetch will 401/403 without auth).
    // https://www.spamhaus.org/zen/
    id: 'spamhaus-dbl',
    name: 'Spamhaus DBL (zone file)',
    url: 'https://www.spamhaus.org/dbl/',
    format: 'spamhaus-zone',
    enabled: false,
    refresh_interval_seconds: 1800,
    attribution:
      'Spamhaus DBL — commercial / DQS terms (https://www.spamhaus.org/organization/dnsblusage/)',
    requires_auth: true,
  },
];

/** Look up a feed by id; returns undefined if unknown. */
export function getFeed(id: string): FeedSource | undefined {
  return FEEDS.find((f) => f.id === id);
}

/** Enabled feeds only — what the fetcher should actually pull. */
export function enabledFeeds(): FeedSource[] {
  return FEEDS.filter((f) => f.enabled);
}
