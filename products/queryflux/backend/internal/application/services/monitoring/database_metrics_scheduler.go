package services

import (
	"context"
	"fmt"
	"sync"
	"time"

	"github.com/queryflux/backend/internal/application/ports"
	"github.com/queryflux/backend/internal/domain"
	"go.uber.org/zap"
)

// DatabaseMetricsScheduler handles scheduled metrics collection with configurable intervals
type DatabaseMetricsScheduler struct {
	logger               *zap.Logger
	dbMetricsService     *DatabaseMetricsService
	metricStorage        ports.MetricsStorage
	wsManager            ports.WebSocketManager
	scheduledJobs        map[string]*ScheduledJob
	mu                   sync.RWMutex
	ctx                  context.Context
	cancel               context.CancelFunc
	wg                   sync.WaitGroup

	// Configuration
	defaultInterval      time.Duration
	maxConcurrentJobs    int
	metricsBuffer        map[string][]*domain.Metric
	bufferSize           int
	bufferFlushInterval  time.Duration
}

// ScheduledJob represents a scheduled metrics collection job
type ScheduledJob struct {
	ID              string
	ConnectionID    string
	Interval        time.Duration
	LastRun         time.Time
	NextRun         time.Time
	Running         bool
	FailureCount    int
	MaxFailures     int
	Enabled         bool
	MetricTypes     []string // "connection", "query", "table", "index"
	ctx             context.Context
	cancel          context.CancelFunc
}

// JobConfig represents configuration for a scheduled job
type JobConfig struct {
	ConnectionID   string
	Interval       time.Duration
	MetricTypes    []string
	MaxFailures    int
	Enabled        bool
}

// NewDatabaseMetricsScheduler creates a new database metrics scheduler
func NewDatabaseMetricsScheduler(
	logger *zap.Logger,
	dbMetricsService *DatabaseMetricsService,
	metricStorage ports.MetricsStorage,
	wsManager ports.WebSocketManager,
) *DatabaseMetricsScheduler {
	ctx, cancel := context.WithCancel(context.Background())

	return &DatabaseMetricsScheduler{
		logger:              logger,
		dbMetricsService:    dbMetricsService,
		metricStorage:       metricStorage,
		wsManager:           wsManager,
		scheduledJobs:       make(map[string]*ScheduledJob),
		ctx:                 ctx,
		cancel:              cancel,
		defaultInterval:     30 * time.Second,
		maxConcurrentJobs:   10,
		metricsBuffer:       make(map[string][]*domain.Metric),
		bufferSize:          1000,
		bufferFlushInterval: 5 * time.Second,
	}
}

// Start starts the metrics scheduler
func (s *DatabaseMetricsScheduler) Start(ctx context.Context) error {
	s.logger.Info("Starting database metrics scheduler")

	// Start buffer flush routine
	s.wg.Add(1)
	go s.bufferFlushWorker()

	// Start job scheduler
	s.wg.Add(1)
	go s.jobScheduler()

	// Start health check worker
	s.wg.Add(1)
	go s.healthCheckWorker()

	s.logger.Info("Database metrics scheduler started successfully")
	return nil
}

// Stop stops the metrics scheduler
func (s *DatabaseMetricsScheduler) Stop(ctx context.Context) error {
	s.logger.Info("Stopping database metrics scheduler")

	s.cancel()

	// Cancel all jobs
	s.mu.Lock()
	for _, job := range s.scheduledJobs {
		if job.cancel != nil {
			job.cancel()
		}
	}
	s.mu.Unlock()

	// Wait for all workers to finish
	done := make(chan struct{})
	go func() {
		s.wg.Wait()
		close(done)
	}()

	select {
	case <-done:
		s.logger.Info("Database metrics scheduler stopped successfully")
	case <-time.After(30 * time.Second):
		s.logger.Warn("Database metrics scheduler stop timeout")
	}

	// Flush remaining metrics
	if err := s.flushAllBuffers(ctx); err != nil {
		s.logger.Error("Failed to flush metrics during shutdown", zap.Error(err))
	}

	return nil
}

