/**
 * Device-class telemetry endpoint — GET /v1/devices/:id/telemetry.
 *
 * Tenant-scoped read of device-binding metadata + recent AitM anomalies.
 * Designed for the developer's app to consume so they can drive UX
 * decisions (e.g., "warn user about unusual login", "require re-auth").
 *
 * Cisco Duo paywalls equivalent telemetry behind their $9/u/mo Premier
 * tier; TokenForge surfaces it free in this endpoint.
 *
 * Response shape (Sprint 39):
 *   {
 *     data: {
 *       deviceId, keyClass, isAttested, channelBound,
 *       trustScore, anomalies, boundAt, lastVerifiedAt
 *     }
 *   }
 */

import { Hono } from 'hono';
import { and, eq, desc } from 'drizzle-orm';
import { deviceSessions, tfSecurityEvents } from '@opensyber/db';
import type { Env, Variables } from '../types.js';

export type KeyClass =
  | 'browser_software'
  | 'secure_enclave'
  | 'tpm2'
  | 'unknown';

export interface TelemetryAnomaly {
  kind: string;
  confidence?: 'low' | 'medium' | 'high';
  capturedAt: string;
}

export interface DeviceTelemetry {
  deviceId: string;
  keyClass: KeyClass;
  isAttested: boolean;
  channelBound: boolean;
  trustScore: number;
  anomalies: TelemetryAnomaly[];
  boundAt: string;
  lastVerifiedAt: string;
  revoked: boolean;
}

export const deviceTelemetryRoutes = new Hono<{
  Bindings: Env;
  Variables: Variables;
}>();

deviceTelemetryRoutes.get('/:id/telemetry', async (c) => {
  const db = c.get('db');
  const tenantId = c.get('tenantId');
  const deviceId = c.req.param('id');

  const [device] = await db
    .select()
    .from(deviceSessions)
    .where(
      and(
        eq(deviceSessions.id, deviceId),
        eq(deviceSessions.tenantId, tenantId),
      ),
    )
    .limit(1);

  if (!device) return c.json({ error: 'device_not_found' }, 404);

  const anomalies = await readRecentAnomalies(db, tenantId, device.sessionId);

  const telemetry: DeviceTelemetry = {
    deviceId: device.id,
    keyClass: classifyKey(device.publicKey, c.req.header('user-agent')),
    isAttested: false,
    channelBound: false,
    trustScore: device.trustScore,
    anomalies,
    boundAt: device.boundAt,
    lastVerifiedAt: device.lastVerifiedAt,
    revoked: device.revoked === 1,
  };

  return c.json({ data: telemetry });
});

/**
 * Best-effort classification of the bound public key.
 *
 * Browser SDK stores keys as JSON-serialized JWK (kty=EC, crv=P-256).
 * Native SDKs (Python / Go / Swift / Kotlin) submit PEM SPKI. Without
 * full WebAuthn attestation parsing (CBOR + AAGUID lookup), we use
 * UA hints to upgrade JWK keys to platform-specific buckets:
 *   - Apple device + Safari → secure_enclave
 *   - Windows + Chrome/Edge → tpm2
 *   - everything else       → browser_software
 *
 * The hint is best-effort; a Linux Chrome user with a YubiKey is
 * still classified as software. The dashboard surfaces this as a
 * "likely" hint, not a verified claim. Native PEM keys stay
 * unclassified until proper attestation parsing lands.
 */
export function classifyKey(publicKey: string, userAgent?: string | null): KeyClass {
  const trimmed = publicKey.trim();
  if (trimmed.startsWith('{')) {
    try {
      const parsed = JSON.parse(trimmed) as { kty?: string; crv?: string };
      if (parsed.kty === 'EC' && parsed.crv === 'P-256') {
        return classifyByPlatform(userAgent);
      }
    } catch {
      return 'unknown';
    }
  }
  if (trimmed.startsWith('-----BEGIN')) {
    // Future: parse attestation statement here. For now native = unknown.
    return 'unknown';
  }
  return 'unknown';
}

function classifyByPlatform(ua: string | null | undefined): KeyClass {
  if (!ua) return 'browser_software';
  // Apple platform: Safari on macOS / iPhone / iPad → Secure Enclave likely
  const isApple = /(iPhone|iPad|Macintosh|Mac OS X)/.test(ua);
  const isSafari = /Safari/.test(ua) && !/Chrome|CriOS|Edg/.test(ua);
  if (isApple && isSafari) return 'secure_enclave';
  // Windows + Chromium-based browser → TPM 2.0 likely (Chrome 146+ DBSC
  // uses TPM-backed keys on Windows 10/11 with TPM 2.0 chips).
  const isWindows = /Windows NT/.test(ua);
  const isChromium = /Chrome|CriOS|Edg/.test(ua);
  if (isWindows && isChromium) return 'tpm2';
  return 'browser_software';
}

type Db = ReturnType<typeof import('../lib/db.js').createDb>;

async function readRecentAnomalies(
  db: Db,
  tenantId: string,
  sessionId: string,
): Promise<TelemetryAnomaly[]> {
  const rows = await db
    .select()
    .from(tfSecurityEvents)
    .where(
      and(
        eq(tfSecurityEvents.tenantId, tenantId),
        eq(tfSecurityEvents.sessionId, sessionId),
      ),
    )
    .orderBy(desc(tfSecurityEvents.createdAt))
    .limit(20);

  return rows
    .filter((r) => r.eventType.startsWith('aitm_'))
    .map((r) => {
      let confidence: TelemetryAnomaly['confidence'];
      try {
        const meta = r.metadata ? JSON.parse(r.metadata) : {};
        if (meta && typeof meta.confidence === 'string') {
          confidence = meta.confidence as TelemetryAnomaly['confidence'];
        }
      } catch {
        confidence = undefined;
      }
      return {
        kind: r.eventType.slice('aitm_'.length),
        confidence,
        capturedAt: r.createdAt,
      };
    });
}
