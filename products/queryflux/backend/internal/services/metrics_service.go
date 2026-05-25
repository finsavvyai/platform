package services

import (
	"context"
	"fmt"
	"log"
	"sync"
	"time"

	"github.com/queryflux/backend/internal/domain/entities"
	"github.com/queryflux/backend/internal/domain/repositories"
	"github.com/queryflux/backend/internal/infrastructure/metrics"
)

// metricsService implements the MetricsService interface
type metricsService struct {
	metricsRepo repositories.MetricsRepository
	alertRepo   repositories.AlertRepository
	connRepo    repositories.ConnectionRepository
	collectorFactory *metrics.MetricsCollectorFactory
	monitoringJobs   map[string]*monitoringJob
	monitoringMutex  sync.RWMutex
}

// monitoringJob represents an active monitoring job
type monitoringJob struct {
	connectionID string
	interval     time.Duration
	ticker       *time.Ticker
	stopChan     chan bool
	ctx          context.Context
	cancel       context.CancelFunc
}

// NewMetricsService creates a new metrics service
func NewMetricsService(
	metricsRepo repositories.MetricsRepository,
	alertRepo repositories.AlertRepository,
	connRepo repositories.ConnectionRepository,
) MetricsService {
	return &metricsService{
		metricsRepo:      metricsRepo,
		alertRepo:        alertRepo,
		connRepo:         connRepo,
		collectorFactory: metrics.NewMetricsCollectorFactory(),
		monitoringJobs:   make(map[string]*monitoringJob),
	}
}

// CollectMetrics collects metrics for a database connection
func (s *metricsService) CollectMetrics(ctx context.Context, connectionID string) (*entities.DatabaseMetrics, error) {
	// Get connection details
	connection, err := s.connRepo.GetByID(ctx, connectionID)
	if err != nil {
		return nil, fmt.Errorf("failed to get connection: %w", err)
	}

	// Create appropriate collector for database type
	collector, err := s.collectorFactory.CreateCollector(connection.Type)
	if err != nil {
		return nil, fmt.Errorf("failed to create metrics collector: %w", err)
	}

	// Collect metrics
	databaseMetrics, err := collector.CollectMetrics(ctx, connection)
	if err != nil {
		return nil, fmt.Errorf("failed to collect metrics: %w", err)
	}

	// Store metrics in repository
	if err := s.metricsRepo.Create(ctx, databaseMetrics); err != nil {
		log.Printf("Warning: Failed to store metrics: %v", err)
		// Don't fail the operation if storage fails
	}

	return databaseMetrics, nil
}

// GetLatestMetrics retrieves latest metrics for a connection
func (s *metricsService) GetLatestMetrics(ctx context.Context, connectionID string) (*entities.DatabaseMetrics, error) {
	return s.metricsRepo.GetLatest(ctx, connectionID)
}

// GetMetricsHistory retrieves metrics history
func (s *metricsService) GetMetricsHistory(ctx context.Context, connectionID string, startTime, endTime time.Time, limit, offset int) ([]*entities.DatabaseMetrics, error) {
	return s.metricsRepo.GetByDateRange(ctx, connectionID, startTime, endTime, limit, offset)
}

// GetAverageMetrics calculates average metrics over a time period
func (s *metricsService) GetAverageMetrics(ctx context.Context, connectionID string, startTime, endTime time.Time) (*entities.DatabaseMetrics, error) {
	return s.metricsRepo.GetAverageMetrics(ctx, connectionID, startTime, endTime)
}

