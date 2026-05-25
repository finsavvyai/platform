package backup

import (
	"context"
	"crypto/md5"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"log"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"time"

	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/service/s3"
	"github.com/aws/aws-sdk-go-v2/service/s3/types"
)

// CrossRegionReplicationManager manages cross-region backup replication
type CrossRegionReplicationManager struct {
	logger            *log.Logger
	s3Clients         map[string]*s3.Client
	config            ReplicationConfig
	replicationRules  map[string]ReplicationRule
	replicationStatus map[string]*ReplicationStatus
	mu                sync.RWMutex
}

// ReplicationConfig holds cross-region replication configuration
type ReplicationConfig struct {
	PrimaryRegion       string        `json:"primary_region"`
	ReplicationRegions  []string      `json:"replication_regions"`
	ReplicationDelay    time.Duration `json:"replication_delay"`
	ReplicationInterval time.Duration `json:"replication_interval"`
	MaxReplicationLag   time.Duration `json:"max_replication_lag"`
	EnableEncryption    bool          `json:"enable_encryption"`
	StorageClass        string        `json:"storage_class"`
	CompressionEnabled  bool          `json:"compression_enabled"`
	VerifyIntegrity     bool          `json:"verify_integrity"`
	DeleteOldBackups    bool          `json:"delete_old_backups"`
	ReplicationMode     string        `json:"replication_mode"` // "sync", "async", "scheduled"
	RetryAttempts       int           `json:"retry_attempts"`
	RetryDelay          time.Duration `json:"retry_delay"`
}

// ReplicationRule defines how specific backups should be replicated
type ReplicationRule struct {
	ID              string            `json:"id"`
	Pattern         string            `json:"pattern"`          // Glob pattern for backup files
	TargetRegions   []string          `json:"target_regions"`   // Target regions for this rule
	StorageClass    string            `json:"storage_class"`    // Storage class in target regions
	RetentionPeriod time.Duration     `json:"retention_period"` // How long to keep in target regions
	Priority        int               `json:"priority"`         // Rule priority (higher = more important)
	Enabled         bool              `json:"enabled"`          // Whether this rule is active
	Encryption      bool              `json:"encryption"`       // Whether to encrypt in target regions
	Metadata        map[string]string `json:"metadata"`         // Additional metadata
}

// ReplicationStatus tracks replication status for each backup
type ReplicationStatus struct {
	BackupPath           string                  `json:"backup_path"`
	BackupSize           int64                   `json:"backup_size"`
	BackupChecksum       string                  `json:"backup_checksum"`
	CreatedAt            time.Time               `json:"created_at"`
	ReplicationStarted   time.Time               `json:"replication_started"`
	ReplicationCompleted time.Time               `json:"replication_completed"`
	Status               string                  `json:"status"` // "pending", "in_progress", "completed", "failed"
	TargetRegions        map[string]RegionStatus `json:"target_regions"`
	ReplicationLag       time.Duration           `json:"replication_lag"`
	Error                string                  `json:"error,omitempty"`
	RetryCount           int                     `json:"retry_count"`
	LastRetry            time.Time               `json:"last_retry"`
}

// RegionStatus tracks replication status for a specific region
type RegionStatus struct {
	Region         string        `json:"region"`
	Status         string        `json:"status"` // "pending", "in_progress", "completed", "failed"
	StartedAt      time.Time     `json:"started_at"`
	CompletedAt    time.Time     `json:"completed_at"`
	TargetPath     string        `json:"target_path"`
	TargetSize     int64         `json:"target_size"`
	TargetChecksum string        `json:"target_checksum"`
	ReplicationLag time.Duration `json:"replication_lag"`
	Error          string        `json:"error,omitempty"`
	Verified       bool          `json:"verified"`
}

// ReplicationJob represents a replication job
type ReplicationJob struct {
	ID            string          `json:"id"`
	BackupPath    string          `json:"backup_path"`
	TargetRegions []string        `json:"target_regions"`
	Rule          ReplicationRule `json:"rule"`
	Priority      int             `json:"priority"`
	CreatedAt     time.Time       `json:"created_at"`
	Status        string          `json:"status"`
}

