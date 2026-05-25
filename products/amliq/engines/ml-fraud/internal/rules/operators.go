package rules

import (
	"fmt"
	"regexp"
	"strings"
)

// EvaluateCondition checks whether a single condition matches against a field value.
// fieldValue is the value extracted from the transaction; condValue is from the rule.
// Returns true if the condition is satisfied.
func EvaluateCondition(op Operator, fieldValue, condValue interface{}) (bool, error) {
	switch op {
	case OpEq:
		return compareEqual(fieldValue, condValue), nil
	case OpNeq:
		return !compareEqual(fieldValue, condValue), nil
	case OpGt:
		return compareNumeric(fieldValue, condValue, func(a, b float64) bool { return a > b })
	case OpGte:
		return compareNumeric(fieldValue, condValue, func(a, b float64) bool { return a >= b })
	case OpLt:
		return compareNumeric(fieldValue, condValue, func(a, b float64) bool { return a < b })
	case OpLte:
		return compareNumeric(fieldValue, condValue, func(a, b float64) bool { return a <= b })
	case OpIn:
		return evalIn(fieldValue, condValue)
	case OpNotIn:
		result, err := evalIn(fieldValue, condValue)
		return !result, err
	case OpContains:
		return evalContains(fieldValue, condValue)
	case OpRegex:
		return evalRegex(fieldValue, condValue)
	default:
		return false, fmt.Errorf("%w: %s", ErrInvalidOperator, op)
	}
}

// --- comparison helpers ---

func compareEqual(a, b interface{}) bool {
	return fmt.Sprintf("%v", a) == fmt.Sprintf("%v", b)
}

func toFloat64(v interface{}) (float64, bool) {
	switch n := v.(type) {
	case float64:
		return n, true
	case float32:
		return float64(n), true
	case int:
		return float64(n), true
	case int64:
		return float64(n), true
	case int32:
		return float64(n), true
	default:
		return 0, false
	}
}

func compareNumeric(a, b interface{}, cmp func(float64, float64) bool) (bool, error) {
	af, ok := toFloat64(a)
	if !ok {
		return false, fmt.Errorf("field value %v is not numeric", a)
	}
	bf, ok := toFloat64(b)
	if !ok {
		return false, fmt.Errorf("condition value %v is not numeric", b)
	}
	return cmp(af, bf), nil
}

func evalIn(fieldValue, condValue interface{}) (bool, error) {
	list, ok := condValue.([]interface{})
	if !ok {
		return false, fmt.Errorf("in/not_in condition value must be a list")
	}
	fvStr := fmt.Sprintf("%v", fieldValue)
	for _, item := range list {
		if fmt.Sprintf("%v", item) == fvStr {
			return true, nil
		}
	}
	return false, nil
}

func evalContains(fieldValue, condValue interface{}) (bool, error) {
	fvStr := fmt.Sprintf("%v", fieldValue)
	cvStr := fmt.Sprintf("%v", condValue)
	return strings.Contains(fvStr, cvStr), nil
}

func evalRegex(fieldValue, condValue interface{}) (bool, error) {
	pattern, ok := condValue.(string)
	if !ok {
		return false, ErrInvalidRegex
	}
	re, err := regexp.Compile(pattern)
	if err != nil {
		return false, fmt.Errorf("%w: %v", ErrInvalidRegex, err)
	}
	return re.MatchString(fmt.Sprintf("%v", fieldValue)), nil
}
