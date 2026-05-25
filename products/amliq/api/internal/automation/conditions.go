package automation

import (
	"strconv"
	"strings"
)

// evaluateConditions returns true if ALL conditions match (AND logic).
// Empty conditions list = always match.
func (e *Executor) evaluateConditions(
	conds []Condition, evt EventContext,
) bool {
	for _, c := range conds {
		if !evalCondition(c, evt) {
			return false
		}
	}
	return true
}

func evalCondition(c Condition, evt EventContext) bool {
	fieldVal := fieldValue(c.Field, evt)
	switch c.Operator {
	case "eq", "==":
		return fieldVal == c.Value
	case "ne", "!=":
		return fieldVal != c.Value
	case "gte", ">=":
		return compareNumeric(fieldVal, c.Value) >= 0
	case "lte", "<=":
		return compareNumeric(fieldVal, c.Value) <= 0
	case "gt", ">":
		return compareNumeric(fieldVal, c.Value) > 0
	case "lt", "<":
		return compareNumeric(fieldVal, c.Value) < 0
	case "in":
		for _, v := range strings.Split(c.Value, ",") {
			if fieldVal == strings.TrimSpace(v) {
				return true
			}
		}
		return false
	case "contains":
		return strings.Contains(fieldVal, c.Value)
	}
	return false
}

func fieldValue(field string, evt EventContext) string {
	switch field {
	case "entity_name":
		return evt.EntityName
	case "score":
		return strconv.FormatFloat(evt.Score, 'f', 4, 64)
	case "list":
		return evt.ListID
	case "subject":
		return evt.Subject
	}
	return ""
}

func compareNumeric(a, b string) int {
	fa, errA := strconv.ParseFloat(a, 64)
	fb, errB := strconv.ParseFloat(b, 64)
	if errA != nil || errB != nil {
		return strings.Compare(a, b)
	}
	switch {
	case fa < fb:
		return -1
	case fa > fb:
		return 1
	}
	return 0
}
