/**
 * Static example data for the Skill Transparency Log page.
 * Will be replaced with API calls once the backend is fully integrated.
 */

export interface TransparencyLogEntry {
  skillSlug: string;
  skillName: string;
  version: string;
  sha256: string;
  verified: boolean;
  sbomUrl: string | null;
  reviewedAt: string;
  reviewerId: string;
  publishedAt: string;
}

export const transparencyLogEntries: TransparencyLogEntry[] = [
  {
    skillSlug: 'ai-reasoning-engine',
    skillName: 'AI Reasoning Engine',
    version: '2.1.0',
    sha256: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
    verified: true,
    sbomUrl: 'https://r2.opensyber.cloud/sbom/ai-reasoning-engine-2.1.0.json',
    reviewedAt: '2026-04-28T14:30:00.000Z',
    reviewerId: 'security-team',
    publishedAt: '2026-04-28T15:00:00.000Z',
  },
  {
    skillSlug: 'ai-triage',
    skillName: 'AI Triage',
    version: '1.4.2',
    sha256: 'a7ffc6f8bf1ed76651c14756a061d662f580ff4de43b49fa82d80a4b80f8434a',
    verified: true,
    sbomUrl: 'https://r2.opensyber.cloud/sbom/ai-triage-1.4.2.json',
    reviewedAt: '2026-04-25T09:15:00.000Z',
    reviewerId: 'security-team',
    publishedAt: '2026-04-25T10:00:00.000Z',
  },
  {
    skillSlug: 'ai-remediation',
    skillName: 'AI Remediation',
    version: '1.3.0',
    sha256: '2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824',
    verified: true,
    sbomUrl: 'https://r2.opensyber.cloud/sbom/ai-remediation-1.3.0.json',
    reviewedAt: '2026-04-20T16:45:00.000Z',
    reviewerId: 'security-team',
    publishedAt: '2026-04-20T17:30:00.000Z',
  },
  {
    skillSlug: 'ai-compliance-writer',
    skillName: 'AI Compliance Writer',
    version: '1.1.0',
    sha256: 'b94d27b9934d3e08a52e52d7da7dabfac484efe37a5380ee9088f7ace2efcde9',
    verified: true,
    sbomUrl: null,
    reviewedAt: '2026-04-18T11:00:00.000Z',
    reviewerId: 'marketplace-review',
    publishedAt: '2026-04-18T12:00:00.000Z',
  },
];
