package backup

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"os"
	"path/filepath"
	"strings"
	"time"
)

// RunbookManager manages operational runbooks and procedures
type RunbookManager struct {
	logger    *log.Logger
	runbooks  map[string]Runbook
	templates map[string]RunbookTemplate
	config    RunbookConfig
	executor  *RunbookExecutor
}

// RunbookConfig holds runbook configuration
type RunbookConfig struct {
	RunbooksDirectory   string        `json:"runbooks_directory"`
	ExecutionTimeout    time.Duration `json:"execution_timeout"`
	RequireApproval     bool          `json:"require_approval"`
	EnableNotifications bool          `json:"enable_notifications"`
	MaxConcurrentRuns   int           `json:"max_concurrent_runs"`
	LogLevel            string        `json:"log_level"`
	AuditTrail          bool          `json:"audit_trail"`
	TestMode            bool          `json:"test_mode"`
}

// Runbook represents an operational procedure
type Runbook struct {
	ID              string                    `json:"id"`
	Name            string                    `json:"name"`
	Description     string                    `json:"description"`
	Category        string                    `json:"category"`
	Priority        string                    `json:"priority"` // "low", "medium", "high", "critical"
	EstimatedTime   time.Duration             `json:"estimated_time"`
	Prerequisites   []string                  `json:"prerequisites"`
	Steps           []RunbookStep             `json:"steps"`
	RollbackSteps   []RunbookStep             `json:"rollback_steps"`
	ValidationSteps []ValidationStep          `json:"validation_steps"`
	RiskLevel       string                    `json:"risk_level"` // "low", "medium", "high", "critical"`
	RequiredRoles   []string                  `json:"required_roles"`
	Parameters      map[string]Parameter      `json:"parameters"`
	Notifications   RunbookNotificationConfig `json:"notifications"`
	Approval        ApprovalConfig            `json:"approval"`
	Testing         TestingConfig             `json:"testing"`
	Metadata        map[string]interface{}    `json:"metadata"`
	CreatedAt       time.Time                 `json:"created_at"`
	UpdatedAt       time.Time                 `json:"updated_at"`
	Version         string                    `json:"version"`
	Active          bool                      `json:"active"`
}

// RunbookStep represents a single step in a runbook
type RunbookStep struct {
	ID          string                 `json:"id"`
	Name        string                 `json:"name"`
	Description string                 `json:"description"`
	Type        string                 `json:"type"` // "manual", "automated", "script", "api", "query"
	Command     string                 `json:"command"`
	Parameters  map[string]interface{} `json:"parameters"`
	Timeout     time.Duration          `json:"timeout"`
	Expected    string                 `json:"expected"`
	Rollback    string                 `json:"rollback"`
	Critical    bool                   `json:"critical"`
	Validate    bool                   `json:"validate"`
	DependsOn   []string               `json:"depends_on"`
}

// ValidationStep represents a validation step
type ValidationStep struct {
	ID          string                 `json:"id"`
	Name        string                 `json:"name"`
	Description string                 `json:"description"`
	Type        string                 `json:"type"`   // "health_check", "data_verification", "performance_test", "security_check"
	Method      string                 `json:"method"` // "script", "api", "query", "manual"
	Command     string                 `json:"command"`
	Parameters  map[string]interface{} `json:"parameters"`
	Criteria    []ValidationCriteria   `json:"criteria"`
	Timeout     time.Duration          `json:"timeout"`
}

// ValidationCriteria defines validation criteria
type ValidationCriteria struct {
	Metric   string      `json:"metric"`
	Operator string      `json:"operator"` // ">", "<", "=", "!=", "contains", "matches"
	Value    interface{} `json:"value"`
	Weight   float64     `json:"weight"`
	Critical bool        `json:"critical"`
}

// Parameter defines a runbook parameter
type Parameter struct {
	Name        string      `json:"name"`
	Type        string      `json:"type"` // "string", "int", "bool", "array", "object"
	Description string      `json:"description"`
	Required    bool        `json:"required"`
	Default     interface{} `json:"default"`
	Validation  string      `json:"validation"` // JSON schema or regex
	Sensitive   bool        `json:"sensitive"`
}

// NotificationConfig defines notification settings
// RunbookNotificationConfig defines notification settings for runbooks
type RunbookNotificationConfig struct {
	Enabled    bool     `json:"enabled"`
	Channels   []string `json:"channels"`
	Triggers   []string `json:"triggers"` // "started", "completed", "failed", "approval_needed"
	Recipients []string `json:"recipients"`
}

