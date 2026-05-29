//go:build legacy_migrated
// +build legacy_migrated

package integration

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"time"

	"github.com/go-redis/redis/v8"
	"github.com/prometheus/client_golang/prometheus"
	"github.com/sirupsen/logrus"
)

// BackupIntegrationClient provides backup integration capabilities
type BackupIntegrationClient struct {
	backupServiceURL string
	httpClient       *http.Client
	redisClient      *redis.Client
	logger           *logrus.Logger

	// Metrics
	backupRequests *prometheus.CounterVec
	backupDuration *prometheus.HistogramVec
	backupSuccess  *prometheus.CounterVec
	backupFailure  *prometheus.CounterVec
	storageUsage   *prometheus.GaugeVec
}

// BackupRequest represents a backup request
type BackupRequest struct {
	ApplicationID string                 `json:"application_id"`
	BackupType    string                 `json:"backup_type"`
	Data          map[string]interface{} `json:"data"`
	Metadata      map[string]string      `json:"metadata"`
	Priority      string                 `json:"priority,omitempty"`
	RetentionDays int                    `json:"retention_days,omitempty"`
}

// BackupResponse represents a backup response
type BackupResponse struct {
	BackupID     string     `json:"backup_id"`
	Status       string     `json:"status"`
	CreatedAt    time.Time  `json:"created_at"`
	CompletedAt  *time.Time `json:"completed_at,omitempty"`
	SizeBytes    int64      `json:"size_bytes"`
	Checksum     string     `json:"checksum"`
	StoragePath  string     `json:"storage_path"`
	RestoreKey   string     `json:"restore_key"`
	ErrorMessage string     `json:"error_message,omitempty"`
}

// RestoreRequest represents a restore request
type RestoreRequest struct {
	BackupID      string `json:"backup_id"`
	RestoreKey    string `json:"restore_key"`
	TargetPath    string `json:"target_path,omitempty"`
	ApplicationID string `json:"application_id"`
}

// RestoreResponse represents a restore response
type RestoreResponse struct {
	RestoreID    string     `json:"restore_id"`
	Status       string     `json:"status"`
	StartedAt    time.Time  `json:"started_at"`
	CompletedAt  *time.Time `json:"completed_at,omitempty"`
	FilesCount   int        `json:"files_count"`
	SizeBytes    int64      `json:"size_bytes"`
	ErrorMessage string     `json:"error_message,omitempty"`
}

// Config holds the backup integration configuration
type Config struct {
	BackupServiceURL string        `yaml:"backup_service_url" json:"backup_service_url"`
	Timeout          time.Duration `yaml:"timeout" json:"timeout"`
	RetryAttempts    int           `yaml:"retry_attempts" json:"retry_attempts"`
	RetryDelay       time.Duration `yaml:"retry_delay" json:"retry_delay"`
	RedisURL         string        `yaml:"redis_url" json:"redis_url"`
}

// NewBackupIntegrationClient creates a new backup integration client
func NewBackupIntegrationClient(cfg Config, logger *logrus.Logger) (*BackupIntegrationClient, error) {
	// Initialize HTTP client
	httpClient := &http.Client{
		Timeout: cfg.Timeout,
		Transport: &http.Transport{
			MaxIdleConns:       100,
			IdleConnTimeout:    90 * time.Second,
			DisableCompression: false,
		},
	}

	// Initialize Redis client for caching
	opt, err := redis.ParseURL(cfg.RedisURL)
	if err != nil {
		return nil, fmt.Errorf("failed to parse Redis URL: %w", err)
	}
	redisClient := redis.NewClient(opt)

	// Initialize Prometheus metrics
	backupRequests := prometheus.NewCounterVec(
		prometheus.CounterOpts{
			Name: "backup_requests_total",
			Help: "Total number of backup requests",
		},
		[]string{"application_id", "backup_type", "status"},
	)

	backupDuration := prometheus.NewHistogramVec(
		prometheus.HistogramOpts{
			Name:    "backup_duration_seconds",
			Help:    "Duration of backup operations",
			Buckets: prometheus.DefBuckets,
		},
		[]string{"application_id", "backup_type"},
	)

	backupSuccess := prometheus.NewCounterVec(
		prometheus.CounterOpts{
			Name: "backup_success_total",
			Help: "Total number of successful backup operations",
		},
		[]string{"application_id", "backup_type"},
	)

	backupFailure := prometheus.NewCounterVec(
		prometheus.CounterOpts{
			Name: "backup_failure_total",
			Help: "Total number of failed backup operations",
		},
		[]string{"application_id", "backup_type", "error_type"},
	)

	storageUsage := prometheus.NewGaugeVec(
		prometheus.GaugeOpts{
			Name: "backup_storage_usage_bytes",
			Help: "Current backup storage usage",
		},
		[]string{"application_id", "storage_type"},
	)

	// Register metrics
	prometheus.MustRegister(backupRequests, backupDuration, backupSuccess, backupFailure, storageUsage)

	return &BackupIntegrationClient{
		backupServiceURL: cfg.BackupServiceURL,
		httpClient:       httpClient,
		redisClient:      redisClient,
		logger:           logger,
		backupRequests:   backupRequests,
		backupDuration:   backupDuration,
		backupSuccess:    backupSuccess,
		backupFailure:    backupFailure,
		storageUsage:     storageUsage,
	}, nil
}

