import { auth } from '@/lib/auth';
import { NextResponse } from 'next/server';

const CSP = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://tokenforge-api.opensyber.cloud https://app.lemonsqueezy.com https://challenges.cloudflare.com https://static.cloudflareinsights.com blob:",
  "worker-src 'self' blob:",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self' data:",
  "connect-src 'self' https://tokenforge-api.opensyber.cloud",
  "frame-src https://challenges.cloudflare.com",
  "frame-ancestors 'none'",
].join('; ');

function applySecurityHeaders(res: NextResponse): NextResponse {
  res.headers.set('X-Content-Type-Options', 'nosniff');
  res.headers.set('X-Frame-Options', 'DENY');
  res.headers.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');
  res.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  res.headers.set('Content-Security-Policy', CSP);
  return res;
}

export default auth((req) => {
  const isProtected = req.nextUrl.pathname.startsWith('/dashboard');
  if (isProtected && !req.auth) {
    return applySecurityHeaders(NextResponse.redirect(new URL('/sign-in', req.url)));
  }
  return applySecurityHeaders(NextResponse.next());
});