// NewCrossRegionReplicationManager creates a new cross-region replication manager
func NewCrossRegionReplicationManager(config ReplicationConfig) (*CrossRegionReplicationManager, error) {
	crrm := &CrossRegionReplicationManager{
		logger:            log.New(log.Writer(), "[CRR-MANAGER] ", log.LstdFlags|log.Lmsgprefix),
		s3Clients:         make(map[string]*s3.Client),
		config:            config,
		replicationRules:  make(map[string]ReplicationRule),
		replicationStatus: make(map[string]*ReplicationStatus),
	}

	// Initialize S3 clients for all regions
	regions := append([]string{config.PrimaryRegion}, config.ReplicationRegions...)
	for _, region := range regions {
		cfg, err := createAWSConfig(region)
		if err != nil {
			return nil, fmt.Errorf("failed to create AWS config for region %s: %w", region, err)
		}
		crrm.s3Clients[region] = s3.NewFromConfig(cfg)
	}

	// Load existing replication status
	if err := crrm.loadReplicationStatus(); err != nil {
		crrm.logger.Printf("Warning: Failed to load replication status: %v", err)
	}

	// Create default replication rules
	crrm.createDefaultReplicationRules()

	// Start replication workers
	go crrm.startReplicationWorkers()

	return crrm, nil
}

// createDefaultReplicationRules creates default replication rules for different backup types
func (crrm *CrossRegionReplicationManager) createDefaultReplicationRules() {
	rules := []ReplicationRule{
		{
			ID:              "database-daily",
			Pattern:         "backups/database/daily/*",
			TargetRegions:   crrm.config.ReplicationRegions,
			StorageClass:    "STANDARD_IA",
			RetentionPeriod: 30 * 24 * time.Hour,
			Priority:        1,
			Enabled:         true,
			Encryption:      true,
			Metadata: map[string]string{
				"type":       "database",
				"frequency":  "daily",
				"importance": "high",
			},
		},
		{
			ID:              "database-weekly",
			Pattern:         "backups/database/weekly/*",
			TargetRegions:   crrm.config.ReplicationRegions,
			StorageClass:    "GLACIER",
			RetentionPeriod: 90 * 24 * time.Hour,
			Priority:        2,
			Enabled:         true,
			Encryption:      true,
			Metadata: map[string]string{
				"type":       "database",
				"frequency":  "weekly",
				"importance": "critical",
			},
		},
		{
			ID:              "database-monthly",
			Pattern:         "backups/database/monthly/*",
			TargetRegions:   crrm.config.ReplicationRegions,
			StorageClass:    "DEEP_ARCHIVE",
			RetentionPeriod: 365 * 24 * time.Hour,
			Priority:        3,
			Enabled:         true,
			Encryption:      true,
			Metadata: map[string]string{
				"type":       "database",
				"frequency":  "monthly",
				"importance": "critical",
			},
		},
		{
			ID:              "files-hourly",
			Pattern:         "backups/files/hourly/*",
			TargetRegions:   crrm.config.ReplicationRegions,
			StorageClass:    "STANDARD",
			RetentionPeriod: 7 * 24 * time.Hour,
			Priority:        4,
			Enabled:         true,
			Encryption:      false,
			Metadata: map[string]string{
				"type":       "files",
				"frequency":  "hourly",
				"importance": "medium",
			},
		},
		{
			ID:              "config-backups",
			Pattern:         "backups/config/*",
			TargetRegions:   crrm.config.ReplicationRegions,
			StorageClass:    "STANDARD",
			RetentionPeriod: 30 * 24 * time.Hour,
			Priority:        5,
			Enabled:         true,
			Encryption:      true,
			Metadata: map[string]string{
				"type":       "config",
				"frequency":  "on-change",
				"importance": "high",
			},
		},
	}

	for _, rule := range rules {
		crrm.replicationRules[rule.ID] = rule
	}

	crrm.logger.Printf("Created %d default replication rules", len(rules))
}

