/**
 * Shared LLM client for AI skills.
 * Uses native fetch to call Anthropic or OpenAI APIs.
 * Environment: LLM_API_KEY, LLM_PROVIDER (default: anthropic), LLM_MODEL
 */

const PROVIDER_CONFIG = {
  anthropic: {
    url: 'https://api.anthropic.com/v1/messages',
    defaultModel: 'claude-sonnet-4-6',
    buildHeaders: (key) => ({
      'Content-Type': 'application/json',
      'x-api-key': key,
      'anthropic-version': '2023-06-01',
    }),
    buildBody: (model, system, prompt, maxTokens) => ({
      model,
      max_tokens: maxTokens,
      system,
      messages: [{ role: 'user', content: prompt }],
    }),
    parseResponse: (data) => ({
      text: data.content?.filter((c) => c.type === 'text').map((c) => c.text).join('') ?? '',
      usage: {
        input: data.usage?.input_tokens ?? 0,
        output: data.usage?.output_tokens ?? 0,
      },
    }),
  },
  openai: {
    url: 'https://api.openai.com/v1/chat/completions',
    defaultModel: 'gpt-4o',
    buildHeaders: (key) => ({
      'Content-Type': 'application/json',
      Authorization: `Bearer ${key}`,
    }),
    buildBody: (model, system, prompt, maxTokens) => ({
      model,
      max_tokens: maxTokens,
      messages: [
        ...(system ? [{ role: 'system', content: system }] : []),
        { role: 'user', content: prompt },
      ],
    }),
    parseResponse: (data) => ({
      text: data.choices?.[0]?.message?.content ?? '',
      usage: {
        input: data.usage?.prompt_tokens ?? 0,
        output: data.usage?.completion_tokens ?? 0,
      },
    }),
  },
}

async function askLLM(system, prompt, maxTokens = 4096) {
  const provider = process.env.LLM_PROVIDER || 'anthropic'
  const apiKey = process.env.LLM_API_KEY
  if (!apiKey) throw new Error('LLM_API_KEY not set')

  const config = PROVIDER_CONFIG[provider]
  if (!config) throw new Error(`Unknown provider: ${provider}`)

  const model = process.env.LLM_MODEL || config.defaultModel
  const response = await fetch(config.url, {
    method: 'POST',
    headers: config.buildHeaders(apiKey),
    body: JSON.stringify(config.buildBody(model, system, prompt, maxTokens)),
  })

  if (!response.ok) {
    const err = await response.text()
    throw new Error(`LLM ${response.status}: ${err.slice(0, 200)}`)
  }

  const data = await response.json()
  return config.parseResponse(data)
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

// Auto-prefer ClawPipe when configured — zero-risk cutover. Skills get
// 30-50% cost reduction with no caller changes. Fall back to direct
// provider calls above when CLAWPIPE_API_KEY isn't set.
let _impl = { askLLM, parseJSON }
if (process.env.CLAWPIPE_API_KEY) {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    _impl = require('./llm-clawpipe')
  } catch {
    // clawpipe-ai not installed in this workspace — stay on direct calls.
  }
}
module.exports = _impl
