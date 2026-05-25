//go:build ignore

package health

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/golang/mock/gomock"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/sdlc-ai/platform/services/gateway/internal/infrastructure/circuitbreaker"
	"github.com/sdlc-ai/platform/services/gateway/internal/infrastructure/config"
	"github.com/sdlc-ai/platform/services/gateway/internal/infrastructure/database"
)

// Mock health checker for testing
type mockHealthChecker struct {
	name         string
	enabled      bool
	checkResult  *CheckResult
	checkError   error
	checkLatency time.Duration
}

func (m *mockHealthChecker) Name() string {
	return m.name
}

func (m *mockHealthChecker) IsEnabled() bool {
	return m.enabled
}

func (m *mockHealthChecker) GetCheckInterval() time.Duration {
	return 30 * time.Second
}

func (m *mockHealthChecker) GetTimeout() time.Duration {
	return 5 * time.Second
}

func (m *mockHealthChecker) Check(ctx context.Context) *CheckResult {
	if m.checkLatency > 0 {
		time.Sleep(m.checkLatency)
	}
	if m.checkResult != nil {
		return m.checkResult
	}
	return &CheckResult{
		Name:    m.name,
		Status:  StatusHealthy,
		Message: "Mock check passed",
	}
}

func TestNewRegistry(t *testing.T) {
	cfg := &config.Config{
		Version:     "1.0.0",
		InstanceID:  "test-instance",
		Environment: "test",
	}

	registry := NewRegistry(cfg)

	assert.NotNil(t, registry)
	assert.NotNil(t, registry.checkers)
	assert.NotNil(t, registry.results)
	assert.Equal(t, cfg, registry.config)
	assert.Equal(t, "1.0.0", registry.version)
	assert.Equal(t, "test-instance", registry.instanceID)
}

func TestRegistry_Register(t *testing.T) {
	cfg := &config.Config{
		Version:     "1.0.0",
		InstanceID:  "test-instance",
		Environment: "test",
	}
	registry := NewRegistry(cfg)

	checker := &mockHealthChecker{
		name:    "test-checker",
		enabled: true,
	}

	registry.Register(checker)

	assert.Contains(t, registry.checkers, "test-checker")
}

func TestRegistry_Unregister(t *testing.T) {
	cfg := &config.Config{
		Version:     "1.0.0",
		InstanceID:  "test-instance",
		Environment: "test",
	}
	registry := NewRegistry(cfg)

	checker := &mockHealthChecker{
		name:    "test-checker",
		enabled: true,
	}

	// Register checker
	registry.Register(checker)
	assert.Contains(t, registry.checkers, "test-checker")

	// Unregister checker
	registry.Unregister("test-checker")
	assert.NotContains(t, registry.checkers, "test-checker")
	assert.NotContains(t, registry.results, "test-checker")
}

func TestRegistry_CheckAll(t *testing.T) {
	cfg := &config.Config{
		Version:     "1.0.0",
		InstanceID:  "test-instance",
		Environment: "test",
	}
	registry := NewRegistry(cfg)

	// Register multiple checkers with different statuses
	registry.Register(&mockHealthChecker{
		name:    "healthy-checker",
		enabled: true,
		checkResult: &CheckResult{
			Name:    "healthy-checker",
			Status:  StatusHealthy,
			Message: "All good",
		},
	})

	registry.Register(&mockHealthChecker{
		name:    "unhealthy-checker",
		enabled: true,
		checkResult: &CheckResult{
			Name:    "unhealthy-checker",
			Status:  StatusUnhealthy,
			Message: "Something is wrong",
		},
	})

	registry.Register(&mockHealthChecker{
		name:    "disabled-checker",
		enabled: false,
	})

	// Run all checks
	report := registry.CheckAll(context.Background())

	// Verify report
	assert.Equal(t, StatusUnhealthy, report.Status) // Overall status should be unhealthy
	assert.Equal(t, "1.0.0", report.Version)
	assert.Equal(t, "test-instance", report.Metadata["instance_id"])
	assert.Equal(t, "test", report.Metadata["environment"])
	assert.Len(t, report.Checks, 3)
	assert.Len(t, report.Summary, 3)

	// Check individual results
	healthy := report.Checks["healthy-checker"]
	assert.Equal(t, StatusHealthy, healthy.Status)
	assert.Equal(t, "All good", healthy.Message)

	unhealthy := report.Checks["unhealthy-checker"]
	assert.Equal(t, StatusUnhealthy, unhealthy.Status)
	assert.Equal(t, "Something is wrong", unhealthy.Message)

	disabled := report.Checks["disabled-checker"]
	assert.Equal(t, StatusNotChecked, disabled.Status)

	// Check summary
	assert.Equal(t, 1, report.Summary["healthy"])
	assert.Equal(t, 1, report.Summary["unhealthy"])
	assert.Equal(t, 1, report.Summary["not_checked"])
}

