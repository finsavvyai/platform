import { describe, it, expect, vi, beforeEach } from 'vitest';
import { runCloudTrailChecks, checkCloudTrailLogValidation } from './cloudtrail.js';
import type { ScanContext } from '../types.js';

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('cloudtrail validation checks', () => {
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

  describe('checkCloudTrailLogValidation', () => {
    it('should return low finding for disabled log validation', async () => {
      mockFetch.mockImplementation(async (url, init) => {
        const body = init?.body as string || '';
        if (body.includes('Action=DescribeTrails')) {
          return {
            ok: true,
            text: async () => `
              <DescribeTrailsResponse xmlns="http://trail.amazonaws.com/doc/2013-11-01/">
                <trails>
                  <Trail>
                    <TrailARN>arn:aws:cloudtrail:us-east-1:123456789012:trail/test-trail</TrailARN>
                    <HomeRegion>us-east-1</HomeRegion>
                    <LogFileValidationEnabled>false</LogFileValidationEnabled>
                  </Trail>
                </trails>
              </DescribeTrailsResponse>
            `,
          } as Response;
        }
        return {
          ok: false,
          text: async () => 'Not found',
        } as Response;
      });

      const findings = await checkCloudTrailLogValidation(mockContext);

      expect(findings).toHaveLength(1);
      expect(findings[0].checkId).toBe('cloudtrail-log-validation-disabled');
      expect(findings[0].severity).toBe('low');
    });

    it('should return no findings when log validation enabled', async () => {
      mockFetch.mockImplementation(async (url, init) => {
        const body = init?.body as string || '';
        if (body.includes('Action=DescribeTrails')) {
          return {
            ok: true,
            text: async () => `
              <DescribeTrailsResponse xmlns="http://trail.amazonaws.com/doc/2013-11-01/">
                <trails>
                  <Trail>
                    <TrailARN>arn:aws:cloudtrail:us-east-1:123456789012:trail/test-trail</TrailARN>
                    <HomeRegion>us-east-1</HomeRegion>
                    <LogFileValidationEnabled>true</LogFileValidationEnabled>
                  </Trail>
                </trails>
              </DescribeTrailsResponse>
            `,
          } as Response;
        }
        return {
          ok: false,
          text: async () => 'Not found',
        } as Response;
      });

      const findings = await checkCloudTrailLogValidation(mockContext);

      expect(findings).toHaveLength(0);
    });
  });

  describe('runCloudTrailChecks', () => {
    it('should run all CloudTrail checks and aggregate findings', async () => {
      mockFetch.mockImplementation(async (url, init) => {
        const body = init?.body as string || '';
        if (body.includes('Action=DescribeTrails')) {
          return {
            ok: true,
            text: async () => `
              <DescribeTrailsResponse xmlns="http://trail.amazonaws.com/doc/2013-11-01/">
                <trails>
                  <Trail>
                    <TrailARN>arn:aws:cloudtrail:us-east-1:123456789012:trail/multi-region</TrailARN>
                    <IsMultiRegionTrail>true</IsMultiRegionTrail>
                    <KmsKeyId>arn:aws:kms:us-east-1:123456789012:key/12345678-1234-1234-1234-123456789012</KmsKeyId>
                    <LogFileValidationEnabled>true</LogFileValidationEnabled>
                  </Trail>
                </trails>
              </DescribeTrailsResponse>
            `,
          } as Response;
        }
        return {
          ok: false,
          text: async () => 'Not found',
        } as Response;
      });

      const findings = await runCloudTrailChecks(mockContext);

      expect(findings).toHaveLength(0);
    });
  });
});
