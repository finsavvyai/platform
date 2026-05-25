/**
 * Sample: Next.js App Router + TokenForge
 *
 * Demonstrates:
 * - withTokenForge route handler wrapper
 * - tokenForgeCheck for middleware.ts
 * - TfContext in route handlers
 * - Conditional rendering based on trust score
 */
import { withTokenForge, tokenForgeCheck, type TfContext } from '../../packages/tokenforge/src/adapters/nextjs.js';

const TF_OPTIONS = {
  apiKey: process.env.TOKENFORGE_API_KEY ?? 'tf_sample_key',
  apiBase: process.env.TOKENFORGE_API_BASE,
  skipPaths: ['/api/health'],
};

/** Route handler: GET /api/profile — wrapped with TokenForge. */
async function profileHandler(req: Request, tf: TfContext) {
  return Response.json({
    userId: 'user-001',
    deviceBound: tf.bound,
    trustScore: tf.trustScore,
    deviceId: tf.deviceId,
    canAccessSensitive: tf.bound && tf.trustScore >= 90,
  });
}

export const GET = withTokenForge(profileHandler, TF_OPTIONS);

/** Route handler: POST /api/transfer — sensitive operation. */
async function transferHandler(req: Request, tf: TfContext) {
  if (!tf.bound || tf.trustScore < 90) {
    return new Response(
      JSON.stringify({ error: 'elevated_trust_required' }),
      { status: 403, headers: { 'Content-Type': 'application/json' } },
    );
  }
  const body = await req.json();
  return Response.json({ transferred: true, amount: body.amount });
}

export const POST = withTokenForge(transferHandler, TF_OPTIONS);

/** Middleware check — for use in Next.js middleware.ts. */
export async function checkRequest(req: Request) {
  return tokenForgeCheck(req as never, TF_OPTIONS);
}

/** Build trust badge from TfContext (for UI rendering). */
export function getTrustBadge(tf: TfContext): {
  label: string;
  color: string;
  icon: string;
} {
  if (!tf.bound) return { label: 'Unverified', color: 'gray', icon: 'shield-off' };
  if (tf.trustScore >= 90) return { label: 'Verified', color: 'green', icon: 'shield-check' };
  if (tf.trustScore >= 60) return { label: 'Partial', color: 'yellow', icon: 'shield-alert' };
  return { label: 'Low Trust', color: 'red', icon: 'shield-x' };
}