func TestRegistry_Check_Single(t *testing.T) {
	cfg := &config.Config{
		Version:     "1.0.0",
		InstanceID:  "test-instance",
		Environment: "test",
	}
	registry := NewRegistry(cfg)

	checker := &mockHealthChecker{
		name:    "test-checker",
		enabled: true,
		checkResult: &CheckResult{
			Name:    "test-checker",
			Status:  StatusDegraded,
			Message: "Performance degraded",
		},
	}

	registry.Register(checker)

	// Check specific checker
	result := registry.Check(context.Background(), "test-checker")

	assert.Equal(t, StatusDegraded, result.Status)
	assert.Equal(t, "Performance degraded", result.Message)
	assert.Equal(t, "test-checker", result.Name)
	assert.Equal(t, "test-instance", result.ComponentID)
	assert.Equal(t, "1.0.0", result.CheckVersion)

	// Check non-existent checker
	result = registry.Check(context.Background(), "non-existent")
	assert.Equal(t, StatusUnknown, result.Status)
	assert.Equal(t, "Health checker not found", result.Message)
}

func TestRegistry_GetResults(t *testing.T) {
	cfg := &config.Config{
		Version:     "1.0.0",
		InstanceID:  "test-instance",
		Environment: "test",
	}
	registry := NewRegistry(cfg)

	registry.Register(&mockHealthChecker{
		name:    "test-checker",
		enabled: true,
		checkResult: &CheckResult{
			Name:    "test-checker",
			Status:  StatusHealthy,
			Message: "All good",
			Details: map[string]interface{}{
				"metric": 100,
			},
		},
	})

	// Run check to populate cache
	registry.Check(context.Background(), "test-checker")

	// Get cached results
	results := registry.GetResults()
	assert.Len(t, results, 1)

	result := results["test-checker"]
	assert.Equal(t, StatusHealthy, result.Status)
	assert.Equal(t, "All good", result.Message)
	assert.Equal(t, map[string]interface{}{"metric": 100}, result.Details)

	// Verify it's a copy, not the original
	result.Details["metric"] = 200
	results2 := registry.GetResults()
	assert.Equal(t, map[string]interface{}{"metric": 100}, results2["test-checker"].Details)
}

func TestRegistry_getSystemInfo(t *testing.T) {
	cfg := &config.Config{
		Version:     "1.0.0",
		InstanceID:  "test-instance",
		Environment: "test",
	}
	registry := NewRegistry(cfg)

	systemInfo := registry.getSystemInfo()

	assert.NotEmpty(t, systemInfo.GoVersion)
	assert.NotEmpty(t, systemInfo.OS)
	assert.NotEmpty(t, systemInfo.Arch)
	assert.Greater(t, systemInfo.NumCPU, 0)
	assert.Greater(t, systemInfo.Goroutines, 0)
	assert.Greater(t, systemInfo.Memory.Alloc, uint64(0))
	assert.NotNil(t, systemInfo.HeapStats)
	assert.Equal(t, "test-instance", systemInfo.Process.Uptime)
}

