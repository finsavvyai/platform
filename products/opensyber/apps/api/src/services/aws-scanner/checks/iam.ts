/**
 * IAM Security Checks
 *
 * Security checks for AWS IAM using fetch API.
 * Checks for password policy strength, root MFA, unused keys, and users without MFA.
 *
 * Based on CIS AWS Foundations Benchmark and Prowler best practices.
 */

import type { ScanContext, SecurityFinding } from '../types.js';
import { iamRequest, parser } from './iam-request.js';
import { checkUsersWithoutMFA, checkOldAccessKeys } from './iam-user-checks.js';

// Re-export for backward compatibility
export { checkUsersWithoutMFA, checkOldAccessKeys } from './iam-user-checks.js';

/**
 * Check IAM.1: Root account MFA enabled
 */
export async function checkRootMFA(context: ScanContext): Promise<SecurityFinding[]> {
  const findings: SecurityFinding[] = [];

  try {
    const response = await iamRequest(context, 'GetAccountSummary', {});
    if (!response) return findings;

    const parsed = parser.parse(response);
    const mfaEnabledRaw = parsed?.GetAccountSummaryResponse?.GetAccountSummaryResult?.AccountMFAEnabled;
    const mfaEnabled = typeof mfaEnabledRaw === 'object' ? mfaEnabledRaw?.['#text'] : mfaEnabledRaw;

    if (mfaEnabled !== 1 && mfaEnabled !== '1') {
      findings.push({
        checkId: 'iam-root-mfa-disabled',
        severity: 'critical',
        resourceId: context.accountId,
        resourceType: 'iam-root',
        region: context.region,
        title: 'Root account MFA not enabled',
        description: 'The AWS root account does not have multi-factor authentication enabled.',
        remediation: 'Enable hardware MFA on the root account immediately.',
        complianceFrameworks: ['CIS AWS 1.5', 'SOC2 CC6.1'],
      });
    }
  } catch (error) {
    findings.push({
      checkId: 'iam-root-mfa-disabled',
      severity: 'low',
      resourceId: context.accountId,
      resourceType: 'iam-root',
      region: context.region,
      title: 'Could not check root MFA status',
      description: `Failed to check root MFA: ${error instanceof Error ? error.message : 'Unknown error'}`,
      remediation: 'Verify IAM credentials have iam:GetAccountSummary permission.',
    });
  }

  return findings;
}

/**
 * Check IAM.2: Password policy strength
 */
export async function checkPasswordPolicy(context: ScanContext): Promise<SecurityFinding[]> {
  const findings: SecurityFinding[] = [];

  try {
    const response = await iamRequest(context, 'GetAccountPasswordPolicy', {});
    if (!response) return findings;

    const parsed = parser.parse(response);
    const policy = parsed?.GetAccountPasswordPolicyResponse?.GetAccountPasswordPolicyResult;

    if (!policy) {
      findings.push({
        checkId: 'iam-password-policy-weak',
        severity: 'medium',
        resourceId: context.accountId,
        resourceType: 'iam-account',
        region: context.region,
        title: 'No custom password policy',
        description: 'AWS account uses the default password policy.',
        remediation: 'Set a strong custom password policy with minimum length 14 chars, requiring symbols, numbers, and uppercase.',
        complianceFrameworks: ['CIS AWS 1.8', 'SOC2 CC6.2'],
      });
      return findings;
    }

    const getTextVal = (val: unknown) => typeof val === 'object' && val ? (val as { '#text'?: string })['#text'] || val : val;
    const getBoolVal = (val: unknown) => {
      const textVal = getTextVal(val);
      if (typeof textVal === 'boolean') return textVal;
      return textVal === 'true' || textVal === true;
    };

    const minLength = parseInt(String(getTextVal(policy.MinimumPasswordLength) || '6'), 10);
    const requireSymbols = getBoolVal(policy.RequireSymbols);
    const requireNumbers = getBoolVal(policy.RequireNumbers);
    const requireUppercase = getBoolVal(policy.RequireUppercaseCharacters);
    const requireLowercase = getBoolVal(policy.RequireLowercaseCharacters);

    if (minLength < 14 || !requireSymbols || !requireNumbers || !requireUppercase || !requireLowercase) {
      findings.push({
        checkId: 'iam-password-policy-weak',
        severity: 'medium',
        resourceId: context.accountId,
        resourceType: 'iam-account',
        region: context.region,
        title: 'Weak IAM password policy',
        description: `Password policy minimum length is ${minLength} (recommended: 14). Missing requirements: ${[
          !requireSymbols && 'symbols',
          !requireNumbers && 'numbers',
          !requireUppercase && 'uppercase',
          !requireLowercase && 'lowercase',
        ].filter(Boolean).join(', ') || 'none'}.`,
        remediation: 'Strengthen password policy: minimum 14 characters, require symbols, numbers, uppercase, and lowercase.',
        complianceFrameworks: ['CIS AWS 1.8', 'SOC2 CC6.2'],
      });
    }
  } catch (error) {
    findings.push({
      checkId: 'iam-password-policy-weak',
      severity: 'low',
      resourceId: context.accountId,
      resourceType: 'iam-account',
      region: context.region,
      title: 'Could not check password policy',
      description: `Failed to retrieve password policy: ${error instanceof Error ? error.message : 'Unknown error'}`,
      remediation: 'Verify IAM credentials have iam:GetAccountPasswordPolicy permission.',
    });
  }

  return findings;
}

/**
 * Run all IAM security checks
 */
export async function runIAMChecks(context: ScanContext): Promise<SecurityFinding[]> {
  const allFindings = await Promise.all([
    checkRootMFA(context),
    checkPasswordPolicy(context),
    checkUsersWithoutMFA(context),
    checkOldAccessKeys(context),
  ]);

  return allFindings.flat();
}
