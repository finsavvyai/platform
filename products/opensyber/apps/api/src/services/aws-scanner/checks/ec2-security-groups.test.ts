import { describe, it, expect, vi, beforeEach } from 'vitest';
import { checkEC2OpenSSH, checkEC2OpenRDP } from './ec2.js';
import type { ScanContext } from '../types.js';

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('ec2 security group checks', () => {
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

  describe('checkEC2OpenSSH', () => {
    it('should return high finding for SSH open to 0.0.0.0/0', async () => {
      mockFetch.mockImplementation(async (url, init) => {
        const body = init?.body as string || '';
        if (body.includes('Action=DescribeSecurityGroups')) {
          return {
            ok: true,
            text: async () => `
              <DescribeSecurityGroupsResponse xmlns="http://ec2.amazonaws.com/doc/2016-11-15/">
                <securityGroupInfo>
                  <item>
                    <groupId>sg-12345678</groupId>
                    <groupName>ssh-open</groupName>
                    <ipPermissions>
                      <item>
                        <fromPort>22</fromPort>
                        <toPort>22</toPort>
                        <ipRanges>
                          <item>
                            <cidrIp>0.0.0.0/0</cidrIp>
                          </item>
                        </ipRanges>
                      </item>
                    </ipPermissions>
                  </item>
                </securityGroupInfo>
              </DescribeSecurityGroupsResponse>
            `,
          } as Response;
        }
        return {
          ok: false,
          text: async () => 'Not found',
        } as Response;
      });

      const findings = await checkEC2OpenSSH(mockContext);

      expect(findings).toHaveLength(1);
      expect(findings[0].checkId).toBe('ec2-security-group-ssh-open');
      expect(findings[0].severity).toBe('high');
      expect(findings[0].resourceId).toBe('sg-12345678');
    });

    it('should return no findings when SSH is not open to world', async () => {
      mockFetch.mockImplementation(async (url, init) => {
        const body = init?.body as string || '';
        if (body.includes('Action=DescribeSecurityGroups')) {
          return {
            ok: true,
            text: async () => `
              <DescribeSecurityGroupsResponse xmlns="http://ec2.amazonaws.com/doc/2016-11-15/">
                <securityGroupInfo>
                  <item>
                    <groupId>sg-87654321</groupId>
                    <groupName>ssh-restricted</groupName>
                    <ipPermissions>
                      <item>
                        <fromPort>22</fromPort>
                        <toPort>22</toPort>
                        <ipRanges>
                          <item>
                            <cidrIp>10.0.0.0/8</cidrIp>
                          </item>
                        </ipRanges>
                      </item>
                    </ipPermissions>
                  </item>
                </securityGroupInfo>
              </DescribeSecurityGroupsResponse>
            `,
          } as Response;
        }
        return {
          ok: false,
          text: async () => 'Not found',
        } as Response;
      });

      const findings = await checkEC2OpenSSH(mockContext);

      expect(findings).toHaveLength(0);
    });
  });

  describe('checkEC2OpenRDP', () => {
    it('should return high finding for RDP open to 0.0.0.0/0', async () => {
      mockFetch.mockImplementation(async (url, init) => {
        const body = init?.body as string || '';
        if (body.includes('Action=DescribeSecurityGroups')) {
          return {
            ok: true,
            text: async () => `
              <DescribeSecurityGroupsResponse xmlns="http://ec2.amazonaws.com/doc/2016-11-15/">
                <securityGroupInfo>
                  <item>
                    <groupId>sg-11111111</groupId>
                    <groupName>rdp-open</groupName>
                    <ipPermissions>
                      <item>
                        <fromPort>3389</fromPort>
                        <toPort>3389</toPort>
                        <ipRanges>
                          <item>
                            <cidrIp>0.0.0.0/0</cidrIp>
                          </item>
                        </ipRanges>
                      </item>
                    </ipPermissions>
                  </item>
                </securityGroupInfo>
              </DescribeSecurityGroupsResponse>
            `,
          } as Response;
        }
        return {
          ok: false,
          text: async () => 'Not found',
        } as Response;
      });

      const findings = await checkEC2OpenRDP(mockContext);

      expect(findings).toHaveLength(1);
      expect(findings[0].checkId).toBe('ec2-security-group-rdp-open');
      expect(findings[0].severity).toBe('high');
    });
  });
});
