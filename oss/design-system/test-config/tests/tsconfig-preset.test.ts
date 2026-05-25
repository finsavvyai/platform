import { describe, it, expect } from 'vitest';
import { getTsConfigPreset } from '../src/tsconfig-preset.js';

describe('tsconfig-preset', () => {
  it('should have strict mode enabled', () => {
    const config = getTsConfigPreset();
    expect(config.compilerOptions.strict).toBe(true);
  });

  it('should target ES2020', () => {
    const config = getTsConfigPreset();
    expect(config.compilerOptions.target).toBe('ES2020');
  });

  it('should use ES2020 modules', () => {
    const config = getTsConfigPreset();
    expect(config.compilerOptions.module).toBe('ES2020');
  });

  it('should have declaration generation enabled', () => {
    const config = getTsConfigPreset();
    expect(config.compilerOptions.declaration).toBe(true);
    expect(config.compilerOptions.declarationMap).toBe(true);
  });

  it('should have source maps enabled', () => {
    const config = getTsConfigPreset();
    expect(config.compilerOptions.sourceMap).toBe(true);
  });

  it('should use node module resolution', () => {
    const config = getTsConfigPreset();
    expect(config.compilerOptions.moduleResolution).toBe('node');
  });

  it('should resolve JSON modules', () => {
    const config = getTsConfigPreset();
    expect(config.compilerOptions.resolveJsonModule).toBe(true);
  });

  it('should disallow JavaScript files', () => {
    const config = getTsConfigPreset();
    expect(config.compilerOptions.allowJs).toBe(false);
  });

  it('should enforce consistent casing', () => {
    const config = getTsConfigPreset();
    expect(config.compilerOptions.forceConsistentCasingInFileNames).toBe(true);
  });

  it('should skip lib checks', () => {
    const config = getTsConfigPreset();
    expect(config.compilerOptions.skipLibCheck).toBe(true);
  });

  it('should include src directory', () => {
    const config = getTsConfigPreset();
    expect(config.include).toContain('src');
  });

  it('should exclude node_modules, dist, and tests', () => {
    const config = getTsConfigPreset();
    expect(config.exclude).toContain('node_modules');
    expect(config.exclude).toContain('dist');
    expect(config.exclude).toContain('tests');
  });
});