// StartMonitoring starts monitoring a database connection
func (s *metricsService) StartMonitoring(ctx context.Context, connectionID string, interval time.Duration) error {
	s.monitoringMutex.Lock()
	defer s.monitoringMutex.Unlock()

	// Check if monitoring is already active for this connection
	if _, exists := s.monitoringJobs[connectionID]; exists {
		return fmt.Errorf("monitoring already active for connection %s", connectionID)
	}

	// Create monitoring context
	monitorCtx, cancel := context.WithCancel(ctx)

	// Create monitoring job
	job := &monitoringJob{
		connectionID: connectionID,
		interval:     interval,
		ticker:       time.NewTicker(interval),
		stopChan:     make(chan bool),
		ctx:          monitorCtx,
		cancel:       cancel,
	}

	// Store job
	s.monitoringJobs[connectionID] = job

	// Start monitoring goroutine
	go s.monitoringLoop(job)

	log.Printf("Started monitoring for connection %s with interval %v", connectionID, interval)
	return nil
}

// StopMonitoring stops monitoring a database connection
func (s *metricsService) StopMonitoring(ctx context.Context, connectionID string) error {
	s.monitoringMutex.Lock()
	defer s.monitoringMutex.Unlock()

	// Get monitoring job
	job, exists := s.monitoringJobs[connectionID]
	if !exists {
		return fmt.Errorf("no active monitoring for connection %s", connectionID)
	}

	// Stop monitoring
	job.ticker.Stop()
	job.cancel()
	close(job.stopChan)

	// Remove from map
	delete(s.monitoringJobs, connectionID)

	log.Printf("Stopped monitoring for connection %s", connectionID)
	return nil
}

// CheckThresholds checks if metrics exceed alert thresholds
func (s *metricsService) CheckThresholds(ctx context.Context, metrics *entities.DatabaseMetrics) ([]*entities.Alert, error) {
	var alerts []*entities.Alert

	// Get connection to determine user
	connection, err := s.connRepo.GetByID(ctx, metrics.ConnectionID)
	if err != nil {
		return nil, fmt.Errorf("failed to get connection: %w", err)
	}

	// Define default thresholds (in a real implementation, these would be user-configurable)
	thresholds := map[string]float64{
		entities.AlertTypeCPU:         80.0,  // 80% CPU usage
		entities.AlertTypeMemory:      85.0,  // 85% memory usage
		entities.AlertTypeDisk:        90.0,  // 90% disk usage
		entities.AlertTypeConnections: 100.0, // 100 connections
		entities.AlertTypeQueryTime:   5000.0, // 5000ms average query time
	}

	// Check CPU threshold
	if metrics.CPUUsage > thresholds[entities.AlertTypeCPU] {
		alert, err := s.createThresholdAlert(ctx, connection.UserID, metrics, entities.AlertTypeCPU, thresholds[entities.AlertTypeCPU], metrics.CPUUsage)
		if err != nil {
			log.Printf("Warning: Failed to create CPU alert: %v", err)
		} else {
			alerts = append(alerts, alert)
		}
	}

	// Check memory threshold
	if metrics.MemoryUsage > thresholds[entities.AlertTypeMemory] {
		alert, err := s.createThresholdAlert(ctx, connection.UserID, metrics, entities.AlertTypeMemory, thresholds[entities.AlertTypeMemory], metrics.MemoryUsage)
		if err != nil {
			log.Printf("Warning: Failed to create memory alert: %v", err)
		} else {
			alerts = append(alerts, alert)
		}
	}

	// Check disk threshold
	if metrics.DiskUsage > thresholds[entities.AlertTypeDisk] {
		alert, err := s.createThresholdAlert(ctx, connection.UserID, metrics, entities.AlertTypeDisk, thresholds[entities.AlertTypeDisk], metrics.DiskUsage)
		if err != nil {
			log.Printf("Warning: Failed to create disk alert: %v", err)
		} else {
			alerts = append(alerts, alert)
		}
	}

	// Check connections threshold
	if float64(metrics.ActiveConnections) > thresholds[entities.AlertTypeConnections] {
		alert, err := s.createThresholdAlert(ctx, connection.UserID, metrics, entities.AlertTypeConnections, thresholds[entities.AlertTypeConnections], float64(metrics.ActiveConnections))
		if err != nil {
			log.Printf("Warning: Failed to create connections alert: %v", err)
		} else {
			alerts = append(alerts, alert)
		}
	}

	// Check query time threshold
	if metrics.AverageQueryTime > thresholds[entities.AlertTypeQueryTime] {
		alert, err := s.createThresholdAlert(ctx, connection.UserID, metrics, entities.AlertTypeQueryTime, thresholds[entities.AlertTypeQueryTime], metrics.AverageQueryTime)
		if err != nil {
			log.Printf("Warning: Failed to create query time alert: %v", err)
		} else {
			alerts = append(alerts, alert)
		}
	}

	return alerts, nil
}

