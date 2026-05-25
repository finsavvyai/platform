import { describe, it, expect, vi, beforeEach } from 'vitest';
import { runIAMChecks, checkRootMFA, checkPasswordPolicy } from './iam.js';
import type { ScanContext } from '../types.js';

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('iam account checks', () => {
  let mockContext: ScanContext;

  beforeEach(() => {
    vi.clearAllMocks();
    mockFetch.mockReset();

    mockContext = {
      accountId: '123456789012',
      region: 'us-east-1',
      credentials: {
        accessKeyId: 'ASIATEST',
        secretAccessKey: 'test-secret',
        sessionToken: 'test-token',
        expiration: '2025-03-04T12:00:00Z',
      },
    };
  });

  describe('checkRootMFA', () => {
    it('should return critical finding when root MFA disabled', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: async () => `
          <GetAccountSummaryResponse xmlns="https://iam.amazonaws.com/doc/2010-05-08/">
            <GetAccountSummaryResult>
              <AccountMFAEnabled>0</AccountMFAEnabled>
            </GetAccountSummaryResult>
          </GetAccountSummaryResponse>
        `,
      } as Response);

      const findings = await checkRootMFA(mockContext);

      expect(findings).toHaveLength(1);
      expect(findings[0].checkId).toBe('iam-root-mfa-disabled');
      expect(findings[0].severity).toBe('critical');
    });

    it('should return no findings when root MFA enabled', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: async () => `
          <GetAccountSummaryResponse xmlns="https://iam.amazonaws.com/doc/2010-05-08/">
            <GetAccountSummaryResult>
              <AccountMFAEnabled>1</AccountMFAEnabled>
            </GetAccountSummaryResult>
          </GetAccountSummaryResponse>
        `,
      } as Response);

      const findings = await checkRootMFA(mockContext);

      expect(findings).toHaveLength(0);
    });
  });

  describe('checkPasswordPolicy', () => {
    it('should return finding for weak password policy', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: async () => `
          <GetAccountPasswordPolicyResponse xmlns="https://iam.amazonaws.com/doc/2010-05-08/">
            <GetAccountPasswordPolicyResult>
              <MinimumPasswordLength>8</MinimumPasswordLength>
              <RequireSymbols>false</RequireSymbols>
              <RequireNumbers>true</RequireNumbers>
              <RequireUppercaseCharacters>false</RequireUppercaseCharacters>
              <RequireLowercaseCharacters>false</RequireLowercaseCharacters>
            </GetAccountPasswordPolicyResult>
          </GetAccountPasswordPolicyResponse>
        `,
      } as Response);

      const findings = await checkPasswordPolicy(mockContext);

      expect(findings).toHaveLength(1);
      expect(findings[0].checkId).toBe('iam-password-policy-weak');
      expect(findings[0].severity).toBe('medium');
    });

    it('should return no findings for strong password policy', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: async () => `
          <GetAccountPasswordPolicyResponse xmlns="https://iam.amazonaws.com/doc/2010-05-08/">
            <GetAccountPasswordPolicyResult>
              <MinimumPasswordLength>14</MinimumPasswordLength>
              <RequireSymbols>true</RequireSymbols>
              <RequireNumbers>true</RequireNumbers>
              <RequireUppercaseCharacters>true</RequireUppercaseCharacters>
              <RequireLowercaseCharacters>true</RequireLowercaseCharacters>
            </GetAccountPasswordPolicyResult>
          </GetAccountPasswordPolicyResponse>
        `,
      } as Response);

      const findings = await checkPasswordPolicy(mockContext);

      expect(findings).toHaveLength(0);
    });
  });

  describe('runIAMChecks', () => {
    it('should run all IAM checks and aggregate findings', async () => {
      mockFetch.mockImplementation(async (url, init) => {
        const body = init?.body as string || '';
        const urlString = typeof url === 'string' ? url : url.toString();

        if (urlString.includes('GetAccountSummary')) {
          return {
            ok: true,
            text: async () => `
              <GetAccountSummaryResponse xmlns="https://iam.amazonaws.com/doc/2010-05-08/">
                <GetAccountSummaryResult>
                  <AccountMFAEnabled>0</AccountMFAEnabled>
                </GetAccountSummaryResult>
              </GetAccountSummaryResponse>
            `,
          } as Response;
        }
        if (urlString.includes('GetAccountPasswordPolicy')) {
          return {
            ok: true,
            text: async () => `
              <GetAccountPasswordPolicyResponse xmlns="https://iam.amazonaws.com/doc/2010-05-08/">
                <GetAccountPasswordPolicyResult>
                  <MinimumPasswordLength>6</MinimumPasswordLength>
                </GetAccountPasswordPolicyResult>
              </GetAccountPasswordPolicyResponse>
            `,
          } as Response;
        }
        return {
          ok: true,
          text: async () => `
            <ListUsersResponse xmlns="https://iam.amazonaws.com/doc/2010-05-08/">
              <ListUsersResult>
              </ListUsersResult>
            </ListUsersResponse>
          `,
        } as Response;
      });

      const findings = await runIAMChecks(mockContext);

      expect(findings.length).toBeGreaterThan(0);
      // Should have root MFA finding
      expect(findings.some((f) => f.checkId === 'iam-root-mfa-disabled')).toBe(true);
    });
  });
});
