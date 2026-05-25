/**
 * Token Tracker — estimate input/output tokens and cost per execution
 *
 * Uses a simple heuristic: ~4 chars per token (English text average).
 * Stores token counts per execution and provides cost estimation.
 */

// ─── Token estimation ────────────────────────────────────────────────────────

const CHARS_PER_TOKEN = 4; // conservative estimate for English text

export function estimateTokens(text: string): number {
    return Math.ceil(text.length / CHARS_PER_TOKEN);
}

// ─── Cost estimation (per 1M tokens) ─────────────────────────────────────────

const COST_PER_MILLION_INPUT: Record<string, number> = {
    'deepseek-chat': 0.14,
    'claude-sonnet-4-20250514': 3.0,
    'gpt-4o': 2.50,
    'gpt-4o-mini': 0.15,
};

const COST_PER_MILLION_OUTPUT: Record<string, number> = {
    'deepseek-chat': 0.28,
    'claude-sonnet-4-20250514': 15.0,
    'gpt-4o': 10.0,
    'gpt-4o-mini': 0.60,
};

export interface TokenUsage {
    inputTokens: number;
    outputTokens: number;
    totalTokens: number;
    estimatedCostUsd: number;
}

export function calculateTokenUsage(
    inputText: string,
    outputText: string,
    model: string,
): TokenUsage {
    const inputTokens = estimateTokens(inputText);
    const outputTokens = estimateTokens(outputText);
    const totalTokens = inputTokens + outputTokens;

    const inputCostPerM = COST_PER_MILLION_INPUT[model] || COST_PER_MILLION_INPUT['deepseek-chat']!;
    const outputCostPerM = COST_PER_MILLION_OUTPUT[model] || COST_PER_MILLION_OUTPUT['deepseek-chat']!;

    const estimatedCostUsd = (
        (inputTokens / 1_000_000) * inputCostPerM +
        (outputTokens / 1_000_000) * outputCostPerM
    );

    return {
        inputTokens,
        outputTokens,
        totalTokens,
        estimatedCostUsd: Math.round(estimatedCostUsd * 1_000_000) / 1_000_000, // 6 decimal places
    };
}

// ─── D1 persistence ──────────────────────────────────────────────────────────

export async function saveTokenUsage(
    db: D1Database,
    executionId: string,
    usage: TokenUsage,
): Promise<void> {
    try {
        await db.prepare(`
      UPDATE executions SET
        input_tokens = ?, output_tokens = ?, estimated_cost = ?
      WHERE id = ?
    `).bind(
            usage.inputTokens,
            usage.outputTokens,
            usage.estimatedCostUsd,
            executionId,
        ).run();
    } catch {
        // Non-critical — don't fail execution over token tracking
    }
}

// ─── Aggregate user cost for billing ─────────────────────────────────────────

export async function getUserMonthlyCost(
    db: D1Database,
    userId: string,
): Promise<{ totalCost: number; totalTokens: number; executionCount: number }> {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

    const result = await db.prepare(`
    SELECT
      COALESCE(SUM(estimated_cost), 0) as total_cost,
      COALESCE(SUM(COALESCE(input_tokens, 0) + COALESCE(output_tokens, 0)), 0) as total_tokens,
      COUNT(*) as execution_count
    FROM executions
    WHERE user_id = ? AND created_at >= ?
  `).bind(userId, monthStart).first<{
        total_cost: number;
        total_tokens: number;
        execution_count: number;
    }>();

    return {
        totalCost: result?.total_cost || 0,
        totalTokens: result?.total_tokens || 0,
        executionCount: result?.execution_count || 0,
    };
}
