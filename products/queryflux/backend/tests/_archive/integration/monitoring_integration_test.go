package integration

import (
	"context"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"github.com/stretchr/testify/suite"

	"github.com/queryflux/backend/internal/domain/entities"
	"github.com/queryflux/backend/internal/services"
	"github.com/queryflux/backend/tests/testutils"
)

// MonitoringIntegrationTestSuite tests the complete monitoring and alerting system
type MonitoringIntegrationTestSuite struct {
	suite.Suite
	testContainer *testutils.TestContainer
	metricsService services.MetricsService
	alertService   services.AlertService
	connectionRepo repositories.ConnectionRepository
	metricsRepo    repositories.MetricsRepository
	alertRepo      repositories.AlertRepository
	userRepo       repositories.UserRepository
	testUser       *entities.User
	testConnection *entities.Connection
}

func TestMonitoringIntegrationSuite(t *testing.T) {
	suite.Run(t, new(MonitoringIntegrationTestSuite))
}

func (suite *MonitoringIntegrationTestSuite) SetupSuite() {
	// Initialize test container with PostgreSQL
	container, err := testutils.NewTestContainer(testutils.PostgreSQL)
	require.NoError(suite.T(), err)
	suite.testContainer = container

	// Initialize repositories
	suite.connectionRepo = testutils.NewConnectionRepository(container.DB)
	suite.metricsRepo = testutils.NewMetricsRepository(container.DB)
	suite.alertRepo = testutils.NewAlertRepository(container.DB)
	suite.userRepo = testutils.NewUserRepository(container.DB)

	// Initialize services
	suite.metricsService = services.NewMetricsService(
		suite.metricsRepo,
		suite.alertRepo,
		suite.connectionRepo,
	)
	suite.alertService = services.NewAlertService(
		suite.alertRepo,
		suite.userRepo,
		suite.connectionRepo,
	)

	// Create test user
	suite.testUser = &entities.User{
		ID:    "user-test-123",
		Email: "test@example.com",
		Name:  "Test User",
	}
	err = suite.userRepo.Create(context.Background(), suite.testUser)
	require.NoError(suite.T(), err)

	// Create test connection
	suite.testConnection = &entities.Connection{
		ID:       "conn-test-123",
		UserID:   suite.testUser.ID,
		Name:     "Test PostgreSQL DB",
		Type:     "postgresql",
		Host:     container.Host,
		Port:     container.Port,
		Database: "postgres",
		Username: "postgres",
		Password: "postgres",
	}
	err = suite.connectionRepo.Create(context.Background(), suite.testConnection)
	require.NoError(suite.T(), err)
}

func (suite *MonitoringIntegrationTestSuite) TearDownSuite() {
	if suite.testContainer != nil {
		suite.testContainer.Close()
	}
}

func (suite *MonitoringIntegrationTestSuite) SetupTest() {
	// Clean up any data created during individual tests
	ctx := context.Background()

	// Delete old alerts
	oldAlerts, _ := suite.alertRepo.GetByUserID(ctx, suite.testUser.ID, 1000, 0)
	for _, alert := range oldAlerts {
		suite.alertRepo.Delete(ctx, alert.ID)
	}

	// Delete old metrics
	suite.metricsRepo.DeleteOldMetrics(ctx, 0) // Delete all metrics
}

func (suite *MonitoringIntegrationTestSuite) TestMetricsCollection_RealDatabase() {
	ctx := context.Background()

	// Test metrics collection
	metrics, err := suite.metricsService.CollectMetrics(ctx, suite.testConnection.ID)
	require.NoError(suite.T(), err)

	// Verify metrics were collected
	assert.NotEmpty(suite.T(), metrics.ID)
	assert.Equal(suite.T(), suite.testConnection.ID, metrics.ConnectionID)
	assert.GreaterOrEqual(suite.T(), metrics.CPUUsage, 0.0)
	assert.LessOrEqual(suite.T(), metrics.CPUUsage, 100.0)
	assert.GreaterOrEqual(suite.T(), metrics.MemoryUsage, 0.0)
	assert.LessOrEqual(suite.T(), metrics.MemoryUsage, 100.0)
	assert.GreaterOrEqual(suite.T(), metrics.ActiveConnections, 0)
	assert.GreaterOrEqual(suite.T(), metrics.QueriesPerSecond, 0.0)
	assert.GreaterOrEqual(suite.T(), metrics.AverageQueryTime, 0.0)
	assert.GreaterOrEqual(suite.T(), metrics.DiskUsage, 0.0)
	assert.LessOrEqual(suite.T(), metrics.DiskUsage, 100.0)

	// Verify metrics were stored in database
	storedMetrics, err := suite.metricsRepo.GetByID(ctx, metrics.ID)
	require.NoError(suite.T(), err)
	assert.Equal(suite.T(), metrics.ID, storedMetrics.ID)
	assert.Equal(suite.T(), metrics.ConnectionID, storedMetrics.ConnectionID)
}

