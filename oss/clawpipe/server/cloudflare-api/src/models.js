/** Model listing — aggregate available models from all providers. */

export async function listModels(env) {
  const models = [];
  if (env.OPENAI_API_KEY) {
    for (const id of [
      "gpt-4o",
      "gpt-4o-mini",
      "gpt-4-turbo",
      "o4-mini",
      "o3-mini",
    ]) {
      models.push({
        id,
        object: "model",
        owned_by: "openai",
        provider: "openai",
      });
    }
  }
  if (env.ANTHROPIC_API_KEY) {
    for (const id of [
      "claude-sonnet-4-5-20250929",
      "claude-opus-4-6",
      "claude-haiku-4-5-20251001",
    ]) {
      models.push({
        id,
        object: "model",
        owned_by: "anthropic",
        provider: "anthropic",
      });
    }
  }
  if (env.OLLAMA_BASE_URL) {
    try {
      const base = env.OLLAMA_BASE_URL.replace(/\/$/, "");
      const resp = await fetch(`${base}/api/tags`, {
        signal: AbortSignal.timeout(3000),
      });
      if (resp.ok) {
        const data = await resp.json();
        (data.models || []).forEach((m) => {
          models.push({
            id: m.name,
            object: "model",
            owned_by: "openclaw",
            provider: "openclaw",
          });
        });
      }
    } catch (e) {
      for (const id of ["llama3", "mistral", "deepseek-coder", "qwen2"]) {
        models.push({
          id,
          object: "model",
          owned_by: "openclaw",
          provider: "openclaw",
        });
      }
    }
  }
  return { object: "list", data: models };
}
