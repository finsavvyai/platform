package domain

import "testing"

func TestEvaluateHighValue(t *testing.T) {
	tests := []struct {
		name      string
		amount    int64
		threshold int64
		want      bool
	}{
		{"over threshold", 1500000, 1000000, true},
		{"at threshold", 1000000, 1000000, true},
		{"under threshold", 500000, 1000000, false},
		{"zero amount", 0, 1000000, false},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			txn := Transaction{AmountCents: tt.amount}
			rule := TxnRule{ThresholdCents: tt.threshold}
			got := EvaluateHighValue(txn, rule)
			if got != tt.want {
				t.Errorf("EvaluateHighValue=%v, want=%v", got, tt.want)
			}
		})
	}
}

func TestEvaluateHighRiskCountry(t *testing.T) {
	tests := []struct {
		country string
		want    bool
	}{
		{"IR", true},
		{"KP", true},
		{"SY", true},
		{"US", false},
		{"GB", false},
		{"", false},
	}
	for _, tt := range tests {
		t.Run(tt.country, func(t *testing.T) {
			txn := Transaction{Country: tt.country}
			got := EvaluateHighRiskCountry(txn)
			if got != tt.want {
				t.Errorf("EvaluateHighRiskCountry(%s)=%v, want=%v",
					tt.country, got, tt.want)
			}
		})
	}
}

func TestDefaultTxnRules(t *testing.T) {
	tid, _ := NewTenantID("tnt_aabbccddee11")
	rules := DefaultTxnRules(tid)
	if len(rules) != 4 {
		t.Errorf("expected 4 default rules, got %d", len(rules))
	}
	for _, r := range rules {
		if !r.Enabled {
			t.Errorf("rule %s should be enabled", r.Name)
		}
	}
}
