package fraud

import (
	"testing"
	"time"

	"github.com/shopspring/decimal"
	"github.com/stretchr/testify/assert"
	"quantumbeam/internal/models"
)

func TestCalculateClassicalFraudScore(t *testing.T) {
	svc := NewService(nil, nil)
	tests := []struct {
		name     string
		amount   float64
		hour     int
		method   string
		risk     float64
		hasRisk  bool
		minScore float64
		maxScore float64
	}{
		{"low_risk", 100.0, 14, "bank_transfer", 0, false, 0.0, 0.1},
		{"high_amount", 15000.0, 14, "bank_transfer", 0, false, 0.25, 0.35},
		{"medium_amount", 5000.0, 14, "bank_transfer", 0, false, 0.05, 0.15},
		{"late_night", 100.0, 2, "bank_transfer", 0, false, 0.15, 0.25},
		{"digital_wallet", 100.0, 14, "digital_wallet", 0, false, 0.05, 0.15},
		{"credit_card", 100.0, 14, "credit_card", 0, false, 0.0, 0.1},
		{"with_risk", 100.0, 14, "bank_transfer", 1.0, true, 0.35, 0.45},
		{"all_factors", 15000.0, 3, "digital_wallet", 1.0, true, 0.9, 1.0},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			tx := &models.TransactionData{
				TransactionID: "score_test",
				Amount:        decimal.NewFromFloat(tt.amount),
				Timestamp:     time.Date(2026, 1, 1, tt.hour, 0, 0, 0, time.UTC),
				PaymentMethod: tt.method,
			}
			if tt.hasRisk {
				tx.Features = map[string]float64{"risk_indicator": tt.risk}
			}
			score := svc.calculateClassicalFraudScore(tx)
			assert.GreaterOrEqual(t, score, tt.minScore)
			assert.LessOrEqual(t, score, tt.maxScore)
		})
	}
}

func TestCalculateRiskLevel(t *testing.T) {
	svc := NewService(nil, nil)
	tests := []struct {
		score    float64
		expected string
	}{
		{0.9, "critical"}, {0.8, "critical"},
		{0.7, "high"}, {0.6, "high"},
		{0.5, "medium"}, {0.3, "medium"},
		{0.2, "low"}, {0.0, "low"},
	}
	for _, tt := range tests {
		assert.Equal(t, tt.expected, svc.calculateRiskLevel(tt.score), "score %.1f", tt.score)
	}
}