// ApprovalConfig defines approval requirements
type ApprovalConfig struct {
	Required      bool          `json:"required"`
	Approvers     []string      `json:"approvers"`
	Timeout       time.Duration `json:"timeout"`
	Escalation    []string      `json:"escalation"`
	MinApprovals  int           `json:"min_approvals"`
	RequireReason bool          `json:"require_reason"`
}

// TestingConfig defines testing requirements
type TestingConfig struct {
	Required      bool          `json:"required"`
	Environment   string        `json:"environment"`
	TestFrequency time.Duration `json:"test_frequency"`
	LastTested    time.Time     `json:"last_tested"`
	TestResults   []TestResult  `json:"test_results"`
}

// TestResult represents a test execution result
type TestResult struct {
	ID        string        `json:"id"`
	Timestamp time.Time     `json:"timestamp"`
	Status    string        `json:"status"` // "passed", "failed", "skipped"
	Duration  time.Duration `json:"duration"`
	Output    string        `json:"output"`
	Error     string        `json:"error"`
	Score     float64       `json:"score"`
}

// RunbookTemplate represents a reusable runbook template
type RunbookTemplate struct {
	ID          string                 `json:"id"`
	Name        string                 `json:"name"`
	Description string                 `json:"description"`
	Category    string                 `json:"category"`
	Steps       []RunbookStep          `json:"steps"`
	Parameters  map[string]Parameter   `json:"parameters"`
	Metadata    map[string]interface{} `json:"metadata"`
}

// RunbookExecution represents a runbook execution
type RunbookExecution struct {
	ID                string                 `json:"id"`
	RunbookID         string                 `json:"runbook_id"`
	RunbookName       string                 `json:"runbook_name"`
	StartedAt         time.Time              `json:"started_at"`
	CompletedAt       *time.Time             `json:"completed_at,omitempty"`
	Status            string                 `json:"status"` // "pending", "running", "completed", "failed", "cancelled", "approval_needed"`
	Executor          string                 `json:"executor"`
	Parameters        map[string]interface{} `json:"parameters"`
	StepResults       map[string]StepResult  `json:"step_results"`
	ValidationResults []ValidationResult     `json:"validation_results"`
	Output            string                 `json:"output"`
	Error             string                 `json:"error,omitempty"`
	Duration          time.Duration          `json:"duration"`
	Approval          *ExecutionApproval     `json:"approval,omitempty"`
	Metadata          map[string]interface{} `json:"metadata"`
}

// StepResult represents the result of a runbook step
type StepResult struct {
	StepID      string        `json:"step_id"`
	Name        string        `json:"name"`
	StartedAt   time.Time     `json:"started_at"`
	CompletedAt *time.Time    `json:"completed_at,omitempty"`
	Status      string        `json:"status"` // "pending", "running", "completed", "failed", "skipped"`
	Output      string        `json:"output"`
	Error       string        `json:"error,omitempty"`
	Duration    time.Duration `json:"duration"`
	RetryCount  int           `json:"retry_count"`
}

// ValidationResult represents the result of a validation step
type ValidationResult struct {
	ValidationID string                 `json:"validation_id"`
	Name         string                 `json:"name"`
	Status       string                 `json:"status"` // "passed", "failed", "skipped"`
	Score        float64                `json:"score"`
	Criteria     map[string]bool        `json:"criteria"`
	Output       string                 `json:"output"`
	Error        string                 `json:"error,omitempty"`
	Metadata     map[string]interface{} `json:"metadata"`
}

// ExecutionApproval represents approval for execution
type ExecutionApproval struct {
	Required    bool       `json:"required"`
	Status      string     `json:"status"` // "pending", "approved", "rejected", "expired"`
	RequestedBy string     `json:"requested_by"`
	RequestedAt time.Time  `json:"requested_at"`
	ApprovedBy  string     `json:"approved_by,omitempty"`
	ApprovedAt  *time.Time `json:"approved_at,omitempty"`
	RejectedBy  string     `json:"rejected_by,omitempty"`
	RejectedAt  *time.Time `json:"rejected_at,omitempty"`
	ExpiresAt   time.Time  `json:"expires_at"`
	Reason      string     `json:"reason"`
	Comments    []string   `json:"comments"`
}

