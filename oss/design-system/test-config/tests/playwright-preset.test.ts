import { describe, it, expect } from 'vitest';
import { createPlaywrightConfig } from '../src/playwright-preset.js';

describe('playwright-preset', () => {
  it('should create config with default baseURL', () => {
    const config = createPlaywrightConfig();
    expect(config.use.baseURL).toBe('http://localhost:3000');
  });

  it('should allow custom baseURL', () => {
    const config = createPlaywrightConfig({ baseURL: 'http://example.com' });
    expect(config.use.baseURL).toBe('http://example.com');
  });

  it('should set default timeout', () => {
    const config = createPlaywrightConfig();
    expect(config.use.timeout).toBe(30000);
  });

  it('should allow custom timeout', () => {
    const config = createPlaywrightConfig({ timeout: 60000 });
    expect(config.use.timeout).toBe(60000);
  });

  it('should include three browser projects', () => {
    const config = createPlaywrightConfig();
    expect(config.projects).toHaveLength(3);
  });

  it('should include chromium browser', () => {
    const config = createPlaywrightConfig();
    const chromium = config.projects.find((p) => p.name === 'chromium');
    expect(chromium).toBeDefined();
    expect(chromium?.use.browserName).toBe('chromium');
  });

  it('should include firefox browser', () => {
    const config = createPlaywrightConfig();
    const firefox = config.projects.find((p) => p.name === 'firefox');
    expect(firefox).toBeDefined();
    expect(firefox?.use.browserName).toBe('firefox');
  });

  it('should include webkit browser', () => {
    const config = createPlaywrightConfig();
    const webkit = config.projects.find((p) => p.name === 'webkit');
    expect(webkit).toBeDefined();
    expect(webkit?.use.browserName).toBe('webkit');
  });

  it('should set test directory to tests', () => {
    const config = createPlaywrightConfig();
    expect(config.testDir).toBe('tests');
  });
});
