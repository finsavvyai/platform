package fraud

import (
	"context"
	"testing"

	"github.com/shopspring/decimal"
	"github.com/stretchr/testify/assert"
	"quantumbeam/internal/interfaces"
	"quantumbeam/internal/models"
)

func TestNewRouter_DefaultStrategy(t *testing.T) {
	router := NewRouter(new(MockQuantumBackendService))
	assert.NotNil(t, router)
	assert.Equal(t, "adaptive_quantum_first", router.strategy.Name)
	assert.Equal(t, 0.6, router.strategy.QuantumThreshold)
	assert.Equal(t, 0.95, router.performanceHistory.quantumSuccessRate)
}

func healthyHardwareStatus() *interfaces.HardwareStatus {
	return &interfaces.HardwareStatus{
		TotalBackends: 4, AvailableBackends: 3,
		AverageQueueTime: 30.0, SystemHealth: "excellent",
	}
}

func TestRouteTransaction_QuantumAvailable(t *testing.T) {
	mockBackend := new(MockQuantumBackendService)
	router := NewRouter(mockBackend)
	ctx := context.Background()
	mockBackend.On("MonitorQuantumHardware", ctx).Return(healthyHardwareStatus(), nil)

	tx := &models.TransactionData{
		TransactionID: "rt1", Amount: decimal.NewFromFloat(50000.0),
		PaymentMethod: "credit_card",
		Features:      map[string]float64{"f1": 0.9, "f2": 0.1, "f3": 0.5, "f4": 0.8, "f5": 0.3, "f6": 0.7, "f7": 0.2, "f8": 0.6},
		Location:      &models.GeoLocation{Latitude: 40.7, Longitude: -74.0},
	}
	method, err := router.RouteTransaction(ctx, tx)
	assert.NoError(t, err)
	assert.NotEmpty(t, string(method))
}

func TestRouteTransaction_BackendUnavailable(t *testing.T) {
	mockBackend := new(MockQuantumBackendService)
	router := NewRouter(mockBackend)
	ctx := context.Background()
	mockBackend.On("MonitorQuantumHardware", ctx).Return(nil, assert.AnError)

	method, err := router.RouteTransaction(ctx, newTestTransaction("rt2", 5000.0, "credit_card"))
	assert.NoError(t, err)
	assert.Equal(t, interfaces.ProcessingMethodClassical, method)
}

func TestGetRoutingDecision_Available(t *testing.T) {
	mockBackend := new(MockQuantumBackendService)
	router := NewRouter(mockBackend)
	ctx := context.Background()
	mockBackend.On("MonitorQuantumHardware", ctx).Return(healthyHardwareStatus(), nil)

	decision, err := router.GetRoutingDecision(ctx, map[string]float64{"amount": 50000})
	assert.NoError(t, err)
	assert.NotEmpty(t, decision.Reasoning)
}

func TestGetRoutingDecision_Unavailable(t *testing.T) {
	mockBackend := new(MockQuantumBackendService)
	router := NewRouter(mockBackend)
	ctx := context.Background()
	mockBackend.On("MonitorQuantumHardware", ctx).Return(nil, assert.AnError)

	decision, err := router.GetRoutingDecision(ctx, map[string]float64{"amount": 1000})
	assert.NoError(t, err)
	assert.Equal(t, interfaces.ProcessingMethodClassical, decision.Method)
	assert.Contains(t, decision.Reasoning, "unavailable")
}

func TestUpdateRoutingStrategy_Valid(t *testing.T) {
	router := NewRouter(new(MockQuantumBackendService))
	ctx := context.Background()
	err := router.UpdateRoutingStrategy(ctx, &interfaces.RoutingStrategy{
		Name: "custom", QuantumThreshold: 0.5, ComplexityWeight: 0.3, PerformanceWeight: 0.7,
	})
	assert.NoError(t, err)
	assert.Equal(t, "custom", router.strategy.Name)
}

func TestUpdateRoutingStrategy_Invalid(t *testing.T) {
	router := NewRouter(new(MockQuantumBackendService))
	ctx := context.Background()
	tests := []struct {
		name string
		s    *interfaces.RoutingStrategy
	}{
		{"neg_threshold", &interfaces.RoutingStrategy{QuantumThreshold: -0.1, ComplexityWeight: 0.5, PerformanceWeight: 0.5}},
		{"high_threshold", &interfaces.RoutingStrategy{QuantumThreshold: 1.1, ComplexityWeight: 0.5, PerformanceWeight: 0.5}},
		{"neg_complexity", &interfaces.RoutingStrategy{QuantumThreshold: 0.5, ComplexityWeight: -0.1, PerformanceWeight: 0.5}},
		{"neg_perf", &interfaces.RoutingStrategy{QuantumThreshold: 0.5, ComplexityWeight: 0.5, PerformanceWeight: -0.1}},
		{"bad_sum", &interfaces.RoutingStrategy{QuantumThreshold: 0.5, ComplexityWeight: 0.3, PerformanceWeight: 0.3}},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			assert.Error(t, router.UpdateRoutingStrategy(ctx, tt.s))
		})
	}
}

func TestUpdatePerformanceMetrics(t *testing.T) {
	router := NewRouter(new(MockQuantumBackendService))
	initial := router.performanceHistory.quantumSuccessRate
	router.UpdatePerformanceMetrics(interfaces.ProcessingMethodQuantum, true, 50.0, 0.2)
	assert.NotEqual(t, initial, router.performanceHistory.quantumSuccessRate)

	initialC := router.performanceHistory.classicalSuccessRate
	router.UpdatePerformanceMetrics(interfaces.ProcessingMethodClassical, false, 100.0, 0)
	assert.NotEqual(t, initialC, router.performanceHistory.classicalSuccessRate)
}

func TestGetPerformanceMetrics(t *testing.T) {
	router := NewRouter(new(MockQuantumBackendService))
	assert.Equal(t, 0.95, router.GetPerformanceMetrics().quantumSuccessRate)
}

func TestGetCurrentStrategy(t *testing.T) {
	router := NewRouter(new(MockQuantumBackendService))
	assert.Equal(t, "adaptive_quantum_first", router.GetCurrentStrategy().Name)
}

func TestCalculateAvailabilityScore(t *testing.T) {
	router := NewRouter(new(MockQuantumBackendService))
	tests := []struct {
		name   string
		status *interfaces.HardwareStatus
		expect float64
	}{
		{"none", &interfaces.HardwareStatus{AvailableBackends: 0, TotalBackends: 3}, 0.0},
		{"all_excellent", &interfaces.HardwareStatus{AvailableBackends: 3, TotalBackends: 3, SystemHealth: "excellent"}, 1.0},
		{"poor", &interfaces.HardwareStatus{AvailableBackends: 3, TotalBackends: 3, SystemHealth: "poor"}, 0.5},
		{"queue", &interfaces.HardwareStatus{AvailableBackends: 3, TotalBackends: 3, SystemHealth: "excellent", AverageQueueTime: 300}, 0.5},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			assert.InDelta(t, tt.expect, router.calculateAvailabilityScore(tt.status), 0.01)
		})
	}
}

func TestCalculateFeatureVariance(t *testing.T) {
	router := NewRouter(new(MockQuantumBackendService))
	assert.Equal(t, 0.0, router.calculateFeatureVariance(map[string]float64{}))
	assert.Equal(t, 0.0, router.calculateFeatureVariance(map[string]float64{"a": 5.0}))
	assert.Greater(t, router.calculateFeatureVariance(map[string]float64{"a": 0.0, "b": 1.0}), 0.0)
}
