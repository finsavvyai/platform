package domain

import (
	"fmt"
	"time"
)

type MatchResult struct {
	EntityID     EntityID
	Confidence   Confidence
	Disposition  Disposition
	Evidence     []MatchEvidence
	ExplainChain string
	ListID       string
	TimestampHit time.Time
}

func NewMatchResult(
	eid EntityID,
	conf Confidence,
	disp Disposition,
	evidence []MatchEvidence,
	explain string,
	listID string,
) MatchResult {
	return MatchResult{
		EntityID:     eid,
		Confidence:   conf,
		Disposition:  disp,
		Evidence:     evidence,
		ExplainChain: explain,
		ListID:       listID,
		TimestampHit: time.Now().UTC(),
	}
}

func (mr MatchResult) IsCritical() bool {
	return mr.Confidence.Score() > 0.95
}

func (mr MatchResult) String() string {
	return fmt.Sprintf("Match(%s, %.2f)", mr.EntityID.String(), mr.Confidence.Score())
}
