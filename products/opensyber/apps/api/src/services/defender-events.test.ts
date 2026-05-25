import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createMockDb } from '../test/helpers.js';
import { processM365ThreatIntelligence } from './defender-o365.js';

describe('defender-o365: threat event processing', () => {
  let db: any;

  beforeEach(() => {
    db = createMockDb();
  });

  describe('processM365ThreatIntelligence events', () => {
    it('filters for ThreatIntelligence and ThreatIntelligenceUrl record types', async () => {
      const events = [
        { RecordType: 'ThreatIntelligence', ThreatIntelligenceName: 'BadDomain', SafeLinksDetonation: { Verdict: 'Malware' } },
        { RecordType: 'OtherType', ThreatIntelligenceName: 'Ignored', SafeLinksDetonation: { Verdict: 'Malware' } },
        { RecordType: 'ThreatIntelligenceUrl', ThreatIntelligenceUrl: 'https://malicious.com', SafeAttachments: { Verdict: 'Phishing' } },
      ];

      await processM365ThreatIntelligence(db, 'conn-1', events);

      expect(db.insert).toHaveBeenCalledTimes(2); // Only ThreatIntelligence and ThreatIntelligenceUrl
    });

    it('extracts Safe Links and Safe Attachments verdicts', async () => {
      const events = [
        { RecordType: 'ThreatIntelligence', SafeLinksDetonation: { Verdict: 'Malware', DetonationTime: '2024-01-01T00:00:00Z' } },
        { RecordType: 'ThreatIntelligence', SafeAttachments: { Verdict: 'Phishing', ScanResultDetails: 'Details' } },
      ];

      await processM365ThreatIntelligence(db, 'conn-1', events);

      const call1 = vi.mocked(db._insertChain.values).mock.calls[0][0];
      const call2 = vi.mocked(db._insertChain.values).mock.calls[1][0];
      const payload1 = JSON.parse(call1.rawPayload);
      const payload2 = JSON.parse(call2.rawPayload);

      expect(payload1.safeLinksDetonation.Verdict).toBe('Malware');
      expect(payload2.safeAttachments.Verdict).toBe('Phishing');
    });

    it('prefers Safe Links verdict over Safe Attachments', async () => {
      const events = [
        { RecordType: 'ThreatIntelligence', SafeLinksDetonation: { Verdict: 'Malware' }, SafeAttachments: { Verdict: 'Warning' } },
      ];

      await processM365ThreatIntelligence(db, 'conn-1', events);

      const insertedValue = vi.mocked(db._insertChain.values).mock.calls[0][0];
      const payload = JSON.parse(insertedValue.rawPayload);

      expect(payload.verdict).toBe('Malware');
    });

    it('includes threat name and URL in summary', async () => {
      const events = [
        { RecordType: 'ThreatIntelligence', ThreatIntelligenceName: 'Trojan.Win32.Bad', SafeLinksDetonation: { Verdict: 'Malware' } },
        { RecordType: 'ThreatIntelligenceUrl', ThreatIntelligenceUrl: 'https://evil.com/malware', SafeLinksDetonation: { Verdict: 'Malware' } },
      ];

      await processM365ThreatIntelligence(db, 'conn-1', events);

      const call1 = vi.mocked(db._insertChain.values).mock.calls[0][0];
      const call2 = vi.mocked(db._insertChain.values).mock.calls[1][0];

      expect(call1.summary).toContain('Trojan.Win32.Bad');
      expect(call2.summary).toContain('evil.com');
    });

    it('sets correct eventType and connectionId', async () => {
      const events = [{ RecordType: 'ThreatIntelligence', SafeLinksDetonation: { Verdict: 'Phishing' } }];

      await processM365ThreatIntelligence(db, 'conn-test-123', events);

      const insertedValue = vi.mocked(db._insertChain.values).mock.calls[0][0];

      expect(insertedValue.eventType).toBe('defender-o365-threat');
      expect(insertedValue.connectionId).toBe('conn-test-123');
    });

    it('processes multiple events with mapped severities', async () => {
      const events = [
        { RecordType: 'ThreatIntelligence', SafeLinksDetonation: { Verdict: 'Malware' } },
        { RecordType: 'ThreatIntelligence', SafeLinksDetonation: { Verdict: 'Warning' } },
      ];

      await processM365ThreatIntelligence(db, 'conn-1', events);

      expect(db.insert).toHaveBeenCalledTimes(2);
      const call1 = vi.mocked(db._insertChain.values).mock.calls[0][0];
      const call2 = vi.mocked(db._insertChain.values).mock.calls[1][0];

      expect(call1.severity).toBe('critical');
      expect(call2.severity).toBe('medium');
    });

    it('handles empty event array and missing verdict data', async () => {
      await processM365ThreatIntelligence(db, 'conn-1', []);
      expect(db.insert).not.toHaveBeenCalled();

      const events = [{ RecordType: 'ThreatIntelligence', ThreatIntelligenceName: 'SomeThreat' }];
      await processM365ThreatIntelligence(db, 'conn-1', events);

      const insertedValue = vi.mocked(db._insertChain.values).mock.calls[0][0];
      const payload = JSON.parse(insertedValue.rawPayload);

      expect(payload.verdict).toBe('unknown');
    });
  });
});
