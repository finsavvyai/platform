/**
 * Framework Security Configuration Snippets
 *
 * Code templates for integrating OpenSyber + TokenForge security
 * into popular web frameworks.
 */

/** @returns Config map keyed by framework name */
export function getProtectConfigs(): Record<string, string> {
  return {
    hono: `import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { secureHeaders } from 'hono/secure-headers';
import { rateLimiter } from 'hono/rate-limiter';
import { TokenForge } from '@opensyber/tokenforge/adapters/hono';

const app = new Hono();

// Security headers (CSP, X-Frame-Options, etc.)
app.use('*', secureHeaders());

// CORS — restrict to your domains
app.use('*', cors({ origin: ['https://yourdomain.com'], credentials: true }));

// Rate limiting — 100 req/min per IP
app.use('*', rateLimiter({ windowMs: 60_000, limit: 100 }));

// TokenForge device-bound session verification
app.use('/api/*', TokenForge.middleware({ apiKey: process.env.TOKENFORGE_API_KEY }));`,

    express: `import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import { TokenForge } from '@opensyber/tokenforge/adapters/express';

const app = express();

// Security headers
app.use(helmet({ contentSecurityPolicy: { directives: { defaultSrc: ["'self'"] } } }));

// CORS
app.use(cors({ origin: 'https://yourdomain.com', credentials: true }));

// Rate limiting
app.use(rateLimit({ windowMs: 60_000, max: 100 }));

// TokenForge device-bound sessions
app.use('/api', TokenForge.middleware({ apiKey: process.env.TOKENFORGE_API_KEY }));`,

    nextjs: `// next.config.js
const securityHeaders = [
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Content-Security-Policy', value: "default-src 'self'; script-src 'self'" },
];

module.exports = {
  headers: async () => [{ source: '/(.*)', headers: securityHeaders }],
};

// middleware.ts
import { TokenForge } from '@opensyber/tokenforge/adapters/nextjs';

export const middleware = TokenForge.middleware({
  apiKey: process.env.TOKENFORGE_API_KEY,
  protectedRoutes: ['/api/:path*', '/dashboard/:path*'],
});`,

    fastify: `import Fastify from 'fastify';
import helmet from '@fastify/helmet';
import cors from '@fastify/cors';
import rateLimit from '@fastify/rate-limit';
import { TokenForge } from '@opensyber/tokenforge/adapters/fastify';

const app = Fastify({ logger: true });

// Security headers
await app.register(helmet, { contentSecurityPolicy: { directives: { defaultSrc: ["'self'"] } } });

// CORS
await app.register(cors, { origin: 'https://yourdomain.com', credentials: true });

// Rate limiting
await app.register(rateLimit, { max: 100, timeWindow: '1 minute' });

// TokenForge device-bound sessions
await app.register(TokenForge.plugin, { apiKey: process.env.TOKENFORGE_API_KEY });`,
  };
}

/** @returns Sorted list of supported framework names */
export const SUPPORTED_FRAMEWORKS = ['express', 'fastify', 'hono', 'nextjs'];
