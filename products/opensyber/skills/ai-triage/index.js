const { parentPort } = require('node:worker_threads')
const { askLLM, parseJSON } = require('../shared/llm.js')

const SYSTEM_PROMPT = `You are a security triage specialist. Given a batch of security findings, prioritize them by actual risk to the organization.

Consider: severity, exploitability (is there a known exploit?), blast radius (how many systems affected?), data sensitivity, business impact, and ease of remediation.

Respond in JSON: { "prioritized": [{ "id": string, "originalSeverity": string, "adjustedSeverity": string, "priority": 1-N, "reasoning": string, "immediateAction": boolean }] }`

const findingBuffer = []
let flushTimer = null

console.log('[ai-triage] Started — buffering findings for batch analysis')

if (parentPort) {
  parentPort.on('message', async (msg) => {
    if (msg.type !== 'security_event' && msg.type !== 'finding') return

    findingBuffer.push(msg.data || msg)

    if (flushTimer) clearTimeout(flushTimer)
    flushTimer = setTimeout(() => flushFindings(), 10000)

    if (findingBuffer.length >= 10) {
      clearTimeout(flushTimer)
      await flushFindings()
    }
  })
}

async function flushFindings() {
  if (findingBuffer.length === 0) return
  const batch = findingBuffer.splice(0, findingBuffer.length)

  try {
    const prompt = `Triage these ${batch.length} security findings:\n\n${JSON.stringify(batch, null, 2)}`
    const { text, usage } = await askLLM(SYSTEM_PROMPT, prompt)
    const result = parseJSON(text)

    parentPort.postMessage({
      type: 'triage_result',
      batchSize: batch.length,
      prioritized: result?.prioritized || [],
      tokens: usage,
      timestamp: new Date().toISOString(),
    })

    const critical = result?.prioritized?.filter((f) => f.immediateAction) || []
    console.log(`[ai-triage] Triaged ${batch.length} findings, ${critical.length} need immediate action`)
  } catch (err) {
    console.error(`[ai-triage] Error: ${err.message}`)
    parentPort.postMessage({ type: 'error', skill: 'ai-triage', message: err.message })
  }
}
