import { describe, it, expect } from 'vitest';
import { parseSSEToken } from './llm-caller';

describe('parseSSEToken', () => {
  it('parses anthropic content_block_delta', () => {
    const data = JSON.stringify({ type: 'content_block_delta', delta: { text: 'hello' } });
    expect(parseSSEToken(data, 'anthropic')).toBe('hello');
  });

  it('returns empty for non-delta anthropic events', () => {
    const data = JSON.stringify({ type: 'message_start' });
    expect(parseSSEToken(data, 'anthropic')).toBe('');
  });

  it('parses openai-compatible delta content', () => {
    const data = JSON.stringify({ choices: [{ delta: { content: 'world' } }] });
    expect(parseSSEToken(data, 'openai')).toBe('world');
  });

  it('parses deepseek delta content', () => {
    const data = JSON.stringify({ choices: [{ delta: { content: 'test' } }] });
    expect(parseSSEToken(data, 'deepseek')).toBe('test');
  });

  it('returns empty for missing content', () => {
    const data = JSON.stringify({ choices: [{ delta: {} }] });
    expect(parseSSEToken(data, 'openai')).toBe('');
  });

  it('returns empty for invalid JSON', () => {
    expect(parseSSEToken('not json', 'openai')).toBe('');
  });

  it('handles empty delta text', () => {
    const data = JSON.stringify({ type: 'content_block_delta', delta: { text: '' } });
    expect(parseSSEToken(data, 'anthropic')).toBe('');
  });
});
