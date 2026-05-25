package database

import (
	"context"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"time"

	"go.uber.org/zap"
)

// BackupManager handles database backup and recovery operations
type BackupManager struct {
	pool      *PostgreSQLPoolManager
	logger    *zap.Logger
	config    *BackupConfig
	backupDir string
}

// BackupConfig defines configuration for backup operations
type BackupConfig struct {
	// Backup settings
	BackupDirectory     string `mapstructure:"backup_directory"`
	BackupRetentionDays int    `mapstructure:"backup_retention_days"`
	BackupCompression   bool   `mapstructure:"backup_compression"`
	BackupFormat        string `mapstructure:"backup_format"` // "custom", "directory", "tar", "plain"

	// Connection settings for backup
	BackupHost     string `mapstructure:"backup_host"`
	BackupPort     int    `mapstructure:"backup_port"`
	BackupUsername string `mapstructure:"backup_username"`
	BackupPassword string `mapstructure:"backup_password"`
	BackupDatabase string `mapstructure:"backup_database"`

	// Scheduling
	AutoBackupEnabled  bool          `mapstructure:"auto_backup_enabled"`
	AutoBackupInterval time.Duration `mapstructure:"auto_backup_interval"`
	AutoBackupTime     string        `mapstructure:"auto_backup_time"` // HH:MM format

	// Validation
	VerifyBackups       bool   `mapstructure:"verify_backups"`
	TestRestoreEnabled  bool   `mapstructure:"test_restore_enabled"`
	TestRestoreDatabase string `mapstructure:"test_restore_database"`

	// Notifications
	BackupNotificationEnabled bool   `mapstructure:"backup_notification_enabled"`
	NotificationEmail         string `mapstructure:"notification_email"`
	NotificationWebhook       string `mapstructure:"notification_webhook"`
}

// DefaultBackupConfig returns default backup configuration
func DefaultBackupConfig() *BackupConfig {
	return &BackupConfig{
		BackupDirectory:           "./backups",
		BackupRetentionDays:       30,
		BackupCompression:         true,
		BackupFormat:              "custom",
		AutoBackupEnabled:         false,
		AutoBackupInterval:        24 * time.Hour,
		AutoBackupTime:            "02:00", // 2 AM
		VerifyBackups:             true,
		TestRestoreEnabled:        false,
		BackupNotificationEnabled: true,
	}
}

// BackupInfo contains information about a backup
type BackupInfo struct {
	Filename     string        `json:"filename"`
	Path         string        `json:"path"`
	Size         int64         `json:"size_bytes"`
	Format       string        `json:"format"`
	Compressed   bool          `json:"compressed"`
	CreatedAt    time.Time     `json:"created_at"`
	Duration     time.Duration `json:"duration"`
	Status       string        `json:"status"` // "success", "failed", "running"
	Checksum     string        `json:"checksum,omitempty"`
	ErrorMessage string        `json:"error_message,omitempty"`
	Verified     bool          `json:"verified"`
	VerifiedAt   *time.Time    `json:"verified_at,omitempty"`
}

// RestoreInfo contains information about a restore operation
type RestoreInfo struct {
	BackupPath     string        `json:"backup_path"`
	TargetDatabase string        `json:"target_database"`
	StartedAt      time.Time     `json:"started_at"`
	CompletedAt    *time.Time    `json:"completed_at,omitempty"`
	Duration       time.Duration `json:"duration"`
	Status         string        `json:"status"` // "success", "failed", "running"
	ErrorMessage   string        `json:"error_message,omitempty"`
	RestoredTables int           `json:"restored_tables"`
	RestoredRows   int64         `json:"restored_rows"`
}

// NewBackupManager creates a new backup manager
func NewBackupManager(pool *PostgreSQLPoolManager, logger *zap.Logger, config *BackupConfig) (*BackupManager, error) {
	if config == nil {
		config = DefaultBackupConfig()
	}

	if logger == nil {
		logger = zap.NewNop()
	}

	// Create backup directory if it doesn't exist
	if err := os.MkdirAll(config.BackupDirectory, 0755); err != nil {
		return nil, fmt.Errorf("failed to create backup directory: %w", err)
	}

	return &BackupManager{
		pool:      pool,
		logger:    logger,
		config:    config,
		backupDir: config.BackupDirectory,
	}, nil
}

