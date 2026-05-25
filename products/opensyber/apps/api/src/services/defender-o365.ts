import { generateId } from '@opensyber/shared';
import { integrationEvents } from '@opensyber/db';
import type { DrizzleD1Database } from 'drizzle-orm/d1';

type DefenderSeverity = 'info' | 'low' | 'medium' | 'high' | 'critical';

interface M365ThreatEvent {
  RecordType: string;
  ThreatIntelligenceName?: string;
  ThreatIntelligenceUrl?: string;
  SafeLinksDetonation?: {
    Verdict?: string;
    DetonationTime?: string;
  };
  SafeAttachments?: {
    Verdict?: string;
    ScanResultDetails?: string;
  };
  EventData?: Record<string, any>;
  CreationTime?: string;
}

/**
 * Map Microsoft Defender verdict to OpenSyber severity.
 */
export function mapDefenderSeverity(verdict: string): DefenderSeverity {
  const v = verdict?.toLowerCase() ?? '';
  if (v.includes('malware') || v.includes('dangerous')) return 'critical';
  if (v.includes('phishing') || v.includes('suspicious')) return 'high';
  if (v.includes('warning')) return 'medium';
  return 'low';
}

/**
 * Process Microsoft Defender for Office 365 ThreatIntelligence events.
 * Filters for ThreatIntelligence/ThreatIntelligenceUrl record types.
 */
export async function processM365ThreatIntelligence(
  db: DrizzleD1Database<any>,
  connectionId: string,
  events: M365ThreatEvent[],
): Promise<void> {
  const threatEvents = events.filter(
    (e) =>
      e.RecordType === 'ThreatIntelligence' ||
      e.RecordType === 'ThreatIntelligenceUrl',
  );

  for (const event of threatEvents) {
    // Extract verdict from Safe Links or Safe Attachments
    let verdict = 'unknown';
    if (event.SafeLinksDetonation?.Verdict) {
      verdict = event.SafeLinksDetonation.Verdict;
    } else if (event.SafeAttachments?.Verdict) {
      verdict = event.SafeAttachments.Verdict;
    }

    const severity = mapDefenderSeverity(verdict);

    const id = generateId();
    const now = new Date().toISOString();

    await db.insert(integrationEvents).values({
      id,
      connectionId,
      eventType: 'defender-o365-threat',
      severity,
      summary: `Microsoft Defender threat: ${event.ThreatIntelligenceName || event.ThreatIntelligenceUrl || 'Unknown'} (${verdict})`,
      rawPayload: JSON.stringify({
        recordType: event.RecordType,
        threatName: event.ThreatIntelligenceName,
        threatUrl: event.ThreatIntelligenceUrl,
        verdict,
        safeLinksDetonation: event.SafeLinksDetonation,
        safeAttachments: event.SafeAttachments,
      }),
      latencyMs: 0,
      processedAt: now,
      createdAt: now,
    });
  }
}
