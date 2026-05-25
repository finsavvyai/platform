/**
 * OpenHands Client — proxy tool calls to OpenHands Bridge API
 *
 * Sends bash, file edit, and browse actions to the OpenHands
 * execution sandbox and returns structured results.
 */

export interface OpenHandsConfig {
    apiUrl: string;
    apiKey?: string;
    timeoutMs?: number;
}

export interface ToolCall {
    name: string;
    input: Record<string, unknown>;
}

export interface ToolResult {
    name: string;
    output: string;
    success: boolean;
    durationMs: number;
}

const SUPPORTED_TOOLS = ['bash', 'read_file', 'write_file', 'edit_file', 'browse'] as const;
export type ToolName = typeof SUPPORTED_TOOLS[number];

export function isValidTool(name: string): name is ToolName {
    return SUPPORTED_TOOLS.includes(name as ToolName);
}

/** Execute a single tool call against the OpenHands Bridge API */
export async function executeToolCall(
    config: OpenHandsConfig,
    call: ToolCall,
): Promise<ToolResult> {
    const start = Date.now();

    if (!isValidTool(call.name)) {
        return { name: call.name, output: `Unknown tool: ${call.name}`, success: false, durationMs: 0 };
    }

    try {
        const res = await fetch(`${config.apiUrl}/api/execute`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                ...(config.apiKey ? { 'Authorization': `Bearer ${config.apiKey}` } : {}),
            },
            body: JSON.stringify({
                taskType: call.name,
                context: call.input,
                prompt: buildPromptForTool(call),
                config: { timeout: config.timeoutMs || 30000 },
            }),
            signal: AbortSignal.timeout(config.timeoutMs || 30000),
        });

        const data = await res.json() as any;

        if (!res.ok || !data.success) {
            return {
                name: call.name,
                output: data.error || `OpenHands error: ${res.status}`,
                success: false,
                durationMs: Date.now() - start,
            };
        }

        return {
            name: call.name,
            output: data.data?.result || JSON.stringify(data.data),
            success: true,
            durationMs: Date.now() - start,
        };
    } catch (err: any) {
        return {
            name: call.name,
            output: `Execution failed: ${err.message}`,
            success: false,
            durationMs: Date.now() - start,
        };
    }
}

function buildPromptForTool(call: ToolCall): string {
    switch (call.name) {
        case 'bash':
            return `Execute this shell command and return the output:\n${call.input.command}`;
        case 'read_file':
            return `Read and return the contents of: ${call.input.path}`;
        case 'write_file':
            return `Write the following content to ${call.input.path}:\n${call.input.content}`;
        case 'edit_file':
            return `In file ${call.input.path}, replace:\n${call.input.old_string}\nWith:\n${call.input.new_string}`;
        case 'browse':
            return `Navigate to ${call.input.url} and return the page content`;
        default:
            return JSON.stringify(call.input);
    }
}

/** Get tool definitions for Claude tool-use API */
export function getToolDefinitions(): Array<Record<string, unknown>> {
    return [
        {
            name: 'bash',
            description: 'Execute a shell command in a sandboxed environment. Use for running tests, installing packages, checking git status, etc.',
            input_schema: {
                type: 'object',
                properties: {
                    command: { type: 'string', description: 'The bash command to execute' },
                },
                required: ['command'],
            },
        },
        {
            name: 'read_file',
            description: 'Read the contents of a file from the workspace.',
            input_schema: {
                type: 'object',
                properties: {
                    path: { type: 'string', description: 'File path relative to workspace root' },
                },
                required: ['path'],
            },
        },
        {
            name: 'write_file',
            description: 'Create or overwrite a file in the workspace.',
            input_schema: {
                type: 'object',
                properties: {
                    path: { type: 'string', description: 'File path relative to workspace root' },
                    content: { type: 'string', description: 'File content to write' },
                },
                required: ['path', 'content'],
            },
        },
        {
            name: 'edit_file',
            description: 'Replace a specific string in a file. Use for targeted code changes.',
            input_schema: {
                type: 'object',
                properties: {
                    path: { type: 'string', description: 'File path' },
                    old_string: { type: 'string', description: 'Exact text to find' },
                    new_string: { type: 'string', description: 'Replacement text' },
                },
                required: ['path', 'old_string', 'new_string'],
            },
        },
        {
            name: 'browse',
            description: 'Fetch and read a web page. Use for checking documentation, API responses, etc.',
            input_schema: {
                type: 'object',
                properties: {
                    url: { type: 'string', description: 'URL to browse' },
                },
                required: ['url'],
            },
        },
    ];
}
