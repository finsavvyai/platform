import { describe, it, expect } from 'vitest';
import { expandTemplate, extractVariables, TemplateError } from './prompt-template';

describe('expandTemplate', () => {
  it('substitutes a simple var', () => {
    expect(expandTemplate('hi {{name}}', { name: 'Ada' })).toBe('hi Ada');
  });

  it('supports nested paths', () => {
    expect(expandTemplate('{{user.name}}', { user: { name: 'Bob' } })).toBe('Bob');
  });

  it('throws on missing required var', () => {
    expect(() => expandTemplate('hi {{name}}', {})).toThrow(TemplateError);
  });

  it('tolerates optional {{var?}}', () => {
    expect(expandTemplate('{{greeting?}} there', {})).toBe(' there');
  });

  it('uses default {{var|hello}} on miss', () => {
    expect(expandTemplate('{{greeting|hello}} there', {})).toBe('hello there');
  });

  it('extractVariables returns unique names', () => {
    expect(extractVariables('{{a}} {{b}} {{a}} {{c.d}}').sort()).toEqual(['a', 'b', 'c.d']);
  });

  it('handles many vars at once', () => {
    const out = expandTemplate('{{a}}-{{b}}-{{c}}', { a: 1, b: 2, c: 3 });
    expect(out).toBe('1-2-3');
  });

  it('reports all missing vars in one error', () => {
    try {
      expandTemplate('{{x}} {{y}} {{z}}', { y: 'ok' });
      throw new Error('should have thrown');
    } catch (e) {
      expect(e).toBeInstanceOf(TemplateError);
      expect((e as TemplateError).missing).toEqual(['x', 'z']);
    }
  });
});
