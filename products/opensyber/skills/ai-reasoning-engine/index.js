const { parentPort } = require('node:worker_threads')
const { askLLM, parseJSON } = require('../shared/llm.js')

const SYSTEM_PROMPT = `You are a security analyst AI embedded in an agent monitoring system.
When given a security finding, provide:
1. Root cause analysis (why this happened)
2. Risk assessment (severity justification, blast radius, exploitability)
3. Affected assets and data exposure potential
4. Recommended remediation steps (ordered by priority)
5. Related attack patterns (MITRE ATT&CK if applicable)

Respond in JSON: { "rootCause": string, "riskScore": 1-100, "riskJustification": string, "blastRadius": string, "exploitability": "none"|"low"|"medium"|"high"|"critical", "affectedAssets": string[], "remediation": string[], "mitreTechniques": string[] }`

console.log('[ai-reasoning-engine] Started')

if (parentPort) {
  parentPort.on('message', async (msg) => {
    if (msg.type !== 'security_event' && msg.type !== 'finding') return

    try {
      const prompt = `Analyze this security finding:\n\n${JSON.stringify(msg.data || msg, null, 2)}`
      const { text, usage } = await askLLM(SYSTEM_PROMPT, prompt)
      const analysis = parseJSON(text)

      parentPort.postMessage({
        type: 'enriched_finding',
        originalEvent: msg,
        analysis: analysis || { rawAnalysis: text },
        tokens: usage,
        timestamp: new Date().toISOString(),
      })

      console.log(`[ai-reasoning-engine] Analyzed finding: risk=${analysis?.riskScore ?? 'N/A'}`)
    } catch (err) {
      console.error(`[ai-reasoning-engine] Error: ${err.message}`)
      parentPort.postMessage({
        type: 'error',
        skill: 'ai-reasoning-engine',
        message: err.message,
        originalEvent: msg,
      })
    }
  })
}
