/**
 * Persona detection from weak signals.
 *
 * Strategy:
 *  - Each signal contributes a typed `PersonaSignal` with a score 0.0–1.0.
 *  - Aggregate per-persona scores; persona with the highest score wins.
 *  - If no persona crosses `MIN_CONFIDENCE`, fall back to `unknown`.
 *  - Confidently wrong personalization is worse than generic.
 *
 * Pure function. Tested in `persona.test.ts`. Signal weights are conservative
 * on purpose — better to under-personalize and let user click "Customize"
 * than to mis-categorize a compliance officer as a solo dev.
 */

import type {
  EmailDomainClass,
  OnboardingPersona,
  OnboardingSignals,
  PersonaConfidence,
} from '@opensyber/shared';

const MIN_CONFIDENCE = 0.4;

/** Personal-email domains that downgrade `corp` signals. */
const PERSONAL_DOMAINS = new Set([
  'gmail.com',
  'googlemail.com',
  'yahoo.com',
  'outlook.com',
  'hotmail.com',
  'live.com',
  'icloud.com',
  'me.com',
  'proton.me',
  'protonmail.com',
  'fastmail.com',
  'aol.com',
]);

interface SignalContribution {
  persona: OnboardingPersona;
  weight: number;
  label: string;
}

function classifyEmailDomain(domain: string): EmailDomainClass {
  const lower = domain.toLowerCase();
  if (PERSONAL_DOMAINS.has(lower)) return 'personal';
  if (lower.endsWith('.edu') || /\.ac\.[a-z]{2,3}$/.test(lower)) return 'edu';
  if (lower.endsWith('.gov') || lower.endsWith('.mil')) return 'gov';
  return 'corp';
}

function contributionsFromSignals(s: OnboardingSignals): SignalContribution[] {
  const out: SignalContribution[] = [];

  // OAuth provider
  if (s.oauth_provider === 'github') {
    out.push({ persona: 'solo_dev', weight: 0.35, label: 'github_oauth' });
  } else if (s.oauth_provider === 'microsoft') {
    out.push({ persona: 'team_lead', weight: 0.25, label: 'microsoft_oauth' });
    out.push({ persona: 'compliance_officer', weight: 0.15, label: 'microsoft_oauth' });
  } else if (s.oauth_provider === 'google') {
    out.push({ persona: 'solo_dev', weight: 0.1, label: 'google_oauth' });
  }

  // Email domain class
  const klass = s.email_domain_class
    ?? (s.email_domain ? classifyEmailDomain(s.email_domain) : 'unknown');
  if (klass === 'personal') {
    out.push({ persona: 'solo_dev', weight: 0.3, label: 'personal_email' });
  } else if (klass === 'corp') {
    out.push({ persona: 'security_engineer', weight: 0.2, label: 'corp_email' });
    out.push({ persona: 'team_lead', weight: 0.2, label: 'corp_email' });
    out.push({ persona: 'compliance_officer', weight: 0.15, label: 'corp_email' });
  } else if (klass === 'gov') {
    out.push({ persona: 'compliance_officer', weight: 0.4, label: 'gov_email' });
  }

  // Referrer path — strong intent signal
  const ref = s.referrer_path ?? '';
  if (/^\/compliance|\/soc2|\/audit/.test(ref)) {
    out.push({ persona: 'compliance_officer', weight: 0.5, label: 'referrer_compliance' });
  } else if (/^\/security|\/cspm|\/incident/.test(ref)) {
    out.push({ persona: 'security_engineer', weight: 0.45, label: 'referrer_security' });
  } else if (/^\/docs|\/skills/.test(ref)) {
    out.push({ persona: 'solo_dev', weight: 0.3, label: 'referrer_docs' });
  } else if (/^\/teams|\/enterprise|\/pricing/.test(ref)) {
    out.push({ persona: 'team_lead', weight: 0.25, label: 'referrer_team' });
  }

  // UTM campaign — strongest signal (we explicitly tagged it). Designed to
  // dominate any other signal stack: a user who clicked a "/pricing?utm_campaign=compliance"
  // ad has declared intent more credibly than what their email domain implies.
  const utm = (s.utm_campaign ?? '').toLowerCase();
  if (utm.includes('compliance') || utm.includes('soc2')) {
    out.push({ persona: 'compliance_officer', weight: 0.8, label: 'utm_compliance' });
  } else if (utm.includes('security') || utm.includes('cspm')) {
    out.push({ persona: 'security_engineer', weight: 0.75, label: 'utm_security' });
  } else if (utm.includes('developer') || utm.includes('opensource')) {
    out.push({ persona: 'solo_dev', weight: 0.7, label: 'utm_developer' });
  } else if (utm.includes('team') || utm.includes('enterprise')) {
    out.push({ persona: 'team_lead', weight: 0.7, label: 'utm_team' });
  }

  // GitHub signals — repo count + languages
  if (typeof s.github_repo_count === 'number' && s.github_repo_count > 5) {
    out.push({ persona: 'solo_dev', weight: 0.2, label: 'github_active_repos' });
  }
  if (s.github_orgs && s.github_orgs.length > 1) {
    out.push({ persona: 'team_lead', weight: 0.2, label: 'github_multi_org' });
  }
  if (s.github_top_languages?.some((l: string) => /python|go|rust|terraform/i.test(l))) {
    out.push({ persona: 'security_engineer', weight: 0.1, label: 'github_infra_lang' });
  }

  return out;
}

export interface DetectPersonaResult {
  persona: OnboardingPersona;
  confidence: PersonaConfidence;
}

/**
 * Main entry. Returns `unknown` with score 0 if no signals cross threshold.
 * Never throws; missing fields are treated as missing signals, not errors.
 */
export function detectPersona(signals: OnboardingSignals): DetectPersonaResult {
  const contributions = contributionsFromSignals(signals);

  const totals = new Map<OnboardingPersona, number>();
  const contributingByPersona = new Map<OnboardingPersona, Set<string>>();

  for (const c of contributions) {
    totals.set(c.persona, (totals.get(c.persona) ?? 0) + c.weight);
    const set = contributingByPersona.get(c.persona) ?? new Set<string>();
    set.add(c.label);
    contributingByPersona.set(c.persona, set);
  }

  let bestPersona: OnboardingPersona = 'unknown';
  let bestScore = 0;
  for (const [persona, score] of totals) {
    if (score > bestScore) {
      bestScore = score;
      bestPersona = persona;
    }
  }

  if (bestScore < MIN_CONFIDENCE) {
    return {
      persona: 'unknown',
      confidence: { score: bestScore, contributing_signals: [] },
    };
  }

  // Clamp to [0,1] — sums can exceed 1 with multiple strong signals.
  const clamped = Math.min(1, bestScore);
  const labels = Array.from(contributingByPersona.get(bestPersona) ?? []);
  return {
    persona: bestPersona,
    confidence: { score: clamped, contributing_signals: labels },
  };
}
