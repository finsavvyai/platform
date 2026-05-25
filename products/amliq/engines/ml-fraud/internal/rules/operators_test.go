package rules

import (
	"testing"
)

func TestEvaluateCondition_Eq(t *testing.T) {
	cases := []struct {
		fv, cv interface{}
		want   bool
	}{
		{100.0, 100.0, true},
		{100.0, 200.0, false},
		{"abc", "abc", true},
		{"abc", "xyz", false},
	}
	for _, tc := range cases {
		got, err := EvaluateCondition(OpEq, tc.fv, tc.cv)
		if err != nil {
			t.Fatalf("eq error: %v", err)
		}
		if got != tc.want {
			t.Errorf("eq(%v, %v) = %v, want %v", tc.fv, tc.cv, got, tc.want)
		}
	}
}

func TestEvaluateCondition_Neq(t *testing.T) {
	got, _ := EvaluateCondition(OpNeq, "a", "b")
	if !got {
		t.Fatal("a != b should be true")
	}
	got, _ = EvaluateCondition(OpNeq, "a", "a")
	if got {
		t.Fatal("a != a should be false")
	}
}

func TestEvaluateCondition_NumericComparisons(t *testing.T) {
	cases := []struct {
		op   Operator
		a, b float64
		want bool
	}{
		{OpGt, 200, 100, true},
		{OpGt, 100, 200, false},
		{OpGte, 100, 100, true},
		{OpGte, 99, 100, false},
		{OpLt, 50, 100, true},
		{OpLt, 100, 50, false},
		{OpLte, 100, 100, true},
		{OpLte, 101, 100, false},
	}
	for _, tc := range cases {
		got, err := EvaluateCondition(tc.op, tc.a, tc.b)
		if err != nil {
			t.Fatalf("%s error: %v", tc.op, err)
		}
		if got != tc.want {
			t.Errorf("%s(%.0f, %.0f) = %v, want %v", tc.op, tc.a, tc.b, got, tc.want)
		}
	}
}

func TestEvaluateCondition_NumericIntTypes(t *testing.T) {
	got, err := EvaluateCondition(OpGt, int(200), int64(100))
	if err != nil || !got {
		t.Fatal("int vs int64 comparison should work")
	}
	got, err = EvaluateCondition(OpGt, int32(50), float32(40.0))
	if err != nil || !got {
		t.Fatal("int32 vs float32 comparison should work")
	}
}

func TestEvaluateCondition_NumericNonNumericError(t *testing.T) {
	_, err := EvaluateCondition(OpGt, "not-a-number", 100.0)
	if err == nil {
		t.Fatal("non-numeric field should error")
	}
}

func TestEvaluateCondition_In(t *testing.T) {
	list := []interface{}{"credit_card", "debit_card"}
	got, _ := EvaluateCondition(OpIn, "credit_card", list)
	if !got {
		t.Fatal("credit_card should be in list")
	}
	got, _ = EvaluateCondition(OpIn, "wire_transfer", list)
	if got {
		t.Fatal("wire_transfer should not be in list")
	}
}

func TestEvaluateCondition_NotIn(t *testing.T) {
	list := []interface{}{"US", "CA"}
	got, _ := EvaluateCondition(OpNotIn, "RU", list)
	if !got {
		t.Fatal("RU should be not in [US, CA]")
	}
	got, _ = EvaluateCondition(OpNotIn, "US", list)
	if got {
		t.Fatal("US should fail not_in [US, CA]")
	}
}

func TestEvaluateCondition_InBadType(t *testing.T) {
	_, err := EvaluateCondition(OpIn, "x", "not-a-list")
	if err == nil {
		t.Fatal("non-list condition value should error")
	}
}

func TestEvaluateCondition_Contains(t *testing.T) {
	got, _ := EvaluateCondition(OpContains, "hello world", "world")
	if !got {
		t.Fatal("should contain 'world'")
	}
	got, _ = EvaluateCondition(OpContains, "hello", "xyz")
	if got {
		t.Fatal("should not contain 'xyz'")
	}
}

func TestEvaluateCondition_Regex(t *testing.T) {
	got, _ := EvaluateCondition(OpRegex, "MER-12345", `^MER-\d+$`)
	if !got {
		t.Fatal("should match regex")
	}
	got, _ = EvaluateCondition(OpRegex, "INVALID", `^MER-\d+$`)
	if got {
		t.Fatal("should not match regex")
	}
}

func TestEvaluateCondition_RegexInvalidPattern(t *testing.T) {
	_, err := EvaluateCondition(OpRegex, "x", `[invalid`)
	if err == nil {
		t.Fatal("bad regex should error")
	}
}

func TestEvaluateCondition_RegexNonStringValue(t *testing.T) {
	_, err := EvaluateCondition(OpRegex, "x", 123)
	if err == nil {
		t.Fatal("non-string regex value should error")
	}
}

func TestEvaluateCondition_InvalidOperator(t *testing.T) {
	_, err := EvaluateCondition("bad_op", "a", "b")
	if err == nil {
		t.Fatal("invalid operator should error")
	}
}
