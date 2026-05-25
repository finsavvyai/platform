package integration

import (
	"context"
	"fmt"
	"time"

	"github.com/sirupsen/logrus"
)

// BackupMiddleware provides automatic backup integration for applications
type BackupMiddleware struct {
	client *BackupIntegrationClient
	config BackupMiddlewareConfig
	logger *logrus.Logger
}

// BackupMiddlewareConfig holds configuration for backup middleware
type BackupMiddlewareConfig struct {
	ApplicationID     string        `yaml:"application_id" json:"application_id"`
	AutoBackup        bool          `yaml:"auto_backup" json:"auto_backup"`
	BackupInterval    time.Duration `yaml:"backup_interval" json:"backup_interval"`
	BackupOnShutdown  bool          `yaml:"backup_on_shutdown" json:"backup_on_shutdown"`
	BackupOnFailure   bool          `yaml:"backup_on_failure" json:"backup_on_failure"`
	MaxBackups        int           `yaml:"max_backups" json:"max_backups"`
	RetentionDays     int           `yaml:"retention_days" json:"retention_days"`
	BackupTriggers    []string      `yaml:"backup_triggers" json:"backup_triggers"`
	CriticalDataPaths []string      `yaml:"critical_data_paths" json:"critical_data_paths"`
}

// BackupDataProvider interface for applications to provide backup data
type BackupDataProvider interface {
	GetBackupData(ctx context.Context, backupType string) (map[string]interface{}, error)
	GetBackupMetadata(ctx context.Context) (map[string]string, error)
	ValidateBackupData(ctx context.Context, data map[string]interface{}) error
}

// NewBackupMiddleware creates a new backup middleware
func NewBackupMiddleware(
	client *BackupIntegrationClient,
	config BackupMiddlewareConfig,
	logger *logrus.Logger,
) *BackupMiddleware {
	if logger == nil {
		logger = logrus.New()
	}

	return &BackupMiddleware{
		client: client,
		config: config,
		logger: logger,
	}
}

// Start starts the backup middleware
func (m *BackupMiddleware) Start(ctx context.Context, provider BackupDataProvider) error {
	m.logger.WithField("application_id", m.config.ApplicationID).Info("Starting backup middleware")

	if m.config.AutoBackup && m.config.BackupInterval > 0 {
		go m.backupScheduler(ctx, provider)
	}

	return nil
}

// Stop stops the backup middleware
func (m *BackupMiddleware) Stop(ctx context.Context, provider BackupDataProvider) error {
	m.logger.Info("Stopping backup middleware")

	if m.config.BackupOnShutdown {
		if err := m.createBackup(ctx, provider, "shutdown", "high"); err != nil {
			m.logger.WithError(err).Error("Failed to create shutdown backup")
		}
	}

	return nil
}

// TriggerBackup creates a backup based on a trigger event
func (m *BackupMiddleware) TriggerBackup(ctx context.Context, provider BackupDataProvider, trigger, priority string) error {
	m.logger.WithFields(logrus.Fields{
		"trigger":  trigger,
		"priority": priority,
	}).Info("Triggering backup")

	return m.createBackup(ctx, provider, trigger, priority)
}

// TriggerFailureBackup creates a backup on failure
func (m *BackupMiddleware) TriggerFailureBackup(ctx context.Context, provider BackupDataProvider, errorType string) error {
	if !m.config.BackupOnFailure {
		return nil
	}

	m.logger.WithField("error_type", errorType).Warn("Triggering failure backup")

	priority := "high"
	if errorType == "warning" {
		priority = "medium"
	}

	// Add error information to metadata
	return m.createBackupWithMetadata(ctx, provider, "failure", priority, map[string]string{
		"trigger":    "failure",
		"error_type": errorType,
		"failed_at":  time.Now().Format(time.RFC3339),
		"severity":   priority,
	})
}

// backupScheduler runs periodic backups
func (m *BackupMiddleware) backupScheduler(ctx context.Context, provider BackupDataProvider) {
	ticker := time.NewTicker(m.config.BackupInterval)
	defer ticker.Stop()

	m.logger.WithField("interval", m.config.BackupInterval).Info("Starting backup scheduler")

	for {
		select {
		case <-ctx.Done():
			m.logger.Info("Backup scheduler stopped")
			return
		case <-ticker.C:
			if err := m.createBackup(ctx, provider, "scheduled", "normal"); err != nil {
				m.logger.WithError(err).Error("Failed to create scheduled backup")
			}
		}
	}
}

// createBackup creates a backup with the given type and priority
func (m *BackupMiddleware) createBackup(ctx context.Context, provider BackupDataProvider, backupType, priority string) error {
	return m.createBackupWithMetadata(ctx, provider, backupType, priority, nil)
}

