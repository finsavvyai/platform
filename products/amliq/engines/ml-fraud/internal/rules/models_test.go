package rules

import (
	"strings"
	"testing"
	"unicode/utf8"
)

// --- helpers ---

func validRule() *Rule {
	return &Rule{
		ID:       "rule-1",
		Name:     "High amount block",
		TenantID: "tenant-1",
		Conditions: []RuleCondition{
			{Field: "amount", Operator: OpGt, Value: 10000.0},
		},
		LogicOperator: LogicAND,
		Actions: []RuleAction{
			{Type: ActionBlock, Reason: "Amount too high"},
		},
		Priority: 100,
		Enabled:  true,
	}
}

// --- RuleCondition.Validate ---

func TestConditionValidate_AllOperators(t *testing.T) {
	for op := range ValidOperators {
		c := RuleCondition{Field: "amount", Operator: op, Value: "x"}
		if err := c.Validate(); err != nil {
			t.Errorf("operator %s should be valid: %v", op, err)
		}
	}
}

func TestConditionValidate_EmptyField(t *testing.T) {
	c := RuleCondition{Operator: OpEq, Value: "x"}
	if err := c.Validate(); err != ErrEmptyField {
		t.Fatalf("expected ErrEmptyField, got %v", err)
	}
}

func TestConditionValidate_InvalidOperator(t *testing.T) {
	c := RuleCondition{Field: "x", Operator: "bad", Value: 1}
	if err := c.Validate(); err == nil || !strings.Contains(err.Error(), "unsupported") {
		t.Fatalf("expected invalid operator error, got %v", err)
	}
}

func TestConditionValidate_NilValue(t *testing.T) {
	c := RuleCondition{Field: "x", Operator: OpEq, Value: nil}
	if err := c.Validate(); err != ErrNilValue {
		t.Fatalf("expected ErrNilValue, got %v", err)
	}
}

func TestConditionValidate_RegexValid(t *testing.T) {
	c := RuleCondition{Field: "merchant_id", Operator: OpRegex, Value: `^MER-\d+$`}
	if err := c.Validate(); err != nil {
		t.Fatalf("valid regex should pass: %v", err)
	}
}

func TestConditionValidate_RegexInvalid(t *testing.T) {
	c := RuleCondition{Field: "merchant_id", Operator: OpRegex, Value: `[invalid`}
	if err := c.Validate(); err == nil {
		t.Fatal("invalid regex should fail")
	}
}

func TestConditionValidate_RegexNonString(t *testing.T) {
	c := RuleCondition{Field: "x", Operator: OpRegex, Value: 123}
	if err := c.Validate(); err != ErrInvalidRegex {
		t.Fatalf("expected ErrInvalidRegex for non-string, got %v", err)
	}
}

// --- RuleAction.Validate ---

func TestActionValidate_AllTypes(t *testing.T) {
	for at := range ValidActions {
		a := RuleAction{Type: at}
		if at == ActionAdjustScore {
			a.ScoreAdjustment = 0.1
		}
		if err := a.Validate(); err != nil {
			t.Errorf("action %s should be valid: %v", at, err)
		}
	}
}

func TestActionValidate_InvalidType(t *testing.T) {
	a := RuleAction{Type: "nope"}
	if err := a.Validate(); err == nil || !strings.Contains(err.Error(), "unsupported") {
		t.Fatalf("expected invalid action error, got %v", err)
	}
}

func TestActionValidate_ScoreAdjustmentBounds(t *testing.T) {
	cases := []struct {
		adj  float64
		ok   bool
	}{
		{-1.0, true}, {0, true}, {1.0, true},
		{-1.1, false}, {1.1, false},
	}
	for _, tc := range cases {
		a := RuleAction{Type: ActionAdjustScore, ScoreAdjustment: tc.adj}
		err := a.Validate()
		if tc.ok && err != nil {
			t.Errorf("adj %.1f should be valid: %v", tc.adj, err)
		}
		if !tc.ok && err == nil {
			t.Errorf("adj %.1f should be invalid", tc.adj)
		}
	}
}

// --- Rule.Validate ---

func TestRuleValidate_ValidRule(t *testing.T) {
	r := validRule()
	if err := r.Validate(); err != nil {
		t.Fatalf("valid rule should pass: %v", err)
	}
}

