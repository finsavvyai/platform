package screening

import (
	"context"
	"fmt"

	"github.com/aegis-aml/aegis/internal/domain"
)

// CascadeResult holds the LLM verdict on an uncertain match.
type CascadeResult struct {
	IsSameEntity bool
	Confidence   float64
	Explanation  string
}

// LLMCascade calls an LLM for uncertain screening matches.
type LLMCascade struct {
	client        LLMClient
	lowThreshold  float64
	highThreshold float64
}

// NewLLMCascade creates a cascade with configurable thresholds.
func NewLLMCascade(client LLMClient, low, high float64) *LLMCascade {
	return &LLMCascade{
		client:        client,
		lowThreshold:  low,
		highThreshold: high,
	}
}

// ShouldEvaluate returns true if score falls in the uncertain range.
func (c *LLMCascade) ShouldEvaluate(score float64) bool {
	return score >= c.lowThreshold && score <= c.highThreshold
}

// Evaluate asks the LLM whether query and candidate are the same entity.
func (c *LLMCascade) Evaluate(
	ctx context.Context,
	query string,
	candidate domain.Entity,
	score float64,
) (*CascadeResult, error) {
	if !c.ShouldEvaluate(score) {
		return nil, fmt.Errorf("score %.2f outside cascade range [%.2f, %.2f]",
			score, c.lowThreshold, c.highThreshold)
	}
	prompt := c.buildPrompt(query, candidate, score)
	resp, err := c.client.Complete(ctx, prompt)
	if err != nil {
		return nil, fmt.Errorf("llm cascade error: %w", err)
	}
	return c.parseResponse(resp), nil
}

func (c *LLMCascade) buildPrompt(
	query string, cand domain.Entity, score float64,
) string {
	candName := cand.PrimaryName().Full
	dob := "unknown"
	if cand.DOB != nil {
		dob = cand.DOB.Format("2006-01-02")
	}
	nat := "unknown"
	if len(cand.Nationalities) > 0 {
		nat = cand.Nationalities[0]
	}
	return fmt.Sprintf(
		"Are these the same entity? Query: %q vs Candidate: %q (DOB: %s, Nationality: %s, List: %s). "+
			"Current fuzzy score: %.2f. Answer YES or NO with brief reasoning.",
		query, candName, dob, nat, cand.ListID, score,
	)
}

func (c *LLMCascade) parseResponse(resp string) *CascadeResult {
	isSame := len(resp) >= 3 && (resp[:3] == "YES" || resp[:3] == "yes" || resp[:3] == "Yes")
	conf := 0.5
	if isSame {
		conf = 0.85
	} else {
		conf = 0.15
	}
	return &CascadeResult{
		IsSameEntity: isSame,
		Confidence:   conf,
		Explanation:  resp,
	}
}
