/**
 * Smart Router — Self-learning model selection based on task complexity
 * Routes simple tasks to cheap models, complex tasks to powerful ones
 */

export type TaskComplexity = 'trivial' | 'simple' | 'moderate' | 'complex';

export interface RouterConfig {
  trivial: { provider: string; model: string };
  simple: { provider: string; model: string };
  moderate: { provider: string; model: string };
  complex: { provider: string; model: string };
}

const DEFAULT_ROUTES: RouterConfig = {
  trivial: { provider: 'huggingface', model: 'codellama/CodeLlama-7b-Instruct-hf' },
  simple: { provider: 'openai', model: 'gpt-3.5-turbo' },
  moderate: { provider: 'openai', model: 'gpt-4-turbo' },
  complex: { provider: 'anthropic', model: 'claude-3-5-sonnet-20241022' },
};

let routes: RouterConfig = { ...DEFAULT_ROUTES };

export function configureSmartRouter(overrides: Partial<RouterConfig>): void {
  routes = { ...routes, ...overrides };
}

export function getRouteForTask(complexity: TaskComplexity): {
  provider: string;
  model: string;
} {
  return routes[complexity];
}

export function estimateComplexity(prompt: string): TaskComplexity {
  const length = prompt.length;
  const codeBlockCount = (prompt.match(/```/g) || []).length / 2;
  const questionCount = (prompt.match(/\?/g) || []).length;

  if (length < 200 && codeBlockCount === 0) return 'trivial';
  if (length < 500 && codeBlockCount <= 1) return 'simple';
  if (length < 2000 || codeBlockCount <= 3) return 'moderate';
  return 'complex';
}

/**
 * Plan-based model selection — maps subscription tiers to model quality
 */
const PLAN_MODEL_MAP: Record<string, Record<string, { provider: string; model: string }>> = {
  free: {
    test_generation: { provider: 'openai', model: 'gpt-3.5-turbo' },
    bug_analysis: { provider: 'huggingface', model: 'codellama/CodeLlama-7b-Instruct-hf' },
    performance_analysis: { provider: 'openai', model: 'gpt-3.5-turbo' },
    code_optimization: { provider: 'huggingface', model: 'codellama/CodeLlama-7b-Instruct-hf' },
  },
  starter: {
    test_generation: { provider: 'openai', model: 'gpt-3.5-turbo' },
    bug_analysis: { provider: 'openai', model: 'gpt-3.5-turbo' },
    performance_analysis: { provider: 'openai', model: 'gpt-3.5-turbo' },
    code_optimization: { provider: 'openai', model: 'gpt-3.5-turbo' },
  },
  professional: {
    test_generation: { provider: 'openai', model: 'gpt-4-turbo' },
    bug_analysis: { provider: 'openai', model: 'gpt-4o' },
    performance_analysis: { provider: 'openai', model: 'gpt-4o' },
    code_optimization: { provider: 'openai', model: 'gpt-4-turbo' },
  },
  enterprise: {
    test_generation: { provider: 'anthropic', model: 'claude-3-5-sonnet-20241022' },
    bug_analysis: { provider: 'openai', model: 'gpt-4-turbo' },
    performance_analysis: { provider: 'openai', model: 'gpt-4-turbo' },
    code_optimization: { provider: 'anthropic', model: 'claude-3-5-sonnet-20241022' },
  },
};

export function selectModelForPlan(
  planId: string,
  requestType: string,
): { provider: string; model: string } {
  return (
    PLAN_MODEL_MAP[planId]?.[requestType] ||
    { provider: 'openai', model: 'gpt-3.5-turbo' }
  );
}
