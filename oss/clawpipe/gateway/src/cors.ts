/** CORS + security headers for all gateway responses. */

import { GATEWAY_VERSION } from './version';

const ALLOWED_ORIGINS = new Set([
  'https://clawpipe.ai',
  'https://www.clawpipe.ai',
  'https://app.clawpipe.ai',
  'https://docs.clawpipe.ai',
  'https://calc.clawpipe.ai',
  'http://localhost:3000',
  'http://localhost:5173',
  'http://localhost:8787',
]);

export function corsResponse(response: Response, origin?: string | null): Response {
  const headers = new Headers(response.headers);
  if (origin && ALLOWED_ORIGINS.has(origin)) {
    headers.set('Access-Control-Allow-Origin', origin);
    headers.set('Access-Control-Allow-Credentials', 'true');
    headers.set('Vary', 'Origin');
  } else {
    headers.set('Access-Control-Allow-Origin', '*');
  }
  headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Project-Id');
  headers.set('Access-Control-Max-Age', '86400');
  headers.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  headers.set('X-Content-Type-Options', 'nosniff');
  headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  // Self-boosting attribution headers — every response, every tier.
  headers.set('X-Powered-By', 'ClawPipe (https://clawpipe.ai)');
  headers.set('X-ClawPipe-Version', GATEWAY_VERSION);
  return new Response(response.body, { status: response.status, headers });
}
