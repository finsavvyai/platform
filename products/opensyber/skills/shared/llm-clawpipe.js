/**
 * ClawPipe-backed LLM client for OpenSyber AI skills.
 *
 * Drop-in replacement for ./llm.js (askLLM + parseJSON). Every skill
 * execution now flows through ClawPipe's full pipeline:
 *
 *   Booster -> Packer -> Cache -> Router -> Provider -> Learner
 *
 * Cost reduction expected: 30-50% on average skill workload (matches
 * ClawPipe's public 400-prompt benchmark).
 *
 * Migration:
 *   const { askLLM } = require('../shared/llm-clawpipe')
 * (Replace `./llm` with `./llm-clawpipe` in skill index.js files.)
 *
 * Env:
 *   CLAWPIPE_API_KEY      — required (free tier OK at app.clawpipe.ai)
 *   CLAWPIPE_PROJECT_ID   — defaults to 'opensyber-skills'
 *   CLAWPIPE_GATEWAY_URL  — optional override
 */

const { ClawPipe } = require('clawpipe-ai')

let pipeCache = null

function getPipe() {
  if (pipeCache) return pipeCache
  const apiKey = process.env.CLAWPIPE_API_KEY
  if (!apiKey) throw new Error('CLAWPIPE_API_KEY not set')
  pipeCache = new ClawPipe({
    apiKey,
    projectId: process.env.CLAWPIPE_PROJECT_ID || 'opensyber-skills',
    gatewayUrl: process.env.CLAWPIPE_GATEWAY_URL,
    enableBooster: true,
    enablePacker: true,
    enableCache: true,
  })
  return pipeCache
}

/** Same shape as ./llm.js askLLM — { text, usage: { input, output } }. */
async function askLLM(system, prompt, maxTokens = 4096) {
  const pipe = getPipe()
  const result = await pipe.prompt(prompt, { system, maxTokens })
  return {
    text: result.text,
    usage: {
      input: result.meta.tokensIn || 0,
      output: result.meta.tokensOut || 0,
    },
    // Bonus fields skills can use:
    cached: result.meta.cached,
    boosted: result.meta.boosted,
    estimatedCostUsd: result.meta.estimatedCostUsd,
  }
}

function parseJSON(text) {
  const match = text.match(/```json\s*([\s\S]*?)```/) || text.match(/\{[\s\S]*\}/)
  if (!match) return null
  try {
    return JSON.parse(match[1] || match[0])
  } catch {
    return null
  }
}

module.exports = { askLLM, parseJSON }