// RunbookExecutor handles runbook execution
type RunbookExecutor struct {
	logger        *log.Logger
	activeRuns    map[string]*RunbookExecution
	config        RunbookConfig
	backupManager *BackupManager
	drManager     *DisasterRecoveryManager
}

// NewRunbookManager creates a new runbook manager
func NewRunbookManager(config RunbookConfig, backupManager *BackupManager, drManager *DisasterRecoveryManager) *RunbookManager {
	rm := &RunbookManager{
		logger:    log.New(log.Writer(), "[RUNBOOK-MANAGER] ", log.LstdFlags|log.Lmsgprefix),
		runbooks:  make(map[string]Runbook),
		templates: make(map[string]RunbookTemplate),
		config:    config,
		executor: &RunbookExecutor{
			logger:        log.New(log.Writer(), "[RUNBOOK-EXECUTOR] ", log.LstdFlags|log.Lmsgprefix),
			activeRuns:    make(map[string]*RunbookExecution),
			config:        config,
			backupManager: backupManager,
			drManager:     drManager,
		},
	}

	// Load existing runbooks
	rm.loadRunbooks()
	rm.loadTemplates()

	// Create default runbooks if none exist
	if len(rm.runbooks) == 0 {
		rm.createDefaultRunbooks()
	}

	return rm
}

