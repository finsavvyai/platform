//go:build legacy_migrated
// +build legacy_migrated

package backup

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"os"
	"path/filepath"
	"sort"
	"strings"
	"time"

	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/service/s3"
	"github.com/aws/aws-sdk-go-v2/service/s3/types"
)

// RetentionPolicyManager manages backup retention policies and cleanup
type RetentionPolicyManager struct {
	logger           *log.Logger
	s3Client         *s3.Client
	policies         map[string]RetentionPolicy
	cleanupScheduler *CleanupScheduler
	config           RetentionConfig
}

// RetentionConfig holds retention policy configuration
type RetentionConfig struct {
	DefaultRetentionPeriod time.Duration `json:"default_retention_period"`
	CleanupInterval        time.Duration `json:"cleanup_interval"`
	CleanupDryRun          bool          `json:"cleanup_dry_run"`
	EnableLifecycleRules   bool          `json:"enable_lifecycle_rules"`
	NotificationThreshold  int           `json:"notification_threshold"`
	ComplianceMode         bool          `json:"compliance_mode"`
	ArchiveBeforeDelete    bool          `json:"archive_before_delete"`
	MinRetentionDays       int           `json:"min_retention_days"`
	MaxRetentionDays       int           `json:"max_retention_days"`
	RetentionLockEnabled   bool          `json:"retention_lock_enabled"`
	DeleteConfirmations    bool          `json:"delete_confirmations"`
}

// RetentionPolicy defines how long to keep different types of backups
type RetentionPolicy struct {
	ID                  string                 `json:"id"`
	Name                string                 `json:"name"`
	Description         string                 `json:"description"`
	BackupType          string                 `json:"backup_type"`
	Pattern             string                 `json:"pattern"`
	Rules               []RetentionRule        `json:"rules"`
	ArchiveBeforeDelete bool                   `json:"archive_before_delete"`
	ArchiveLocation     string                 `json:"archive_location"`
	ComplianceRequired  bool                   `json:"compliance_required"`
	Metadata            map[string]interface{} `json:"metadata"`
	Enabled             bool                   `json:"enabled"`
}

// RetentionRule defines a specific retention rule
type RetentionRule struct {
	ID              string        `json:"id"`
	Name            string        `json:"name"`
	RetentionPeriod time.Duration `json:"retention_period"`
	StorageClass    string        `json:"storage_class"`
	Priority        int           `json:"priority"`
	Conditions      []Condition   `json:"conditions"`
	Action          string        `json:"action"` // "delete", "archive", "move", "notify"
	Enabled         bool          `json:"enabled"`
}

// Condition defines when a retention rule applies
type Condition struct {
	Type     string      `json:"type"`     // "age", "size", "count", "tag", "custom"
	Operator string      `json:"operator"` // ">", "<", "=", "!=", "contains", "matches"
	Value    interface{} `json:"value"`    // The value to compare against
	Field    string      `json:"field"`    // The field to check (for tag conditions)
}

// CleanupResult represents the result of a cleanup operation
type CleanupResult struct {
	PolicyID         string        `json:"policy_id"`
	PolicyName       string        `json:"policy_name"`
	StartTime        time.Time     `json:"start_time"`
	EndTime          time.Time     `json:"end_time"`
	Duration         time.Duration `json:"duration"`
	BackupsProcessed int           `json:"backups_processed"`
	BackupsDeleted   int           `json:"backups_deleted"`
	BackupsArchived  int           `json:"backups_archived"`
	BackupsMoved     int           `json:"backups_moved"`
	Errors           []string      `json:"errors"`
	SpaceReclaimed   int64         `json:"space_reclaimed"`
	DryRun           bool          `json:"dry_run"`
}

// CleanupSchedule defines when cleanup should run
type CleanupSchedule struct {
	PolicyID string    `json:"policy_id"`
	Schedule string    `json:"schedule"` // Cron expression
	NextRun  time.Time `json:"next_run"`
	LastRun  time.Time `json:"last_run"`
	Enabled  bool      `json:"enabled"`
	Timezone string    `json:"timezone"`
}

// CleanupScheduler manages scheduled cleanup operations
type CleanupScheduler struct {
	schedules map[string]CleanupSchedule
	running   bool
}

