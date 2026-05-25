package rules

import "errors"

// Validation errors for rule engine domain models.
var (
	ErrEmptyRuleName     = errors.New("rule name must not be empty")
	ErrEmptyTenantID     = errors.New("tenant_id must not be empty")
	ErrNoConditions      = errors.New("rule must have at least one condition")
	ErrNoActions         = errors.New("rule must have at least one action")
	ErrInvalidPriority   = errors.New("priority must be between 1 and 1000")
	ErrInvalidOperator   = errors.New("unsupported condition operator")
	ErrEmptyField        = errors.New("condition field must not be empty")
	ErrNilValue          = errors.New("condition value must not be nil")
	ErrInvalidAction     = errors.New("unsupported rule action type")
	ErrInvalidScoreAdj   = errors.New("score_adjustment must be between -1 and 1")
	ErrInvalidLogicOp    = errors.New("logic_operator must be AND or OR")
	ErrInvalidRegex      = errors.New("invalid regex pattern in condition value")
	ErrRuleNameTooLong   = errors.New("rule name must not exceed 255 characters")
	ErrDescTooLong       = errors.New("description must not exceed 1000 characters")
	ErrTooManyConditions = errors.New("rule must not have more than 50 conditions")
	ErrTooManyActions    = errors.New("rule must not have more than 10 actions")
	ErrRuleNotFound      = errors.New("rule not found")
	ErrDuplicateRuleID   = errors.New("rule with this ID already exists")
)

// Operator defines comparison operators for rule conditions.
type Operator string

const (
	OpEq       Operator = "eq"
	OpNeq      Operator = "neq"
	OpGt       Operator = "gt"
	OpGte      Operator = "gte"
	OpLt       Operator = "lt"
	OpLte      Operator = "lte"
	OpIn       Operator = "in"
	OpNotIn    Operator = "not_in"
	OpContains Operator = "contains"
	OpRegex    Operator = "regex"
)

// ValidOperators enumerates all supported operators.
var ValidOperators = map[Operator]bool{
	OpEq: true, OpNeq: true, OpGt: true, OpGte: true,
	OpLt: true, OpLte: true, OpIn: true, OpNotIn: true,
	OpContains: true, OpRegex: true,
}

// ActionType defines what happens when a rule matches.
type ActionType string

const (
	ActionBlock       ActionType = "block"
	ActionFlagReview  ActionType = "flag_review"
	ActionAllow       ActionType = "allow"
	ActionEscalate    ActionType = "escalate"
	ActionAdjustScore ActionType = "adjust_score"
)

// ValidActions enumerates all supported action types.
var ValidActions = map[ActionType]bool{
	ActionBlock: true, ActionFlagReview: true, ActionAllow: true,
	ActionEscalate: true, ActionAdjustScore: true,
}

// LogicOperator groups conditions within a rule.
type LogicOperator string

const (
	LogicAND LogicOperator = "AND"
	LogicOR  LogicOperator = "OR"
)
