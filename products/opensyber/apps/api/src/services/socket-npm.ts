import { generateId } from '@opensyber/shared';
import { integrationEvents } from '@opensyber/db';
import type { DrizzleD1Database } from 'drizzle-orm/d1';

interface SocketThreatResponse {
  threat?: {
    level?: 'low' | 'medium' | 'high' | 'critical';
  };
  score?: number;
}

/**
 * Check package threat level via Socket.dev npm threat feed API.
 * Returns threat level or null if no threat found.
 */
export async function checkPackageThreat(
  packageName: string,
  version: string,
  apiKey: string,
): Promise<'critical' | 'high' | 'medium' | 'low' | null> {
  try {
    const url = `https://api.socket.dev/v0/npm/${encodeURIComponent(packageName)}/${encodeURIComponent(version)}/score`;

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      return null;
    }

    const data: SocketThreatResponse = await response.json();
    return data.threat?.level ?? null;
  } catch (err) {
    console.error('[Socket.dev] checkPackageThreat error:', err);
    return null;
  }
}

/**
 * Process npm install event from IDE telemetry.
 * Checks Socket.dev for threats and creates integration_event if critical/high.
 */
export async function processNpmInstallEvent(
  db: DrizzleD1Database<any>,
  connectionId: string,
  packageName: string,
  version: string,
  socketApiKey: string,
): Promise<void> {
  const threatLevel = await checkPackageThreat(packageName, version, socketApiKey);

  // Only create event for high/critical threats
  if (threatLevel === 'high' || threatLevel === 'critical') {
    const id = generateId();
    const now = new Date().toISOString();

    await db.insert(integrationEvents).values({
      id,
      connectionId,
      eventType: 'npm-threat-detected',
      severity: threatLevel === 'critical' ? 'critical' : 'high',
      summary: `Socket.dev threat detected: ${packageName}@${version} (${threatLevel})`,
      rawPayload: JSON.stringify({
        package: packageName,
        version,
        threatLevel,
        source: 'socket-dev',
      }),
      latencyMs: 0,
      processedAt: now,
      createdAt: now,
    });
  }
}
