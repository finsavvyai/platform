package services

import (
	"context"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"

	"github.com/queryflux/backend/internal/domain/entities"
	"github.com/queryflux/backend/internal/domain/repositories"
)

// MockMetricsRepository is a mock implementation of MetricsRepository
type MockMetricsRepository struct {
	mock.Mock
}

func (m *MockMetricsRepository) Create(ctx context.Context, metrics *entities.DatabaseMetrics) error {
	args := m.Called(ctx, metrics)
	return args.Error(0)
}

func (m *MockMetricsRepository) GetByID(ctx context.Context, id string) (*entities.DatabaseMetrics, error) {
	args := m.Called(ctx, id)
	return args.Get(0).(*entities.DatabaseMetrics), args.Error(1)
}

func (m *MockMetricsRepository) GetLatest(ctx context.Context, connectionID string) (*entities.DatabaseMetrics, error) {
	args := m.Called(ctx, connectionID)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*entities.DatabaseMetrics), args.Error(1)
}

func (m *MockMetricsRepository) GetByConnectionID(ctx context.Context, connectionID string, limit, offset int) ([]*entities.DatabaseMetrics, error) {
	args := m.Called(ctx, connectionID, limit, offset)
	return args.Get(0).([]*entities.DatabaseMetrics), args.Error(1)
}

func (m *MockMetricsRepository) GetByDateRange(ctx context.Context, connectionID string, startTime, endTime time.Time, limit, offset int) ([]*entities.DatabaseMetrics, error) {
	args := m.Called(ctx, connectionID, startTime, endTime, limit, offset)
	return args.Get(0).([]*entities.DatabaseMetrics), args.Error(1)
}

func (m *MockMetricsRepository) GetAverageMetrics(ctx context.Context, connectionID string, startTime, endTime time.Time) (*entities.DatabaseMetrics, error) {
	args := m.Called(ctx, connectionID, startTime, endTime)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*entities.DatabaseMetrics), args.Error(1)
}

func (m *MockMetricsRepository) Delete(ctx context.Context, id string) error {
	args := m.Called(ctx, id)
	return args.Error(0)
}

func (m *MockMetricsRepository) DeleteOldMetrics(ctx context.Context, olderThanDays int) (int64, error) {
	args := m.Called(ctx, olderThanDays)
	return args.Get(0).(int64), args.Error(1)
}

func (m *MockMetricsRepository) Count(ctx context.Context, connectionID string) (int64, error) {
	args := m.Called(ctx, connectionID)
	return args.Get(0).(int64), args.Error(1)
}

func (m *MockMetricsRepository) GetMetricsSummary(ctx context.Context, connectionID string, days int) (*repositories.MetricsSummary, error) {
	args := m.Called(ctx, connectionID, days)
	return args.Get(0).(*repositories.MetricsSummary), args.Error(1)
}

func (m *MockMetricsRepository) Exists(ctx context.Context, id string) (bool, error) {
	args := m.Called(ctx, id)
	return args.Bool(0), args.Error(1)
}

// MockAlertRepository is a mock implementation of AlertRepository
type MockAlertRepository struct {
	mock.Mock
}

func (m *MockAlertRepository) Create(ctx context.Context, alert *entities.Alert) error {
	args := m.Called(ctx, alert)
	return args.Error(0)
}

func (m *MockAlertRepository) GetByID(ctx context.Context, id string) (*entities.Alert, error) {
	args := m.Called(ctx, id)
	return args.Get(0).(*entities.Alert), args.Error(1)
}

func (m *MockAlertRepository) Update(ctx context.Context, alert *entities.Alert) error {
	args := m.Called(ctx, alert)
	return args.Error(0)
}

func (m *MockAlertRepository) Delete(ctx context.Context, id string) error {
	args := m.Called(ctx, id)
	return args.Error(0)
}

func (m *MockAlertRepository) GetByUserID(ctx context.Context, userID string, limit, offset int) ([]*entities.Alert, error) {
	args := m.Called(ctx, userID, limit, offset)
	return args.Get(0).([]*entities.Alert), args.Error(1)
}

