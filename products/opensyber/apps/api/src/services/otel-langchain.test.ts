import { describe, it, expect } from 'vitest';
import { extractLangChainMetadata } from './otel-ingestion.js';

describe('OTEL - LangChain Metadata Extraction', () => {
  it('should extract model from attributes', () => {
    const attributes = {
      'langchain.model': 'gpt-4',
      'langchain.run_type': 'chain',
    };

    const metadata = extractLangChainMetadata(attributes);

    expect(metadata.model).toBe('gpt-4');
    expect(metadata.runType).toBe('chain');
  });

  it('should sum token counts from multiple sources', () => {
    const attributes = {
      'langchain.token_count': 10,
      'llm.usage.completion_tokens': 5,
      'llm.usage.prompt_tokens': 20,
    };

    const metadata = extractLangChainMetadata(attributes);

    expect(metadata.tokens).toBe(35);
  });

  it('should extract tool calls as array', () => {
    const attributes = {
      'langchain.tool_calls': ['tool-a', 'tool-b', 'tool-c'],
    };

    const metadata = extractLangChainMetadata(attributes);

    expect(metadata.toolCalls).toEqual(['tool-a', 'tool-b', 'tool-c']);
  });

  it('should convert single tool call to array', () => {
    const attributes = {
      'langchain.tool_calls': 'single-tool',
    };

    const metadata = extractLangChainMetadata(attributes);

    expect(metadata.toolCalls).toEqual(['single-tool']);
  });

  it('should extract cost from attributes', () => {
    const attributes = {
      'langchain.cost_usd': 0.025,
    };

    const metadata = extractLangChainMetadata(attributes);

    expect(metadata.cost).toBe(0.025);
  });

  it('should extract chain name from attributes', () => {
    const attributes = {
      'langchain.chain_name': 'document-summarizer',
    };

    const metadata = extractLangChainMetadata(attributes);

    expect(metadata.chainName).toBe('document-summarizer');
  });

  it('should return empty object when attributes are missing', () => {
    const metadata = extractLangChainMetadata(undefined);

    expect(metadata).toEqual({});
  });

  it('should return empty object for non-LangChain attributes', () => {
    const attributes = {
      'custom.key': 'value',
      'other.attr': 123,
    };

    const metadata = extractLangChainMetadata(attributes);

    expect(metadata).toEqual({});
  });

  it('should handle null gracefully', () => {
    const metadata = extractLangChainMetadata(null as any);

    expect(metadata).toEqual({});
  });

  it('should handle missing token attributes', () => {
    const attributes = {
      'langchain.model': 'gpt-3.5',
    };

    const metadata = extractLangChainMetadata(attributes);

    expect(metadata.tokens).toBeUndefined();
    expect(metadata.model).toBe('gpt-3.5');
  });

  it('should handle zero tokens', () => {
    const attributes = {
      'langchain.token_count': 0,
    };

    const metadata = extractLangChainMetadata(attributes);

    expect(metadata.tokens).toBeUndefined();
  });
});