func (suite *MonitoringIntegrationTestSuite) TestMetricsStorageAndRetrieval() {
	ctx := context.Background()

	// Collect metrics
	metrics, err := suite.metricsService.CollectMetrics(ctx, suite.testConnection.ID)
	require.NoError(suite.T(), err)

	// Retrieve latest metrics
	latestMetrics, err := suite.metricsService.GetLatestMetrics(ctx, suite.testConnection.ID)
	require.NoError(suite.T(), err)
	assert.Equal(suite.T(), metrics.ID, latestMetrics.ID)

	// Test metrics history retrieval
	startTime := time.Now().Add(-1 * time.Hour)
	endTime := time.Now()
	history, err := suite.metricsService.GetMetricsHistory(ctx, suite.testConnection.ID, startTime, endTime, 10, 0)
	require.NoError(suite.T(), err)
	assert.Len(suite.T(), history, 1)
	assert.Equal(suite.T(), metrics.ID, history[0].ID)

	// Test average metrics calculation
	avgMetrics, err := suite.metricsService.GetAverageMetrics(ctx, suite.testConnection.ID, startTime, endTime)
	require.NoError(suite.T(), err)
	assert.NotNil(suite.T(), avgMetrics)
}

func (suite *MonitoringIntegrationTestSuite) TestAlertCreationAndManagement() {
	ctx := context.Background()

	// Create an alert
	alert, err := suite.alertService.Create(
		ctx,
		suite.testUser.ID,
		suite.testConnection.ID,
		entities.AlertTypeCPU,
		entities.SeverityHigh,
		"Test CPU alert",
		80.0,
		85.5,
	)
	require.NoError(suite.T(), err)

	// Verify alert was created
	assert.NotEmpty(suite.T(), alert.ID)
	assert.Equal(suite.T(), suite.testUser.ID, alert.UserID)
	assert.Equal(suite.T(), suite.testConnection.ID, alert.ConnectionID)
	assert.Equal(suite.T(), entities.AlertTypeCPU, alert.Type)
	assert.Equal(suite.T(), entities.SeverityHigh, alert.Severity)
	assert.Equal(suite.T(), "Test CPU alert", alert.Message)
	assert.Equal(suite.T(), 80.0, alert.Threshold)
	assert.Equal(suite.T(), 85.5, alert.CurrentValue)
	assert.True(suite.T(), alert.IsActive())

	// Retrieve alert by ID
	retrievedAlert, err := suite.alertService.GetByID(ctx, alert.ID)
	require.NoError(suite.T(), err)
	assert.Equal(suite.T(), alert.ID, retrievedAlert.ID)

	// Test alert resolution
	err = suite.alertService.Resolve(ctx, alert.ID)
	require.NoError(suite.T(), err)

	resolvedAlert, err := suite.alertService.GetByID(ctx, alert.ID)
	require.NoError(suite.T(), err)
	assert.True(suite.T(), resolvedAlert.IsResolved())

	// Test alert reactivation
	err = suite.alertService.Reactivate(ctx, alert.ID)
	require.NoError(suite.T(), err)

	reactivatedAlert, err := suite.alertService.GetByID(ctx, alert.ID)
	require.NoError(suite.T(), err)
	assert.True(suite.T(), reactivatedAlert.IsActive())

	// Test alert muting
	err = suite.alertService.Mute(ctx, alert.ID)
	require.NoError(suite.T(), err)

	mutedAlert, err := suite.alertService.GetByID(ctx, alert.ID)
	require.NoError(suite.T(), err)
	assert.True(suite.T(), mutedAlert.IsMuted())
}