// QueueBackupForReplication queues a backup for cross-region replication
func (crrm *CrossRegionReplicationManager) QueueBackupForReplication(ctx context.Context, backupPath string, backupSize int64) error {
	// Find matching replication rules
	var matchingRules []ReplicationRule
	for _, rule := range crrm.replicationRules {
		if rule.Enabled && crrm.matchesPattern(backupPath, rule.Pattern) {
			matchingRules = append(matchingRules, rule)
		}
	}

	if len(matchingRules) == 0 {
		crrm.logger.Printf("No replication rules matched for backup: %s", backupPath)
		return nil
	}

	// Calculate backup checksum
	checksum, err := crrm.calculateChecksum(ctx, backupPath)
	if err != nil {
		return fmt.Errorf("failed to calculate checksum for %s: %w", backupPath, err)
	}

	// Create replication status
	crrm.mu.Lock()
	defer crrm.mu.Unlock()

	status := &ReplicationStatus{
		BackupPath:         backupPath,
		BackupSize:         backupSize,
		BackupChecksum:     checksum,
		CreatedAt:          time.Now(),
		ReplicationStarted: time.Now(),
		Status:             "pending",
		TargetRegions:      make(map[string]RegionStatus),
	}

	// Initialize target region status
	for _, rule := range matchingRules {
		for _, region := range rule.TargetRegions {
			if _, exists := status.TargetRegions[region]; !exists {
				status.TargetRegions[region] = RegionStatus{
					Region:    region,
					Status:    "pending",
					StartedAt: time.Now(),
				}
			}
		}
	}

	crrm.replicationStatus[backupPath] = status

	crrm.logger.Printf("Queued backup %s for replication to %d regions", backupPath, len(status.TargetRegions))
	return nil
}

// ReplicateBackup replicates a backup to target regions
func (crrm *CrossRegionReplicationManager) ReplicateBackup(ctx context.Context, backupPath string) error {
	crrm.mu.Lock()
	status, exists := crrm.replicationStatus[backupPath]
	crrm.mu.Unlock()

	if !exists {
		return fmt.Errorf("backup %s not found in replication status", backupPath)
	}

	status.Status = "in_progress"

	// Replicate to each target region
	for region, regionStatus := range status.TargetRegions {
		if regionStatus.Status == "completed" {
			continue
		}

		regionStatus.Status = "in_progress"
		regionStatus.StartedAt = time.Now()

		if err := crrm.replicateToRegion(ctx, backupPath, region, &regionStatus); err != nil {
			regionStatus.Status = "failed"
			regionStatus.Error = err.Error()
			crrm.logger.Printf("Failed to replicate %s to %s: %v", backupPath, region, err)
			continue
		}

		regionStatus.Status = "completed"
		regionStatus.CompletedAt = time.Now()
		regionStatus.ReplicationLag = time.Since(regionStatus.StartedAt)

		crrm.logger.Printf("Successfully replicated %s to %s in %v", backupPath, region, regionStatus.ReplicationLag)
	}

	// Check if all regions are completed
	allCompleted := true
	for _, regionStatus := range status.TargetRegions {
		if regionStatus.Status != "completed" {
			allCompleted = false
			break
		}
	}

	if allCompleted {
		status.Status = "completed"
		status.ReplicationCompleted = time.Now()
		status.ReplicationLag = time.Since(status.ReplicationStarted)
	}

	crrm.saveReplicationStatus()
	return nil
}