// CreateBackup creates a backup of the specified data
func (c *BackupIntegrationClient) CreateBackup(ctx context.Context, req BackupRequest) (*BackupResponse, error) {
	start := time.Now()
	defer func() {
		c.backupDuration.WithLabelValues(req.ApplicationID, req.BackupType).Observe(time.Since(start).Seconds())
	}()

	c.logger.WithFields(logrus.Fields{
		"application_id": req.ApplicationID,
		"backup_type":    req.BackupType,
		"priority":       req.Priority,
	}).Info("Creating backup")

	// Check cache for existing backup status
	cacheKey := fmt.Sprintf("backup:status:%s:%s", req.ApplicationID, req.BackupType)
	if cached, err := c.redisClient.Get(ctx, cacheKey).Result(); err == nil {
		var cachedResp BackupResponse
		if json.Unmarshal([]byte(cached), &cachedResp) == nil {
			c.logger.WithField("backup_id", cachedResp.BackupID).Debug("Found cached backup status")
			return &cachedResp, nil
		}
	}

	// Prepare request
	reqBody, err := json.Marshal(req)
	if err != nil {
		c.backupFailure.WithLabelValues(req.ApplicationID, req.BackupType, "marshal_error").Inc()
		return nil, fmt.Errorf("failed to marshal backup request: %w", err)
	}

	// Make HTTP request
	httpReq, err := http.NewRequestWithContext(ctx, "POST", c.backupServiceURL+"/api/v1/backups", bytes.NewBuffer(reqBody))
	if err != nil {
		c.backupFailure.WithLabelValues(req.ApplicationID, req.BackupType, "request_error").Inc()
		return nil, fmt.Errorf("failed to create request: %w", err)
	}
	httpReq.Header.Set("Content-Type", "application/json")

	resp, err := c.httpClient.Do(httpReq)
	if err != nil {
		c.backupFailure.WithLabelValues(req.ApplicationID, req.BackupType, "network_error").Inc()
		return nil, fmt.Errorf("failed to make request: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusAccepted && resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		c.backupFailure.WithLabelValues(req.ApplicationID, req.BackupType, "api_error").Inc()
		return nil, fmt.Errorf("backup request failed with status %d: %s", resp.StatusCode, string(body))
	}

	// Parse response
	var backupResp BackupResponse
	if err := json.NewDecoder(resp.Body).Decode(&backupResp); err != nil {
		c.backupFailure.WithLabelValues(req.ApplicationID, req.BackupType, "response_error").Inc()
		return nil, fmt.Errorf("failed to decode response: %w", err)
	}

	// Update metrics
	c.backupRequests.WithLabelValues(req.ApplicationID, req.BackupType, "initiated").Inc()
	c.backupSuccess.WithLabelValues(req.ApplicationID, req.BackupType).Inc()

	// Cache response
	respData, _ := json.Marshal(backupResp)
	c.redisClient.Set(ctx, cacheKey, string(respData), 5*time.Minute)

	c.logger.WithFields(logrus.Fields{
		"backup_id": backupResp.BackupID,
		"status":    backupResp.Status,
	}).Info("Backup request submitted successfully")

	return &backupResp, nil
}

// GetBackupStatus retrieves the status of a backup
func (c *BackupIntegrationClient) GetBackupStatus(ctx context.Context, backupID string) (*BackupResponse, error) {
	c.logger.WithField("backup_id", backupID).Debug("Fetching backup status")

	// Check cache first
	cacheKey := fmt.Sprintf("backup:details:%s", backupID)
	if cached, err := c.redisClient.Get(ctx, cacheKey).Result(); err == nil {
		var cachedResp BackupResponse
		if json.Unmarshal([]byte(cached), &cachedResp) == nil {
			return &cachedResp, nil
		}
	}

	req, err := http.NewRequestWithContext(ctx, "GET", c.backupServiceURL+"/api/v1/backups/"+backupID, nil)
	if err != nil {
		return nil, fmt.Errorf("failed to create request: %w", err)
	}

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("failed to get backup status: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("failed to get backup status with status %d: %s", resp.StatusCode, string(body))
	}

	var backupResp BackupResponse
	if err := json.NewDecoder(resp.Body).Decode(&backupResp); err != nil {
		return nil, fmt.Errorf("failed to decode response: %w", err)
	}

	// Cache response
	respData, _ := json.Marshal(backupResp)
	cacheDuration := 1 * time.Minute
	if backupResp.Status == "completed" || backupResp.Status == "failed" {
		cacheDuration = 30 * time.Minute // Final status can be cached longer
	}
	c.redisClient.Set(ctx, cacheKey, string(respData), cacheDuration)

	return &backupResp, nil
}

// RestoreBackup initiates a restore operation
func (c *BackupIntegrationClient) RestoreBackup(ctx context.Context, req RestoreRequest) (*RestoreResponse, error) {
	c.logger.WithFields(logrus.Fields{
		"backup_id":      req.BackupID,
		"application_id": req.ApplicationID,
	}).Info("Starting restore operation")

	reqBody, err := json.Marshal(req)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal restore request: %w", err)
	}

	httpReq, err := http.NewRequestWithContext(ctx, "POST", c.backupServiceURL+"/api/v1/restores", bytes.NewBuffer(reqBody))
	if err != nil {
		return nil, fmt.Errorf("failed to create request: %w", err)
	}
	httpReq.Header.Set("Content-Type", "application/json")

	resp, err := c.httpClient.Do(httpReq)
	if err != nil {
		return nil, fmt.Errorf("failed to make restore request: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusAccepted && resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("restore request failed with status %d: %s", resp.StatusCode, string(body))
	}

	var restoreResp RestoreResponse
	if err := json.NewDecoder(resp.Body).Decode(&restoreResp); err != nil {
		return nil, fmt.Errorf("failed to decode restore response: %w", err)
	}

	c.logger.WithFields(logrus.Fields{
		"restore_id": restoreResp.RestoreID,
		"status":     restoreResp.Status,
	}).Info("Restore operation initiated")

	return &restoreResp, nil
}

// GetRestoreStatus retrieves the status of a restore operation
func (c *BackupIntegrationClient) GetRestoreStatus(ctx context.Context, restoreID string) (*RestoreResponse, error) {
	req, err := http.NewRequestWithContext(ctx, "GET", c.backupServiceURL+"/api/v1/restores/"+restoreID, nil)
	if err != nil {
		return nil, fmt.Errorf("failed to create request: %w", err)
	}

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("failed to get restore status: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("failed to get restore status with status %d: %s", resp.StatusCode, string(body))
	}

	var restoreResp RestoreResponse
	if err := json.NewDecoder(resp.Body).Decode(&restoreResp); err != nil {
		return nil, fmt.Errorf("failed to decode response: %w", err)
	}

	return &restoreResp, nil
}

// ListBackups lists available backups for an application
func (c *BackupIntegrationClient) ListBackups(ctx context.Context, applicationID, backupType string, limit int) ([]BackupResponse, error) {
	url := fmt.Sprintf("%s/api/v1/backups?application_id=%s", c.backupServiceURL, applicationID)
	if backupType != "" {
		url += fmt.Sprintf("&backup_type=%s", backupType)
	}
	if limit > 0 {
		url += fmt.Sprintf("&limit=%d", limit)
	}

	req, err := http.NewRequestWithContext(ctx, "GET", url, nil)
	if err != nil {
		return nil, fmt.Errorf("failed to create request: %w", err)
	}

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("failed to list backups: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("failed to list backups with status %d: %s", resp.StatusCode, string(body))
	}

	var listResp struct {
		Backups []BackupResponse `json:"backups"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&listResp); err != nil {
		return nil, fmt.Errorf("failed to decode response: %w", err)
	}

	return listResp.Backups, nil
}

// UpdateStorageMetrics updates storage usage metrics
func (c *BackupIntegrationClient) UpdateStorageMetrics(ctx context.Context, applicationID string) error {
	url := fmt.Sprintf("%s/api/v1/backups/storage-stats", c.backupServiceURL)
	if applicationID != "" {
		url += fmt.Sprintf("?application_id=%s", applicationID)
	}

	req, err := http.NewRequestWithContext(ctx, "GET", url, nil)
	if err != nil {
		return fmt.Errorf("failed to create request: %w", err)
	}

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return fmt.Errorf("failed to get storage stats: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return fmt.Errorf("failed to get storage stats with status %d", resp.StatusCode)
	}

	var stats struct {
		ApplicationStats []struct {
			ApplicationID string `json:"application_id"`
			StorageType   string `json:"storage_type"`
			UsageBytes    int64  `json:"usage_bytes"`
		} `json:"application_stats"`
	}

	if err := json.NewDecoder(resp.Body).Decode(&stats); err != nil {
		return fmt.Errorf("failed to decode storage stats: %w", err)
	}

	// Update metrics
	for _, stat := range stats.ApplicationStats {
		c.storageUsage.WithLabelValues(stat.ApplicationID, stat.StorageType).Set(float64(stat.UsageBytes))
	}

	return nil
}

// Close closes the backup integration client
func (c *BackupIntegrationClient) Close() error {
	if c.redisClient != nil {
		return c.redisClient.Close()
	}
	return nil
}