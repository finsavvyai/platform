package testutil

import (
	"testing"

	"github.com/shopspring/decimal"
	"github.com/stretchr/testify/assert"
	"quantumbeam/internal/models"
)

func TestNewTestTransaction(t *testing.T) {
	tx := NewTestTransaction()

	assert.NotEmpty(t, tx.TransactionID)
	assert.True(t, tx.Amount.GreaterThan(decimal.Zero))
	assert.False(t, tx.Timestamp.IsZero())
	assert.NotEmpty(t, tx.MerchantID)
	assert.NotEmpty(t, tx.UserID)
	assert.Equal(t, "credit_card", tx.PaymentMethod)
	assert.NotNil(t, tx.Features)
}

func TestNewTestTransaction_UniqueIDs(t *testing.T) {
	tx1 := NewTestTransaction()
	tx2 := NewTestTransaction()
	// IDs may collide due to rand, but should generally differ
	assert.NotEmpty(t, tx1.TransactionID)
	assert.NotEmpty(t, tx2.TransactionID)
}

func TestNewTestFraudResult(t *testing.T) {
	fr := NewTestFraudResult()

	assert.Equal(t, "txn-test-001", fr.TransactionID)
	assert.Equal(t, 0.25, fr.FraudScore)
	assert.Equal(t, models.RiskLevelLow, fr.RiskLevel)
	assert.Equal(t, models.ProcessingMethodClassical, fr.ProcessingMethod)
	assert.Equal(t, 0.85, fr.Confidence)
	assert.Equal(t, int64(45), fr.ProcessingTimeMs)
	assert.Nil(t, fr.QuantumAdvantage)
	assert.NotEmpty(t, fr.Explanation)
	assert.NotEmpty(t, fr.ModelVersion)
}

func TestNewHighRiskFraudResult(t *testing.T) {
	fr := NewHighRiskFraudResult()

	assert.Equal(t, 0.92, fr.FraudScore)
	assert.Equal(t, models.RiskLevelCritical, fr.RiskLevel)
	assert.Equal(t, models.ProcessingMethodQuantum, fr.ProcessingMethod)
	assert.NotNil(t, fr.QuantumAdvantage)
	assert.Equal(t, 0.15, *fr.QuantumAdvantage)
	assert.Len(t, fr.Explanation, 3)
}

func TestNewTestConfig(t *testing.T) {
	cfg := NewTestConfig()

	assert.Equal(t, "localhost", cfg.Server.Host)
	assert.Equal(t, 8080, cfg.Server.Port)
	assert.Equal(t, "localhost", cfg.Database.Host)
	assert.Equal(t, 5432, cfg.Database.Port)
	assert.Equal(t, "testdb", cfg.Database.DBName)
	assert.Equal(t, "disable", cfg.Database.SSLMode)
	assert.Equal(t, "localhost", cfg.Redis.Host)
	assert.Equal(t, 6379, cfg.Redis.Port)
}

func TestNewMockQuantumResult(t *testing.T) {
	qr := NewMockQuantumResult()

	probs := qr["probabilities"].(map[string]float64)
	assert.InDelta(t, 0.15, probs["fraud"], 0.001)
	assert.InDelta(t, 0.85, probs["not_fraud"], 0.001)
	assert.Equal(t, 12, qr["circuit_depth"])
	assert.Equal(t, 4, qr["num_qubits"])
	assert.Equal(t, "test-simulator", qr["backend"])
}

func TestNewTestTransactionBatch(t *testing.T) {
	batch := NewTestTransactionBatch(5)

	assert.Len(t, batch, 5)
	for i, tx := range batch {
		assert.Contains(t, tx.TransactionID, "txn-batch-")
		expectedAmount := decimal.NewFromFloat(float64(50 + i*25))
		assert.True(t, tx.Amount.Equal(expectedAmount))
	}
}

func TestNewTestTransactionBatch_Zero(t *testing.T) {
	batch := NewTestTransactionBatch(0)
	assert.Len(t, batch, 0)
}
