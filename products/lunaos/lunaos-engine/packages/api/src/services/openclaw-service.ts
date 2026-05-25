/**
 * OpenClaw Service — re-export barrel
 *
 * This file re-exports all OpenClaw sub-modules to preserve existing import paths.
 * Internal modules:
 *   - openclaw-types: constants and type definitions
 *   - openclaw-tool-registry: tool definitions
 *   - openclaw-gateway: WebSocket connection + persistence
 *   - openclaw-sessions: session lifecycle
 *   - openclaw-skill-tracking: skill execution analytics
 */

// Types & constants
export {
    LUNA_AGENTS,
    CHAIN_PRESETS,
    type LunaAgentSlug,
    type ChainPresetSlug,
    type OpenClawToolDefinition,
    type OpenClawParamDef,
    type OpenClawToolResult,
    type GatewayInfo,
    type SessionInfo,
    type OpenClawWSMessage,
} from './openclaw-types';

// Tool registry
export { getToolRegistry } from './openclaw-tool-registry';

// Gateway connection & persistence
export {
    connectToGateway,
    gatewayRPC,
    saveGateway,
    listGateways,
    deleteGateway,
} from './openclaw-gateway';

// Session management
export {
    createSession,
    updateSession,
    listSessions,
} from './openclaw-sessions';

// Skill execution tracking
export {
    trackSkillExecution,
    getSkillAnalytics,
} from './openclaw-skill-tracking';

// ─── Build Luna Agent Task ──────────────────────────────────────────────────

/**
 * Constructs a structured task prompt for dispatching a Luna agent
 * to a remote OpenClaw Gateway.
 */
export function buildLunaAgentTask(
    persona: { name: string; slug: string; systemPrompt: string },
    context: string,
    options?: { maxPromptLines?: number },
): string {
    const maxLines = options?.maxPromptLines || 50;

    return [
        `You are acting as the "${persona.name}" Luna agent from LunaOS.`,
        ``,
        `## Your Role`,
        persona.systemPrompt.split('\n').slice(0, maxLines).join('\n'),
        ``,
        `## Task`,
        context,
        ``,
        `## Instructions`,
        `Use your available tools (exec, read, write, browser, web_search) to complete this task.`,
        `Provide a clear, actionable report when done.`,
    ].join('\n');
}