func TestRuleValidate_EmptyName(t *testing.T) {
	r := validRule()
	r.Name = ""
	if err := r.Validate(); err != ErrEmptyRuleName {
		t.Fatalf("expected ErrEmptyRuleName, got %v", err)
	}
}

func TestRuleValidate_NameTooLong(t *testing.T) {
	r := validRule()
	r.Name = strings.Repeat("a", 256)
	if err := r.Validate(); err != ErrRuleNameTooLong {
		t.Fatalf("expected ErrRuleNameTooLong, got %v", err)
	}
}

func TestRuleValidate_DescTooLong(t *testing.T) {
	r := validRule()
	r.Description = strings.Repeat("a", 1001)
	if err := r.Validate(); err != ErrDescTooLong {
		t.Fatalf("expected ErrDescTooLong, got %v", err)
	}
}

func TestRuleValidate_EmptyTenantID(t *testing.T) {
	r := validRule()
	r.TenantID = ""
	if err := r.Validate(); err != ErrEmptyTenantID {
		t.Fatalf("expected ErrEmptyTenantID, got %v", err)
	}
}

func TestRuleValidate_NoConditions(t *testing.T) {
	r := validRule()
	r.Conditions = nil
	if err := r.Validate(); err != ErrNoConditions {
		t.Fatalf("expected ErrNoConditions, got %v", err)
	}
}

func TestRuleValidate_TooManyConditions(t *testing.T) {
	r := validRule()
	r.Conditions = make([]RuleCondition, 51)
	for i := range r.Conditions {
		r.Conditions[i] = RuleCondition{Field: "a", Operator: OpEq, Value: 1}
	}
	if err := r.Validate(); err != ErrTooManyConditions {
		t.Fatalf("expected ErrTooManyConditions, got %v", err)
	}
}

func TestRuleValidate_NoActions(t *testing.T) {
	r := validRule()
	r.Actions = nil
	if err := r.Validate(); err != ErrNoActions {
		t.Fatalf("expected ErrNoActions, got %v", err)
	}
}

func TestRuleValidate_TooManyActions(t *testing.T) {
	r := validRule()
	r.Actions = make([]RuleAction, 11)
	for i := range r.Actions {
		r.Actions[i] = RuleAction{Type: ActionBlock}
	}
	if err := r.Validate(); err != ErrTooManyActions {
		t.Fatalf("expected ErrTooManyActions, got %v", err)
	}
}

func TestRuleValidate_InvalidPriority(t *testing.T) {
	for _, p := range []int{0, -1, 1001} {
		r := validRule()
		r.Priority = p
		if err := r.Validate(); err != ErrInvalidPriority {
			t.Fatalf("priority %d should fail: got %v", p, err)
		}
	}
}

func TestRuleValidate_InvalidLogicOperator(t *testing.T) {
	r := validRule()
	r.LogicOperator = "XOR"
	if err := r.Validate(); err != ErrInvalidLogicOp {
		t.Fatalf("expected ErrInvalidLogicOp, got %v", err)
	}
}

func TestRuleValidate_ConditionError(t *testing.T) {
	r := validRule()
	r.Conditions[0].Field = ""
	err := r.Validate()
	if err == nil || !strings.Contains(err.Error(), "condition[0]") {
		t.Fatalf("expected condition[0] error, got %v", err)
	}
}

func TestRuleValidate_ActionError(t *testing.T) {
	r := validRule()
	r.Actions[0].Type = "invalid"
	err := r.Validate()
	if err == nil || !strings.Contains(err.Error(), "action[0]") {
		t.Fatalf("expected action[0] error, got %v", err)
	}
}

// --- Fuzz test for operator parsing ---

func FuzzOperatorParsing(f *testing.F) {
	for op := range ValidOperators {
		f.Add(string(op))
	}
	f.Add("")
	f.Add("unknown")
	f.Add("EQ")

	f.Fuzz(func(t *testing.T, s string) {
		if !utf8.ValidString(s) {
			return
		}
		// Use a string value that doubles as valid regex for the regex operator
		var val interface{} = "test"
		c := RuleCondition{Field: "f", Operator: Operator(s), Value: val}
		err := c.Validate()
		if ValidOperators[Operator(s)] && err != nil {
			t.Errorf("valid operator %q rejected: %v", s, err)
		}
		if !ValidOperators[Operator(s)] && err == nil {
			t.Errorf("invalid operator %q accepted", s)
		}
	})
}
