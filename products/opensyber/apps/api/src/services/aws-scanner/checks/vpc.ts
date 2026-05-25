/**
 * VPC Security Checks
 *
 * Checks for VPC flow log configuration.
 */
import type { ScanContext, SecurityFinding } from '../types.js';
import { ec2Request, parser } from './ec2-request.js';

export async function checkVpcFlowLogs(ctx: ScanContext): Promise<SecurityFinding[]> {
  const findings: SecurityFinding[] = [];
  try {
    const vpcsResp = await ec2Request(ctx, 'DescribeVpcs', {});
    const vpcs = parser.parse(vpcsResp);
    const vpcList = vpcs?.DescribeVpcsResponse?.vpcSet?.item || [];
    const vpcsArr = Array.isArray(vpcList) ? vpcList : vpcList ? [vpcList] : [];

    const flowResp = await ec2Request(ctx, 'DescribeFlowLogs', {});
    const flowLogs = parser.parse(flowResp);
    const flowList = flowLogs?.DescribeFlowLogsResponse?.flowLogSet?.item || [];
    const flowsArr = Array.isArray(flowList) ? flowList : flowList ? [flowList] : [];

    const vpcIdsWithFlowLogs = new Set(
      flowsArr.map((f: Record<string, unknown>) => {
        const raw = f?.resourceId;
        return typeof raw === 'object' ? (raw as Record<string, string>)?.['#text'] : raw;
      }),
    );

    for (const vpc of vpcsArr) {
      const vpcIdRaw = vpc?.vpcId;
      const vpcId = typeof vpcIdRaw === 'object' ? vpcIdRaw?.['#text'] : vpcIdRaw;

      if (!vpcIdsWithFlowLogs.has(vpcId)) {
        findings.push({
          checkId: 'vpc-flow-logs-disabled', severity: 'medium',
          resourceId: vpcId || 'unknown', resourceType: 'vpc', region: ctx.region,
          title: 'VPC flow logs not enabled',
          description: `VPC "${vpcId}" does not have flow logs enabled for network traffic monitoring.`,
          remediation: 'Enable VPC flow logs to CloudWatch Logs or S3 for network traffic analysis.',
          complianceFrameworks: ['CIS AWS 2.9', 'SOC2 CC7.2'],
        });
      }
    }
  } catch (error) {
    findings.push({
      checkId: 'vpc-flow-logs-disabled', severity: 'low',
      resourceId: ctx.accountId, resourceType: 'vpc-account', region: ctx.region,
      title: 'Could not check VPC flow logs',
      description: `Failed: ${error instanceof Error ? error.message : 'Unknown'}`,
      remediation: 'Verify IAM credentials have ec2:DescribeVpcs and ec2:DescribeFlowLogs permissions.',
    });
  }
  return findings;
}

export async function runVPCChecks(ctx: ScanContext): Promise<SecurityFinding[]> {
  return checkVpcFlowLogs(ctx);
}
