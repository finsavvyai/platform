export const TRUST_ATTRIBUTION_STORAGE_KEY = 'opensyber:trust-attribution';

export type TrustTrackEventName =
  | 'trust_page_view'
  | 'trust_pricing_view'
  | 'trust_enterprise_view'
  | 'trust_enterprise_submit'
  | 'trust_sign_up_view'
  | 'trust_open_scorecard'
  | 'trust_start_trial'
  | 'trust_book_demo'
  | 'trust_share_copy'
  | 'trust_share_x'
  | 'trust_share_linkedin';

export interface TrustAttribution {
  sessionId: string;
  source: string | null;
  medium: string | null;
  campaign: string | null;
  ref: string | null;
  referrerHost: string | null;
  landingPath: string;
  firstSeenAt: string;
}

export interface TrustTrackPayload {
  event: TrustTrackEventName;
  instanceId: string | null;
  instanceName?: string | null;
  score?: number | null;
  grade?: string | null;
  path: string;
  occurredAt: string;
  attribution: TrustAttribution;
}

export interface TrustQueryContext {
  instanceId: string | null;
  event: string | null;
  attribution: TrustAttribution;
}

function normalizeValue(value: string | null | undefined): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return trimmed.slice(0, 120);
}

export function extractReferrerHost(referrer: string | null | undefined): string | null {
  if (!referrer) return null;
  try {
    return new URL(referrer).host || null;
  } catch {
    return null;
  }
}

export function createTrustAttribution(input: {
  searchParams: URLSearchParams;
  pathname: string;
  referrer?: string | null;
  existing?: Partial<TrustAttribution> | null;
  now?: string;
  sessionId?: string;
}): TrustAttribution {
  const { searchParams, pathname, referrer, existing, now, sessionId } = input;
  const firstSeenAt = existing?.firstSeenAt ?? now ?? new Date().toISOString();
  const referrerHost = extractReferrerHost(referrer) ?? existing?.referrerHost ?? null;
  const source = normalizeValue(searchParams.get('utm_source'))
    ?? normalizeValue(searchParams.get('source'))
    ?? existing?.source
    ?? referrerHost
    ?? null;

  return {
    sessionId: existing?.sessionId ?? sessionId ?? `trust_${Math.random().toString(36).slice(2, 10)}`,
    source,
    medium: normalizeValue(searchParams.get('utm_medium')) ?? existing?.medium ?? (source ? 'trust-page' : null),
    campaign: normalizeValue(searchParams.get('utm_campaign')) ?? existing?.campaign ?? null,
    ref: normalizeValue(searchParams.get('ref')) ?? existing?.ref ?? null,
    referrerHost,
    landingPath: existing?.landingPath ?? pathname,
    firstSeenAt,
  };
}

export function readTrustQueryContext(searchParams: URLSearchParams, now?: string): TrustQueryContext | null {
  const sessionId = normalizeValue(searchParams.get('trust_session'));
  if (!sessionId) return null;

  const instanceId = normalizeValue(searchParams.get('trust_instance'));

  return {
    instanceId,
    event: normalizeValue(searchParams.get('trust_event')),
    attribution: {
      sessionId,
      source: normalizeValue(searchParams.get('trust_source')),
      medium: normalizeValue(searchParams.get('trust_medium')),
      campaign: normalizeValue(searchParams.get('trust_campaign')),
      ref: normalizeValue(searchParams.get('trust_ref')),
      referrerHost: normalizeValue(searchParams.get('trust_referrer')),
      landingPath: normalizeValue(searchParams.get('trust_landing')) ?? (instanceId ? `/trust/${instanceId}` : '/trust'),
      firstSeenAt: normalizeValue(searchParams.get('trust_first_seen_at')) ?? now ?? new Date().toISOString(),
    },
  };
}

export function toUrlSearchParams(params: Record<string, string | string[] | undefined>): URLSearchParams {
  const searchParams = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (Array.isArray(value)) {
      for (const item of value) searchParams.append(key, item);
      continue;
    }

    if (typeof value === 'string') searchParams.set(key, value);
  }
  return searchParams;
}

export function appendTrustQuery(basePath: string, context: TrustQueryContext | null): string {
  if (!context) return basePath;

  const url = new URL(basePath, 'https://opensyber.cloud');
  url.searchParams.set('via', 'trust-page');
  url.searchParams.set('trust_session', context.attribution.sessionId);

  if (context.event) url.searchParams.set('trust_event', context.event);
  if (context.instanceId) url.searchParams.set('trust_instance', context.instanceId);
  if (context.attribution.source) url.searchParams.set('trust_source', context.attribution.source);
  if (context.attribution.medium) url.searchParams.set('trust_medium', context.attribution.medium);
  if (context.attribution.campaign) url.searchParams.set('trust_campaign', context.attribution.campaign);
  if (context.attribution.ref) url.searchParams.set('trust_ref', context.attribution.ref);
  if (context.attribution.referrerHost) url.searchParams.set('trust_referrer', context.attribution.referrerHost);
  if (context.attribution.landingPath) url.searchParams.set('trust_landing', context.attribution.landingPath);
  if (context.attribution.firstSeenAt) url.searchParams.set('trust_first_seen_at', context.attribution.firstSeenAt);

  return `${url.pathname}${url.search}`;
}

export function buildTrustReferralNote(context: TrustQueryContext): string {
  const details = [
    context.instanceId ? `instance=${context.instanceId}` : null,
    context.event ? `event=${context.event}` : null,
    context.attribution.source ? `source=${context.attribution.source}` : null,
    context.attribution.medium ? `medium=${context.attribution.medium}` : null,
    context.attribution.campaign ? `campaign=${context.attribution.campaign}` : null,
    context.attribution.ref ? `ref=${context.attribution.ref}` : null,
    context.attribution.referrerHost ? `referrer=${context.attribution.referrerHost}` : null,
    `first_seen=${context.attribution.firstSeenAt}`,
  ].filter(Boolean);

  return `[OpenSyber trust referral] ${details.join(' | ')}`;
}

export function buildTrackedHref(basePath: string, event: Exclude<TrustTrackEventName, 'trust_page_view'>, instanceId: string, attribution: TrustAttribution): string {
  return appendTrustQuery(basePath, {
    instanceId,
    event,
    attribution,
  });
}

export function buildTrustTrackPayload(input: {
  event: TrustTrackEventName;
  instanceId: string | null;
  instanceName?: string | null;
  score?: number | null;
  grade?: string | null;
  path: string;
  attribution: TrustAttribution;
  occurredAt?: string;
}): TrustTrackPayload {
  return {
    event: input.event,
    instanceId: input.instanceId,
    instanceName: input.instanceName,
    score: input.score,
    grade: input.grade,
    path: input.path,
    occurredAt: input.occurredAt ?? new Date().toISOString(),
    attribution: input.attribution,
  };
}
