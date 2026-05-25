import type { ClawProvider } from './types.js'

/** Provider-specific configuration */
export interface ProviderConfig {
  provider: ClawProvider
  model: string
  maxTokens: number
  supportsTools: boolean
  supportsStreaming: boolean
}

/** Model alias → provider + model ID mapping */
interface ModelAlias {
  provider: ClawProvider
  modelId: string
}

const MODEL_ALIASES: Record<string, ModelAlias> = {
  'opus': { provider: 'anthropic', modelId: 'claude-opus-4-6' },
  'sonnet': { provider: 'anthropic', modelId: 'claude-sonnet-4-6' },
  'haiku': { provider: 'anthropic', modelId: 'claude-haiku-4-5-20251001' },
  'gpt-4o': { provider: 'openai', modelId: 'gpt-4o' },
  'gpt-4o-mini': { provider: 'openai', modelId: 'gpt-4o-mini' },
  'llama-70b': { provider: 'workers-ai', modelId: '@cf/meta/llama-3.3-70b-instruct-fp8-fast' },
  'local': { provider: 'llamafile', modelId: 'llama-3-8b' },
  'local-small': { provider: 'llamafile', modelId: 'llama-3-8b' },
  'local-medium': { provider: 'llamafile', modelId: 'llama-3-70b' },
  // Cheap-tier aliases — see CHEAPEST_BY_USE_CASE for $/quality routing
  'flash': { provider: 'gemini', modelId: 'gemini-2.0-flash' },
  'gemini-pro': { provider: 'gemini', modelId: 'gemini-2.5-pro' },
  'deepseek': { provider: 'deepseek', modelId: 'deepseek-chat' },
  'deepseek-reasoner': { provider: 'deepseek', modelId: 'deepseek-reasoner' },
  'groq-llama': { provider: 'groq', modelId: 'llama-3.3-70b-versatile' },
  'mistral-small': { provider: 'mistral', modelId: 'mistral-small-latest' },
  'mistral-large': { provider: 'mistral', modelId: 'mistral-large-latest' },
  'together-llama': { provider: 'together', modelId: 'meta-llama/Llama-3.3-70B-Instruct-Turbo' },
  'auto-cheap': { provider: 'openrouter', modelId: 'openrouter/auto' },
}

/** Default provider configurations */
const PROVIDER_DEFAULTS: Record<ClawProvider, ProviderConfig> = {
  anthropic: {
    provider: 'anthropic',
    model: 'claude-sonnet-4-6',
    maxTokens: 8192,
    supportsTools: true,
    supportsStreaming: true,
  },
  openai: {
    provider: 'openai',
    model: 'gpt-4o',
    maxTokens: 4096,
    supportsTools: true,
    supportsStreaming: true,
  },
  'workers-ai': {
    provider: 'workers-ai',
    model: '@cf/meta/llama-3.3-70b-instruct-fp8-fast',
    maxTokens: 2048,
    supportsTools: false,
    supportsStreaming: true,
  },
  llamafile: {
    provider: 'llamafile',
    model: 'llama-3-8b',
    maxTokens: 2048,
    supportsTools: false,
    supportsStreaming: true,
  },
  gemini: {
    provider: 'gemini',
    model: 'gemini-2.0-flash',
    maxTokens: 8192,
    supportsTools: true,
    supportsStreaming: true,
  },
  deepseek: {
    provider: 'deepseek',
    model: 'deepseek-chat',
    maxTokens: 8192,
    supportsTools: true,
    supportsStreaming: true,
  },
  openrouter: {
    provider: 'openrouter',
    model: 'openrouter/auto',
    maxTokens: 8192,
    supportsTools: true,
    supportsStreaming: true,
  },
  groq: {
    provider: 'groq',
    model: 'llama-3.3-70b-versatile',
    maxTokens: 8000,
    supportsTools: true,
    supportsStreaming: true,
  },
  mistral: {
    provider: 'mistral',
    model: 'mistral-small-latest',
    maxTokens: 8192,
    supportsTools: true,
    supportsStreaming: true,
  },
  together: {
    provider: 'together',
    model: 'meta-llama/Llama-3.3-70B-Instruct-Turbo',
    maxTokens: 8192,
    supportsTools: true,
    supportsStreaming: true,
  },
  fireworks:    cheapHostedDefault('fireworks', 'accounts/fireworks/models/llama-v3p3-70b-instruct'),
  perplexity:   cheapHostedDefault('perplexity', 'sonar-large'),
  xai:          cheapHostedDefault('xai', 'grok-2'),
  cerebras:     cheapHostedDefault('cerebras', 'llama-3.3-70b'),
  cohere:       cheapHostedDefault('cohere', 'command-r-plus'),
  ai21:         cheapHostedDefault('ai21', 'jamba-1.5-large'),
  replicate:    cheapHostedDefault('replicate', 'meta/meta-llama-3-70b-instruct'),
  huggingface:  cheapHostedDefault('huggingface', 'meta-llama/Llama-3.3-70B-Instruct'),
  writer:       cheapHostedDefault('writer', 'palmyra-x-004'),
  databricks:   cheapHostedDefault('databricks', 'databricks-meta-llama-3-3-70b-instruct'),
  'azure-openai': cheapHostedDefault('azure-openai', 'gpt-4o'),
  bedrock:      cheapHostedDefault('bedrock', 'anthropic.claude-3-5-sonnet-20241022-v2:0'),
  vertex:       cheapHostedDefault('vertex', 'gemini-2.0-flash'),
}