func TestDatabaseChecker(t *testing.T) {
	ctrl := gomock.NewController(t)
	defer ctrl.Finish()

	// Mock database connection
	mockDB := NewMockDatabaseConnection(ctrl)
	mockDB.EXPECT().Ping(gomock.Any()).Return(nil).Times(1)

	config := DatabaseConfig{
		Enabled:        true,
		CheckInterval:  30 * time.Second,
		Timeout:        5 * time.Second,
		QueryTimeout:   2 * time.Second,
		TestQuery:      "SELECT 1",
		IncludeMetrics: true,
	}

	checker := NewDatabaseChecker(mockDB, config)

	assert.Equal(t, "database", checker.Name())
	assert.True(t, checker.IsEnabled())
	assert.Equal(t, 30*time.Second, checker.GetCheckInterval())
	assert.Equal(t, 5*time.Second, checker.GetTimeout())

	// Run check
	result := checker.Check(context.Background())

	assert.Equal(t, StatusHealthy, result.Status)
	assert.Contains(t, result.Message, "Database is healthy")
	assert.Contains(t, result.Details, "ping_duration")
}

func TestDatabaseChecker_Failure(t *testing.T) {
	ctrl := gomock.NewController(t)
	defer ctrl.Finish()

	// Mock database connection with error
	mockDB := NewMockDatabaseConnection(ctrl)
	mockDB.EXPECT().Ping(gomock.Any()).Return(fmt.Errorf("connection failed")).Times(1)

	config := DatabaseConfig{
		Enabled:        true,
		CheckInterval:  30 * time.Second,
		Timeout:        5 * time.Second,
		QueryTimeout:   2 * time.Second,
		TestQuery:      "SELECT 1",
		IncludeMetrics: false,
	}

	checker := NewDatabaseChecker(mockDB, config)

	// Run check
	result := checker.Check(context.Background())

	assert.Equal(t, StatusUnhealthy, result.Status)
	assert.Equal(t, "Database ping failed", result.Message)
	assert.Equal(t, "connection failed", result.Error)
}

func TestCircuitBreakerChecker(t *testing.T) {
	registry := circuitbreaker.NewRegistry()
	config := circuitbreaker.DefaultConfig()

	// Create a circuit breaker with some metrics
	cb := registry.GetOrCreate("test-cb", config)

	// Simulate some activity
	ctx := context.Background()
	cb.Execute(ctx, func(ctx context.Context) error { return nil })
	cb.Execute(ctx, func(ctx context.Context) error { return fmt.Errorf("error") })

	checkerConfig := CircuitBreakerConfig{
		Enabled:       true,
		CheckInterval: 30 * time.Second,
		Timeout:       2 * time.Second,
		WarnThreshold: 10.0,
	}

	checker := NewCircuitBreakerChecker(registry, checkerConfig)

	assert.Equal(t, "circuit_breakers", checker.Name())
	assert.True(t, checker.IsEnabled())

	// Run check
	result := checker.Check(context.Background())

	assert.Equal(t, StatusHealthy, result.Status)
	assert.Contains(t, result.Message, "All circuit breakers are healthy")
	assert.Contains(t, result.Details, "breakers")
	assert.Contains(t, result.Details, "total_breakers")
	assert.Contains(t, result.Details, "open_breakers")
}

func TestMemoryChecker(t *testing.T) {
	config := MemoryConfig{
		Enabled:           true,
		CheckInterval:     60 * time.Second,
		Timeout:           1 * time.Second,
		WarningThreshold:  80.0,
		CriticalThreshold: 90.0,
	}

	checker := NewMemoryChecker(config)

	assert.Equal(t, "memory", checker.Name())
	assert.True(t, checker.IsEnabled())

	// Run check
	result := checker.Check(context.Background())

	assert.Equal(t, StatusHealthy, result.Status)
	assert.Contains(t, result.Message, "Memory usage is normal")
	assert.Contains(t, result.Details, "alloc_bytes")
	assert.Contains(t, result.Details, "sys_bytes")
	assert.Contains(t, result.Details, "goroutines")
	assert.Contains(t, result.Details, "usage_percent")
}

