import { describe, it, expect } from 'vitest';
import { escapeLike } from './escape-like.js';

describe('escapeLike', () => {
  it('passes through normal strings unchanged', () => {
    expect(escapeLike('hello world')).toBe('hello world');
  });

  it('escapes percent wildcard', () => {
    expect(escapeLike('100%')).toBe('100\\%');
  });

  it('escapes underscore wildcard', () => {
    expect(escapeLike('user_name')).toBe('user\\_name');
  });

  it('escapes backslash', () => {
    expect(escapeLike('path\\file')).toBe('path\\\\file');
  });

  it('escapes all wildcards in a mixed string', () => {
    expect(escapeLike('%_test\\val%')).toBe('\\%\\_test\\\\val\\%');
  });

  it('handles empty string', () => {
    expect(escapeLike('')).toBe('');
  });

  it('handles string with only wildcards', () => {
    expect(escapeLike('%%%')).toBe('\\%\\%\\%');
  });
});