func (m *MockAlertRepository) GetByConnectionID(ctx context.Context, connectionID string, limit, offset int) ([]*entities.Alert, error) {
	args := m.Called(ctx, connectionID, limit, offset)
	return args.Get(0).([]*entities.Alert), args.Error(1)
}

func (m *MockAlertRepository) GetActiveAlerts(ctx context.Context, userID string) ([]*entities.Alert, error) {
	args := m.Called(ctx, userID)
	return args.Get(0).([]*entities.Alert), args.Error(1)
}

func (m *MockAlertRepository) GetByStatus(ctx context.Context, status string, limit, offset int) ([]*entities.Alert, error) {
	args := m.Called(ctx, status, limit, offset)
	return args.Get(0).([]*entities.Alert), args.Error(1)
}

func (m *MockAlertRepository) GetBySeverity(ctx context.Context, severity string, limit, offset int) ([]*entities.Alert, error) {
	args := m.Called(ctx, severity, limit, offset)
	return args.Get(0).([]*entities.Alert), args.Error(1)
}

func (m *MockAlertRepository) GetByType(ctx context.Context, alertType string, limit, offset int) ([]*entities.Alert, error) {
	args := m.Called(ctx, alertType, limit, offset)
	return args.Get(0).([]*entities.Alert), args.Error(1)
}

func (m *MockAlertRepository) GetByDateRange(ctx context.Context, userID string, startDate, endDate time.Time, limit, offset int) ([]*entities.Alert, error) {
	args := m.Called(ctx, userID, startDate, endDate, limit, offset)
	return args.Get(0).([]*entities.Alert), args.Error(1)
}

func (m *MockAlertRepository) Resolve(ctx context.Context, alertID string) error {
	args := m.Called(ctx, alertID)
	return args.Error(0)
}

func (m *MockAlertRepository) Mute(ctx context.Context, alertID string) error {
	args := m.Called(ctx, alertID)
	return args.Error(0)
}

func (m *MockAlertRepository) Reactivate(ctx context.Context, alertID string) error {
	args := m.Called(ctx, alertID)
	return args.Error(0)
}

func (m *MockAlertRepository) Count(ctx context.Context, userID string) (int64, error) {
	args := m.Called(ctx, userID)
	return args.Get(0).(int64), args.Error(1)
}

func (m *MockAlertRepository) CountByStatus(ctx context.Context, userID, status string) (int64, error) {
	args := m.Called(ctx, userID, status)
	return args.Get(0).(int64), args.Error(1)
}

func (m *MockAlertRepository) CountBySeverity(ctx context.Context, userID, severity string) (int64, error) {
	args := m.Called(ctx, userID, severity)
	return args.Get(0).(int64), args.Error(1)
}

func (m *MockAlertRepository) GetAlertStats(ctx context.Context, userID string, days int) (*repositories.AlertStats, error) {
	args := m.Called(ctx, userID, days)
	return args.Get(0).(*repositories.AlertStats), args.Error(1)
}

func (m *MockAlertRepository) DeleteOldAlerts(ctx context.Context, olderThanDays int) (int64, error) {
	args := m.Called(ctx, olderThanDays)
	return args.Get(0).(int64), args.Error(1)
}

func (m *MockAlertRepository) Exists(ctx context.Context, id string) (bool, error) {
	args := m.Called(ctx, id)
	return args.Bool(0), args.Error(1)
}

func (m *MockAlertRepository) GetUnresolvedAlerts(ctx context.Context, olderThan time.Duration) ([]*entities.Alert, error) {
	args := m.Called(ctx, olderThan)
	return args.Get(0).([]*entities.Alert), args.Error(1)
}

// MockConnectionRepository is a mock implementation of ConnectionRepository
type MockConnectionRepository struct {
	mock.Mock
}

func (m *MockConnectionRepository) Create(ctx context.Context, conn *entities.Connection) error {
	args := m.Called(ctx, conn)
	return args.Error(0)
}

func (m *MockConnectionRepository) GetByID(ctx context.Context, id string) (*entities.Connection, error) {
	args := m.Called(ctx, id)
	return args.Get(0).(*entities.Connection), args.Error(1)
}

