/**
 * Sample: Express.js + TokenForge cloud API middleware
 *
 * Demonstrates:
 * - Cloud API verification via tokenForgeMiddleware
 * - Skip paths (public health endpoint)
 * - Sensitive operation protection (account deletion)
 * - Graceful degradation when API is unreachable
 * - Visual HTML trust status page
 */
import { tokenForgeMiddleware, type TfContext } from '../../packages/tokenforge/src/adapters/express.js';

interface TfRequest {
  path: string;
  method: string;
  headers: Record<string, string | string[] | undefined>;
  ip?: string;
  tf?: TfContext;
  body?: unknown;
}

interface TfResponse {
  status(code: number): TfResponse;
  json(body: unknown): void;
  send(body: string): void;
  setHeader(name: string, value: string): void;
}

type NextFn = (err?: unknown) => void;

/** Create the Express middleware with given options. */
export function createMiddleware(apiKey: string, apiBase?: string) {
  return tokenForgeMiddleware({
    apiKey,
    apiBase,
    skipPaths: ['/health', '/public/*'],
    sensitiveOps: ['/account/delete'],
  });
}

/** Handler: public health check (skipped by middleware). */
export function healthHandler(_req: TfRequest, res: TfResponse) {
  res.json({ status: 'ok', timestamp: Date.now() });
}

/** Handler: protected profile endpoint. */
export function profileHandler(req: TfRequest, res: TfResponse) {
  const tf = req.tf ?? { bound: false, trustScore: 0, deviceId: null };
  res.json({
    userId: 'user-001',
    deviceBound: tf.bound,
    trustScore: tf.trustScore,
    deviceId: tf.deviceId,
  });
}

/** Handler: sensitive account deletion. */
export function deleteAccountHandler(req: TfRequest, res: TfResponse) {
  const tf = req.tf ?? { bound: false, trustScore: 0, deviceId: null };
  if (!tf.bound || tf.trustScore < 90) {
    res.status(403).json({
      error: 'elevated_trust_required',
      message: 'Account deletion requires device binding with trust > 90',
    });
    return;
  }
  res.json({ deleted: true, deviceId: tf.deviceId });
}

/** Handler: visual HTML trust dashboard. */
export function dashboardHandler(req: TfRequest, res: TfResponse) {
  const tf = req.tf ?? { bound: false, trustScore: 0, deviceId: null };
  const score = tf.trustScore;
  const color = score >= 80 ? '#2ECC7B' : score >= 40 ? '#FFB347' : '#FF4D4D';
  const action = score >= 80 ? 'ALLOW' : score >= 40 ? 'STEP-UP' : 'BLOCK';

  res.setHeader('Content-Type', 'text/html');
  res.send(`<!DOCTYPE html><html><head><meta charset="UTF-8">
<style>body{background:#060910;color:#E8F0F8;font-family:system-ui;display:flex;justify-content:center;align-items:center;min-height:100vh;margin:0;}
.c{background:#0A0F18;border:1px solid #1C2940;border-radius:16px;padding:40px;max-width:400px;text-align:center;}
.s{font-size:64px;font-weight:800;color:${color};}.b{display:inline-block;padding:6px 20px;border-radius:24px;font-size:13px;font-weight:600;border:1px solid ${color}40;background:${color}15;color:${color};margin:12px 0;}</style></head>
<body><div class="c"><p style="font-size:11px;color:#4D9EFF;text-transform:uppercase;letter-spacing:0.15em;">TokenForge + Express</p>
<div class="s">${score}</div><p style="color:#3D5470;">/ 100</p><div class="b">${action}</div>
<p style="font-size:13px;color:#7A96B2;">Bound: ${tf.bound} | Device: ${tf.deviceId ?? 'none'}</p></div></body></html>`);
}