// replicateToRegion replicates a backup to a specific region
func (crrm *CrossRegionReplicationManager) replicateToRegion(ctx context.Context, backupPath, targetRegion string, regionStatus *RegionStatus) error {
	// Find the replication rule for this backup
	var rule *ReplicationRule
	for _, r := range crrm.replicationRules {
		if crrm.matchesPattern(backupPath, r.Pattern) {
			rule = &r
			break
		}
	}

	if rule == nil {
		return fmt.Errorf("no replication rule found for backup %s", backupPath)
	}

	// Get source client and target client
	sourceClient := crrm.s3Clients[crrm.config.PrimaryRegion]
	targetClient := crrm.s3Clients[targetRegion]

	// Parse bucket and key from backup path
	sourceBucket, sourceKey := crrm.parseS3Path(backupPath)
	targetBucket := crrm.getTargetBucket(targetRegion)
	targetKey := crrm.getTargetKey(sourceKey, targetRegion)

	// Copy object to target region
	copySource := fmt.Sprintf("%s/%s", sourceBucket, sourceKey)

	_, err := targetClient.CopyObject(ctx, &s3.CopyObjectInput{
		Bucket:            aws.String(targetBucket),
		Key:               aws.String(targetKey),
		CopySource:        aws.String(copySource),
		StorageClass:      types.StorageClass(rule.StorageClass),
		Metadata:          rule.Metadata,
		MetadataDirective: types.MetadataDirectiveReplace,
	})

	if err != nil {
		return fmt.Errorf("failed to copy object to %s: %w", targetRegion, err)
	}

	// Update region status
	regionStatus.TargetPath = fmt.Sprintf("s3://%s/%s", targetBucket, targetKey)
	regionStatus.TargetSize = regionStatus.TargetSize // Will be updated below
	regionStatus.TargetChecksum = ""                  // Will be updated below if verification is enabled

	// Get object info to verify
	headResult, err := targetClient.HeadObject(ctx, &s3.HeadObjectInput{
		Bucket: aws.String(targetBucket),
		Key:    aws.String(targetKey),
	})

	if err != nil {
		return fmt.Errorf("failed to get object info from %s: %w", targetRegion, err)
	}

	regionStatus.TargetSize = headResult.ContentLength

	// Verify integrity if enabled
	if crrm.config.VerifyIntegrity {
		targetChecksum, err := crrm.calculateRemoteChecksum(ctx, targetBucket, targetKey, targetClient)
		if err != nil {
			return fmt.Errorf("failed to calculate target checksum in %s: %w", targetRegion, err)
		}

		regionStatus.TargetChecksum = targetChecksum
		regionStatus.Verified = (targetChecksum == crrm.replicationStatus[backupPath].BackupChecksum)

		if !regionStatus.Verified {
			return fmt.Errorf("checksum mismatch between source and target in %s", targetRegion)
		}
	} else {
		regionStatus.Verified = true
	}

	return nil
}

// StartReplication starts the replication process for pending backups
func (crrm *CrossRegionReplicationManager) StartReplication(ctx context.Context) error {
	crrm.mu.Lock()
	defer crrm.mu.Unlock()

	pendingBackups := []string{}
	for backupPath, status := range crrm.replicationStatus {
		if status.Status == "pending" {
			pendingBackups = append(pendingBackups, backupPath)
		}
	}

	crrm.logger.Printf("Starting replication for %d pending backups", len(pendingBackups))

	// Start replication in parallel for multiple backups
	semaphore := make(chan struct{}, 5) // Limit concurrent replications
	var wg sync.WaitGroup

	for _, backupPath := range pendingBackups {
		wg.Add(1)
		go func(bp string) {
			defer wg.Done()
			semaphore <- struct{}{}
			defer func() { <-semaphore }()

			if err := crrm.ReplicateBackup(ctx, bp); err != nil {
				crrm.logger.Printf("Failed to replicate backup %s: %v", bp, err)
			}
		}(backupPath)
	}

	wg.Wait()
	return nil
}

// GetReplicationStatus returns replication status for all backups
func (crrm *CrossRegionReplicationManager) GetReplicationStatus() map[string]*ReplicationStatus {
	crrm.mu.RLock()
	defer crrm.mu.RUnlock()

	// Return a copy to avoid concurrent access issues
	status := make(map[string]*ReplicationStatus)
	for k, v := range crrm.replicationStatus {
		statusCopy := *v
		status[k] = &statusCopy
	}

	return status
}