/** Shorthand: most hosted providers share the same defaults shape. */
function cheapHostedDefault(provider: ClawProvider, model: string): ProviderConfig {
  return { provider, model, maxTokens: 8192, supportsTools: true, supportsStreaming: true }
}

// Pricing + use-case routing live in ./pricing.ts to keep this file under
// the 200-line cap. Re-exported below for backward compatibility.
export { PROVIDER_PRICING, CHEAPEST_BY_USE_CASE, estimateCost, cheapestFor } from './pricing.js'

/**
 * Resolve a model name or alias to provider + model ID.
 * Returns the alias mapping if found, otherwise treats input as literal model ID.
 */
export function resolveModel(
  modelOrAlias: string,
  defaultProvider: ClawProvider = 'anthropic'
): { provider: ClawProvider; modelId: string } {
  const alias = MODEL_ALIASES[modelOrAlias]
  if (alias) return alias

  // If model contains '/' it's likely workers-ai format
  if (modelOrAlias.startsWith('@cf/')) {
    return { provider: 'workers-ai', modelId: modelOrAlias }
  }
  // If model starts with 'gpt' or 'o1' it's OpenAI
  if (modelOrAlias.startsWith('gpt-') || modelOrAlias.startsWith('o1')) {
    return { provider: 'openai', modelId: modelOrAlias }
  }
  // If model starts with 'local-' it's llamafile
  if (modelOrAlias.startsWith('local-') || modelOrAlias === 'llamafile') {
    return { provider: 'llamafile', modelId: modelOrAlias }
  }
  // Cheap-tier auto-detection by canonical name prefixes.
  if (modelOrAlias.startsWith('gemini-') || modelOrAlias.startsWith('models/gemini-')) {
    return { provider: 'gemini', modelId: modelOrAlias }
  }
  if (modelOrAlias.startsWith('deepseek-') || modelOrAlias.startsWith('deepseek/')) {
    return { provider: 'deepseek', modelId: modelOrAlias }
  }
  if (modelOrAlias.startsWith('openrouter/') || modelOrAlias.includes(':free')) {
    return { provider: 'openrouter', modelId: modelOrAlias }
  }
  if (modelOrAlias.startsWith('mistral-') || modelOrAlias.startsWith('mixtral-') || modelOrAlias.startsWith('codestral-')) {
    return { provider: 'mistral', modelId: modelOrAlias }
  }
  if (modelOrAlias.startsWith('meta-llama/') || modelOrAlias.startsWith('Qwen/') || modelOrAlias.includes('-Turbo')) {
    return { provider: 'together', modelId: modelOrAlias }
  }
  // Default to configured provider
  return { provider: defaultProvider, modelId: modelOrAlias }
}

/** Get default config for a provider */
export function getProviderDefaults(
  provider: ClawProvider
): ProviderConfig {
  return { ...PROVIDER_DEFAULTS[provider] }
}

/** List all known model aliases */
export function listModelAliases(): Record<string, ModelAlias> {
  return { ...MODEL_ALIASES }
}
