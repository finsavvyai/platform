/**
 * ClawPipe Swarm-backed consensus triage — drop-in for consensusTriage().
 *
 * Replaces the hand-rolled Promise.allSettled vote loop with ClawPipe's
 * Swarm.run() (vote strategy). Gains:
 * - Free Booster + Packer + Cache + Router on every model call.
 * - Built-in 'best' / 'merge' / 'first' strategies if voting isn't right.
 * - Provider/model failover via ClawPipe's circuit breaker.
 *
 * Migration: replace `from './multi-model-consensus'` with this file.
 */
import { Swarm, Gateway, type SwarmConfig } from 'clawpipe-ai'

interface Finding {
  title: string
  description: string
  severity: string
  category: string
}

interface ModelVote {
  model: string
  severity: 'critical' | 'high' | 'medium' | 'low' | 'info'
  priority: string
  confidence: number
  reasoning: string
}

interface ConsensusResult {
  severity: string
  priority: string
  confidence: number
  votes: ModelVote[]
  agreement: number
}

const DEFAULT_MODELS: SwarmConfig['models'] = [
  { provider: 'anthropic', model: 'claude-haiku-4-5', qualityScore: 0.88 },
  { provider: 'openai', model: 'gpt-4o-mini', qualityScore: 0.85 },
  { provider: 'groq', model: 'llama-3.3-70b-versatile', qualityScore: 0.87 },
]

export async function consensusTriage(
  finding: Finding,
  apiKey: string,
  projectId = 'opensyber-triage',
  models: SwarmConfig['models'] = DEFAULT_MODELS,
): Promise<ConsensusResult> {
  const swarm = new Swarm({ models, strategy: 'vote' })
  const gateway = new Gateway({ gatewayUrl: 'https://api.clawpipe.ai/v1', apiKey, projectId })
  const prompt = buildTriagePrompt(finding)

  const result = await swarm.run(prompt, {}, gateway).catch(() => null)
  if (!result) {
    return { severity: finding.severity, priority: 'P2', confidence: 0, votes: [], agreement: 0 }
  }

  const votes = result.candidates.map((c) => parseVote(`${c.provider}:${c.model}`, c.text))
  return aggregate(votes)
}

function buildTriagePrompt(f: Finding): string {
  return [
    'Assess this security finding. Respond with ONLY a JSON object:',
    '{"severity":"critical|high|medium|low|info","priority":"P0|P1|P2|P3|P4","confidence":0.0-1.0,"reasoning":"brief explanation"}',
    '', `Title: ${f.title}`, `Description: ${f.description}`,
    `Reported severity: ${f.severity}`, `Category: ${f.category}`,
  ].join('\n')
}

function parseVote(model: string, text: string): ModelVote {
  try {
    const m = text.match(/\{[\s\S]*\}/)
    if (!m) throw new Error('no json')
    const p = JSON.parse(m[0])
    return {
      model, severity: p.severity ?? 'medium', priority: p.priority ?? 'P2',
      confidence: Math.min(1, Math.max(0, p.confidence ?? 0.5)),
      reasoning: p.reasoning ?? '',
    }
  } catch {
    return { model, severity: 'medium', priority: 'P2', confidence: 0.3, reasoning: 'Parse error' }
  }
}

function aggregate(votes: ModelVote[]): ConsensusResult {
  if (votes.length === 0) {
    return { severity: 'medium', priority: 'P2', confidence: 0, votes: [], agreement: 0 }
  }
  const sevCounts: Record<string, number> = {}
  for (const v of votes) sevCounts[v.severity] = (sevCounts[v.severity] ?? 0) + v.confidence
  const winnerSev = Object.entries(sevCounts).sort(([, a], [, b]) => b - a)[0]![0]
  const agreeing = votes.filter((v) => v.severity === winnerSev)
  const agreement = agreeing.length / votes.length
  const avgConf = agreeing.reduce((s, v) => s + v.confidence, 0) / agreeing.length

  const prioCounts: Record<string, number> = {}
  for (const v of agreeing) prioCounts[v.priority] = (prioCounts[v.priority] ?? 0) + v.confidence
  const winnerPrio = Object.entries(prioCounts).sort(([, a], [, b]) => b - a)[0]![0]

  return { severity: winnerSev, priority: winnerPrio, confidence: avgConf, votes, agreement }
}
