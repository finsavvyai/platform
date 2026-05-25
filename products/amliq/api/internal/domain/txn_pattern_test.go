package domain

import (
	"testing"
	"time"
)

func TestDetectStructuring(t *testing.T) {
	tests := []struct {
		name string
		txns []Transaction
		want bool
	}{
		{"5x $9500 is suspicious", makeStructuringTxns(5, 950000), true},
		{"3x $9500 is suspicious", makeStructuringTxns(3, 950000), true},
		{"2x below minimum count", makeStructuringTxns(2, 950000), false},
		{"normal large txns above threshold", makeStructuringTxns(5, 1500000), false},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := DetectStructuring(tt.txns, 950000, 48*time.Hour)
			if got != tt.want {
				t.Errorf("DetectStructuring=%v, want=%v", got, tt.want)
			}
		})
	}
}

func TestNewTxnPattern(t *testing.T) {
	tests := []struct {
		name    string
		pName   string
		wantErr bool
	}{
		{"valid", "Test Pattern", false},
		{"empty name", "", true},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			p, err := NewTxnPattern(tt.pName, PatternStructuring)
			if (err != nil) != tt.wantErr {
				t.Errorf("err=%v, wantErr=%v", err, tt.wantErr)
			}
			if !tt.wantErr && p.Name != tt.pName {
				t.Errorf("name=%s, want=%s", p.Name, tt.pName)
			}
		})
	}
}

func TestDefaultPatterns(t *testing.T) {
	patterns := DefaultPatterns()
	if len(patterns) != 6 {
		t.Errorf("expected 6 default patterns, got %d", len(patterns))
	}
}

func makeStructuringTxns(count int, amount int64) []Transaction {
	now := time.Now()
	txns := make([]Transaction, count)
	for i := range txns {
		txns[i] = Transaction{
			AmountCents: amount, Direction: "outbound",
			Timestamp: now.Add(time.Duration(i) * time.Hour),
		}
	}
	return txns
}
