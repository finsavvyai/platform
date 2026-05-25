/**
 * Local AI Provider Support — llamafile + Voicebox integration.
 *
 * llamafile: OpenAI-compatible API at localhost:8080 for free LLM inference.
 * Voicebox: Local TTS at localhost:17493 for free voice synthesis.
 *
 * These provide zero-cost alternatives to cloud APIs.
 */

interface LocalProviderStatus {
  available: boolean;
  endpoint: string;
  latencyMs?: number;
}

/** Check if llamafile is running locally. */
export async function checkLlamafile(): Promise<LocalProviderStatus> {
  const endpoint = 'http://localhost:8080';
  try {
    const start = Date.now();
    const res = await fetch(`${endpoint}/v1/models`, { signal: AbortSignal.timeout(2000) });
    if (res.ok) {
      return { available: true, endpoint, latencyMs: Date.now() - start };
    }
  } catch { /* not running */ }
  return { available: false, endpoint };
}

/** Check if Voicebox is running locally. */
export async function checkVoicebox(): Promise<LocalProviderStatus> {
  const endpoint = 'http://localhost:17493';
  try {
    const start = Date.now();
    const res = await fetch(`${endpoint}/docs`, { signal: AbortSignal.timeout(2000) });
    if (res.ok) {
      return { available: true, endpoint, latencyMs: Date.now() - start };
    }
  } catch { /* not running */ }
  return { available: false, endpoint };
}

/**
 * Call llamafile for LLM inference (OpenAI-compatible API).
 * Falls back to Claw Gateway if llamafile is not available.
 */
export async function callLlamafile(
  systemPrompt: string,
  userMessage: string,
  maxTokens = 4096,
): Promise<{ text: string; local: boolean }> {
  const status = await checkLlamafile();
  if (!status.available) {
    return { text: '', local: false };
  }

  const res = await fetch(`${status.endpoint}/v1/chat/completions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userMessage },
      ],
      max_tokens: maxTokens,
      temperature: 0.3,
      stream: false,
    }),
  });

  if (!res.ok) return { text: '', local: false };

  const data = await res.json() as {
    choices: Array<{ message: { content: string } }>;
  };

  return {
    text: data.choices?.[0]?.message?.content || '',
    local: true,
  };
}

/**
 * Call Voicebox for text-to-speech (local, free).
 * Returns audio buffer or null if not available.
 */
export async function callVoicebox(
  text: string,
  voice = 'default',
  language = 'en',
): Promise<ArrayBuffer | null> {
  const status = await checkVoicebox();
  if (!status.available) return null;

  const res = await fetch(`${status.endpoint}/api/tts`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text, voice, language }),
  });

  if (!res.ok) return null;
  return res.arrayBuffer();
}

/**
 * Check if Ollama is running with Gemma 4 model.
 * Gemma 4 31B: 256K context, text+image, free self-hosted.
 * Gemma 4 26B MoE: 3.8B active params, fastest.
 * Gemma 4 E2B/E4B: edge models with audio support.
 */
export async function checkOllamaGemma4(): Promise<LocalProviderStatus & { model?: string }> {
  const endpoint = 'http://localhost:11434';
  try {
    const start = Date.now();
    const res = await fetch(`${endpoint}/api/tags`, { signal: AbortSignal.timeout(2000) });
    if (!res.ok) return { available: false, endpoint };
    const data = await res.json() as { models: Array<{ name: string }> };
    const gemma = data.models?.find((m: { name: string }) =>
      m.name.startsWith('gemma4'),
    );
    if (gemma) {
      return { available: true, endpoint, latencyMs: Date.now() - start, model: gemma.name };
    }
    return { available: false, endpoint };
  } catch { /* not running */ }
  return { available: false, endpoint };
}

/**
 * Call Gemma 4 via Ollama for LLM inference (OpenAI-compatible API).
 */
export async function callGemma4(
  systemPrompt: string,
  userMessage: string,
  maxTokens = 256,
): Promise<{ text: string; local: boolean; model?: string }> {
  const status = await checkOllamaGemma4();
  if (!status.available) {
    return { text: '', local: false };
  }

  const res = await fetch(`${status.endpoint}/v1/chat/completions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: status.model || 'gemma4',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userMessage },
      ],
      max_tokens: maxTokens,
      temperature: 0.1,
      stream: false,
    }),
  });

  if (!res.ok) return { text: '', local: false };

  const data = await res.json() as {
    choices: Array<{ message: { content: string } }>;
  };

  return {
    text: data.choices?.[0]?.message?.content || '',
    local: true,
    model: status.model,
  };
}

/**
 * Get status of all local providers.
 */
export async function getLocalProviderStatus(): Promise<{
  llamafile: LocalProviderStatus;
  voicebox: LocalProviderStatus;
  gemma4: LocalProviderStatus & { model?: string };
}> {
  const [llamafile, voicebox, gemma4] = await Promise.all([
    checkLlamafile(),
    checkVoicebox(),
    checkOllamaGemma4(),
  ]);
  return { llamafile, voicebox, gemma4 };
}
