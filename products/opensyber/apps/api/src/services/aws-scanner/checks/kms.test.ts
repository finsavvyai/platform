/**
 * KMS Security Check Tests
 */
import { describe, it, expect, vi } from 'vitest';
import type { ScanContext } from '../types.js';
import { checkKmsKeyRotation, checkKmsKeyPolicy, runKMSChecks } from './kms.js';

const ctx: ScanContext = {
  accountId: '123456789012', region: 'us-east-1',
  credentials: { accessKeyId: 'AKIA', secretAccessKey: 'secret', sessionToken: 'token', expiration: '2099-01-01' },
};

vi.mock('./kms-request.js', () => ({
  kmsRequest: vi.fn(async (_ctx: ScanContext, action: string, body?: Record<string, unknown>) => {
    if (action === 'ListKeys') {
      return { Keys: [{ KeyId: 'key-1', KeyArn: 'arn:aws:kms:us-east-1:123:key/key-1' }] };
    }
    if (action === 'GetKeyRotationStatus') return { KeyRotationEnabled: false };
    if (action === 'GetKeyPolicy') return { Policy: '{"Statement":[{"Principal":"*"}]}' };
    return {};
  }),
}));

describe('KMS checks', () => {
  it('detects keys without rotation enabled', async () => {
    const findings = await checkKmsKeyRotation(ctx);
    expect(findings).toHaveLength(1);
    expect(findings[0].checkId).toBe('kms-key-rotation-disabled');
  });

  it('detects keys with public access', async () => {
    const findings = await checkKmsKeyPolicy(ctx);
    expect(findings).toHaveLength(1);
    expect(findings[0].checkId).toBe('kms-key-public-access');
    expect(findings[0].severity).toBe('critical');
  });

  it('runKMSChecks aggregates all checks', async () => {
    const findings = await runKMSChecks(ctx);
    expect(findings.length).toBeGreaterThanOrEqual(2);
  });
});
