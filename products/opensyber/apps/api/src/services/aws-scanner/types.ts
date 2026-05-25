/**
 * Types for AWS security scanner
 *
 * Defines interfaces for AWS credentials, scan context, check results,
 * and security findings. Used across all AWS scanner modules.
 */

/**
 * Temporary credentials from STS AssumeRole
 */
export interface AWSTemporaryCredentials {
  accessKeyId: string;
  secretAccessKey: string;
  sessionToken: string;
  expiration: string;
}

/**
 * Scan context passed to all check modules
 */
export interface ScanContext {
  accountId: string;
  region: string;
  credentials: AWSTemporaryCredentials;
  externalId?: string;
}

/**
 * Individual security finding
 */
export interface SecurityFinding {
  checkId: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  resourceId: string;
  resourceType: string;
  region: string;
  title: string;
  description: string;
  remediation: string;
  complianceFrameworks?: string[];
  metadata?: Record<string, string | number | boolean>;
}

/**
 * Result from a single security check module
 */
export interface CheckResult {
  checkId: string;
  findings: SecurityFinding[];
  error?: string;
}

/**
 * AWS service regions
 */
export type AWSRegion =
  | 'us-east-1'
  | 'us-east-2'
  | 'us-west-1'
  | 'us-west-2'
  | 'eu-west-1'
  | 'eu-west-2'
  | 'eu-west-3'
  | 'eu-central-1'
  | 'ap-southeast-1'
  | 'ap-southeast-2'
  | 'ap-northeast-1'
  | 'ap-northeast-2'
  | 'ap-south-1'
  | 'sa-east-1'
  | 'ca-central-1';

/**
 * AWS service endpoints for STS
 */
export const AWS_STS_ENDPOINT = 'https://sts.amazonaws.com/';

/**
 * Supported AWS services for scanning
 */
export type AWSService = 's3' | 'iam' | 'ec2' | 'rds' | 'cloudtrail' | 'guardduty' | 'lambda' | 'kms' | 'vpc';

/**
 * Error types for AWS API calls
 */
export interface AWSError {
  code: string;
  message: string;
  type?: string;
}

/**
 * Result from STS AssumeRole operation
 */
export interface AssumeRoleResult {
  credentials: AWSTemporaryCredentials;
  assumedRoleId: string;
  account?: string;
  arn?: string;
}

/**
 * Configuration for cloud account connection
 */
export interface CloudAccountConfig {
  roleArn: string;
  externalId?: string;
  region?: string;
}