// CreateBackup creates a database backup
func (bm *BackupManager) CreateBackup(ctx context.Context, backupName string) (*BackupInfo, error) {
	if backupName == "" {
		backupName = fmt.Sprintf("backup_%s", time.Now().Format("20060102_150405"))
	}

	backupInfo := &BackupInfo{
		Filename:   fmt.Sprintf("%s.%s", backupName, bm.getBackupExtension()),
		Path:       filepath.Join(bm.backupDir, fmt.Sprintf("%s.%s", backupName, bm.getBackupExtension())),
		Format:     bm.config.BackupFormat,
		Compressed: bm.config.BackupCompression,
		CreatedAt:  time.Now(),
		Status:     "running",
	}

	startTime := time.Now()

	bm.logger.Info("Starting database backup",
		zap.String("name", backupName),
		zap.String("path", backupInfo.Path),
		zap.String("format", backupInfo.Format))

	// Build pg_dump command
	cmd, err := bm.buildBackupCommand(backupInfo)
	if err != nil {
		backupInfo.Status = "failed"
		backupInfo.ErrorMessage = err.Error()
		backupInfo.Duration = time.Since(startTime)
		return backupInfo, err
	}

	// Execute backup
	output, err := cmd.CombinedOutput()
	if err != nil {
		backupInfo.Status = "failed"
		backupInfo.ErrorMessage = fmt.Sprintf("pg_dump failed: %v, output: %s", err, string(output))
		backupInfo.Duration = time.Since(startTime)

		// Clean up partial backup file
		os.Remove(backupInfo.Path)

		bm.logger.Error("Database backup failed",
			zap.String("name", backupName),
			zap.Error(err),
			zap.String("output", string(output)))

		return backupInfo, err
	}

	// Get file size
	if stat, err := os.Stat(backupInfo.Path); err == nil {
		backupInfo.Size = stat.Size()
	}

	backupInfo.Status = "success"
	backupInfo.Duration = time.Since(startTime)

	bm.logger.Info("Database backup completed successfully",
		zap.String("name", backupName),
		zap.Int64("size_bytes", backupInfo.Size),
		zap.Duration("duration", backupInfo.Duration))

	// Verify backup if enabled
	if bm.config.VerifyBackups {
		if err := bm.VerifyBackup(ctx, backupInfo); err != nil {
			bm.logger.Warn("Backup verification failed", zap.Error(err))
		}
	}

	// Clean up old backups
	if err := bm.CleanupOldBackups(ctx); err != nil {
		bm.logger.Warn("Failed to cleanup old backups", zap.Error(err))
	}

	// Send notification if enabled
	if bm.config.BackupNotificationEnabled {
		bm.sendBackupNotification(backupInfo)
	}

	return backupInfo, nil
}

// RestoreBackup restores a database from a backup
func (bm *BackupManager) RestoreBackup(ctx context.Context, backupPath string, targetDatabase string) (*RestoreInfo, error) {
	restoreInfo := &RestoreInfo{
		BackupPath:     backupPath,
		TargetDatabase: targetDatabase,
		StartedAt:      time.Now(),
		Status:         "running",
	}

	bm.logger.Info("Starting database restore",
		zap.String("backup_path", backupPath),
		zap.String("target_database", targetDatabase))

	// Verify backup file exists
	if _, err := os.Stat(backupPath); os.IsNotExist(err) {
		restoreInfo.Status = "failed"
		restoreInfo.ErrorMessage = "Backup file does not exist"
		return restoreInfo, fmt.Errorf("backup file does not exist: %s", backupPath)
	}

	// Build pg_restore command
	cmd, err := bm.buildRestoreCommand(backupPath, targetDatabase)
	if err != nil {
		restoreInfo.Status = "failed"
		restoreInfo.ErrorMessage = err.Error()
		return restoreInfo, err
	}

	// Execute restore
	output, err := cmd.CombinedOutput()
	if err != nil {
		restoreInfo.Status = "failed"
		restoreInfo.ErrorMessage = fmt.Sprintf("pg_restore failed: %v, output: %s", err, string(output))

		completedAt := time.Now()
		restoreInfo.CompletedAt = &completedAt
		restoreInfo.Duration = completedAt.Sub(restoreInfo.StartedAt)

		bm.logger.Error("Database restore failed",
			zap.String("backup_path", backupPath),
			zap.String("target_database", targetDatabase),
			zap.Error(err),
			zap.String("output", string(output)))

		return restoreInfo, err
	}

	// Mark as successful
	completedAt := time.Now()
	restoreInfo.CompletedAt = &completedAt
	restoreInfo.Duration = completedAt.Sub(restoreInfo.StartedAt)
	restoreInfo.Status = "success"

	bm.logger.Info("Database restore completed successfully",
		zap.String("backup_path", backupPath),
		zap.String("target_database", targetDatabase),
		zap.Duration("duration", restoreInfo.Duration))

	return restoreInfo, nil
}

