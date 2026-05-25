import { describe, it, expect, vi, beforeEach } from 'vitest';
import { checkRDSEncryption, checkRDSPublicAccess } from './rds.js';
import type { ScanContext } from '../types.js';

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('rds security checks', () => {
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

  describe('checkRDSEncryption', () => {
    it('should return high finding for unencrypted RDS instance', async () => {
      mockFetch.mockImplementation(async (url, init) => {
        const body = init?.body as string || '';
        if (body.includes('Action=DescribeDBInstances')) {
          return {
            ok: true,
            text: async () => `
              <DescribeDBInstancesResponse xmlns="http://rds.amazonaws.com/doc/2014-10-31/">
                <DBInstances>
                  <DBInstance>
                    <DBInstanceIdentifier>test-db</DBInstanceIdentifier>
                    <StorageEncrypted>false</StorageEncrypted>
                  </DBInstance>
                </DBInstances>
              </DescribeDBInstancesResponse>
            `,
          } as Response;
        }
        return {
          ok: false,
          text: async () => 'Not found',
        } as Response;
      });

      const findings = await checkRDSEncryption(mockContext);

      expect(findings).toHaveLength(1);
      expect(findings[0].checkId).toBe('rds-instance-unencrypted');
      expect(findings[0].severity).toBe('high');
      expect(findings[0].resourceId).toBe('test-db');
    });

    it('should return no findings for encrypted RDS instance', async () => {
      mockFetch.mockImplementation(async (url, init) => {
        const body = init?.body as string || '';
        if (body.includes('Action=DescribeDBInstances')) {
          return {
            ok: true,
            text: async () => `
              <DescribeDBInstancesResponse xmlns="http://rds.amazonaws.com/doc/2014-10-31/">
                <DBInstances>
                  <DBInstance>
                    <DBInstanceIdentifier>encrypted-db</DBInstanceIdentifier>
                    <StorageEncrypted>true</StorageEncrypted>
                  </DBInstance>
                </DBInstances>
              </DescribeDBInstancesResponse>
            `,
          } as Response;
        }
        return {
          ok: false,
          text: async () => 'Not found',
        } as Response;
      });

      const findings = await checkRDSEncryption(mockContext);

      expect(findings).toHaveLength(0);
    });
  });

  describe('checkRDSPublicAccess', () => {
    it('should return critical finding for publicly accessible RDS', async () => {
      mockFetch.mockImplementation(async (url, init) => {
        const body = init?.body as string || '';
        if (body.includes('Action=DescribeDBInstances')) {
          return {
            ok: true,
            text: async () => `
              <DescribeDBInstancesResponse xmlns="http://rds.amazonaws.com/doc/2014-10-31/">
                <DBInstances>
                  <DBInstance>
                    <DBInstanceIdentifier>public-db</DBInstanceIdentifier>
                    <PubliclyAccessible>true</PubliclyAccessible>
                  </DBInstance>
                </DBInstances>
              </DescribeDBInstancesResponse>
            `,
          } as Response;
        }
        return {
          ok: false,
          text: async () => 'Not found',
        } as Response;
      });

      const findings = await checkRDSPublicAccess(mockContext);

      expect(findings).toHaveLength(1);
      expect(findings[0].checkId).toBe('rds-instance-public');
      expect(findings[0].severity).toBe('critical');
    });
  });
});
