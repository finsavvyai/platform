/**
 * Supply chain security assessment service.
 * Evaluates skill packages and dependencies against known
 * attack patterns (UNC6426, TeamPCP, hackerbot-claw).
 *
 * Used by the compliance engine for:
 * - SOC 2 CC6.1 (Logical access security)
 * - NIST CSF PR.DS-6 (Integrity checking)
 * - ISO 27001 A.12.5.1 (Installation of software)
 */

export interface SupplyChainRisk {
  category: SupplyChainRiskCategory;
  severity: 'critical' | 'high' | 'medium' | 'low';
  description: string;
  mitigation: string;
}

export type SupplyChainRiskCategory =
  | 'postinstall_script'
  | 'exfiltration_domain'
  | 'credential_access'
  | 'env_scanning'
  | 'path_traversal'
  | 'tag_poisoning'
  | 'unsigned_package';

/** Known exfiltration domains from recent supply chain attacks */
const KNOWN_EXFIL_DOMAINS = new Set([
  'scan.aquasecurtiy.org', // TeamPCP / Trivy compromise (Mar 2026)
  's1ngularity-repository-1', // UNC6426 data staging (Aug 2025)
  '173.212.205.251', // CVE-2026-33017 Langflow payload staging
]);

/** Suspicious patterns in skill source code */
const SUSPICIOUS_PATTERNS = [
  { pattern: /process\.env(?!\[['"]SKILL_)/, risk: 'env_scanning' as const },
  { pattern: /\/proc\/self\/environ/, risk: 'credential_access' as const },
  { pattern: /\.ssh\//, risk: 'credential_access' as const },
  { pattern: /\.aws\/credentials/, risk: 'credential_access' as const },
  { pattern: /\.kube\/config/, risk: 'credential_access' as const },
  { pattern: /postinstall|preinstall/, risk: 'postinstall_script' as const },
  { pattern: /\.\.\/(\.\.\/)+/, risk: 'path_traversal' as const },
];

/**
 * Scan skill source code for supply chain attack indicators.
 */
export function scanSkillSource(source: string): SupplyChainRisk[] {
  const risks: SupplyChainRisk[] = [];

  for (const { pattern, risk } of SUSPICIOUS_PATTERNS) {
    if (pattern.test(source)) {
      risks.push(riskForCategory(risk));
    }
  }

  // Check for network calls to known exfil domains
  for (const domain of KNOWN_EXFIL_DOMAINS) {
    if (source.includes(domain)) {
      risks.push(riskForCategory('exfiltration_domain'));
      break;
    }
  }

  return risks;
}

/**
 * Validate skill manifest network permissions against threat intel.
 */
export function auditManifestDomains(
  domains: string[],
): SupplyChainRisk[] {
  const risks: SupplyChainRisk[] = [];

  for (const domain of domains) {
    if (KNOWN_EXFIL_DOMAINS.has(domain)) {
      risks.push({
        category: 'exfiltration_domain',
        severity: 'critical',
        description: `Manifest requests access to known exfiltration domain: ${domain}`,
        mitigation: 'Block domain and reject skill submission',
      });
    }
  }

  return risks;
}

/**
 * Generate compliance evidence for supply chain controls.
 */
export function generateSupplyChainEvidence(): {
  controls: Array<{
    id: string;
    framework: string;
    description: string;
    status: 'pass' | 'partial';
    evidence: string;
  }>;
} {
  return {
    controls: [
      {
        id: 'CC6.1',
        framework: 'SOC 2',
        description: 'Logical access security for skill execution',
        status: 'pass',
        evidence: 'Skills run in isolated Worker threads with credential blocklist, env sanitization, and filesystem isolation',
      },
      {
        id: 'PR.DS-6',
        framework: 'NIST CSF',
        description: 'Integrity checking mechanisms',
        status: 'partial',
        evidence: 'Manifest validation on install, postinstall scripts blocked in CI, lockfile integrity verified',
      },
      {
        id: 'A.12.5.1',
        framework: 'ISO 27001',
        description: 'Installation of software on operational systems',
        status: 'pass',
        evidence: 'Skill marketplace with 6-state verification workflow (pending → scanning → reviewing → approved), admin review gate, Socket.dev threat feed integration',
      },
      {
        id: 'SR.3',
        framework: 'NIST CSF',
        description: 'Supply chain risk management',
        status: 'pass',
        evidence: 'Dependency scanning in CI (pnpm audit), postinstall script auditing, GitHub Actions pinned to commit SHAs, Trivy binary verification with checksum',
      },
    ],
  };
}

function riskForCategory(category: SupplyChainRiskCategory): SupplyChainRisk {
  const defs: Record<SupplyChainRiskCategory, Omit<SupplyChainRisk, 'category'>> = {
    postinstall_script: {
      severity: 'high',
      description: 'Package uses postinstall scripts that execute during installation',
      mitigation: 'Review script contents; use ignore-scripts=true in .npmrc',
    },
    exfiltration_domain: {
      severity: 'critical',
      description: 'Code references known data exfiltration domain',
      mitigation: 'Block domain at network level; reject skill submission',
    },
    credential_access: {
      severity: 'critical',
      description: 'Code attempts to access credential files or process environment',
      mitigation: 'Credential isolation blocks access; flag for manual review',
    },
    env_scanning: {
      severity: 'high',
      description: 'Code scans process.env beyond declared permissions',
      mitigation: 'Worker threads receive only declared env vars; host env stripped',
    },
    path_traversal: {
      severity: 'high',
      description: 'Code uses path traversal patterns (../../)',
      mitigation: 'Sandbox rejects paths containing ..; filesystem allowlist enforced',
    },
    tag_poisoning: {
      severity: 'critical',
      description: 'Dependency references mutable tag instead of pinned SHA',
      mitigation: 'Pin all CI Actions to commit SHAs; verify checksums for binaries',
    },
    unsigned_package: {
      severity: 'medium',
      description: 'Skill package lacks cryptographic signature verification',
      mitigation: 'Implement ECDSA P-256 manifest signing (planned)',
    },
  };

  return { category, ...defs[category] };
}