// BackupInfo holds information about a backup for retention evaluation
type BackupInfo struct {
	Path         string            `json:"path"`
	Type         string            `json:"type"`
	Size         int64             `json:"size"`
	CreatedAt    time.Time         `json:"created_at"`
	ModifiedAt   time.Time         `json:"modified_at"`
	StorageClass string            `json:"storage_class"`
	Tags         map[string]string `json:"tags"`
	Metadata     map[string]string `json:"metadata"`
	Location     string            `json:"location"`
}

// NewRetentionPolicyManager creates a new retention policy manager
func NewRetentionPolicyManager(s3Client *s3.Client, config RetentionConfig) (*RetentionPolicyManager, error) {
	rpm := &RetentionPolicyManager{
		logger:   log.New(log.Writer(), "[RETENTION-POLICY] ", log.LstdFlags|log.Lmsgprefix),
		s3Client: s3Client,
		policies: make(map[string]RetentionPolicy),
		config:   config,
		cleanupScheduler: &CleanupScheduler{
			schedules: make(map[string]CleanupSchedule),
		},
	}

	// Load existing policies
	if err := rpm.loadPolicies(); err != nil {
		rpm.logger.Printf("Warning: Failed to load retention policies: %v", err)
	}

	// Create default policies if none exist
	if len(rpm.policies) == 0 {
		rpm.createDefaultPolicies()
	}

	// Start cleanup scheduler
	go rpm.startCleanupScheduler()

	return rpm, nil
}

// createDefaultPolicies creates default retention policies for different backup types
func (rpm *RetentionPolicyManager) createDefaultPolicies() {
	policies := []RetentionPolicy{
		{
			ID:          "database-daily",
			Name:        "Daily Database Backups",
			Description: "Retain daily database backups for 30 days",
			BackupType:  "database",
			Pattern:     "backups/database/daily/*",
			Rules: []RetentionRule{
				{
					ID:              "delete-after-30d",
					Name:            "Delete after 30 days",
					RetentionPeriod: 30 * 24 * time.Hour,
					StorageClass:    "STANDARD",
					Priority:        1,
					Conditions: []Condition{
						{
							Type:     "age",
							Operator: ">",
							Value:    "30d",
						},
					},
					Action:  "delete",
					Enabled: true,
				},
			},
			ArchiveBeforeDelete: false,
			ComplianceRequired:  false,
			Enabled:             true,
		},
		{
			ID:          "database-weekly",
			Name:        "Weekly Database Backups",
			Description: "Retain weekly database backups for 90 days, then archive",
			BackupType:  "database",
			Pattern:     "backups/database/weekly/*",
			Rules: []RetentionRule{
				{
					ID:              "archive-after-90d",
					Name:            "Archive after 90 days",
					RetentionPeriod: 90 * 24 * time.Hour,
					StorageClass:    "STANDARD_IA",
					Priority:        1,
					Conditions: []Condition{
						{
							Type:     "age",
							Operator: ">",
							Value:    "90d",
						},
					},
					Action:  "archive",
					Enabled: true,
				},
				{
					ID:              "delete-after-1y",
					Name:            "Delete archived backups after 1 year",
					RetentionPeriod: 365 * 24 * time.Hour,
					StorageClass:    "GLACIER",
					Priority:        2,
					Conditions: []Condition{
						{
							Type:     "age",
							Operator: ">",
							Value:    "365d",
						},
						{
							Type:     "storage_class",
							Operator: "=",
							Value:    "GLACIER",
						},
					},
					Action:  "delete",
					Enabled: true,
				},
			},
			ArchiveBeforeDelete: true,
			ArchiveLocation:     "backups/archive/database/weekly/",
			ComplianceRequired:  true,
			Enabled:             true,
		},
		{
			ID:          "database-monthly",
			Name:        "Monthly Database Backups",
			Description: "Retain monthly database backups for 1 year in Glacier",
			BackupType:  "database",
			Pattern:     "backups/database/monthly/*",
			Rules: []RetentionRule{
				{
					ID:              "glacier-after-30d",
					Name:            "Move to Glacier after 30 days",
					RetentionPeriod: 30 * 24 * time.Hour,
					StorageClass:    "STANDARD",
					Priority:        1,
					Conditions: []Condition{
						{
							Type:     "age",
							Operator: ">",
							Value:    "30d",
						},
					},
					Action:  "move",
					Enabled: true,
				},
				{
					ID:              "delete-after-7y",
					Name:            "Delete after 7 years",
					RetentionPeriod: 7 * 365 * 24 * time.Hour,
					StorageClass:    "GLACIER",
					Priority:        2,
					Conditions: []Condition{
						{
							Type:     "age",
							Operator: ">",
							Value:    "7y",
						},
					},
					Action:  "delete",
					Enabled: true,
				},
			},
			ArchiveBeforeDelete: false,
			ComplianceRequired:  true,
			Enabled:             true,
		},
		{
			ID:          "application-files",
			Name:        "Application File Backups",
			Description: "Retain application file backups for 60 days",
			BackupType:  "files",
			Pattern:     "backups/files/*",
			Rules: []RetentionRule{
				{
					ID:              "delete-after-60d",
					Name:            "Delete after 60 days",
					RetentionPeriod: 60 * 24 * time.Hour,
					StorageClass:    "STANDARD",
					Priority:        1,
					Conditions: []Condition{
						{
							Type:     "age",
							Operator: ">",
							Value:    "60d",
						},
					},
					Action:  "delete",
					Enabled: true,
				},
			},
			ArchiveBeforeDelete: false,
			ComplianceRequired:  false,
			Enabled:             true,
		},
		{
			ID:          "config-backups",
			Name:        "Configuration Backups",
			Description: "Retain configuration backups for 1 year",
			BackupType:  "config",
			Pattern:     "backups/config/*",
			Rules: []RetentionRule{
				{
					ID:              "delete-after-1y",
					Name:            "Delete after 1 year",
					RetentionPeriod: 365 * 24 * time.Hour,
					StorageClass:    "STANDARD",
					Priority:        1,
					Conditions: []Condition{
						{
							Type:     "age",
							Operator: ">",
							Value:    "1y",
						},
					},
					Action:  "delete",
					Enabled: true,
				},
			},
			ArchiveBeforeDelete: false,
			ComplianceRequired:  false,
			Enabled:             true,
		},
	}

	for _, policy := range policies {
		rpm.policies[policy.ID] = policy
	}

	rpm.logger.Printf("Created %d default retention policies", len(policies))
}

