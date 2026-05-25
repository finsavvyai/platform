package domain

import "fmt"

type BatchResult struct {
	BatchID    string
	EntityName string
	MatchCount int
	TopMatch   string
	Confidence float64
	ListID     string
}

func NewBatchResult(batchID, name string, matchCount int, topMatch string, conf float64, listID string) BatchResult {
	return BatchResult{
		BatchID:    batchID,
		EntityName: name,
		MatchCount: matchCount,
		TopMatch:   topMatch,
		Confidence: conf,
		ListID:     listID,
	}
}

func (br BatchResult) String() string {
	return fmt.Sprintf("%s: %d matches (top=%.2f)", br.EntityName, br.MatchCount, br.Confidence)
}
