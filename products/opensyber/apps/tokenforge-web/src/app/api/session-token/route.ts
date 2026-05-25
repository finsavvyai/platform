import { NextResponse } from 'next/server';
import { encodeApiToken } from '@opensyber/auth/token';
import { auth } from '@/lib/auth';

/**
 * Mints a 1-hour HS256 `sjwt_` token from the current Auth.js session so the
 * client can call tokenforge-api under the same `Bearer` contract as long-lived
 * API keys. Runs server-side on the same origin as the dashboard, so the
 * Auth.js cookie is directly available — no cross-subdomain cookie plumbing.
 */
export async function GET(): Promise<NextResponse> {
  const session = await auth();
  const email = session?.user?.email;
  if (!session || !email) {
    return NextResponse.json(
      { error: 'unauthorized', message: 'No active session' },
      { status: 401 },
    );
  }

  const secret = process.env.AUTH_SECRET;
  if (!secret) {
    return NextResponse.json(
      { error: 'server_config', message: 'AUTH_SECRET is not configured' },
      { status: 500 },
    );
  }

  const subject =
    (session.user as unknown as { id?: string }).id ?? email;
  const token = await encodeApiToken(subject, email, secret);
  return NextResponse.json({ token, expiresIn: 3600 });
}