// EvaluateBackups evaluates backups against retention policies
func (rpm *RetentionPolicyManager) EvaluateBackups(ctx context.Context, backupPattern string) ([]BackupEvaluation, error) {
	var evaluations []BackupEvaluation

	// Get backups matching pattern
	backups, err := rpm.getBackupsByPattern(ctx, backupPattern)
	if err != nil {
		return nil, fmt.Errorf("failed to get backups: %w", err)
	}

	// Evaluate each backup against applicable policies
	for _, backup := range backups {
		evaluation := BackupEvaluation{
			Backup:      backup,
			EvaluatedAt: time.Now(),
			Actions:     []RetentionAction{},
		}

		// Find applicable policies
		for _, policy := range rpm.policies {
			if !policy.Enabled {
				continue
			}

			if rpm.matchesPattern(backup.Path, policy.Pattern) && rpm.matchesBackupType(backup.Type, policy.BackupType) {
				actions := rpm.evaluatePolicy(ctx, backup, policy)
				evaluation.Actions = append(evaluation.Actions, actions...)
				evaluation.ApplicablePolicies = append(evaluation.ApplicablePolicies, policy.ID)
			}
		}

		// Sort actions by priority
		sort.Slice(evaluation.Actions, func(i, j int) bool {
			return evaluation.Actions[i].Priority < evaluation.Actions[j].Priority
		})

		evaluations = append(evaluations, evaluation)
	}

	return evaluations, nil
}

// BackupEvaluation represents the evaluation result for a backup
type BackupEvaluation struct {
	Backup             BackupInfo        `json:"backup"`
	EvaluatedAt        time.Time         `json:"evaluated_at"`
	ApplicablePolicies []string          `json:"applicable_policies"`
	Actions            []RetentionAction `json:"actions"`
}

