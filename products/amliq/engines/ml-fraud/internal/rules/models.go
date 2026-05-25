// Package rules implements the custom rule engine for enterprise fraud detection.
// Rules let enterprise tenants define velocity limits, amount thresholds,
// geo-restrictions, and time-window checks that augment the ML fraud model.
package rules

import (
	"fmt"
	"regexp"
	"time"
)

// RuleCondition is a single predicate evaluated against a transaction field.
type RuleCondition struct {
	Field    string      `json:"field" validate:"required"`
	Operator Operator    `json:"operator" validate:"required"`
	Value    interface{} `json:"value" validate:"required"`
}

// Validate checks that the condition is well-formed.
func (rc *RuleCondition) Validate() error {
	if rc.Field == "" {
		return ErrEmptyField
	}
	if !ValidOperators[rc.Operator] {
		return fmt.Errorf("%w: %s", ErrInvalidOperator, rc.Operator)
	}
	if rc.Value == nil {
		return ErrNilValue
	}
	if rc.Operator == OpRegex {
		s, ok := rc.Value.(string)
		if !ok {
			return ErrInvalidRegex
		}
		if _, err := regexp.Compile(s); err != nil {
			return fmt.Errorf("%w: %v", ErrInvalidRegex, err)
		}
	}
	return nil
}

// RuleAction describes the outcome when a rule matches.
type RuleAction struct {
	Type            ActionType `json:"type" validate:"required"`
	ScoreAdjustment float64   `json:"score_adjustment,omitempty"`
	Reason          string     `json:"reason,omitempty"`
}

// Validate checks that the action is well-formed.
func (ra *RuleAction) Validate() error {
	if !ValidActions[ra.Type] {
		return fmt.Errorf("%w: %s", ErrInvalidAction, ra.Type)
	}
	if ra.Type == ActionAdjustScore {
		if ra.ScoreAdjustment < -1 || ra.ScoreAdjustment > 1 {
			return ErrInvalidScoreAdj
		}
	}
	return nil
}

// Rule is a single fraud-detection rule owned by a tenant.
type Rule struct {
	ID            string          `json:"id"`
	Name          string          `json:"name" validate:"required,max=255"`
	Description   string          `json:"description,omitempty" validate:"max=1000"`
	TenantID      string          `json:"tenant_id" validate:"required"`
	Conditions    []RuleCondition `json:"conditions" validate:"required,min=1"`
	LogicOperator LogicOperator   `json:"logic_operator"`
	Actions       []RuleAction    `json:"actions" validate:"required,min=1"`
	Priority      int             `json:"priority" validate:"required,min=1,max=1000"`
	Enabled       bool            `json:"enabled"`
	CreatedAt     time.Time       `json:"created_at"`
	UpdatedAt     time.Time       `json:"updated_at"`
}

// Validate performs comprehensive validation on the rule.
func (r *Rule) Validate() error {
	if r.Name == "" {
		return ErrEmptyRuleName
	}
	if len(r.Name) > 255 {
		return ErrRuleNameTooLong
	}
	if len(r.Description) > 1000 {
		return ErrDescTooLong
	}
	if r.TenantID == "" {
		return ErrEmptyTenantID
	}
	if len(r.Conditions) == 0 {
		return ErrNoConditions
	}
	if len(r.Conditions) > 50 {
		return ErrTooManyConditions
	}
	if len(r.Actions) == 0 {
		return ErrNoActions
	}
	if len(r.Actions) > 10 {
		return ErrTooManyActions
	}
	if r.Priority < 1 || r.Priority > 1000 {
		return ErrInvalidPriority
	}
	if r.LogicOperator != LogicAND && r.LogicOperator != LogicOR {
		return ErrInvalidLogicOp
	}
	for i := range r.Conditions {
		if err := r.Conditions[i].Validate(); err != nil {
			return fmt.Errorf("condition[%d]: %w", i, err)
		}
	}
	for i := range r.Actions {
		if err := r.Actions[i].Validate(); err != nil {
			return fmt.Errorf("action[%d]: %w", i, err)
		}
	}
	return nil
}

// RuleEvaluationResult captures the outcome of evaluating rules.
type RuleEvaluationResult struct {
	Matched         []MatchedRule `json:"matched_rules"`
	TotalEvaluated  int           `json:"total_evaluated"`
	ScoreAdjustment float64       `json:"score_adjustment"`
	FinalAction     ActionType    `json:"final_action,omitempty"`
}

// MatchedRule records which rule matched and why.
type MatchedRule struct {
	RuleID   string     `json:"rule_id"`
	RuleName string     `json:"rule_name"`
	Priority int        `json:"priority"`
	Action   ActionType `json:"action"`
}
