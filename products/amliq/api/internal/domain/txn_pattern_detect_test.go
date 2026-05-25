package domain

import (
	"testing"
	"time"
)

func TestDetectRapidMovement(t *testing.T) {
	now := time.Now()
	tests := []struct {
		name string
		txns []Transaction
		want bool
	}{
		{
			"in then out within 24h",
			[]Transaction{
				{Direction: "inbound", AmountCents: 500000, Timestamp: now},
				{Direction: "outbound", AmountCents: 490000, Timestamp: now.Add(6 * time.Hour)},
			},
			true,
		},
		{
			"only inbound",
			[]Transaction{
				{Direction: "inbound", AmountCents: 500000, Timestamp: now},
				{Direction: "inbound", AmountCents: 300000, Timestamp: now.Add(2 * time.Hour)},
			},
			false,
		},
		{
			"out before in does not match",
			[]Transaction{
				{Direction: "outbound", AmountCents: 500000, Timestamp: now},
			},
			false,
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := DetectRapidMovement(tt.txns, 24*time.Hour)
			if got != tt.want {
				t.Errorf("DetectRapidMovement=%v, want=%v", got, tt.want)
			}
		})
	}
}

func TestClassifySeverity(t *testing.T) {
	tests := []struct {
		score int
		want  MonitorAlertSeverity
	}{
		{10, SeverityCritical},
		{9, SeverityCritical},
		{7, SeverityHigh},
		{5, SeverityMedium},
		{2, SeverityLow},
	}
	for _, tt := range tests {
		got := ClassifySeverity(tt.score)
		if got != tt.want {
			t.Errorf("ClassifySeverity(%d)=%s, want=%s", tt.score, got, tt.want)
		}
	}
}