// ScheduleJob schedules a new metrics collection job
func (s *DatabaseMetricsScheduler) ScheduleJob(config *JobConfig) (*ScheduledJob, error) {
	job := &ScheduledJob{
		ID:           fmt.Sprintf("job_%s_%d", config.ConnectionID, time.Now().UnixNano()),
		ConnectionID: config.ConnectionID,
		Interval:     config.Interval,
		LastRun:      time.Time{},
		NextRun:      time.Now().Add(config.Interval),
		Running:      false,
		FailureCount: 0,
		MaxFailures:  config.MaxFailures,
		Enabled:      config.Enabled,
		MetricTypes:  config.MetricTypes,
	}

	if job.Interval == 0 {
		job.Interval = s.defaultInterval
	}

	if job.MaxFailures == 0 {
		job.MaxFailures = 3
	}

	if len(job.MetricTypes) == 0 {
		job.MetricTypes = []string{"connection", "query", "table", "index"}
	}

	job.ctx, job.cancel = context.WithCancel(s.ctx)

	s.mu.Lock()
	s.scheduledJobs[job.ID] = job
	s.mu.Unlock()

	s.logger.Info("Metrics collection job scheduled",
		zap.String("job_id", job.ID),
		zap.String("connection_id", job.ConnectionID),
		zap.Duration("interval", job.Interval),
		zap.Strings("metric_types", job.MetricTypes))

	return job, nil
}

// UnscheduleJob removes a scheduled job
func (s *DatabaseMetricsScheduler) UnscheduleJob(jobID string) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	job, exists := s.scheduledJobs[jobID]
	if !exists {
		return fmt.Errorf("job not found: %s", jobID)
	}

	if job.cancel != nil {
		job.cancel()
	}

	delete(s.scheduledJobs, jobID)

	s.logger.Info("Metrics collection job unscheduled",
		zap.String("job_id", jobID),
		zap.String("connection_id", job.ConnectionID))

	return nil
}

// GetJob returns a scheduled job by ID
func (s *DatabaseMetricsScheduler) GetJob(jobID string) (*ScheduledJob, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()

	job, exists := s.scheduledJobs[jobID]
	if !exists {
		return nil, fmt.Errorf("job not found: %s", jobID)
	}

	return job, nil
}

// GetJobs returns all scheduled jobs
func (s *DatabaseMetricsScheduler) GetJobs() []*ScheduledJob {
	s.mu.RLock()
	defer s.mu.RUnlock()

	jobs := make([]*ScheduledJob, 0, len(s.scheduledJobs))
	for _, job := range s.scheduledJobs {
		jobs = append(jobs, job)
	}

	return jobs
}

// EnableJob enables a scheduled job
func (s *DatabaseMetricsScheduler) EnableJob(jobID string) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	job, exists := s.scheduledJobs[jobID]
	if !exists {
		return fmt.Errorf("job not found: %s", jobID)
	}

	job.Enabled = true
	job.NextRun = time.Now().Add(job.Interval)

	s.logger.Info("Job enabled", zap.String("job_id", jobID))
	return nil
}

// DisableJob disables a scheduled job
func (s *DatabaseMetricsScheduler) DisableJob(jobID string) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	job, exists := s.scheduledJobs[jobID]
	if !exists {
		return fmt.Errorf("job not found: %s", jobID)
	}

	job.Enabled = false

	s.logger.Info("Job disabled", zap.String("job_id", jobID))
	return nil
}

// UpdateJobInterval updates the interval of a scheduled job
func (s *DatabaseMetricsScheduler) UpdateJobInterval(jobID string, interval time.Duration) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	job, exists := s.scheduledJobs[jobID]
	if !exists {
		return fmt.Errorf("job not found: %s", jobID)
	}

	job.Interval = interval
	job.NextRun = time.Now().Add(interval)

	s.logger.Info("Job interval updated",
		zap.String("job_id", jobID),
		zap.Duration("new_interval", interval))

	return nil
}

// Worker methods

func (s *DatabaseMetricsScheduler) jobScheduler() {
	defer s.wg.Done()

	ticker := time.NewTicker(1 * time.Second)
	defer ticker.Stop()

	for {
		select {
		case <-s.ctx.Done():
			return
		case <-ticker.C:
			s.runScheduledJobs()
		}
	}
}

func (s *DatabaseMetricsScheduler) runScheduledJobs() {
	s.mu.RLock()
	jobs := make([]*ScheduledJob, 0, len(s.scheduledJobs))
	for _, job := range s.scheduledJobs {
		if job.Enabled && !job.Running && time.Now().After(job.NextRun) {
			jobs = append(jobs, job)
		}
	}
	s.mu.RUnlock()

	// Limit concurrent jobs
	semaphore := make(chan struct{}, s.maxConcurrentJobs)

	for _, job := range jobs {
		select {
		case <-s.ctx.Done():
			return
		case semaphore <- struct{}{}:
			go s.runJob(job, func() { <-semaphore })
		}
	}
}

