import { encodeApiToken } from '@opensyber/auth';
import { auth } from './auth';

/**
 * Get a signed JWT token to forward to the OpenSyber API.
 * Replaces the old Clerk getToken() pattern.
 */
export async function getApiToken(): Promise<string | null> {
  const session = await auth();
  if (!session?.user) return null;

  const user = session.user as { id?: string; email?: string | null };

  const secret = process.env.AUTH_SECRET;
  if (!secret) return null;

  return encodeApiToken(
    user.id ?? '',
    user.email,
    secret,
  );
}
