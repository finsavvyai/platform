import { describe, it, expect, vi, beforeEach } from 'vitest';
import { checkCloudTrailMultiRegion, checkCloudTrailEncryption } from './cloudtrail.js';
import type { ScanContext } from '../types.js';

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('cloudtrail config checks', () => {
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

  describe('checkCloudTrailMultiRegion', () => {
    it('should return medium finding when no multi-region trail', async () => {
      mockFetch.mockImplementation(async (url, init) => {
        const body = init?.body as string || '';
        if (body.includes('Action=DescribeTrails')) {
          return {
            ok: true,
            text: async () => `
              <DescribeTrailsResponse xmlns="http://trail.amazonaws.com/doc/2013-11-01/">
                <trails>
                  <Trail>
                    <TrailARN>arn:aws:cloudtrail:us-east-1:123456789012:trail/single-region</TrailARN>
                    <IsMultiRegionTrail>false</IsMultiRegionTrail>
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

      const findings = await checkCloudTrailMultiRegion(mockContext);

      expect(findings).toHaveLength(1);
      expect(findings[0].checkId).toBe('cloudtrail-not-multi-region');
      expect(findings[0].severity).toBe('medium');
    });

    it('should return no findings when multi-region trail exists', async () => {
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

      const findings = await checkCloudTrailMultiRegion(mockContext);

      expect(findings).toHaveLength(0);
    });
  });

  describe('checkCloudTrailEncryption', () => {
    it('should return medium finding for unencrypted trail logs', async () => {
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

      const findings = await checkCloudTrailEncryption(mockContext);

      expect(findings).toHaveLength(1);
      expect(findings[0].checkId).toBe('cloudtrail-logs-unencrypted');
      expect(findings[0].severity).toBe('medium');
    });
  });
});