func TestMemoryChecker_HighUsage(t *testing.T) {
	config := MemoryConfig{
		Enabled:           true,
		CheckInterval:     60 * time.Second,
		Timeout:           1 * time.Second,
		WarningThreshold:  0.0, // Very low threshold to trigger warning
		CriticalThreshold: 100.0,
	}

	checker := NewMemoryChecker(config)

	// Run check - should trigger warning due to 0% threshold
	result := checker.Check(context.Background())

	assert.Equal(t, StatusDegraded, result.Status)
	assert.Contains(t, result.Message, "High memory usage")
}

func TestHTTPHandler_ServeHTTP_AllChecks(t *testing.T) {
	cfg := &config.Config{
		Version:     "1.0.0",
		InstanceID:  "test-instance",
		Environment: "test",
	}
	registry := NewRegistry(cfg)

	registry.Register(&mockHealthChecker{
		name:    "healthy-checker",
		enabled: true,
		checkResult: &CheckResult{
			Name:    "healthy-checker",
			Status:  StatusHealthy,
			Message: "All good",
		},
	})

	handler := NewHTTPHandler(registry)

	req := httptest.NewRequest("GET", "/health", nil)
	req.Header.Set("X-Request-ID", "test-request-123")
	w := httptest.NewRecorder()

	handler.ServeHTTP(w, req)

	assert.Equal(t, http.StatusOK, w.Code)
	assert.Equal(t, "application/json", w.Header().Get("Content-Type"))

	var report HealthReport
	err := json.Unmarshal(w.Body.Bytes(), &report)
	require.NoError(t, err)

	assert.Equal(t, StatusHealthy, report.Status)
	assert.Equal(t, "1.0.0", report.Version)
	assert.Equal(t, "test-instance", report.Metadata["instance_id"])
	assert.Len(t, report.Checks, 1)
	assert.Len(t, report.Summary, 1)
	assert.Equal(t, 1, report.Summary["healthy"])
}

func TestHTTPHandler_ServeHTTP_SingleCheck(t *testing.T) {
	cfg := &config.Config{
		Version:     "1.0.0",
		InstanceID:  "test-instance",
		Environment: "test",
	}
	registry := NewRegistry(cfg)

	registry.Register(&mockHealthChecker{
		name:    "test-checker",
		enabled: true,
		checkResult: &CheckResult{
			Name:    "test-checker",
			Status:  StatusDegraded,
			Message: "Performance degraded",
		},
	})

	handler := NewHTTPHandler(registry)

	req := httptest.NewRequest("GET", "/health?check=test-checker", nil)
	w := httptest.NewRecorder()

	handler.ServeHTTP(w, req)

	assert.Equal(t, http.StatusMultiStatus, w.Code) // 207 for degraded status

	var report HealthReport
	err := json.Unmarshal(w.Body.Bytes(), &report)
	require.NoError(t, err)

	assert.Equal(t, StatusDegraded, report.Status)
	assert.Len(t, report.Checks, 1)
	assert.Equal(t, StatusDegraded, report.Checks["test-checker"].Status)
}

