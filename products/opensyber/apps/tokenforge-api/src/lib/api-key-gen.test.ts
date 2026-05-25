import { describe, it, expect } from 'vitest';
import { generateApiKey, extractKeyPrefix } from './api-key-gen.js';

describe('generateApiKey', () => {
  it('generates a key with tf_ prefix', () => {
    const key = generateApiKey();
    expect(key.startsWith('tf_')).toBe(true);
  });

  it('generates a key with 35 total chars (tf_ + 32 hex)', () => {
    const key = generateApiKey();
    expect(key.length).toBe(35);
  });

  it('generates unique keys', () => {
    const keys = new Set(Array.from({ length: 50 }, () => generateApiKey()));
    expect(keys.size).toBe(50);
  });

  it('generates keys with valid hex characters', () => {
    const key = generateApiKey();
    const hex = key.slice(3);
    expect(/^[0-9a-f]+$/.test(hex)).toBe(true);
  });
});

describe('extractKeyPrefix', () => {
  it('returns first 8 chars + ellipsis', () => {
    const prefix = extractKeyPrefix('tf_abc12345def67890abc12345def67890');
    expect(prefix).toBe('tf_abc12...');
  });

  it('works with a minimal key', () => {
    const prefix = extractKeyPrefix('tf_12345');
    expect(prefix).toBe('tf_12345...');
  });
});