func (s *DatabaseMetricsScheduler) runJob(job *ScheduledJob, release func()) {
	defer release()

	s.mu.Lock()
	job.Running = true
	job.LastRun = time.Now()
	job.NextRun = job.LastRun.Add(job.Interval)
	s.mu.Unlock()

	defer func() {
		s.mu.Lock()
		job.Running = false
		s.mu.Unlock()
	}()

	s.logger.Debug("Running metrics collection job",
		zap.String("job_id", job.ID),
		zap.String("connection_id", job.ConnectionID))

	ctx, cancel := context.WithTimeout(job.ctx, job.Interval/2)
	defer cancel()

	// Collect metrics based on configured types
	var metrics []*domain.Metric

	for _, metricType := range job.MetricTypes {
		switch metricType {
		case "connection":
			if m := s.collectConnectionMetrics(ctx, job.ConnectionID); m != nil {
				metrics = append(metrics, m...)
			}
		case "query":
			if m := s.collectQueryMetrics(ctx, job.ConnectionID); m != nil {
				metrics = append(metrics, m...)
			}
		case "table":
			if m := s.collectTableMetrics(ctx, job.ConnectionID); m != nil {
				metrics = append(metrics, m...)
			}
		case "index":
			if m := s.collectIndexMetrics(ctx, job.ConnectionID); m != nil {
				metrics = append(metrics, m...)
			}
		}
	}

	// Buffer metrics
	s.bufferMetrics(job.ConnectionID, metrics)

	// Reset failure count on success
	s.mu.Lock()
	job.FailureCount = 0
	s.mu.Unlock()

	s.logger.Debug("Metrics collection job completed",
		zap.String("job_id", job.ID),
		zap.String("connection_id", job.ConnectionID),
		zap.Int("metrics_collected", len(metrics)))
}

func (s *DatabaseMetricsScheduler) collectConnectionMetrics(ctx context.Context, connectionID string) []*domain.Metric {
	connMetrics, err := s.dbMetricsService.CollectConnectionMetrics(ctx, connectionID)
	if err != nil {
		s.logger.Error("Failed to collect connection metrics",
			zap.Error(err),
			zap.String("connection_id", connectionID))
		return nil
	}

	timestamp := time.Now()
	metrics := []*domain.Metric{
		{
			ID:        fmt.Sprintf("%s_active_queries", connectionID),
			Name:      "database_active_queries",
			Type:      domain.MetricTypeGauge,
			Value:     float64(connMetrics.ActiveQueries),
			Labels:    map[string]string{"connection_id": connectionID},
			Timestamp: timestamp,
			Unit:      "count",
		},
		{
			ID:        fmt.Sprintf("%s_queued_queries", connectionID),
			Name:      "database_queued_queries",
			Type:      domain.MetricTypeGauge,
			Value:     float64(connMetrics.QueuedQueries),
			Labels:    map[string]string{"connection_id": connectionID},
			Timestamp: timestamp,
			Unit:      "count",
		},
		{
			ID:        fmt.Sprintf("%s_avg_query_time", connectionID),
			Name:      "database_avg_query_time_ms",
			Type:      domain.MetricTypeGauge,
			Value:     float64(connMetrics.AvgQueryTime.Milliseconds()),
			Labels:    map[string]string{"connection_id": connectionID},
			Timestamp: timestamp,
			Unit:      "milliseconds",
		},
		{
			ID:        fmt.Sprintf("%s_error_rate", connectionID),
			Name:      "database_error_rate",
			Type:      domain.MetricTypeGauge,
			Value:     connMetrics.ErrorRate,
			Labels:    map[string]string{"connection_id": connectionID},
			Timestamp: timestamp,
			Unit:      "percent",
		},
		{
			ID:        fmt.Sprintf("%s_healthy", connectionID),
			Name:      "database_healthy",
			Type:      domain.MetricTypeGauge,
			Value:     0,
			Labels:    map[string]string{"connection_id": connectionID},
			Timestamp: timestamp,
			Unit:      "boolean",
		},
	}

	if connMetrics.IsHealthy {
		metrics[4].Value = 1
	}

	return metrics
}

