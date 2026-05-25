export const PROTECT_CONFIGS: Record<string, string> = {
  express: `// OpenSyber security config for Express
import { tokenForge } from '@opensyber/tokenforge/server';
import { expressAdapter } from '@opensyber/tokenforge/adapters/express';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';

const tf = tokenForge({ secret: process.env.TF_SECRET });

// Mount TokenForge device binding
app.use('/tokenforge', expressAdapter(tf));

// Security headers
app.use(helmet());

// Rate limiting
app.use(rateLimit({ windowMs: 15 * 60 * 1000, max: 100 }));

// Protect API routes with device verification
app.use('/api', tf.verify());`,

  hono: `// OpenSyber security config for Hono
import { tokenForge } from '@opensyber/tokenforge/server';
import { honoAdapter } from '@opensyber/tokenforge/adapters/hono';
import { secureHeaders } from 'hono/secure-headers';
import { rateLimiter } from 'hono-rate-limiter';

const tf = tokenForge({ secret: c.env.TF_SECRET });

app.route('/tokenforge', honoAdapter(tf));
app.use('*', secureHeaders());
app.use('/api/*', tf.verify());`,

  nextjs: `// OpenSyber security config for Next.js
// app/api/tokenforge/route.ts
import { tokenForge } from '@opensyber/tokenforge/server';
import { nextAdapter } from '@opensyber/tokenforge/adapters/nextjs';

const tf = tokenForge({ secret: process.env.TF_SECRET! });
export const { GET, POST } = nextAdapter(tf);

// middleware.ts — add to your existing middleware
import { NextResponse } from 'next/server';
export function middleware(request) {
  const headers = new NextResponse();
  headers.headers.set('X-Content-Type-Options', 'nosniff');
  headers.headers.set('X-Frame-Options', 'DENY');
  return headers;
}`,

  fastify: `// OpenSyber security config for Fastify
import { tokenForge } from '@opensyber/tokenforge/server';
import { fastifyAdapter } from '@opensyber/tokenforge/adapters/fastify';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';

const tf = tokenForge({ secret: process.env.TF_SECRET });

await app.register(helmet);
await app.register(rateLimit, { max: 100, timeWindow: '15m' });
app.register(fastifyAdapter(tf), { prefix: '/tokenforge' });
app.addHook('preHandler', tf.verify());`,
}
