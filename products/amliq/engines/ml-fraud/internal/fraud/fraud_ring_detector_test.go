package fraud

import (
	"context"
	"testing"
	"time"

	"github.com/shopspring/decimal"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
	"quantumbeam/internal/interfaces"
	"quantumbeam/internal/models"
)

// MockAlertService mocks the AlertService interface
type MockAlertService struct {
	mock.Mock
}

func (m *MockAlertService) SendFraudRingAlert(ctx context.Context, ring *interfaces.FraudRing) error {
	args := m.Called(ctx, ring)
	return args.Error(0)
}

func (m *MockAlertService) SendCommunityAlert(ctx context.Context, community *interfaces.Community) error {
	args := m.Called(ctx, community)
	return args.Error(0)
}

func newDetectorTestTransactions() []*models.TransactionData {
	now := time.Now()
	device := "device_abc"
	return []*models.TransactionData{
		{
			TransactionID: "tx1", Amount: decimal.NewFromFloat(5000),
			Timestamp: now.Add(-1 * time.Hour), MerchantID: "m1",
			UserID: "u1", PaymentMethod: "credit_card", DeviceFingerprint: &device,
		},
		{
			TransactionID: "tx2", Amount: decimal.NewFromFloat(3000),
			Timestamp: now.Add(-30 * time.Minute), MerchantID: "m1",
			UserID: "u2", PaymentMethod: "digital_wallet", DeviceFingerprint: &device,
		},
		{
			TransactionID: "tx3", Amount: decimal.NewFromFloat(7000),
			Timestamp: now.Add(-15 * time.Minute), MerchantID: "m2",
			UserID: "u3", PaymentMethod: "credit_card",
		},
		{
			TransactionID: "tx4", Amount: decimal.NewFromFloat(4000),
			Timestamp: now.Add(-10 * time.Minute), MerchantID: "m1",
			UserID: "u1", PaymentMethod: "debit_card",
		},
	}
}

func TestNewFraudRingDetector(t *testing.T) {
	mockBackend := new(MockQuantumBackendService)
	mockAlert := new(MockAlertService)
	detector := NewFraudRingDetector(mockBackend, mockAlert)
	assert.NotNil(t, detector)
	assert.Equal(t, 3, detector.config.MinRingSize)
	assert.Equal(t, 1000, detector.config.MaxGraphSize)
	assert.Equal(t, 0.7, detector.config.FraudThreshold)
	assert.True(t, detector.config.RealTimeEnabled)
}

func TestDetectFraudRings_ClassicalPath(t *testing.T) {
	detector := NewFraudRingDetector(new(MockQuantumBackendService), new(MockAlertService))
	detector.config.QuantumOptimization = false
	detector.config.RealTimeEnabled = false
	ctx := context.Background()

	window := TimeWindow{Start: time.Now().Add(-24 * time.Hour), End: time.Now().Add(time.Hour)}
	result, err := detector.DetectFraudRings(ctx, newDetectorTestTransactions(), window)
	assert.NoError(t, err)
	assert.NotNil(t, result)
	assert.Equal(t, 0.75, result.ConfidenceScore)
	assert.Equal(t, 0.0, result.QuantumAdvantage)
}

func TestDetectFraudRings_EmptyTransactions(t *testing.T) {
	detector := NewFraudRingDetector(new(MockQuantumBackendService), nil)
	detector.config.QuantumOptimization = false
	detector.config.RealTimeEnabled = false
	ctx := context.Background()

	window := TimeWindow{Start: time.Now().Add(-24 * time.Hour), End: time.Now().Add(time.Hour)}
	result, err := detector.DetectFraudRings(ctx, []*models.TransactionData{}, window)
	assert.NoError(t, err)
	assert.NotNil(t, result)
	assert.Empty(t, result.FraudRings)
}

func TestDetectFraudRings_TimeWindowFiltering(t *testing.T) {
	detector := NewFraudRingDetector(new(MockQuantumBackendService), nil)
	detector.config.QuantumOptimization = false
	detector.config.RealTimeEnabled = false
	ctx := context.Background()

	// Narrow window excludes older transactions
	window := TimeWindow{Start: time.Now().Add(-20 * time.Minute), End: time.Now().Add(time.Hour)}
	result, err := detector.DetectFraudRings(ctx, newDetectorTestTransactions(), window)
	assert.NoError(t, err)
	assert.NotNil(t, result)
}

func TestBuildTransactionGraph(t *testing.T) {
	detector := NewFraudRingDetector(new(MockQuantumBackendService), nil)
	window := TimeWindow{Start: time.Now().Add(-24 * time.Hour), End: time.Now().Add(time.Hour)}

	graph, err := detector.buildTransactionGraph(newDetectorTestTransactions(), window)
	assert.NoError(t, err)
	assert.NotEmpty(t, graph.Users)
	assert.NotEmpty(t, graph.Merchants)
	assert.NotEmpty(t, graph.Edges)
	assert.NotEmpty(t, graph.Transactions)
}

func TestCalculateUserRiskScore(t *testing.T) {
	detector := NewFraudRingDetector(nil, nil)
	tests := []struct {
		name   string
		amount float64
		hour   int
		min    float64
	}{
		{"low_risk", 100, 14, 0.0},
		{"high_amount", 15000, 14, 0.25},
		{"late_night", 100, 2, 0.15},
		{"both", 15000, 2, 0.45},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			tx := &models.TransactionData{
				Amount:    decimal.NewFromFloat(tt.amount),
				Timestamp: time.Date(2026, 1, 1, tt.hour, 0, 0, 0, time.UTC),
			}
			score := detector.calculateUserRiskScore(tx)
			assert.GreaterOrEqual(t, score, tt.min)
			assert.LessOrEqual(t, score, 1.0)
		})
	}
}

func TestCalculateConnectionWeight(t *testing.T) {
	detector := NewFraudRingDetector(nil, nil)
	deviceW := detector.calculateConnectionWeight("shared_device", 2)
	locationW := detector.calculateConnectionWeight("shared_location", 2)
	assert.Greater(t, deviceW, locationW)
	smallGroup := detector.calculateConnectionWeight("shared_device", 2)
	largeGroup := detector.calculateConnectionWeight("shared_device", 10)
	assert.Greater(t, smallGroup, largeGroup)
}

func TestIdentifyRiskIndicators(t *testing.T) {
	detector := NewFraudRingDetector(nil, nil)
	device := "dev_123"
	tx := &models.TransactionData{
		Amount: decimal.NewFromFloat(15000), PaymentMethod: "digital_wallet",
		Timestamp: time.Date(2026, 1, 1, 2, 0, 0, 0, time.UTC), DeviceFingerprint: &device,
	}
	indicators := detector.identifyRiskIndicators(tx)
	assert.Contains(t, indicators, "high_amount")
	assert.Contains(t, indicators, "unusual_time")
	assert.Contains(t, indicators, "high_risk_payment_method")
	assert.Contains(t, indicators, "device_tracked")
}
