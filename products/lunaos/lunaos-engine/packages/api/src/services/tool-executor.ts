/**
 * Tool Executor — agentic tool-use loop with Claude
 *
 * Sends messages to Claude with tool definitions, executes
 * tool calls via OpenHands, feeds results back until the agent
 * produces a final text response.
 */

import {
    executeToolCall,
    getToolDefinitions,
    type OpenHandsConfig,
    type ToolResult,
} from './openhands-client';

export interface ToolExecutorConfig {
    provider: 'anthropic';
    model: string;
    apiKey: string;
    openhands: OpenHandsConfig;
    maxIterations?: number;
}

interface Message {
    role: 'user' | 'assistant';
    content: any;
}

export interface ExecutionResult {
    output: string;
    toolCalls: ToolResult[];
    iterations: number;
    durationMs: number;
}

/**
 * Run an agentic tool-use loop:
 * 1. Send prompt + tools to Claude
 * 2. If Claude calls a tool → execute via OpenHands → feed result back
 * 3. Repeat until Claude produces text-only response or max iterations
 */
export async function runToolLoop(
    config: ToolExecutorConfig,
    systemPrompt: string,
    userMessage: string,
    onToolCall?: (call: ToolResult) => void,
): Promise<ExecutionResult> {
    const maxIter = config.maxIterations || 10;
    const tools = getToolDefinitions();
    const allToolResults: ToolResult[] = [];
    const start = Date.now();

    const messages: Message[] = [
        { role: 'user', content: userMessage },
    ];

    for (let i = 0; i < maxIter; i++) {
        const response = await callClaudeWithTools(
            config.apiKey, config.model, systemPrompt, messages, tools,
        );

        if (response.stop_reason === 'end_turn' || !hasToolUse(response)) {
            const textOutput = extractText(response);
            return {
                output: textOutput,
                toolCalls: allToolResults,
                iterations: i + 1,
                durationMs: Date.now() - start,
            };
        }

        messages.push({ role: 'assistant', content: response.content });

        const toolUseBlocks = response.content.filter(
            (b: any) => b.type === 'tool_use',
        );

        const toolResults: any[] = [];
        for (const block of toolUseBlocks) {
            const result = await executeToolCall(config.openhands, {
                name: block.name,
                input: block.input,
            });
            allToolResults.push(result);
            onToolCall?.(result);

            toolResults.push({
                type: 'tool_result',
                tool_use_id: block.id,
                content: result.output.substring(0, 10000),
            });
        }

        messages.push({ role: 'user', content: toolResults });
    }

    return {
        output: 'Max tool iterations reached. Partial results may be available.',
        toolCalls: allToolResults,
        iterations: maxIter,
        durationMs: Date.now() - start,
    };
}

async function callClaudeWithTools(
    apiKey: string,
    model: string,
    system: string,
    messages: Message[],
    tools: Array<Record<string, unknown>>,
): Promise<any> {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'x-api-key': apiKey,
            'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
            model,
            max_tokens: 8192,
            temperature: 0.2,
            system,
            messages,
            tools,
        }),
    });

    if (!res.ok) {
        const err = await res.text();
        throw new Error(`Claude API error (${res.status}): ${err}`);
    }

    return res.json();
}

function hasToolUse(response: any): boolean {
    return response.content?.some((b: any) => b.type === 'tool_use') ?? false;
}

function extractText(response: any): string {
    return response.content
        ?.filter((b: any) => b.type === 'text')
        .map((b: any) => b.text)
        .join('\n') || '';
}