// CleanupOldReplicatedBackups removes old backups from target regions based on retention policies
func (crrm *CrossRegionReplicationManager) CleanupOldReplicatedBackups(ctx context.Context) error {
	if !crrm.config.DeleteOldBackups {
		return nil
	}

	crrm.logger.Printf("Starting cleanup of old replicated backups")

	for _, rule := range crrm.replicationRules {
		if !rule.Enabled {
			continue
		}

		for _, region := range rule.TargetRegions {
			targetClient := crrm.s3Clients[region]
			targetBucket := crrm.getTargetBucket(region)

			// List objects that match this rule's pattern
			objects, err := crrm.listReplicatedObjects(ctx, targetClient, targetBucket, rule.Pattern)
			if err != nil {
				crrm.logger.Printf("Failed to list objects in %s: %v", region, err)
				continue
			}

			// Delete objects older than retention period
			cutoffTime := time.Now().Add(-rule.RetentionPeriod)
			deletedCount := 0

			for _, obj := range objects {
				if obj.LastModified.Before(cutoffTime) {
					_, err := targetClient.DeleteObject(ctx, &s3.DeleteObjectInput{
						Bucket: aws.String(targetBucket),
						Key:    aws.String(obj.Key),
					})

					if err != nil {
						crrm.logger.Printf("Failed to delete old backup %s from %s: %v", obj.Key, region, err)
						continue
					}

					deletedCount++
				}
			}

			crrm.logger.Printf("Deleted %d old backups from %s (rule: %s)", deletedCount, region, rule.ID)
		}
	}

	return nil
}

// startReplicationWorkers starts background workers for replication
func (crrm *CrossRegionReplicationManager) startReplicationWorkers() {
	ticker := time.NewTicker(crrm.config.ReplicationInterval)
	defer ticker.Stop()

	for range ticker.C {
		ctx := context.Background()

		// Start replication for pending backups
		if err := crrm.StartReplication(ctx); err != nil {
			crrm.logger.Printf("Failed to start replication: %v", err)
		}

		// Clean up old backups
		if err := crrm.CleanupOldReplicatedBackups(ctx); err != nil {
			crrm.logger.Printf("Failed to cleanup old backups: %v", err)
		}

		// Save replication status
		crrm.saveReplicationStatus()
	}
}

// Helper methods

func (crrm *CrossRegionReplicationManager) matchesPattern(path, pattern string) bool {
	// Simple glob matching - in production, use filepath.Match or proper glob library
	matched, _ := filepath.Match(pattern, path)
	return matched
}

func (crrm *CrossRegionReplicationManager) parseS3Path(path string) (bucket, key string) {
	// Remove "s3://" prefix if present
	path = strings.TrimPrefix(path, "s3://")

	// Split at first slash
	parts := strings.SplitN(path, "/", 2)
	if len(parts) == 2 {
		return parts[0], parts[1]
	}
	return parts[0], ""
}

func (crrm *CrossRegionReplicationManager) getTargetBucket(region string) string {
	return fmt.Sprintf("quantumbeam-backups-%s", region)
}

func (crrm *CrossRegionReplicationManager) getTargetKey(sourceKey, targetRegion string) string {
	return fmt.Sprintf("replicated/%s/%s", targetRegion, sourceKey)
}

func (crrm *CrossRegionReplicationManager) calculateChecksum(ctx context.Context, backupPath string) (string, error) {
	// For S3 objects, calculate checksum
	if strings.HasPrefix(backupPath, "s3://") {
		bucket, key := crrm.parseS3Path(backupPath)
		client := crrm.s3Clients[crrm.config.PrimaryRegion]

		resp, err := client.GetObject(ctx, &s3.GetObjectInput{
			Bucket: aws.String(bucket),
			Key:    aws.String(key),
		})

		if err != nil {
			return "", err
		}
		defer resp.Body.Close()

		hash := md5.New()
		if _, err := hash.Read(resp.Body); err != nil {
			return "", err
		}

		return hex.EncodeToString(hash.Sum(nil)), nil
	}

	// For local files, calculate checksum
	data, err := os.ReadFile(backupPath)
	if err != nil {
		return "", err
	}

	hash := md5.New()
	hash.Write(data)
	return hex.EncodeToString(hash.Sum(nil)), nil
}

