/**
 * DAG Executor — Parallel Playbook Execution
 *
 * Extends the sequential playbook executor with DAG support.
 * Steps can declare `dependsOn: string[]` to form a directed acyclic graph.
 * Independent steps run in parallel via Promise.all.
 */

import type { PlaybookStep, StepResult, PlaybookResult } from './playbook-executor.js';

export interface DagStep extends PlaybookStep {
  /** Step IDs this step depends on. Empty or absent = no dependencies. */
  dependsOn?: string[];
  /** Unique step identifier within the playbook. */
  id: string;
}

interface AdjacencyEntry {
  step: DagStep;
  index: number;
  inDegree: number;
  dependents: string[];
}

/** Build adjacency list and validate the DAG has no cycles. */
export function buildAdjacencyList(steps: DagStep[]): Map<string, AdjacencyEntry> {
  const adj = new Map<string, AdjacencyEntry>();

  for (let i = 0; i < steps.length; i++) {
    const step = steps[i]!;
    adj.set(step.id, { step, index: i, inDegree: 0, dependents: [] });
  }

  for (const step of steps) {
    for (const dep of step.dependsOn ?? []) {
      if (!adj.has(dep)) throw new Error(`Step "${step.id}" depends on unknown step "${dep}"`);
      adj.get(dep)!.dependents.push(step.id);
      adj.get(step.id)!.inDegree++;
    }
  }

  return adj;
}

/** Topological sort using Kahn's algorithm. Returns ordered execution layers. */
export function topologicalLayers(adj: Map<string, AdjacencyEntry>): string[][] {
  const inDegree = new Map<string, number>();
  for (const [id, entry] of adj) inDegree.set(id, entry.inDegree);

  const layers: string[][] = [];
  let remaining = adj.size;

  while (remaining > 0) {
    const layer = [...inDegree.entries()]
      .filter(([, deg]) => deg === 0)
      .map(([id]) => id);

    if (layer.length === 0) throw new Error('Cycle detected in playbook DAG');

    layers.push(layer);

    for (const id of layer) {
      inDegree.delete(id);
      remaining--;
      for (const dep of adj.get(id)!.dependents) {
        inDegree.set(dep, (inDegree.get(dep) ?? 1) - 1);
      }
    }
  }

  return layers;
}

function buildOutput(step: PlaybookStep): string {
  const c = step.config;
  switch (step.type) {
    case 'api_call': return `API call to ${c.url ?? c.endpoint ?? 'target'}`;
    case 'notification': return `Notified ${c.channel ?? c.target ?? 'default'}`;
    case 'script': return `Script executed: ${c.command ?? c.scriptId ?? 'inline'}`;
    default: return `Step type ${step.type} executed`;
  }
}

async function executeStep(step: DagStep, index: number): Promise<StepResult> {
  const start = Date.now();
  try {
    const output = buildOutput(step);
    return { stepIndex: index, name: step.name, status: 'success', output, durationMs: Date.now() - start };
  } catch {
    return { stepIndex: index, name: step.name, status: 'failed', output: 'Step failed', durationMs: Date.now() - start };
  }
}

/** Execute a playbook as a DAG with parallel step execution. */
export async function executeDagPlaybook(steps: DagStep[]): Promise<PlaybookResult> {
  const start = Date.now();
  const allResults: StepResult[] = [];

  if (steps.length === 0) {
    return { status: 'completed', stepResults: [], totalDurationMs: 0, currentStep: 0, completedSteps: 0 };
  }

  const adj = buildAdjacencyList(steps);
  const layers = topologicalLayers(adj);

  for (const layer of layers) {
    const layerPromises = layer.map((id) => {
      const entry = adj.get(id)!;
      return executeStep(entry.step, entry.index);
    });

    const results = await Promise.all(layerPromises);
    allResults.push(...results);

    const failed = results.find((r) => r.status === 'failed');
    if (failed) {
      return {
        status: 'failed', stepResults: allResults, totalDurationMs: Date.now() - start,
        currentStep: failed.stepIndex, completedSteps: allResults.filter((r) => r.status === 'success').length,
        error: `Step "${failed.name}" failed`,
      };
    }
  }

  return {
    status: 'completed', stepResults: allResults, totalDurationMs: Date.now() - start,
    currentStep: steps.length, completedSteps: steps.length,
  };
}