// RetentionAction represents an action to be taken on a backup
type RetentionAction struct {
	PolicyID    string                 `json:"policy_id"`
	RuleID      string                 `json:"rule_id"`
	Action      string                 `json:"action"`
	Priority    int                    `json:"priority"`
	ScheduledAt time.Time              `json:"scheduled_at"`
	Reason      string                 `json:"reason"`
	Parameters  map[string]interface{} `json:"parameters"`
}

// evaluatePolicy evaluates a backup against a specific policy
func (rpm *RetentionPolicyManager) evaluatePolicy(ctx context.Context, backup BackupInfo, policy RetentionPolicy) []RetentionAction {
	var actions []RetentionAction

	for _, rule := range policy.Rules {
		if !rule.Enabled {
			continue
		}

		if rpm.evaluateConditions(backup, rule.Conditions) {
			action := RetentionAction{
				PolicyID:    policy.ID,
				RuleID:      rule.ID,
				Action:      rule.Action,
				Priority:    rule.Priority,
				ScheduledAt: time.Now().Add(24 * time.Hour), // Schedule for next day
				Reason:      fmt.Sprintf("Rule '%s' matched: %s", rule.Name, rule.RetentionPeriod),
				Parameters: map[string]interface{}{
					"storage_class":    rule.StorageClass,
					"archive_location": policy.ArchiveLocation,
				},
			}
			actions = append(actions, action)
		}
	}

	return actions
}

// evaluateConditions evaluates if conditions are met for a retention rule
func (rpm *RetentionPolicyManager) evaluateConditions(backup BackupInfo, conditions []Condition) bool {
	for _, condition := range conditions {
		if !rpm.evaluateCondition(backup, condition) {
			return false
		}
	}
	return true
}

// evaluateCondition evaluates a single condition
func (rpm *RetentionPolicyManager) evaluateCondition(backup BackupInfo, condition Condition) bool {
	switch condition.Type {
	case "age":
		return rpm.evaluateAgeCondition(backup, condition)
	case "size":
		return rpm.evaluateSizeCondition(backup, condition)
	case "count":
		return rpm.evaluateCountCondition(backup, condition)
	case "tag":
		return rpm.evaluateTagCondition(backup, condition)
	case "storage_class":
		return rpm.evaluateStorageClassCondition(backup, condition)
	default:
		return false
	}
}

// evaluateAgeCondition evaluates age-based conditions
func (rpm *RetentionPolicyManager) evaluateAgeCondition(backup BackupInfo, condition Condition) bool {
	age := time.Since(backup.CreatedAt)
	requiredAge, err := time.ParseDuration(condition.Value.(string))
	if err != nil {
		return false
	}

	switch condition.Operator {
	case ">":
		return age > requiredAge
	case "<":
		return age < requiredAge
	case "=":
		return age == requiredAge
	case ">=":
		return age >= requiredAge
	case "<=":
		return age <= requiredAge
	default:
		return false
	}
}

// evaluateSizeCondition evaluates size-based conditions
func (rpm *RetentionPolicyManager) evaluateSizeCondition(backup BackupInfo, condition Condition) bool {
	var requiredSize int64
	switch v := condition.Value.(type) {
	case string:
		size, err := parseSizeString(v)
		if err != nil {
			return false
		}
		requiredSize = size
	case int64:
		requiredSize = v
	default:
		return false
	}

	switch condition.Operator {
	case ">":
		return backup.Size > requiredSize
	case "<":
		return backup.Size < requiredSize
	case "=":
		return backup.Size == requiredSize
	case ">=":
		return backup.Size >= requiredSize
	case "<=":
		return backup.Size <= requiredSize
	default:
		return false
	}
}

// evaluateCountCondition evaluates count-based conditions (would need more context)
func (rpm *RetentionPolicyManager) evaluateCountCondition(backup BackupInfo, condition Condition) bool {
	// This would require counting similar backups
	// Implementation would be more complex and depend on specific requirements
	return false
}

