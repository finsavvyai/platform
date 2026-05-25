import { describe, it, expect } from 'vitest';
import { createVitestConfig } from '../src/vitest-preset.js';

describe('vitest-preset', () => {
  it('should create config with default coverage thresholds', () => {
    const config = createVitestConfig();
    expect(config.test.coverage.lines).toBe(95);
    expect(config.test.coverage.functions).toBe(95);
    expect(config.test.coverage.branches).toBe(95);
    expect(config.test.coverage.statements).toBe(95);
  });

  it('should allow custom coverage thresholds', () => {
    const config = createVitestConfig({
      coverageThreshold: { lines: 90, functions: 85 },
    });
    expect(config.test.coverage.lines).toBe(90);
    expect(config.test.coverage.functions).toBe(85);
    expect(config.test.coverage.branches).toBe(95);
    expect(config.test.coverage.statements).toBe(95);
  });

  it('should set environment to node by default', () => {
    const config = createVitestConfig();
    expect(config.test.environment).toBe('node');
  });

  it('should allow custom environment', () => {
    const config = createVitestConfig({ environment: 'jsdom' });
    expect(config.test.environment).toBe('jsdom');
  });

  it('should enable globals by default', () => {
    const config = createVitestConfig();
    expect(config.test.globals).toBe(true);
  });

  it('should include coverage reporters', () => {
    const config = createVitestConfig();
    expect(config.test.coverage.reporter).toContain('text');
    expect(config.test.coverage.reporter).toContain('json');
    expect(config.test.coverage.reporter).toContain('html');
  });

  it('should include src directory in coverage', () => {
    const config = createVitestConfig();
    expect(config.test.coverage.include).toContain('src');
  });

  it('should exclude node_modules and dist from coverage', () => {
    const config = createVitestConfig();
    expect(config.test.coverage.exclude).toContain('node_modules');
    expect(config.test.coverage.exclude).toContain('dist');
  });
});