func (suite *MonitoringIntegrationTestSuite) TestAlertProcessingFromMetrics() {
	ctx := context.Background()

	// Create metrics with high values to trigger alerts
	metrics := &entities.DatabaseMetrics{
		ID:                "metrics-trigger-123",
		ConnectionID:      suite.testConnection.ID,
		CPUUsage:          90.0,  // Above 80% threshold
		MemoryUsage:       95.0,  // Above 85% threshold
		DiskUsage:         98.0,  // Above 90% threshold
		ActiveConnections: 150,   // Above 100 threshold
		QueriesPerSecond:  2000.0,
		AverageQueryTime:  8000.0, // Above 5000ms threshold
		Timestamp:         time.Now(),
	}

	// Process metrics to create alerts
	err := suite.alertService.ProcessMetrics(ctx, metrics)
	require.NoError(suite.T(), err)

	// Verify alerts were created
	activeAlerts, err := suite.alertRepo.GetActiveAlerts(ctx, suite.testUser.ID)
	require.NoError(suite.T(), err)
	assert.Greater(suite.T(), len(activeAlerts), 0)

	// Verify each alert type exists
	alertTypes := make(map[string]bool)
	for _, alert := range activeAlerts {
		alertTypes[alert.Type] = true
	}

	assert.True(suite.T(), alertTypes[entities.AlertTypeCPU])
	assert.True(suite.T(), alertTypes[entities.AlertTypeMemory])
	assert.True(suite.T(), alertTypes[entities.AlertTypeDisk])
	assert.True(suite.T(), alertTypes[entities.AlertTypeConnections])
	assert.True(suite.T(), alertTypes[entities.AlertTypeQueryTime])
}

func (suite *MonitoringIntegrationTestSuite) TestMonitoringWorkflow() {
	ctx := context.Background()

	// Start monitoring
	interval := 100 * time.Millisecond
	err := suite.metricsService.StartMonitoring(ctx, suite.testConnection.ID, interval)
	require.NoError(suite.T(), err)

	// Wait for a few monitoring cycles
	time.Sleep(interval * 3)

	// Stop monitoring
	err = suite.metricsService.StopMonitoring(ctx, suite.testConnection.ID)
	require.NoError(suite.T(), err)

	// Verify metrics were collected during monitoring
	history, err := suite.metricsRepo.GetByConnectionID(ctx, suite.testConnection.ID, 10, 0)
	require.NoError(suite.T(), err)
	assert.Greater(suite.T(), len(history), 0)

	// Verify any alerts were created if thresholds were exceeded
	activeAlerts, err := suite.alertRepo.GetActiveAlerts(ctx, suite.testUser.ID)
	require.NoError(suite.T(), err)
	// May or may not have alerts depending on the database state
}

func (suite *MonitoringIntegrationTestSuite) TestAlertStatistics() {
	ctx := context.Background()

	// Create multiple alerts with different properties
	alerts := []*entities.Alert{
		{ID: "alert-1", UserID: suite.testUser.ID, Type: entities.AlertTypeCPU, Severity: entities.SeverityLow, Status: entities.AlertStatusActive},
		{ID: "alert-2", UserID: suite.testUser.ID, Type: entities.AlertTypeMemory, Severity: entities.SeverityMedium, Status: entities.AlertStatusActive},
		{ID: "alert-3", UserID: suite.testUser.ID, Type: entities.AlertTypeDisk, Severity: entities.SeverityHigh, Status: entities.AlertStatusActive},
		{ID: "alert-4", UserID: suite.testUser.ID, Type: entities.AlertTypeConnections, Severity: entities.SeverityCritical, Status: entities.AlertStatusResolved},
		{ID: "alert-5", UserID: suite.testUser.ID, Type: entities.AlertTypeQueryTime, Severity: entities.SeverityMedium, Status: entities.AlertStatusMuted},
	}

	// Store alerts
	for _, alert := range alerts {
		err := suite.alertRepo.Create(ctx, alert)
		require.NoError(suite.T(), err)
	}

	// Get alert statistics
	stats, err := suite.alertService.GetAlertStats(ctx, suite.testUser.ID, 30)
	require.NoError(suite.T(), err)

	// Verify statistics
	assert.Equal(suite.T(), int64(5), stats.TotalAlerts)
	assert.Equal(suite.T(), int64(3), stats.ActiveAlerts)
	assert.Equal(suite.T(), int64(1), stats.ResolvedAlerts)
	assert.Equal(suite.T(), int64(1), stats.MutedAlerts)

	// Verify severity breakdown
	assert.Equal(suite.T(), int64(1), stats.AlertsBySeverity["low"])
	assert.Equal(suite.T(), int64(2), stats.AlertsBySeverity["medium"])
	assert.Equal(suite.T(), int64(1), stats.AlertsBySeverity["high"])
	assert.Equal(suite.T(), int64(1), stats.AlertsBySeverity["critical"])
}

