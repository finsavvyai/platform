const { parentPort } = require('node:worker_threads')
const fs = require('node:fs')
const path = require('node:path')
const { askLLM, parseJSON } = require('../shared/llm.js')

const FRAMEWORKS = ['SOC2', 'ISO27001', 'HIPAA', 'GDPR']

const SYSTEM_PROMPT = `You are a compliance documentation specialist. Given security scan results, generate audit-ready evidence documentation.

For each finding, map to applicable compliance frameworks (SOC 2, ISO 27001, HIPAA, GDPR) and generate:
1. Control mapping (which specific controls are addressed)
2. Evidence statement (what was found, when, what action was taken)
3. Risk acceptance or remediation status
4. Auditor-ready summary paragraph

Respond in JSON: { "framework": string, "controlMappings": [{ "controlId": string, "controlName": string, "status": "pass"|"fail"|"remediated"|"accepted", "evidence": string, "finding": string|null }], "summary": string, "generatedAt": string }`

console.log('[ai-compliance-writer] Started')

if (parentPort) {
  parentPort.on('message', async (msg) => {
    if (msg.type !== 'scan_complete' && msg.type !== 'finding' && msg.type !== 'security_event') return

    try {
      const findings = Array.isArray(msg.data) ? msg.data : [msg.data || msg]

      for (const framework of FRAMEWORKS) {
        const prompt = `Generate ${framework} compliance evidence for these findings:\n\n${JSON.stringify(findings, null, 2)}`
        const { text, usage } = await askLLM(SYSTEM_PROMPT, prompt, 6144)
        const doc = parseJSON(text)

        if (doc) {
          const filename = `${framework.toLowerCase()}-evidence-${Date.now()}.json`
          const filePath = path.join('./data', filename)
          fs.mkdirSync('./data', { recursive: true })
          fs.writeFileSync(filePath, JSON.stringify(doc, null, 2))

          parentPort.postMessage({
            type: 'compliance_document',
            framework,
            filePath: filename,
            controlCount: doc.controlMappings?.length ?? 0,
            tokens: usage,
            timestamp: new Date().toISOString(),
          })
        }
      }

      console.log(`[ai-compliance-writer] Generated evidence for ${FRAMEWORKS.length} frameworks`)
    } catch (err) {
      console.error(`[ai-compliance-writer] Error: ${err.message}`)
      parentPort.postMessage({ type: 'error', skill: 'ai-compliance-writer', message: err.message })
    }
  })
}
