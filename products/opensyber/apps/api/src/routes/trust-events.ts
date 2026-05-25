import { Hono } from 'hono';
import { generateId } from '@opensyber/shared';
import { trustFunnelEvents } from '@opensyber/db';
import type { Env, Variables } from '../types.js';
import { dbMiddleware } from '../middleware/db.js';
import { rateLimitMiddleware } from '../middleware/rate-limit.js';

const TRUST_EVENT_NAMES = new Set([
  'trust_page_view',
  'trust_pricing_view',
  'trust_enterprise_view',
  'trust_enterprise_submit',
  'trust_sign_up_view',
  'trust_open_scorecard',
  'trust_start_trial',
  'trust_book_demo',
  'trust_share_copy',
  'trust_share_x',
  'trust_share_linkedin',
]);

interface TrustTrackPayload {
  event?: unknown;
  instanceId?: unknown;
  instanceName?: unknown;
  score?: unknown;
  grade?: unknown;
  path?: unknown;
  occurredAt?: unknown;
  attribution?: {
    sessionId?: unknown;
    source?: unknown;
    medium?: unknown;
    campaign?: unknown;
    ref?: unknown;
    referrerHost?: unknown;
    landingPath?: unknown;
    firstSeenAt?: unknown;
  } | null;
}

const trustEventRoutes = new Hono<{ Bindings: Env; Variables: Variables }>();

trustEventRoutes.use('*', dbMiddleware, rateLimitMiddleware('public'));

trustEventRoutes.post('/events', async (c) => {
  const db = c.get('db');
  const body = await c.req.json<TrustTrackPayload>();
  const validationError = validatePayload(body);

  if (validationError) {
    return c.json({ error: 'Bad request', message: validationError }, 400);
  }

  const attr = body.attribution!;

  const event = {
    id: generateId(),
    event: body.event as string,
    instanceId: toNullableText(body.instanceId),
    instanceName: toNullableText(body.instanceName),
    score: typeof body.score === 'number' ? Math.round(body.score) : null,
    grade: toNullableText(body.grade),
    path: body.path as string,
    occurredAt: body.occurredAt as string,
    sessionId: attr.sessionId as string,
    source: toNullableText(attr.source),
    medium: toNullableText(attr.medium),
    campaign: toNullableText(attr.campaign),
    ref: toNullableText(attr.ref),
    referrerHost: toNullableText(attr.referrerHost),
    landingPath: toNullableText(attr.landingPath),
    firstSeenAt: toNullableText(attr.firstSeenAt),
    userAgent: truncate(c.req.header('user-agent') ?? null, 300),
    countryCode: truncate(c.req.header('cf-ipcountry') ?? null, 8),
  };

  await db.insert(trustFunnelEvents).values(event);

  return c.json({ data: { id: event.id } }, 202);
});

function validatePayload(body: TrustTrackPayload): string | null {
  if (!TRUST_EVENT_NAMES.has(toNullableText(body.event) ?? '')) {
    return 'Invalid trust event';
  }

  if (!toNullableText(body.path)) {
    return 'path is required';
  }

  if (!toNullableText(body.occurredAt)) {
    return 'occurredAt is required';
  }

  if (!body.attribution || !toNullableText(body.attribution.sessionId)) {
    return 'attribution.sessionId is required';
  }

  if (typeof body.score !== 'undefined' && body.score !== null) {
    if (typeof body.score !== 'number' || Number.isNaN(body.score) || body.score < 0 || body.score > 100) {
      return 'score must be between 0 and 100';
    }
  }

  const lengths: Array<[unknown, number, string]> = [
    [body.instanceId, 120, 'instanceId'],
    [body.instanceName, 200, 'instanceName'],
    [body.grade, 16, 'grade'],
    [body.path, 300, 'path'],
    [body.occurredAt, 80, 'occurredAt'],
    [body.attribution?.sessionId, 120, 'attribution.sessionId'],
    [body.attribution?.source, 120, 'attribution.source'],
    [body.attribution?.medium, 120, 'attribution.medium'],
    [body.attribution?.campaign, 120, 'attribution.campaign'],
    [body.attribution?.ref, 120, 'attribution.ref'],
    [body.attribution?.referrerHost, 200, 'attribution.referrerHost'],
    [body.attribution?.landingPath, 300, 'attribution.landingPath'],
    [body.attribution?.firstSeenAt, 80, 'attribution.firstSeenAt'],
  ];

  for (const [value, maxLength, field] of lengths) {
    if (typeof value === 'string' && value.trim().length > maxLength) {
      return `${field} exceeds maximum length`;
    }
  }

  return null;
}

function toNullableText(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function truncate(value: string | null, maxLength: number): string | null {
  if (!value) return null;
  return value.slice(0, maxLength);
}

export { trustEventRoutes };
