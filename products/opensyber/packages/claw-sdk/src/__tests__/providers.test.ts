import { describe, it, expect } from 'vitest'
import {
  resolveModel,
  getProviderDefaults,
  listModelAliases,
} from '../providers.js'

describe('resolveModel', () => {
  it('resolves known aliases', () => {
    expect(resolveModel('opus')).toEqual({
      provider: 'anthropic',
      modelId: 'claude-opus-4-6',
    })
    expect(resolveModel('sonnet')).toEqual({
      provider: 'anthropic',
      modelId: 'claude-sonnet-4-6',
    })
    expect(resolveModel('gpt-4o')).toEqual({
      provider: 'openai',
      modelId: 'gpt-4o',
    })
  })

  it('auto-detects workers-ai models by @cf/ prefix', () => {
    const result = resolveModel('@cf/meta/llama-3.3-70b')
    expect(result.provider).toBe('workers-ai')
    expect(result.modelId).toBe('@cf/meta/llama-3.3-70b')
  })

  it('auto-detects OpenAI models by gpt- prefix', () => {
    const result = resolveModel('gpt-4-turbo')
    expect(result.provider).toBe('openai')
    expect(result.modelId).toBe('gpt-4-turbo')
  })

  it('auto-detects OpenAI o1 models', () => {
    const result = resolveModel('o1-preview')
    expect(result.provider).toBe('openai')
    expect(result.modelId).toBe('o1-preview')
  })

  it('falls back to default provider for unknown models', () => {
    const result = resolveModel('custom-model', 'anthropic')
    expect(result.provider).toBe('anthropic')
    expect(result.modelId).toBe('custom-model')
  })
})

describe('getProviderDefaults', () => {
  it('returns anthropic defaults', () => {
    const config = getProviderDefaults('anthropic')
    expect(config.provider).toBe('anthropic')
    expect(config.maxTokens).toBe(8192)
    expect(config.supportsTools).toBe(true)
    expect(config.supportsStreaming).toBe(true)
  })

  it('returns workers-ai defaults with no tool support', () => {
    const config = getProviderDefaults('workers-ai')
    expect(config.supportsTools).toBe(false)
    expect(config.supportsStreaming).toBe(true)
  })

  it('returns a copy, not a reference', () => {
    const a = getProviderDefaults('openai')
    const b = getProviderDefaults('openai')
    a.maxTokens = 999
    expect(b.maxTokens).toBe(4096)
  })
})

describe('listModelAliases', () => {
  it('returns all known aliases', () => {
    const aliases = listModelAliases()
    expect(Object.keys(aliases).length).toBeGreaterThanOrEqual(5)
    expect(aliases['opus']).toBeDefined()
    expect(aliases['haiku']).toBeDefined()
  })

  it('returns a copy, not a reference', () => {
    const a = listModelAliases()
    delete a['opus']
    const b = listModelAliases()
    expect(b['opus']).toBeDefined()
  })

  it('includes local, local-small, and local-medium aliases', () => {
    const aliases = listModelAliases()
    expect(aliases['local']).toBeDefined()
    expect(aliases['local-small']).toBeDefined()
    expect(aliases['local-medium']).toBeDefined()
  })

  it('local aliases point to llamafile provider', () => {
    const aliases = listModelAliases()
    expect(aliases['local'].provider).toBe('llamafile')
    expect(aliases['local-small'].provider).toBe('llamafile')
    expect(aliases['local-medium'].provider).toBe('llamafile')
  })
})

describe('resolveModel — llamafile provider', () => {
  it('resolves "local" alias to llamafile provider', () => {
    const result = resolveModel('local')
    expect(result.provider).toBe('llamafile')
    expect(result.modelId).toBe('llama-3-8b')
  })

  it('resolves "local-small" alias to llamafile provider', () => {
    const result = resolveModel('local-small')
    expect(result.provider).toBe('llamafile')
    expect(result.modelId).toBe('llama-3-8b')
  })

  it('resolves "local-medium" alias to llamafile with 70b model', () => {
    const result = resolveModel('local-medium')
    expect(result.provider).toBe('llamafile')
    expect(result.modelId).toBe('llama-3-70b')
  })

  it('resolves literal "llamafile" string to llamafile provider via prefix rule', () => {
    const result = resolveModel('llamafile')
    expect(result.provider).toBe('llamafile')
    expect(result.modelId).toBe('llamafile')
  })

  it('resolves unknown "local-xl" via local- prefix rule to llamafile', () => {
    const result = resolveModel('local-xl')
    expect(result.provider).toBe('llamafile')
    expect(result.modelId).toBe('local-xl')
  })
})

describe('getProviderDefaults — llamafile', () => {
  it('returns llamafile defaults with correct provider and model', () => {
    const config = getProviderDefaults('llamafile')
    expect(config.provider).toBe('llamafile')
    expect(config.model).toBe('llama-3-8b')
    expect(config.maxTokens).toBe(2048)
  })

  it('llamafile does not support tools', () => {
    const config = getProviderDefaults('llamafile')
    expect(config.supportsTools).toBe(false)
  })

  it('llamafile supports streaming', () => {
    const config = getProviderDefaults('llamafile')
    expect(config.supportsStreaming).toBe(true)
  })

  it('returns a copy, not a reference', () => {
    const a = getProviderDefaults('llamafile')
    const b = getProviderDefaults('llamafile')
    a.maxTokens = 9999
    expect(b.maxTokens).toBe(2048)
  })
})