// createDefaultRunbooks creates default operational runbooks
func (rm *RunbookManager) createDefaultRunbooks() {
	runbooks := []Runbook{
		{
			ID:            "backup-failure-response",
			Name:          "Backup Failure Response",
			Description:   "Procedure to respond to backup failures",
			Category:      "backup",
			Priority:      "high",
			EstimatedTime: 30 * time.Minute,
			RiskLevel:     "medium",
			RequiredRoles: []string{"backup-admin", "on-call-engineer"},
			Steps: []RunbookStep{
				{
					ID:          "verify-failure",
					Name:        "Verify Backup Failure",
					Description: "Confirm backup has actually failed",
					Type:        "automated",
					Command:     "check_backup_status.sh",
					Timeout:     5 * time.Minute,
					Critical:    true,
				},
				{
					ID:          "investigate-cause",
					Name:        "Investigate Root Cause",
					Description: "Check logs and system status for failure cause",
					Type:        "manual",
					Timeout:     10 * time.Minute,
					DependsOn:   []string{"verify-failure"},
				},
				{
					ID:          "attempt-recovery",
					Name:        "Attempt Backup Recovery",
					Description: "Try to recover or rerun the backup",
					Type:        "automated",
					Command:     "rerun_backup.sh",
					Timeout:     20 * time.Minute,
					DependsOn:   []string{"investigate-cause"},
					Critical:    true,
				},
				{
					ID:          "verify-success",
					Name:        "Verify Backup Success",
					Description: "Confirm backup completed successfully",
					Type:        "automated",
					Command:     "verify_backup.sh",
					Timeout:     5 * time.Minute,
					DependsOn:   []string{"attempt-recovery"},
				},
			},
			ValidationSteps: []ValidationStep{
				{
					ID:      "check-backup-integrity",
					Name:    "Check Backup Integrity",
					Type:    "data_verification",
					Method:  "script",
					Command: "validate_backup_integrity.sh",
					Criteria: []ValidationCriteria{
						{
							Metric:   "integrity_score",
							Operator: ">",
							Value:    95.0,
							Weight:   1.0,
							Critical: true,
						},
					},
					Timeout: 10 * time.Minute,
				},
			},
			Parameters: map[string]Parameter{
				"backup_id": {
					Name:        "Backup ID",
					Type:        "string",
					Description: "ID of the failed backup",
					Required:    true,
				},
				"retry_count": {
					Name:        "Retry Count",
					Type:        "int",
					Description: "Number of retry attempts",
					Required:    false,
					Default:     3,
				},
			},
			Notifications: RunbookNotificationConfig{
				Enabled:  true,
				Channels: []string{"slack", "email"},
				Triggers: []string{"started", "completed", "failed"},
			},
			Approval: ApprovalConfig{
				Required:      false,
				Timeout:       15 * time.Minute,
				RequireReason: true,
			},
			Testing: TestingConfig{
				Required:      true,
				Environment:   "staging",
				TestFrequency: 30 * 24 * time.Hour,
			},
			CreatedAt: time.Now(),
			UpdatedAt: time.Now(),
			Version:   "1.0",
			Active:    true,
		},
		{
			ID:            "disaster-recovery-initiation",
			Name:          "Disaster Recovery Initiation",
			Description:   "Procedure to initiate disaster recovery",
			Category:      "disaster_recovery",
			Priority:      "critical",
			EstimatedTime: 2 * time.Hour,
			RiskLevel:     "critical",
			RequiredRoles: []string{"disaster-recovery-manager", "incident-commander"},
			Steps: []RunbookStep{
				{
					ID:          "declare-disaster",
					Name:        "Declare Disaster",
					Description: "Officially declare disaster situation",
					Type:        "manual",
					Timeout:     5 * time.Minute,
					Critical:    true,
				},
				{
					ID:          "activate-dr-plan",
					Name:        "Activate DR Plan",
					Description: "Execute the disaster recovery plan",
					Type:        "automated",
					Command:     "execute_dr_plan.sh",
					Timeout:     60 * time.Minute,
					DependsOn:   []string{"declare-disaster"},
					Critical:    true,
				},
				{
					ID:          "notify-stakeholders",
					Name:        "Notify Stakeholders",
					Description: "Notify all relevant stakeholders",
					Type:        "automated",
					Command:     "notify_stakeholders.sh",
					Timeout:     10 * time.Minute,
					DependsOn:   []string{"activate-dr-plan"},
				},
				{
					ID:          "verify-recovery",
					Name:        "Verify Recovery",
					Description: "Verify systems are operational in DR site",
					Type:        "automated",
					Command:     "verify_dr_recovery.sh",
					Timeout:     30 * time.Minute,
					DependsOn:   []string{"activate-dr-plan"},
					Critical:    true,
				},
			},
			ValidationSteps: []ValidationStep{
				{
					ID:      "service-availability",
					Name:    "Service Availability Check",
					Type:    "health_check",
					Method:  "api",
					Command: "check_service_health.sh",
					Criteria: []ValidationCriteria{
						{
							Metric:   "availability_percentage",
							Operator: ">",
							Value:    99.0,
							Weight:   1.0,
							Critical: true,
						},
					},
					Timeout: 15 * time.Minute,
				},
			},
			Parameters: map[string]Parameter{
				"disaster_type": {
					Name:        "Disaster Type",
					Type:        "string",
					Description: "Type of disaster (region_failure, data_corruption, etc.)",
					Required:    true,
				},
				"recovery_region": {
					Name:        "Recovery Region",
					Type:        "string",
					Description: "Target recovery region",
					Required:    true,
				},
			},
			Notifications: RunbookNotificationConfig{
				Enabled:    true,
				Channels:   []string{"pagerduty", "slack", "email"},
				Triggers:   []string{"started", "completed", "failed", "approval_needed"},
				Recipients: []string{"executives", "incident-response", "technical-leads"},
			},
			Approval: ApprovalConfig{
				Required:      true,
				Approvers:     []string{"cto", "vp-engineering", "disaster-recovery-manager"},
				Timeout:       30 * time.Minute,
				MinApprovals:  2,
				RequireReason: true,
			},
			Testing: TestingConfig{
				Required:      true,
				Environment:   "dr-test",
				TestFrequency: 90 * 24 * time.Hour,
			},
			CreatedAt: time.Now(),
			UpdatedAt: time.Now(),
			Version:   "1.0",
			Active:    true,
		},
		{
			ID:            "backup-rotation-maintenance",
			Name:          "Backup Rotation and Maintenance",
			Description:   "Rotate backup storage and perform maintenance tasks",
			Category:      "maintenance",
			Priority:      "medium",
			EstimatedTime: 1 * time.Hour,
			RiskLevel:     "low",
			RequiredRoles: []string{"backup-admin"},
			Steps: []RunbookStep{
				{
					ID:          "schedule-maintenance-window",
					Name:        "Schedule Maintenance Window",
					Description: "Schedule and announce maintenance window",
					Type:        "automated",
					Command:     "schedule_maintenance.sh",
					Timeout:     5 * time.Minute,
				},
				{
					ID:          "rotate-old-backups",
					Name:        "Rotate Old Backups",
					Description: "Move old backups to appropriate storage classes",
					Type:        "automated",
					Command:     "rotate_backups.sh",
					Timeout:     30 * time.Minute,
					DependsOn:   []string{"schedule-maintenance-window"},
				},
				{
					ID:          "cleanup-expired-backups",
					Name:        "Cleanup Expired Backups",
					Description: "Delete backups past retention period",
					Type:        "automated",
					Command:     "cleanup_backups.sh",
					Timeout:     20 * time.Minute,
					DependsOn:   []string{"rotate-old-backups"},
				},
				{
					ID:          "verify-backup-availability",
					Name:        "Verify Backup Availability",
					Description: "Ensure critical backups are accessible",
					Type:        "automated",
					Command:     "verify_backup_availability.sh",
					Timeout:     15 * time.Minute,
					DependsOn:   []string{"cleanup-expired-backups"},
				},
			},
			Parameters: map[string]Parameter{
				"dry_run": {
					Name:        "Dry Run",
					Type:        "bool",
					Description: "Perform a dry run without making changes",
					Required:    false,
					Default:     false,
				},
				"retention_days": {
					Name:        "Retention Days",
					Type:        "int",
					Description: "Override default retention period",
					Required:    false,
				},
			},
			Notifications: RunbookNotificationConfig{
				Enabled:  true,
				Channels: []string{"slack", "email"},
				Triggers: []string{"started", "completed", "failed"},
			},
			Approval: ApprovalConfig{
				Required: false,
			},
			Testing: TestingConfig{
				Required:      false,
				Environment:   "staging",
				TestFrequency: 180 * 24 * time.Hour,
			},
			CreatedAt: time.Now(),
			UpdatedAt: time.Now(),
			Version:   "1.0",
			Active:    true,
		},
		{
			ID:            "database-restore-procedure",
			Name:          "Database Restore Procedure",
			Description:   "Restore database from backup",
			Category:      "restore",
			Priority:      "high",
			EstimatedTime: 45 * time.Minute,
			RiskLevel:     "high",
			RequiredRoles: []string{"database-admin", "backup-admin"},
			Steps: []RunbookStep{
				{
					ID:          "prepare-restore-environment",
					Name:        "Prepare Restore Environment",
					Description: "Set up environment for database restore",
					Type:        "automated",
					Command:     "prepare_restore_env.sh",
					Timeout:     10 * time.Minute,
					Critical:    true,
				},
				{
					ID:          "download-backup",
					Name:        "Download Backup",
					Description: "Download required backup from storage",
					Type:        "automated",
					Command:     "download_backup.sh",
					Timeout:     15 * time.Minute,
					DependsOn:   []string{"prepare-restore-environment"},
					Critical:    true,
				},
				{
					ID:          "restore-database",
					Name:        "Restore Database",
					Description: "Execute database restore process",
					Type:        "automated",
					Command:     "restore_database.sh",
					Timeout:     20 * time.Minute,
					DependsOn:   []string{"download-backup"},
					Critical:    true,
				},
				{
					ID:          "verify-restore",
					Name:        "Verify Restore",
					Description: "Verify database is functional after restore",
					Type:        "automated",
					Command:     "verify_database_restore.sh",
					Timeout:     10 * time.Minute,
					DependsOn:   []string{"restore-database"},
					Critical:    true,
				},
			},
			ValidationSteps: []ValidationStep{
				{
					ID:      "data-integrity-check",
					Name:    "Data Integrity Check",
					Type:    "data_verification",
					Method:  "script",
					Command: "check_data_integrity.sh",
					Criteria: []ValidationCriteria{
						{
							Metric:   "record_count_match",
							Operator: "=",
							Value:    true,
							Weight:   0.5,
							Critical: true,
						},
						{
							Metric:   "checksum_match",
							Operator: "=",
							Value:    true,
							Weight:   0.5,
							Critical: true,
						},
					},
					Timeout: 15 * time.Minute,
				},
			},
			Parameters: map[string]Parameter{
				"backup_id": {
					Name:        "Backup ID",
					Type:        "string",
					Description: "ID of backup to restore from",
					Required:    true,
				},
				"target_database": {
					Name:        "Target Database",
					Type:        "string",
					Description: "Name of database to restore to",
					Required:    true,
				},
				"restore_point": {
					Name:        "Restore Point",
					Type:        "string",
					Description: "Specific point in time to restore to",
					Required:    false,
				},
			},
			Notifications: RunbookNotificationConfig{
				Enabled:  true,
				Channels: []string{"slack", "email"},
				Triggers: []string{"started", "completed", "failed"},
			},
			Approval: ApprovalConfig{
				Required:      true,
				Approvers:     []string{"database-admin", "backup-admin"},
				Timeout:       30 * time.Minute,
				RequireReason: true,
			},
			Testing: TestingConfig{
				Required:      true,
				Environment:   "staging",
				TestFrequency: 30 * 24 * time.Hour,
			},
			CreatedAt: time.Now(),
			UpdatedAt: time.Now(),
			Version:   "1.0",
			Active:    true,
		},
		{
			ID:            "system-health-check",
			Name:          "System Health Check",
			Description:   "Comprehensive system health check and diagnostics",
			Category:      "monitoring",
			Priority:      "low",
			EstimatedTime: 15 * time.Minute,
			RiskLevel:     "low",
			RequiredRoles: []string{"on-call-engineer", "sre"},
			Steps: []RunbookStep{
				{
					ID:          "check-services",
					Name:        "Check Service Health",
					Description: "Verify all services are running and responsive",
					Type:        "automated",
					Command:     "check_services.sh",
					Timeout:     5 * time.Minute,
				},
				{
					ID:          "check-database",
					Name:        "Check Database Health",
					Description: "Verify database connectivity and performance",
					Type:        "automated",
					Command:     "check_database.sh",
					Timeout:     5 * time.Minute,
				},
				{
					ID:          "check-storage",
					Name:        "Check Storage Health",
					Description: "Verify storage systems and capacity",
					Type:        "automated",
					Command:     "check_storage.sh",
					Timeout:     3 * time.Minute,
				},
				{
					ID:          "check-backup-system",
					Name:        "Check Backup System",
					Description: "Verify backup systems are operational",
					Type:        "automated",
					Command:     "check_backup_system.sh",
					Timeout:     3 * time.Minute,
				},
				{
					ID:          "generate-report",
					Name:        "Generate Health Report",
					Description: "Generate comprehensive health report",
					Type:        "automated",
					Command:     "generate_health_report.sh",
					Timeout:     2 * time.Minute,
					DependsOn:   []string{"check-services", "check-database", "check-storage", "check-backup-system"},
				},
			},
			ValidationSteps: []ValidationStep{
				{
					ID:      "verify-critical-systems",
					Name:    "Verify Critical Systems",
					Type:    "health_check",
					Method:  "script",
					Command: "verify_critical_systems.sh",
					Criteria: []ValidationCriteria{
						{
							Metric:   "critical_systems_up",
							Operator: ">=",
							Value:    95.0,
							Weight:   1.0,
							Critical: true,
						},
					},
					Timeout: 5 * time.Minute,
				},
			},
			Parameters: map[string]Parameter{
				"detailed": {
					Name:        "Detailed Check",
					Type:        "bool",
					Description: "Perform detailed health checks",
					Required:    false,
					Default:     false,
				},
				"components": {
					Name:        "Components",
					Type:        "array",
					Description: "Specific components to check (optional)",
					Required:    false,
				},
			},
			Notifications: RunbookNotificationConfig{
				Enabled:  true,
				Channels: []string{"slack"},
				Triggers: []string{"failed"},
			},
			Approval: ApprovalConfig{
				Required: false,
			},
			Testing: TestingConfig{
				Required:      false,
				Environment:   "production",
				TestFrequency: 24 * time.Hour,
			},
			CreatedAt: time.Now(),
			UpdatedAt: time.Now(),
			Version:   "1.0",
			Active:    true,
		},
	}

	for _, runbook := range runbooks {
		rm.runbooks[runbook.ID] = runbook
	}

	rm.logger.Printf("Created %d default runbooks", len(runbooks))
}

