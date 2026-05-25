/**
 * Infer the best `RegionId` for a new user with zero friction.
 *
 * Signals (highest confidence first):
 *  1. IANA timezone — most reliable, set by OS.
 *  2. `Accept-Language` locale country code (e.g. "en-DE" → Germany).
 *  3. Default to `eu-central` (GDPR-safe, our HQ region).
 *
 * Pure function. Tested in `region.test.ts`. No network calls — IP geolocation
 * lives upstream (Cloudflare `request.cf.country`) and is passed in via the
 * `country_hint` arg when available.
 */

import type { RegionId } from '@opensyber/shared';

/** IANA TZ prefix → region. Order matters; first match wins. */
const TZ_PREFIX_TO_REGION: ReadonlyArray<readonly [string, RegionId]> = [
  ['Europe/', 'eu-central'],
  ['Africa/', 'eu-central'],
  ['America/Argentina', 'us-east'],
  ['America/Sao_Paulo', 'us-east'],
  ['America/New_York', 'us-east'],
  ['America/Toronto', 'us-east'],
  ['America/Chicago', 'us-east'],
  ['America/Denver', 'us-west'],
  ['America/Los_Angeles', 'us-west'],
  ['America/Vancouver', 'us-west'],
  ['America/', 'us-east'],
  ['Asia/Tokyo', 'ap-southeast'],
  ['Asia/Singapore', 'ap-southeast'],
  ['Asia/Hong_Kong', 'ap-southeast'],
  ['Asia/Shanghai', 'ap-southeast'],
  ['Asia/Seoul', 'ap-southeast'],
  ['Asia/Kolkata', 'ap-southeast'],
  ['Asia/', 'eu-central'],
  ['Australia/', 'ap-southeast'],
  ['Pacific/', 'ap-southeast'],
];

/** ISO-3166 country codes that map outside the timezone heuristic. */
const COUNTRY_TO_REGION: Readonly<Record<string, RegionId>> = {
  US: 'us-east',
  CA: 'us-east',
  MX: 'us-east',
  BR: 'us-east',
  GB: 'eu-central',
  DE: 'eu-central',
  FR: 'eu-central',
  IL: 'eu-central',
  JP: 'ap-southeast',
  SG: 'ap-southeast',
  AU: 'ap-southeast',
  IN: 'ap-southeast',
};

export interface InferRegionInput {
  /** IANA TZ (e.g. "Europe/Berlin"). Usually `Intl.DateTimeFormat().resolvedOptions().timeZone`. */
  timezone?: string;
  /** BCP-47 tag (e.g. "en-US"). */
  locale?: string;
  /** ISO-3166-alpha-2 from CDN (Cloudflare `request.cf.country`). */
  country_hint?: string;
}

const DEFAULT_REGION: RegionId = 'eu-central';

export function inferRegion(input: InferRegionInput): RegionId {
  if (input.country_hint) {
    const upper = input.country_hint.toUpperCase();
    const byCountry = COUNTRY_TO_REGION[upper];
    if (byCountry) return byCountry;
  }
  if (input.timezone) {
    for (const [prefix, region] of TZ_PREFIX_TO_REGION) {
      if (input.timezone.startsWith(prefix)) return region;
    }
  }
  if (input.locale) {
    const parts = input.locale.split('-');
    const country = parts[1]?.toUpperCase();
    if (country && COUNTRY_TO_REGION[country]) return COUNTRY_TO_REGION[country];
  }
  return DEFAULT_REGION;
}
