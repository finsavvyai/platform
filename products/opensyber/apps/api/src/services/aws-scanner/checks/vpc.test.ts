/**
 * VPC Security Check Tests
 */
import { describe, it, expect, vi } from 'vitest';
import type { ScanContext } from '../types.js';
import { checkVpcFlowLogs, runVPCChecks } from './vpc.js';

const ctx: ScanContext = {
  accountId: '123456789012', region: 'us-east-1',
  credentials: { accessKeyId: 'AKIA', secretAccessKey: 'secret', sessionToken: 'token', expiration: '2099-01-01' },
};

vi.mock('./ec2-request.js', () => ({
  ec2Request: vi.fn(async (_ctx: ScanContext, action: string) => {
    if (action === 'DescribeVpcs') {
      return `<DescribeVpcsResponse><vpcSet><item><vpcId>vpc-1</vpcId></item><item><vpcId>vpc-2</vpcId></item></vpcSet></DescribeVpcsResponse>`;
    }
    if (action === 'DescribeFlowLogs') {
      return `<DescribeFlowLogsResponse><flowLogSet><item><resourceId>vpc-1</resourceId></item></flowLogSet></DescribeFlowLogsResponse>`;
    }
    return '<Response/>';
  }),
  parser: {
    parse: vi.fn((xml: string) => {
      if (xml.includes('DescribeVpcsResponse')) {
        return {
          DescribeVpcsResponse: {
            vpcSet: { item: [{ vpcId: 'vpc-1' }, { vpcId: 'vpc-2' }] },
          },
        };
      }
      if (xml.includes('DescribeFlowLogsResponse')) {
        return {
          DescribeFlowLogsResponse: {
            flowLogSet: { item: [{ resourceId: 'vpc-1' }] },
          },
        };
      }
      return {};
    }),
  },
}));

describe('VPC checks', () => {
  it('detects VPCs without flow logs', async () => {
    const findings = await checkVpcFlowLogs(ctx);
    expect(findings).toHaveLength(1);
    expect(findings[0].checkId).toBe('vpc-flow-logs-disabled');
    expect(findings[0].resourceId).toBe('vpc-2');
  });

  it('runVPCChecks returns findings', async () => {
    const findings = await runVPCChecks(ctx);
    expect(findings).toHaveLength(1);
  });
});
