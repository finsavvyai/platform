/**
 * ClawPipe-backed claude-client — drop-in for explainThreat,
 * generateComplianceNarrative, classifyRisk.
 *
 * Migration: replace `from './claude-client'` with `from './claude-client-clawpipe'`.
 * apiKey arg now means the ClawPipe project key, not the Anthropic key
 * (provider keys live in the gateway env).
 */
import { ClawPipe } from 'clawpipe-ai'
import type { ThreatEvent, RiskClassification, ControlEvidence } from './claude-client.js'

let pipeCache: ClawPipe | null = null
function getPipe(apiKey: string): ClawPipe {
  if (pipeCache) return pipeCache
  pipeCache = new ClawPipe({
    apiKey,
    projectId: 'opensyber-claude',
    enableBooster: true, enablePacker: true, enableCache: true,
  })
  return pipeCache
}

async function ask(apiKey: string, system: string, user: string, maxTokens = 1024): Promise<string> {
  const r = await getPipe(apiKey).prompt(user, { system, maxTokens, model: 'claude-sonnet-4-6', provider: 'anthropic' })
  return r.text
}

export async function explainThreat(apiKey: string, event: ThreatEvent): Promise<string> {
  const system = [
    'You are a security analyst for an AI agent hosting platform.',
    'Explain the security event in clear, non-technical language.',
    'Include: what happened, potential impact, and recommended next steps.',
    'Keep the explanation under 200 words.',
  ].join(' ')
  const user = [
    `Event ID: ${event.eventId}`, `Type: ${event.eventType}`,
    `Severity: ${event.severity ?? 'unknown'}`, `Details: ${event.details}`,
  ].join('\n')
  return ask(apiKey, system, user, 400)
}

export async function generateComplianceNarrative(apiKey: string, controls: ControlEvidence[]): Promise<string> {
  const system = [
    'You are a compliance auditor writing SOC2 Type 2 audit narratives.',
    'Given a list of controls with their status and evidence, produce a',
    'professional narrative suitable for an external auditor. Use formal',
    'language. Reference specific control IDs. Keep under 500 words.',
  ].join(' ')
  const user = controls.map((c) => `${c.controlId}: ${c.status.toUpperCase()} — ${c.evidence}`).join('\n')
  return ask(apiKey, system, user, 1024)
}

export async function classifyRisk(apiKey: string, eventDescription: string): Promise<RiskClassification> {
  const system = [
    'You are a security risk classifier. Given an event description,',
    'classify the risk. Respond ONLY with valid JSON matching this schema:',
    '{"riskLevel":"critical|high|medium|low|info",',
    '"confidence":0.0-1.0,"reasoning":"brief explanation"}',
  ].join(' ')
  const raw = await ask(apiKey, system, eventDescription, 256)
  try {
    const parsed = JSON.parse(raw) as RiskClassification
    const valid = ['critical', 'high', 'medium', 'low', 'info']
    if (!valid.includes(parsed.riskLevel)) parsed.riskLevel = 'medium'
    parsed.confidence = Math.max(0, Math.min(1, parsed.confidence ?? 0.5))
    return parsed
  } catch {
    return { riskLevel: 'medium', confidence: 0.3, reasoning: raw || 'Classification unavailable' }
  }
}

export type { ThreatEvent, RiskClassification, ControlEvidence } from './claude-client.js'