func (s *DatabaseMetricsScheduler) collectQueryMetrics(ctx context.Context, connectionID string) []*domain.Metric {
	queryMetrics, err := s.dbMetricsService.CollectQueryMetrics(ctx, connectionID, 100)
	if err != nil {
		s.logger.Error("Failed to collect query metrics",
			zap.Error(err),
			zap.String("connection_id", connectionID))
		return nil
	}

	timestamp := time.Now()
	metrics := make([]*domain.Metric, 0, len(queryMetrics))

	for _, qm := range queryMetrics {
		metrics = append(metrics, &domain.Metric{
			ID:        fmt.Sprintf("%s_query_%s_duration", connectionID, qm.QueryHash),
			Name:      "database_query_duration_ms",
			Type:      domain.MetricTypeHistogram,
			Value:     float64(qm.Duration.Milliseconds()),
			Labels: map[string]string{
				"connection_id": connectionID,
				"query_hash":    qm.QueryHash,
				"success":       fmt.Sprintf("%t", qm.Success),
			},
			Timestamp: timestamp,
			Unit:      "milliseconds",
		})

		metrics = append(metrics, &domain.Metric{
			ID:        fmt.Sprintf("%s_query_%s_rows", connectionID, qm.QueryHash),
			Name:      "database_query_rows_returned",
			Type:      domain.MetricTypeCounter,
			Value:     float64(qm.RowsReturned),
			Labels: map[string]string{
				"connection_id": connectionID,
				"query_hash":    qm.QueryHash,
			},
			Timestamp: timestamp,
			Unit:      "count",
		})
	}

	return metrics
}

func (s *DatabaseMetricsScheduler) collectTableMetrics(ctx context.Context, connectionID string) []*domain.Metric {
	tableMetrics, err := s.dbMetricsService.CollectTableMetrics(ctx, connectionID)
	if err != nil {
		s.logger.Error("Failed to collect table metrics",
			zap.Error(err),
			zap.String("connection_id", connectionID))
		return nil
	}

	timestamp := time.Now()
	metrics := make([]*domain.Metric, 0, len(tableMetrics)*2)

	for _, tm := range tableMetrics {
		metrics = append(metrics, &domain.Metric{
			ID:        fmt.Sprintf("%s_table_%s_rows", connectionID, tm.Name),
			Name:      "database_table_rows",
			Type:      domain.MetricTypeGauge,
			Value:     float64(tm.RowCount),
			Labels: map[string]string{
				"connection_id": connectionID,
				"table_name":    tm.Name,
			},
			Timestamp: timestamp,
			Unit:      "count",
		})

		metrics = append(metrics, &domain.Metric{
			ID:        fmt.Sprintf("%s_table_%s_size", connectionID, tm.Name),
			Name:      "database_table_size_bytes",
			Type:      domain.MetricTypeGauge,
			Value:     float64(tm.Size),
			Labels: map[string]string{
				"connection_id": connectionID,
				"table_name":    tm.Name,
			},
			Timestamp: timestamp,
			Unit:      "bytes",
		})
	}

	return metrics
}

func (s *DatabaseMetricsScheduler) collectIndexMetrics(ctx context.Context, connectionID string) []*domain.Metric {
	indexMetrics, err := s.dbMetricsService.CollectIndexMetrics(ctx, connectionID)
	if err != nil {
		s.logger.Error("Failed to collect index metrics",
			zap.Error(err),
			zap.String("connection_id", connectionID))
		return nil
	}

	timestamp := time.Now()
	metrics := make([]*domain.Metric, 0, len(indexMetrics))

	for _, im := range indexMetrics {
		metrics = append(metrics, &domain.Metric{
			ID:        fmt.Sprintf("%s_index_%s_usage", connectionID, im.Name),
			Name:      "database_index_usage_count",
			Type:      domain.MetricTypeCounter,
			Value:     float64(im.UsageCount),
			Labels: map[string]string{
				"connection_id": connectionID,
				"index_name":    im.Name,
				"table_name":    im.TableName,
			},
			Timestamp: timestamp,
			Unit:      "count",
		})

		metrics = append(metrics, &domain.Metric{
			ID:        fmt.Sprintf("%s_index_%s_scans", connectionID, im.Name),
			Name:      "database_index_scans_count",
			Type:      domain.MetricTypeCounter,
			Value:     float64(im.Scans),
			Labels: map[string]string{
				"connection_id": connectionID,
				"index_name":    im.Name,
				"table_name":    im.TableName,
			},
			Timestamp: timestamp,
			Unit:      "count",
		})
	}

	return metrics
}

func (s *DatabaseMetricsScheduler) bufferMetrics(connectionID string, metrics []*domain.Metric) {
	if len(metrics) == 0 {
		return
	}

	s.mu.Lock()
	defer s.mu.Unlock()

	buffer, exists := s.metricsBuffer[connectionID]
	if !exists {
		buffer = make([]*domain.Metric, 0, s.bufferSize)
		s.metricsBuffer[connectionID] = buffer
	}

	buffer = append(buffer, metrics...)

	// If buffer exceeds size, flush it
	if len(buffer) >= s.bufferSize {
		if err := s.flushBuffer(connectionID, buffer); err != nil {
			s.logger.Error("Failed to flush metrics buffer",
				zap.Error(err),
				zap.String("connection_id", connectionID))
		} else {
			// Clear buffer after successful flush
			s.metricsBuffer[connectionID] = buffer[:0]
		}
	} else {
		s.metricsBuffer[connectionID] = buffer
	}
}

