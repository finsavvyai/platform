/**
 * CSPM finding templates based on top CIS/Prowler checks.
 * Used by the scanner to classify and enrich discovered findings.
 */

export type Severity = 'critical' | 'high' | 'medium' | 'low';

export interface FindingTemplate {
  checkId: string;
  severity: Severity;
  resourceType: string;
  title: string;
  description: string;
  remediation: string;
  frameworks: string[];
}

export const FINDING_TEMPLATES: FindingTemplate[] = [
  {
    checkId: 'CIS-1.4',
    severity: 'critical',
    resourceType: 'iam-user',
    title: 'Root account has active access keys',
    description: 'The AWS root account has active access keys which poses a security risk.',
    remediation: 'Delete root access keys and use IAM users with least privilege.',
    frameworks: ['CIS AWS 1.4', 'SOC2 CC6.1'],
  },
  {
    checkId: 'CIS-1.5',
    severity: 'critical',
    resourceType: 'iam-root',
    title: 'MFA not enabled on root account',
    description: 'The root account does not have multi-factor authentication enabled.',
    remediation: 'Enable hardware MFA on the root account immediately.',
    frameworks: ['CIS AWS 1.5', 'SOC2 CC6.1'],
  },
  {
    checkId: 'CIS-2.1',
    severity: 'high',
    resourceType: 'cloudtrail',
    title: 'CloudTrail not enabled in all regions',
    description: 'CloudTrail is not configured to log events in all AWS regions.',
    remediation: 'Enable CloudTrail with multi-region logging.',
    frameworks: ['CIS AWS 2.1', 'SOC2 CC7.2'],
  },
  {
    checkId: 'CIS-2.6',
    severity: 'medium',
    resourceType: 's3-bucket',
    title: 'S3 bucket access logging disabled',
    description: 'Server access logging is not enabled on S3 buckets.',
    remediation: 'Enable server access logging on all S3 buckets.',
    frameworks: ['CIS AWS 2.6'],
  },
  {
    checkId: 'CIS-4.1',
    severity: 'high',
    resourceType: 'security-group',
    title: 'Security group allows unrestricted SSH (0.0.0.0/0:22)',
    description: 'A security group allows inbound SSH from any IP address.',
    remediation: 'Restrict SSH access to known CIDR blocks.',
    frameworks: ['CIS AWS 4.1', 'SOC2 CC6.6'],
  },
  {
    checkId: 'CIS-4.2',
    severity: 'high',
    resourceType: 'security-group',
    title: 'Security group allows unrestricted RDP (0.0.0.0/0:3389)',
    description: 'A security group allows inbound RDP from any IP address.',
    remediation: 'Restrict RDP access to known CIDR blocks or use SSM.',
    frameworks: ['CIS AWS 4.2', 'SOC2 CC6.6'],
  },
  {
    checkId: 'EC2-EBS-1',
    severity: 'medium',
    resourceType: 'ebs-volume',
    title: 'Unencrypted EBS volume',
    description: 'An EBS volume is not encrypted at rest.',
    remediation: 'Enable default EBS encryption in account settings.',
    frameworks: ['CIS AWS 2.2.1', 'SOC2 CC6.7'],
  },
  {
    checkId: 'RDS-1',
    severity: 'critical',
    resourceType: 'rds-instance',
    title: 'Public RDS instance',
    description: 'An RDS database instance is publicly accessible.',
    remediation: 'Disable public access and use VPC security groups.',
    frameworks: ['CIS AWS 4.3', 'SOC2 CC6.6'],
  },
  {
    checkId: 'S3-1',
    severity: 'critical',
    resourceType: 's3-bucket',
    title: 'Public S3 bucket',
    description: 'An S3 bucket allows public read or write access.',
    remediation: 'Enable S3 Block Public Access and review bucket policies.',
    frameworks: ['CIS AWS 2.1.5', 'SOC2 CC6.6'],
  },
  {
    checkId: 'IAM-PWD-1',
    severity: 'medium',
    resourceType: 'iam-policy',
    title: 'Weak IAM password policy',
    description: 'The account password policy does not meet minimum complexity.',
    remediation: 'Require 14+ chars, uppercase, lowercase, numbers, symbols.',
    frameworks: ['CIS AWS 1.8', 'SOC2 CC6.1'],
  },
];