// monitoringLoop runs the monitoring logic for a connection
func (s *metricsService) monitoringLoop(job *monitoringJob) {
	defer func() {
		if r := recover(); r != nil {
			log.Printf("Monitoring loop panic for connection %s: %v", job.connectionID, r)
		}
	}()

	for {
		select {
		case <-job.ctx.Done():
			return
		case <-job.stopChan:
			return
		case <-job.ticker.C:
			s.collectAndProcessMetrics(job.ctx, job.connectionID)
		}
	}
}

// collectAndProcessMetrics collects metrics and processes them for alerts
func (s *metricsService) collectAndProcessMetrics(ctx context.Context, connectionID string) {
	// Collect metrics
	metrics, err := s.CollectMetrics(ctx, connectionID)
	if err != nil {
		log.Printf("Failed to collect metrics for connection %s: %v", connectionID, err)
		return
	}

	// Check thresholds and create alerts
	alerts, err := s.CheckThresholds(ctx, metrics)
	if err != nil {
		log.Printf("Failed to check thresholds for connection %s: %v", connectionID, err)
		return
	}

	// Store alerts
	for _, alert := range alerts {
		if err := s.alertRepo.Create(ctx, alert); err != nil {
			log.Printf("Failed to store alert: %v", err)
		} else {
			log.Printf("Created alert: %s - %s", alert.Type, alert.Message)
		}
	}
}

// createThresholdAlert creates an alert for threshold violation
func (s *metricsService) createThresholdAlert(ctx context.Context, userID string, metrics *entities.DatabaseMetrics, alertType string, threshold, currentValue float64) (*entities.Alert, error) {
	// Determine severity based on how much the threshold is exceeded
	severity := entities.SeverityMedium
	ratio := currentValue / threshold

	if ratio >= 1.5 {
		severity = entities.SeverityCritical
	} else if ratio >= 1.2 {
		severity = entities.SeverityHigh
	} else if ratio >= 1.0 {
		severity = entities.SeverityMedium
	} else {
		severity = entities.SeverityLow
	}

	// Create alert message
	message := fmt.Sprintf("%s threshold exceeded: %.2f (threshold: %.2f)",
		getAlertTypeDisplayName(alertType), currentValue, threshold)

	// Create alert
	alert, err := entities.NewAlert(userID, metrics.ConnectionID, alertType, severity, message, threshold, currentValue)
	if err != nil {
		return nil, err
	}

	// Add metadata
	alert.SetMetadata("timestamp", metrics.Timestamp.Format(time.RFC3339))
	alert.SetMetadata("connection_id", metrics.ConnectionID)

	return alert, nil
}

// getAlertTypeDisplayName returns a human-readable name for alert type
func getAlertTypeDisplayName(alertType string) string {
	switch alertType {
	case entities.AlertTypeCPU:
		return "CPU Usage"
	case entities.AlertTypeMemory:
		return "Memory Usage"
	case entities.AlertTypeDisk:
		return "Disk Usage"
	case entities.AlertTypeConnections:
		return "Active Connections"
	case entities.AlertTypeQueryTime:
		return "Average Query Time"
	default:
		return alertType
	}
}

// GetActiveMonitoringJobs returns the number of active monitoring jobs
func (s *metricsService) GetActiveMonitoringJobs() int {
	s.monitoringMutex.RLock()
	defer s.monitoringMutex.RUnlock()
	return len(s.monitoringJobs)
}