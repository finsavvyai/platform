package screening

import (
	"context"
	"testing"
	"time"

	"github.com/aegis-aml/aegis/internal/domain"
)

func TestTxnAnalyzer_Structuring(t *testing.T) {
	analyzer := NewDefaultTxnAnalyzer()
	tid, _ := domain.NewTenantID("tnt_aabbccddee11")
	now := time.Now()
	txns := make([]domain.Transaction, 5)
	for i := range txns {
		txns[i] = domain.Transaction{
			ID: "txn_struct", TenantID: tid,
			AmountCents: 950000, Direction: "outbound",
			Timestamp: now.Add(time.Duration(i) * time.Hour),
		}
	}
	profile := CustomerProfile{EntityID: "ent_1", AvgMonthlyTxns: 10, AvgMonthlyAmt: 5000000}
	alerts, err := analyzer.Analyze(context.Background(), txns, profile)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	found := false
	for _, a := range alerts {
		if a.AlertType == domain.TxnStructuring {
			found = true
		}
	}
	if !found {
		t.Error("expected structuring alert, got none")
	}
}

func TestTxnAnalyzer_NormalNotFlagged(t *testing.T) {
	analyzer := NewDefaultTxnAnalyzer()
	tid, _ := domain.NewTenantID("tnt_aabbccddee11")
	now := time.Now()
	txns := []domain.Transaction{
		{
			ID: "txn_normal", TenantID: tid,
			AmountCents: 50000, Direction: "outbound",
			Timestamp: now, Country: "US",
		},
	}
	profile := CustomerProfile{
		EntityID: "ent_1", AvgMonthlyTxns: 10,
		AvgMonthlyAmt: 500000, LastActivityAt: now.Add(-24 * time.Hour),
	}
	alerts, err := analyzer.Analyze(context.Background(), txns, profile)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(alerts) != 0 {
		t.Errorf("expected no alerts for normal txns, got %d", len(alerts))
	}
}

func TestTxnAnalyzer_HighRiskCountry(t *testing.T) {
	analyzer := NewDefaultTxnAnalyzer()
	tid, _ := domain.NewTenantID("tnt_aabbccddee11")
	txns := []domain.Transaction{
		{
			ID: "txn_risk", TenantID: tid,
			AmountCents: 100000, Direction: "outbound",
			Country: "IR", Timestamp: time.Now(),
		},
	}
	profile := CustomerProfile{EntityID: "ent_1", AvgMonthlyTxns: 5}
	alerts, err := analyzer.Analyze(context.Background(), txns, profile)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	found := false
	for _, a := range alerts {
		if a.AlertType == domain.TxnHighRiskCountry {
			found = true
		}
	}
	if !found {
		t.Error("expected high-risk country alert for IR")
	}
}

func TestTxnAnalyzer_EmptyTxns(t *testing.T) {
	analyzer := NewDefaultTxnAnalyzer()
	alerts, err := analyzer.Analyze(context.Background(), nil, CustomerProfile{})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(alerts) != 0 {
		t.Errorf("expected no alerts for empty txns, got %d", len(alerts))
	}
}
