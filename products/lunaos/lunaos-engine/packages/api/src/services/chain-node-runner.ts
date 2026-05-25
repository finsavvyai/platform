/**
 * Chain Node Runner — executes a single node in a chain
 */

import type { ChainNode, ChainDefinition } from './chain-schema';
import { buildNodePrompt } from './chain-schema';
import { getPersona } from '../data/personas';
import { callLLMSync } from './chain-llm';
import type { ChainNodeResult, ChainProgressCallback } from './chain-executor';

interface NodeRunnerParams {
    node: ChainNode;
    nodeId: string;
    userContext: string;
    nodeOutputs: Map<string, string>;
    chain: ChainDefinition;
    provider: string;
    model: string;
    apiKeyMap: Record<string, string | undefined>;
    apiKey: string;
    completedCount: number;
    totalNodes: number;
    onProgress?: ChainProgressCallback;
}

/**
 * Execute a single chain node: resolve persona, build prompt, call LLM.
 * Returns the result and whether there was a failure.
 */
export async function executeNode(params: NodeRunnerParams): Promise<{
    result: ChainNodeResult;
    output?: string;
}> {
    const { node, nodeId, userContext, nodeOutputs, chain, apiKeyMap, apiKey } = params;
    const nodeStart = Date.now();

    // Emit progress: node starting
    if (params.onProgress) {
        await params.onProgress({
            type: 'node_start', nodeId,
            agent: node.agent, label: node.label || node.agent,
            progress: params.completedCount / params.totalNodes,
        });
    }

    // Resolve the persona
    const persona = getPersona(node.agent);
    if (!persona) {
        return {
            result: {
                nodeId, agent: node.agent, label: node.label,
                status: 'failed', error: `Unknown agent: ${node.agent}`, durationMs: 0,
            },
        };
    }

    // Build the prompt with predecessor outputs injected
    const prompt = buildNodePrompt(node, userContext, nodeOutputs, chain);

    // Determine per-node LLM config (allow overrides)
    const nodeProvider = node.config?.provider || params.provider;
    const nodeModel = node.config?.model || params.model;
    const nodeApiKey = apiKeyMap[nodeProvider] || apiKey;

    try {
        const output = await callLLMSync(
            nodeProvider, nodeModel, nodeApiKey,
            persona.systemPrompt, prompt,
            node.config?.maxTokens || 4096, node.config?.temperature,
        );

        const result: ChainNodeResult = {
            nodeId, agent: node.agent, label: node.label,
            status: 'completed', output,
            durationMs: Date.now() - nodeStart,
            tokenCount: output.length,
        };

        if (params.onProgress) {
            await params.onProgress({
                type: 'node_complete', nodeId,
                agent: node.agent, label: node.label || node.agent,
                progress: (params.completedCount + 1) / params.totalNodes, result,
            });
        }

        return { result, output };
    } catch (err: any) {
        const result: ChainNodeResult = {
            nodeId, agent: node.agent, label: node.label,
            status: 'failed', error: err.message || 'LLM call failed',
            durationMs: Date.now() - nodeStart,
        };

        if (params.onProgress) {
            await params.onProgress({
                type: 'node_error', nodeId,
                agent: node.agent, label: node.label || node.agent,
                progress: (params.completedCount + 1) / params.totalNodes, result,
            });
        }

        return { result };
    }
}
