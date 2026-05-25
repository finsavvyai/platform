import { describe, it, expect } from 'vitest';
import { getEslintPreset } from '../src/eslint-preset.js';

describe('eslint-preset', () => {
  it('should export ESLint config object', () => {
    const config = getEslintPreset();
    expect(config).toBeDefined();
    expect(config.plugins).toBeDefined();
  });

  it('should include typescript-eslint plugin', () => {
    const config = getEslintPreset();
    expect(config.plugins).toHaveProperty('@typescript-eslint');
  });

  it('should have at least one config item', () => {
    const config = getEslintPreset();
    expect(config.configs).toBeDefined();
    expect((config.configs as any[]).length).toBeGreaterThan(0);
  });

  it('should match TypeScript files', () => {
    const config = getEslintPreset();
    const tsConfig = (config.configs as any[])[0];
    expect(tsConfig.files).toContain('**/*.ts');
    expect(tsConfig.files).toContain('**/*.tsx');
  });

  it('should include language options', () => {
    const config = getEslintPreset();
    const tsConfig = (config.configs as any[])[0];
    expect(tsConfig.languageOptions).toBeDefined();
  });

  it('should define rules', () => {
    const config = getEslintPreset();
    const tsConfig = (config.configs as any[])[0];
    expect(tsConfig.rules).toBeDefined();
    expect(Object.keys(tsConfig.rules).length).toBeGreaterThan(0);
  });

  it('should warn on console statements', () => {
    const config = getEslintPreset();
    const tsConfig = (config.configs as any[])[0];
    expect(tsConfig.rules['no-console']).toBeDefined();
  });

  it('should error on var declarations', () => {
    const config = getEslintPreset();
    const tsConfig = (config.configs as any[])[0];
    expect(tsConfig.rules['no-var']).toBe('error');
  });
});
