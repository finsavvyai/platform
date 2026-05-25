/** Core types for the unified agent platform. */

export interface Session {
	id: string;
	productId: string;
	tenantId: string;
	userId: string;
	messages: Message[];
	context: Record<string, unknown>;
	createdAt: Date;
}

export interface Message {
	role: 'user' | 'assistant' | 'tool';
	content: string;
	toolCallId?: string;
	timestamp: Date;
}

export type AgentEvent =
	| { type: 'text'; content: string }
	| { type: 'tool_call'; toolName: string; input: Record<string, unknown> }
	| { type: 'tool_result'; toolName: string; output: string; success: boolean }
	| { type: 'turn_complete'; summary: string }
	| { type: 'error'; message: string; code?: string };

export type ToolNamespace = 'tenantiq' | 'pushci' | 'claw';

export type ToolPermission = 'read' | 'write' | 'dangerous';

export interface ToolDefinition {
	name: string;
	description: string;
	inputSchema: Record<string, unknown>;
	permission: ToolPermission;
}

export interface Recipe {
	name: string;
	description: string;
	steps: RecipeStep[];
}

export interface RecipeStep {
	tool: string;
	input: Record<string, unknown>;
	onSuccess?: string;
	onFailure?: string;
}

export interface RecipeResult {
	recipe: string;
	steps: StepResult[];
	success: boolean;
	duration: number;
}

export interface StepResult {
	tool: string;
	output: string;
	success: boolean;
	duration: number;
}
