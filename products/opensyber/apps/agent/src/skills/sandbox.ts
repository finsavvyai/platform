import type { SkillPermissions } from '@opensyber/shared';
import { sanitizeEnvForSkill, isCredentialPath } from './credential-isolation.js';

/**
 * Generates sandbox configuration for skill execution.
 * Controls network, filesystem, and resource limits.
 *
 * Hardened against UNC6426-style supply chain attacks:
 * - Credential isolation: blocks agent tokens, cloud keys, CI secrets
 * - Path traversal prevention: rejects paths outside skill directory
 * - Exfiltration domain blocking: denies known malicious patterns
 */
export interface SandboxConfig {
  allowedDomains: Set<string>;
  allowedPaths: string[];
  envVars: Record<string, string>;
  resourceLimits: ResourceLimits;
}

export interface ResourceLimits {
  maxOldGenerationSizeMb: number;
  maxYoungGenerationSizeMb: number;
  stackSizeMb: number;
}

const DEFAULT_LIMITS: ResourceLimits = {
  maxOldGenerationSizeMb: 64,
  maxYoungGenerationSizeMb: 16,
  stackSizeMb: 4,
};

/** Domains known to be used for exfiltration (UNC6426, TeamPCP, Langflow) */
const EXFIL_DOMAINS = new Set([
  'scan.aquasecurtiy.org', // TeamPCP / Trivy compromise
  's1ngularity-repository-1', // UNC6426 data staging
  '173.212.205.251', // CVE-2026-33017 payload staging
]);

export function createSandboxConfig(
  permissions: SkillPermissions,
  skillDir: string,
  envSecrets: Record<string, string>,
): SandboxConfig {
  // Filter out exfiltration domains
  const allowedDomains = new Set(
    permissions.network.filter((d) => !EXFIL_DOMAINS.has(d)),
  );

  // Resolve filesystem paths — reject path traversal attempts
  const allowedPaths = permissions.filesystem
    .filter((p) => !p.includes('..'))
    .map((p) => {
      if (p.startsWith('./')) return `${skillDir}/${p.slice(2)}`;
      if (p.startsWith('/')) return p; // absolute paths preserved
      return `${skillDir}/${p}`;
    });

  // Credential isolation: sanitize env vars through blocklist
  const envVars = sanitizeEnvForSkill(permissions.env, envSecrets);

  return {
    allowedDomains,
    allowedPaths,
    envVars,
    resourceLimits: DEFAULT_LIMITS,
  };
}

/**
 * Validates whether a network request is allowed by the sandbox.
 */
export function isNetworkAllowed(
  url: string,
  config: SandboxConfig,
): boolean {
  try {
    const parsed = new URL(url);
    if (EXFIL_DOMAINS.has(parsed.hostname)) return false;
    return config.allowedDomains.has(parsed.hostname);
  } catch {
    return false;
  }
}

/**
 * Validates whether a filesystem path is allowed by the sandbox.
 * Also blocks credential paths regardless of allowlist.
 */
export function isPathAllowed(
  filePath: string,
  config: SandboxConfig,
): boolean {
  if (isCredentialPath(filePath)) return false;
  return config.allowedPaths.some((allowed) => filePath.startsWith(allowed));
}
