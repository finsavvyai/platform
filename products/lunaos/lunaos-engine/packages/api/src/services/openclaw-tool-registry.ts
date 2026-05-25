/**
 * OpenClaw Tool Registry — defines all available OpenClaw-compatible tools
 */

import { LUNA_AGENTS, CHAIN_PRESETS, type OpenClawToolDefinition } from './openclaw-types';

/**
 * Returns the full set of OpenClaw-compatible tool definitions
 * that LunaOS natively provides.
 */
export function getToolRegistry(): OpenClawToolDefinition[] {
    return [
        {
            name: 'luna_run',
            description: `Run a specialized LunaOS coding agent. Available agents: ${LUNA_AGENTS.join(', ')}`,
            parameters: {
                agent: { type: 'string', description: 'Agent slug (e.g. code-review, 365-security)', required: true, enum: LUNA_AGENTS },
                context: { type: 'string', description: 'The code, question, or context for the agent to analyze', required: true },
                useRag: { type: 'boolean', description: 'Include RAG codebase context for more accurate results', default: true },
                provider: { type: 'string', description: 'LLM provider (deepseek, anthropic, openai)', default: 'deepseek' },
            },
        },
        {
            name: 'luna_chain',
            description: `Run a multi-agent LunaOS chain for comprehensive analysis. Presets: ${CHAIN_PRESETS.join(', ')}`,
            parameters: {
                preset: { type: 'string', description: 'Chain preset name (e.g. full-review, security-audit)', required: true, enum: CHAIN_PRESETS },
                context: { type: 'string', description: 'Code or context to analyze', required: true },
            },
        },
        {
            name: 'luna_search',
            description: 'Semantic search across indexed codebase using LunaOS RAG.',
            parameters: {
                query: { type: 'string', description: 'Natural language search query', required: true },
                topK: { type: 'number', description: 'Number of results to return', default: 5 },
            },
        },
        {
            name: 'luna_index',
            description: 'Index files for RAG search. Upload source code to LunaOS for semantic search.',
            parameters: {
                files: { type: 'array', description: 'Array of {path, content} objects to index', required: true },
                repoName: { type: 'string', description: 'Repository name for grouping' },
            },
        },
        {
            name: 'luna_status',
            description: 'Get the status of all registered OpenClaw gateways and active sessions.',
            parameters: {},
        },
        {
            name: 'execute_code',
            description: 'Safely execute Python or JavaScript code in a secure sandbox environment.',
            parameters: {
                language: { type: 'string', description: 'The programming language (python or javascript)', required: true, enum: ['python', 'javascript', 'node'] },
                code: { type: 'string', description: 'The source code to execute', required: true },
            },
        },
        {
            name: 'luna_agents',
            description: 'List all available Luna agents with their categories and tiers.',
            parameters: {},
        },
    ];
}