func TestHTTPHandler_ServeHTTP_Unhealthy(t *testing.T) {
	cfg := &config.Config{
		Version:     "1.0.0",
		InstanceID:  "test-instance",
		Environment: "test",
	}
	registry := NewRegistry(cfg)

	registry.Register(&mockHealthChecker{
		name:    "unhealthy-checker",
		enabled: true,
		checkResult: &CheckResult{
			Name:    "unhealthy-checker",
			Status:  StatusUnhealthy,
			Message: "Service down",
		},
	})

	handler := NewHTTPHandler(registry)

	req := httptest.NewRequest("GET", "/health", nil)
	w := httptest.NewRecorder()

	handler.ServeHTTP(w, req)

	assert.Equal(t, http.StatusServiceUnavailable, w.Code)

	var report HealthReport
	err := json.Unmarshal(w.Body.Bytes(), &report)
	require.NoError(t, err)

	assert.Equal(t, StatusUnhealthy, report.Status)
}

func TestCalculateSuccessRate(t *testing.T) {
	// Test with successful requests
	assert.Equal(t, 100.0, calculateSuccessRate(10, 10))

	// Test with some failures
	assert.Equal(t, 50.0, calculateSuccessRate(5, 10))
	assert.Equal(t, 0.0, calculateSuccessRate(0, 10))

	// Test with no requests
	assert.Equal(t, 0.0, calculateSuccessRate(0, 0))
}

func TestInitializeGlobalHealth(t *testing.T) {
	ctrl := gomock.NewController(t)
	defer ctrl.Finish()

	cfg := &config.Config{
		Version:     "1.0.0",
		InstanceID:  "test-instance",
		Environment: "test",
	}

	// Mock database connection
	mockDB := NewMockDatabaseConnection(ctrl)
	mockDB.EXPECT().Ping(gomock.Any()).Return(nil).AnyTimes()
	mockDB.EXPECT().Stats().Return(&database.DBStats{
		MaxConns: 100,
	}).AnyTimes()

	// Initialize global health
	registry := InitializeGlobalHealth(cfg, mockDB)

	assert.NotNil(t, registry)
	assert.Equal(t, registry, GetGlobalRegistry())

	// Check that built-in checkers are registered
	assert.NotNil(t, registry.checkers["database"])
	assert.NotNil(t, registry.checkers["circuit_breakers"])
	assert.NotNil(t, registry.checkers["memory"])
}

// Mock interfaces for testing
type MockDatabaseConnection struct {
	ctrl *gomock.Controller
}

func NewMockDatabaseConnection(ctrl *gomock.Controller) *MockDatabaseConnection {
	return &MockDatabaseConnection{ctrl: ctrl}
}

func (m *MockDatabaseConnection) Ping(ctx context.Context) error {
	return nil
}

func (m *MockDatabaseConnection) TestQuery(ctx context.Context, query string) error {
	return nil
}

func (m *MockDatabaseConnection) Stats() *database.DBStats {
	return &database.DBStats{
		MaxConns:     100,
		TotalConns:   10,
		IdleConns:    5,
		AcquireCount: 1000,
	}
}

func (m *MockDatabaseConnection) Close() error {
	return nil
}

// Benchmark tests
func BenchmarkRegistry_CheckAll(b *testing.B) {
	cfg := &config.Config{
		Version:     "1.0.0",
		InstanceID:  "test-instance",
		Environment: "test",
	}
	registry := NewRegistry(cfg)

	// Register 10 checkers
	for i := 0; i < 10; i++ {
		registry.Register(&mockHealthChecker{
			name:    fmt.Sprintf("checker-%d", i),
			enabled: true,
		})
	}

	ctx := context.Background()
	b.ResetTimer()

	for i := 0; i < b.N; i++ {
		registry.CheckAll(ctx)
	}
}

func BenchmarkHealthCheck_HTTPHandler(b *testing.B) {
	cfg := &config.Config{
		Version:     "1.0.0",
		InstanceID:  "test-instance",
		Environment: "test",
	}
	registry := NewRegistry(cfg)

	handler := NewHTTPHandler(registry)

	req := httptest.NewRequest("GET", "/health", nil)
	b.ResetTimer()

	for i := 0; i < b.N; i++ {
		w := httptest.NewRecorder()
		handler.ServeHTTP(w, req)
	}
}
