import type { ModelPricing } from '../types.js';

const PRICING_TABLE: Record<string, ModelPricing> = {
  'claude-sonnet-4-20250514': {
    input: 3,
    output: 15,
  },
  'claude-opus-4-1': {
    input: 15,
    output: 75,
  },
  'claude-haiku-3-5': {
    input: 0.8,
    output: 4,
  },
  'gpt-4o': {
    input: 2.5,
    output: 10,
  },
  'gpt-4-turbo': {
    input: 10,
    output: 30,
  },
  'gpt-3.5-turbo': {
    input: 0.5,
    output: 1.5,
  },
  'llama2': {
    input: 0,
    output: 0,
  },
};

export function getPricing(model: string): ModelPricing {
  return (
    PRICING_TABLE[model] ?? {
      input: 0,
      output: 0,
    }
  );
}
