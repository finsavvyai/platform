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

// MockUserRepository is a mock implementation of UserRepository
type MockUserRepository struct {
	mock.Mock
}

func (m *MockUserRepository) Create(ctx context.Context, email, name string) (*entities.User, error) {
	args := m.Called(ctx, email, name)
	return args.Get(0).(*entities.User), args.Error(1)
}

func (m *MockUserRepository) GetByID(ctx context.Context, id string) (*entities.User, error) {
	args := m.Called(ctx, id)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*entities.User), args.Error(1)
}

func (m *MockUserRepository) GetByEmail(ctx context.Context, email string) (*entities.User, error) {
	args := m.Called(ctx, email)
	return args.Get(0).(*entities.User), args.Error(1)
}

func (m *MockUserRepository) Update(ctx context.Context, user *entities.User) error {
	args := m.Called(ctx, user)
	return args.Error(0)
}

func (m *MockUserRepository) Delete(ctx context.Context, id string) error {
	args := m.Called(ctx, id)
	return args.Error(0)
}

func (m *MockUserRepository) UpdateProfile(ctx context.Context, userID, name string) error {
	args := m.Called(ctx, userID, name)
	return args.Error(0)
}

func (m *MockUserRepository) SetRole(ctx context.Context, userID, role string) error {
	args := m.Called(ctx, userID, role)
	return args.Error(0)
}

func (m *MockUserRepository) SetPlan(ctx context.Context, userID, plan string) error {
	args := m.Called(ctx, userID, plan)
	return args.Error(0)
}

func (m *MockUserRepository) List(ctx context.Context, limit, offset int) ([]*entities.User, error) {
	args := m.Called(ctx, limit, offset)
	return args.Get(0).([]*entities.User), args.Error(1)
}

func (m *MockUserRepository) Count(ctx context.Context) (int64, error) {
	args := m.Called(ctx)
	return args.Get(0).(int64), args.Error(1)
}

func TestAlertService_Create(t *testing.T) {
	// Setup mocks
	mockAlertRepo := &MockAlertRepository{}
	mockUserRepo := &MockUserRepository{}
	mockConnRepo := &MockConnectionRepository{}

	// Create service
	service := NewAlertService(mockAlertRepo, mockUserRepo, mockConnRepo)

	// Test data
	ctx := context.Background()
	userID := "user-123"
	connectionID := "conn-123"
	alertType := entities.AlertTypeCPU
	severity := entities.SeverityHigh
	message := "CPU usage is high"
	threshold := 80.0
	currentValue := 85.0

	// Setup mock expectations
	mockAlertRepo.On("Create", ctx, mock.AnythingOfType("*entities.Alert")).Return(nil)

	// Execute test
	alert, err := service.Create(ctx, userID, connectionID, alertType, severity, message, threshold, currentValue)

	// Assertions
	require.NoError(t, err)
	assert.NotNil(t, alert)
	assert.Equal(t, userID, alert.UserID)
	assert.Equal(t, connectionID, alert.ConnectionID)
	assert.Equal(t, alertType, alert.Type)
	assert.Equal(t, severity, alert.Severity)
	assert.Equal(t, message, alert.Message)
	assert.Equal(t, threshold, alert.Threshold)
	assert.Equal(t, currentValue, alert.CurrentValue)
	assert.True(t, alert.IsActive())

	// Verify mocks were called
	mockAlertRepo.AssertExpectations(t)
}

func TestAlertService_Create_InvalidParameters(t *testing.T) {
	// Setup mocks
	mockAlertRepo := &MockAlertRepository{}
	mockUserRepo := &MockUserRepository{}
	mockConnRepo := &MockConnectionRepository{}

	// Create service
	service := NewAlertService(mockAlertRepo, mockUserRepo, mockConnRepo)

	// Test data
	ctx := context.Background()
	userID := "" // Invalid empty user ID
	connectionID := "conn-123"
	alertType := entities.AlertTypeCPU
	severity := entities.SeverityHigh
	message := "CPU usage is high"
	threshold := 80.0
	currentValue := 85.0

	// Execute test
	alert, err := service.Create(ctx, userID, connectionID, alertType, severity, message, threshold, currentValue)

	// Assertions
	require.Error(t, err)
	assert.Nil(t, alert)
	assert.Contains(t, err.Error(), "invalid alert parameters")
}

