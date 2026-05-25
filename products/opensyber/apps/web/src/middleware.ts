import { auth } from '@/lib/auth';
import { NextResponse } from 'next/server';

const CSP = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://tokenforge-api.opensyber.cloud https://app.lemonsqueezy.com https://assets.lemonsqueezy.com https://challenges.cloudflare.com https://static.cloudflareinsights.com blob:",
  "worker-src 'self' blob:",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https://api.opensyber.cloud https://assets.lemonsqueezy.com https://lh3.googleusercontent.com https://avatars.githubusercontent.com https://media.licdn.com",
  "font-src 'self' data:",
  "connect-src 'self' https://api.opensyber.cloud https://tokenforge-api.opensyber.cloud https://app.lemonsqueezy.com https://assets.lemonsqueezy.com",
  "frame-src https://challenges.cloudflare.com https://app.lemonsqueezy.com",
  "frame-ancestors 'none'",
].join('; ');

function applySecurityHeaders(res: NextResponse): NextResponse {
  res.headers.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');
  res.headers.set('X-Content-Type-Options', 'nosniff');
  res.headers.set('X-Frame-Options', 'DENY');
  res.headers.set('X-XSS-Protection', '1; mode=block');
  res.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  res.headers.set('Cross-Origin-Opener-Policy', 'same-origin-allow-popups');
  res.headers.set('Content-Security-Policy', CSP);
  return res;
}

export default auth((req) => {
  const pathname = req.nextUrl.pathname;

  const isProtected =
    pathname.startsWith('/dashboard') ||
    pathname.startsWith('/admin');

  if (isProtected && !req.auth) {
    return applySecurityHeaders(
      NextResponse.redirect(new URL('/sign-in', req.url)),
    );
  }

  return applySecurityHeaders(NextResponse.next());
});
