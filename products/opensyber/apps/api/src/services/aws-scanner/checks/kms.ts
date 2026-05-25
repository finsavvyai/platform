/**
 * KMS Security Checks
 *
 * Checks for KMS key rotation and overly permissive key policies.
 */
import type { ScanContext, SecurityFinding } from '../types.js';
import { kmsRequest } from './kms-request.js';

interface KmsKey {
  KeyId: string;
  KeyArn?: string;
  KeyManager?: string;
}

export async function checkKmsKeyRotation(ctx: ScanContext): Promise<SecurityFinding[]> {
  const findings: SecurityFinding[] = [];
  try {
    const keys = await kmsRequest(ctx, 'ListKeys') as { Keys?: KmsKey[] };
    for (const key of keys.Keys ?? []) {
      try {
        const rotation = await kmsRequest(ctx, 'GetKeyRotationStatus', { KeyId: key.KeyId }) as { KeyRotationEnabled?: boolean };
        if (!rotation.KeyRotationEnabled) {
          findings.push({
            checkId: 'kms-key-rotation-disabled', severity: 'medium',
            resourceId: key.KeyArn ?? key.KeyId, resourceType: 'kms-key', region: ctx.region,
            title: 'KMS key rotation is not enabled',
            description: `KMS key "${key.KeyId}" does not have automatic key rotation enabled.`,
            remediation: 'Enable automatic key rotation for customer-managed KMS keys.',
            complianceFrameworks: ['CIS AWS 2.8', 'SOC2 CC6.7'],
          });
        }
      } catch { /* AWS managed keys cannot have rotation checked */ }
    }
  } catch (error) {
    findings.push({
      checkId: 'kms-key-rotation-disabled', severity: 'low',
      resourceId: ctx.accountId, resourceType: 'kms-account', region: ctx.region,
      title: 'Could not check KMS keys',
      description: `Failed: ${error instanceof Error ? error.message : 'Unknown'}`,
      remediation: 'Verify IAM credentials have kms:ListKeys permission.',
    });
  }
  return findings;
}

export async function checkKmsKeyPolicy(ctx: ScanContext): Promise<SecurityFinding[]> {
  const findings: SecurityFinding[] = [];
  try {
    const keys = await kmsRequest(ctx, 'ListKeys') as { Keys?: KmsKey[] };
    for (const key of keys.Keys ?? []) {
      try {
        const policy = await kmsRequest(ctx, 'GetKeyPolicy', { KeyId: key.KeyId, PolicyName: 'default' }) as { Policy?: string };
        if (policy.Policy?.includes('"Principal":"*"') || policy.Policy?.includes('"AWS":"*"')) {
          findings.push({
            checkId: 'kms-key-public-access', severity: 'critical',
            resourceId: key.KeyArn ?? key.KeyId, resourceType: 'kms-key', region: ctx.region,
            title: 'KMS key allows public access',
            description: `KMS key "${key.KeyId}" has a key policy granting access to all principals.`,
            remediation: 'Restrict the key policy to specific IAM principals.',
            complianceFrameworks: ['CIS AWS 2.8', 'SOC2 CC6.1'],
          });
        }
      } catch { /* policy retrieval may fail for AWS managed keys */ }
    }
  } catch { /* handled by rotation check */ }
  return findings;
}

export async function runKMSChecks(ctx: ScanContext): Promise<SecurityFinding[]> {
  const results = await Promise.all([checkKmsKeyRotation(ctx), checkKmsKeyPolicy(ctx)]);
  return results.flat();
}
