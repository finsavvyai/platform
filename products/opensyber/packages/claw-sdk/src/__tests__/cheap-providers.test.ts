import { describe, it, expect } from 'vitest'
import {
  resolveModel,
  getProviderDefaults,
  listModelAliases,
} from '../providers.js'
import {
  PROVIDER_PRICING,
  CHEAPEST_BY_USE_CASE,
  estimateCost,
  cheapestFor,
} from '../pricing.js'

describe('cheap-tier provider aliases', () => {
  it('flash → gemini-2.0-flash', () => {
    expect(resolveModel('flash')).toEqual({ provider: 'gemini', modelId: 'gemini-2.0-flash' })
  })

  it('deepseek → deepseek-chat', () => {
    expect(resolveModel('deepseek')).toEqual({ provider: 'deepseek', modelId: 'deepseek-chat' })
  })

  it('deepseek-reasoner stays on deepseek provider', () => {
    expect(resolveModel('deepseek-reasoner')).toEqual({
      provider: 'deepseek',
      modelId: 'deepseek-reasoner',
    })
  })

  it('groq-llama → groq provider with versatile model', () => {
    expect(resolveModel('groq-llama')).toEqual({
      provider: 'groq',
      modelId: 'llama-3.3-70b-versatile',
    })
  })

  it('mistral-small → mistral provider', () => {
    expect(resolveModel('mistral-small').provider).toBe('mistral')
  })

  it('auto-cheap → openrouter auto router', () => {
    expect(resolveModel('auto-cheap')).toEqual({
      provider: 'openrouter',
      modelId: 'openrouter/auto',
    })
  })
})

describe('resolveModel — auto-detection for cheap providers', () => {
  it('detects gemini-* as gemini provider', () => {
    expect(resolveModel('gemini-2.5-pro').provider).toBe('gemini')
  })

  it('detects deepseek-* as deepseek provider', () => {
    expect(resolveModel('deepseek-v3').provider).toBe('deepseek')
  })

  it('detects openrouter/* as openrouter provider', () => {
    expect(resolveModel('openrouter/anthropic/claude-3.5-sonnet').provider).toBe('openrouter')
  })

  it('detects mistral-* as mistral provider', () => {
    expect(resolveModel('mistral-large-latest').provider).toBe('mistral')
  })

  it('detects meta-llama/* as together provider', () => {
    expect(resolveModel('meta-llama/Llama-3.3-70B-Instruct-Turbo').provider).toBe('together')
  })
})

describe('provider defaults for cheap tier', () => {
  it('gemini supports tools + streaming with 8k token cap', () => {
    const c = getProviderDefaults('gemini')
    expect(c.supportsTools).toBe(true)
    expect(c.supportsStreaming).toBe(true)
    expect(c.maxTokens).toBe(8192)
  })

  it('deepseek defaults to deepseek-chat', () => {
    expect(getProviderDefaults('deepseek').model).toBe('deepseek-chat')
  })

  it('openrouter defaults to auto-routing model', () => {
    expect(getProviderDefaults('openrouter').model).toBe('openrouter/auto')
  })
})

describe('PROVIDER_PRICING', () => {
  it('lists pricing for every supported provider', () => {
    for (const p of ['anthropic', 'openai', 'gemini', 'deepseek', 'groq', 'mistral', 'together'] as const) {
      expect(PROVIDER_PRICING[p]).toBeDefined()
    }
  })

  it('gemini is the cheapest non-zero hosted provider', () => {
    const hosted = (Object.keys(PROVIDER_PRICING) as Array<keyof typeof PROVIDER_PRICING>)
      .filter((p) => PROVIDER_PRICING[p].in > 0)
      .sort((a, b) => PROVIDER_PRICING[a].in - PROVIDER_PRICING[b].in)
    expect(hosted[0]).toBe('gemini')
  })

  it('claude is more expensive than every cheap-tier provider on input', () => {
    const cheap = ['gemini', 'deepseek', 'mistral'] as const
    for (const p of cheap) {
      expect(PROVIDER_PRICING[p].in).toBeLessThan(PROVIDER_PRICING.anthropic.in)
    }
  })
})

describe('estimateCost', () => {
  it('returns USD per request from token counts', () => {
    const cost = estimateCost('gemini', 1_000_000, 1_000_000)
    expect(cost).toBeCloseTo(0.075 + 0.30, 5)
  })

  it('returns 0 for llamafile (local)', () => {
    expect(estimateCost('llamafile', 5_000_000, 5_000_000)).toBe(0)
  })

  it('claude is ~25× more expensive than gemini at equal token mix', () => {
    const claudeCost = estimateCost('anthropic', 1_000_000, 1_000_000)
    const geminiCost = estimateCost('gemini', 1_000_000, 1_000_000)
    expect(claudeCost / geminiCost).toBeGreaterThan(40)
  })
})

describe('cheapestFor', () => {
  it('routes summarization to gemini', () => {
    expect(cheapestFor('summarization')).toBe('gemini')
  })

  it('routes reasoning to deepseek', () => {
    expect(cheapestFor('reasoning')).toBe('deepseek')
  })

  it('keeps frontier on anthropic', () => {
    expect(cheapestFor('frontier')).toBe('anthropic')
  })

  it('falls back to gemini for unknown use cases', () => {
    expect(cheapestFor('totally-unknown-use-case')).toBe('gemini')
  })
})

describe('CHEAPEST_BY_USE_CASE', () => {
  it('every routed provider exists in PROVIDER_PRICING', () => {
    for (const p of Object.values(CHEAPEST_BY_USE_CASE)) {
      expect(PROVIDER_PRICING[p]).toBeDefined()
    }
  })
})

describe('listModelAliases includes cheap-tier', () => {
  it('lists flash, deepseek, groq-llama, mistral-small', () => {
    const a = listModelAliases()
    for (const k of ['flash', 'deepseek', 'groq-llama', 'mistral-small', 'auto-cheap']) {
      expect(a[k]).toBeDefined()
    }
  })
})
