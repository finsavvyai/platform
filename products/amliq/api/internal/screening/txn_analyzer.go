package screening

import (
	"context"
	"time"

	"github.com/aegis-aml/aegis/internal/domain"
)

// CustomerProfile holds baseline metrics for anomaly detection.
type CustomerProfile struct {
	EntityID       string
	AvgMonthlyTxns int
	AvgMonthlyAmt  int64
	LastActivityAt time.Time
	Countries      []string
}

// TxnAnalyzer applies pattern-based detection to transactions.
type TxnAnalyzer struct {
	patterns []domain.TxnPattern
}

// NewTxnAnalyzer creates an analyzer with the given patterns.
func NewTxnAnalyzer(patterns []domain.TxnPattern) *TxnAnalyzer {
	return &TxnAnalyzer{patterns: patterns}
}

// NewDefaultTxnAnalyzer creates an analyzer with built-in patterns.
func NewDefaultTxnAnalyzer() *TxnAnalyzer {
	return &TxnAnalyzer{patterns: domain.DefaultPatterns()}
}

// Analyze checks transactions against all registered patterns.
func (a *TxnAnalyzer) Analyze(
	_ context.Context,
	txns []domain.Transaction,
	profile CustomerProfile,
) ([]domain.TxnAlert, error) {
	if len(txns) == 0 {
		return nil, nil
	}
	var alerts []domain.TxnAlert
	for _, p := range a.patterns {
		alert, matched := a.evaluate(p, txns, profile)
		if matched {
			alerts = append(alerts, alert)
		}
	}
	return alerts, nil
}