// ExecuteRunbook executes a runbook with given parameters
func (rm *RunbookManager) ExecuteRunbook(ctx context.Context, runbookID string, parameters map[string]interface{}, executor string) (*RunbookExecution, error) {
	runbook, exists := rm.runbooks[runbookID]
	if !exists {
		return nil, fmt.Errorf("runbook %s not found", runbookID)
	}

	if !runbook.Active {
		return nil, fmt.Errorf("runbook %s is not active", runbookID)
	}

	// Validate parameters
	if err := rm.validateParameters(runbook, parameters); err != nil {
		return nil, fmt.Errorf("parameter validation failed: %w", err)
	}

	// Create execution
	execution := &RunbookExecution{
		ID:                fmt.Sprintf("exec-%d", time.Now().UnixNano()),
		RunbookID:         runbookID,
		RunbookName:       runbook.Name,
		StartedAt:         time.Now(),
		Status:            "pending",
		Executor:          executor,
		Parameters:        parameters,
		StepResults:       make(map[string]StepResult),
		ValidationResults: []ValidationResult{},
		Metadata:          make(map[string]interface{}),
	}

	// Check if approval is required
	if runbook.Approval.Required {
		execution.Status = "approval_needed"
		execution.Approval = &ExecutionApproval{
			Required:    true,
			Status:      "pending",
			RequestedBy: executor,
			RequestedAt: time.Now(),
			ExpiresAt:   time.Now().Add(runbook.Approval.Timeout),
		}

		// Store execution and wait for approval
		rm.executor.activeRuns[execution.ID] = execution
		return execution, nil
	}

	// Start execution immediately
	return rm.executor.startExecution(ctx, execution, &runbook)
}

