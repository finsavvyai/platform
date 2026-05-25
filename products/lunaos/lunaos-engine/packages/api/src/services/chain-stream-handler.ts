/**
 * Chain Stream Handler — SSE streaming logic for chain executions
 *
 * Extracted from chains.ts to comply with 200-line file limit.
 */

import { streamSSE } from 'hono/streaming';
import type { Context } from 'hono';
import type { Env } from '../worker';
import { executeChain } from '../services/chain-executor';
import type { ChainDefinition } from '../services/chain-schema';

interface StreamOptions {
    chainId: string;
    chainDef: ChainDefinition;
    context: string;
    env: Env;
    provider?: string;
    model?: string;
    startIndex?: number;
    initialOutputs?: Map<string, string>;
}

/** Send initial chain_start SSE event */
async function sendChainStart(
    stream: any,
    chainId: string,
    chainDef: ChainDefinition,
) {
    await stream.writeSSE({
        event: 'chain_start',
        data: JSON.stringify({
            chainId,
            name: chainDef.name,
            description: chainDef.description,
            nodeCount: chainDef.nodes.length,
            nodes: chainDef.nodes.map(n => ({
                id: n.id,
                agent: n.agent,
                label: n.label || n.agent,
            })),
        }),
    });
}

/** Create a progress callback that writes SSE events and tracks outputs */
function createProgressCallback(
    stream: any,
    intermediateOutputs: Map<string, string>,
) {
    return async (event: any) => {
        await stream.writeSSE({
            event: event.type,
            data: JSON.stringify({
                nodeId: event.nodeId,
                agent: event.agent,
                label: event.label,
                progress: Math.round(event.progress * 100),
                ...(event.result ? {
                    status: event.result.status,
                    output: event.result.output?.substring(0, 2000),
                    durationMs: event.result.durationMs,
                    error: event.result.error,
                } : {}),
            }),
        });

        if (event.result?.output) {
            intermediateOutputs.set(event.result.nodeId, event.result.output);
        }
    };
}

/** Save chain execution state to D1 */
async function saveExecutionState(
    db: D1Database,
    chainId: string,
    status: string,
    nodeIndex: number,
    context: Map<string, string>,
    completed: boolean,
) {
    const now = new Date().toISOString();
    try {
        await db.prepare(`
            UPDATE chain_executions
            SET status = ?, current_node_index = ?, context = ?, updated_at = ?, completed_at = ?
            WHERE id = ?
        `).bind(
            status,
            nodeIndex,
            JSON.stringify(Array.from(context.entries())),
            now,
            completed ? now : null,
            chainId,
        ).run();
    } catch {
        // Non-critical: continue even if DB write fails
    }
}

/** Execute chain with SSE streaming and return the stream response */
export function streamChainExecution(c: Context, opts: StreamOptions) {
    const intermediateOutputs = new Map(opts.initialOutputs || new Map());

    return streamSSE(c, async (stream) => {
        try {
            await sendChainStart(stream, opts.chainId, opts.chainDef);

            const result = await executeChain(opts.chainDef, opts.context, opts.env, {
                provider: opts.provider,
                model: opts.model,
                chainId: opts.chainId,
                startIndex: opts.startIndex,
                initialOutputs: opts.initialOutputs,
                onProgress: createProgressCallback(stream, intermediateOutputs),
            });

            await saveExecutionState(
                opts.env.DB,
                opts.chainId,
                result.status,
                result.pausedAtIndex || result.nodes.length,
                intermediateOutputs,
                result.status !== 'paused',
            );

            await stream.writeSSE({
                event: 'chain_done',
                data: JSON.stringify({
                    chainId: opts.chainId,
                    chainName: result.chainName,
                    status: result.status,
                    totalDurationMs: result.totalDurationMs,
                    nodes: result.nodes.map(n => ({
                        nodeId: n.nodeId,
                        agent: n.agent,
                        label: n.label,
                        status: n.status,
                        durationMs: n.durationMs,
                        tokenCount: n.tokenCount,
                        error: n.error,
                    })),
                    finalOutputLength: result.finalOutput.length,
                    pausedAtIndex: result.pausedAtIndex,
                }),
            });
        } catch (err: any) {
            try {
                await opts.env.DB.prepare(
                    'UPDATE chain_executions SET status = ?, completed_at = ? WHERE id = ?',
                ).bind('failed', new Date().toISOString(), opts.chainId).run();
            } catch { /* ignore */ }

            await stream.writeSSE({
                event: 'chain_error',
                data: JSON.stringify({ chainId: opts.chainId, error: err.message }),
            });
        }
    });
}
