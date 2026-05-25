const { parentPort } = require('node:worker_threads')
const { askLLM, parseJSON } = require('../shared/llm.js')

const SYSTEM_PROMPT = `You are an incident response AI. Given a set of correlated security events, perform a multi-step investigation:

Step 1 — Event Correlation: Group related events into attack chains
Step 2 — Attack Chain Mapping: Identify the kill chain phases (recon, weaponize, deliver, exploit, install, C2, action)
Step 3 — Blast Radius Assessment: What systems, data, and users are affected?
Step 4 — Containment Recommendations: Immediate actions to stop the attack
Step 5 — Recovery Plan: Steps to restore normal operations
Step 6 — Lessons Learned: What controls would have prevented this?

Respond in JSON: { "attackChain": [{ "phase": string, "events": string[], "timestamp": string }], "blastRadius": { "systems": string[], "dataAtRisk": string[], "usersAffected": number }, "containment": [{ "priority": number, "action": string, "automated": boolean }], "recovery": string[], "prevention": string[], "incidentSeverity": "P1"|"P2"|"P3"|"P4" }`

const eventBuffer = []
let analysisTimer = null

console.log('[ai-incident-responder] Started — correlating events')

if (parentPort) {
  parentPort.on('message', async (msg) => {
    if (msg.type !== 'security_event') return

    eventBuffer.push({ ...msg.data || msg, receivedAt: new Date().toISOString() })

    // Immediate analysis for critical events
    const severity = (msg.data || msg).severity
    if (severity === 'critical') {
      if (analysisTimer) clearTimeout(analysisTimer)
      await analyzeIncident()
      return
    }

    // Batch non-critical events
    if (analysisTimer) clearTimeout(analysisTimer)
    analysisTimer = setTimeout(() => analyzeIncident(), 30000)

    if (eventBuffer.length >= 20) {
      clearTimeout(analysisTimer)
      await analyzeIncident()
    }
  })
}

async function analyzeIncident() {
  if (eventBuffer.length === 0) return
  const events = eventBuffer.splice(0, eventBuffer.length)

  try {
    const prompt = `Investigate this security incident (${events.length} events):\n\n${JSON.stringify(events, null, 2)}`
    const { text, usage } = await askLLM(SYSTEM_PROMPT, prompt, 8192)
    const investigation = parseJSON(text)

    parentPort.postMessage({
      type: 'incident_report',
      eventCount: events.length,
      investigation: investigation || { rawReport: text },
      tokens: usage,
      timestamp: new Date().toISOString(),
    })

    const sev = investigation?.incidentSeverity ?? 'unknown'
    const containActions = investigation?.containment?.length ?? 0
    console.log(`[ai-incident-responder] Incident ${sev}: ${containActions} containment actions`)
  } catch (err) {
    console.error(`[ai-incident-responder] Error: ${err.message}`)
    parentPort.postMessage({ type: 'error', skill: 'ai-incident-responder', message: err.message })
  }
}