// GetRunbook returns a specific runbook
func (rm *RunbookManager) GetRunbook(runbookID string) (*Runbook, error) {
	runbook, exists := rm.runbooks[runbookID]
	if !exists {
		return nil, fmt.Errorf("runbook %s not found", runbookID)
	}
	return &runbook, nil
}

// ListRunbooks returns all active runbooks
func (rm *RunbookManager) ListRunbooks() []Runbook {
	var runbooks []Runbook
	for _, runbook := range rm.runbooks {
		if runbook.Active {
			runbooks = append(runbooks, runbook)
		}
	}
	return runbooks
}

// GetExecution returns a specific execution
func (rm *RunbookManager) GetExecution(executionID string) (*RunbookExecution, error) {
	execution, exists := rm.executor.activeRuns[executionID]
	if !exists {
		return nil, fmt.Errorf("execution %s not found", executionID)
	}
	return execution, nil
}

// ApproveExecution approves a pending execution
func (rm *RunbookManager) ApproveExecution(ctx context.Context, executionID, approver, reason string) error {
	execution, exists := rm.executor.activeRuns[executionID]
	if !exists {
		return fmt.Errorf("execution %s not found", executionID)
	}

	if execution.Approval == nil || execution.Approval.Status != "pending" {
		return fmt.Errorf("execution is not pending approval")
	}

	execution.Approval.Status = "approved"
	execution.Approval.ApprovedBy = approver
	execution.Approval.ApprovedAt = &[]time.Time{time.Now()}[0]
	execution.Approval.Reason = reason

	// Start execution
	runbook := rm.runbooks[execution.RunbookID]
	_, err := rm.executor.startExecution(ctx, execution, &runbook)
	return err
}

