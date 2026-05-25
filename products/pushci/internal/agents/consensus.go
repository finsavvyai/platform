package agents

// ConsensusResult holds the outcome of a multi-agent vote.
type ConsensusResult struct {
	Agreed   bool
	Majority string
	Votes    map[string]int
}

// EvaluateConsensus aggregates agent results using the given strategy.
func EvaluateConsensus(results []AgentResult, strategy string) ConsensusResult {
	if strategy == "race" {
		return evaluateRace(results)
	}
	return evaluateMajority(results)
}

func evaluateRace(results []AgentResult) ConsensusResult {
	var fastest *AgentResult
	for i := range results {
		if fastest == nil || results[i].Duration < fastest.Duration {
			fastest = &results[i]
		}
	}
	if fastest == nil {
		return ConsensusResult{Agreed: false, Majority: "none", Votes: nil}
	}
	outcome := "pass"
	if !fastest.Success {
		outcome = "fail"
	}
	return ConsensusResult{
		Agreed:   true,
		Majority: outcome,
		Votes:    map[string]int{outcome: 1},
	}
}

func evaluateMajority(results []AgentResult) ConsensusResult {
	votes := map[string]int{"pass": 0, "fail": 0}
	for _, r := range results {
		if r.Success {
			votes["pass"]++
		} else {
			votes["fail"]++
		}
	}
	majority := "pass"
	if votes["fail"] > votes["pass"] {
		majority = "fail"
	}
	agreed := votes["pass"] == len(results) || votes["fail"] == len(results)
	return ConsensusResult{
		Agreed:   agreed,
		Majority: majority,
		Votes:    votes,
	}
}
