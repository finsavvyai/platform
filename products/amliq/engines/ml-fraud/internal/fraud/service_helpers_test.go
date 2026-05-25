package fraud

import (
	"testing"
	"time"

	"github.com/shopspring/decimal"
	"github.com/stretchr/testify/assert"
	"quantumbeam/internal/interfaces"
	"quantumbeam/internal/models"
)

func TestExtractTransactionFeatures_AllPaymentMethods(t *testing.T) {
	svc := NewService(nil, nil)
	tests := []struct {
		name       string
		method     string
		expectedF2 float64
	}{
		{"credit_card", "credit_card", 0.25},
		{"debit_card", "debit_card", 0.5},
		{"bank_transfer", "bank_transfer", 0.75},
		{"digital_wallet", "digital_wallet", 1.0},
		{"unknown", "cash", 0.0},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			tx := newTestTransaction("test", 1000.0, tt.method)
			features := svc.extractTransactionFeatures(tx)
			assert.Len(t, features, 4)
			assert.Equal(t, tt.expectedF2, features[2])
		})
	}
}

func TestExtractTransactionFeatures_AmountEncoding(t *testing.T) {
	svc := NewService(nil, nil)
	for _, amt := range []float64{10.0, 1000.0, 100000.0, 0.0} {
		tx := newTestTransaction("test", amt, "credit_card")
		features := svc.extractTransactionFeatures(tx)
		assert.GreaterOrEqual(t, features[0], 0.0)
		assert.LessOrEqual(t, features[0], 1.0)
	}
}

func TestExtractTransactionFeatures_RiskIndicator(t *testing.T) {
	svc := NewService(nil, nil)
	tx := newTestTransaction("test", 1000.0, "credit_card")
	tx.Features = map[string]float64{"risk_indicator": 0.8}
	assert.InDelta(t, 0.8, svc.extractTransactionFeatures(tx)[3], 0.01)

	tx2 := newTestTransaction("test", 1000.0, "credit_card")
	tx2.Features = nil
	assert.Equal(t, 0.5, svc.extractTransactionFeatures(tx2)[3])
}

func TestExtractTransactionFeatures_TimeOfDay(t *testing.T) {
	svc := NewService(nil, nil)
	tx := &models.TransactionData{
		TransactionID: "t", Amount: decimal.NewFromFloat(100.0),
		Timestamp: time.Date(2026, 1, 1, 12, 0, 0, 0, time.UTC), PaymentMethod: "credit_card",
	}
	assert.InDelta(t, 0.5, svc.extractTransactionFeatures(tx)[1], 0.01)
}

func TestProcessQuantumResults_WithProbabilities(t *testing.T) {
	svc := NewService(nil, nil)
	qr := &interfaces.QuantumResult{
		Probabilities: map[string]float64{"0000": 0.3, "1111": 0.7},
		Measurements:  map[string]int{"0000": 300, "1111": 700},
	}
	score, conf := svc.processQuantumResults(qr)
	assert.Equal(t, 0.7, score)
	assert.InDelta(t, 0.4, conf, 0.01)
}

func TestProcessQuantumResults_FallbackToMeasurements(t *testing.T) {
	svc := NewService(nil, nil)
	qr := &interfaces.QuantumResult{
		Probabilities: map[string]float64{},
		Measurements:  map[string]int{"0000": 600, "1111": 400},
	}
	score, conf := svc.processQuantumResults(qr)
	assert.InDelta(t, 0.4, score, 0.01)
	assert.InDelta(t, 0.2, conf, 0.01)
}

func TestProcessQuantumResults_EmptyMeasurements(t *testing.T) {
	svc := NewService(nil, nil)
	qr := &interfaces.QuantumResult{
		Probabilities: map[string]float64{}, Measurements: map[string]int{},
	}
	score, conf := svc.processQuantumResults(qr)
	assert.Equal(t, 0.5, score)
	assert.Equal(t, 0.1, conf)
}

func TestNormalizeToRange(t *testing.T) {
	tests := []struct {
		name                    string
		value, min, max, expect float64
	}{
		{"middle", 5.0, 0.0, 10.0, 0.5},
		{"at_min", 0.0, 0.0, 10.0, 0.0},
		{"at_max", 10.0, 0.0, 10.0, 1.0},
		{"below_min", -5.0, 0.0, 10.0, 0.0},
		{"above_max", 15.0, 0.0, 10.0, 1.0},
		{"equal_min_max", 5.0, 5.0, 5.0, 0.5},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			assert.InDelta(t, tt.expect, normalizeToRange(tt.value, tt.min, tt.max), 0.001)
		})
	}
}

func TestTypeConversionHelpers(t *testing.T) {
	m := map[string]interface{}{"str": "hello", "int": 42, "float": 3.14, "bool": true}

	assert.Equal(t, "hello", getStringValue(m, "str"))
	assert.Equal(t, "", getStringValue(m, "missing"))
	assert.Equal(t, "", getStringValue(m, "int"))

	assert.Equal(t, 42, getIntValue(m, "int"))
	assert.Equal(t, 3, getIntValue(m, "float"))
	assert.Equal(t, 0, getIntValue(m, "missing"))
	assert.Equal(t, 0, getIntValue(m, "str"))

	assert.True(t, getBoolValue(m, "bool"))
	assert.False(t, getBoolValue(m, "missing"))

	assert.Equal(t, 3.14, getFloatValue(m, "float"))
	assert.Equal(t, 42.0, getFloatValue(m, "int"))
	assert.Equal(t, 0.0, getFloatValue(m, "missing"))
}