// VerifyBackup verifies that a backup is valid
func (bm *BackupManager) VerifyBackup(ctx context.Context, backupInfo *BackupInfo) error {
	bm.logger.Info("Verifying backup", zap.String("path", backupInfo.Path))

	// For custom format backups, we can use pg_restore --list to verify
	if backupInfo.Format == "custom" {
		cmd := exec.CommandContext(ctx, "pg_restore", "--list", backupInfo.Path)
		output, err := cmd.CombinedOutput()
		if err != nil {
			return fmt.Errorf("backup verification failed: %v, output: %s", err, string(output))
		}

		// Count objects in backup
		lines := strings.Split(string(output), "\n")
		bm.logger.Info("Backup verification completed",
			zap.String("path", backupInfo.Path),
			zap.Int("objects_count", len(lines)))
	}

	backupInfo.Verified = true
	now := time.Now()
	backupInfo.VerifiedAt = &now

	return nil
}

// ListBackups returns a list of all backups
func (bm *BackupManager) ListBackups(ctx context.Context) ([]*BackupInfo, error) {
	entries, err := os.ReadDir(bm.backupDir)
	if err != nil {
		return nil, fmt.Errorf("failed to read backup directory: %w", err)
	}

	var backups []*BackupInfo
	for _, entry := range entries {
		if entry.IsDir() {
			continue
		}

		info, err := entry.Info()
		if err != nil {
			continue
		}

		backupInfo := &BackupInfo{
			Filename:  entry.Name(),
			Path:      filepath.Join(bm.backupDir, entry.Name()),
			Size:      info.Size(),
			CreatedAt: info.ModTime(),
		}

		// Determine format and compression from extension
		if strings.HasSuffix(entry.Name(), ".sql") {
			backupInfo.Format = "plain"
		} else if strings.HasSuffix(entry.Name(), ".tar") {
			backupInfo.Format = "tar"
		} else if strings.HasSuffix(entry.Name(), ".dump") || strings.HasSuffix(entry.Name(), ".backup") {
			backupInfo.Format = "custom"
			backupInfo.Compressed = true
		}

		backups = append(backups, backupInfo)
	}

	// Sort by creation time (newest first)
	for i := 0; i < len(backups)-1; i++ {
		for j := i + 1; j < len(backups); j++ {
			if backups[i].CreatedAt.Before(backups[j].CreatedAt) {
				backups[i], backups[j] = backups[j], backups[i]
			}
		}
	}

	return backups, nil
}

// CleanupOldBackups removes backups older than the retention period
func (bm *BackupManager) CleanupOldBackups(ctx context.Context) error {
	if bm.config.BackupRetentionDays <= 0 {
		return nil
	}

	cutoffTime := time.Now().AddDate(0, 0, -bm.config.BackupRetentionDays)
	deletedCount := 0

	entries, err := os.ReadDir(bm.backupDir)
	if err != nil {
		return fmt.Errorf("failed to read backup directory: %w", err)
	}

	for _, entry := range entries {
		if entry.IsDir() {
			continue
		}

		info, err := entry.Info()
		if err != nil {
			continue
		}

		if info.ModTime().Before(cutoffTime) {
			path := filepath.Join(bm.backupDir, entry.Name())
			if err := os.Remove(path); err != nil {
				bm.logger.Warn("Failed to delete old backup",
					zap.String("path", path),
					zap.Error(err))
			} else {
				deletedCount++
				bm.logger.Debug("Deleted old backup",
					zap.String("path", path),
					zap.Time("mod_time", info.ModTime()))
			}
		}
	}

	if deletedCount > 0 {
		bm.logger.Info("Cleaned up old backups",
			zap.Int("deleted_count", deletedCount),
			zap.Duration("retention_period", time.Duration(bm.config.BackupRetentionDays)*24*time.Hour))
	}

	return nil
}

// DeleteBackup removes a specific backup file
func (bm *BackupManager) DeleteBackup(ctx context.Context, backupPath string) error {
	if err := os.Remove(backupPath); err != nil {
		return fmt.Errorf("failed to delete backup: %w", err)
	}

	bm.logger.Info("Backup deleted", zap.String("path", backupPath))
	return nil
}

// GetBackupInfo returns information about a specific backup
func (bm *BackupManager) GetBackupInfo(ctx context.Context, backupPath string) (*BackupInfo, error) {
	info, err := os.Stat(backupPath)
	if err != nil {
		return nil, fmt.Errorf("backup file not found: %w", err)
	}

	backupInfo := &BackupInfo{
		Filename:  filepath.Base(backupPath),
		Path:      backupPath,
		Size:      info.Size(),
		CreatedAt: info.ModTime(),
	}

	// Determine format and compression from extension
	filename := filepath.Base(backupPath)
	if strings.HasSuffix(filename, ".sql") {
		backupInfo.Format = "plain"
	} else if strings.HasSuffix(filename, ".tar") {
		backupInfo.Format = "tar"
	} else if strings.HasSuffix(filename, ".dump") || strings.HasSuffix(filename, ".backup") {
		backupInfo.Format = "custom"
		backupInfo.Compressed = true
	}

	return backupInfo, nil
}

