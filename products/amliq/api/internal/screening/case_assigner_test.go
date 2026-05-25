package screening

import "testing"

func TestCaseAssignerRoundRobin(t *testing.T) {
	analysts := []Analyst{
		{ID: "a1", Name: "Alice", Level: "senior"},
		{ID: "a2", Name: "Bob", Level: "junior"},
	}
	ca := NewCaseAssigner(StrategyRoundRobin, analysts)

	first, _ := ca.Assign("medium")
	second, _ := ca.Assign("medium")
	third, _ := ca.Assign("medium")

	if first != "a1" || second != "a2" || third != "a1" {
		t.Errorf("round robin: got %s, %s, %s", first, second, third)
	}
}

func TestCaseAssignerLoadBalanced(t *testing.T) {
	analysts := []Analyst{
		{ID: "a1", OpenCases: 5},
		{ID: "a2", OpenCases: 2},
		{ID: "a3", OpenCases: 8},
	}
	ca := NewCaseAssigner(StrategyLoadBalance, analysts)

	id, _ := ca.Assign("medium")
	if id != "a2" {
		t.Errorf("load balanced should pick a2 (fewest cases), got %s", id)
	}
}

func TestCaseAssignerSkillBased(t *testing.T) {
	analysts := []Analyst{
		{ID: "a1", Level: "junior"},
		{ID: "a2", Level: "senior"},
	}
	ca := NewCaseAssigner(StrategySkillBased, analysts)

	id, _ := ca.Assign("critical")
	if id != "a2" {
		t.Errorf("skill-based critical should route to senior (a2), got %s", id)
	}
}

func TestCaseAssignerNoAnalysts(t *testing.T) {
	ca := NewCaseAssigner(StrategyRoundRobin, nil)
	_, err := ca.Assign("medium")
	if err == nil {
		t.Error("expected error with no analysts")
	}
}
