/**
 * TokenForge + Fastify example
 *
 * Run:
 *   npx tsx index.ts
 *
 * Then open http://localhost:3000
 */
import Fastify from 'fastify';
import { tokenForgePlugin } from '@opensyber/tokenforge/fastify';
import { MemoryStorage } from '@opensyber/tokenforge/storage';

const fastify = Fastify({ logger: true });
const storage = new MemoryStorage();

// Register TokenForge as a Fastify plugin
fastify.register(tokenForgePlugin, {
  storage,
  trustThresholds: { allow: 80, stepUp: 40 },
  sessionMaxAge: 86400,
  nonceExpiry: 60,
  skipPaths: ['/health'],
  sensitiveOps: ['/account/delete'],
  onSecurityEvent: async (event) => {
    fastify.log.info({ eventType: event.eventType }, 'Security event');
  },
});

fastify.get('/health', async () => {
  return { status: 'ok' };
});

fastify.get('/profile', async (request) => {
  const tf = (request as unknown as { tf: { bound: boolean; trustScore: number; deviceId: string | null } }).tf;
  return {
    message: 'Profile data',
    deviceBound: tf.bound,
    trustScore: tf.trustScore,
    deviceId: tf.deviceId,
  };
});

fastify.listen({ port: 3000 }, (err) => {
  if (err) {
    fastify.log.error(err);
    process.exit(1);
  }
});
