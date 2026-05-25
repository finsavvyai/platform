/**
 * Voice Synthesis — self-hosted TTS via Voicebox.
 *
 * Connects to a Voicebox FastAPI instance (MIT license) running
 * on a dedicated GPU node, reachable via Tailscale mesh.
 *
 * Generates spoken security briefings, alerts, and incident narrations.
 * No external API calls — all audio generated on your infrastructure.
 */

const { parentPort } = require('node:worker_threads')
const { writeFile, mkdir } = require('node:fs/promises')
const { join } = require('node:path')

const VOICEBOX_URL = process.env.VOICEBOX_URL || 'http://voicebox.opensyber.ts.net:17493'
const AUDIO_DIR = join(process.cwd(), 'audio')

console.log('[voice-synthesis] Started — Voicebox self-hosted TTS')

if (parentPort) {
  parentPort.on('message', async (msg) => {
    if (msg.type !== 'voice_request') return

    const { text, profileId, language, requestId } = msg.data || {}
    if (!text) return

    try {
      await mkdir(AUDIO_DIR, { recursive: true })
      const result = await generateSpeech({ text, profileId, language })
      const filename = `alert-${Date.now()}.wav`
      const filepath = join(AUDIO_DIR, filename)
      await writeFile(filepath, Buffer.from(result.audio, 'base64'))

      parentPort.postMessage({
        type: 'voice_result',
        requestId,
        filename,
        filepath,
        duration: result.duration,
        engine: result.engine,
        selfHosted: true,
        timestamp: new Date().toISOString(),
      })

      console.log(`[voice-synthesis] Generated ${filename} (${result.duration}s)`)
    } catch (err) {
      console.error(`[voice-synthesis] Error: ${err.message}`)
      parentPort.postMessage({
        type: 'voice_result',
        requestId,
        error: err.message,
      })
    }
  })
}

async function generateSpeech({ text, profileId, language }) {
  const res = await fetch(`${VOICEBOX_URL}/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      text,
      profile_id: profileId || 'default',
      language: language || 'en',
      output_format: 'wav',
    }),
  })

  if (!res.ok) {
    throw new Error(`Voicebox ${res.status}: ${await res.text()}`)
  }

  return await res.json()
}

async function listProfiles() {
  const res = await fetch(`${VOICEBOX_URL}/profiles`)
  if (!res.ok) throw new Error(`Voicebox profiles ${res.status}`)
  return await res.json()
}

async function checkHealth() {
  try {
    const res = await fetch(`${VOICEBOX_URL}/health`)
    return res.ok
  } catch {
    return false
  }
}