func (m *MockConnectionRepository) GetByUserID(ctx context.Context, userID string, limit, offset int) ([]*entities.Connection, error) {
	args := m.Called(ctx, userID, limit, offset)
	return args.Get(0).([]*entities.Connection), args.Error(1)
}

func (m *MockConnectionRepository) Update(ctx context.Context, conn *entities.Connection) error {
	args := m.Called(ctx, conn)
	return args.Error(0)
}

func (m *MockConnectionRepository) Delete(ctx context.Context, id string) error {
	args := m.Called(ctx, id)
	return args.Error(0)
}

func (m *MockConnectionRepository) GetActiveConnections(ctx context.Context, userID string) ([]*entities.Connection, error) {
	args := m.Called(ctx, userID)
	return args.Get(0).([]*entities.Connection), args.Error(1)
}

func (m *MockConnectionRepository) UpdateStatus(ctx context.Context, connectionID, status string) error {
	args := m.Called(ctx, connectionID, status)
	return args.Error(0)
}

func (m *MockConnectionRepository) MarkAsUsed(ctx context.Context, connectionID string) error {
	args := m.Called(ctx, connectionID)
	return args.Error(0)
}

func TestMetricsService_CollectMetrics(t *testing.T) {
	// Setup mocks
	mockMetricsRepo := &MockMetricsRepository{}
	mockAlertRepo := &MockAlertRepository{}
	mockConnRepo := &MockConnectionRepository{}

	// Create service
	service := NewMetricsService(mockMetricsRepo, mockAlertRepo, mockConnRepo)

	// Test data
	ctx := context.Background()
	connectionID := "conn-123"
	connection := &entities.Connection{
		ID:   connectionID,
		Type: "postgresql",
		Name: "Test DB",
		Host: "localhost",
		Port: 5432,
	}

	// Setup mock expectations
	mockConnRepo.On("GetByID", ctx, connectionID).Return(connection, nil)
	mockMetricsRepo.On("Create", ctx, mock.AnythingOfType("*entities.DatabaseMetrics")).Return(nil)

	// Execute test
	metrics, err := service.CollectMetrics(ctx, connectionID)

	// Assertions
	require.NoError(t, err)
	assert.NotNil(t, metrics)
	assert.Equal(t, connectionID, metrics.ConnectionID)

	// Verify mocks were called
	mockConnRepo.AssertExpectations(t)
	mockMetricsRepo.AssertExpectations(t)
}

func TestMetricsService_CollectMetrics_ConnectionNotFound(t *testing.T) {
	// Setup mocks
	mockMetricsRepo := &MockMetricsRepository{}
	mockAlertRepo := &MockAlertRepository{}
	mockConnRepo := &MockConnectionRepository{}

	// Create service
	service := NewMetricsService(mockMetricsRepo, mockAlertRepo, mockConnRepo)

	// Test data
	ctx := context.Background()
	connectionID := "conn-123"

	// Setup mock expectations
	mockConnRepo.On("GetByID", ctx, connectionID).Return(nil, assert.AnError)

	// Execute test
	metrics, err := service.CollectMetrics(ctx, connectionID)

	// Assertions
	require.Error(t, err)
	assert.Nil(t, metrics)
	assert.Contains(t, err.Error(), "failed to get connection")

	// Verify mocks were called
	mockConnRepo.AssertExpectations(t)
}

func TestMetricsService_GetLatestMetrics(t *testing.T) {
	// Setup mocks
	mockMetricsRepo := &MockMetricsRepository{}
	mockAlertRepo := &MockAlertRepository{}
	mockConnRepo := &MockConnectionRepository{}

	// Create service
	service := NewMetricsService(mockMetricsRepo, mockAlertRepo, mockConnRepo)

	// Test data
	ctx := context.Background()
	connectionID := "conn-123"
	expectedMetrics := &entities.DatabaseMetrics{
		ID:           "metrics-123",
		ConnectionID: connectionID,
		CPUUsage:     75.5,
	}

	// Setup mock expectations
	mockMetricsRepo.On("GetLatest", ctx, connectionID).Return(expectedMetrics, nil)

	// Execute test
	metrics, err := service.GetLatestMetrics(ctx, connectionID)

	// Assertions
	require.NoError(t, err)
	assert.Equal(t, expectedMetrics, metrics)

	// Verify mocks were called
	mockMetricsRepo.AssertExpectations(t)
}

