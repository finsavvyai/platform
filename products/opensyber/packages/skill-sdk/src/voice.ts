/**
 * Voice output support for skills via Voicebox TTS.
 *
 * Checks for a local Voicebox instance first (localhost:17493),
 * then falls back to OpenAI TTS if an API key is provided.
 */

const VOICEBOX_BASE = 'http://localhost:17493';
const VOICEBOX_TIMEOUT_MS = 2000;
const OPENAI_TTS_URL = 'https://api.openai.com/v1/audio/speech';

export interface VoiceOptions {
  text: string;
  voice?: string;
  language?: string;
}

/**
 * Check whether a local Voicebox instance is reachable.
 * Returns true if the health endpoint responds within the timeout.
 */
export async function checkVoicebox(): Promise<boolean> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(
      () => controller.abort(),
      VOICEBOX_TIMEOUT_MS,
    );
    const res = await fetch(`${VOICEBOX_BASE}/health`, {
      signal: controller.signal,
    });
    clearTimeout(timer);
    return res.ok;
  } catch {
    return false;
  }
}

/**
 * Generate speech audio from text.
 *
 * 1. Tries local Voicebox at localhost:17493.
 * 2. Falls back to OpenAI TTS if `openaiKey` is provided.
 * 3. Returns null if neither is available.
 */
export async function generateSpeech(
  options: VoiceOptions,
  openaiKey?: string,
): Promise<ArrayBuffer | null> {
  const voice = options.voice ?? 'default';
  const language = options.language ?? 'en';

  const localAudio = await tryVoicebox(options.text, voice, language);
  if (localAudio) return localAudio;

  if (openaiKey) {
    return tryOpenAI(options.text, voice, openaiKey);
  }

  return null;
}

/**
 * Attach voice metadata to any skill result.
 *
 * The runtime can inspect `_voice` on the returned object and
 * trigger speech synthesis after the skill completes.
 */
export function withVoice<T extends Record<string, unknown>>(
  result: T,
  voiceText: string,
): T & { _voice: VoiceOptions } {
  return {
    ...result,
    _voice: {
      text: voiceText,
      voice: 'default',
      language: 'en',
    },
  };
}

/* ------------------------------------------------------------------ */
/*  Internal helpers                                                    */
/* ------------------------------------------------------------------ */

async function tryVoicebox(
  text: string,
  voice: string,
  language: string,
): Promise<ArrayBuffer | null> {
  try {
    const available = await checkVoicebox();
    if (!available) return null;

    const res = await fetch(`${VOICEBOX_BASE}/v1/tts`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, voice, language }),
    });

    if (!res.ok) return null;
    return res.arrayBuffer();
  } catch {
    return null;
  }
}

async function tryOpenAI(
  text: string,
  voice: string,
  apiKey: string,
): Promise<ArrayBuffer | null> {
  try {
    const openaiVoice = mapVoiceToOpenAI(voice);
    const res = await fetch(OPENAI_TTS_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'tts-1',
        input: text,
        voice: openaiVoice,
        response_format: 'mp3',
      }),
    });

    if (!res.ok) return null;
    return res.arrayBuffer();
  } catch {
    return null;
  }
}

const VOICE_MAP: Record<string, string> = {
  default: 'alloy',
  male: 'onyx',
  female: 'nova',
  warm: 'shimmer',
  deep: 'echo',
  narration: 'fable',
};

function mapVoiceToOpenAI(voice: string): string {
  return VOICE_MAP[voice] ?? 'alloy';
}