// evaluateTagCondition evaluates tag-based conditions
func (rpm *RetentionPolicyManager) evaluateTagCondition(backup BackupInfo, condition Condition) bool {
	if backup.Tags == nil {
		return false
	}

	tagValue, exists := backup.Tags[condition.Field]
	if !exists {
		return false
	}

	switch condition.Operator {
	case "=":
		return tagValue == condition.Value.(string)
	case "!=":
		return tagValue != condition.Value.(string)
	case "contains":
		return strings.Contains(tagValue, condition.Value.(string))
	case "matches":
		matched, _ := filepath.Match(condition.Value.(string), tagValue)
		return matched
	default:
		return false
	}
}

// evaluateStorageClassCondition evaluates storage class conditions
func (rpm *RetentionPolicyManager) evaluateStorageClassCondition(backup BackupInfo, condition Condition) bool {
	switch condition.Operator {
	case "=":
		return backup.StorageClass == condition.Value.(string)
	case "!=":
		return backup.StorageClass != condition.Value.(string)
	default:
		return false
	}
}

// ExecuteCleanup executes cleanup based on retention policies
func (rpm *RetentionPolicyManager) ExecuteCleanup(ctx context.Context, policyID string, dryRun bool) (*CleanupResult, error) {
	policy, exists := rpm.policies[policyID]
	if !exists {
		return nil, fmt.Errorf("policy %s not found", policyID)
	}

	rpm.logger.Printf("Starting cleanup for policy %s (dry-run: %t)", policy.Name, dryRun)

	result := &CleanupResult{
		PolicyID:   policyID,
		PolicyName: policy.Name,
		StartTime:  time.Now(),
		DryRun:     dryRun,
	}

	// Get backups matching policy pattern
	backups, err := rpm.getBackupsByPattern(ctx, policy.Pattern)
	if err != nil {
		return nil, fmt.Errorf("failed to get backups for cleanup: %w", err)
	}

	result.BackupsProcessed = len(backups)

	// Process each backup
	for _, backup := range backups {
		if err := rpm.processBackupForCleanup(ctx, backup, policy, result, dryRun); err != nil {
			result.Errors = append(result.Errors, fmt.Sprintf("Failed to process backup %s: %v", backup.Path, err))
		}
	}

	result.EndTime = time.Now()
	result.Duration = result.EndTime.Sub(result.StartTime)

	rpm.logger.Printf("Cleanup completed for policy %s: processed=%d, deleted=%d, archived=%d, moved=%d, errors=%d, space reclaimed=%d bytes",
		policy.Name, result.BackupsProcessed, result.BackupsDeleted, result.BackupsArchived, result.BackupsMoved, len(result.Errors), result.SpaceReclaimed)

	return result, nil
}

// processBackupForCleanup processes a single backup for cleanup
func (rpm *RetentionPolicyManager) processBackupForCleanup(ctx context.Context, backup BackupInfo, policy RetentionPolicy, result *CleanupResult, dryRun bool) error {
	// Evaluate backup against policy rules
	actions := rpm.evaluatePolicy(ctx, backup, policy)
	if len(actions) == 0 {
		return nil // No action needed
	}

	// Execute the highest priority action
	action := actions[0]

	switch action.Action {
	case "delete":
		if !dryRun {
			if err := rpm.deleteBackup(ctx, backup); err != nil {
				return fmt.Errorf("failed to delete backup: %w", err)
			}
			result.SpaceReclaimed += backup.Size
		}
		result.BackupsDeleted++

	case "archive":
		if !dryRun {
			if err := rpm.archiveBackup(ctx, backup, policy.ArchiveLocation); err != nil {
				return fmt.Errorf("failed to archive backup: %w", err)
			}
		}
		result.BackupsArchived++

	case "move":
		if !dryRun {
			storageClass := action.Parameters["storage_class"].(string)
			if err := rpm.moveBackupStorageClass(ctx, backup, storageClass); err != nil {
				return fmt.Errorf("failed to move backup storage class: %w", err)
			}
		}
		result.BackupsMoved++
	}

	return nil
}

// deleteBackup deletes a backup
func (rpm *RetentionPolicyManager) deleteBackup(ctx context.Context, backup BackupInfo) error {
	if strings.HasPrefix(backup.Path, "s3://") {
		bucket, key := rpm.parseS3Path(backup.Path)
		_, err := rpm.s3Client.DeleteObject(ctx, &s3.DeleteObjectInput{
			Bucket: aws.String(bucket),
			Key:    aws.String(key),
		})
		return err
	}

	// For local files
	return os.Remove(backup.Path)
}

