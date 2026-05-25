/**
 * Skill suggestions per persona.
 *
 * Maps OnboardingPersona → ordered list of skill IDs to pre-install during
 * auto-deploy. Order matters: skills install sequentially; earlier entries
 * are higher priority. Skill IDs MUST exist under `skills/` — bluffing here
 * means the orchestrator silently no-ops on missing skills.
 *
 * Audited 2026-05-23 against the live `skills/` directory.
 */

import type { OnboardingPersona, SuggestedFirstAction } from '../types/onboarding-profile.js';

/** Real skill IDs verified to exist on disk. */
export const VERIFIED_SKILLS = {
  AI_TRIAGE: 'ai-triage',
  AI_REMEDIATION: 'ai-remediation',
  AI_COMPLIANCE_WRITER: 'ai-compliance-writer',
  AI_INCIDENT_RESPONDER: 'ai-incident-responder',
  AI_THREAT_INTEL: 'ai-threat-intel',
  AI_REASONING_ENGINE: 'ai-reasoning-engine',
  PIPELINE_SECURITY_SCANNER: 'pipeline-security-scanner',
  AGENT_BEHAVIOR_PROFILER: 'agent-behavior-profiler',
  CREDENTIAL_ROTATOR: 'credential-rotator',
  DEPENDENCY_AUDITOR: 'dependency-auditor',
  GITHUB_INTEGRATION: 'github-integration',
  LOG_ANALYZER: 'log-analyzer',
  MCP_AUDITOR: 'mcp-auditor',
  PROMPT_GUARD: 'prompt-guard',
} as const;

export interface PersonaSuggestion {
  /** Pre-install order matters; earliest installs first. Keep to 3 max for v1. */
  skills: readonly string[];
  /** Resolved by the wizard into a localized first-action card. */
  first_action: SuggestedFirstAction;
  /** Human-readable persona summary surfaced in the welcome step. */
  welcome_summary: string;
}

export const PERSONA_SUGGESTIONS: Readonly<Record<OnboardingPersona, PersonaSuggestion>> = {
  solo_dev: {
    skills: [
      VERIFIED_SKILLS.PIPELINE_SECURITY_SCANNER,
      VERIFIED_SKILLS.DEPENDENCY_AUDITOR,
      VERIFIED_SKILLS.AI_REMEDIATION,
    ],
    first_action: 'scan_active_repo',
    welcome_summary: 'Looks like you build software. We pre-installed CVE + dependency scanning.',
  },
  security_engineer: {
    skills: [
      VERIFIED_SKILLS.AI_INCIDENT_RESPONDER,
      VERIFIED_SKILLS.AI_THREAT_INTEL,
      VERIFIED_SKILLS.LOG_ANALYZER,
    ],
    first_action: 'connect_cloud_aws',
    welcome_summary: 'Looks like you defend infrastructure. We pre-installed IR + threat intel.',
  },
  compliance_officer: {
    skills: [
      VERIFIED_SKILLS.AI_COMPLIANCE_WRITER,
      VERIFIED_SKILLS.AI_TRIAGE,
      VERIFIED_SKILLS.MCP_AUDITOR,
    ],
    first_action: 'generate_compliance_evidence',
    welcome_summary: 'Looks like you run compliance. We pre-installed evidence + audit skills.',
  },
  team_lead: {
    skills: [
      VERIFIED_SKILLS.AI_TRIAGE,
      VERIFIED_SKILLS.PIPELINE_SECURITY_SCANNER,
      VERIFIED_SKILLS.AI_REASONING_ENGINE,
    ],
    first_action: 'invite_team_members',
    welcome_summary: 'Looks like you lead a team. We set up the full AI bundle — invite your devs.',
  },
  unknown: {
    skills: [VERIFIED_SKILLS.AI_TRIAGE],
    first_action: 'try_demo_scan',
    welcome_summary: 'Welcome. Try the demo scan to see what OpenSyber does.',
  },
};

/**
 * Lookup helper. Falls back to `unknown` so callers never crash on a stale
 * or invalid persona value coming out of D1.
 */
export function getSuggestionsForPersona(persona: OnboardingPersona): PersonaSuggestion {
  return PERSONA_SUGGESTIONS[persona] ?? PERSONA_SUGGESTIONS.unknown;
}
