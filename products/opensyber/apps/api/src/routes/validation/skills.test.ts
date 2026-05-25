import { describe, it, expect } from 'vitest';
import { submitSkillSchema } from './skills.js';

describe('submitSkillSchema', () => {
  const validInput = {
    slug: 'my-skill', name: 'My Skill', category: 'developer' as const, version: '1.0.0',
  };

  it('accepts valid input with required fields', () => {
    const result = submitSkillSchema.safeParse(validInput);
    expect(result.success).toBe(true);
  });

  it('accepts valid input with all fields', () => {
    const result = submitSkillSchema.safeParse({
      ...validInput,
      description: 'A great skill',
      githubUrl: 'https://github.com/example/skill',
    });
    expect(result.success).toBe(true);
  });

  it('rejects missing slug', () => {
    const { slug, ...rest } = validInput;
    const result = submitSkillSchema.safeParse(rest);
    expect(result.success).toBe(false);
  });

  it('rejects missing name', () => {
    const { name, ...rest } = validInput;
    const result = submitSkillSchema.safeParse(rest);
    expect(result.success).toBe(false);
  });

  it('rejects missing category', () => {
    const { category, ...rest } = validInput;
    const result = submitSkillSchema.safeParse(rest);
    expect(result.success).toBe(false);
  });

  it('rejects missing version', () => {
    const { version, ...rest } = validInput;
    const result = submitSkillSchema.safeParse(rest);
    expect(result.success).toBe(false);
  });

  it('rejects slug with uppercase', () => {
    const result = submitSkillSchema.safeParse({ ...validInput, slug: 'My-Skill' });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.message).toContain('Slug must be lowercase');
  });

  it('rejects slug shorter than 3 chars', () => {
    const result = submitSkillSchema.safeParse({ ...validInput, slug: 'ab' });
    expect(result.success).toBe(false);
  });

  it('rejects slug with spaces', () => {
    const result = submitSkillSchema.safeParse({ ...validInput, slug: 'my skill' });
    expect(result.success).toBe(false);
  });

  it('rejects invalid category', () => {
    const result = submitSkillSchema.safeParse({ ...validInput, category: 'invalid-cat' });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.message).toContain('Category must be one of');
  });

  it('accepts all valid categories', () => {
    const cats = ['productivity', 'developer', 'finance', 'communication', 'home', 'security', 'utilities'];
    for (const category of cats) {
      const result = submitSkillSchema.safeParse({ ...validInput, category });
      expect(result.success).toBe(true);
    }
  });

  it('rejects invalid githubUrl', () => {
    const result = submitSkillSchema.safeParse({ ...validInput, githubUrl: 'not-a-url' });
    expect(result.success).toBe(false);
  });

  it('rejects non-string name', () => {
    const result = submitSkillSchema.safeParse({ ...validInput, name: 123 });
    expect(result.success).toBe(false);
  });

  it('rejects empty object', () => {
    const result = submitSkillSchema.safeParse({});
    expect(result.success).toBe(false);
  });
});
