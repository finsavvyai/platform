/**
 * TokenForge + Next.js Middleware example
 *
 * Place this file at: middleware.ts (project root)
 */
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { tokenForgeCheck } from '@opensyber/tokenforge/nextjs';
import { MemoryStorage } from '@opensyber/tokenforge/storage';

const storage = new MemoryStorage();

export async function middleware(request: NextRequest) {
  // Only check API routes
  if (!request.nextUrl.pathname.startsWith('/api')) {
    return NextResponse.next();
  }

  const result = await tokenForgeCheck(request, {
    storage,
    trustThresholds: { allow: 80, stepUp: 40 },
    sessionMaxAge: 86400,
    nonceExpiry: 60,
    skipPaths: ['/api/health'],
    getAuth: async (req) => ({
      userId: req.headers.get('x-user-id'),
      sessionId: req.headers.get('x-session-id'),
    }),
  });

  if (!result.proceed) {
    return result.response;
  }

  // Pass trust context to API route via headers
  const response = NextResponse.next();
  response.headers.set('x-tf-bound', String(result.tf.bound));
  response.headers.set('x-tf-score', String(result.tf.trustScore));
  if (result.tf.deviceId) {
    response.headers.set('x-tf-device', result.tf.deviceId);
  }
  return response;
}

export const config = {
  matcher: '/api/:path*',
};
