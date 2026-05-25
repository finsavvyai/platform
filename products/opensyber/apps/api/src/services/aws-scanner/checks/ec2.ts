/**
 * EC2 Security Checks -- security groups with open ports, public IPs, monitoring.
 * Based on CIS AWS Foundations Benchmark and Prowler best practices.
 */
import type { ScanContext, SecurityFinding } from '../types.js';
import { ec2Request, parser } from './ec2-request.js';

/**
 * Check EC2.1: Security group with SSH (port 22) open to 0.0.0.0/0
 */
export async function checkEC2OpenSSH(context: ScanContext): Promise<SecurityFinding[]> {
  const findings: SecurityFinding[] = [];

  try {
    const response = await ec2Request(context, 'DescribeSecurityGroups', {});
    const parsed = parser.parse(response);
    const groups = parsed?.DescribeSecurityGroupsResponse?.securityGroupInfo?.item || [];
    const groupsList = Array.isArray(groups) ? groups : groups ? [groups] : [];

    for (const group of groupsList) {
      const groupId = typeof group?.groupId === 'object' ? group?.groupId?.['#text'] : group?.groupId;
      const groupName = typeof group?.groupName === 'object' ? group?.groupName?.['#text'] : group?.groupName;
      const rules = group?.ipPermissions?.item || [];
      const rulesList = Array.isArray(rules) ? rules : rules ? [rules] : [];

      for (const rule of rulesList) {
        const ipRanges = rule?.ipRanges?.item || [];
        const ipRangesList = Array.isArray(ipRanges) ? ipRanges : ipRanges ? [ipRanges] : [];

        const fromPortRaw = rule?.fromPort;
        const fromPort = typeof fromPortRaw === 'object' ? fromPortRaw?.['#text'] : fromPortRaw;
        const toPortRaw = rule?.toPort;
        const toPort = typeof toPortRaw === 'object' ? toPortRaw?.['#text'] : toPortRaw;

        for (const range of ipRangesList) {
          const cidrRaw = range?.cidrIp;
          const cidr = typeof cidrRaw === 'object' ? cidrRaw?.['#text'] : cidrRaw;

          if (cidr === '0.0.0.0/0' && fromPort <= 22 && toPort >= 22) {
            findings.push({
              checkId: 'ec2-security-group-ssh-open',
              severity: 'high',
              resourceId: groupId || groupName || 'unknown',
              resourceType: 'ec2-security-group',
              region: context.region,
              title: 'Security group allows SSH from 0.0.0.0/0',
              description: `Security group "${groupId || groupName}" allows SSH (port 22) access from the entire internet.`,
              remediation: 'Restrict SSH access to specific IP ranges or use AWS Systems Manager Session Manager.',
              complianceFrameworks: ['CIS AWS 4.1', 'SOC2 CC6.6'],
            });
          }
        }
      }
    }
  } catch (error) {
    findings.push({
      checkId: 'ec2-security-group-ssh-open',
      severity: 'low',
      resourceId: context.accountId,
      resourceType: 'ec2-account',
      region: context.region,
      title: 'Could not check EC2 security groups',
      description: `Failed to check security groups: ${error instanceof Error ? error.message : 'Unknown error'}`,
      remediation: 'Verify IAM credentials have ec2:DescribeSecurityGroups permission.',
    });
  }

  return findings;
}

/**
 * Check EC2.2: Security group with RDP (port 3389) open to 0.0.0.0/0
 */
