import { describe, it, expect, vi, beforeEach } from 'vitest';
import { runRDSChecks, checkRDSBackupRetention } from './rds.js';
import type { ScanContext } from '../types.js';

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('rds backup checks', () => {
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

  describe('checkRDSBackupRetention', () => {
    it('should return medium finding for low backup retention', async () => {
      mockFetch.mockImplementation(async (url, init) => {
        const body = init?.body as string || '';
        if (body.includes('Action=DescribeDBInstances')) {
          return {
            ok: true,
            text: async () => `
              <DescribeDBInstancesResponse xmlns="http://rds.amazonaws.com/doc/2014-10-31/">
                <DBInstances>
                  <DBInstance>
                    <DBInstanceIdentifier>low-retention-db</DBInstanceIdentifier>
                    <BackupRetentionPeriod>1</BackupRetentionPeriod>
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

      const findings = await checkRDSBackupRetention(mockContext);

      expect(findings).toHaveLength(1);
      expect(findings[0].checkId).toBe('rds-backup-retention-low');
      expect(findings[0].severity).toBe('medium');
    });

    it('should return no findings for adequate backup retention', async () => {
      mockFetch.mockImplementation(async (url, init) => {
        const body = init?.body as string || '';
        if (body.includes('Action=DescribeDBInstances')) {
          return {
            ok: true,
            text: async () => `
              <DescribeDBInstancesResponse xmlns="http://rds.amazonaws.com/doc/2014-10-31/">
                <DBInstances>
                  <DBInstance>
                    <DBInstanceIdentifier>good-retention-db</DBInstanceIdentifier>
                    <BackupRetentionPeriod>7</BackupRetentionPeriod>
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

      const findings = await checkRDSBackupRetention(mockContext);

      expect(findings).toHaveLength(0);
    });
  });

  describe('runRDSChecks', () => {
    it('should run all RDS checks and aggregate findings', async () => {
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
                    <StorageEncrypted>true</StorageEncrypted>
                    <PubliclyAccessible>false</PubliclyAccessible>
                    <BackupRetentionPeriod>7</BackupRetentionPeriod>
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

      const findings = await runRDSChecks(mockContext);

      expect(findings).toHaveLength(0);
    });
  });
});
