import { describe, it, expect } from 'vitest';
import { generateLlmsTxt, parseLlmsTxt, defaultConfig } from '../lib/llms-txt';
import type { LlmsTxtConfig } from '../lib/types';

describe('generateLlmsTxt', () => {
  it('generates correct title', () => {
    const output = generateLlmsTxt(defaultConfig);
    expect(output).toContain('# Your Site Name');
  });

  it('generates correct description', () => {
    const output = generateLlmsTxt(defaultConfig);
    expect(output).toContain('> A brief description');
  });

  it('generates section headings', () => {
    const output = generateLlmsTxt(defaultConfig);
    expect(output).toContain('## Main Pages');
    expect(output).toContain('## Documentation');
  });

  it('generates links in markdown format', () => {
    const output = generateLlmsTxt(defaultConfig);
    expect(output).toContain('- [Homepage](https://example.com/):');
  });

  it('ends with newline', () => {
    const output = generateLlmsTxt(defaultConfig);
    expect(output.endsWith('\n')).toBe(true);
  });

  it('handles empty sections', () => {
    const config: LlmsTxtConfig = {
      title: 'Test',
      description: 'Desc',
      sections: [],
    };
    const output = generateLlmsTxt(config);
    expect(output).toContain('# Test');
    expect(output).toContain('> Desc');
  });
});

describe('parseLlmsTxt', () => {
  it('roundtrips with generateLlmsTxt', () => {
    const generated = generateLlmsTxt(defaultConfig);
    const parsed = parseLlmsTxt(generated);
    expect(parsed.title).toBe(defaultConfig.title);
    expect(parsed.description).toBe(defaultConfig.description);
    expect(parsed.sections).toHaveLength(defaultConfig.sections.length);
  });

  it('parses section headings', () => {
    const generated = generateLlmsTxt(defaultConfig);
    const parsed = parseLlmsTxt(generated);
    expect(parsed.sections[0].heading).toBe('Main Pages');
    expect(parsed.sections[1].heading).toBe('Documentation');
  });

  it('parses links correctly', () => {
    const generated = generateLlmsTxt(defaultConfig);
    const parsed = parseLlmsTxt(generated);
    const firstLink = parsed.sections[0].links[0];
    expect(firstLink.title).toBe('Homepage');
    expect(firstLink.url).toBe('https://example.com/');
    expect(firstLink.description).toContain('Main landing page');
  });

  it('handles empty input', () => {
    const parsed = parseLlmsTxt('');
    expect(parsed.title).toBe('');
    expect(parsed.description).toBe('');
    expect(parsed.sections).toHaveLength(0);
  });
});

describe('defaultConfig', () => {
  it('has required fields', () => {
    expect(defaultConfig.title).toBeTruthy();
    expect(defaultConfig.description).toBeTruthy();
    expect(defaultConfig.sections.length).toBeGreaterThan(0);
  });

  it('has links in every section', () => {
    for (const section of defaultConfig.sections) {
      expect(section.links.length).toBeGreaterThan(0);
    }
  });
});
