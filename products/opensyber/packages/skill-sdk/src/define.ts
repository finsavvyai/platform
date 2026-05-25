import type { SkillDefinition, SkillProfile } from './types.js';

export function defineSkill(definition: SkillDefinition): SkillDefinition {
  validateProfile(definition.profile);
  return definition;
}

function validateProfile(profile: SkillProfile): void {
  if (!profile.id || !/^[a-z0-9-]+$/.test(profile.id)) {
    throw new Error(
      `Invalid skill ID: "${profile.id}" — must be lowercase alphanumeric with hyphens`,
    );
  }
  if (!profile.name) {
    throw new Error('Skill name is required');
  }
  if (!profile.version || !/^\d+\.\d+\.\d+$/.test(profile.version)) {
    throw new Error(
      `Invalid version: "${profile.version}" — must be semver (e.g., 1.0.0)`,
    );
  }
  if (!profile.author) {
    throw new Error('Skill author is required');
  }
}
