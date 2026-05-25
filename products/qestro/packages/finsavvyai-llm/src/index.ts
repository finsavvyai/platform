/**
 * @finsavvyai/llm — Unified multi-provider AI client
 *
 * Features:
 * - Claw Gateway proxy with ReasoningBank caching (30% token savings)
 * - Smart Router for model selection by task complexity
 * - Failover chain: OpenAI -> Anthropic -> HuggingFace
 * - Token usage tracking and cost calculation
 */

export {
  initClawGateway,
  isClawEnabled,
  clawComplete,
  buildCacheKey,
  type ClawConfig,
  type ClawRequest,
  type ClawResponse,
  type ClawMessage,
} from './claw-client.js';

export {
  LLMProvider,
  type LLMConfig,
  type CompletionRequest,
  type CompletionResult,
} from './providers.js';

export {
  configureSmartRouter,
  getRouteForTask,
  estimateComplexity,
  selectModelForPlan,
  type TaskComplexity,
  type RouterConfig,
} from './smart-router.js';
