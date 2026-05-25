package agent

import (
	"context"
	"testing"
)

func TestTransactionBlocker(t *testing.T) {
	tests := []struct {
		name       string
		matches    []MatchStatus
		customerID string
		txnAmount  float64
		wantBlock  bool
		wantReview bool
		wantReason string
	}{
		{
			name: "blocked on active match",
			matches: []MatchStatus{
				{MatchID: "m1", CustomerID: "c1", Active: true},
			},
			customerID: "c1",
			txnAmount:  1000,
			wantBlock:  true,
			wantReason: "active match: m1",
		},
		{
			name: "allowed on resolved false positive",
			matches: []MatchStatus{
				{MatchID: "m2", CustomerID: "c2", Active: false, Resolved: true, FalsePos: true},
			},
			customerID: "c2",
			txnAmount:  5000,
			wantBlock:  false,
			wantReason: "all matches resolved as false positive",
		},
		{
			name: "blocked on escalated case",
			matches: []MatchStatus{
				{MatchID: "m3", CustomerID: "c3", Active: true, Escalated: true},
			},
			customerID: "c3",
			txnAmount:  2000,
			wantBlock:  true,
			wantReview: true,
			wantReason: "escalated match pending review",
		},
		{
			name:       "no matches allows transaction",
			matches:    nil,
			customerID: "c4",
			txnAmount:  100,
			wantBlock:  false,
			wantReason: "no matches",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			tb := NewTransactionBlocker()
			for _, ms := range tt.matches {
				tb.AddMatch(ms)
			}
			dec, err := tb.CheckTransaction(context.Background(), tt.customerID, tt.txnAmount)
			if err != nil {
				t.Fatalf("unexpected error: %v", err)
			}
			if dec.Blocked != tt.wantBlock {
				t.Errorf("blocked = %v, want %v", dec.Blocked, tt.wantBlock)
			}
			if dec.RequiresReview != tt.wantReview {
				t.Errorf("review = %v, want %v", dec.RequiresReview, tt.wantReview)
			}
			if dec.Reason != tt.wantReason {
				t.Errorf("reason = %q, want %q", dec.Reason, tt.wantReason)
			}
		})
	}
}
