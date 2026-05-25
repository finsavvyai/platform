/**
 * LunaOS Plugin for OpenClaw — v0.3.0
 *
 * Registers LunaOS's 28+ specialized AI coding agents as native
 * OpenClaw tools. Now powered by the native OpenClaw integration
 * layer inside the LunaOS Engine API.
 *
 * Install: openclaw plugins install @lunaos/openclaw-plugin
 * Config:  plugins.entries.lunaos.config.apiKey = "luna_key_xxx"
 *
 * Native endpoints used:
 *   POST /openclaw/tools/run     → luna_run
 *   POST /openclaw/tools/chain   → luna_chain
 *   POST /openclaw/tools/search  → luna_search
 *   POST /openclaw/tools/index   → luna_index
 *   GET  /openclaw/tools/agents  → luna_agents
 *   GET  /openclaw/tools         → luna_status
 */

interface LunaPluginConfig {
    apiUrl: string;
    apiKey: string;
    defaultProvider: string;
    autoIndex: boolean;
}

interface SSEEvent {
    type: string;
    text?: string;
    agent?: string;
    ragSources?: number;
}

// Available Luna agent slugs for validation
const LUNA_AGENTS = [
    '365-security', 'analytics', 'api-generator', 'auth', 'claude-instructions',
    'cloudflare', 'code-mapper', 'code-review', 'database', 'deployment',
    'design-architect', 'docker', 'documentation', 'flow-documenter',
    'glm-vision', 'hig', 'hld-builder', 'lemonsqueezy',
    'monitoring-observability', 'onboarding-builder', 'openai-app',
    'payments-reviewer', 'post-launch-review', 'rag-enhanced', 'rag',
    'ls-products', 'requirements-analyzer', 'route-mapper', 'run', 'seo',
    'task-executor', 'task-planner', 'testing-validation', 'ui-fix',
    'ui-test', 'user-guide',
];

const CHAIN_PRESETS = [
    'full-review', 'new-feature', 'deploy', 'security-audit', 'api-design',
];

async function parseSSEStream(response: Response): Promise<string> {
    const reader = response.body?.getReader();
    if (!reader) return '';

    const decoder = new TextDecoder();
    let result = '';

    while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        for (const line of chunk.split('\n')) {
            if (line.startsWith('data: ')) {
                try {
                    const event: SSEEvent = JSON.parse(line.slice(6));
                    if (event.type === 'chunk' && event.text) {
                        result += event.text;
                    }
                } catch {
                    // Not JSON — raw token data
                    const rawText = line.slice(6).trim();
                    if (rawText && rawText !== '[DONE]') {
                        result += rawText;
                    }
                }
            }
            // Handle raw SSE token events
            if (line.startsWith('event: token')) {
                // Next data line is the raw token
            }
        }
    }

    return result;
}

/**
 * Parse an SSE stream where 'event: token' lines are followed by 'data: <raw text>'
 */
async function parseTokenSSEStream(response: Response): Promise<string> {
    const reader = response.body?.getReader();
    if (!reader) return '';

    const decoder = new TextDecoder();
    let result = '';
    let isTokenEvent = false;

    while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        for (const line of chunk.split('\n')) {
            if (line.startsWith('event: token')) {
                isTokenEvent = true;
                continue;
            }
            if (isTokenEvent && line.startsWith('data: ')) {
                result += line.slice(6);
                isTokenEvent = false;
                continue;
            }
            if (line.startsWith('event: ')) {
                isTokenEvent = false;
            }
        }
    }

    return result;
}