// archiveBackup archives a backup to archive location
func (rpm *RetentionPolicyManager) archiveBackup(ctx context.Context, backup BackupInfo, archiveLocation string) error {
	if strings.HasPrefix(backup.Path, "s3://") {
		sourceBucket, sourceKey := rpm.parseS3Path(backup.Path)
		targetBucket, targetKey := rpm.parseS3Path(archiveLocation + filepath.Base(sourceKey))

		// Copy to archive location
		_, err := rpm.s3Client.CopyObject(ctx, &s3.CopyObjectInput{
			Bucket:       aws.String(targetBucket),
			Key:          aws.String(targetKey),
			CopySource:   aws.String(fmt.Sprintf("%s/%s", sourceBucket, sourceKey)),
			StorageClass: types.StorageClassGlacier,
		})

		if err != nil {
			return err
		}

		// Delete original if archive was successful
		return rpm.deleteBackup(ctx, backup)
	}

	// For local files - implement copy and delete
	return nil
}

// moveBackupStorageClass moves backup to different storage class
func (rpm *RetentionPolicyManager) moveBackupStorageClass(ctx context.Context, backup BackupInfo, storageClass string) error {
	if !strings.HasPrefix(backup.Path, "s3://") {
		return fmt.Errorf("storage class movement only supported for S3 backups")
	}

	bucket, key := rpm.parseS3Path(backup.Path)

	_, err := rpm.s3Client.CopyObject(ctx, &s3.CopyObjectInput{
		Bucket:            aws.String(bucket),
		Key:               aws.String(key),
		CopySource:        aws.String(fmt.Sprintf("%s/%s", bucket, key)),
		StorageClass:      types.StorageClass(storageClass),
		MetadataDirective: types.MetadataDirectiveCopy,
	})

	return err
}

// Helper methods

func (rpm *RetentionPolicyManager) matchesPattern(path, pattern string) bool {
	matched, _ := filepath.Match(pattern, path)
	return matched
}

func (rpm *RetentionPolicyManager) matchesBackupType(backupType, policyType string) bool {
	return backupType == policyType || policyType == "*"
}

func (rpm *RetentionPolicyManager) getBackupsByPattern(ctx context.Context, pattern string) ([]BackupInfo, error) {
	var backups []BackupInfo

	if strings.HasPrefix(pattern, "s3://") {
		// Handle S3 backups
		bucket, prefix := rpm.parseS3Path(pattern)
		paginator := s3.NewListObjectsV2Paginator(rpm.s3Client, &s3.ListObjectsV2Input{
			Bucket: aws.String(bucket),
			Prefix: aws.String(prefix),
		})

		for paginator.HasMorePages() {
			page, err := paginator.NextPage(ctx)
			if err != nil {
				return nil, err
			}

			for _, obj := range page.Contents {
				backup := BackupInfo{
					Path:         fmt.Sprintf("s3://%s/%s", bucket, *obj.Key),
					Size:         obj.Size,
					CreatedAt:    *obj.LastModified,
					ModifiedAt:   *obj.LastModified,
					StorageClass: string(obj.StorageClass),
					Location:     bucket,
				}
				backups = append(backups, backup)
			}
		}
	} else {
		// Handle local files
		err := filepath.Walk(filepath.Dir(pattern), func(path string, info os.FileInfo, err error) error {
			if err != nil {
				return err
			}

			if !info.IsDir() && rpm.matchesPattern(path, pattern) {
				backup := BackupInfo{
					Path:         path,
					Size:         info.Size(),
					CreatedAt:    info.ModTime(),
					ModifiedAt:   info.ModTime(),
					StorageClass: "local",
					Location:     "local",
				}
				backups = append(backups, backup)
			}

			return nil
		})

		if err != nil {
			return nil, err
		}
	}

	return backups, nil
}

