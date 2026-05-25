/**
 * IAM User Security Checks
 *
 * Checks for IAM users without MFA and old access keys.
 * Based on CIS AWS Foundations Benchmark.
 */

import type { ScanContext, SecurityFinding } from '../types.js';
import { iamRequest, parser } from './iam-request.js';

/**
 * Check IAM.3: Users without MFA
 */
export async function checkUsersWithoutMFA(context: ScanContext): Promise<SecurityFinding[]> {
  const findings: SecurityFinding[] = [];

  try {
    const usersXml = await iamRequest(context, 'ListUsers', {});
    const usersDoc = parser.parse(usersXml);
    const users = usersDoc?.ListUsersResponse?.ListUsersResult?.User || [];

    // Handle both single user (object) and multiple users (array)
    const usersList = Array.isArray(users) ? users : users ? [users] : [];

    for (const user of usersList) {
      const userName = typeof user?.UserName === 'object' ? user?.UserName?.['#text'] : user?.UserName;
      if (!userName) continue;

      // Get MFA devices for this user
      const mfaXml = await iamRequest(context, 'ListMFADevices', { UserName: userName });
      const mfaDoc = parser.parse(mfaXml);
      const mfaResult = mfaDoc?.ListMFADevicesResponse?.ListMFADevicesResult;
      // Empty result is a string, otherwise it's an object with MFADevice
      const hasMfa = typeof mfaResult === 'object' && mfaResult?.MFADevice;

      if (!hasMfa) {
        findings.push({
          checkId: 'iam-user-no-mfa',
          severity: 'high',
          resourceId: userName,
          resourceType: 'iam-user',
          region: context.region,
          title: 'IAM user without MFA',
          description: `IAM user "${userName}" does not have MFA enabled.`,
          remediation: `Enable MFA for user "${userName}" and require MFA for console access.`,
          complianceFrameworks: ['CIS AWS 1.13', 'SOC2 CC6.1'],
        });
      }
    }
  } catch (error) {
    findings.push({
      checkId: 'iam-user-no-mfa',
      severity: 'low',
      resourceId: context.accountId,
      resourceType: 'iam-account',
      region: context.region,
      title: 'Could not check user MFA status',
      description: `Failed to check user MFA: ${error instanceof Error ? error.message : 'Unknown error'}`,
      remediation: 'Verify IAM credentials have iam:ListUsers and iam:ListMFADevices permissions.',
    });
  }

  return findings;
}

/**
 * Check IAM.4: Unused access keys (>90 days)
 */
export async function checkOldAccessKeys(context: ScanContext): Promise<SecurityFinding[]> {
  const findings: SecurityFinding[] = [];

  try {
    const usersXml = await iamRequest(context, 'ListUsers', {});
    const usersDoc = parser.parse(usersXml);
    const users = usersDoc?.ListUsersResponse?.ListUsersResult?.User || [];
    const usersList = Array.isArray(users) ? users : users ? [users] : [];

    const ninetyDaysAgo = new Date();
    ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

    for (const user of usersList) {
      const userName = typeof user?.UserName === 'object' ? user?.UserName?.['#text'] : user?.UserName;
      if (!userName || userName === context.accountId) continue; // Skip root account

      // Get access keys for this user
      const keysXml = await iamRequest(context, 'ListAccessKeys', { UserName: userName });
      const keysDoc = parser.parse(keysXml);
      const keys = keysDoc?.ListAccessKeysResponse?.ListAccessKeysResult?.Member || [];
      const keysList = Array.isArray(keys) ? keys : keys ? [keys] : [];

      for (const key of keysList) {
        const keyId = typeof key?.AccessKeyId === 'object' ? key?.AccessKeyId?.['#text'] : key?.AccessKeyId;
        const status = typeof key?.Status === 'object' ? key?.Status?.['#text'] : key?.Status;
        const createDateStr = typeof key?.CreateDate === 'object' ? key?.CreateDate?.['#text'] : key?.CreateDate;

        if (status === 'Active' && createDateStr) {
          const createDate = new Date(createDateStr);
          if (createDate < ninetyDaysAgo) {
            findings.push({
              checkId: 'iam-access-keys-old',
              severity: 'medium',
              resourceId: keyId || userName,
              resourceType: 'iam-access-key',
              region: context.region,
              title: 'Old access key not rotated',
              description: `Access key for user "${userName}" is older than 90 days and should be rotated.`,
              remediation: `Rotate access key "${keyId}" for user "${userName}" and disable the old key.`,
              complianceFrameworks: ['CIS AWS 1.4', 'SOC2 CC6.1'],
            });
          }
        }
      }
    }
  } catch (error) {
    findings.push({
      checkId: 'iam-access-keys-old',
      severity: 'low',
      resourceId: context.accountId,
      resourceType: 'iam-account',
      region: context.region,
      title: 'Could not check access key age',
      description: `Failed to check access keys: ${error instanceof Error ? error.message : 'Unknown error'}`,
      remediation: 'Verify IAM credentials have iam:ListAccessKeys permission.',
    });
  }

  return findings;
}
