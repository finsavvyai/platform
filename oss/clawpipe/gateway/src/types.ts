/** Gateway shared types. */

export interface Env {
  DB: D1Database;
  CACHE: KVNamespace;
  ENVIRONMENT: string;
  OPENAI_API_KEY?: string;
  ANTHROPIC_API_KEY?: string;
  DEEPSEEK_API_KEY?: string;
  GROQ_API_KEY?: string;
  GEMINI_API_KEY?: string;
  MISTRAL_API_KEY?: string;
  TOGETHER_API_KEY?: string;
  FIREWORKS_API_KEY?: string;
  OPENROUTER_API_KEY?: string;
  PERPLEXITY_API_KEY?: string;
  COHERE_API_KEY?: string;
  AI21_API_KEY?: string;
  CEREBRAS_API_KEY?: string;
  REPLICATE_API_KEY?: string;
  HUGGINGFACE_API_KEY?: string;
  WRITER_API_KEY?: string;
  DATABRICKS_API_KEY?: string;
  AZURE_OPENAI_API_KEY?: string;
  BEDROCK_API_KEY?: string;
  VERTEX_API_KEY?: string;
  XAI_API_KEY?: string;
  AI?: Ai;
  PROVIDER_KEY_ENCRYPTION_SECRET?: string;
  AUTH_SECRET?: string;
  GOOGLE_CLIENT_ID?: string;
  GOOGLE_CLIENT_SECRET?: string;
  GITHUB_CLIENT_ID?: string;
  GITHUB_CLIENT_SECRET?: string;
  RESEND_API_KEY?: string;
  RESEND_FROM?: string;
  OIDC_ISSUER?: string;
  OIDC_CLIENT_ID?: string;
  OIDC_CLIENT_SECRET?: string;
  OIDC_REDIRECT_ORIGIN?: string;
}

export interface PromptRequest {
  prompt: string;
  provider: string;
  model: string;
  system?: string;
  maxTokens?: number;
  temperature?: number;
}

export interface PromptResponse {
  text: string;
  tokensIn: number;
  tokensOut: number;
  latencyMs: number;
}

export interface ProviderAdapter {
  name: string;
  call(req: PromptRequest, apiKey: string): Promise<PromptResponse>;
}