func TestAlertService_GetByID(t *testing.T) {
	// Setup mocks
	mockAlertRepo := &MockAlertRepository{}
	mockUserRepo := &MockUserRepository{}
	mockConnRepo := &MockConnectionRepository{}

	// Create service
	service := NewAlertService(mockAlertRepo, mockUserRepo, mockConnRepo)

	// Test data
	ctx := context.Background()
	alertID := "alert-123"
	expectedAlert := &entities.Alert{
		ID:     alertID,
		UserID: "user-123",
		Type:   entities.AlertTypeCPU,
		Status: entities.AlertStatusActive,
	}

	// Setup mock expectations
	mockAlertRepo.On("GetByID", ctx, alertID).Return(expectedAlert, nil)

	// Execute test
	alert, err := service.GetByID(ctx, alertID)

	// Assertions
	require.NoError(t, err)
	assert.Equal(t, expectedAlert, alert)

	// Verify mocks were called
	mockAlertRepo.AssertExpectations(t)
}

func TestAlertService_Resolve(t *testing.T) {
	// Setup mocks
	mockAlertRepo := &MockAlertRepository{}
	mockUserRepo := &MockUserRepository{}
	mockConnRepo := &MockConnectionRepository{}

	// Create service
	service := NewAlertService(mockAlertRepo, mockUserRepo, mockConnRepo)

	// Test data
	ctx := context.Background()
	alertID := "alert-123"
	alert := &entities.Alert{
		ID:     alertID,
		UserID: "user-123",
		Type:   entities.AlertTypeCPU,
		Status: entities.AlertStatusActive,
	}

	// Setup mock expectations
	mockAlertRepo.On("GetByID", ctx, alertID).Return(alert, nil)
	mockAlertRepo.On("Update", ctx, alert).Return(nil)

	// Execute test
	err := service.Resolve(ctx, alertID)

	// Assertions
	require.NoError(t, err)
	assert.True(t, alert.IsResolved())
	assert.NotNil(t, alert.ResolvedAt)

	// Verify mocks were called
	mockAlertRepo.AssertExpectations(t)
}

func TestAlertService_Resolve_AlreadyResolved(t *testing.T) {
	// Setup mocks
	mockAlertRepo := &MockAlertRepository{}
	mockUserRepo := &MockUserRepository{}
	mockConnRepo := &MockConnectionRepository{}

	// Create service
	service := NewAlertService(mockAlertRepo, mockUserRepo, mockConnRepo)

	// Test data
	ctx := context.Background()
	alertID := "alert-123"
	now := time.Now()
	alert := &entities.Alert{
		ID:         alertID,
		UserID:     "user-123",
		Type:       entities.AlertTypeCPU,
		Status:     entities.AlertStatusResolved,
		ResolvedAt: &now,
	}

	// Setup mock expectations
	mockAlertRepo.On("GetByID", ctx, alertID).Return(alert, nil)

	// Execute test
	err := service.Resolve(ctx, alertID)

	// Assertions
	require.Error(t, err)
	assert.Contains(t, err.Error(), "already resolved")

	// Verify mocks were called
	mockAlertRepo.AssertExpectations(t)
}

func TestAlertService_Mute(t *testing.T) {
	// Setup mocks
	mockAlertRepo := &MockAlertRepository{}
	mockUserRepo := &MockUserRepository{}
	mockConnRepo := &MockConnectionRepository{}

	// Create service
	service := NewAlertService(mockAlertRepo, mockUserRepo, mockConnRepo)

	// Test data
	ctx := context.Background()
	alertID := "alert-123"
	alert := &entities.Alert{
		ID:     alertID,
		UserID: "user-123",
		Type:   entities.AlertTypeCPU,
		Status: entities.AlertStatusActive,
	}

	// Setup mock expectations
	mockAlertRepo.On("GetByID", ctx, alertID).Return(alert, nil)
	mockAlertRepo.On("Update", ctx, alert).Return(nil)

	// Execute test
	err := service.Mute(ctx, alertID)

	// Assertions
	require.NoError(t, err)
	assert.True(t, alert.IsMuted())

	// Verify mocks were called
	mockAlertRepo.AssertExpectations(t)
}

func TestAlertService_Reactivate(t *testing.T) {
	// Setup mocks
	mockAlertRepo := &MockAlertRepository{}
	mockUserRepo := &MockUserRepository{}
	mockConnRepo := &MockConnectionRepository{}

	// Create service
	service := NewAlertService(mockAlertRepo, mockUserRepo, mockConnRepo)

	// Test data
	ctx := context.Background()
	alertID := "alert-123"
	alert := &entities.Alert{
		ID:     alertID,
		UserID: "user-123",
		Type:   entities.AlertTypeCPU,
		Status: entities.AlertStatusMuted,
	}

	// Setup mock expectations
	mockAlertRepo.On("GetByID", ctx, alertID).Return(alert, nil)
	mockAlertRepo.On("Update", ctx, alert).Return(nil)

	// Execute test
	err := service.Reactivate(ctx, alertID)

	// Assertions
	require.NoError(t, err)
	assert.True(t, alert.IsActive())
	assert.Nil(t, alert.ResolvedAt)

	// Verify mocks were called
	mockAlertRepo.AssertExpectations(t)
}

