/**
 * TokenForge + Express example
 *
 * Run:
 *   npx tsx index.ts
 *
 * Then open http://localhost:3000
 */
import express from 'express';
import { tokenForgeMiddleware } from '@opensyber/tokenforge/express';
import { MemoryStorage } from '@opensyber/tokenforge/storage';

const app = express();
const storage = new MemoryStorage();

app.use(express.json());

// Apply TokenForge middleware to all /api/* routes
app.use(
  '/api',
  tokenForgeMiddleware({
    storage,
    trustThresholds: { allow: 80, stepUp: 40 },
    sessionMaxAge: 86400,
    nonceExpiry: 60,
    skipPaths: ['/api/health'],
    sensitiveOps: ['/api/account/delete'],
    onSecurityEvent: async (event) => {
      console.log('[Security Event]', event.eventType, event.metadata);
    },
  }),
);

// Public endpoint — no TokenForge verification
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok' });
});

// Protected endpoint — req.tf contains device binding info
app.get('/api/profile', (req, res) => {
  const tf = (req as unknown as { tf: { bound: boolean; trustScore: number; deviceId: string | null } }).tf;
  res.json({
    message: 'Profile data',
    deviceBound: tf.bound,
    trustScore: tf.trustScore,
    deviceId: tf.deviceId,
  });
});

// Sensitive endpoint — requires elevated trust
app.delete('/api/account/delete', (req, res) => {
  const tf = (req as unknown as { tf: { bound: boolean; trustScore: number } }).tf;
  if (!tf.bound || tf.trustScore < 90) {
    res.status(403).json({ error: 'Elevated trust required for account deletion' });
    return;
  }
  res.json({ message: 'Account deletion initiated' });
});

app.listen(3000, () => {
  console.log('Express + TokenForge running on http://localhost:3000');
});