export default function lunaOSPlugin(api: any) {
    const config: LunaPluginConfig = {
        apiUrl: api.config?.plugins?.entries?.lunaos?.config?.apiUrl
            || process.env.LUNAOS_API_URL
            || 'https://api.lunaos.ai',
        apiKey: api.config?.plugins?.entries?.lunaos?.config?.apiKey
            || process.env.LUNAOS_API_KEY
            || '',
        defaultProvider: api.config?.plugins?.entries?.lunaos?.config?.defaultProvider
            || 'deepseek',
        autoIndex: api.config?.plugins?.entries?.lunaos?.config?.autoIndex
            || false,
    };

    const headers = () => ({
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${config.apiKey}`,
    });

    // ─── Tool: luna_run ──────────────────────────────────────────────
    // Now powered by native /openclaw/tools/run endpoint
    api.registerAgentTool({
        name: 'luna_run',
        description: `Run a specialized LunaOS coding agent. Available agents: ${LUNA_AGENTS.join(', ')}`,
        parameters: {
            agent: {
                type: 'string',
                description: 'Agent slug (e.g. code-review, 365-security, testing-validation, design-architect)',
                required: true,
                enum: LUNA_AGENTS,
            },
            context: {
                type: 'string',
                description: 'The code, question, or context for the agent to analyze',
                required: true,
            },
            useRag: {
                type: 'boolean',
                description: 'Include RAG codebase context for more accurate results',
                default: true,
            },
            provider: {
                type: 'string',
                description: 'LLM provider (deepseek, anthropic, openai)',
                default: config.defaultProvider,
            },
        },
        execute: async ({ agent, context, useRag = true, provider }: any) => {
            if (!config.apiKey) {
                return {
                    error: 'LunaOS API key not configured. Set plugins.entries.lunaos.config.apiKey or LUNAOS_API_KEY env var.',
                };
            }

            // Use native OpenClaw tool endpoint
            const response = await fetch(`${config.apiUrl}/openclaw/tools/run`, {
                method: 'POST',
                headers: headers(),
                body: JSON.stringify({
                    agent,
                    context,
                    useRag,
                    provider: provider || config.defaultProvider,
                }),
            });

            if (!response.ok) {
                const err = await response.text();
                return { error: `LunaOS API error (${response.status}): ${err}` };
            }

            const result = await parseTokenSSEStream(response);
            return { result, agent, provider: provider || config.defaultProvider };
        },
    });

    // ─── Tool: luna_chain ────────────────────────────────────────────
    // Now powered by native /openclaw/tools/chain endpoint
    api.registerAgentTool({
        name: 'luna_chain',
        description: `Run a multi-agent LunaOS chain for comprehensive analysis. Presets: ${CHAIN_PRESETS.join(', ')}`,
        parameters: {
            preset: {
                type: 'string',
                description: 'Chain preset name (e.g. full-review, security-audit, deploy, new-feature, api-design)',
                required: true,
                enum: CHAIN_PRESETS,
            },
            context: {
                type: 'string',
                description: 'Code or context to analyze',
                required: true,
            },
        },
        execute: async ({ preset, context }: any) => {
            if (!config.apiKey) {
                return { error: 'LunaOS API key not configured.' };
            }

            const response = await fetch(`${config.apiUrl}/openclaw/tools/chain`, {
                method: 'POST',
                headers: headers(),
                body: JSON.stringify({
                    preset,
                    context,
                    provider: config.defaultProvider,
                }),
            });

            if (!response.ok) {
                const err = await response.text();
                return { error: `LunaOS chain error (${response.status}): ${err}` };
            }

            const result = await parseTokenSSEStream(response);
            return { result, preset };
        },
    });

    // ─── Tool: luna_search ───────────────────────────────────────────
    // Now powered by native /openclaw/tools/search endpoint
    api.registerAgentTool({
        name: 'luna_search',
        description: 'Semantic search across indexed codebase using LunaOS RAG. Find implementations, patterns, and relevant code.',
        parameters: {
            query: {
                type: 'string',
                description: 'Natural language search query (e.g. "authentication middleware", "database connection pooling")',
                required: true,
            },
        },
        execute: async ({ query }: any) => {
            if (!config.apiKey) {
                return { error: 'LunaOS API key not configured.' };
            }

            const response = await fetch(`${config.apiUrl}/openclaw/tools/search`, {
                method: 'POST',
                headers: headers(),
                body: JSON.stringify({ query }),
            });

            if (!response.ok) {
                const err = await response.text();
                return { error: `LunaOS search error (${response.status}): ${err}` };
            }

            const data = await response.json() as any;
            return {
                query: data.query,
                sources: data.sources?.map((s: any) => ({
                    path: s.path,
                    score: s.score,
                    preview: s.content?.substring(0, 200),
                })),
                confidence: data.confidence,
                searchTimeMs: data.searchTimeMs,
            };
        },
    });

    // ─── Tool: luna_index ────────────────────────────────────────────
    // Now powered by native /openclaw/tools/index endpoint
    api.registerAgentTool({
        name: 'luna_index',
        description: 'Index files for RAG search. Upload source code to LunaOS for semantic search and agent context.',
        parameters: {
            files: {
                type: 'array',
                description: 'Array of {path, content} objects to index',
                required: true,
            },
            repoName: {
                type: 'string',
                description: 'Repository name for grouping',
            },
        },
        execute: async ({ files, repoName }: any) => {
            if (!config.apiKey) {
                return { error: 'LunaOS API key not configured.' };
            }

            const response = await fetch(`${config.apiUrl}/openclaw/tools/index`, {
                method: 'POST',
                headers: headers(),
                body: JSON.stringify({ files, repoName }),
            });

            if (!response.ok) {
                const err = await response.text();
                return { error: `LunaOS index error (${response.status}): ${err}` };
            }

            return await response.json();
        },
    });

    // ─── Tool: luna_execute ─────────────────────────────────────────
    // Agentic execution via OpenHands — agents can run commands, edit files, browse
    api.registerAgentTool({
        name: 'luna_execute',
        description: 'Execute an agent with real tool-use capabilities (bash, file ops, browsing). Requires Pro or Team plan. The agent can read/write files, run commands, and browse the web in a sandboxed environment.',
        parameters: {
            agent: {
                type: 'string',
                description: 'Agent slug (e.g. code-review, testing-validation, security-audit)',
                required: true,
                enum: LUNA_AGENTS,
            },
            context: {
                type: 'string',
                description: 'The task description and context for the agent to execute',
                required: true,
            },
            maxIterations: {
                type: 'number',
                description: 'Max tool iterations (default 5, max 15 for Team)',
                default: 5,
            },
        },
        execute: async ({ agent, context, maxIterations = 5 }: any) => {
            if (!config.apiKey) {
                return { error: 'LunaOS API key not configured.' };
            }

            const response = await fetch(`${config.apiUrl}/execute`, {
                method: 'POST',
                headers: headers(),
                body: JSON.stringify({ agent, context, maxIterations }),
            });

            if (!response.ok) {
                const err = await response.text();
                return { error: `LunaOS execute error (${response.status}): ${err}` };
            }

            return await response.json();
        },
    });

    // ─── Gateway RPC: luna.status ────────────────────────────────────
    api.registerGatewayMethod('luna.status', async ({ respond }: any) => {
        try {
            const response = await fetch(`${config.apiUrl}/openclaw/tools`, {
                headers: headers(),
            });
            const data = await response.json();
            respond(true, data);
        } catch (err: any) {
            respond(false, { error: err.message });
        }
    });

    // ─── Gateway RPC: luna.agents ────────────────────────────────────
    api.registerGatewayMethod('luna.agents', async ({ respond }: any) => {
        try {
            const response = await fetch(`${config.apiUrl}/openclaw/tools/agents`, {
                headers: headers(),
            });
            const data = await response.json();
            respond(true, data);
        } catch (err: any) {
            respond(true, {
                agents: LUNA_AGENTS.map(slug => ({ slug })),
                total: LUNA_AGENTS.length,
            });
        }
    });

    // ─── Gateway RPC: luna.analytics ─────────────────────────────────
    api.registerGatewayMethod('luna.analytics', async ({ respond }: any) => {
        try {
            const response = await fetch(`${config.apiUrl}/openclaw/analytics/overview`, {
                headers: headers(),
            });
            const data = await response.json();
            respond(true, data);
        } catch (err: any) {
            respond(false, { error: err.message });
        }
    });

    // ─── Background: Auto-index workspace ───────────────────────────
    if (config.autoIndex && config.apiKey) {
        console.log('[LunaOS] Auto-indexing is enabled. Workspace will be indexed on next agent turn.');
    }

    console.log(`[LunaOS] Plugin v0.4.0 initialized — ${LUNA_AGENTS.length} agents, ${CHAIN_PRESETS.length} chains, execution via OpenHands`);
}
