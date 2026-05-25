import type { SkillManifest } from '../types/skill.js';

export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

const SLUG_REGEX = /^[a-z0-9][a-z0-9-]*[a-z0-9]$/;
const SEMVER_REGEX = /^\d+\.\d+\.\d+$/;

export function validateSkillManifest(manifest: unknown): ValidationResult {
  const errors: string[] = [];

  if (!manifest || typeof manifest !== 'object') {
    return { valid: false, errors: ['Manifest must be a non-null object'] };
  }

  const m = manifest as Record<string, unknown>;

  // Required string fields
  if (typeof m.name !== 'string' || !m.name.trim()) {
    errors.push('name is required and must be a non-empty string');
  }

  if (typeof m.slug !== 'string' || !SLUG_REGEX.test(m.slug)) {
    errors.push('slug must be lowercase alphanumeric with hyphens (min 3 chars)');
  }

  if (typeof m.version !== 'string' || !SEMVER_REGEX.test(m.version)) {
    errors.push('version must follow semver format (e.g., 1.0.0)');
  }

  if (typeof m.description !== 'string' || !m.description.trim()) {
    errors.push('description is required and must be a non-empty string');
  }

  if (typeof m.entrypoint !== 'string' || !m.entrypoint.trim()) {
    errors.push('entrypoint is required and must be a non-empty string');
  }

  if (typeof m.author !== 'string' || !m.author.trim()) {
    errors.push('author is required and must be a non-empty string');
  }

  // Permissions
  if (!m.permissions || typeof m.permissions !== 'object') {
    errors.push('permissions is required and must be an object');
  } else {
    const perms = m.permissions as Record<string, unknown>;

    if (!Array.isArray(perms.network)) {
      errors.push('permissions.network must be an array of strings');
    } else if (!perms.network.every((d: unknown) => typeof d === 'string')) {
      errors.push('permissions.network entries must be strings');
    }

    if (!Array.isArray(perms.filesystem)) {
      errors.push('permissions.filesystem must be an array of strings');
    } else if (!perms.filesystem.every((p: unknown) => typeof p === 'string')) {
      errors.push('permissions.filesystem entries must be strings');
    }

    if (!Array.isArray(perms.env)) {
      errors.push('permissions.env must be an array of strings');
    } else if (!perms.env.every((e: unknown) => typeof e === 'string')) {
      errors.push('permissions.env entries must be strings');
    }
  }

  // Optional fields
  if (m.minAgentVersion !== undefined) {
    if (typeof m.minAgentVersion !== 'string' || !SEMVER_REGEX.test(m.minAgentVersion)) {
      errors.push('minAgentVersion must follow semver format if provided');
    }
  }

  return { valid: errors.length === 0, errors };
}

export function parseSkillManifest(json: string): SkillManifest {
  const parsed = JSON.parse(json) as unknown;
  const result = validateSkillManifest(parsed);
  if (!result.valid) {
    throw new Error(`Invalid skill manifest: ${result.errors.join(', ')}`);
  }
  return parsed as SkillManifest;
}