func (rpm *RetentionPolicyManager) parseS3Path(s3Path string) (bucket, key string) {
	s3Path = strings.TrimPrefix(s3Path, "s3://")
	parts := strings.SplitN(s3Path, "/", 2)
	if len(parts) == 2 {
		return parts[0], parts[1]
	}
	return parts[0], ""
}

func (rpm *RetentionPolicyManager) startCleanupScheduler() {
	ticker := time.NewTicker(rpm.config.CleanupInterval)
	defer ticker.Stop()

	for range ticker.C {
		ctx := context.Background()

		// Run cleanup for all enabled policies
		for policyID, policy := range rpm.policies {
			if policy.Enabled {
				go func(id string, p RetentionPolicy) {
					if _, err := rpm.ExecuteCleanup(ctx, id, rpm.config.CleanupDryRun); err != nil {
						rpm.logger.Printf("Cleanup failed for policy %s: %v", p.Name, err)
					}
				}(policyID, policy)
			}
		}
	}
}

func (rpm *RetentionPolicyManager) loadPolicies() error {
	filename := filepath.Join("backups", "retention-policies.json")
	data, err := os.ReadFile(filename)
	if err != nil {
		if os.IsNotExist(err) {
			return nil
		}
		return err
	}

	return json.Unmarshal(data, &rpm.policies)
}

func (rpm *RetentionPolicyManager) savePolicies() error {
	data, err := json.MarshalIndent(rpm.policies, "", "  ")
	if err != nil {
		return err
	}

	filename := filepath.Join("backups", "retention-policies.json")
	return os.WriteFile(filename, data, 0644)
}

// parseSizeString parses size strings like "10MB", "1GB", etc.
func parseSizeString(sizeStr string) (int64, error) {
	sizeStr = strings.ToUpper(strings.TrimSpace(sizeStr))

	var multiplier int64 = 1
	var numStr string

	if strings.HasSuffix(sizeStr, "B") {
		if strings.HasSuffix(sizeStr, "KB") {
			multiplier = 1024
			numStr = strings.TrimSuffix(sizeStr, "KB")
		} else if strings.HasSuffix(sizeStr, "MB") {
			multiplier = 1024 * 1024
			numStr = strings.TrimSuffix(sizeStr, "MB")
		} else if strings.HasSuffix(sizeStr, "GB") {
			multiplier = 1024 * 1024 * 1024
			numStr = strings.TrimSuffix(sizeStr, "GB")
		} else if strings.HasSuffix(sizeStr, "TB") {
			multiplier = 1024 * 1024 * 1024 * 1024
			numStr = strings.TrimSuffix(sizeStr, "TB")
		} else {
			numStr = strings.TrimSuffix(sizeStr, "B")
		}
	} else {
		numStr = sizeStr
	}

	var size float64
	if _, err := fmt.Sscanf(numStr, "%f", &size); err != nil {
		return 0, err
	}

	return int64(size * float64(multiplier)), nil
}

// GetRetentionMetrics returns metrics about retention policies
func (rpm *RetentionPolicyManager) GetRetentionMetrics(ctx context.Context) (map[string]interface{}, error) {
	metrics := make(map[string]interface{})

	// Policy statistics
	totalPolicies := len(rpm.policies)
	enabledPolicies := 0
	for _, policy := range rpm.policies {
		if policy.Enabled {
			enabledPolicies++
		}
	}

	metrics["total_policies"] = totalPolicies
	metrics["enabled_policies"] = enabledPolicies

	// Backup count by type
	backupCounts := make(map[string]int)
	for _, policy := range rpm.policies {
		if policy.Enabled {
			backups, err := rpm.getBackupsByPattern(ctx, policy.Pattern)
			if err == nil {
				backupCounts[policy.BackupType] += len(backups)
			}
		}
	}
	metrics["backup_counts_by_type"] = backupCounts

	// Storage usage by storage class
	storageUsage := make(map[string]int64)
	for _, policy := range rpm.policies {
		if policy.Enabled {
			backups, err := rpm.getBackupsByPattern(ctx, policy.Pattern)
			if err == nil {
				for _, backup := range backups {
					storageUsage[backup.StorageClass] += backup.Size
				}
			}
		}
	}
	metrics["storage_usage_by_class"] = storageUsage

	metrics["last_updated"] = time.Now()

	return metrics, nil
}