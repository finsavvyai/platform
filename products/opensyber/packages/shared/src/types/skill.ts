export interface Skill {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  category: SkillCategory;
  authorId: string;
  githubUrl: string | null;
  currentVersion: string | null;
  verificationStatus: VerificationStatus;
  verifiedAt: string | null;
  installCount: number;
  ratingAvg: number;
  ratingCount: number;
  createdAt: string;
}

export type SkillCategory =
  | 'productivity'
  | 'developer'
  | 'finance'
  | 'communication'
  | 'home'
  | 'security'
  | 'utilities';

export type VerificationStatus =
  | 'pending'
  | 'scanning'
  | 'reviewing'
  | 'approved'
  | 'rejected'
  | 'revoked';

export interface SkillSubmission {
  slug: string;
  name: string;
  description: string;
  category: SkillCategory;
  githubUrl: string;
  version: string;
}

export interface SkillInstallation {
  id: string;
  instanceId: string;
  skillId: string;
  version: string;
  installedAt: string;
  isActive: boolean;
}

// ─── Skill Package Manifest (for agent runtime) ─────────────────────────────

export interface SkillPermissions {
  /** Allowed outbound domains (e.g., ['api.github.com', 'github.com']) */
  network: string[];
  /** Allowed filesystem paths relative to skill directory (e.g., ['./data/']) */
  filesystem: string[];
  /** Required environment variable keys (e.g., ['GITHUB_TOKEN']) */
  env: string[];
}

export interface SkillManifest {
  name: string;
  slug: string;
  version: string;
  description: string;
  entrypoint: string;
  permissions: SkillPermissions;
  author: string;
  minAgentVersion?: string;
}

export interface SkillPackage {
  manifest: SkillManifest;
  /** Base64-encoded tarball of the skill source */
  packageData?: string;
}

export const SKILL_CATEGORY_LABELS: Record<SkillCategory, string> = {
  productivity: 'Productivity',
  developer: 'Developer Tools',
  finance: 'Finance',
  communication: 'Communication',
  home: 'Home & Lifestyle',
  security: 'Security',
  utilities: 'Utilities',
};
