export type TrustPolicyMode = 'enforce' | 'warn' | 'off';

export interface SkillArtifactSignature {
  provider: string;
  bundle: string;
  certificateIdentity?: string;
  verified?: boolean;
}

export interface SkillSbomMetadata {
  formatVersion: '1.0';
  generatedAt: string;
  package: {
    name: string;
    slug: string;
    version: string;
    category: string;
  };
  artifact: {
    checksum: string;
    fileSize: number;
    sdkVersion: string | null;
  };
  dependencies: string[];
  entrypoints: string[];
}

export interface SkillTrustManifest {
  sbom: SkillSbomMetadata;
  signature: SkillArtifactSignature | null;
}

export interface BuildSbomInput {
  name: string;
  slug: string;
  version: string;
  category: string;
  checksum: string;
  fileSize: number;
  sdkVersion?: string | null;
  dependencies?: string[];
  entrypoints?: string[];
}

export interface VerifyArtifactInput {
  manifestRaw: string | null;
  checksum: string | null;
  policyMode?: TrustPolicyMode;
}

export interface VerifyArtifactResult {
  passed: boolean;
  code:
    | 'OK'
    | 'POLICY_DISABLED'
    | 'MISSING_MANIFEST'
    | 'INVALID_MANIFEST'
    | 'MISSING_SBOM'
    | 'MISSING_SIGNATURE'
    | 'SIGNATURE_NOT_VERIFIED'
    | 'CHECKSUM_MISMATCH';
  message: string;
  signed: boolean;
  hasSbom: boolean;
}

export interface SkillArtifactVerifier {
  verify(input: VerifyArtifactInput): VerifyArtifactResult;
}

function parseManifest(manifestRaw: string | null): SkillTrustManifest | null {
  if (!manifestRaw) return null;
  try {
    return JSON.parse(manifestRaw) as SkillTrustManifest;
  } catch {
    return null;
  }
}

export function createSbomMetadata(input: BuildSbomInput): SkillSbomMetadata {
  return {
    formatVersion: '1.0',
    generatedAt: new Date().toISOString(),
    package: {
      name: input.name,
      slug: input.slug,
      version: input.version,
      category: input.category,
    },
    artifact: {
      checksum: input.checksum,
      fileSize: input.fileSize,
      sdkVersion: input.sdkVersion ?? null,
    },
    dependencies: input.dependencies ?? [],
    entrypoints: input.entrypoints ?? [],
  };
}

export function createSkillTrustManifest(input: BuildSbomInput & { signature?: SkillArtifactSignature | null }): SkillTrustManifest {
  return {
    sbom: createSbomMetadata(input),
    signature: input.signature ?? null,
  };
}

class StrictMetadataArtifactVerifier implements SkillArtifactVerifier {
  verify(input: VerifyArtifactInput): VerifyArtifactResult {
    const mode = input.policyMode ?? 'enforce';
    if (mode === 'off') {
      return {
        passed: true,
        code: 'POLICY_DISABLED',
        message: 'Trust policy is disabled',
        signed: false,
        hasSbom: false,
      };
    }

    if (!input.manifestRaw) {
      const fail = {
        passed: false,
        code: 'MISSING_MANIFEST' as const,
        message: 'Artifact trust manifest is required',
        signed: false,
        hasSbom: false,
      };
      return mode === 'warn' ? { ...fail, passed: true } : fail;
    }

    const manifest = parseManifest(input.manifestRaw);
    if (!manifest) {
      const fail = {
        passed: false,
        code: 'INVALID_MANIFEST' as const,
        message: 'Artifact trust manifest is not valid JSON',
        signed: false,
        hasSbom: false,
      };
      return mode === 'warn' ? { ...fail, passed: true } : fail;
    }

    if (!manifest.sbom?.artifact?.checksum) {
      const fail = {
        passed: false,
        code: 'MISSING_SBOM' as const,
        message: 'SBOM metadata is missing artifact checksum',
        signed: false,
        hasSbom: false,
      };
      return mode === 'warn' ? { ...fail, passed: true } : fail;
    }

    const signature = manifest.signature;
    if (!signature?.provider || !signature.bundle) {
      const fail = {
        passed: false,
        code: 'MISSING_SIGNATURE' as const,
        message: 'Signed provenance is required for marketplace approval',
        signed: false,
        hasSbom: true,
      };
      return mode === 'warn' ? { ...fail, passed: true } : fail;
    }

    if (signature.verified !== true) {
      const fail = {
        passed: false,
        code: 'SIGNATURE_NOT_VERIFIED' as const,
        message: 'Artifact signature is present but not verified',
        signed: false,
        hasSbom: true,
      };
      return mode === 'warn' ? { ...fail, passed: true } : fail;
    }

    if (input.checksum && manifest.sbom.artifact.checksum !== input.checksum) {
      const fail = {
        passed: false,
        code: 'CHECKSUM_MISMATCH' as const,
        message: 'SBOM checksum does not match stored artifact checksum',
        signed: true,
        hasSbom: true,
      };
      return mode === 'warn' ? { ...fail, passed: true } : fail;
    }

    return { passed: true, code: 'OK', message: 'Artifact trust policy passed', signed: true, hasSbom: true };
  }
}

export const createSkillArtifactVerifier = (): SkillArtifactVerifier =>
  new StrictMetadataArtifactVerifier();

export function getTrustIndicators(manifestRaw: string | null): { isSigned: boolean; hasSbom: boolean } {
  const manifest = parseManifest(manifestRaw);
  const hasSbom = Boolean(manifest?.sbom?.artifact?.checksum);
  const isSigned = Boolean(manifest?.signature?.bundle && manifest?.signature?.verified === true);
  return { isSigned, hasSbom };
}
