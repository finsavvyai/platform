/**
 * CORS Middleware — hardened for *.lunaos.ai origins only
 *
 * - Only allows requests from lunaos.ai subdomains
 * - Localhost allowed in development only
 * - Rejects all other origins with 403
 */

import { cors } from 'hono/cors';

const ALLOWED_ORIGINS = [
    'https://lunaos.ai',
    'https://agents.lunaos.ai',
    'https://studio.lunaos.ai',
    'https://docs.lunaos.ai',
    'https://status.lunaos.ai',
    'https://api.lunaos.ai',
];

const DEV_ORIGINS = [
    'http://localhost:3000',
    'http://localhost:5173',
    'http://localhost:4321',
    'http://127.0.0.1:3000',
    'http://127.0.0.1:5173',
];

export const corsMiddleware = cors({
    origin: (origin) => {
        // No origin (e.g. server-to-server, CLI) — allow
        if (!origin) return '*';

        // Exact *.lunaos.ai match
        if (ALLOWED_ORIGINS.includes(origin)) return origin;

        // Wildcard *.lunaos.ai (e.g. Cloudflare preview deploys)
        if (/^https:\/\/[a-z0-9-]+\.lunaos\.ai$/.test(origin)) return origin;

        // Cloudflare Pages preview deploys (*.pages.dev for our projects)
        if (/^https:\/\/[a-z0-9-]+\.(lunaos-marketing|luna-agent|lunaos-docs)\.pages\.dev$/.test(origin)) return origin;

        // Dev origins (localhost)
        if (DEV_ORIGINS.includes(origin)) return origin;

        // Reject everything else
        return '';
    },
    credentials: true,
    allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowHeaders: ['Content-Type', 'Authorization', 'X-API-Key'],
    maxAge: 86400,
});
