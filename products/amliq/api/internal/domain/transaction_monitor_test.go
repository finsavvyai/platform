package domain

import "testing"

func TestNewTransaction(t *testing.T) {
	tid, _ := NewTenantID("tnt_abcdefghijkl")
	txn := Transaction{
		ID: "txn_1", TenantID: tid, EntityID: "ent_1",
		AmountCents: 500000, Currency: "USD",
		Direction: "outbound", Country: "IR",
	}
	if txn.AmountCents != 500000 {
		t.Errorf("amount = %d, want 500000", txn.AmountCents)
	}
	if txn.Country != "IR" {
		t.Errorf("country = %s, want IR", txn.Country)
	}
}

func TestTxnAlertTypes(t *testing.T) {
	tests := []struct {
		name      string
		alertType TxnAlertType
		want      string
	}{
		{"high value", TxnHighValue, "high_value"},
		{"rapid movement", TxnRapidMovement, "rapid_movement"},
		{"structuring", TxnStructuring, "structuring"},
		{"high risk country", TxnHighRiskCountry, "high_risk_country"},
		{"unusual pattern", TxnUnusualPattern, "unusual_pattern"},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if string(tt.alertType) != tt.want {
				t.Errorf("type = %s, want %s", tt.alertType, tt.want)
			}
		})
	}
}

func TestNewTxnAlertValidation(t *testing.T) {
	tid, _ := NewTenantID("tnt_abcdefghijkl")
	tests := []struct {
		name    string
		tenant  TenantID
		txnID   string
		wantErr bool
	}{
		{"valid", tid, "txn_1", false},
		{"zero tenant", TenantID{}, "txn_1", true},
		{"empty txn", tid, "", true},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			alert, err := NewTxnAlert(tt.tenant, tt.txnID, TxnHighValue, 8, "test")
			if tt.wantErr {
				if err == nil {
					t.Fatal("expected error")
				}
				return
			}
			if err != nil {
				t.Fatalf("unexpected: %v", err)
			}
			if alert.Severity != 8 {
				t.Errorf("severity = %d, want 8", alert.Severity)
			}
		})
	}
}