// createBackupWithMetadata creates a backup with additional metadata
func (m *BackupMiddleware) createBackupWithMetadata(ctx context.Context, provider BackupDataProvider, backupType, priority string, additionalMetadata map[string]string) error {
	// Get backup data
	data, err := provider.GetBackupData(ctx, backupType)
	if err != nil {
		return fmt.Errorf("failed to get backup data: %w", err)
	}

	// Validate backup data
	if err := provider.ValidateBackupData(ctx, data); err != nil {
		return fmt.Errorf("backup data validation failed: %w", err)
	}

	// Get metadata
	metadata, err := provider.GetBackupMetadata(ctx)
	if err != nil {
		m.logger.WithError(err).Warn("Failed to get backup metadata, using defaults")
		metadata = make(map[string]string)
	}

	// Add standard metadata
	metadata["application_id"] = m.config.ApplicationID
	metadata["backup_type"] = backupType
	metadata["priority"] = priority
	metadata["created_at"] = time.Now().Format(time.RFC3339)
	metadata["version"] = "1.0"

	// Add additional metadata
	for k, v := range additionalMetadata {
		metadata[k] = v
	}

	// Create backup request
	req := BackupRequest{
		ApplicationID: m.config.ApplicationID,
		BackupType:    backupType,
		Data:          data,
		Metadata:      metadata,
		Priority:      priority,
		RetentionDays: m.config.RetentionDays,
	}

	// Submit backup
	resp, err := m.client.CreateBackup(ctx, req)
	if err != nil {
		return fmt.Errorf("failed to create backup: %w", err)
	}

	m.logger.WithFields(logrus.Fields{
		"backup_id": resp.BackupID,
		"type":      backupType,
		"status":    resp.Status,
	}).Info("Backup created successfully")

	// Start monitoring backup progress if not completed immediately
	if resp.Status != "completed" {
		go m.monitorBackupProgress(context.Background(), resp.BackupID)
	}

	// Cleanup old backups if needed
	go m.cleanupOldBackups(context.Background())

	return nil
}

// monitorBackupProgress monitors the progress of a backup
func (m *BackupMiddleware) monitorBackupProgress(ctx context.Context, backupID string) {
	ticker := time.NewTicker(30 * time.Second)
	defer ticker.Stop()

	timeout := time.After(2 * time.Hour) // Maximum backup time

	for {
		select {
		case <-ctx.Done():
			return
		case <-timeout:
			m.logger.WithField("backup_id", backupID).Warn("Backup monitoring timeout")
			return
		case <-ticker.C:
			resp, err := m.client.GetBackupStatus(ctx, backupID)
			if err != nil {
				m.logger.WithError(err).Error("Failed to get backup status")
				continue
			}

			switch resp.Status {
			case "completed":
				m.logger.WithFields(logrus.Fields{
					"backup_id":  backupID,
					"size_bytes": resp.SizeBytes,
					"checksum":   resp.Checksum,
				}).Info("Backup completed successfully")
				return
			case "failed":
				m.logger.WithFields(logrus.Fields{
					"backup_id":     backupID,
					"error_message": resp.ErrorMessage,
				}).Error("Backup failed")
				return
			case "in_progress":
				m.logger.WithField("backup_id", backupID).Debug("Backup in progress")
			}
		}
	}
}

// cleanupOldBackups removes old backups to maintain the limit
func (m *BackupMiddleware) cleanupOldBackups(ctx context.Context) {
	if m.config.MaxBackups <= 0 {
		return
	}

	backups, err := m.client.ListBackups(ctx, m.config.ApplicationID, "", m.config.MaxBackups+10)
	if err != nil {
		m.logger.WithError(err).Error("Failed to list backups for cleanup")
		return
	}

	if len(backups) <= m.config.MaxBackups {
		return
	}

	// Sort backups by creation date (newest first)
	// Note: This is simplified - in production you'd want proper sorting
	excessCount := len(backups) - m.config.MaxBackups
	for i := 0; i < excessCount; i++ {
		backup := backups[len(backups)-1-i]
		m.logger.WithFields(logrus.Fields{
			"backup_id":  backup.BackupID,
			"created_at": backup.CreatedAt,
		}).Info("Would clean up old backup (implementation needed)")
		// Implementation would call the backup service to delete old backups
	}
}

// HealthCheck checks the health of the backup integration
func (m *BackupMiddleware) HealthCheck(ctx context.Context) error {
	// Check if we can reach the backup service
	req := BackupRequest{
		ApplicationID: m.config.ApplicationID,
		BackupType:    "health_check",
		Data:          map[string]interface{}{"test": true},
		Metadata:      map[string]string{"purpose": "health_check"},
		Priority:      "low",
	}

	_, err := m.client.CreateBackup(ctx, req)
	if err != nil {
		return fmt.Errorf("backup service health check failed: %w", err)
	}

	return nil
}

// GetBackupStatus provides a simple way to get backup status
func (m *BackupMiddleware) GetBackupStatus(ctx context.Context, backupID string) (*BackupResponse, error) {
	return m.client.GetBackupStatus(ctx, backupID)
}

// GetRecentBackups gets the most recent backups
func (m *BackupMiddleware) GetRecentBackups(ctx context.Context, limit int) ([]BackupResponse, error) {
	return m.client.ListBackups(ctx, m.config.ApplicationID, "", limit)
}
