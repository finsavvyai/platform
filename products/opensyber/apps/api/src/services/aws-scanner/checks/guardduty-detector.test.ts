import { describe, it, expect, vi, beforeEach } from 'vitest';
import { checkGuardDutyDetectorStatus } from './guardduty.js';
import type { ScanContext } from '../types.js';

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('guardduty detector status checks', () => {
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

  describe('checkGuardDutyDetectorStatus', () => {
    it('should return high finding for disabled detector', async () => {
      mockFetch.mockImplementation(async (url, init) => {
        const body = init?.body as string || '';
        if (body.includes('Action=ListDetectors')) {
          return {
            ok: true,
            text: async () => `
              <ListDetectorsResponse xmlns="https://guardduty.amazonaws.com/2017-11-28/">
                <detectorIds>
                  <member>12abc34d567e8fa901bc2d34example56</member>
                </detectorIds>
              </ListDetectorsResponse>
            `,
          } as Response;
        }
        if (body.includes('Action=GetDetector')) {
          return {
            ok: true,
            text: async () => `
              <GetDetectorResponse xmlns="https://guardduty.amazonaws.com/2017-11-28/">
                <data>
                  <status>DISABLED</status>
                </data>
              </GetDetectorResponse>
            `,
          } as Response;
        }
        return {
          ok: false,
          text: async () => 'Not found',
        } as Response;
      });

      const findings = await checkGuardDutyDetectorStatus(mockContext);

      expect(findings).toHaveLength(1);
      expect(findings[0].checkId).toBe('guardduty-detector-disabled');
      expect(findings[0].severity).toBe('high');
    });

    it('should return no findings for enabled detector', async () => {
      mockFetch.mockImplementation(async (url, init) => {
        const body = init?.body as string || '';
        if (body.includes('Action=ListDetectors')) {
          return {
            ok: true,
            text: async () => `
              <ListDetectorsResponse xmlns="https://guardduty.amazonaws.com/2017-11-28/">
                <detectorIds>
                  <member>12abc34d567e8fa901bc2d34example56</member>
                </detectorIds>
              </ListDetectorsResponse>
            `,
          } as Response;
        }
        if (body.includes('Action=GetDetector')) {
          return {
            ok: true,
            text: async () => `
              <GetDetectorResponse xmlns="https://guardduty.amazonaws.com/2017-11-28/">
                <data>
                  <status>ENABLED</status>
                </data>
              </GetDetectorResponse>
            `,
          } as Response;
        }
        return {
          ok: false,
          text: async () => 'Not found',
        } as Response;
      });

      const findings = await checkGuardDutyDetectorStatus(mockContext);

      expect(findings).toHaveLength(0);
    });
  });
});
