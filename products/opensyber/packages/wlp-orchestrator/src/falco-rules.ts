/**
 * Falco runtime detection rule catalog (curated subset).
 *
 * Every entry below is a REAL rule shipped by the upstream Falco rules
 * project. We only carry the rule's stable `name` (used by Falco to match
 * rule_filter), severity, and the MITRE ATT&CK technique we map it to.
 *
 * Source (Apache 2.0): https://github.com/falcosecurity/rules
 *   - rules/falco_rules.yaml
 *   - rules/application_rules.yaml
 *
 * MITRE ATT&CK technique IDs follow the official enterprise matrix:
 *   T1059  Command and Scripting Interpreter
 *   T1071  Application Layer Protocol (C2 over standard protocols)
 *   T1083  File and Directory Discovery
 *   T1543  Create or Modify System Process
 *   T1611  Escape to Host (containers)
 *   T1610  Deploy Container
 *   T1546  Event Triggered Execution
 *   T1485  Data Destruction
 *
 * We do NOT invent rules. Each `name` below MUST match the upstream
 * `- rule:` declaration verbatim so a Falco operator can opt-in/out
 * with `rules_filter` and not silently drift from upstream.
 */

export type FalcoSeverity =
  | 'CRITICAL'
  | 'ERROR'
  | 'WARNING'
  | 'NOTICE'
  | 'INFORMATIONAL'
  | 'DEBUG';

export interface FalcoRule {
  /** Verbatim upstream rule name (case-sensitive). */
  name: string;
  /** Falco priority (matches upstream priority field). */
  severity: FalcoSeverity;
  /** MITRE ATT&CK technique ID (e.g. "T1059", "T1059.004"). */
  mitreTechnique: string;
  /** Short description of what the rule detects. */
  description: string;
  /** Upstream file the rule lives in. */
  source: 'falco_rules.yaml' | 'application_rules.yaml';
}

/**
 * Curated subset of upstream Falco rules. Names are verbatim from
 * https://github.com/falcosecurity/rules/blob/main/rules/falco_rules.yaml
 */
export const FALCO_RULES: readonly FalcoRule[] = [
  {
    name: 'Read sensitive file untrusted',
    severity: 'WARNING',
    mitreTechnique: 'T1083',
    description:
      'An attempt to read sensitive files (e.g. /etc/shadow) by a process not in the allowed list.',
    source: 'falco_rules.yaml',
  },
  {
    name: 'Write below etc',
    severity: 'ERROR',
    mitreTechnique: 'T1543',
    description:
      'Writing to /etc by a process that is not on the allow-list (e.g. package manager).',
    source: 'falco_rules.yaml',
  },
  {
    name: 'Write below root',
    severity: 'ERROR',
    mitreTechnique: 'T1543',
    description: 'A non-allowed process writes below / (root) directory.',
    source: 'falco_rules.yaml',
  },
  {
    name: 'Write below binary dir',
    severity: 'ERROR',
    mitreTechnique: 'T1543',
    description:
      'An attempt to write to a binary directory (/bin, /sbin, /usr/bin, /usr/sbin).',
    source: 'falco_rules.yaml',
  },
  {
    name: 'Container drift detected (open+create)',
    severity: 'ERROR',
    mitreTechnique: 'T1611',
    description:
      'A new executable was created inside a container at runtime — possible container drift / supply-chain attack.',
    source: 'falco_rules.yaml',
  },
  {
    name: 'Launch Privileged Container',
    severity: 'INFORMATIONAL',
    mitreTechnique: 'T1610',
    description: 'A privileged container was started.',
    source: 'falco_rules.yaml',
  },
  {
    name: 'Terminal shell in container',
    severity: 'NOTICE',
    mitreTechnique: 'T1059',
    description:
      'A shell was spawned in a container with an attached terminal — interactive shell access.',
    source: 'falco_rules.yaml',
  },
  {
    name: 'Unexpected outbound connection destination',
    severity: 'NOTICE',
    mitreTechnique: 'T1071',
    description:
      'A program made an outbound network connection to an IP/port outside the configured allow-list.',
    source: 'falco_rules.yaml',
  },
  {
    name: 'Disallowed SSH Connection',
    severity: 'NOTICE',
    mitreTechnique: 'T1071',
    description: 'An SSH connection was made to or from a non-allow-listed peer.',
    source: 'falco_rules.yaml',
  },
  {
    name: 'Clear Log Activities',
    severity: 'WARNING',
    mitreTechnique: 'T1485',
    description: 'Log files were truncated or cleared by a process.',
    source: 'falco_rules.yaml',
  },
  {
    name: 'Modify binary dirs',
    severity: 'ERROR',
    mitreTechnique: 'T1546',
    description:
      'A file in a system binary directory was renamed or unlinked by a non-allow-listed process.',
    source: 'falco_rules.yaml',
  },
  {
    name: 'Schedule Cron Jobs',
    severity: 'NOTICE',
    mitreTechnique: 'T1053',
    description: 'A cron job was modified or created.',
    source: 'falco_rules.yaml',
  },
];

const MITRE_RE = /^T\d{4}(?:\.\d{3})?$/;

/** Validates a MITRE ATT&CK technique string (e.g. T1059 or T1059.004). */
export function isValidMitreTechnique(t: string): boolean {
  return MITRE_RE.test(t);
}

/** Looks up a rule by its verbatim upstream name. */
export function getFalcoRule(name: string): FalcoRule | undefined {
  return FALCO_RULES.find((r) => r.name === name);
}

/** Returns rules at or above the requested severity (CRITICAL first). */
export function rulesBySeverity(min: FalcoSeverity): FalcoRule[] {
  const order: FalcoSeverity[] = [
    'CRITICAL',
    'ERROR',
    'WARNING',
    'NOTICE',
    'INFORMATIONAL',
    'DEBUG',
  ];
  const cut = order.indexOf(min);
  return FALCO_RULES.filter((r) => order.indexOf(r.severity) <= cut);
}
