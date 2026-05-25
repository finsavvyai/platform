package agent

import (
	"context"
	"fmt"
	"sync"
)

// BlockDecision is the outcome of a transaction block check.
type BlockDecision struct {
	Blocked        bool
	Reason         string
	MatchID        string
	RequiresReview bool
}

// MatchStatus tracks the resolution state of a customer match.
type MatchStatus struct {
	MatchID    string
	CustomerID string
	Active     bool
	Resolved   bool
	FalsePos   bool
	Escalated  bool
}

// TransactionBlocker checks transactions against active matches.
type TransactionBlocker struct {
	mu       sync.RWMutex
	matches  map[string][]MatchStatus // customerID → match statuses
}

// NewTransactionBlocker creates a new blocker instance.
func NewTransactionBlocker() *TransactionBlocker {
	return &TransactionBlocker{
		matches: make(map[string][]MatchStatus),
	}
}

// AddMatch registers a match status for a customer.
func (tb *TransactionBlocker) AddMatch(ms MatchStatus) {
	tb.mu.Lock()
	defer tb.mu.Unlock()
	tb.matches[ms.CustomerID] = append(tb.matches[ms.CustomerID], ms)
}

// CheckTransaction determines if a transaction should be blocked.
func (tb *TransactionBlocker) CheckTransaction(
	_ context.Context, customerID string, txnAmount float64,
) (*BlockDecision, error) {
	if customerID == "" {
		return nil, fmt.Errorf("customer ID required")
	}
	tb.mu.RLock()
	statuses := tb.matches[customerID]
	tb.mu.RUnlock()

	if len(statuses) == 0 {
		return &BlockDecision{Blocked: false, Reason: "no matches"}, nil
	}

	for _, ms := range statuses {
		if ms.Escalated {
			return &BlockDecision{
				Blocked:        true,
				Reason:         "escalated match pending review",
				MatchID:        ms.MatchID,
				RequiresReview: true,
			}, nil
		}
		if ms.Active && !ms.Resolved {
			return &BlockDecision{
				Blocked:        true,
				Reason:         fmt.Sprintf("active match: %s", ms.MatchID),
				MatchID:        ms.MatchID,
				RequiresReview: false,
			}, nil
		}
	}
	// All matches resolved as false positive.
	return &BlockDecision{
		Blocked: false,
		Reason:  "all matches resolved as false positive",
	}, nil
}

// ResolveMatch marks a match as resolved (false positive or confirmed).
func (tb *TransactionBlocker) ResolveMatch(
	customerID, matchID string, falsePositive bool,
) {
	tb.mu.Lock()
	defer tb.mu.Unlock()
	for i, ms := range tb.matches[customerID] {
		if ms.MatchID == matchID {
			tb.matches[customerID][i].Resolved = true
			tb.matches[customerID][i].Active = false
			tb.matches[customerID][i].FalsePos = falsePositive
		}
	}
}
