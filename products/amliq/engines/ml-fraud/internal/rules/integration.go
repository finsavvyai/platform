package rules

import (
	"context"
	"log/slog"
	"math"

	"quantumbeam/internal/models"
)

// FraudIntegration bridges the rule engine into the fraud detection pipeline.
// It evaluates tenant-specific rules against a transaction and returns an
// adjusted fraud score plus explanations to merge into FraudResult.
type FraudIntegration struct {
	engine *Engine
	logger *slog.Logger
}

// NewFraudIntegration creates an integration adapter.
func NewFraudIntegration(engine *Engine) *FraudIntegration {
	return &FraudIntegration{
		engine: engine,
		logger: slog.Default(),
	}
}

// AdjustResult evaluates custom rules and applies adjustments to the
// ML-generated FraudResult. The combined score is clamped to [0, 1].
//
// Behaviour by action:
//   - block  -> score forced to 1.0
//   - allow  -> score forced to 0.0 (enterprise override)
//   - adjust_score -> additive modifier clamped to [0, 1]
//   - flag_review / escalate -> appended to explanation only
//
// If rule evaluation fails, the original result is returned unchanged
// (degraded gracefully) and the error is logged.
func (fi *FraudIntegration) AdjustResult(
	ctx context.Context,
	tenantID string,
	tx *models.TransactionData,
	result *models.FraudResult,
) *models.FraudResult {
	if fi.engine == nil || tenantID == "" {
		return result
	}

	evalResult, err := fi.engine.Evaluate(ctx, tenantID, tx)
	if err != nil {
		fi.logger.Error("rule evaluation failed, returning ML-only result",
			"tenant_id", tenantID,
			"transaction_id", tx.TransactionID,
			"error", err,
		)
		return result
	}

	if len(evalResult.Matched) == 0 {
		return result
	}

	return fi.applyRuleResult(result, evalResult)
}

// applyRuleResult merges the rule evaluation result into the fraud result.
func (fi *FraudIntegration) applyRuleResult(
	result *models.FraudResult,
	evalResult *RuleEvaluationResult,
) *models.FraudResult {
	// Terminal actions override score completely
	switch evalResult.FinalAction {
	case ActionBlock:
		result.FraudScore = 1.0
		result.RiskLevel = result.CalculateRiskLevel()
		result.AddExplanation("Custom rule: transaction blocked by enterprise rule")
	case ActionAllow:
		result.FraudScore = 0.0
		result.RiskLevel = result.CalculateRiskLevel()
		result.AddExplanation("Custom rule: transaction allowed by enterprise override")
	default:
		// Additive score adjustment
		if evalResult.ScoreAdjustment != 0 {
			result.FraudScore = clampScore(result.FraudScore + evalResult.ScoreAdjustment)
			result.RiskLevel = result.CalculateRiskLevel()
		}
	}

	// Append matched rule names as explanations
	for _, m := range evalResult.Matched {
		result.AddExplanation("Matched rule: " + m.RuleName + " (action: " + string(m.Action) + ")")
	}

	return result
}

// clampScore restricts a value to [0, 1].
func clampScore(v float64) float64 {
	return math.Max(0, math.Min(1, v))
}
