/**
 * Swarm — parallel agent execution with multiple merge strategies.
 *
 * Inspired by Agent of Empires: run N agents in parallel against
 * the same task, then merge results via race/consensus/vote.
 *
 * Workers-compatible: uses Promise.all() instead of git worktrees.
 */

import { callLLM } from './llm-caller';
import { getPersona } from '../data/personas';
import { recordOutcome } from './smart-router';
import { resolveLLMConfig } from './agent-config';
import type { Env } from '../worker';

export type SwarmStrategy = 'race' | 'consensus' | 'vote';

export interface SwarmRequest {
  agents: string[]; // 2-5 agent slugs
  context: string;
  strategy: SwarmStrategy;
}

export interface AgentResult {
  agent: string;
  provider: string;
  model: string;
  output: string;
  durationMs: number;
  success: boolean;
  error?: string;
}

export interface SwarmResult {
  strategy: SwarmStrategy;
  winner: AgentResult | null;
  allResults: AgentResult[];
  totalDurationMs: number;
  reason: string;
}

const MAX_AGENTS = 5;
const MIN_AGENTS = 2;

/**
 * Run multiple agents in parallel and merge results.
 */
export async function runSwarm(
  env: Env,
  req: SwarmRequest,
): Promise<SwarmResult> {
  validateSwarmRequest(req);

  const startTime = Date.now();

  // Fan out: call all agents in parallel
  const results = await Promise.all(
    req.agents.map((agentSlug) => executeAgent(env, agentSlug, req.context)),
  );

  // Apply merge strategy
  const merged = mergeResults(results, req.strategy, env);

  return {
    strategy: req.strategy,
    winner: merged.winner,
    allResults: results,
    totalDurationMs: Date.now() - startTime,
    reason: merged.reason,
  };
}

/** Validate swarm request — throws on invalid input. */
function validateSwarmRequest(req: SwarmRequest): void {
  if (!req.agents || req.agents.length < MIN_AGENTS) {
    throw new Error(`Swarm requires at least ${MIN_AGENTS} agents`);
  }
  if (req.agents.length > MAX_AGENTS) {
    throw new Error(`Swarm supports max ${MAX_AGENTS} agents`);
  }
  if (new Set(req.agents).size !== req.agents.length) {
    throw new Error('Swarm agents must be unique');
  }
  if (!['race', 'consensus', 'vote'].includes(req.strategy)) {
    throw new Error(`Unknown strategy: ${req.strategy}`);
  }
}

/** Execute a single agent and return result (never throws). */
async function executeAgent(
  env: Env,
  agentSlug: string,
  context: string,
): Promise<AgentResult> {
  const start = Date.now();
  const persona = getPersona(agentSlug) as any;

  if (!persona) {
    return {
      agent: agentSlug,
      provider: 'unknown',
      model: 'unknown',
      output: '',
      durationMs: Date.now() - start,
      success: false,
      error: `Unknown agent: ${agentSlug}`,
    };
  }

  const llmCfg = resolveLLMConfig(env, undefined, undefined, '', '', persona.model);
  if (!llmCfg.apiKey) {
    return {
      agent: agentSlug,
      provider: llmCfg.provider,
      model: llmCfg.model,
      output: '',
      durationMs: Date.now() - start,
      success: false,
      error: `No API key for ${llmCfg.provider}`,
    };
  }

  try {
    const response = await callLLM(
      llmCfg.provider, llmCfg.model, llmCfg.apiKey,
      persona.systemPrompt || `You are ${persona.name}.`,
      context, persona.temperature ?? 0.3, env,
    );

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`HTTP ${response.status}: ${body.slice(0, 200)}`);
    }

    const text = await response.text();
    const duration = Date.now() - start;

    // Record outcome for smart router learning
    await recordOutcome(env, agentSlug, llmCfg.provider, llmCfg.model, true, duration, text.length);

    return {
      agent: agentSlug,
      provider: llmCfg.provider,
      model: llmCfg.model,
      output: text,
      durationMs: duration,
      success: true,
    };
  } catch (err: any) {
    const duration = Date.now() - start;
    await recordOutcome(env, agentSlug, llmCfg.provider, llmCfg.model, false, duration, 0);
    return {
      agent: agentSlug,
      provider: llmCfg.provider,
      model: llmCfg.model,
      output: '',
      durationMs: duration,
      success: false,
      error: err.message,
    };
  }
}

/** Merge results based on strategy. */
function mergeResults(
  results: AgentResult[],
  strategy: SwarmStrategy,
  _env: Env,
): { winner: AgentResult | null; reason: string } {
  const successful = results.filter((r) => r.success);
  if (successful.length === 0) {
    return { winner: null, reason: 'all agents failed' };
  }

  switch (strategy) {
    case 'race': {
      // First successful by duration (already fastest finished first in Promise.all)
      const fastest = successful.reduce((a, b) => (a.durationMs < b.durationMs ? a : b));
      return { winner: fastest, reason: `fastest: ${fastest.durationMs}ms` };
    }
    case 'consensus': {
      // Group by output similarity (exact match on first 200 chars)
      const groups = new Map<string, AgentResult[]>();
      for (const r of successful) {
        const key = r.output.slice(0, 200).trim().toLowerCase();
        const list = groups.get(key) || [];
        list.push(r);
        groups.set(key, list);
      }
      let largest: AgentResult[] = [];
      for (const list of groups.values()) {
        if (list.length > largest.length) largest = list;
      }
      const pct = Math.round((largest.length / successful.length) * 100);
      return {
        winner: largest[0],
        reason: `consensus: ${largest.length}/${successful.length} agents agreed (${pct}%)`,
      };
    }
    case 'vote': {
      // Longest output wins (simple heuristic; replace with LLM judge later)
      const longest = successful.reduce((a, b) => (a.output.length > b.output.length ? a : b));
      return { winner: longest, reason: `longest output: ${longest.output.length} chars` };
    }
    default:
      return { winner: successful[0], reason: 'default: first successful' };
  }
}
