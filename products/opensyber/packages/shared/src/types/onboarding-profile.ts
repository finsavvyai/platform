/**
 * Onboarding Profile
 *
 * Persona signals captured during signup + first dashboard visit. Drives
 * adaptive onboarding (auto-deploy, skill suggestions, install snippet).
 *
 * Signals are weak by default — refusing or missing signals downgrades
 * persona to `unknown` rather than guessing. Confidently wrong
 * personalization is worse than generic. Each signal carries its own
 * confidence so downstream code can weight them.
 */

export type OnboardingPersona =
  | 'solo_dev'
  | 'security_engineer'
  | 'compliance_officer'
  | 'team_lead'
  | 'unknown';

export type OAuthProviderKind = 'github' | 'google' | 'microsoft' | 'linkedin';

export type EmailDomainClass =
  | 'personal' // gmail, outlook.com, etc.
  | 'corp' // any non-personal domain
  | 'edu' // .edu / .ac.*
  | 'gov' // .gov / .mil
  | 'unknown';

/** Reuse the canonical `Region` from instance.ts — onboarding deploys an instance there. */
export type { Region as RegionId } from './instance.js';
import type { Region as _RegionId } from './instance.js';

/** Raw signals harvested at signup. Persisted as evidence of the persona call. */
export interface OnboardingSignals {
  oauth_provider?: OAuthProviderKind;
  email_domain_class?: EmailDomainClass;
  email_domain?: string; // e.g. "anthropic.com"
  /** Browser locale (e.g. "en-US", "he-IL"). */
  locale?: string;
  /** IANA timezone (e.g. "Europe/Paris"). */
  timezone?: string;
  /** First landing path on opensyber.cloud (e.g. "/compliance"). */
  referrer_path?: string;
  /** `utm_campaign` value from signup query string. */
  utm_campaign?: string;
  /** `utm_source` value from signup query string. */
  utm_source?: string;
  /** Public org names from GitHub OAuth (requires `read:org` scope). */
  github_orgs?: readonly string[];
  /** Top languages by byte count across user's GitHub repos. */
  github_top_languages?: readonly string[];
  /** Count of public repos visible to OAuth token. */
  github_repo_count?: number;
}

/** Per-signal weight in the final persona decision. Sum across signals → confidence. */
export interface PersonaConfidence {
  score: number; // 0.0–1.0
  contributing_signals: readonly string[];
}

/** Final adaptive-onboarding contract. Stored on `user.onboarding_profile`. */
export interface OnboardingProfile {
  persona: OnboardingPersona;
  confidence: PersonaConfidence;
  signals: OnboardingSignals;
  inferred_region: _RegionId;
  suggested_skill_ids: readonly string[];
  /** Suggested first-action key. Resolved by UI to a localized message + CTA. */
  suggested_first_action: SuggestedFirstAction;
  /** ISO timestamp. */
  created_at: string;
}

export type SuggestedFirstAction =
  | 'scan_active_repo' // solo_dev
  | 'connect_cloud_aws' // security_engineer
  | 'generate_compliance_evidence' // compliance_officer
  | 'invite_team_members' // team_lead
  | 'try_demo_scan'; // unknown / fallback

/** Type guard for safe parsing from DB JSON column. */
export function isOnboardingProfile(value: unknown): value is OnboardingProfile {
  if (typeof value !== 'object' || value === null) return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.persona === 'string' &&
    typeof v.confidence === 'object' &&
    typeof v.signals === 'object' &&
    typeof v.inferred_region === 'string' &&
    Array.isArray(v.suggested_skill_ids) &&
    typeof v.suggested_first_action === 'string' &&
    typeof v.created_at === 'string'
  );
}

/** All known personas — useful for exhaustive switch checks. */
export const ALL_PERSONAS: readonly OnboardingPersona[] = [
  'solo_dev',
  'security_engineer',
  'compliance_officer',
  'team_lead',
  'unknown',
];

export const ALL_REGIONS: readonly _RegionId[] = [
  'eu-central',
  'us-east',
  'us-west',
  'ap-southeast',
];
