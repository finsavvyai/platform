// Package testutil provides test data factories for fraud-detection service.
// Use these factories to create consistent test data with sensible defaults.
//
// Usage:
//
//	tx := testutil.NewTestTransaction()
//	tx.Amount = decimal.NewFromFloat(999.99) // override specific fields
//	result := testutil.NewTestFraudResult()
//	cfg := testutil.NewTestConfig()
package testutil

import (
	"fmt"
	"math/rand"
	"time"

	"github.com/shopspring/decimal"
	"quantumbeam/internal/config"
	"quantumbeam/internal/models"
)

// NewTestTransaction returns a valid TransactionData with defaults.
func NewTestTransaction() *models.TransactionData {
	id := fmt.Sprintf("txn-%d", rand.Intn(999999))
	return &models.TransactionData{
		TransactionID: id,
		Amount:        decimal.NewFromFloat(150.00),
		Timestamp:     time.Now().Add(-5 * time.Minute),
		MerchantID:    "merchant-001",
		UserID:        "user-001",
		PaymentMethod: "credit_card",
		Features:      map[string]float64{"velocity": 1.0},
		CreatedAt:     time.Now(),
		UpdatedAt:     time.Now(),
	}
}

// NewTestFraudResult returns a valid FraudResult with defaults.
func NewTestFraudResult() *models.FraudResult {
	return &models.FraudResult{
		TransactionID:    "txn-test-001",
		FraudScore:       0.25,
		RiskLevel:        models.RiskLevelLow,
		ProcessingMethod: models.ProcessingMethodClassical,
		Confidence:       0.85,
		ProcessingTimeMs: 45,
		Explanation:      []string{"Normal transaction pattern"},
		ModelVersion:     "v1.0.0-test",
		CreatedAt:        time.Now(),
		UpdatedAt:        time.Now(),
	}
}

// NewHighRiskFraudResult returns a FraudResult with critical risk.
func NewHighRiskFraudResult() *models.FraudResult {
	qa := 0.15
	return &models.FraudResult{
		TransactionID:    "txn-test-high",
		FraudScore:       0.92,
		RiskLevel:        models.RiskLevelCritical,
		ProcessingMethod: models.ProcessingMethodQuantum,
		Confidence:       0.95,
		ProcessingTimeMs: 120,
		QuantumAdvantage: &qa,
		Explanation: []string{
			"High amount anomaly",
			"Unusual time pattern",
			"New device detected",
		},
		ModelVersion: "v1.0.0-test",
		CreatedAt:    time.Now(),
		UpdatedAt:    time.Now(),
	}
}

// NewTestConfig returns a minimal development config.
func NewTestConfig() *config.Config {
	return &config.Config{
		Server: config.ServerConfig{
			Host: "localhost",
			Port: 8080,
		},
		Database: config.DatabaseConfig{
			Host:     "localhost",
			Port:     5432,
			User:     "test",
			Password: "test",
			DBName:   "testdb",
			SSLMode:  "disable",
		},
		Redis: config.RedisConfig{
			Host: "localhost",
			Port: 6379,
		},
	}
}

// NewMockQuantumResult returns mock quantum processing data.
func NewMockQuantumResult() map[string]interface{} {
	return map[string]interface{}{
		"probabilities": map[string]float64{
			"fraud":     0.15,
			"not_fraud": 0.85,
		},
		"circuit_depth":     12,
		"num_qubits":        4,
		"backend":           "test-simulator",
		"processing_ms":     45,
		"quantum_advantage": 0.08,
	}
}

// NewTestTransactionBatch creates n test transactions.
func NewTestTransactionBatch(n int) []*models.TransactionData {
	txns := make([]*models.TransactionData, n)
	for i := 0; i < n; i++ {
		tx := NewTestTransaction()
		tx.TransactionID = fmt.Sprintf("txn-batch-%d", i)
		tx.Amount = decimal.NewFromFloat(float64(50 + i*25))
		txns[i] = tx
	}
	return txns
}
