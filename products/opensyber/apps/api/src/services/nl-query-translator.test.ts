/**
 * NL Query Translator Tests
 */
import { describe, it, expect, vi } from 'vitest';
import {
  translateNaturalLanguageQuery, describeFilter, translateWithAI, isFilterEmpty,
} from './nl-query-translator.js';

describe('NL Query Translator', () => {
  it('extracts risk level from query', () => {
    const filter = translateNaturalLanguageQuery('show me critical events');
    expect(filter.riskLevel).toBe('critical');
  });

  it('extracts event type from query', () => {
    const filter = translateNaturalLanguageQuery('list all bash commands');
    expect(filter.eventType).toBe('bash_command');
  });

  it('extracts agent name from query', () => {
    const filter = translateNaturalLanguageQuery('what did cursor do last week');
    expect(filter.agentName).toBe('cursor');
    expect(filter.dateRange).toBeDefined();
  });

  it('detects sensitive file patterns', () => {
    const filter = translateNaturalLanguageQuery('agents that accessed .env files');
    expect(filter.filePath).toBe('.env');
  });

  it('extracts time range', () => {
    const filter = translateNaturalLanguageQuery('show activity from last 30 days');
    expect(filter.dateRange).toBeDefined();
    expect(filter.dateRange?.from).toBeDefined();
  });

  it('handles complex queries', () => {
    const filter = translateNaturalLanguageQuery(
      'show me suspicious cline activity accessing .pem files last week',
    );
    expect(filter.riskLevel).toBe('high');
    expect(filter.agentName).toBe('cline');
    expect(filter.filePath).toBe('.pem');
    expect(filter.dateRange).toBeDefined();
  });

  it('describes filter correctly', () => {
    const desc = describeFilter({ riskLevel: 'high', agentName: 'cursor' });
    expect(desc).toContain('risk level: high');
    expect(desc).toContain('agent: cursor');
  });

  it('handles empty query', () => {
    const filter = translateNaturalLanguageQuery('show me everything');
    const desc = describeFilter(filter);
    expect(desc).toBe('No specific filters applied');
  });
});

describe('isFilterEmpty', () => {
  it('returns true for empty filter', () => {
    expect(isFilterEmpty({})).toBe(true);
  });

  it('returns false when any field is set', () => {
    expect(isFilterEmpty({ riskLevel: 'high' })).toBe(false);
    expect(isFilterEmpty({ eventType: 'bash_command' })).toBe(false);
    expect(isFilterEmpty({ agentName: 'cursor' })).toBe(false);
  });
});

describe('translateWithAI', () => {
  it('calls AI model and parses JSON response', async () => {
    const mockAI = {
      run: vi.fn().mockResolvedValue({
        response: '{"eventType":"file_read","riskLevel":"high","agentName":"devin"}',
      }),
    };
    const filter = await translateWithAI('what files did devin read that are risky', mockAI);
    expect(mockAI.run).toHaveBeenCalledWith(
      '@cf/meta/llama-3.1-8b-instruct',
      expect.objectContaining({ messages: expect.any(Array), max_tokens: 256 }),
    );
    expect(filter.eventType).toBe('file_read');
    expect(filter.riskLevel).toBe('high');
    expect(filter.agentName).toBe('devin');
  });

  it('extracts JSON from markdown-wrapped response', async () => {
    const mockAI = {
      run: vi.fn().mockResolvedValue({
        response: 'Here is the filter:\n```json\n{"riskLevel":"critical"}\n```',
      }),
    };
    const filter = await translateWithAI('show critical stuff', mockAI);
    expect(filter.riskLevel).toBe('critical');
  });

  it('returns empty filter when AI returns no JSON', async () => {
    const mockAI = {
      run: vi.fn().mockResolvedValue({ response: 'I cannot understand the query' }),
    };
    const filter = await translateWithAI('asdfghjkl', mockAI);
    expect(filter).toEqual({});
  });

  it('returns empty filter when AI throws', async () => {
    const mockAI = {
      run: vi.fn().mockRejectedValue(new Error('AI unavailable')),
    };
    const filter = await translateWithAI('show me alerts', mockAI);
    expect(filter).toEqual({});
  });

  it('returns empty filter when response is undefined', async () => {
    const mockAI = { run: vi.fn().mockResolvedValue({}) };
    const filter = await translateWithAI('anything', mockAI);
    expect(filter).toEqual({});
  });

  it('sanitizes fields to strings', async () => {
    const mockAI = {
      run: vi.fn().mockResolvedValue({
        response: '{"riskLevel":123,"agentName":true}',
      }),
    };
    const filter = await translateWithAI('query', mockAI);
    expect(filter.riskLevel).toBe('123');
    expect(filter.agentName).toBe('true');
  });
});

describe('pattern matching still works for known keywords', () => {
  it('matches bash commands', () => {
    const filter = translateNaturalLanguageQuery('show bash activity');
    expect(filter.eventType).toBe('bash_command');
  });

  it('matches risk keywords', () => {
    expect(translateNaturalLanguageQuery('dangerous actions').riskLevel).toBe('critical');
    expect(translateNaturalLanguageQuery('moderate risk').riskLevel).toBe('medium');
  });

  it('matches agent names', () => {
    expect(translateNaturalLanguageQuery('what did windsurf do').agentName).toBe('windsurf');
  });
});