// Helper methods

func (rm *RunbookManager) validateParameters(runbook Runbook, parameters map[string]interface{}) error {
	for name, param := range runbook.Parameters {
		if param.Required {
			if _, exists := parameters[name]; !exists {
				return fmt.Errorf("required parameter '%s' is missing", name)
			}
		}
	}
	return nil
}

func (rm *RunbookManager) loadRunbooks() error {
	dir := filepath.Join(rm.config.RunbooksDirectory)
	if _, err := os.Stat(dir); os.IsNotExist(err) {
		return nil
	}

	files, err := os.ReadDir(dir)
	if err != nil {
		return err
	}

	for _, file := range files {
		if !file.IsDir() && strings.HasSuffix(file.Name(), ".json") {
			filename := filepath.Join(dir, file.Name())
			data, err := os.ReadFile(filename)
			if err != nil {
				rm.logger.Printf("Failed to read runbook %s: %v", file.Name(), err)
				continue
			}

			var runbook Runbook
			if err := json.Unmarshal(data, &runbook); err != nil {
				rm.logger.Printf("Failed to unmarshal runbook %s: %v", file.Name(), err)
				continue
			}

			rm.runbooks[runbook.ID] = runbook
		}
	}

	rm.logger.Printf("Loaded %d runbooks", len(rm.runbooks))
	return nil
}

func (rm *RunbookManager) loadTemplates() error {
	// Implementation for loading templates
	return nil
}

// startExecution starts executing a runbook
func (re *RunbookExecutor) startExecution(ctx context.Context, execution *RunbookExecution, runbook *Runbook) (*RunbookExecution, error) {
	execution.Status = "running"
	re.activeRuns[execution.ID] = execution

	// Execute in background
	go func() {
		re.executeRunbookSteps(ctx, execution, runbook)
	}()

	return execution, nil
}

