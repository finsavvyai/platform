/**
 * Credential isolation for skill execution.
 * Prevents UNC6426-style attacks where malicious code scans
 * the process environment for tokens and secrets.
 *
 * Key defenses:
 * 1. Strip all host env vars — only pass declared vars
 * 2. Block access to credential paths (config/, .env, etc.)
 * 3. Prevent process introspection (/proc/self/environ)
 */

/** Environment variables that must NEVER be passed to skills */
const BLOCKED_ENV_KEYS = new Set([
  // Agent credentials
  'OPENSYBER_GATEWAY_TOKEN',
  'OPENSYBER_API_URL',
  'OPENSYBER_INSTANCE_ID',
  // Cloud provider credentials
  'AWS_ACCESS_KEY_ID',
  'AWS_SECRET_ACCESS_KEY',
  'AWS_SESSION_TOKEN',
  'AZURE_CLIENT_SECRET',
  'AZURE_TENANT_ID',
  'GCP_SERVICE_ACCOUNT_KEY',
  'GOOGLE_APPLICATION_CREDENTIALS',
  // CI/CD tokens
  'GITHUB_TOKEN',
  'GITHUB_PAT',
  'GITLAB_TOKEN',
  'CI_JOB_TOKEN',
  // Auth provider secrets
  'CLERK_SECRET_KEY',
  'JWT_SECRET',
  'SESSION_SECRET',
  'ENCRYPTION_KEY',
  // Payment & integration secrets
  'LEMON_SQUEEZY_API_KEY',
  'LEMON_SQUEEZY_WEBHOOK_SECRET',
  'RESEND_API_KEY',
  'HETZNER_API_TOKEN',
  'SOCKET_API_KEY',
  // Database credentials
  'DATABASE_URL',
  'DB_PASSWORD',
  'REDIS_PASSWORD',
]);

/** Filesystem paths that skills must never access */
const BLOCKED_PATHS = [
  '/etc/shadow',
  '/etc/passwd',
  '/proc/self/environ',
  '/proc/self/cmdline',
  '/proc/1/environ',
  '.env',
  '.env.local',
  '.env.production',
  'credentials.json',
  'config/secrets',
  'config/credentials',
  '.ssh/',
  '.gnupg/',
  '.aws/',
  '.azure/',
  '.kube/',
  '.docker/config.json',
];

/**
 * Sanitize environment variables for skill execution.
 * Only passes explicitly declared vars, after filtering blocked keys.
 */
export function sanitizeEnvForSkill(
  declaredKeys: string[],
  secrets: Record<string, string>,
): Record<string, string> {
  const safe: Record<string, string> = {};

  for (const key of declaredKeys) {
    if (BLOCKED_ENV_KEYS.has(key)) {
      console.warn(
        `[CredentialIsolation] Skill requested blocked env: ${key}`,
      );
      continue;
    }
    if (secrets[key] !== undefined) {
      safe[key] = secrets[key];
    }
  }

  return safe;
}

/**
 * Check if a filesystem path is blocked for credential protection.
 */
export function isCredentialPath(filePath: string): boolean {
  const normalized = filePath.replace(/\\/g, '/');
  return BLOCKED_PATHS.some(
    (blocked) =>
      normalized.includes(blocked) ||
      normalized.endsWith(blocked),
  );
}

/**
 * Get the full list of blocked env keys (for audit/logging).
 */
export function getBlockedEnvKeys(): string[] {
  return Array.from(BLOCKED_ENV_KEYS);
}
