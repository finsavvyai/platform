import { describe, it, expect } from 'vitest';
import { defineSkill } from './define.js';
import type { SkillProfile, SkillDefinition } from './types.js';

function makeProfile(overrides: Partial<SkillProfile> = {}): SkillProfile {
  return {
    id: 'my-skill',
    name: 'My Skill',
    version: '1.0.0',
    description: 'A test skill',
    author: 'test-author',
    tier: 'free',
    target: 'agent_session',
    schedule: 'on_demand',
    permissions: [],
    ...overrides,
  };
}

function makeDefinition(overrides: Partial<SkillProfile> = {}): SkillDefinition {
  return {
    profile: makeProfile(overrides),
    execute: async () => {},
  };
}

describe('defineSkill', () => {
  it('returns a valid skill definition unchanged', () => {
    const def = makeDefinition();
    const result = defineSkill(def);
    expect(result).toBe(def);
    expect(result.profile.id).toBe('my-skill');
  });

  it('rejects empty skill ID', () => {
    expect(() => defineSkill(makeDefinition({ id: '' }))).toThrow(
      'Invalid skill ID',
    );
  });

  it('rejects skill ID with uppercase letters', () => {
    expect(() => defineSkill(makeDefinition({ id: 'MySkill' }))).toThrow(
      'Invalid skill ID',
    );
  });

  it('rejects skill ID with spaces', () => {
    expect(() => defineSkill(makeDefinition({ id: 'my skill' }))).toThrow(
      'Invalid skill ID',
    );
  });

  it('rejects skill ID with underscores', () => {
    expect(() => defineSkill(makeDefinition({ id: 'my_skill' }))).toThrow(
      'Invalid skill ID',
    );
  });

  it('accepts skill ID with hyphens and numbers', () => {
    const def = makeDefinition({ id: 'my-skill-v2' });
    expect(() => defineSkill(def)).not.toThrow();
  });

  it('rejects missing name', () => {
    expect(() => defineSkill(makeDefinition({ name: '' }))).toThrow(
      'Skill name is required',
    );
  });

  it('rejects non-semver version', () => {
    expect(() => defineSkill(makeDefinition({ version: 'v1' }))).toThrow(
      'Invalid version',
    );
  });

  it('rejects empty version', () => {
    expect(() => defineSkill(makeDefinition({ version: '' }))).toThrow(
      'Invalid version',
    );
  });

  it('accepts valid semver version', () => {
    const def = makeDefinition({ version: '2.10.3' });
    expect(() => defineSkill(def)).not.toThrow();
  });

  it('rejects missing author', () => {
    expect(() => defineSkill(makeDefinition({ author: '' }))).toThrow(
      'Skill author is required',
    );
  });
});