func (re *RunbookExecutor) executeRunbookSteps(ctx context.Context, execution *RunbookExecution, runbook *Runbook) {
	defer func() {
		now := time.Now()
		execution.CompletedAt = &now
		execution.Duration = now.Sub(execution.StartedAt)
		if execution.Status != "failed" && execution.Status != "cancelled" {
			execution.Status = "completed"
		}
	}()

	// Execute steps in order
	for _, step := range runbook.Steps {
		// Check dependencies
		if !re.checkDependencies(step, execution.StepResults) {
			execution.Status = "failed"
			execution.Error = fmt.Sprintf("Step %s dependencies not met", step.ID)
			return
		}

		// Execute step
		result := re.executeStep(ctx, step, execution.Parameters)
		execution.StepResults[step.ID] = result

		if result.Status == "failed" && step.Critical {
			execution.Status = "failed"
			execution.Error = fmt.Sprintf("Critical step %s failed: %s", step.ID, result.Error)

			// Initiate rollback if needed
			if len(runbook.RollbackSteps) > 0 {
				re.executeRollback(ctx, execution, runbook)
			}
			return
		}
	}

	// Execute validation steps
	re.executeValidationSteps(ctx, execution, runbook)
}

func (re *RunbookExecutor) executeStep(ctx context.Context, step RunbookStep, parameters map[string]interface{}) StepResult {
	result := StepResult{
		StepID:     step.ID,
		Name:       step.Name,
		StartedAt:  time.Now(),
		Status:     "running",
		RetryCount: 0,
	}

	stepCtx, cancel := context.WithTimeout(ctx, step.Timeout)
	defer cancel()

	switch step.Type {
	case "automated", "script":
		// Execute script command
		if err := re.executeScript(stepCtx, step.Command, step.Parameters); err != nil {
			result.Status = "failed"
			result.Error = err.Error()
		} else {
			result.Status = "completed"
		}
	case "manual":
		// Manual step - mark as pending
		result.Status = "pending"
		re.logger.Printf("Manual step requires completion: %s", step.Name)
	case "api":
		// Execute API call
		if err := re.executeAPI(stepCtx, step.Command, step.Parameters); err != nil {
			result.Status = "failed"
			result.Error = err.Error()
		} else {
			result.Status = "completed"
		}
	default:
		result.Status = "skipped"
	}

	now := time.Now()
	result.CompletedAt = &now
	result.Duration = now.Sub(result.StartedAt)

	return result
}

func (re *RunbookExecutor) executeScript(ctx context.Context, command string, parameters map[string]interface{}) error {
	// Implementation would execute the script with proper context and parameter substitution
	re.logger.Printf("Executing script: %s", command)
	return nil
}

func (re *RunbookExecutor) executeAPI(ctx context.Context, command string, parameters map[string]interface{}) error {
	// Implementation would execute API call
	re.logger.Printf("Executing API call: %s", command)
	return nil
}

func (re *RunbookExecutor) executeRollback(ctx context.Context, execution *RunbookExecution, runbook *Runbook) {
	re.logger.Printf("Executing rollback for runbook %s", runbook.Name)

	// Execute rollback steps in reverse order
	for i := len(runbook.RollbackSteps) - 1; i >= 0; i-- {
		step := runbook.RollbackSteps[i]
		result := re.executeStep(ctx, step, execution.Parameters)
		re.logger.Printf("Rollback step %s: %s", step.Name, result.Status)
	}
}

func (re *RunbookExecutor) executeValidationSteps(ctx context.Context, execution *RunbookExecution, runbook *Runbook) {
	for _, validation := range runbook.ValidationSteps {
		result := re.executeValidation(ctx, validation, execution.Parameters)
		execution.ValidationResults = append(execution.ValidationResults, result)
	}
}

func (re *RunbookExecutor) executeValidation(ctx context.Context, validation ValidationStep, parameters map[string]interface{}) ValidationResult {
	result := ValidationResult{
		ValidationID: validation.ID,
		Name:         validation.Name,
		Status:       "running",
		Criteria:     make(map[string]bool),
	}

	// Implementation would execute validation and check criteria
	result.Status = "passed"
	result.Score = 100.0

	return result
}

func (re *RunbookExecutor) checkDependencies(step RunbookStep, results map[string]StepResult) bool {
	for _, dep := range step.DependsOn {
		if result, exists := results[dep]; !exists || result.Status != "completed" {
			return false
		}
	}
	return true
}