func (suite *MonitoringIntegrationTestSuite) TestBatchAlertOperations() {
	ctx := context.Background()

	// Create multiple alerts
	alertIDs := []string{}
	for i := 0; i < 5; i++ {
		alert, err := suite.alertService.Create(
			ctx,
			suite.testUser.ID,
			suite.testConnection.ID,
			entities.AlertTypeCPU,
			entities.SeverityMedium,
			"Test alert for batch operation",
			80.0,
			85.0,
		)
		require.NoError(suite.T(), err)
		alertIDs = append(alertIDs, alert.ID)
	}

	// Test batch resolve
	err := suite.alertService.BatchResolve(ctx, alertIDs[:3])
	require.NoError(suite.T(), err)

	// Verify alerts were resolved
	for _, alertID := range alertIDs[:3] {
		alert, err := suite.alertService.GetByID(ctx, alertID)
		require.NoError(suite.T(), err)
		assert.True(suite.T(), alert.IsResolved())
	}

	// Test batch mute
	err = suite.alertService.BatchMute(ctx, alertIDs[3:])
	require.NoError(suite.T(), err)

	// Verify alerts were muted
	for _, alertID := range alertIDs[3:] {
		alert, err := suite.alertService.GetByID(ctx, alertID)
		require.NoError(suite.T(), err)
		assert.True(suite.T(), alert.IsMuted())
	}
}

func (suite *MonitoringIntegrationTestSuite) TestAlertCleanup() {
	ctx := context.Background()

	// Create old resolved alerts
	oldTime := time.Now().Add(-10 * 24 * time.Hour) // 10 days ago
	for i := 0; i < 3; i++ {
		alert := &entities.Alert{
			ID:         "old-alert-" + string(rune(i)),
			UserID:     suite.testUser.ID,
			Type:       entities.AlertTypeCPU,
			Severity:   entities.SeverityMedium,
			Status:     entities.AlertStatusResolved,
			CreatedAt:  oldTime,
			ResolvedAt: &oldTime,
		}
		err := suite.alertRepo.Create(ctx, alert)
		require.NoError(suite.T(), err)
	}

	// Create recent resolved alerts
	for i := 0; i < 2; i++ {
		alert, err := suite.alertService.Create(
			ctx,
			suite.testUser.ID,
			suite.testConnection.ID,
			entities.AlertTypeMemory,
			entities.SeverityLow,
			"Recent resolved alert",
			85.0,
			90.0,
		)
		require.NoError(suite.T(), err)
		suite.alertService.Resolve(ctx, alert.ID)
	}

	// Cleanup old alerts (older than 5 days)
	deletedCount, err := suite.alertService.CleanupOldAlerts(ctx, 5)
	require.NoError(suite.T(), err)
	assert.Equal(suite.T(), int64(3), deletedCount)

	// Verify only recent alerts remain
	allAlerts, err := suite.alertRepo.GetByUserID(ctx, suite.testUser.ID, 100, 0)
	require.NoError(suite.T(), err)
	assert.Len(suite.T(), allAlerts, 2) // Only the 2 recent alerts
}

func (suite *MonitoringIntegrationTestSuite) TestConcurrentMetricsCollection() {
	ctx := context.Background()

	// Test concurrent metrics collection
	numGoroutines := 5
	results := make(chan *entities.DatabaseMetrics, numGoroutines)
	errors := make(chan error, numGoroutines)

	for i := 0; i < numGoroutines; i++ {
		go func() {
			metrics, err := suite.metricsService.CollectMetrics(ctx, suite.testConnection.ID)
			if err != nil {
				errors <- err
			} else {
				results <- metrics
			}
		}()
	}

	// Collect results
	collectedMetrics := []*entities.DatabaseMetrics{}
	for i := 0; i < numGoroutines; i++ {
		select {
		case metrics := <-results:
			collectedMetrics = append(collectedMetrics, metrics)
		case err := <-errors:
			suite.T().Logf("Expected error in concurrent test: %v", err)
		}
	}

	// Verify all collections succeeded
	assert.Len(suite.T(), collectedMetrics, numGoroutines)

	// Verify all metrics have valid data
	for _, metrics := range collectedMetrics {
		assert.NotEmpty(suite.T(), metrics.ID)
		assert.Equal(suite.T(), suite.testConnection.ID, metrics.ConnectionID)
		assert.GreaterOrEqual(suite.T(), metrics.CPUUsage, 0.0)
		assert.LessOrEqual(suite.T(), metrics.CPUUsage, 100.0)
	}
}