func (crrm *CrossRegionReplicationManager) calculateRemoteChecksum(ctx context.Context, bucket, key string, client *s3.Client) (string, error) {
	resp, err := client.GetObject(ctx, &s3.GetObjectInput{
		Bucket: aws.String(bucket),
		Key:    aws.String(key),
	})

	if err != nil {
		return "", err
	}
	defer resp.Body.Close()

	hash := md5.New()
	if _, err := hash.Read(resp.Body); err != nil {
		return "", err
	}

	return hex.EncodeToString(hash.Sum(nil)), nil
}

func (crrm *CrossRegionReplicationManager) listReplicatedObjects(ctx context.Context, client *s3.Client, bucket, pattern string) ([]types.Object, error) {
	var objects []types.Object

	paginator := s3.NewListObjectsV2Paginator(client, &s3.ListObjectsV2Input{
		Bucket: aws.String(bucket),
		Prefix: aws.String(strings.TrimPrefix(pattern, "backups/")),
	})

	for paginator.HasMorePages() {
		page, err := paginator.NextPage(ctx)
		if err != nil {
			return nil, err
		}

		objects = append(objects, page.Contents...)
	}

	return objects, nil
}

func (crrm *CrossRegionReplicationManager) saveReplicationStatus() error {
	crrm.mu.RLock()
	defer crrm.mu.RUnlock()

	data, err := json.MarshalIndent(crrm.replicationStatus, "", "  ")
	if err != nil {
		return err
	}

	filename := filepath.Join("backups", "replication-status.json")
	return os.WriteFile(filename, data, 0644)
}

func (crrm *CrossRegionReplicationManager) loadReplicationStatus() error {
	filename := filepath.Join("backups", "replication-status.json")
	data, err := os.ReadFile(filename)
	if err != nil {
		if os.IsNotExist(err) {
			return nil
		}
		return err
	}

	return json.Unmarshal(data, &crrm.replicationStatus)
}

// GetReplicationMetrics returns replication metrics
func (crrm *CrossRegionReplicationManager) GetReplicationMetrics() map[string]interface{} {
	crrm.mu.RLock()
	defer crrm.mu.RUnlock()

	totalBackups := len(crrm.replicationStatus)
	completedBackups := 0
	failedBackups := 0
	pendingBackups := 0
	inProgressBackups := 0

	var totalLag time.Duration
	var successfulLags []time.Duration

	for _, status := range crrm.replicationStatus {
		switch status.Status {
		case "completed":
			completedBackups++
			totalLag += status.ReplicationLag
			successfulLags = append(successfulLags, status.ReplicationLag)
		case "failed":
			failedBackups++
		case "pending":
			pendingBackups++
		case "in_progress":
			inProgressBackups++
		}
	}

	avgLag := time.Duration(0)
	if completedBackups > 0 {
		avgLag = totalLag / time.Duration(completedBackups)
	}

	// Calculate region-specific metrics
	regionMetrics := make(map[string]map[string]int)
	for _, status := range crrm.replicationStatus {
		for region, regionStatus := range status.TargetRegions {
			if regionMetrics[region] == nil {
				regionMetrics[region] = make(map[string]int)
			}

			regionMetrics[region][regionStatus.Status]++
		}
	}

	return map[string]interface{}{
		"total_backups":       totalBackups,
		"completed_backups":   completedBackups,
		"failed_backups":      failedBackups,
		"pending_backups":     pendingBackups,
		"in_progress_backups": inProgressBackups,
		"success_rate":        float64(completedBackups) / float64(totalBackups) * 100,
		"average_lag":         avgLag.String(),
		"region_metrics":      regionMetrics,
		"last_updated":        time.Now(),
	}
}