func TestMetricsService_StartMonitoring(t *testing.T) {
	// Setup mocks
	mockMetricsRepo := &MockMetricsRepository{}
	mockAlertRepo := &MockAlertRepository{}
	mockConnRepo := &MockConnectionRepository{}

	// Create service
	service := NewMetricsService(mockMetricsRepo, mockAlertRepo, mockConnRepo)

	// Test data
	ctx := context.Background()
	connectionID := "conn-123"
	interval := 30 * time.Second

	// Execute test
	err := service.StartMonitoring(ctx, connectionID, interval)

	// Assertions
	require.NoError(t, err)

	// Check that monitoring job was created
	activeJobs := service.GetActiveMonitoringJobs()
	assert.Equal(t, 1, activeJobs)

	// Test that starting monitoring again for the same connection fails
	err = service.StartMonitoring(ctx, connectionID, interval)
	require.Error(t, err)
	assert.Contains(t, err.Error(), "monitoring already active")

	// Stop monitoring
	err = service.StopMonitoring(ctx, connectionID)
	require.NoError(t, err)

	// Check that monitoring job was removed
	activeJobs = service.GetActiveMonitoringJobs()
	assert.Equal(t, 0, activeJobs)
}

func TestMetricsService_StopMonitoring_NotActive(t *testing.T) {
	// Setup mocks
	mockMetricsRepo := &MockMetricsRepository{}
	mockAlertRepo := &MockAlertRepository{}
	mockConnRepo := &MockConnectionRepository{}

	// Create service
	service := NewMetricsService(mockMetricsRepo, mockAlertRepo, mockConnRepo)

	// Test data
	ctx := context.Background()
	connectionID := "conn-123"

	// Execute test
	err := service.StopMonitoring(ctx, connectionID)

	// Assertions
	require.Error(t, err)
	assert.Contains(t, err.Error(), "no active monitoring")
}

func TestMetricsService_CheckThresholds(t *testing.T) {
	// Setup mocks
	mockMetricsRepo := &MockMetricsRepository{}
	mockAlertRepo := &MockAlertRepository{}
	mockConnRepo := &MockConnectionRepository{}

	// Create service
	service := NewMetricsService(mockMetricsRepo, mockAlertRepo, mockConnRepo)

	// Test data
	ctx := context.Background()
	userID := "user-123"
	connectionID := "conn-123"
	connection := &entities.Connection{
		ID:     connectionID,
		UserID: userID,
		Type:   "postgresql",
		Name:   "Test DB",
		Host:   "localhost",
		Port:   5432,
	}

	metrics := &entities.DatabaseMetrics{
		ID:                "metrics-123",
		ConnectionID:      connectionID,
		CPUUsage:          85.0,  // Above threshold of 80
		MemoryUsage:       90.0,  // Above threshold of 85
		DiskUsage:         95.0,  // Above threshold of 90
		ActiveConnections: 150,   // Above threshold of 100
		QueriesPerSecond:  1000.0,
		AverageQueryTime:  6000.0, // Above threshold of 5000
		Timestamp:         time.Now(),
	}

	// Setup mock expectations
	mockConnRepo.On("GetByID", ctx, connectionID).Return(connection, nil)

	// Execute test
	alerts, err := service.CheckThresholds(ctx, metrics)

	// Assertions
	require.NoError(t, err)
	assert.Len(t, alerts, 5) // All thresholds exceeded

	// Check that alerts have correct properties
	for _, alert := range alerts {
		assert.Equal(t, userID, alert.UserID)
		assert.Equal(t, connectionID, alert.ConnectionID)
		assert.True(t, alert.IsActive())
	}

	// Verify mocks were called
	mockConnRepo.AssertExpectations(t)
}

