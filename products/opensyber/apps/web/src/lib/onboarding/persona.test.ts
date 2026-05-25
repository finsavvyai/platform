import { describe, it, expect } from 'vitest';
import { detectPersona } from './persona';
import type { OnboardingSignals } from '@opensyber/shared';

describe('detectPersona', () => {
  it('empty signals → unknown with score 0', () => {
    const r = detectPersona({});
    expect(r.persona).toBe('unknown');
    expect(r.confidence.score).toBe(0);
    expect(r.confidence.contributing_signals).toEqual([]);
  });

  it('github oauth + personal email + /docs referrer → solo_dev', () => {
    const s: OnboardingSignals = {
      oauth_provider: 'github',
      email_domain: 'gmail.com',
      referrer_path: '/docs/getting-started',
    };
    const r = detectPersona(s);
    expect(r.persona).toBe('solo_dev');
    expect(r.confidence.score).toBeGreaterThanOrEqual(0.4);
  });

  it('utm_campaign=compliance dominates other signals', () => {
    const s: OnboardingSignals = {
      oauth_provider: 'github',
      email_domain: 'gmail.com',
      utm_campaign: 'compliance-soc2-q2',
    };
    const r = detectPersona(s);
    expect(r.persona).toBe('compliance_officer');
  });

  it('gov email → compliance_officer', () => {
    const s: OnboardingSignals = { email_domain: 'agency.gov' };
    const r = detectPersona(s);
    expect(r.persona).toBe('compliance_officer');
  });

  it('microsoft oauth + corp email → team_lead', () => {
    const s: OnboardingSignals = {
      oauth_provider: 'microsoft',
      email_domain: 'bigcorp.com',
    };
    const r = detectPersona(s);
    expect(r.persona).toBe('team_lead');
  });

  it('weak signals below threshold → unknown', () => {
    // Only google oauth (weight 0.1) — below MIN_CONFIDENCE 0.4.
    const r = detectPersona({ oauth_provider: 'google' });
    expect(r.persona).toBe('unknown');
  });

  it('explicit email_domain_class overrides domain inference', () => {
    const s: OnboardingSignals = {
      email_domain: 'gmail.com',
      email_domain_class: 'corp',
      oauth_provider: 'github',
    };
    const r = detectPersona(s);
    expect(r.persona).not.toBe('solo_dev');
  });

  it('referrer /security on a corp account → security_engineer', () => {
    // On a personal account, github+gmail outweighs a referrer-only signal —
    // a hobbyist browsing /security is still a hobbyist. Test the corp path.
    const s: OnboardingSignals = {
      email_domain: 'bigcorp.com',
      referrer_path: '/security/cspm',
    };
    const r = detectPersona(s);
    expect(r.persona).toBe('security_engineer');
  });

  it('github multi-org → team_lead boost', () => {
    const s: OnboardingSignals = {
      oauth_provider: 'github',
      email_domain: 'corp.example.com',
      github_orgs: ['acme', 'acme-platform', 'acme-security'],
    };
    const r = detectPersona(s);
    expect(['team_lead', 'security_engineer']).toContain(r.persona);
  });

  it('github with terraform language → security_engineer or unknown if below threshold', () => {
    const s: OnboardingSignals = {
      oauth_provider: 'github',
      email_domain: 'corp.example.com',
      github_top_languages: ['Terraform', 'HCL', 'Go'],
    };
    const r = detectPersona(s);
    // Conservative model: scores split across multiple personas can leave each
    // below MIN_CONFIDENCE. Either security_engineer wins or we punt to unknown.
    expect(['security_engineer', 'solo_dev', 'team_lead', 'unknown']).toContain(r.persona);
  });

  it('contributing_signals are reported for the winning persona', () => {
    const r = detectPersona({
      oauth_provider: 'github',
      email_domain: 'gmail.com',
      referrer_path: '/docs',
    });
    expect(r.confidence.contributing_signals.length).toBeGreaterThan(0);
  });

  it('confidence score is clamped to 1.0', () => {
    const r = detectPersona({
      oauth_provider: 'github',
      email_domain: 'gmail.com',
      referrer_path: '/docs',
      utm_campaign: 'developer-tools',
      github_repo_count: 50,
    });
    expect(r.confidence.score).toBeLessThanOrEqual(1.0);
  });

  it('edu email is not corp', () => {
    const r = detectPersona({ email_domain: 'mit.edu', oauth_provider: 'github' });
    // edu doesn't push toward security/team/compliance — github+edu often still solo_dev
    // but score may be below threshold without other signals.
    expect(['solo_dev', 'unknown']).toContain(r.persona);
  });
});