func (s *DatabaseMetricsScheduler) bufferFlushWorker() {
	defer s.wg.Done()

	ticker := time.NewTicker(s.bufferFlushInterval)
	defer ticker.Stop()

	for {
		select {
		case <-s.ctx.Done():
			return
		case <-ticker.C:
			s.flushAllBuffers(s.ctx)
		}
	}
}

func (s *DatabaseMetricsScheduler) flushAllBuffers(ctx context.Context) error {
	s.mu.Lock()
	buffers := make(map[string][]*domain.Metric)
	for connectionID, buffer := range s.metricsBuffer {
		if len(buffer) > 0 {
			buffers[connectionID] = make([]*domain.Metric, len(buffer))
			copy(buffers[connectionID], buffer)
			s.metricsBuffer[connectionID] = s.metricsBuffer[connectionID][:0]
		}
	}
	s.mu.Unlock()

	for connectionID, buffer := range buffers {
		if err := s.flushBuffer(connectionID, buffer); err != nil {
			s.logger.Error("Failed to flush metrics buffer",
				zap.Error(err),
				zap.String("connection_id", connectionID))
		}
	}

	return nil
}

func (s *DatabaseMetricsScheduler) flushBuffer(connectionID string, metrics []*domain.Metric) error {
	if s.metricStorage == nil {
		return fmt.Errorf("metrics storage not configured")
	}

	ctx, cancel := context.WithTimeout(s.ctx, 10*time.Second)
	defer cancel()

	// Store metrics in batch
	if err := s.metricStorage.StoreBatch(ctx, metrics); err != nil {
		return fmt.Errorf("failed to store metrics batch: %w", err)
	}

	// Broadcast metrics via WebSocket
	if s.wsManager != nil {
		for _, metric := range metrics {
			if err := s.wsManager.BroadcastMetric(ctx, metric); err != nil {
				s.logger.Debug("Failed to broadcast metric",
					zap.Error(err),
					zap.String("metric_id", metric.ID))
			}
		}
	}

	s.logger.Debug("Flushed metrics buffer",
		zap.String("connection_id", connectionID),
		zap.Int("metrics_count", len(metrics)))

	return nil
}

func (s *DatabaseMetricsScheduler) healthCheckWorker() {
	defer s.wg.Done()

	ticker := time.NewTicker(60 * time.Second) // Check every minute
	defer ticker.Stop()

	for {
		select {
		case <-s.ctx.Done():
			return
		case <-ticker.C:
			s.checkJobHealth()
		}
	}
}

func (s *DatabaseMetricsScheduler) checkJobHealth() {
	s.mu.RLock()
	defer s.mu.RUnlock()

	now := time.Now()
	for _, job := range s.scheduledJobs {
		if job.Enabled && !job.Running {
			// Check if job missed its scheduled run
			if now.After(job.NextRun.Add(job.Interval)) {
				job.FailureCount++

				s.logger.Warn("Job missed scheduled run",
					zap.String("job_id", job.ID),
					zap.String("connection_id", job.ConnectionID),
					zap.Time("expected_run", job.NextRun),
					zap.Int("failure_count", job.FailureCount))

				// Disable job if max failures reached
				if job.FailureCount >= job.MaxFailures {
					job.Enabled = false
					s.logger.Error("Job disabled due to max failures",
						zap.String("job_id", job.ID),
						zap.Int("max_failures", job.MaxFailures))
				}
			}
		}
	}
}

// GetSchedulerStats returns scheduler statistics
func (s *DatabaseMetricsScheduler) GetSchedulerStats() map[string]interface{} {
	s.mu.RLock()
	defer s.mu.RUnlock()

	stats := make(map[string]interface{})
	stats["total_jobs"] = len(s.scheduledJobs)
	stats["enabled_jobs"] = 0
	stats["running_jobs"] = 0
	stats["buffered_metrics"] = 0

	for _, job := range s.scheduledJobs {
		if job.Enabled {
			stats["enabled_jobs"] = stats["enabled_jobs"].(int) + 1
		}
		if job.Running {
			stats["running_jobs"] = stats["running_jobs"].(int) + 1
		}
	}

	for _, buffer := range s.metricsBuffer {
		stats["buffered_metrics"] = stats["buffered_metrics"].(int) + len(buffer)
	}

	return stats
}