func TestAlertService_GetActiveAlerts(t *testing.T) {
	// Setup mocks
	mockAlertRepo := &MockAlertRepository{}
	mockUserRepo := &MockUserRepository{}
	mockConnRepo := &MockConnectionRepository{}

	// Create service
	service := NewAlertService(mockAlertRepo, mockUserRepo, mockConnRepo)

	// Test data
	ctx := context.Background()
	userID := "user-123"
	expectedAlerts := []*entities.Alert{
		{
			ID:     "alert-1",
			UserID: userID,
			Type:   entities.AlertTypeCPU,
			Status: entities.AlertStatusActive,
		},
		{
			ID:     "alert-2",
			UserID: userID,
			Type:   entities.AlertTypeMemory,
			Status: entities.AlertStatusActive,
		},
	}

	// Setup mock expectations
	mockAlertRepo.On("GetActiveAlerts", ctx, userID).Return(expectedAlerts, nil)

	// Execute test
	alerts, err := service.GetActiveAlerts(ctx, userID)

	// Assertions
	require.NoError(t, err)
	assert.Len(t, alerts, 2)
	assert.Equal(t, expectedAlerts, alerts)

	// Verify mocks were called
	mockAlertRepo.AssertExpectations(t)
}

func TestAlertService_ProcessMetrics(t *testing.T) {
	// Setup mocks
	mockAlertRepo := &MockAlertRepository{}
	mockUserRepo := &MockUserRepository{}
	mockConnRepo := &MockConnectionRepository{}

	// Create service
	service := NewAlertService(mockAlertRepo, mockUserRepo, mockConnRepo)

	// Test data
	ctx := context.Background()
	userID := "user-123"
	connectionID := "conn-123"
	connection := &entities.Connection{
		ID:     connectionID,
		UserID: userID,
		Type:   "postgresql",
		Name:   "Test DB",
	}

	metrics := &entities.DatabaseMetrics{
		ID:                "metrics-123",
		ConnectionID:      connectionID,
		CPUUsage:          85.0,  // Above threshold
		MemoryUsage:       60.0,  // Below threshold
		DiskUsage:         70.0,  // Below threshold
		ActiveConnections: 50,    // Below threshold
		QueriesPerSecond:  1000.0,
		AverageQueryTime:  2000.0, // Below threshold
		Timestamp:         time.Now(),
	}

	// Setup mock expectations
	mockConnRepo.On("GetByID", ctx, connectionID).Return(connection, nil)
	mockAlertRepo.On("GetActiveAlerts", ctx, userID).Return([]*entities.Alert{}, nil) // No existing alerts
	mockAlertRepo.On("Create", ctx, mock.AnythingOfType("*entities.Alert")).Return(nil)
	mockAlertRepo.On("Update", ctx, mock.AnythingOfType("*entities.Alert")).Return(nil)

	// Execute test
	err := service.ProcessMetrics(ctx, metrics)

	// Assertions
	require.NoError(t, err)

	// Verify mocks were called
	mockConnRepo.AssertExpectations(t)
	mockAlertRepo.AssertExpectations(t)
}

