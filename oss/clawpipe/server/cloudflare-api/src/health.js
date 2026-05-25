/** Health check endpoint logic. */

export function healthCheck(env) {
  const providers = {};
  if (env.OPENAI_API_KEY) providers.openai = true;
  if (env.ANTHROPIC_API_KEY) providers.anthropic = true;
  if (env.OLLAMA_BASE_URL) providers.ollama = true;
  return {
    status: Object.keys(providers).length > 0 ? "healthy" : "no_providers",
    gateway: "cloudflare-worker",
    cloud_providers: providers,
    timestamp: new Date().toISOString(),
  };
}
