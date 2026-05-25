package rules

import (
	"context"
	"fmt"
	"sort"

	"quantumbeam/internal/models"
)

// Engine evaluates a set of rules against a transaction.
// It is stateless and safe for concurrent use.
type Engine struct {
	repo RuleRepository
}

// NewEngine creates a rule evaluation engine backed by the given repository.
func NewEngine(repo RuleRepository) *Engine {
	return &Engine{repo: repo}
}

// Evaluate loads enabled rules for the tenant, evaluates them against the
// transaction, and returns the combined result. Rules are evaluated in
// priority order (highest first); the highest-priority terminal action
// (block/allow) wins.
func (e *Engine) Evaluate(ctx context.Context, tenantID string, tx *models.TransactionData) (*RuleEvaluationResult, error) {
	enabled := true
	ruleList, err := e.repo.List(ctx, tenantID, ListFilter{EnabledOnly: &enabled})
	if err != nil {
		return nil, fmt.Errorf("loading rules: %w", err)
	}

	// Sort by priority descending (highest first)
	sort.Slice(ruleList, func(i, j int) bool {
		return ruleList[i].Priority > ruleList[j].Priority
	})

	result := &RuleEvaluationResult{
		Matched:        make([]MatchedRule, 0),
		TotalEvaluated: len(ruleList),
	}

	for _, rule := range ruleList {
		matched, evalErr := e.evaluateRule(rule, tx)
		if evalErr != nil {
			// Skip rules that error during evaluation
			continue
		}
		if !matched {
			continue
		}
		for _, action := range rule.Actions {
			result.Matched = append(result.Matched, MatchedRule{
				RuleID:   rule.ID,
				RuleName: rule.Name,
				Priority: rule.Priority,
				Action:   action.Type,
			})
			if action.Type == ActionAdjustScore {
				result.ScoreAdjustment += action.ScoreAdjustment
			}
			// Terminal actions: highest priority wins
			if result.FinalAction == "" {
				if action.Type == ActionBlock || action.Type == ActionAllow {
					result.FinalAction = action.Type
				}
			}
		}
	}

	return result, nil
}

// EvaluateRules evaluates a specific set of rules (for dry-run / test).
func (e *Engine) EvaluateRules(ruleList []*Rule, tx *models.TransactionData) *RuleEvaluationResult {
	sort.Slice(ruleList, func(i, j int) bool {
		return ruleList[i].Priority > ruleList[j].Priority
	})

	result := &RuleEvaluationResult{
		Matched:        make([]MatchedRule, 0),
		TotalEvaluated: len(ruleList),
	}

	for _, rule := range ruleList {
		if !rule.Enabled {
			continue
		}
		matched, err := e.evaluateRule(rule, tx)
		if err != nil || !matched {
			continue
		}
		for _, action := range rule.Actions {
			result.Matched = append(result.Matched, MatchedRule{
				RuleID: rule.ID, RuleName: rule.Name,
				Priority: rule.Priority, Action: action.Type,
			})
			if action.Type == ActionAdjustScore {
				result.ScoreAdjustment += action.ScoreAdjustment
			}
			if result.FinalAction == "" && (action.Type == ActionBlock || action.Type == ActionAllow) {
				result.FinalAction = action.Type
			}
		}
	}
	return result
}

// evaluateRule checks all conditions of a rule against the transaction.
func (e *Engine) evaluateRule(rule *Rule, tx *models.TransactionData) (bool, error) {
	for _, cond := range rule.Conditions {
		fieldVal := extractField(tx, cond.Field)
		matched, err := EvaluateCondition(cond.Operator, fieldVal, cond.Value)
		if err != nil {
			return false, err
		}

		if rule.LogicOperator == LogicOR && matched {
			return true, nil
		}
		if rule.LogicOperator == LogicAND && !matched {
			return false, nil
		}
	}
	// AND: all matched; OR: none matched
	return rule.LogicOperator == LogicAND, nil
}

// extractField pulls a named field from TransactionData.
func extractField(tx *models.TransactionData, field string) interface{} {
	switch field {
	case "amount":
		f, _ := tx.Amount.Float64()
		return f
	case "merchant_id":
		return tx.MerchantID
	case "user_id":
		return tx.UserID
	case "payment_method":
		return tx.PaymentMethod
	case "transaction_id":
		return tx.TransactionID
	case "country":
		if tx.Location != nil {
			return tx.Location.Country
		}
		return ""
	case "city":
		if tx.Location != nil {
			return tx.Location.City
		}
		return ""
	case "latitude":
		if tx.Location != nil {
			return tx.Location.Latitude
		}
		return 0.0
	case "longitude":
		if tx.Location != nil {
			return tx.Location.Longitude
		}
		return 0.0
	case "device_fingerprint":
		if tx.DeviceFingerprint != nil {
			return *tx.DeviceFingerprint
		}
		return ""
	case "hour":
		return float64(tx.Timestamp.Hour())
	default:
		// Check features map
		if tx.Features != nil {
			if v, ok := tx.Features[field]; ok {
				return v
			}
		}
		return nil
	}
}