func TestAlertService_ProcessMetrics_ExistingAlert(t *testing.T) {
	// Setup mocks
	mockAlertRepo := &MockAlertRepository{}
	mockUserRepo := &MockUserRepository{}
	mockConnRepo := &MockConnectionRepository{}

	// Create service
	service := NewAlertService(mockAlertRepo, mockUserRepo, mockConnRepo)

	// Test data
	ctx := context.Background()
	userID := "user-123"
	connectionID := "conn-123"
	connection := &entities.Connection{
		ID:     connectionID,
		UserID: userID,
		Type:   "postgresql",
		Name:   "Test DB",
	}

	existingAlert := &entities.Alert{
		ID:           "alert-123",
		UserID:       userID,
		ConnectionID: connectionID,
		Type:         entities.AlertTypeCPU,
		Status:       entities.AlertStatusActive,
	}

	metrics := &entities.DatabaseMetrics{
		ID:                "metrics-123",
		ConnectionID:      connectionID,
		CPUUsage:          85.0,  // Above threshold, but alert already exists
		MemoryUsage:       60.0,  // Below threshold
		DiskUsage:         70.0,  // Below threshold
		ActiveConnections: 50,    // Below threshold
		QueriesPerSecond:  1000.0,
		AverageQueryTime:  2000.0, // Below threshold
		Timestamp:         time.Now(),
	}

	// Setup mock expectations
	mockConnRepo.On("GetByID", ctx, connectionID).Return(connection, nil)
	mockAlertRepo.On("GetActiveAlerts", ctx, userID).Return([]*entities.Alert{existingAlert}, nil)

	// Execute test
	err := service.ProcessMetrics(ctx, metrics)

	// Assertions
	require.NoError(t, err)

	// Verify mocks were called - no new alert should be created
	mockConnRepo.AssertExpectations(t)
	mockAlertRepo.AssertExpectations(t)
	mockAlertRepo.AssertNotCalled(t, "Create")
}

func TestAlertService_GetAlertStats(t *testing.T) {
	// Setup mocks
	mockAlertRepo := &MockAlertRepository{}
	mockUserRepo := &MockUserRepository{}
	mockConnRepo := &MockConnectionRepository{}

	// Create service
	service := NewAlertService(mockAlertRepo, mockUserRepo, mockConnRepo)

	// Test data
	ctx := context.Background()
	userID := "user-123"
	days := 7
	expectedStats := &repositories.AlertStats{
		TotalAlerts:    10,
		ActiveAlerts:   3,
		ResolvedAlerts: 7,
		MutedAlerts:    0,
		AlertsBySeverity: map[string]int64{
			"low":      2,
			"medium":   4,
			"high":     3,
			"critical": 1,
		},
	}

	// Setup mock expectations
	mockAlertRepo.On("GetAlertStats", ctx, userID, days).Return(expectedStats, nil)

	// Execute test
	stats, err := service.GetAlertStats(ctx, userID, days)

	// Assertions
	require.NoError(t, err)
	assert.Equal(t, expectedStats, stats)

	// Verify mocks were called
	mockAlertRepo.AssertExpectations(t)
}

func TestAlertService_SendNotification(t *testing.T) {
	// Setup mocks
	mockAlertRepo := &MockAlertRepository{}
	mockUserRepo := &MockUserRepository{}
	mockConnRepo := &MockConnectionRepository{}

	// Create service
	service := NewAlertService(mockAlertRepo, mockUserRepo, mockConnRepo)

	// Test data
	ctx := context.Background()
	userID := "user-123"
	connectionID := "conn-123"
	user := &entities.User{
		ID:    userID,
		Email: "test@example.com",
		Name:  "Test User",
	}
	connection := &entities.Connection{
		ID:   connectionID,
		Name: "Test DB",
	}
	alert := &entities.Alert{
		ID:           "alert-123",
		UserID:       userID,
		ConnectionID: connectionID,
		Type:         entities.AlertTypeCPU,
		Severity:     entities.SeverityHigh,
		Message:      "CPU usage is high",
		Threshold:    80.0,
		CurrentValue: 85.0,
		Status:       entities.AlertStatusActive,
		CreatedAt:    time.Now(),
	}

	// Setup mock expectations
	mockUserRepo.On("GetByID", ctx, userID).Return(user, nil)
	mockConnRepo.On("GetByID", ctx, connectionID).Return(connection, nil)

	// Execute test
	err := service.SendNotification(ctx, alert)

	// Assertions
	require.NoError(t, err)

	// Verify mocks were called
	mockUserRepo.AssertExpectations(t)
	mockConnRepo.AssertExpectations(t)
}

func TestAlertService_BatchResolve(t *testing.T) {
	// Setup mocks
	mockAlertRepo := &MockAlertRepository{}
	mockUserRepo := &MockUserRepository{}
	mockConnRepo := &MockConnectionRepository{}

	// Create service
	service := NewAlertService(mockAlertRepo, mockUserRepo, mockConnRepo)

	// Test data
	ctx := context.Background()
	alertIDs := []string{"alert-1", "alert-2", "alert-3"}
	alerts := []*entities.Alert{
		{ID: "alert-1", Status: entities.AlertStatusActive},
		{ID: "alert-2", Status: entities.AlertStatusActive},
		{ID: "alert-3", Status: entities.AlertStatusActive},
	}

	// Setup mock expectations
	for i, alertID := range alertIDs {
		mockAlertRepo.On("GetByID", ctx, alertID).Return(alerts[i], nil)
		mockAlertRepo.On("Update", ctx, alerts[i]).Return(nil)
	}

	// Execute test
	err := service.BatchResolve(ctx, alertIDs)

	// Assertions
	require.NoError(t, err)

	// Verify all alerts are resolved
	for _, alert := range alerts {
		assert.True(t, alert.IsResolved())
	}

	// Verify mocks were called
	mockAlertRepo.AssertExpectations(t)
}

