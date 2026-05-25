import type {
	AgentEvent,
	Recipe,
	RecipeResult,
	RecipeStep,
	Session,
	StepResult,
} from './types';
import { findTool, type QualifiedName } from './registry';

/** Handler invoked for each tool call during recipe execution. */
export type ToolHandler = (
	toolName: string,
	input: Record<string, unknown>,
) => Promise<{ output: string; success: boolean }>;

/** Callback for streaming agent events during execution. */
export type EventCallback = (event: AgentEvent) => void;

/** Execute a multi-step recipe within a session context. */
export async function executeRecipe(
	session: Session,
	recipe: Recipe,
	handler: ToolHandler,
	onEvent?: EventCallback,
): Promise<RecipeResult> {
	const startTime = Date.now();
	const stepResults: StepResult[] = [];
	let overallSuccess = true;

	onEvent?.({ type: 'text', content: `Starting recipe: ${recipe.name}` });

	for (const step of recipe.steps) {
		const stepResult = await executeStep(step, session, handler, onEvent);
		stepResults.push(stepResult);

		if (!stepResult.success) {
			overallSuccess = false;
			if (step.onFailure === 'abort') {
				onEvent?.({
					type: 'error',
					message: `Step "${step.tool}" failed — aborting recipe`,
				});
				break;
			}
			if (step.onFailure === 'skip') {
				onEvent?.({
					type: 'text',
					content: `Step "${step.tool}" failed — skipping to next`,
				});
				continue;
			}
			// Default: continue on failure
		}

		if (step.onSuccess === 'stop') break;
	}

	const result: RecipeResult = {
		recipe: recipe.name,
		steps: stepResults,
		success: overallSuccess,
		duration: Date.now() - startTime,
	};

	onEvent?.({
		type: 'turn_complete',
		summary: `Recipe "${recipe.name}" ${overallSuccess ? 'completed' : 'failed'} (${result.duration}ms)`,
	});

	return result;
}

async function executeStep(
	step: RecipeStep,
	session: Session,
	handler: ToolHandler,
	onEvent?: EventCallback,
): Promise<StepResult> {
	const startTime = Date.now();
	const qualifiedName = step.tool as QualifiedName;
	const tool = findTool(qualifiedName);

	if (!tool) {
		onEvent?.({ type: 'error', message: `Tool not found: ${step.tool}` });
		return { tool: step.tool, output: 'Tool not found', success: false, duration: 0 };
	}

	onEvent?.({ type: 'tool_call', toolName: step.tool, input: step.input });

	// Merge session context into input
	const mergedInput = {
		...step.input,
		_tenantId: session.tenantId,
		_userId: session.userId,
	};

	try {
		const { output, success } = await handler(step.tool, mergedInput);
		const duration = Date.now() - startTime;

		onEvent?.({ type: 'tool_result', toolName: step.tool, output, success });

		return { tool: step.tool, output, success, duration };
	} catch (err) {
		const message = err instanceof Error ? err.message : 'Unknown error';
		const duration = Date.now() - startTime;

		onEvent?.({ type: 'tool_result', toolName: step.tool, output: message, success: false });

		return { tool: step.tool, output: message, success: false, duration };
	}
}

/** Validate that all tools in a recipe are registered. */
export function validateRecipe(recipe: Recipe): string[] {
	const errors: string[] = [];
	for (const step of recipe.steps) {
		const tool = findTool(step.tool as QualifiedName);
		if (!tool) errors.push(`Tool not found: ${step.tool}`);
	}
	return errors;
}
