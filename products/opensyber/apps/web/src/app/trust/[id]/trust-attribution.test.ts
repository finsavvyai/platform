import { describe, expect, it } from 'vitest';
import {
  appendTrustQuery,
  buildTrackedHref,
  buildTrustReferralNote,
  buildTrustTrackPayload,
  createTrustAttribution,
  extractReferrerHost,
  readTrustQueryContext,
} from './trust-attribution';

describe('trust-attribution', () => {
  it('extracts referrer host safely', () => {
    expect(extractReferrerHost('https://www.linkedin.com/feed/')).toBe('www.linkedin.com');
    expect(extractReferrerHost('not-a-url')).toBeNull();
  });

  it('creates attribution from query params and referrer', () => {
    const attribution = createTrustAttribution({
      searchParams: new URLSearchParams('utm_source=linkedin&utm_campaign=spring_launch&ref=REF-123'),
      pathname: '/trust/inst_1',
      referrer: 'https://www.linkedin.com/feed/',
      sessionId: 'trust_session',
      now: '2026-03-07T12:00:00.000Z',
    });

    expect(attribution).toEqual({
      sessionId: 'trust_session',
      source: 'linkedin',
      medium: 'trust-page',
      campaign: 'spring_launch',
      ref: 'REF-123',
      referrerHost: 'www.linkedin.com',
      landingPath: '/trust/inst_1',
      firstSeenAt: '2026-03-07T12:00:00.000Z',
    });
  });

  it('builds tracked CTA urls', () => {
    const href = buildTrackedHref('/pricing', 'trust_start_trial', 'inst_1', {
      sessionId: 'trust_session',
      source: 'linkedin',
      medium: 'social',
      campaign: 'spring_launch',
      ref: 'REF-123',
      referrerHost: 'www.linkedin.com',
      landingPath: '/trust/inst_1',
      firstSeenAt: '2026-03-07T12:00:00.000Z',
    });

    expect(href).toContain('/pricing?');
    expect(href).toContain('via=trust-page');
    expect(href).toContain('trust_event=trust_start_trial');
    expect(href).toContain('trust_source=linkedin');
    expect(href).toContain('trust_landing=%2Ftrust%2Finst_1');
  });

  it('reads trust query context from tracked urls', () => {
    const context = readTrustQueryContext(new URLSearchParams(
      'via=trust-page&trust_event=trust_start_trial&trust_instance=inst_1&trust_session=trust_session&trust_source=linkedin&trust_medium=social&trust_campaign=spring_launch&trust_ref=REF-123&trust_referrer=www.linkedin.com&trust_landing=%2Ftrust%2Finst_1&trust_first_seen_at=2026-03-07T12%3A00%3A00.000Z',
    ));

    expect(context).toEqual({
      instanceId: 'inst_1',
      event: 'trust_start_trial',
      attribution: {
        sessionId: 'trust_session',
        source: 'linkedin',
        medium: 'social',
        campaign: 'spring_launch',
        ref: 'REF-123',
        referrerHost: 'www.linkedin.com',
        landingPath: '/trust/inst_1',
        firstSeenAt: '2026-03-07T12:00:00.000Z',
      },
    });
  });

  it('preserves trust query params across funnel hops', () => {
    const href = appendTrustQuery('/sign-up', {
      instanceId: 'inst_1',
      event: 'trust_start_trial',
      attribution: {
        sessionId: 'trust_session',
        source: 'linkedin',
        medium: 'social',
        campaign: 'spring_launch',
        ref: 'REF-123',
        referrerHost: 'www.linkedin.com',
        landingPath: '/trust/inst_1',
        firstSeenAt: '2026-03-07T12:00:00.000Z',
      },
    });

    expect(href).toContain('/sign-up?');
    expect(href).toContain('trust_session=trust_session');
    expect(href).toContain('trust_instance=inst_1');
  });

  it('builds structured tracking payloads', () => {
    const payload = buildTrustTrackPayload({
      event: 'trust_book_demo',
      instanceId: 'inst_1',
      instanceName: 'Prod Agent',
      score: 92,
      grade: 'A',
      path: '/trust/inst_1',
      attribution: {
        sessionId: 'trust_session',
        source: 'linkedin',
        medium: 'social',
        campaign: null,
        ref: null,
        referrerHost: 'www.linkedin.com',
        landingPath: '/trust/inst_1',
        firstSeenAt: '2026-03-07T12:00:00.000Z',
      },
      occurredAt: '2026-03-07T12:01:00.000Z',
    });

    expect(payload.event).toBe('trust_book_demo');
    expect(payload.attribution.sessionId).toBe('trust_session');
    expect(payload.score).toBe(92);
  });

  it('builds a sales note from trust context', () => {
    const note = buildTrustReferralNote({
      instanceId: 'inst_1',
      event: 'trust_book_demo',
      attribution: {
        sessionId: 'trust_session',
        source: 'linkedin',
        medium: 'social',
        campaign: 'spring_launch',
        ref: 'REF-123',
        referrerHost: 'www.linkedin.com',
        landingPath: '/trust/inst_1',
        firstSeenAt: '2026-03-07T12:00:00.000Z',
      },
    });

    expect(note).toContain('instance=inst_1');
    expect(note).toContain('event=trust_book_demo');
    expect(note).toContain('source=linkedin');
  });
});