func TestAlertService_BatchMute(t *testing.T) {
	// Setup mocks
	mockAlertRepo := &MockAlertRepository{}
	mockUserRepo := &MockUserRepository{}
	mockConnRepo := &MockConnectionRepository{}

	// Create service
	service := NewAlertService(mockAlertRepo, mockUserRepo, mockConnRepo)

	// Test data
	ctx := context.Background()
	alertIDs := []string{"alert-1", "alert-2"}
	alerts := []*entities.Alert{
		{ID: "alert-1", Status: entities.AlertStatusActive},
		{ID: "alert-2", Status: entities.AlertStatusActive},
	}

	// Setup mock expectations
	for i, alertID := range alertIDs {
		mockAlertRepo.On("GetByID", ctx, alertID).Return(alerts[i], nil)
		mockAlertRepo.On("Update", ctx, alerts[i]).Return(nil)
	}

	// Execute test
	err := service.BatchMute(ctx, alertIDs)

	// Assertions
	require.NoError(t, err)

	// Verify all alerts are muted
	for _, alert := range alerts {
		assert.True(t, alert.IsMuted())
	}

	// Verify mocks were called
	mockAlertRepo.AssertExpectations(t)
}

func TestAlertService_CleanupOldAlerts(t *testing.T) {
	// Setup mocks
	mockAlertRepo := &MockAlertRepository{}
	mockUserRepo := &MockUserRepository{}
	mockConnRepo := &MockConnectionRepository{}

	// Create service
	service := NewAlertService(mockAlertRepo, mockUserRepo, mockConnRepo)

	// Test data
	ctx := context.Background()
	olderThanDays := 30
	expectedDeletedCount := int64(5)

	// Setup mock expectations
	mockAlertRepo.On("DeleteOldAlerts", ctx, olderThanDays).Return(expectedDeletedCount, nil)

	// Execute test
	deletedCount, err := service.CleanupOldAlerts(ctx, olderThanDays)

	// Assertions
	require.NoError(t, err)
	assert.Equal(t, expectedDeletedCount, deletedCount)

	// Verify mocks were called
	mockAlertRepo.AssertExpectations(t)
}

func TestAlertService_calculateSeverity(t *testing.T) {
	service := &alertService{}

	testCases := []struct {
		name           string
		value          float64
		threshold      float64
		expectedResult string
	}{
		{
			name:           "Below threshold",
			value:          70.0,
			threshold:      80.0,
			expectedResult: entities.SeverityLow,
		},
		{
			name:           "Just at threshold",
			value:          80.0,
			threshold:      80.0,
			expectedResult: entities.SeverityMedium,
		},
		{
			name:           "Slightly above threshold",
			value:          90.0,
			threshold:      80.0,
			expectedResult: entities.SeverityMedium,
		},
		{
			name:           "1.5x threshold",
			value:          120.0,
			threshold:      80.0,
			expectedResult: entities.SeverityHigh,
		},
		{
			name:           "2x threshold",
			value:          160.0,
			threshold:      80.0,
			expectedResult: entities.SeverityCritical,
		},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			result := service.calculateSeverity(tc.value, tc.threshold)
			assert.Equal(t, tc.expectedResult, result)
		})
	}
}

func TestAlertService_getAlertTypeDisplayName(t *testing.T) {
	service := &alertService{}

	testCases := []struct {
		alertType       string
		expectedName    string
	}{
		{entities.AlertTypeCPU, "CPU Usage"},
		{entities.AlertTypeMemory, "Memory Usage"},
		{entities.AlertTypeDisk, "Disk Usage"},
		{entities.AlertTypeConnections, "Active Connections"},
		{entities.AlertTypeQueryTime, "Average Query Time"},
		{entities.AlertTypeError, "error"},
		{"unknown_type", "unknown_type"},
	}

	for _, tc := range testCases {
		t.Run(tc.alertType, func(t *testing.T) {
			result := service.getAlertTypeDisplayName(tc.alertType)
			assert.Equal(t, tc.expectedName, result)
		})
	}
}