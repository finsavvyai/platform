import { describe, it, expect } from 'vitest';
import { createTemplate, BUILTIN_TEMPLATES } from '../src/templates/index.js';

describe('Templates', () => {
  it('should have builtin templates', () => {
    expect(BUILTIN_TEMPLATES['code-review']).toBeDefined();
    expect(BUILTIN_TEMPLATES['summarize']).toBeDefined();
    expect(BUILTIN_TEMPLATES['extract-json']).toBeDefined();
  });

  it('should interpolate template variables', () => {
    const template = createTemplate('test', 'Hello {{name}}, you are {{age}} years old');
    const result = template({ name: 'John', age: '30' });

    expect(result).toBe('Hello John, you are 30 years old');
  });

  it('should handle multiple occurrences of same variable', () => {
    const template = createTemplate('test', '{{word}} {{word}} {{word}}');
    const result = template({ word: 'echo' });

    expect(result).toBe('echo echo echo');
  });

  it('should work with code-review template', () => {
    const template = createTemplate(
      'code-review',
      BUILTIN_TEMPLATES['code-review']
    );
    const code = 'function add(a, b) { return a + b; }';
    const result = template({ code });

    expect(result).toContain(code);
    expect(result).toContain('Code quality');
  });

  it('should work with summarize template', () => {
    const template = createTemplate(
      'summarize',
      BUILTIN_TEMPLATES['summarize']
    );
    const text = 'The quick brown fox jumps over the lazy dog';
    const result = template({ text });

    expect(result).toContain(text);
    expect(result).toContain('sentences');
  });

  it('should work with extract-json template', () => {
    const template = createTemplate(
      'extract-json',
      BUILTIN_TEMPLATES['extract-json']
    );
    const text = 'Name is John, age is 30';
    const result = template({ text });

    expect(result).toContain(text);
    expect(result).toContain('JSON');
  });

  it('should ignore undefined variables', () => {
    const template = createTemplate('test', 'Hello {{name}}');
    const result = template({});

    expect(result).toBe('Hello {{name}}');
  });

  it('should handle special characters in values', () => {
    const template = createTemplate('test', 'Code: {{code}}');
    const result = template({ code: 'if (x > 5) { return true; }' });

    expect(result).toContain('if (x > 5) { return true; }');
  });
});
