/**
 * Chain Executor — runs agent chains in topological (DAG) order
 *
 * For each node in execution order:
 *   1. Build prompt from user context + predecessor outputs
 *   2. Call LLM (non-streaming, to capture full output)
 *   3. Store output for downstream nodes
 *   4. Emit progress events via a callback
 */

import type { ChainDefinition } from './chain-schema';
import { validateChain } from './chain-schema';
import { executeNode } from './chain-node-runner';

// ─── Types ───────────────────────────────────────────────────────────────────

export type ChainNodeStatus = 'pending' | 'running' | 'completed' | 'failed' | 'skipped';

export interface ChainNodeResult {
    nodeId: string;
    agent: string;
    label?: string;
    status: ChainNodeStatus;
    output?: string;
    error?: string;
    durationMs?: number;
    tokenCount?: number;
}

export interface ChainExecutionResult {
    chainId: string;
    chainName: string;
    status: 'completed' | 'partial' | 'failed' | 'paused';
    totalDurationMs: number;
    nodes: ChainNodeResult[];
    finalOutput: string;
    pausedAtIndex?: number;
}

export type ChainProgressCallback = (event: {
    type: 'node_start' | 'node_complete' | 'node_error' | 'chain_complete' | 'chain_paused';
    nodeId?: string;
    agent?: string;
    label?: string;
    progress: number;
    result?: ChainNodeResult;
}) => Promise<void>;

interface ChainEnv {
    ANTHROPIC_API_KEY?: string;
    OPENAI_API_KEY?: string;
    DEEPSEEK_API_KEY?: string;
}

// ─── Executor ────────────────────────────────────────────────────────────────

export async function executeChain(
    chain: ChainDefinition,
    userContext: string,
    env: ChainEnv,
    options?: {
        provider?: string;
        model?: string;
        onProgress?: ChainProgressCallback;
        chainId?: string;
        startIndex?: number;
        initialOutputs?: Map<string, string>;
        initialResults?: ChainNodeResult[];
    },
): Promise<ChainExecutionResult> {
    const chainId = options?.chainId || crypto.randomUUID();
    const startTime = Date.now();

    const validation = validateChain(chain);
    if (!validation.valid || !validation.executionOrder) {
        return {
            chainId, chainName: chain.name, status: 'failed', totalDurationMs: 0,
            nodes: [], finalOutput: `Chain validation failed:\n${validation.errors.join('\n')}`,
        };
    }

    const executionOrder = validation.executionOrder;
    const nodeMap = new Map(chain.nodes.map(n => [n.id, n]));
    const nodeOutputs = options?.initialOutputs ? new Map(options.initialOutputs) : new Map<string, string>();
    const nodeResults: ChainNodeResult[] = options?.initialResults ? [...options.initialResults] : [];

    let completedCount = options?.startIndex || 0;
    const totalNodes = executionOrder.length;
    let hasFailures = nodeResults.some(r => r.status === 'failed');
    let isPaused = false;
    let pausedIndex = -1;

    const provider = options?.provider || 'deepseek';
    const defaultModels: Record<string, string> = { anthropic: 'claude-sonnet-4-20250514', openai: 'gpt-4o', deepseek: 'deepseek-chat' };
    const model = options?.model || defaultModels[provider] || 'deepseek-chat';
    const apiKeyMap: Record<string, string | undefined> = { anthropic: env.ANTHROPIC_API_KEY, openai: env.OPENAI_API_KEY, deepseek: env.DEEPSEEK_API_KEY };
    const apiKey = apiKeyMap[provider];

    if (!apiKey) {
        return { chainId, chainName: chain.name, status: 'failed', totalDurationMs: 0, nodes: [], finalOutput: `No API key configured for provider: ${provider}` };
    }

    for (let i = options?.startIndex || 0; i < executionOrder.length; i++) {
        const nodeId = executionOrder[i];
        const node = nodeMap.get(nodeId)!;

        if (node.requiresApproval && i > (options?.startIndex || 0)) {
            isPaused = true;
            pausedIndex = i;
            if (options?.onProgress) {
                await options.onProgress({ type: 'chain_paused', nodeId, agent: node.agent, label: node.label || node.agent, progress: completedCount / totalNodes });
            }
            break;
        }

        const predecessorIds = (chain.edges || []).filter(e => e.to === nodeId).map(e => e.from);
        const predecessorFailed = predecessorIds.some(pid => nodeResults.find(r => r.nodeId === pid && r.status === 'failed'));

        if (predecessorFailed) {
            nodeResults.push({ nodeId, agent: node.agent, label: node.label, status: 'skipped', error: 'Skipped due to predecessor failure', durationMs: 0 });
            hasFailures = true;
            completedCount++;
            continue;
        }

        const { result, output } = await executeNode({
            node, nodeId, userContext, nodeOutputs, chain,
            provider, model, apiKeyMap, apiKey,
            completedCount, totalNodes, onProgress: options?.onProgress,
        });

        nodeResults.push(result);
        if (output) nodeOutputs.set(nodeId, output);
        if (result.status === 'failed') hasFailures = true;
        completedCount++;
    }

    const outgoingNodes = new Set((chain.edges || []).map(e => e.from));
    const terminalNodeIds = executionOrder.filter(id => !outgoingNodes.has(id));
    const finalOutput = terminalNodeIds.map(id => nodeOutputs.get(id)).filter(Boolean).join('\n\n---\n\n');
    const totalDuration = Date.now() - startTime;

    let status: ChainExecutionResult['status'] = 'completed';
    if (isPaused) status = 'paused';
    else if (hasFailures) status = nodeResults.some(r => r.status === 'completed') ? 'partial' : 'failed';

    if (options?.onProgress && !isPaused) {
        await options.onProgress({ type: 'chain_complete', progress: 1 });
    }

    return { chainId, chainName: chain.name, status, totalDurationMs: totalDuration, nodes: nodeResults, finalOutput, pausedAtIndex: isPaused ? pausedIndex : undefined };
}
