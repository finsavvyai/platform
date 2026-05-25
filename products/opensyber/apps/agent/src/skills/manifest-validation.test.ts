import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { SkillManifest } from '@opensyber/shared';

const SKILLS_DIR = join(__dirname, '..', '..', '..', '..', 'skills');

function readManifest(slug: string): unknown {
  const content = readFileSync(join(SKILLS_DIR, slug, 'manifest.json'), 'utf-8');
  return JSON.parse(content);
}

function assertValidManifest(manifest: unknown): asserts manifest is SkillManifest {
  const m = manifest as Record<string, unknown>;
  expect(typeof m.name).toBe('string');
  expect(typeof m.slug).toBe('string');
  expect(typeof m.version).toBe('string');
  expect(typeof m.description).toBe('string');
  expect(typeof m.entrypoint).toBe('string');
  expect(typeof m.author).toBe('string');
  expect(m.permissions).toBeDefined();
  const perms = m.permissions as Record<string, unknown>;
  expect(Array.isArray(perms.network)).toBe(true);
  expect(Array.isArray(perms.filesystem)).toBe(true);
  expect(Array.isArray(perms.env)).toBe(true);
}

describe('Skill Manifest Validation', () => {
  describe('github-integration', () => {
    const manifest = readManifest('github-integration');

    it('has valid manifest structure', () => {
      assertValidManifest(manifest);
    });

    it('has correct slug', () => {
      expect((manifest as SkillManifest).slug).toBe('github-integration');
    });

    it('declares github.com network permissions', () => {
      const m = manifest as SkillManifest;
      expect(m.permissions.network).toContain('api.github.com');
      expect(m.permissions.network).toContain('github.com');
    });

    it('requires GITHUB_TOKEN env', () => {
      expect((manifest as SkillManifest).permissions.env).toContain('GITHUB_TOKEN');
    });

    it('has semver version', () => {
      expect((manifest as SkillManifest).version).toMatch(/^\d+\.\d+\.\d+$/);
    });
  });

  describe('slack-notifier', () => {
    const manifest = readManifest('slack-notifier');

    it('has valid manifest structure', () => {
      assertValidManifest(manifest);
    });

    it('has correct slug', () => {
      expect((manifest as SkillManifest).slug).toBe('slack-notifier');
    });

    it('declares hooks.slack.com network permission', () => {
      expect((manifest as SkillManifest).permissions.network).toContain('hooks.slack.com');
    });

    it('requires SLACK_WEBHOOK_URL env', () => {
      expect((manifest as SkillManifest).permissions.env).toContain('SLACK_WEBHOOK_URL');
    });
  });

  describe('log-analyzer', () => {
    const manifest = readManifest('log-analyzer');

    it('has valid manifest structure', () => {
      assertValidManifest(manifest);
    });

    it('has correct slug', () => {
      expect((manifest as SkillManifest).slug).toBe('log-analyzer');
    });

    it('requires no network permissions', () => {
      expect((manifest as SkillManifest).permissions.network).toHaveLength(0);
    });

    it('requires no env vars', () => {
      expect((manifest as SkillManifest).permissions.env).toHaveLength(0);
    });

    it('has /var/log/ filesystem permission', () => {
      expect((manifest as SkillManifest).permissions.filesystem).toContain('/var/log/');
    });
  });

  describe('manifest format rules', () => {
    const manifests = ['github-integration', 'slack-notifier', 'log-analyzer']
      .map((slug) => ({ slug, manifest: readManifest(slug) as SkillManifest }));

    it('all slugs match lowercase-hyphen format', () => {
      for (const { manifest } of manifests) {
        expect(manifest.slug).toMatch(/^[a-z0-9][a-z0-9-]*[a-z0-9]$/);
      }
    });

    it('all have index.js as entrypoint', () => {
      for (const { manifest } of manifests) {
        expect(manifest.entrypoint).toBe('index.js');
      }
    });

    it('all have opensyber as author', () => {
      for (const { manifest } of manifests) {
        expect(manifest.author).toBe('opensyber');
      }
    });

    it('all have minAgentVersion set', () => {
      for (const { manifest } of manifests) {
        expect(manifest.minAgentVersion).toBeDefined();
        expect(manifest.minAgentVersion).toMatch(/^\d+\.\d+\.\d+$/);
      }
    });
  });
});
