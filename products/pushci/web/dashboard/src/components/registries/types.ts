export type RegistryType =
  | 'nexus' | 'artifactory' | 'jfrog'
  | 'github-packages' | 'gitlab-registry' | 'gitea-registry'
  | 'aws-ecr' | 'aws-codeartifact'
  | 'gcp-artifact-registry' | 'gcp-gcr'
  | 'azure-container-registry' | 'harbor'
  | 'npm-enterprise' | 'pypi-enterprise'
  | 'docker-registry' | 'oci-generic';

export type AuthMode = 'none' | 'basic' | 'bearer' | 'aws-iam' | 'gcp-sa' | 'gha-token';

export interface CompanyRegistry {
  id: string;
  ownerSub: string;
  name: string;
  type: RegistryType;
  url: string;
  authMode: AuthMode;
  usernameRef?: string;
  passwordRef?: string;
  tokenRef?: string;
  region?: string;
  properties: Record<string, string>;
  createdAt: string;
  updatedAt: string;
}

export type RegistryDraft = Partial<CompanyRegistry> & {
  name: string;
  type: RegistryType;
  url: string;
  authMode: AuthMode;
};

export const TYPES: readonly RegistryType[] = [
  'nexus', 'artifactory', 'jfrog', 'github-packages', 'gitlab-registry',
  'gitea-registry', 'aws-ecr', 'aws-codeartifact', 'gcp-artifact-registry',
  'gcp-gcr', 'azure-container-registry', 'harbor', 'npm-enterprise',
  'pypi-enterprise', 'docker-registry', 'oci-generic',
] as const;

export const AUTH_MODES: readonly AuthMode[] = [
  'none', 'basic', 'bearer', 'aws-iam', 'gcp-sa', 'gha-token',
] as const;

export function emptyDraft(): RegistryDraft {
  return { name: '', type: 'artifactory', url: '', authMode: 'basic', properties: {} };
}

export function needsRegion(t: RegistryType): boolean {
  return t === 'aws-ecr' || t === 'aws-codeartifact' || t === 'gcp-artifact-registry';
}
