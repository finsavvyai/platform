package screening

import "fmt"

// AssignmentStrategy determines how cases are distributed to analysts.
type AssignmentStrategy string

const (
	StrategyRoundRobin  AssignmentStrategy = "round_robin"
	StrategyLoadBalance AssignmentStrategy = "load_balanced"
	StrategySkillBased  AssignmentStrategy = "skill_based"
)

// CaseAssigner routes new cases to available analysts.
type CaseAssigner struct {
	strategy     AssignmentStrategy
	analysts     []Analyst
	roundRobinAt int
}

// Analyst represents a team member who handles cases.
type Analyst struct {
	ID        string
	Name      string
	Level     string // senior, junior
	OpenCases int
}

func NewCaseAssigner(strategy AssignmentStrategy, analysts []Analyst) *CaseAssigner {
	return &CaseAssigner{strategy: strategy, analysts: analysts}
}

// Assign picks the next analyst based on strategy.
func (ca *CaseAssigner) Assign(priority string) (string, error) {
	if len(ca.analysts) == 0 {
		return "", fmt.Errorf("no analysts available")
	}
	switch ca.strategy {
	case StrategyRoundRobin:
		return ca.roundRobin(), nil
	case StrategyLoadBalance:
		return ca.loadBalanced(), nil
	case StrategySkillBased:
		return ca.skillBased(priority), nil
	default:
		return ca.roundRobin(), nil
	}
}

func (ca *CaseAssigner) roundRobin() string {
	analyst := ca.analysts[ca.roundRobinAt%len(ca.analysts)]
	ca.roundRobinAt++
	return analyst.ID
}

func (ca *CaseAssigner) loadBalanced() string {
	min := ca.analysts[0]
	for _, a := range ca.analysts[1:] {
		if a.OpenCases < min.OpenCases {
			min = a
		}
	}
	return min.ID
}

func (ca *CaseAssigner) skillBased(priority string) string {
	if priority == "critical" || priority == "high" {
		for _, a := range ca.analysts {
			if a.Level == "senior" {
				return a.ID
			}
		}
	}
	return ca.roundRobin()
}
