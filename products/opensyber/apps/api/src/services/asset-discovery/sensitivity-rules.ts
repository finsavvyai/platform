/**
 * Sensitivity auto-classification rules for discovered assets.
 * Maps file patterns, env var names, and resource types to sensitivity levels.
 */
import type { SensitivityLevel } from '@opensyber/shared';

const CRITICAL_PATTERNS = [
  /\.pem$/, /\.key$/, /\.p12$/, /\.pfx$/,
  /credentials/, /\.aws\//, /\.ssh\//,
  /secrets?\.ya?ml/, /vault-token/, /master[-_]?key/i,
];

const HIGH_PATTERNS = [
  /\.env/, /\.netrc/, /\.pgpass/,
  /config\.json/, /\.kube\/config/,
  /id_rsa/, /id_ed25519/, /known_hosts/,
];

const LOW_PATTERNS = [
  /node_modules/, /package\.json/, /package-lock/,
  /\.git\//, /\.next\//, /dist\//, /build\//,
  /\.md$/, /\.txt$/, /LICENSE/,
];

export function classifyFileSensitivity(path: string): SensitivityLevel {
  const lower = path.toLowerCase();
  if (CRITICAL_PATTERNS.some((p) => p.test(lower))) return 'critical';
  if (HIGH_PATTERNS.some((p) => p.test(lower))) return 'high';
  if (LOW_PATTERNS.some((p) => p.test(lower))) return 'low';
  return 'medium';
}

const CRITICAL_ENV_VARS = new Set([
  'aws_secret_access_key', 'aws_session_token',
  'database_url', 'db_password', 'master_key',
  'private_key', 'secret_key', 'encryption_key',
]);

const HIGH_ENV_VARS = new Set([
  'api_key', 'auth_token', 'jwt_secret',
  'redis_url', 'mongodb_uri', 'smtp_password',
  'github_token', 'slack_token', 'stripe_key',
]);

export function classifyEnvVarSensitivity(name: string): SensitivityLevel {
  const lower = name.toLowerCase();
  if (CRITICAL_ENV_VARS.has(lower)) return 'critical';
  if (HIGH_ENV_VARS.has(lower)) return 'high';
  if (lower.includes('key') || lower.includes('secret') || lower.includes('token')) return 'high';
  if (lower.includes('url') || lower.includes('host') || lower.includes('port')) return 'medium';
  return 'low';
}

export function classifyCloudResourceSensitivity(resourceType: string, severity: string): SensitivityLevel {
  if (severity === 'critical') return 'critical';
  if (severity === 'high') return 'high';
  const sensitive = ['rds', 'dynamodb', 'secretsmanager', 'kms', 'iam'];
  if (sensitive.some((s) => resourceType.toLowerCase().includes(s))) return 'high';
  return severity === 'medium' ? 'medium' : 'low';
}

export function isCrownJewelCandidate(path: string): boolean {
  const lower = path.toLowerCase();
  return /prod|production|master[-_]?key|customer[-_]?data|pii/i.test(lower);
}
