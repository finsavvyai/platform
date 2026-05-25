package domain

import "testing"

func TestNewTxnAlert(t *testing.T) {
	tests := []struct {
		name    string
		tenant  string
		txnID   string
		wantErr bool
	}{
		{"valid", "tnt_aabbccddee11", "txn_1", false},
		{"empty tenant", "", "txn_1", true},
		{"empty txn", "tnt_aabbccddee11", "", true},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			tid, _ := NewTenantID(tt.tenant)
			alert, err := NewTxnAlert(tid, tt.txnID, TxnHighValue, 7, "test")
			if (err != nil) != tt.wantErr {
				t.Errorf("err=%v, wantErr=%v", err, tt.wantErr)
			}
			if !tt.wantErr {
				if alert.AlertType != TxnHighValue {
					t.Errorf("type=%s, want high_value", alert.AlertType)
				}
				if alert.Severity != 7 {
					t.Errorf("severity=%d, want 7", alert.Severity)
				}
			}
		})
	}
}
