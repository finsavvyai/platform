package gdpr

import "testing"

func TestDefaultRetentionPolicy(t *testing.T) {
	tests := []struct {
		name     string
		field    int
		expected int
	}{
		{"screening retention is 90 days", DefaultRetentionPolicy().ScreeningRetention, 90},
		{"alert retention is 365 days", DefaultRetentionPolicy().AlertRetention, 365},
		{"audit retention is 7 years", DefaultRetentionPolicy().AuditRetention, 2555},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if tt.field != tt.expected {
				t.Errorf("got %d, want %d", tt.field, tt.expected)
			}
		})
	}
}

func TestPseudonymize(t *testing.T) {
	tests := []struct {
		name       string
		customerID string
		salt       string
	}{
		{"basic pseudonymization", "CUST-001", "secret-salt"},
		{"different customer", "CUST-002", "secret-salt"},
		{"different salt", "CUST-001", "other-salt"},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			record := CustomerRecord{
				CustomerID: tt.customerID,
				Name:       "John Doe",
				Address:    "123 Main St",
				Phone:      "+1-555-0100",
				Email:      "john@example.com",
				SSN:        "123-45-6789",
			}
			result := Pseudonymize(record, tt.salt)
			if result.RefHash == "" {
				t.Fatal("ref hash should not be empty")
			}
			if result.RefHash == tt.customerID {
				t.Error("ref hash should differ from customer ID")
			}
			if result.Name != "John Doe" {
				t.Error("name should be preserved for screening")
			}
		})
	}
}

func TestDeanonymizeVerify(t *testing.T) {
	tests := []struct {
		name       string
		customerID string
		salt       string
	}{
		{"roundtrip verify", "CUST-001", "salt123"},
		{"another customer", "CUST-XYZ", "pepper"},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			hash := Deanonymize(tt.customerID, tt.salt)
			if !VerifyIdentity(tt.customerID, hash, tt.salt) {
				t.Error("verify should return true for matching customer")
			}
			if VerifyIdentity("wrong-id", hash, tt.salt) {
				t.Error("verify should return false for wrong customer")
			}
		})
	}
}

func TestErasureReportFields(t *testing.T) {
	report := &ErasureReport{
		CustomerID:        "CUST-001",
		ScreeningsDeleted: 5,
		AlertsDeleted:     2,
		CasesAnonymized:   1,
		AuditRetained:     10,
	}
	tests := []struct {
		name  string
		got   int
		want  int
	}{
		{"screenings deleted", report.ScreeningsDeleted, 5},
		{"alerts deleted", report.AlertsDeleted, 2},
		{"cases anonymized", report.CasesAnonymized, 1},
		{"audit retained", report.AuditRetained, 10},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if tt.got != tt.want {
				t.Errorf("got %d, want %d", tt.got, tt.want)
			}
		})
	}
}
