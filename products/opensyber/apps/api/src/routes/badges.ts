import { Hono } from 'hono';
import { eq, desc } from 'drizzle-orm';
import { securityScoreHistory } from '@opensyber/db';
import type { Env, Variables } from '../types.js';
import { dbMiddleware } from '../middleware/db.js';

const badgeRoutes = new Hono<{ Bindings: Env; Variables: Variables }>();

badgeRoutes.use('*', dbMiddleware);

// GET /:instanceId/security-score — Returns SVG badge
badgeRoutes.get('/:instanceId/security-score', async (c) => {
  const instanceId = c.req.param('instanceId');
  const db = c.get('db');

  const [latest] = await db
    .select()
    .from(securityScoreHistory)
    .where(eq(securityScoreHistory.instanceId, instanceId))
    .orderBy(desc(securityScoreHistory.recordedAt))
    .limit(1);

  const score = latest?.overall ?? 0;
  const color = score >= 80 ? '#22c55e' : score >= 50 ? '#eab308' : '#ef4444';
  const scoreText = latest ? `${score}/100` : 'N/A';

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="210" height="20" role="img" aria-label="OpenSyber Security: ${scoreText}">
  <title>OpenSyber Security: ${scoreText}</title>
  <linearGradient id="s" x2="0" y2="100%"><stop offset="0" stop-color="#bbb" stop-opacity=".1"/><stop offset="1" stop-opacity=".1"/></linearGradient>
  <clipPath id="r"><rect width="210" height="20" rx="3" fill="#fff"/></clipPath>
  <g clip-path="url(#r)">
    <rect width="140" height="20" fill="#555"/>
    <rect x="140" width="70" height="20" fill="${color}"/>
    <rect width="210" height="20" fill="url(#s)"/>
  </g>
  <g fill="#fff" text-anchor="middle" font-family="Verdana,Geneva,DejaVu Sans,sans-serif" text-rendering="geometricPrecision" font-size="11">
    <text x="70" y="14">OpenSyber Security</text>
    <text x="175" y="14">${scoreText}</text>
  </g>
</svg>`;

  c.header('Content-Type', 'image/svg+xml');
  c.header('Cache-Control', 'public, max-age=300');
  return c.body(svg);
});

// GET /:instanceId/security-score.json — Returns shields.io-compatible JSON
badgeRoutes.get('/:instanceId/security-score.json', async (c) => {
  const instanceId = c.req.param('instanceId');
  const db = c.get('db');

  const [latest] = await db
    .select()
    .from(securityScoreHistory)
    .where(eq(securityScoreHistory.instanceId, instanceId))
    .orderBy(desc(securityScoreHistory.recordedAt))
    .limit(1);

  const score = latest?.overall ?? 0;
  const color = score >= 80 ? 'green' : score >= 50 ? 'yellow' : 'red';

  c.header('Cache-Control', 'public, max-age=300');
  return c.json({
    schemaVersion: 1,
    label: 'OpenSyber Security',
    message: latest ? `${score}/100` : 'N/A',
    color,
  });
});

export { badgeRoutes };
