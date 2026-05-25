import { describe, it, expect } from 'vitest';
import {
  buildAitmCsv,
  AITM_CSV_HEADERS,
  type SecurityEventRow,
} from './aitm-csv.js';

const baseRow = (over: Partial<SecurityEventRow> = {}): SecurityEventRow => ({
  id: 'ev_1', tenantId: 't1', sessionId: 'ses_1', userId: 'user_1',
  eventType: 'aitm.detected', trustScoreBefore: 80, trustScoreAfter: 50,
  ipAddress: '1.2.3.4', countryCode: 'US', userAgent: 'Mozilla/5.0',
  metadata: JSON.stringify({
    signals: [{ kind: 'origin_mismatch' }, { kind: 'ua_drift' }],
    confidence: 'high',
  }),
  createdAt: '2026-05-04T12:00:00Z',
  ...over,
});

describe('AITM_CSV_HEADERS', () => {
  it('has exactly 15 columns (Sprint 39 exit-criterion shape contract)', () => {
    expect(AITM_CSV_HEADERS).toHaveLength(15);
  });

  it('pins column order — moving columns breaks downstream tooling', () => {
    expect([...AITM_CSV_HEADERS]).toEqual([
      'event_id', 'tenant_id', 'created_at_iso', 'session_id', 'user_id',
      'event_type', 'trust_score_before', 'trust_score_after', 'ip_address',
      'country_code', 'user_agent', 'anomaly_kinds', 'confidence',
      'action_taken', 'evidence_hash',
    ]);
  });
});

describe('buildAitmCsv', () => {
  it('returns header-only output (with trailing newline) for empty input', async () => {
    const csv = await buildAitmCsv([]);
    expect(csv).toBe(AITM_CSV_HEADERS.join(',') + '\n');
  });

  it('emits one data row per event with 15 comma-separated cells', async () => {
    const csv = await buildAitmCsv([baseRow()]);
    const lines = csv.trim().split('\n');
    expect(lines).toHaveLength(2);
    expect(lines[1]!.split(',').length).toBeGreaterThanOrEqual(15);
  });

  it('extracts anomaly_kinds from metadata.signals[].kind, pipe-joined', async () => {
    const csv = await buildAitmCsv([baseRow()]);
    expect(csv).toContain('origin_mismatch|ua_drift');
  });

  it('extracts confidence from metadata.confidence', async () => {
    const csv = await buildAitmCsv([baseRow()]);
    const cells = csv.trim().split('\n')[1]!.split(',');
    // confidence is column 13 (zero-indexed: 12)
    expect(cells[12]).toBe('high');
  });

  it('maps event_type suffixes to action_taken', async () => {
    const blockCsv = await buildAitmCsv([baseRow({ eventType: 'trust.block' })]);
    expect(blockCsv.trim().split('\n')[1]!.split(',')[13]).toBe('block');

    const stepUpCsv = await buildAitmCsv([baseRow({ eventType: 'trust.step_up' })]);
    expect(stepUpCsv.trim().split('\n')[1]!.split(',')[13]).toBe('step_up');

    const revokeCsv = await buildAitmCsv([baseRow({ eventType: 'dbsc.session_revoked' })]);
    expect(revokeCsv.trim().split('\n')[1]!.split(',')[13]).toBe('revoke');

    const otherCsv = await buildAitmCsv([baseRow({ eventType: 'aitm.detected' })]);
    expect(otherCsv.trim().split('\n')[1]!.split(',')[13]).toBe('log');
  });

  it('emits a 32-hex-char evidence_hash even when metadata is null', async () => {
    const csv = await buildAitmCsv([baseRow({ metadata: null })]);
    const cells = csv.trim().split('\n')[1]!.split(',');
    expect(cells[14]).toMatch(/^[0-9a-f]{32}$/);
  });

  it('produces deterministic evidence_hash for identical input', async () => {
    const a = await buildAitmCsv([baseRow()]);
    const b = await buildAitmCsv([baseRow()]);
    const hashA = a.trim().split('\n')[1]!.split(',')[14];
    const hashB = b.trim().split('\n')[1]!.split(',')[14];
    expect(hashA).toBe(hashB);
  });

  it('escapes commas in cell values by quoting', async () => {
    const csv = await buildAitmCsv([baseRow({ userAgent: 'Mozilla, with comma' })]);
    expect(csv).toContain('"Mozilla, with comma"');
  });

  it('escapes embedded double-quotes by doubling', async () => {
    const csv = await buildAitmCsv([baseRow({ userAgent: 'has "quoted" parts' })]);
    expect(csv).toContain('"has ""quoted"" parts"');
  });

  it('escapes newlines inside cell values', async () => {
    const csv = await buildAitmCsv([baseRow({ userAgent: 'line1\nline2' })]);
    expect(csv).toContain('"line1\nline2"');
  });

  it('returns empty string for null cells (not literal "null")', async () => {
    const csv = await buildAitmCsv([baseRow({
      ipAddress: null, countryCode: null, userAgent: null,
      trustScoreBefore: null, trustScoreAfter: null,
    })]);
    expect(csv).not.toContain('null');
  });

  it('falls back to empty anomaly_kinds when metadata is malformed JSON', async () => {
    const csv = await buildAitmCsv([baseRow({ metadata: '{not-json' })]);
    const cells = csv.trim().split('\n')[1]!.split(',');
    expect(cells[11]).toBe(''); // anomaly_kinds col
    expect(cells[12]).toBe(''); // confidence col
  });
});
