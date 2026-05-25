/**
 * TokenForge + Next.js App Router example
 *
 * Place this file at: app/api/profile/route.ts
 */
import { withTokenForge, type TfContext } from '@opensyber/tokenforge/nextjs';
import { MemoryStorage } from '@opensyber/tokenforge/storage';

const storage = new MemoryStorage();

const options = {
  storage,
  trustThresholds: { allow: 80, stepUp: 40 },
  sessionMaxAge: 86400,
  nonceExpiry: 60,
  getAuth: async (req: Request) => ({
    // Replace with your auth provider (Clerk, NextAuth, etc.)
    userId: req.headers.get('x-user-id'),
    sessionId: req.headers.get('x-session-id'),
  }),
};

async function handler(_req: Request, tf: TfContext) {
  return Response.json({
    message: 'Profile data',
    deviceBound: tf.bound,
    trustScore: tf.trustScore,
    deviceId: tf.deviceId,
  });
}

export const GET = withTokenForge(handler, options);