func TestMetricsService_CheckThresholds_NoThresholdsExceeded(t *testing.T) {
	// Setup mocks
	mockMetricsRepo := &MockMetricsRepository{}
	mockAlertRepo := &MockAlertRepository{}
	mockConnRepo := &MockConnectionRepository{}

	// Create service
	service := NewMetricsService(mockMetricsRepo, mockAlertRepo, mockConnRepo)

	// Test data
	ctx := context.Background()
	userID := "user-123"
	connectionID := "conn-123"
	connection := &entities.Connection{
		ID:     connectionID,
		UserID: userID,
		Type:   "postgresql",
		Name:   "Test DB",
		Host:   "localhost",
		Port:   5432,
	}

	metrics := &entities.DatabaseMetrics{
		ID:                "metrics-123",
		ConnectionID:      connectionID,
		CPUUsage:          50.0,  // Below threshold of 80
		MemoryUsage:       60.0,  // Below threshold of 85
		DiskUsage:         70.0,  // Below threshold of 90
		ActiveConnections: 50,    // Below threshold of 100
		QueriesPerSecond:  1000.0,
		AverageQueryTime:  2000.0, // Below threshold of 5000
		Timestamp:         time.Now(),
	}

	// Setup mock expectations
	mockConnRepo.On("GetByID", ctx, connectionID).Return(connection, nil)

	// Execute test
	alerts, err := service.CheckThresholds(ctx, metrics)

	// Assertions
	require.NoError(t, err)
	assert.Len(t, alerts, 0) // No thresholds exceeded

	// Verify mocks were called
	mockConnRepo.AssertExpectations(t)
}

func TestMetricsService_GetMetricsHistory(t *testing.T) {
	// Setup mocks
	mockMetricsRepo := &MockMetricsRepository{}
	mockAlertRepo := &MockAlertRepository{}
	mockConnRepo := &MockConnectionRepository{}

	// Create service
	service := NewMetricsService(mockMetricsRepo, mockAlertRepo, mockConnRepo)

	// Test data
	ctx := context.Background()
	connectionID := "conn-123"
	startTime := time.Now().Add(-24 * time.Hour)
	endTime := time.Now()
	limit := 100
	offset := 0

	expectedMetrics := []*entities.DatabaseMetrics{
		{
			ID:           "metrics-1",
			ConnectionID: connectionID,
			CPUUsage:     75.5,
		},
		{
			ID:           "metrics-2",
			ConnectionID: connectionID,
			CPUUsage:     80.0,
		},
	}

	// Setup mock expectations
	mockMetricsRepo.On("GetByDateRange", ctx, connectionID, startTime, endTime, limit, offset).Return(expectedMetrics, nil)

	// Execute test
	metrics, err := service.GetMetricsHistory(ctx, connectionID, startTime, endTime, limit, offset)

	// Assertions
	require.NoError(t, err)
	assert.Len(t, metrics, 2)
	assert.Equal(t, expectedMetrics, metrics)

	// Verify mocks were called
	mockMetricsRepo.AssertExpectations(t)
}

func TestMetricsService_GetAverageMetrics(t *testing.T) {
	// Setup mocks
	mockMetricsRepo := &MockMetricsRepository{}
	mockAlertRepo := &MockAlertRepository{}
	mockConnRepo := &MockConnectionRepository{}

	// Create service
	service := NewMetricsService(mockMetricsRepo, mockAlertRepo, mockConnRepo)

	// Test data
	ctx := context.Background()
	connectionID := "conn-123"
	startTime := time.Now().Add(-24 * time.Hour)
	endTime := time.Now()

	expectedMetrics := &entities.DatabaseMetrics{
		ID:           "avg-metrics",
		ConnectionID: connectionID,
		CPUUsage:     77.5, // Average
		MemoryUsage:  82.5,
	}

	// Setup mock expectations
	mockMetricsRepo.On("GetAverageMetrics", ctx, connectionID, startTime, endTime).Return(expectedMetrics, nil)

	// Execute test
	metrics, err := service.GetAverageMetrics(ctx, connectionID, startTime, endTime)

	// Assertions
	require.NoError(t, err)
	assert.Equal(t, expectedMetrics, metrics)

	// Verify mocks were called
	mockMetricsRepo.AssertExpectations(t)
}