package services

import (
	"encoding/json"
	"testing"
	"time"

	"quantumbeam/internal/config"

	"github.com/stretchr/testify/assert"
)

type mockBillingLogger struct{}

func (m *mockBillingLogger) Debug(msg string, kv ...interface{}) {}
func (m *mockBillingLogger) Info(msg string, kv ...interface{})  {}
func (m *mockBillingLogger) Warn(msg string, kv ...interface{})  {}
func (m *mockBillingLogger) Error(msg string, kv ...interface{}) {}
func (m *mockBillingLogger) Fatal(msg string, kv ...interface{}) {}

func newTestBillingService() *BillingService {
	lsCfg := config.LemonSqueezyConfig{
		APIKey:        "test-key",
		StoreID:       "store-123",
		WebhookSecret: "webhook-secret",
		APIURL:        "https://api.lemonsqueezy.test",
		Timeout:       5 * time.Second,
	}
	bCfg := config.BillingConfig{Enabled: true, LemonSqueezy: lsCfg}
	return NewBillingService(nil, lsCfg, bCfg, &mockBillingLogger{})
}

func TestNewBillingService_Constructor(t *testing.T) {
	svc := newTestBillingService()
	assert.NotNil(t, svc)
	assert.NotNil(t, svc.lemonSqueezy)
	assert.NotNil(t, svc.log)
	assert.True(t, svc.config.Enabled)
}

func TestGetStringValue_NilCustomer(t *testing.T) {
	result := getStringValue(nil, "ID")
	assert.Equal(t, "", result)
}

func TestGetStringValue_WithCustomer(t *testing.T) {
	customer := &LemonSqueezyCustomer{
		Data: CustomerData{ID: "cust-456"},
	}
	assert.Equal(t, "cust-456", getStringValue(customer, "ID"))
}

func TestGetStringValue_UnknownField(t *testing.T) {
	customer := &LemonSqueezyCustomer{
		Data: CustomerData{ID: "cust-456"},
	}
	assert.Equal(t, "", getStringValue(customer, "unknown"))
}

func TestGetDefaultUsageLimit_BasicTier(t *testing.T) {
	svc := newTestBillingService()
	assert.Equal(t, 1000, svc.getDefaultUsageLimit(5.0))
	assert.Equal(t, 1000, svc.getDefaultUsageLimit(9.99))
}

func TestGetDefaultUsageLimit_ProTier(t *testing.T) {
	svc := newTestBillingService()
	assert.Equal(t, 10000, svc.getDefaultUsageLimit(10.0))
	assert.Equal(t, 10000, svc.getDefaultUsageLimit(49.99))
}

func TestGetDefaultUsageLimit_BusinessTier(t *testing.T) {
	svc := newTestBillingService()
	assert.Equal(t, 50000, svc.getDefaultUsageLimit(50.0))
	assert.Equal(t, 50000, svc.getDefaultUsageLimit(99.99))
}

func TestGetDefaultUsageLimit_EnterpriseTier(t *testing.T) {
	svc := newTestBillingService()
	assert.Equal(t, 100000, svc.getDefaultUsageLimit(100.0))
	assert.Equal(t, 100000, svc.getDefaultUsageLimit(500.0))
}

func TestGetDefaultFeatures_BasicTier(t *testing.T) {
	svc := newTestBillingService()
	featuresJSON := svc.getDefaultFeatures(5.0)
	var features map[string]interface{}
	err := json.Unmarshal([]byte(featuresJSON), &features)
	assert.NoError(t, err)
	assert.Equal(t, true, features["api_access"])
	assert.Equal(t, false, features["quantum_processing"])
	assert.Equal(t, false, features["advanced_analytics"])
	assert.Equal(t, false, features["priority_support"])
	assert.Equal(t, false, features["custom_models"])
}

func TestGetDefaultFeatures_ProTier(t *testing.T) {
	svc := newTestBillingService()
	featuresJSON := svc.getDefaultFeatures(25.0)
	var features map[string]interface{}
	err := json.Unmarshal([]byte(featuresJSON), &features)
	assert.NoError(t, err)
	assert.Equal(t, true, features["api_access"])
	assert.Equal(t, true, features["quantum_processing"])
	assert.Equal(t, false, features["advanced_analytics"])
}

func TestGetDefaultFeatures_BusinessTier(t *testing.T) {
	svc := newTestBillingService()
	featuresJSON := svc.getDefaultFeatures(75.0)
	var features map[string]interface{}
	err := json.Unmarshal([]byte(featuresJSON), &features)
	assert.NoError(t, err)
	assert.Equal(t, true, features["quantum_processing"])
	assert.Equal(t, true, features["advanced_analytics"])
	assert.Equal(t, false, features["priority_support"])
}

func TestGetDefaultFeatures_EnterpriseTier(t *testing.T) {
	svc := newTestBillingService()
	featuresJSON := svc.getDefaultFeatures(150.0)
	var features map[string]interface{}
	err := json.Unmarshal([]byte(featuresJSON), &features)
	assert.NoError(t, err)
	assert.Equal(t, true, features["api_access"])
	assert.Equal(t, true, features["quantum_processing"])
	assert.Equal(t, true, features["advanced_analytics"])
	assert.Equal(t, true, features["priority_support"])
	assert.Equal(t, true, features["custom_models"])
}

func TestGetUnitPrice_APICall_BasicTier(t *testing.T) {
	svc := newTestBillingService()
	assert.InDelta(t, 0.001, svc.getUnitPrice("api_call", 5.0), 0.0001)
}

func TestGetUnitPrice_APICall_ProTier(t *testing.T) {
	svc := newTestBillingService()
	assert.InDelta(t, 0.0005, svc.getUnitPrice("api_call", 25.0), 0.0001)
}

func TestGetUnitPrice_APICall_EnterpriseTier(t *testing.T) {
	svc := newTestBillingService()
	assert.InDelta(t, 0.0001, svc.getUnitPrice("api_call", 100.0), 0.00001)
}

func TestGetUnitPrice_QuantumCircuit(t *testing.T) {
	svc := newTestBillingService()
	assert.InDelta(t, 0.01, svc.getUnitPrice("quantum_circuit", 50.0), 0.001)
}

func TestGetUnitPrice_Storage(t *testing.T) {
	svc := newTestBillingService()
	assert.InDelta(t, 0.1, svc.getUnitPrice("storage", 50.0), 0.01)
}

func TestGetUnitPrice_UnknownType(t *testing.T) {
	svc := newTestBillingService()
	assert.InDelta(t, 0.001, svc.getUnitPrice("unknown_type", 50.0), 0.0001)
}

func TestGetDefaultUsageLimit_BoundaryValues(t *testing.T) {
	svc := newTestBillingService()
	tests := []struct {
		name     string
		price    float64
		expected int
	}{
		{"zero price", 0.0, 1000},
		{"negative price", -5.0, 1000},
		{"exactly 10", 10.0, 10000},
		{"exactly 50", 50.0, 50000},
		{"exactly 100", 100.0, 100000},
		{"very large price", 10000.0, 100000},
	}
	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			assert.Equal(t, tc.expected, svc.getDefaultUsageLimit(tc.price))
		})
	}
}
