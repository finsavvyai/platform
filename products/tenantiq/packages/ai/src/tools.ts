/**
 * Tool definitions for Claude's function calling.
 * These map to TenantIQ API operations the AI agent can invoke.
 */
import { advancedToolDefinitions } from './tools/advanced-definitions';
import { coreToolDefinitions } from './tools/core-definitions';

export const tools = [...coreToolDefinitions, ...advancedToolDefinitions];
