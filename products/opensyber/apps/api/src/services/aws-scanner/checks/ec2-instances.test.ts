import { describe, it, expect, vi, beforeEach } from 'vitest';
import { runEC2Checks, checkEC2PublicIP } from './ec2.js';
import type { ScanContext } from '../types.js';

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('ec2 instance checks', () => {
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

  describe('checkEC2PublicIP', () => {
    it('should return medium finding for instances with public IP', async () => {
      mockFetch.mockImplementation(async (url, init) => {
        const body = init?.body as string || '';
        if (body.includes('Action=DescribeInstances')) {
          return {
            ok: true,
            text: async () => `
              <DescribeInstancesResponse xmlns="http://ec2.amazonaws.com/doc/2016-11-15/">
                <reservationSet>
                  <item>
                    <instancesSet>
                      <item>
                        <instanceId>i-1234567890abcdef0</instanceId>
                        <ipAddress>54.1.2.3</ipAddress>
                      </item>
                    </instancesSet>
                  </item>
                </reservationSet>
              </DescribeInstancesResponse>
            `,
          } as Response;
        }
        return {
          ok: false,
          text: async () => 'Not found',
        } as Response;
      });

      const findings = await checkEC2PublicIP(mockContext);

      expect(findings).toHaveLength(1);
      expect(findings[0].checkId).toBe('ec2-instance-public-ip');
      expect(findings[0].severity).toBe('medium');
      expect(findings[0].resourceId).toBe('i-1234567890abcdef0');
    });

    it('should return no findings for private instances', async () => {
      mockFetch.mockImplementation(async (url, init) => {
        const body = init?.body as string || '';
        if (body.includes('Action=DescribeInstances')) {
          return {
            ok: true,
            text: async () => `
              <DescribeInstancesResponse xmlns="http://ec2.amazonaws.com/doc/2016-11-15/">
                <reservationSet>
                  <item>
                    <instancesSet>
                      <item>
                        <instanceId>i-abcdef0123456789a</instanceId>
                      </item>
                    </instancesSet>
                  </item>
                </reservationSet>
              </DescribeInstancesResponse>
            `,
          } as Response;
        }
        return {
          ok: false,
          text: async () => 'Not found',
        } as Response;
      });

      const findings = await checkEC2PublicIP(mockContext);

      expect(findings).toHaveLength(0);
    });
  });

  describe('runEC2Checks', () => {
    it('should run all EC2 checks and aggregate findings', async () => {
      mockFetch.mockImplementation(async (url, init) => {
        const body = init?.body as string || '';
        if (body.includes('Action=DescribeSecurityGroups')) {
          return {
            ok: true,
            text: async () => `
              <DescribeSecurityGroupsResponse xmlns="http://ec2.amazonaws.com/doc/2016-11-15/">
                <securityGroupInfo></securityGroupInfo>
              </DescribeSecurityGroupsResponse>
            `,
          } as Response;
        }
        if (body.includes('Action=DescribeInstances')) {
          return {
            ok: true,
            text: async () => `
              <DescribeInstancesResponse xmlns="http://ec2.amazonaws.com/doc/2016-11-15/">
                <reservationSet></reservationSet>
              </DescribeInstancesResponse>
            `,
          } as Response;
        }
        return {
          ok: false,
          text: async () => 'Not found',
        } as Response;
      });

      const findings = await runEC2Checks(mockContext);

      // No security groups or instances, so no findings
      expect(findings).toHaveLength(0);
    });
  });
});