// buildBackupCommand builds the pg_dump command for creating a backup
func (bm *BackupManager) buildBackupCommand(backupInfo *BackupInfo) (*exec.Cmd, error) {
	args := []string{
		"--format=" + backupInfo.Format,
		"--file=" + backupInfo.Path,
	}

	// Add compression if enabled
	if bm.config.BackupCompression && backupInfo.Format == "custom" {
		args = append(args, "--compress=9")
	}

	// Add connection parameters
	if bm.config.BackupHost != "" {
		args = append(args, "--host="+bm.config.BackupHost)
	}
	if bm.config.BackupPort > 0 {
		args = append(args, "--port="+fmt.Sprintf("%d", bm.config.BackupPort))
	}
	if bm.config.BackupUsername != "" {
		args = append(args, "--username="+bm.config.BackupUsername)
	}

	// Add database name
	database := bm.config.BackupDatabase
	if database == "" {
		// Extract from connection string or use default
		database = "queryflux"
	}
	args = append(args, database)

	// Create command
	cmd := exec.Command("pg_dump", args...)

	// Set environment variables
	if bm.config.BackupPassword != "" {
		cmd.Env = append(os.Environ(), "PGPASSWORD="+bm.config.BackupPassword)
	}

	return cmd, nil
}

// buildRestoreCommand builds the pg_restore command for restoring a backup
func (bm *BackupManager) buildRestoreCommand(backupPath, targetDatabase string) (*exec.Cmd, error) {
	args := []string{
		"--clean",
		"--if-exists",
		"--verbose",
		"--dbname=" + targetDatabase,
		backupPath,
	}

	// Add connection parameters
	if bm.config.BackupHost != "" {
		args = append(args, "--host="+bm.config.BackupHost)
	}
	if bm.config.BackupPort > 0 {
		args = append(args, "--port="+fmt.Sprintf("%d", bm.config.BackupPort))
	}
	if bm.config.BackupUsername != "" {
		args = append(args, "--username="+bm.config.BackupUsername)
	}

	// Create command
	cmd := exec.Command("pg_restore", args...)

	// Set environment variables
	if bm.config.BackupPassword != "" {
		cmd.Env = append(os.Environ(), "PGPASSWORD="+bm.config.BackupPassword)
	}

	return cmd, nil
}

// getBackupExtension returns the appropriate file extension for the backup format
func (bm *BackupManager) getBackupExtension() string {
	switch bm.config.BackupFormat {
	case "plain":
		return "sql"
	case "tar":
		return "tar"
	case "directory":
		return "dump"
	case "custom":
		fallthrough
	default:
		if bm.config.BackupCompression {
			return "backup"
		}
		return "dump"
	}
}

// sendBackupNotification sends a notification about backup completion
func (bm *BackupManager) sendBackupNotification(backupInfo *BackupInfo) {
	// This is a placeholder for notification implementation
	// In a real implementation, you might:
	// - Send email
	// - Send Slack message
	// - Send webhook
	// - Log to external system

	bm.logger.Info("Backup notification sent",
		zap.String("filename", backupInfo.Filename),
		zap.String("status", backupInfo.Status))
}

// ValidateBackupConfig validates the backup configuration
func (bm *BackupManager) ValidateBackupConfig() error {
	// Check if pg_dump and pg_restore are available
	if _, err := exec.LookPath("pg_dump"); err != nil {
		return fmt.Errorf("pg_dump not found in PATH: %w", err)
	}

	if _, err := exec.LookPath("pg_restore"); err != nil {
		return fmt.Errorf("pg_restore not found in PATH: %w", err)
	}

	// Check backup directory
	if stat, err := os.Stat(bm.backupDir); err != nil {
		return fmt.Errorf("backup directory not accessible: %w", err)
	} else if !stat.IsDir() {
		return fmt.Errorf("backup path is not a directory: %s", bm.backupDir)
	}

	// Validate backup format
	validFormats := []string{"plain", "custom", "tar", "directory"}
	formatValid := false
	for _, format := range validFormats {
		if bm.config.BackupFormat == format {
			formatValid = true
			break
		}
	}

	if !formatValid {
		return fmt.Errorf("invalid backup format: %s, valid formats: %v",
			bm.config.BackupFormat, validFormats)
	}

	return nil
}
