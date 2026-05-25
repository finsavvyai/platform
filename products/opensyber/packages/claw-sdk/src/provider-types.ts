/**
 * Provider identifiers supported by the Claw gateway. Mirrors the registry
 * in clawpipe/gateway/src/providers/registry.ts. Update both when a new
 * adapter lands gateway-side.
 */
export type ClawProvider =
  | 'anthropic'
  | 'openai'
  | 'workers-ai'
  | 'llamafile'
  // Cheap-tier hosted providers
  | 'gemini'
  | 'deepseek'
  | 'openrouter'
  | 'groq'
  | 'mistral'
  | 'together'
  | 'fireworks'
  | 'perplexity'
  | 'xai'
  | 'cerebras'
  // Specialist + enterprise providers
  | 'cohere'
  | 'ai21'
  | 'replicate'
  | 'huggingface'
  | 'writer'
  | 'databricks'
  | 'azure-openai'
  | 'bedrock'
  | 'vertex'
