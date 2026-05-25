package domain

import (
	"fmt"
	"time"
)

type ScreenResponse struct {
	ID             string
	Request        ScreenRequest
	Matches        []MatchResult
	ProcessingTime time.Duration
	Timestamp      time.Time
}

func NewScreenResponse(req ScreenRequest) ScreenResponse {
	return ScreenResponse{
		ID:        "res_" + fmt.Sprintf("%d", time.Now().UnixNano()),
		Request:   req,
		Matches:   []MatchResult{},
		Timestamp: time.Now().UTC(),
	}
}

func (sr ScreenResponse) HasMatches() bool {
	return len(sr.Matches) > 0
}

func (sr ScreenResponse) CriticalMatches() []MatchResult {
	var critical []MatchResult
	for _, m := range sr.Matches {
		if m.IsCritical() {
			critical = append(critical, m)
		}
	}
	return critical
}

func (sr ScreenResponse) MaxConfidence() float64 {
	if len(sr.Matches) == 0 {
		return 0.0
	}
	max := sr.Matches[0].Confidence.Score()
	for _, m := range sr.Matches[1:] {
		if m.Confidence.Score() > max {
			max = m.Confidence.Score()
		}
	}
	return max
}
