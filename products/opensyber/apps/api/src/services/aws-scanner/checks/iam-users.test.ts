import { describe, it, expect, vi, beforeEach } from 'vitest';
import { checkUsersWithoutMFA, checkOldAccessKeys } from './iam.js';
import type { ScanContext } from '../types.js';

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('iam user checks', () => {
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

  describe('checkUsersWithoutMFA', () => {
    it('should return findings for users without MFA', async () => {
      let callCount = 0;
      mockFetch.mockImplementation(async (url, init) => {
        callCount++;
        const body = init?.body as string || '';

        if (body.includes('Action=ListUsers') && callCount === 1) {
          return {
            ok: true,
            text: async () => `
              <ListUsersResponse xmlns="https://iam.amazonaws.com/doc/2010-05-08/">
                <ListUsersResult>
                  <User>
                    <UserId>AIDACKCEVSQ6FEXAMPLE</UserId>
                    <UserName>test-user</UserName>
                    <Arn>arn:aws:iam::123456789012:user/test-user</Arn>
                  </User>
                </ListUsersResult>
              </ListUsersResponse>
            `,
          } as Response;
        }
        if (body.includes('Action=ListMFADevices')) {
          return {
            ok: true,
            text: async () => `
              <ListMFADevicesResponse xmlns="https://iam.amazonaws.com/doc/2010-05-08/">
                <ListMFADevicesResult>
                </ListMFADevicesResult>
              </ListMFADevicesResponse>
            `,
          } as Response;
        }
        return {
          ok: false,
          text: async () => 'Not found',
        } as Response;
      });

      const findings = await checkUsersWithoutMFA(mockContext);

      expect(findings).toHaveLength(1);
      expect(findings[0].checkId).toBe('iam-user-no-mfa');
      expect(findings[0].resourceId).toBe('test-user');
    });
  });

  describe('checkOldAccessKeys', () => {
    it('should return findings for access keys older than 90 days', async () => {
      const ninetyDaysAgo = new Date();
      ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 100);
      const oldDate = ninetyDaysAgo.toISOString();

      mockFetch.mockImplementation(async (url, init) => {
        const body = init?.body as string || '';

        if (body.includes('Action=ListUsers')) {
          return {
            ok: true,
            text: async () => `
              <ListUsersResponse xmlns="https://iam.amazonaws.com/doc/2010-05-08/">
                <ListUsersResult>
                  <User>
                    <UserId>AIDACKCEVSQ6FEXAMPLE</UserId>
                    <UserName>test-user</UserName>
                    <Arn>arn:aws:iam::123456789012:user/test-user</Arn>
                  </User>
                </ListUsersResult>
              </ListUsersResponse>
            `,
          } as Response;
        }
        if (body.includes('Action=ListAccessKeys')) {
          return {
            ok: true,
            text: async () => `
              <ListAccessKeysResponse xmlns="https://iam.amazonaws.com/doc/2010-05-08/">
                <ListAccessKeysResult>
                  <Member>
                    <AccessKeyId>AKIAIOSFODNN7EXAMPLE</AccessKeyId>
                    <Status>Active</Status>
                    <CreateDate>${oldDate}</CreateDate>
                  </Member>
                </ListAccessKeysResult>
              </ListAccessKeysResponse>
            `,
          } as Response;
        }
        return {
          ok: false,
          text: async () => 'Not found',
        } as Response;
      });

      const findings = await checkOldAccessKeys(mockContext);

      expect(findings).toHaveLength(1);
      expect(findings[0].checkId).toBe('iam-access-keys-old');
      expect(findings[0].severity).toBe('medium');
    });

    it('should skip access keys younger than 90 days', async () => {
      const today = new Date();
      const recentDate = today.toISOString();

      mockFetch.mockImplementation(async (url, init) => {
        const body = init?.body as string || '';

        if (body.includes('Action=ListUsers')) {
          return {
            ok: true,
            text: async () => `
              <ListUsersResponse xmlns="https://iam.amazonaws.com/doc/2010-05-08/">
                <ListUsersResult>
                  <User>
                    <UserId>AIDACKCEVSQ6FEXAMPLE</UserId>
                    <UserName>test-user</UserName>
                  </User>
                </ListUsersResult>
              </ListUsersResponse>
            `,
          } as Response;
        }
        if (body.includes('Action=ListAccessKeys')) {
          return {
            ok: true,
            text: async () => `
              <ListAccessKeysResponse xmlns="https://iam.amazonaws.com/doc/2010-05-08/">
                <ListAccessKeysResult>
                  <Member>
                    <AccessKeyId>AKIAIOSFODNN7EXAMPLE</AccessKeyId>
                    <Status>Active</Status>
                    <CreateDate>${recentDate}</CreateDate>
                  </Member>
                </ListAccessKeysResult>
              </ListAccessKeysResponse>
            `,
          } as Response;
        }
        return {
          ok: false,
          text: async () => 'Not found',
        } as Response;
      });

      const findings = await checkOldAccessKeys(mockContext);

      expect(findings).toHaveLength(0);
    });
  });
});