export async function checkEC2OpenRDP(context: ScanContext): Promise<SecurityFinding[]> {
  const findings: SecurityFinding[] = [];

  try {
    const response = await ec2Request(context, 'DescribeSecurityGroups', {});
    const parsed = parser.parse(response);
    const groups = parsed?.DescribeSecurityGroupsResponse?.securityGroupInfo?.item || [];
    const groupsList = Array.isArray(groups) ? groups : groups ? [groups] : [];

    for (const group of groupsList) {
      const groupId = typeof group?.groupId === 'object' ? group?.groupId?.['#text'] : group?.groupId;
      const groupName = typeof group?.groupName === 'object' ? group?.groupName?.['#text'] : group?.groupName;
      const rules = group?.ipPermissions?.item || [];
      const rulesList = Array.isArray(rules) ? rules : rules ? [rules] : [];

      for (const rule of rulesList) {
        const ipRanges = rule?.ipRanges?.item || [];
        const ipRangesList = Array.isArray(ipRanges) ? ipRanges : ipRanges ? [ipRanges] : [];

        const fromPortRaw = rule?.fromPort;
        const fromPort = typeof fromPortRaw === 'object' ? fromPortRaw?.['#text'] : fromPortRaw;
        const toPortRaw = rule?.toPort;
        const toPort = typeof toPortRaw === 'object' ? toPortRaw?.['#text'] : toPortRaw;

        for (const range of ipRangesList) {
          const cidrRaw = range?.cidrIp;
          const cidr = typeof cidrRaw === 'object' ? cidrRaw?.['#text'] : cidrRaw;

          if (cidr === '0.0.0.0/0' && fromPort <= 3389 && toPort >= 3389) {
            findings.push({
              checkId: 'ec2-security-group-rdp-open',
              severity: 'high',
              resourceId: groupId || groupName || 'unknown',
              resourceType: 'ec2-security-group',
              region: context.region,
              title: 'Security group allows RDP from 0.0.0.0/0',
              description: `Security group "${groupId || groupName}" allows RDP (port 3389) access from the entire internet.`,
              remediation: 'Restrict RDP access to specific IP ranges or use AWS Systems Manager Session Manager.',
              complianceFrameworks: ['CIS AWS 4.2', 'SOC2 CC6.6'],
            });
          }
        }
      }
    }
  } catch (error) {
    findings.push({
      checkId: 'ec2-security-group-rdp-open',
      severity: 'low',
      resourceId: context.accountId,
      resourceType: 'ec2-account',
      region: context.region,
      title: 'Could not check EC2 security groups',
      description: `Failed to check security groups: ${error instanceof Error ? error.message : 'Unknown error'}`,
      remediation: 'Verify IAM credentials have ec2:DescribeSecurityGroups permission.',
    });
  }

  return findings;
}

/**
 * Check EC2.3: EC2 instances with public IP addresses
 */
export async function checkEC2PublicIP(context: ScanContext): Promise<SecurityFinding[]> {
  const findings: SecurityFinding[] = [];

  try {
    const response = await ec2Request(context, 'DescribeInstances', {});
    const parsed = parser.parse(response);
    const reservations = parsed?.DescribeInstancesResponse?.reservationSet?.item || [];
    const reservationsList = Array.isArray(reservations) ? reservations : reservations ? [reservations] : [];

    for (const reservation of reservationsList) {
      const instances = reservation?.instancesSet?.item || [];
      const instancesList = Array.isArray(instances) ? instances : instances ? [instances] : [];

      for (const instance of instancesList) {
        const instanceId = typeof instance?.instanceId === 'object' ? instance?.instanceId?.['#text'] : instance?.instanceId;
        const publicIpRaw = instance?.ipAddress;
        const publicIp = typeof publicIpRaw === 'object' ? publicIpRaw?.['#text'] : publicIpRaw;

        if (publicIp) {
          findings.push({
            checkId: 'ec2-instance-public-ip',
            severity: 'medium',
            resourceId: instanceId || 'unknown',
            resourceType: 'ec2-instance',
            region: context.region,
            title: 'EC2 instance has public IP address',
            description: `Instance "${instanceId}" has a public IP address (${publicIp}), making it directly accessible from the internet.`,
            remediation: 'Remove public IP or place instance in private subnets with NAT/bastion access.',
            complianceFrameworks: ['CIS AWS 4.3', 'SOC2 CC6.6'],
          });
        }
      }
    }
  } catch (error) {
    findings.push({
      checkId: 'ec2-instance-public-ip',
      severity: 'low',
      resourceId: context.accountId,
      resourceType: 'ec2-account',
      region: context.region,
      title: 'Could not check EC2 instances',
      description: `Failed to check instances: ${error instanceof Error ? error.message : 'Unknown error'}`,
      remediation: 'Verify IAM credentials have ec2:DescribeInstances permission.',
    });
  }

  return findings;
}

/**
 * Run all EC2 security checks
 */
export async function runEC2Checks(context: ScanContext): Promise<SecurityFinding[]> {
  const allFindings = await Promise.all([
    checkEC2OpenSSH(context),
    checkEC2OpenRDP(context),
    checkEC2PublicIP(context),
  ]);

  return allFindings.flat();
}
