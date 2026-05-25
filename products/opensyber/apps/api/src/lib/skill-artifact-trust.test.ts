import { describe, expect, it } from 'vitest';
import {
  createSbomMetadata,
  createSkillArtifactVerifier,
  createSkillTrustManifest,
  getTrustIndicators,
} from './skill-artifact-trust.js';

describe('skill-artifact-trust', () => {
  it('generates sbom metadata from artifact input', () => {
    const sbom = createSbomMetadata({
      name: 'Skill',
      slug: 'skill',
      version: '1.0.0',
      category: 'security',
      checksum: 'sha256:abc',
      fileSize: 1204,
      sdkVersion: '2.0.0',
      dependencies: ['zod'],
      entrypoints: ['index.js'],
    });
    expect(sbom.package.slug).toBe('skill');
    expect(sbom.artifact.fileSize).toBe(1204);
    expect(sbom.dependencies).toEqual(['zod']);
  });

  it('passes strict verification with sbom and verified signature', () => {
    const verifier = createSkillArtifactVerifier();
    const manifest = createSkillTrustManifest({
      name: 'Skill',
      slug: 'skill',
      version: '1.0.0',
      category: 'security',
      checksum: 'sha256:abc',
      fileSize: 1204,
      signature: { provider: 'sigstore', bundle: 'bundle-json', verified: true },
    });
    const result = verifier.verify({
      manifestRaw: JSON.stringify(manifest),
      checksum: 'sha256:abc',
      policyMode: 'enforce',
    });
    expect(result.passed).toBe(true);
    expect(result.code).toBe('OK');
  });

  it('blocks unsigned manifest in enforce mode', () => {
    const verifier = createSkillArtifactVerifier();
    const manifest = createSkillTrustManifest({
      name: 'Skill',
      slug: 'skill',
      version: '1.0.0',
      category: 'security',
      checksum: 'sha256:abc',
      fileSize: 1204,
      signature: null,
    });
    const result = verifier.verify({
      manifestRaw: JSON.stringify(manifest),
      checksum: 'sha256:abc',
      policyMode: 'enforce',
    });
    expect(result.passed).toBe(false);
    expect(result.code).toBe('MISSING_SIGNATURE');
  });

  it('returns trusted indicators only when signature+sbom exist', () => {
    const good = createSkillTrustManifest({
      name: 'Skill',
      slug: 'skill',
      version: '1.0.0',
      category: 'security',
      checksum: 'sha256:abc',
      fileSize: 1204,
      signature: { provider: 'sigstore', bundle: 'bundle-json', verified: true },
    });
    expect(getTrustIndicators(JSON.stringify(good))).toEqual({ isSigned: true, hasSbom: true });
    expect(getTrustIndicators(null)).toEqual({ isSigned: false, hasSbom: false });
  });
});
