/**
 * Seed Data Generator
 *
 * Creates a realistic demo asset graph:
 * Cursor agent → ~/.aws/credentials → AWS IAM role → S3/RDS/SecretsManager
 */
import type { DiscoveredAsset, DiscoveredRelation } from './types.js';

export function generateDemoGraph(): {
  assets: DiscoveredAsset[];
  relations: DiscoveredRelation[];
} {
  const assets: DiscoveredAsset[] = [
    // Entry point: agent session
    a('agent_session', 'Cursor Agent Session', 'session-demo-001', 'medium', false, 'agent_activity'),
    // Files accessed by agent
    a('file', 'credentials', '~/.aws/credentials', 'critical', true, 'agent_activity'),
    a('file', '.env', '/app/.env', 'high', false, 'agent_activity'),
    a('file', 'config.yml', '/app/config.yml', 'medium', false, 'agent_activity'),
    a('secret', 'AWS Secret Key', 'secret:~/.aws/credentials', 'critical', true, 'agent_activity'),
    // Env vars
    a('env_var', 'DATABASE_URL', 'DATABASE_URL', 'critical', false, 'agent_activity'),
    a('env_var', 'AWS_SECRET_ACCESS_KEY', 'AWS_SECRET_ACCESS_KEY', 'critical', false, 'agent_activity'),
    a('env_var', 'API_KEY', 'API_KEY', 'high', false, 'agent_activity'),
    // Cloud resources from CSPM
    a('cloud_resource', 'Production RDS', 'arn:aws:rds:us-east-1:123:db/prod', 'critical', true, 'cspm_scan'),
    a('cloud_resource', 'Customer Data S3', 'arn:aws:s3:::customer-data-prod', 'critical', true, 'cspm_scan'),
    a('cloud_resource', 'Staging RDS', 'arn:aws:rds:us-east-1:123:db/staging', 'high', false, 'cspm_scan'),
    ...buckets(8),
    a('cloud_resource', 'Secrets Manager', 'arn:aws:secretsmanager:us-east-1:123:secret/prod', 'critical', true, 'cspm_scan'),
    a('cloud_resource', 'IAM Admin Role', 'arn:aws:iam::123:role/admin', 'high', false, 'cspm_scan'),
    // Database inferred from env
    a('database', 'prod-db.cluster.us-east-1.rds.amazonaws.com', 'prod-db.cluster.us-east-1.rds.amazonaws.com', 'high', false, 'inferred'),
  ];

  const relations: DiscoveredRelation[] = [
    // Session reads files
    r('session-demo-001', '~/.aws/credentials', 'read_access', 1.0, 'agent_activity'),
    r('session-demo-001', '/app/.env', 'read_access', 1.0, 'agent_activity'),
    r('session-demo-001', '/app/config.yml', 'read_access', 1.0, 'agent_activity'),
    r('session-demo-001', 'secret:~/.aws/credentials', 'secret_access', 0.9, 'agent_activity'),
    // Session accesses env vars
    r('session-demo-001', 'DATABASE_URL', 'read_access', 0.8, 'agent_activity'),
    r('session-demo-001', 'AWS_SECRET_ACCESS_KEY', 'read_access', 0.8, 'agent_activity'),
    r('session-demo-001', 'API_KEY', 'read_access', 0.8, 'agent_activity'),
    // AWS credentials → IAM role
    r('~/.aws/credentials', 'arn:aws:iam::123:role/admin', 'authenticates_to', 0.9, 'inferred'),
    // IAM role → cloud resources (write access)
    r('arn:aws:iam::123:role/admin', 'arn:aws:rds:us-east-1:123:db/prod', 'write_access', 0.7, 'iam_policy'),
    r('arn:aws:iam::123:role/admin', 'arn:aws:s3:::customer-data-prod', 'write_access', 0.7, 'iam_policy'),
    r('arn:aws:iam::123:role/admin', 'arn:aws:secretsmanager:us-east-1:123:secret/prod', 'write_access', 0.7, 'iam_policy'),
    r('arn:aws:iam::123:role/admin', 'arn:aws:rds:us-east-1:123:db/staging', 'write_access', 0.7, 'iam_policy'),
    // DATABASE_URL → RDS
    r('DATABASE_URL', 'prod-db.cluster.us-east-1.rds.amazonaws.com', 'authenticates_to', 0.7, 'inferred'),
    r('prod-db.cluster.us-east-1.rds.amazonaws.com', 'arn:aws:rds:us-east-1:123:db/prod', 'network_access', 0.6, 'inferred'),
    // S3 bucket relations
    ...Array.from({ length: 8 }, (_, i) =>
      r('arn:aws:iam::123:role/admin', `arn:aws:s3:::bucket-${i}`, 'read_access', 0.7, 'iam_policy')),
  ];

  return { assets, relations };
}

function a(
  assetType: DiscoveredAsset['assetType'], name: string, identifier: string,
  sensitivity: DiscoveredAsset['sensitivity'], isCrownJewel: boolean,
  discoverySource: DiscoveredAsset['discoverySource'],
): DiscoveredAsset {
  return { assetType, name, identifier, sensitivity, isCrownJewel, discoverySource };
}

function r(
  sourceIdentifier: string, targetIdentifier: string,
  relationType: DiscoveredRelation['relationType'], confidence: number,
  discoverySource: DiscoveredRelation['discoverySource'],
): DiscoveredRelation {
  return { sourceIdentifier, targetIdentifier, relationType, confidence, discoverySource };
}

function buckets(count: number): DiscoveredAsset[] {
  return Array.from({ length: count }, (_, i) =>
    a('cloud_resource', `S3 bucket-${i}`, `arn:aws:s3:::bucket-${i}`, i < 2 ? 'high' : 'medium', false, 'cspm_scan'));
}
