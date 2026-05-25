/**
 * Sample: Fastify + TokenForge cloud API plugin
 *
 * Demonstrates:
 * - Plugin registration with tokenForgePlugin
 * - Skip paths (public health endpoint)
 * - req.tf access in route handlers
 * - Graceful degradation on API failure
 */
import { tokenForgePlugin, type TfContext } from '../../packages/tokenforge/src/adapters/fastify.js';

/** Create Fastify plugin options for testing. */
export function createPluginOptions(apiKey: string, apiBase?: string) {
  return {
    apiKey,
    apiBase,
    skipPaths: ['/health', '/docs/*'],
  };
}

/** Type-safe helper to read tf context from Fastify request. */
export function getTfContext(request: { tf?: TfContext }): TfContext {
  return request.tf ?? { bound: false, trustScore: 0, deviceId: null };
}

/** Build a profile response from tf context. */
export function buildProfileResponse(tf: TfContext) {
  return {
    userId: 'user-001',
    deviceBound: tf.bound,
    trustScore: tf.trustScore,
    deviceId: tf.deviceId,
    securityLevel: tf.trustScore >= 90 ? 'high' : tf.trustScore >= 60 ? 'medium' : 'low',
  };
}

/** Check if a sensitive operation is allowed. */
export function canPerformSensitiveOp(tf: TfContext): {
  allowed: boolean;
  reason?: string;
} {
  if (!tf.bound) return { allowed: false, reason: 'Device not bound' };
  if (tf.trustScore < 90) {
    return { allowed: false, reason: `Trust score ${tf.trustScore} below threshold 90` };
  }
  return { allowed: true };
}
